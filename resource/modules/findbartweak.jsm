moduleAid.VERSION = '1.0.0';
	
moduleAid.LOADMODULE = function() {
	moduleAid.load('initFindbar');
	moduleAid.load('FindBarUI');
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('FindBarUI');
	moduleAid.unload('initFindbar');
};
