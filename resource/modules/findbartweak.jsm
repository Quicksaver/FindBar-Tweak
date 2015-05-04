Modules.VERSION = '2.0.3';

this.viewSource = false;
this.FITFull = false;

this.doOpenOptions = function() {
	openOptions();
};

this.toggleBlurCloses = function() {
	Modules.loadIf('blurCloses', !Prefs.globalFB && Prefs.blurCloses);
};

this.togglePerTab = function() {
	Modules.loadIf('perTab', !viewSource && !FITFull && !Prefs.globalFB);
	Modules.loadIf('globalFB', !viewSource && !FITFull && Prefs.globalFB);
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
	
	if(!viewSource && !FITFull) {
		Modules.load('whatsNew');
	}
	
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
	Modules.unload('whatsNew');
};
