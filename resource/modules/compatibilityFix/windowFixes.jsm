moduleAid.VERSION = '1.1.3';

moduleAid.LOADMODULE = function() {
	if(!viewSource) {
		AddonManager.getAddonByID('autopager@mozilla.org', function(addon) {
			moduleAid.loadIf('compatibilityFix/autopager', (addon && addon.isActive));
		});
		moduleAid.load('compatibilityFix/lessChrome');
	}
	
	AddonManager.getAddonByID('clearfields@alex.alexander.googlepages.com', function(addon) {
		moduleAid.loadIf('compatibilityFix/ClearFields', (addon && addon.isActive));
	});
	
	AddonManager.getAddonByID('treestyletab@piro.sakura.ne.jp', function(addon) {
		moduleAid.loadIf('compatibilityFix/TreeStyleTab', (addon && addon.isActive));
	});
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('compatibilityFix/ClearFields');
	moduleAid.unload('compatibilityFix/TreeStyleTab');
	
	moduleAid.unload('compatibilityFix/autopager');
	moduleAid.unload('compatibilityFix/lessChrome');
};
