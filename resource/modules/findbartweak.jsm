Modules.VERSION = '2.0.1';

this.viewSource = false;
this.FITFull = false;

this.doOpenOptions = function() {
	openOptions();
};

this.toggleBlurCloses = function() {
	Modules.loadIf('blurCloses', Prefs.blurCloses);
};

this.togglePerTab = function() {
	Modules.loadIf('perTab', !viewSource && !FITFull && Prefs.perTab && !Prefs.blurCloses);
	Modules.loadIf('globalFB', !viewSource && !FITFull && !Prefs.perTab && !Prefs.blurCloses);
};

this.toggleRememberStartup = function() {
	Modules.loadIf('rememberStartup', !viewSource && !FITFull && Prefs.onStartup && !Prefs.perTab && !Prefs.blurCloses);
};

this.toggleFindInTabs = function() {
	Modules.loadIf('findInTabsMini', FITFull || Prefs.findInTabs);
};

Modules.LOADMODULE = function() {
	viewSource = (document.documentElement.getAttribute('windowtype') == 'navigator:view-source') && $('viewSource');
	FITFull = (document.documentElement.getAttribute('windowtype') == 'addon:findInTabs') && $(objPathString+'-findInTabs');
	
	Modules.load('whatsNew');
	Modules.load('gFindBar');
	if(!FITFull) {
		Modules.load('mFinder');
		Modules.load('highlights');
	}
	Modules.load('FindBarUI');
	Modules.load('compatibilityFix/windowFixes');
	
	Prefs.listen('findInTabs', toggleFindInTabs);
	
	if(!FITFull) {
		Prefs.listen('blurCloses', toggleBlurCloses);
		Prefs.listen('perTab', togglePerTab);
		Prefs.listen('blurCloses', togglePerTab);
		Prefs.listen('onStartup', toggleRememberStartup);
		Prefs.listen('perTab', toggleRememberStartup);
		Prefs.listen('blurCloses', toggleRememberStartup);
		
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
		
		Prefs.unlisten('blurCloses', toggleBlurCloses);
		Prefs.unlisten('perTab', togglePerTab);
		Prefs.unlisten('blurCloses', togglePerTab);
		Prefs.unlisten('onStartup', toggleRememberStartup);
		Prefs.unlisten('perTab', toggleRememberStartup);
		Prefs.unlisten('blurCloses', toggleRememberStartup);
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
