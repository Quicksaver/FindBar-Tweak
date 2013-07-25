moduleAid.VERSION = '1.0.2';

moduleAid.LOADMODULE = function() {
	moduleAid.loadIf('compatibilityFix/Mac', Services.appinfo.OS == 'Darwin');
	moduleAid.loadIf('compatibilityFix/FF25', perTabFB);
	moduleAid.load('compatibilityFix/customize');
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('compatibilityFix/customize');
	moduleAid.unload('compatibilityFix/FF25');
	moduleAid.unload('compatibilityFix/Mac');
};
