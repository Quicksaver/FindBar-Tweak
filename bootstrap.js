// This looks for file defaults.js in resource folder, expects:
//	defaultsVersion - (string) version of defaults.js file, not mandatory but always helpful
//	objName - (string) main object name for the add-on, to be added to window element
//	objPathString - (string) add-on path name to use in URIs
//	prefList: (object) { prefName: defaultValue } - add-on preferences
//	startConditions(aData, aReason) - (method) should return false if any requirements the add-on needs aren't met, otherwise return true or call continueStartup(aData, aReason)
//	onStartup(aData, aReason) and onShutdown(aData, aReason) - (methods) to be called on startup() and shutdown() to initialize and terminate the add-on respectively
//	resource folder in installpath, with modules folder containing moduleAid, sandboxUtils and utils modules
//	chrome.manifest file with content, locale and skin declarations properly set
// handleDeadObject(ex) - 	expects [nsIScriptError object] ex. Shows dead object notices as warnings only in the console.
//				If the code can handle them accordingly and firefox does its thing, they shouldn't cause any problems.
//				Of course this method will only return true in Firefox 15+.
// prepareObject(window, aName) - initializes a window-dependent add-on object with utils loaded into it, returns the newly created object
//	window - (xul object) the window object to be initialized
//	(optional) aName - (string) the object name, defaults to objName
// removeObject(window, aName) - closes and removes the object initialized by prepareObject()
//	see prepareObject()
// preparePreferences(window, aName) - loads the preferencesUtils module into that window's object initialized by prepareObject() (if it hasn't yet, it will be initialized)
//	see prepareObject()
// listenOnce(aSubject, type, handler, capture) - adds handler to window listening to event type that will be removed after one execution.
//	aSubject - (xul object) to add the handler to
//	type - (string) event type to listen to
//	handler - (function(event, aSubject)) - method to be called when event is triggered
//	(optional) capture - (bool) capture mode
// callOnLoad(aSubject, aCallback) - calls aCallback when load event is fired on that window
//	aSubject - (xul object) to execute aCallback on
//	aCallback - (function(aSubject)) to be called on aSubject
// disable() - disables the add-on, in general the add-on disabling itself is a bad idea so I shouldn't use it
// Note: Firefox 8 is the minimum version supported as the bootstrap requires the chrome.manifest file to be loaded, which was implemented in Firefox 8.

let bootstrapVersion = '1.2.13';
let UNLOADED = false;
let STARTED = false;
let Addon = {};
let AddonData = null;
let UserAgentLocale = 'en-US';
let observerLOADED = false;
let onceListeners = [];
let alwaysRunOnShutdown = [];

// Globals - lets me use objects that I can share through all the windows
let Globals = {};

const {classes: Cc, interfaces: Ci, utils: Cu, manager: Cm} = Components;
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/PlacesUtils.jsm");

// For some reason, PlacesUIUtils.jsm disappeared in FF21 (probably has to do with the whole PB restructuring that is going on)
// So I'm adding the tools needed in it manually, makes no practical difference as far as I can tell
// Note: defining the localStore lazy getter on the Services object causes a ZC if it's never called.
let PlacesUIUtils = {};
XPCOMUtils.defineLazyServiceGetter(PlacesUIUtils, "RDF", "@mozilla.org/rdf/rdf-service;1", "nsIRDFService");
XPCOMUtils.defineLazyGetter(PlacesUIUtils, "localStore", function() { return PlacesUIUtils.RDF.GetDataSource("rdf:local-store"); });

XPCOMUtils.defineLazyServiceGetter(Services, "fuel", "@mozilla.org/fuel/application;1", "fuelIApplication");
XPCOMUtils.defineLazyServiceGetter(Services, "navigator", "@mozilla.org/network/protocol;1?name=http", "nsIHttpProtocolHandler");
XPCOMUtils.defineLazyServiceGetter(Services, "stylesheet", "@mozilla.org/content/style-sheet-service;1", "nsIStyleSheetService");

// Per-window private browsing was implemented as of FF20
if(Services.vc.compare(Services.appinfo.platformVersion, "20.0") < 0) {
	// This will only be called in FF19- for compatibility purposes
	XPCOMUtils.defineLazyServiceGetter(Services, "privateBrowsing", "@mozilla.org/privatebrowsing;1", "nsIPrivateBrowsingService");
} else {
	Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
}

function handleDeadObject(ex) {
	if(ex.message == "can't access dead object") {
		var scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
		scriptError.init("Can't access dead object. This shouldn't cause any problems.", ex.sourceName || ex.fileName || null, ex.sourceLine || null, ex.lineNumber || null, ex.columnNumber || null, scriptError.warningFlag, 'XPConnect JavaScript');
		Services.console.logMessage(scriptError);
		return true;
	} else {
		Cu.reportError(ex);
		return false;
	}
}

function prepareObject(window, aName) {
	// I can override the object name if I want
	let objectName = aName || objName;
	if(window[objectName]) { return; }
	
	window[objectName] = {
		objName: objectName,
		objPathString: objPathString,
		_UUID: new Date().getTime(),
		
		// every supposedly global variable is inaccessible because bootstraped means sandboxed, so I have to reference all these;
		// it's easier to reference more specific objects from within the modules for better control, only setting these two here because they're more generalized
		window: window,
		get document () { return window.document; },
		$: function(id) { return window.document.getElementById(id); },
		$$: function(sel) { return window.document.querySelectorAll(sel); }
	};
	
	Services.scriptloader.loadSubScript("resource://"+objPathString+"/modules/utils/moduleAid.jsm", window[objectName]);
	window[objectName].moduleAid.load("utils/windowUtils");
	
	setAttribute(window.document.documentElement, objectName+'_UUID', window[objectName]._UUID);
}

