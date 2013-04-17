moduleAid.VERSION = '1.1.2';

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
	
	if(Services.navigator.oscpu == 'Windows NT 5.1') {
		moduleAid.load('compatibilityFix/winxp');
	}
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('compatibilityFix/ClearFields');
	moduleAid.unload('compatibilityFix/TreeStyleTab');
	moduleAid.unload('compatibilityFix/winxp');
	
	moduleAid.unload('compatibilityFix/autopager');
	moduleAid.unload('compatibilityFix/lessChrome');
};
