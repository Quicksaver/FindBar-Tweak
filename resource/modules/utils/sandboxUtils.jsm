Modules.VERSION = '2.3.5';
Modules.UTILS = true;
Modules.CLEAN = false;

// window - Similarly to Windows.callOnMostRecent, the window property returns the most recent navigator:browser window object
this.__defineGetter__('window', function() { return Services.wm.getMostRecentWindow('navigator:browser'); });

// document - Returns the document object associated with the most recent window object
this.__defineGetter__('document', function() { return window.document; });

// Prefs - Object to contain and manage all preferences related to the add-on (and others if necessary)
this.__defineGetter__('Prefs', function() { delete this.Prefs; Modules.load('utils/Prefs'); return Prefs; });

// Styles - handle loading and unloading of stylesheets in a quick and easy way
this.__defineGetter__('Styles', function() { delete this.Styles; Modules.load('utils/Styles'); return Styles; });

// Windows - Aid object to help with window tasks involving window-mediator and window-watcher
this.__defineGetter__('Windows', function() { delete this.Windows; Modules.load('utils/Windows'); return Windows; });

// Browsers - Aid object to track and perform tasks on all document browsers across the windows
this.__defineGetter__('Browsers', function() { Windows; delete this.Browsers; Modules.load('utils/Browsers'); return Browsers; });

// Messenger - Aid object to communicate with browser content scripts (e10s).
this.__defineGetter__('Messenger', function() { delete this.Messenger; Modules.load('utils/Messenger'); return Messenger; });

// Observers - Helper for adding and removing observers
this.__defineGetter__('Observers', function() { delete this.Observers; Modules.load('utils/Observers'); return Observers; });

// Overlays - to use overlays in my bootstraped add-ons
this.__defineGetter__('Overlays', function() { Browsers; Observers; Piggyback; delete this.Overlays; Modules.load('utils/Overlays'); return Overlays; });

// Watchers - This acts as a replacement for the event DOM Attribute Modified, works for both attributes and object properties
this.__defineGetter__('Watchers', function() { delete this.Watchers; Modules.load('utils/Watchers'); return Watchers; });

// Keysets - handles editable keysets for the add-on
this.__defineGetter__('Keysets', function() { Windows; delete this.Keysets; Modules.load('utils/Keysets'); return Keysets; });

// closeCustomize() - useful for when you want to close the customize tabs for whatever reason
this.closeCustomize = function() {
	Windows.callOnAll(function(aWindow) {
		if(aWindow.gCustomizeMode) {
			aWindow.gCustomizeMode.exit();
		}
	}, 'navigator:browser');
};

// openOptions() and closeOptions() - to open/close the extension's options dialog or focus it if already opened in case optionsURL is set
// I'm not adding these to sandboxTools because closeOptions is always called when shutting down the add-on,
// so this way it won't load the module when disabling the add-on if it hand't been loaded yet.
this.openOptions = function() {
	if(UNLOADED || !Addon.optionsURL) { return; }
	if(!Windows.callOnMostRecent(function(aWindow) { aWindow.focus(); return true; }, null, Addon.optionsURL)) {
		window.openDialog(Addon.optionsURL, '', 'chrome,toolbar,resizable=false');
	}
};
this.closeOptions = function() {
	if(!Addon.optionsURL) { return; }
	Windows.callOnAll(function(aWindow) { try { aWindow.close(); } catch(ex) {} }, null, Addon.optionsURL);
};

// fillVersion() - to automatically fill in the version information in the about tab of the preferences dialog
// 	box - (xul element) where the version number is supposed to appear
this.fillVersion = function(box) {
	if(!box || !Addon || !Addon.version) { return; }
	
	box.textContent = Addon.version;
	box.hidden = false;
};

Modules.UNLOADMODULE = function() {
	Modules.clean();
};