function removeObject(window, aName) {
	let objectName = aName || objName;
	
	if(window[objectName]) {
		removeAttribute(window.document.documentElement, objectName+'_UUID', window[objectName]._UUID);
		window[objectName].moduleAid.unload("utils/windowUtils");
		delete window[objectName];
	}
}

function preparePreferences(window, aName) {
	let objectName = aName || objName;
	
	if(!window[objectName]) {
		prepareObject(window, objectName);
	}
	window[objectName].moduleAid.load("utils/preferencesUtils");
}

function removeOnceListener(oncer) {
	for(var i=0; i<onceListeners.length; i++) {
		if(!oncer) {
			onceListeners[i]();
			continue;
		}
		
		if(onceListeners[i] == oncer) {
			onceListeners.splice(i, 1);
			return;
		}
	}
	
	if(!oncer) {
		onceListeners = [];
	}
}

function listenOnce(aSubject, type, handler, capture) {
	if(UNLOADED || !aSubject || !aSubject.addEventListener) { return; }
	
	var runOnce = function(event) {
		try { aSubject.removeEventListener(type, runOnce, capture); }
		catch(ex) { handleDeadObject(ex); } // Prevents some can't access dead object errors
		if(!UNLOADED && event !== undefined) {
			removeOnceListener(runOnce);
			try { handler(event, aSubject); }
			catch(ex) { Cu.reportError(ex); }
		}
	};
	
	aSubject.addEventListener(type, runOnce, capture);
	onceListeners.push(runOnce);
}

function callOnLoad(aSubject, aCallback, arg1) {
	listenOnce(aSubject, "load", function(event, aSubject) {
		if(UNLOADED) { return; }
		
		try { aCallback(aSubject, arg1); }
		catch(ex) { Cu.reportError(ex); }
	}, false);
}

function setResourceHandler() {
	// chrome.manifest files are loaded automatically in Firefox 10+.
	// Got it from https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIComponentManager#addBootstrappedManifestLocation()
	if(Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0) {
		Cm.addBootstrappedManifestLocation(AddonData.installPath);
	}
	
	let alias = Services.io.newFileURI(AddonData.installPath);
	let resourceURI = (AddonData.installPath.isDirectory()) ? alias.spec : 'jar:' + alias.spec + '!/';
	resourceURI += 'resource/';
	
	// Set the default strings for the add-on
	Services.scriptloader.loadSubScript(resourceURI + 'defaults.js', this);
	
	alias = Services.io.newURI(resourceURI, null, null);
	let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
	resource.setSubstitution(objPathString, alias);
	
	// Get the utils.jsm module into our sandbox
	Services.scriptloader.loadSubScript("resource://"+objPathString+"/modules/utils/moduleAid.jsm", this);
	moduleAid.load("utils/sandboxUtils");
}

function removeResourceHandler() {
	moduleAid.unload("utils/sandboxUtils");
	
	let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
	resource.setSubstitution(objPathString, null);
	
	// chrome.manifest files are loaded automatically in Firefox 10+.
	// Got it from https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIComponentManager#addBootstrappedManifestLocation()
	if(Services.vc.compare(Services.appinfo.platformVersion, "10.0") < 0) {
		Cm.removeBootstrappedManifestLocation(AddonData.installPath);
	}
}

function disable() {
	AddonManager.getAddonByID(AddonData.id, function(addon) {
		addon.userDisabled = true;
	});
}

function continueStartup(aReason) {
	STARTED = aReason;
	onStartup(aReason);
}

function startup(aData, aReason) {
	UNLOADED = false;
	AddonData = aData;
	
	// This includes the optionsURL property
	AddonManager.getAddonByID(AddonData.id, function(addon) {
		if(typeof(UNLOADED) == 'undefined' || UNLOADED) { return; }
		Addon = addon;
	});
	
	// add resource:// protocol handler so I can access my modules
	setResourceHandler();
	
	// Get the current application locale
	UserAgentLocale = Services.fuel.prefs.get('general.useragent.locale').value;
	
	// set add-on preferences defaults
	// This should come before startConditions() so we can use it in there
	prefAid.setDefaults(prefList);
	
	// In the case of OmnibarPlus, I need the Omnibar add-on enabled for everything to work
	if(startConditions(aReason)) {
		continueStartup(aReason);
	}
}

function shutdown(aData, aReason) {
	UNLOADED = aReason;
	
	if(aReason == APP_SHUTDOWN) {
		// List of methods that must always be run on shutdown, such as restoring some native prefs
		for(var i=0; i<alwaysRunOnShutdown.length; i++) {
			alwaysRunOnShutdown[i]();
		}
		
		if(observerLOADED) { observerAid.callQuits(); }
		removeOnceListener();
		return;
	}
	
	if(STARTED) {
		closeOptions();
		onShutdown(aReason);
	}
	
	// remove resource://
	removeResourceHandler();
	removeOnceListener();
}

function install() {}
function uninstall() {}
