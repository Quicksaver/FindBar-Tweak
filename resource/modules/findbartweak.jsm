// VERSION 2.0.5

this.viewSource = false;
this.FITFull = false;
this.FITSidebar = false;

this.__defineGetter__('FITSidebarOpen', function() { return self.FITMini && FITMini.sidebar; });

this.openOptions = function() {
	// if this is a normal browser window, just open a new preferences tab in it
	if(!viewSource && !FITFull) {
		PrefPanes.open(window);
		return;
	}

	// we mostly likely have a browser window from where we came, so use that one to open the preferences tab
	if(window.opener && !window.opener.closed && window.opener.document.documentElement.getAttribute('windowtype') == 'navigator:browser') {
		PrefPanes.open(window.opener);
		return;
	}

	// otherwise, try to open a preferences tab in the most recent browser window
	if(Windows.callOnMostRecent(function(aWindow) {
		PrefPanes.open(aWindow);
		return true;
	}, 'navigator:browser')) {
		return;
	}

	// it's unlikely we get here, but if all else fails, we'll have to open a new browser window to place our preferences tab in it,
	// since our FITMini doesn't load these utils by default, we can load them now (this way we also only load them when(if!) we actually need them)
	Services.scriptloader.loadSubScript("chrome://browser/content/utilityOverlay.js", window);
	window.openUILinkIn(PrefPanes.aboutUri.spec, "window");
};

this.toggleBlurCloses = function() {
	Modules.loadIf('blurCloses', !Prefs.globalFB && Prefs.blurCloses);
};

this.togglePerTab = function() {
	Modules.loadIf('perTab', !viewSource && !FITFull && !Prefs.globalFB && !FITSidebarOpen);
	Modules.loadIf('globalFB', !viewSource && !FITFull && (Prefs.globalFB || FITSidebarOpen));
};

this.toggleRememberStartup = function() {
	Modules.loadIf('rememberStartup', !viewSource && !FITFull && Prefs.globalFB && Prefs.onStartup);
};

this.toggleFindInTabs = function() {
	Modules.loadIf('findInTabsMini', FITFull || Prefs.findInTabs);
};

Modules.LOADMODULE = function() {
	viewSource = (document.documentElement.getAttribute('windowtype') == 'navigator:view-source') && $('viewSource');
	FITFull = (document.documentElement.getAttribute('windowtype') == 'addon:findInTabs') && $(objPathString+'-findInTabs');
	FITSidebar = FITFull && trueAttribute(document.documentElement, 'FITSidebar');

	Modules.load('gFindBar');
	if(!FITFull) {
		Modules.load('mFinder');
		Modules.load('highlights');
	}
	Modules.load('FindBarUI');
	Modules.load('compatibilityFix/windowFixes');

	Prefs.listen('findInTabs', toggleFindInTabs);

	if(!FITFull) {
		Prefs.listen('globalFB', toggleBlurCloses);
		Prefs.listen('blurCloses', toggleBlurCloses);
		Prefs.listen('globalFB', togglePerTab);
		Prefs.listen('globalFB', toggleRememberStartup);
		Prefs.listen('onStartup', toggleRememberStartup);

		toggleBlurCloses();
		togglePerTab();
	}

	toggleFindInTabs();

	if(!FITFull) {
		toggleRememberStartup(); // This should be the last thing to be initialized, as it can open the find bar
	}
};

Modules.UNLOADMODULE = function() {
	if(!FITFull) {
		Modules.unload('rememberStartup');
	}

	Prefs.unlisten('findInTabs', toggleFindInTabs);

	Modules.unload('findInTabs');

	if(!FITFull) {
		Modules.unload('perTab');
		Modules.unload('globalFB');
		Modules.unload('blurCloses');

		Prefs.unlisten('globalFB', toggleBlurCloses);
		Prefs.unlisten('blurCloses', toggleBlurCloses);
		Prefs.unlisten('globalFB', togglePerTab);
		Prefs.unlisten('globalFB', toggleRememberStartup);
		Prefs.unlisten('onStartup', toggleRememberStartup);
	}

	Modules.unload('compatibilityFix/windowFixes');
	Modules.unload('FindBarUI');

	if(!FITFull) {
		Modules.unload('highlights');
		Modules.unload('mFinder');
	}

	Modules.unload('gFindBar');
};
