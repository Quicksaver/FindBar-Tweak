moduleAid.VERSION = '1.2.1';

this.viewSource = false;
this.FITFull = false;

this.toggleCtrlF = function() {
	moduleAid.loadIf('ctrlF', FITFull || prefAid.ctrlFCloses);
};

this.toggleBlurCloses = function() {
	moduleAid.loadIf('blurCloses', prefAid.blurCloses);
};

this.togglePerTab = function() {
	moduleAid.loadIf('perTab', !viewSource && prefAid.perTab && !prefAid.blurCloses);
	if(perTabFB) {
		moduleAid.loadIf('globalFB', !viewSource && !prefAid.perTab && !prefAid.blurCloses);
	}
};

this.toggleRememberStartup = function() {
	moduleAid.loadIf('rememberStartup', !viewSource && prefAid.onStartup && !prefAid.perTab && !prefAid.blurCloses);
};

this.toggleFindInTabs = function() {
	moduleAid.loadIf('findInTabsMini', FITFull || prefAid.findInTabs);
};

moduleAid.LOADMODULE = function() {
	if(document.documentElement.getAttribute('windowtype') == 'navigator:view-source') { viewSource = $('viewSource'); }
	FITFull = $(objName+'-findInTabs');
	toggleAttribute(document.documentElement, objName+'-FF25', perTabFB);
	
	moduleAid.load('initFindbar');
	moduleAid.load('initFinder');
	moduleAid.load('FindBarUI');
	if(!FITFull) { moduleAid.load('highlights'); }
	moduleAid.load('compatibilityFix/windowFixes');
	
	prefAid.listen('findInTabs', toggleFindInTabs);
	
	if(!FITFull) {
		prefAid.listen('ctrlFCloses', toggleCtrlF);
		prefAid.listen('blurCloses', toggleBlurCloses);
		prefAid.listen('perTab', togglePerTab);
		prefAid.listen('blurCloses', togglePerTab);
		prefAid.listen('onStartup', toggleRememberStartup);
		prefAid.listen('perTab', toggleRememberStartup);
		prefAid.listen('blurCloses', toggleRememberStartup);
	
		toggleCtrlF();
		toggleBlurCloses();
		togglePerTab();
	}
	
	toggleFindInTabs();
	
	if(!FITFull) {
		toggleRememberStartup(); // This should be the last thing to be initialized, as it can open the find bar
	}
};

moduleAid.UNLOADMODULE = function() {
	if(!FITFull) {
		moduleAid.unload('rememberStartup');
	}
	
	prefAid.unlisten('findInTabs', toggleFindInTabs);
	
	moduleAid.unload('findInTabs');
	
	if(!FITFull) {
		moduleAid.unload('ctrlF');
		moduleAid.unload('perTab');
		moduleAid.unload('globalFB');
		moduleAid.unload('blurCloses');
	
		prefAid.unlisten('ctrlFCloses', toggleCtrlF);
		prefAid.unlisten('blurCloses', toggleBlurCloses);
		prefAid.unlisten('perTab', togglePerTab);
		prefAid.unlisten('blurCloses', togglePerTab);
		prefAid.unlisten('onStartup', toggleRememberStartup);
		prefAid.unlisten('perTab', toggleRememberStartup);
		prefAid.unlisten('blurCloses', toggleRememberStartup);
	}
	
	moduleAid.unload('compatibilityFix/windowFixes');
	if(!FITFull) { moduleAid.unload('highlights'); }
	moduleAid.unload('FindBarUI');
	moduleAid.unload('initFinder');
	moduleAid.unload('initFindbar');
	
	removeAttribute(document.documentElement, objName+'-FF25');
};
