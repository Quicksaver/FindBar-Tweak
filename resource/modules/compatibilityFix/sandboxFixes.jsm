moduleAid.VERSION = '1.0.0';
	
moduleAid.LOADMODULE = function() {
	moduleAid.loadIf('compatibilityFix/Mac', Services.appinfo.OS == 'Darwin');
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('compatibilityFix/Mac');
};
