moduleAid.VERSION = '1.1.9';

moduleAid.LOADMODULE = function() {
	if(!viewSource && !FITFull) {
		AddonManager.getAddonByID('autopager@mozilla.org', function(addon) {
			moduleAid.loadIf('compatibilityFix/autopager', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID('treestyletab@piro.sakura.ne.jp', function(addon) {
			moduleAid.loadIf('compatibilityFix/TreeStyleTab', (addon && addon.isActive));
		});
	
		AddonManager.getAddonByID('{73a6fe31-595d-460b-a920-fcc0f8843232}', function(addon) {
			moduleAid.loadIf('compatibilityFix/noScript', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID('{64161300-e22b-11db-8314-0800200c9a66}', function(addon) {
			moduleAid.loadIf('compatibilityFix/SpeedDial', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID('custombuttons@xsms.org', function(addon) {
			moduleAid.loadIf('compatibilityFix/customButtons', (addon && addon.isActive));
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
	moduleAid.unload('compatibilityFix/customButtons');
	moduleAid.unload('compatibilityFix/SpeedDial');
	moduleAid.unload('compatibilityFix/noScript');
	moduleAid.unload('compatibilityFix/TreeStyleTab');
	moduleAid.unload('compatibilityFix/autopager');
};
