moduleAid.VERSION = '1.0.0';

moduleAid.LOADMODULE = function() {
	AddonManager.getAddonByID('autopager@mozilla.org', function(addon) {
		moduleAid.loadIf('compatibilityFix/autopager', (addon && addon.isActive));
	});
	AddonManager.getAddonByID('clearfields@alex.alexander.googlepages.com', function(addon) {
		moduleAid.loadIf('compatibilityFix/ClearFields', (addon && addon.isActive));
	});
	moduleAid.load('compatibilityFix/lessChrome');
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('compatibilityFix/autopager');
	moduleAid.unload('compatibilityFix/ClearFields');
	moduleAid.unload('compatibilityFix/lessChrome');
};
