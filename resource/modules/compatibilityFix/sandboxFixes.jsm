Modules.VERSION = '1.0.6';

Modules.LOADMODULE = function() {
	AddonManager.getAddonByID('{097d3191-e6fa-4728-9826-b533d755359d}', function(addon) {
		Modules.loadIf('compatibilityFix/AiOS', (addon && addon.isActive));
	});
	
	Modules.loadIf('compatibilityFix/Mac', DARWIN);
};

Modules.UNLOADMODULE = function() {
	Modules.unload('compatibilityFix/AiOS');
	Modules.unload('compatibilityFix/Mac');
};
