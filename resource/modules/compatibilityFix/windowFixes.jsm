moduleAid.VERSION = '1.1.7';

moduleAid.LOADMODULE = function() {
	if(!viewSource && !FITFull) {
		AddonManager.getAddonByID('autopager@mozilla.org', function(addon) {
			moduleAid.loadIf('compatibilityFix/autopager', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID('treestyletab@piro.sakura.ne.jp', function(addon) {
			moduleAid.loadIf('compatibilityFix/TreeStyleTab', (addon && addon.isActive));
		});
		
		moduleAid.load('compatibilityFix/lessChrome');
	}
	
	AddonManager.getAddonByID('clearfields@alex.alexander.googlepages.com', function(addon) {
		moduleAid.loadIf('compatibilityFix/ClearFields', (addon && addon.isActive));
	});
	
	AddonManager.getAddonByID('findlist@fewlinx.com', function(addon) {
		moduleAid.loadIf('compatibilityFix/findlist', (addon && addon.isActive));
	});
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('compatibilityFix/findlist');
	moduleAid.unload('compatibilityFix/ClearFields');
	
	moduleAid.unload('compatibilityFix/lessChrome');
	moduleAid.unload('compatibilityFix/TreeStyleTab');
	moduleAid.unload('compatibilityFix/autopager');
};
