moduleAid.VERSION = '1.0.1';

moduleAid.LOADMODULE = function() {
	moduleAid.loadIf('compatibilityFix/Mac', Services.appinfo.OS == 'Darwin');
	moduleAid.load('compatibilityFix/customize');
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('compatibilityFix/customize');
	moduleAid.unload('compatibilityFix/Mac');
};
