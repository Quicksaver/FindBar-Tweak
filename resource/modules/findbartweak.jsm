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
	
	prefAid.listen('ctrlFCloses', toggleCtrlF);
	prefAid.listen('onStartup', toggleRememberStartup);
	
	toggleCtrlF();
	toggleRememberStartup();
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('ctrlF');
	moduleAid.unload('rememberStartup');
	
	prefAid.unlisten('ctrlFCloses', toggleCtrlF);
	prefAid.unlisten('onStartup', toggleRememberStartup);
	
	moduleAid.unload('FindBarUI');
	moduleAid.unload('initFindbar');
};
