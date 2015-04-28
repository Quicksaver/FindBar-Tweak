Modules.VERSION = '1.0.5';

Modules.LOADMODULE = function() {
	Modules.loadIf('compatibilityFix/Mac', DARWIN);
};

Modules.UNLOADMODULE = function() {
	Modules.unload('compatibilityFix/Mac');
};
