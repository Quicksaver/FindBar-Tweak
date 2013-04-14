moduleAid.VERSION = '1.0.1';

this.toggleCtrlF = function() {
	moduleAid.loadIf('ctrlF', prefAid.ctrlFCloses);
};

this.togglePerTab = function() {
	moduleAid.loadIf('perTab', prefAid.perTab);
};

this.toggleRememberStartup = function() {
	moduleAid.loadIf('rememberStartup', prefAid.onStartup && !prefAid.perTab);
};
	
moduleAid.LOADMODULE = function() {
	moduleAid.load('initFindbar');
	moduleAid.load('FindBarUI');
	moduleAid.load('highlights');
	moduleAid.load('compatibilityFix/windowFixes');
	
	prefAid.listen('ctrlFCloses', toggleCtrlF);
	prefAid.listen('onStartup', toggleRememberStartup);
	prefAid.listen('perTab', toggleRememberStartup);
	prefAid.listen('perTab', togglePerTab);
	
	toggleCtrlF();
	togglePerTab();
	toggleRememberStartup(); // This should be the last thing to be initialized, as it can open the find bar
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('rememberStartup');
	moduleAid.unload('perTab');
	moduleAid.unload('ctrlF');
	
	prefAid.unlisten('ctrlFCloses', toggleCtrlF);
	prefAid.unlisten('onStartup', toggleRememberStartup);
	prefAid.unlisten('perTab', toggleRememberStartup);
	prefAid.unlisten('perTab', togglePerTab);
	
	moduleAid.unload('compatibilityFix/windowFixes');
	moduleAid.unload('highlights');
	moduleAid.unload('FindBarUI');
	moduleAid.unload('initFindbar');
};
