Modules.VERSION = '1.0.5';
Modules.UTILS = true;

// PrefPanes - handles the preferences tab and all its contents for the add-on
// register(aPane, aModule) - registers a new preferences pane to be appended to the preferences tab
//	aPane - (str) name of the pane, in the form of a aPane.xul overlay to be found in content/
//	(optional) aModule -	(str) name of a module to be loaded alongside the overlay, in the form of a aModule.jsm to be found in resource/modules/;
//				if (bool) true, default to aPane
// unregister(aPane) - unregisters a preferences pane from the preferences tab
//	see register()
// setList(list) - register a set of panes at once
//	list - (iterable) list of arguments to apply to register()
// open() - tries to switch to an already opened add-on preferences tab; if none is found then a new one is opened in the most recent window
// closeAll() - closes all the add-on's preferences tab
this.PrefPanes = {
	chromeUri: 'chrome://'+objPathString+'/content/utils/preferences.xul',
	aboutUri: null,
	
	get notifyUri () {
		return (this.aboutUri ? this.aboutUri.spec : this.chromeUri) + '#paneAbout';
	},
	
	panes: new Map(),
	previousVersion: null,
	
	observe: function(aSubject, aTopic, aData) {
		this.initWindow(aSubject);
	},
	
	register: function(aPane, aModule) {
		if(!this.panes.has(aPane)) {
			this.panes.set(aPane, {
				module: (aModule === true) ? aPane : aModule
			});
		}
	},
	
	unregister: function(aPane) {
		if(this.panes.has(aPane)) {
			this.panes.delete(aPane);
		}
	},
	
	setList: function(list) {
		for(let args of list) {
			this.register.apply(this, args);
		}
	},
	
	init: function() {
		// we set the add-on status in the API webpage from within the add-on itself
		Messenger.loadInAll('utils/api');
		
		// always add the about pane to the preferences dialog, it should be the last category in the list
		this.register('utils/about', true);
		
		Browsers.callOnAll(aWindow => { this.initWindow(aWindow); }, this.chromeUri);
		Browsers.register(this, 'pageshow', this.chromeUri);
		
		// if defaults.js supplies an addonUUID, use it to register the about: uri linking to the add-on's preferences
		if(addonUUID) {
			this.aboutUri = {
				spec: 'about:'+objPathString,
				manager: Cm.QueryInterface(Ci.nsIComponentRegistrar),
				
				handler: {
					uri: Services.io.newURI(this.chromeUri, null, null),
					classDescription: 'about: handler for add-on '+objName,
					classID: Components.ID(addonUUID),
					contractID: '@mozilla.org/network/protocol/about;1?what='+objPathString,
					QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),
					newChannel: function(aURI) {
						let chan = Services.io.newChannelFromURI(this.uri);
						chan.originalURI = aURI;
						return chan;
					},
					getURIFlags: function(aURI) 0
				},
				
				load: function() {
					this.manager.registerFactory(this.handler.classID, this.handler.classDescription, this.handler.contractID, this);
				},
				
				unload: function() {
					this.manager.unregisterFactory(this.handler.classID, this);
				},
				
				createInstance: function(outer, iid) {
					if(outer) {
						throw Cr.NS_ERROR_NO_AGGREGATION;
					}
					return this.handler;
				}
			};
			this.aboutUri.load();
			
			Browsers.callOnAll(aWindow => { this.initWindow(aWindow); }, this.aboutUri.spec);
			Browsers.register(this, 'pageshow', this.aboutUri.spec);
		}
		
		// current version of firefox has some display issues, this doesn't seem needed in the current Nightly (FF41+)
		if(Services.vc.compare(Services.appinfo.version, '41.0a1') < 0) {
			var sscode = '@namespace url(http://www.w3.org/1999/xhtml);\n';
			sscode += '@-moz-document url-prefix("'+this.chromeUri+'")'+(this.aboutUri ? ', url-prefix("'+this.aboutUri.spec+'")' : '')+' {\n';
			sscode += '	#bank .hours { height: 100%; }\n';
			sscode += '	#bank .balance { position: relative; height: 50%; top: 0.4em; }\n';
			sscode += '}';
			
			Styles.load('PrefPanesHtmlFix', sscode, true);
		}
		
		// and this doesn't seem need in current Aurora (FF40+)
		if(Services.vc.compare(Services.appinfo.version, '40.0a2') < 0) {	
			var sscode = '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
			sscode += '@-moz-document url-prefix("'+this.chromeUri+'")'+(this.aboutUri ? ', url-prefix("'+this.aboutUri.spec+'")' : '')+' {\n';
			sscode += '	.smallindent[focused="true"] > .radio-label-box {\n';
			sscode += '		-moz-margin-start: -1px;\n';
			sscode += '		-moz-margin-end: 0;\n';
			sscode += '	}\n';
			sscode += '}';
			
			Styles.load('PrefPanesXulFix', sscode, true);
		}
		
		// if we're in a dev version, ignore all this
		if(AddonData.version.contains('a') || AddonData.version.contains('b')) { return; }
		
		// if we're updating from a version without this module, try to figure out the last version
		if(Prefs.lastVersionNotify == '0' && STARTED == ADDON_UPGRADE && AddonData.oldVersion) {
			Prefs.lastVersionNotify = AddonData.oldVersion;
		}
		
		// now make sure we notify the user when updating only; when installing for the first time do nothing
		if(Prefs.showTabOnUpdates && Prefs.lastVersionNotify != '0' && Services.vc.compare(Prefs.lastVersionNotify, AddonData.version) < 0) {
			this.previousVersion = Prefs.lastVersionNotify;
			this.openWhenReady();
		}
		
		// always set the pref to the current version, this also ensures only one notification tab will open per firefox session (and not one per window)
		if(Prefs.lastVersionNotify != AddonData.version) {
			Prefs.lastVersionNotify = AddonData.version;
		}
	},
	
	uninit: function() {
		Messenger.unloadFromAll('utils/api');
		
		this.closeAll();
		
		Styles.unload('PrefPanesHtmlFix');
		Styles.unload('PrefPanesXulFix');
		
		Browsers.unregister(this, 'pageshow', this.chromeUri);
		
		if(this.aboutUri) {
			Browsers.unregister(this, 'pageshow', this.aboutUri.spec);
			this.aboutUri.unload();
		}
	},
	
	// we have to wait for Session Store to finish, otherwise our tab will be overriden by a session-restored tab
	openWhenReady: function() {
		// in theory, the add-on could be disabled inbetween aSync calls
		if(typeof(PrefPanes) == 'undefined') { return; }
		
		// most recent window, if it doesn't exist yet it means we're still starting up, so give it a moment
		var aWindow = window;
		if(!aWindow || !aWindow.SessionStore) {
			aSync(() => { this.openWhenReady(); }, 500);
			return;
		}
		
		// SessionStore should have registered the window and initialized it, to ensure it doesn't overwrite our tab with any saved ones
		// (ours will open in addition to session-saved tabs)
		var state = JSON.parse(aWindow.SessionStore.getBrowserState());
		if(state.windows.length == 0) {
			aSync(() => { this.openWhenReady(); }, 500);
			return;
		}
		
		// also ensure the window is fully initialized before trying to open a new tab
		if(!aWindow.gBrowserInit || !aWindow.gBrowserInit.delayedStartupFinished) {
			aSync(() => { this.openWhenReady(); }, 500);
			return;
		}
		
		this.open(aWindow, true);
	},
	
	open: function(aWindow, loadOnStartup) {
		// first try to switch to an already opened options tab
		for(let tab of aWindow.gBrowser.mTabs) {
			if(tab.linkedBrowser.currentURI.spec.startsWith(this.chromeUri)
			|| (this.aboutUri && tab.linkedBrowser.currentURI.spec.startsWith(this.aboutUri.spec))) {
				aWindow.gBrowser.selectedTab = tab;
				aWindow.focus();
				return;
			}
		}
		
		// no tab was found, so open a new one
		if(loadOnStartup) {
			aWindow.gBrowser.selectedTab = aWindow.gBrowser.addTab(this.notifyUri);
			aWindow.gBrowser.selectedTab.loadOnStartup = true; // for Tab Mix Plus
		}
		else {
			aWindow.gBrowser.selectedTab = aWindow.gBrowser.addTab(this.aboutUri ? this.aboutUri.spec : this.chromeUri);
		}
		aWindow.focus();
	},
	
	closeAll: function() {
		Windows.callOnAll(aWindow => {
			for(let tab of aWindow.gBrowser.mTabs) {
				if(tab.linkedBrowser.currentURI.spec.startsWith(this.chromeUri)
				|| (this.aboutUri && tab.linkedBrowser.currentURI.spec.startsWith(this.aboutUri.spec))) {
					aWindow.gBrowser.removeTab(tab);
				}
			}
		}, 'navigator:browser');
	},
	
	initWindow: function(aWindow) {
		// prepare the window as usual
		replaceObjStrings(aWindow.document);
		prepareObject(aWindow, objName);
		
		// load the utils only when the preferences tab is finished with its overlays from this object
		let promises = [];
		for(let pane of this.panes.keys()) {
			promises.push(new Promise(function(resolve, reject) {
				let overlay = pane;
				Overlays.overlayWindow(aWindow, overlay, {
					onLoad: function() {
						resolve();
					}
				});
			}));
		}
		
		Promise.all(promises).then(() => {
			aWindow[objName].Modules.load("utils/preferencesUtils");
			
			// if any of the panes require their own module, load it now
			for(let pane of this.panes.values()) {
				if(pane.module) {
					aWindow[objName].Modules.load(pane.module);
				}
			}
		});
	}
};

Modules.LOADMODULE = function() {
	Prefs.setDefaults({
		lastPrefPane: '',
		lastVersionNotify: '0',
		showTabOnUpdates: true
	});
	
	PrefPanes.init();
};

Modules.UNLOADMODULE = function() {
	PrefPanes.uninit();
};
