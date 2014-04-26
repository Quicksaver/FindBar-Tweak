moduleAid.VERSION = '1.0.4';

moduleAid.LOADMODULE = function() {
	moduleAid.loadIf('compatibilityFix/Mac', Services.appinfo.OS == 'Darwin');
	moduleAid.loadIf('compatibilityFix/FF26', onTopFB);
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('compatibilityFix/FF26');
	moduleAid.unload('compatibilityFix/Mac');
};
