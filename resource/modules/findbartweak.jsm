moduleAid.VERSION = '1.0.2';

this.toggleCtrlF = function() {
	moduleAid.loadIf('ctrlF', prefAid.ctrlFCloses);
};

this.toggleBlurCloses = function() {
	moduleAid.loadIf('blurCloses', prefAid.blurCloses);
};

this.togglePerTab = function() {
	moduleAid.loadIf('perTab', prefAid.perTab && !prefAid.blurCloses);
};

this.toggleRememberStartup = function() {
	moduleAid.loadIf('rememberStartup', prefAid.onStartup && !prefAid.perTab && !prefAid.blurCloses);
};
	
moduleAid.LOADMODULE = function() {
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
	
	toggleCtrlF();
	toggleBlurCloses();
	togglePerTab();
	toggleRememberStartup(); // This should be the last thing to be initialized, as it can open the find bar
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('rememberStartup');
	moduleAid.unload('perTab');
	moduleAid.unload('blurCloses');
	moduleAid.unload('ctrlF');
	
	prefAid.unlisten('ctrlFCloses', toggleCtrlF);
	prefAid.unlisten('blurCloses', toggleBlurCloses);
	prefAid.unlisten('perTab', togglePerTab);
	prefAid.unlisten('blurCloses', togglePerTab);
	prefAid.unlisten('onStartup', toggleRememberStartup);
	prefAid.unlisten('perTab', toggleRememberStartup);
	prefAid.unlisten('blurCloses', toggleRememberStartup);
	
	moduleAid.unload('compatibilityFix/windowFixes');
	moduleAid.unload('highlights');
	moduleAid.unload('FindBarUI');
	moduleAid.unload('initFindbar');
};
