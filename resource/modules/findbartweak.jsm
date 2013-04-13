moduleAid.VERSION = '1.0.0';

this.toggleCtrlF = function() {
	moduleAid.loadIf('ctrlF', prefAid.ctrlFCloses);
};

this.toggleRememberStartup = function() {
	moduleAid.loadIf('rememberStartup', prefAid.onStartup);
};
	
moduleAid.LOADMODULE = function() {
	moduleAid.load('initFindbar');
	moduleAid.load('FindBarUI');
	moduleAid.load('highlights');
	moduleAid.load('compatibilityFix/windowFixes');
	
	prefAid.listen('ctrlFCloses', toggleCtrlF);
	prefAid.listen('onStartup', toggleRememberStartup);
	
	toggleCtrlF();
	toggleRememberStartup(); // This should be the last thing to be initialized, as it can open the find bar
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('rememberStartup');
	moduleAid.unload('ctrlF');
	
	prefAid.unlisten('ctrlFCloses', toggleCtrlF);
	prefAid.unlisten('onStartup', toggleRememberStartup);
	
	moduleAid.unload('compatibilityFix/windowFixes');
	moduleAid.unload('highlights');
	moduleAid.unload('FindBarUI');
	moduleAid.unload('initFindbar');
};
