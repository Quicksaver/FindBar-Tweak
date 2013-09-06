moduleAid.VERSION = '1.1.3';

this.viewSource = false;

this.toggleCtrlF = function() {
	moduleAid.loadIf('ctrlF', prefAid.ctrlFCloses);
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
	moduleAid.loadIf('findInTabs', !viewSource && prefAid.findInTabs);
};

moduleAid.LOADMODULE = function() {
	if(document.documentElement.getAttribute('windowtype') == 'navigator:view-source') { viewSource = $('viewSource'); }
	toggleAttribute(document.documentElement, objName+'-FF25', perTabFB);
	
	moduleAid.load('initFindbar');
	moduleAid.load('FindBarUI');
	moduleAid.load('highlights');
	moduleAid.load('compatibilityFix/windowFixes');
	
	prefAid.listen('ctrlFCloses', toggleCtrlF);
	prefAid.listen('blurCloses', toggleBlurCloses);
	prefAid.listen('perTab', togglePerTab);
	prefAid.listen('blurCloses', togglePerTab);
	prefAid.listen('onStartup', toggleRememberStartup);
	prefAid.listen('perTab', toggleRememberStartup);
	prefAid.listen('blurCloses', toggleRememberStartup);
	prefAid.listen('findInTabs', toggleFindInTabs);
	
	toggleCtrlF();
	toggleBlurCloses();
	togglePerTab();
	toggleFindInTabs();
	toggleRememberStartup(); // This should be the last thing to be initialized, as it can open the find bar
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('rememberStartup');
	moduleAid.unload('findInTabs');
	moduleAid.unload('perTab');
	moduleAid.unload('globalFB');
	moduleAid.unload('blurCloses');
	moduleAid.unload('ctrlF');
	
	prefAid.unlisten('ctrlFCloses', toggleCtrlF);
	prefAid.unlisten('blurCloses', toggleBlurCloses);
	prefAid.unlisten('perTab', togglePerTab);
	prefAid.unlisten('blurCloses', togglePerTab);
	prefAid.unlisten('onStartup', toggleRememberStartup);
	prefAid.unlisten('perTab', toggleRememberStartup);
	prefAid.unlisten('blurCloses', toggleRememberStartup);
	prefAid.unlisten('findInTabs', toggleFindInTabs);
	
	moduleAid.unload('compatibilityFix/windowFixes');
	moduleAid.unload('highlights');
	moduleAid.unload('FindBarUI');
	moduleAid.unload('initFindbar');
	
	removeAttribute(document.documentElement, objName+'-FF25');
};
