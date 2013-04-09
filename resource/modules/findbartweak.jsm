moduleAid.VERSION = '1.0.0';

this.toggleCtrlF = function() {
	moduleAid.loadIf('ctrlF', prefAid.ctrlFCloses && !UNLOADED);
};
	
moduleAid.LOADMODULE = function() {
	moduleAid.load('initFindbar');
	moduleAid.load('FindBarUI');
	
	prefAid.listen('ctrlFCloses', toggleCtrlF);
	
	toggleCtrlF();
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('ctrlF');
	
	prefAid.unlisten('ctrlFCloses', toggleCtrlF);
	
	moduleAid.unload('FindBarUI');
	moduleAid.unload('initFindbar');
};
