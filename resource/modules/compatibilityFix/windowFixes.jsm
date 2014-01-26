moduleAid.VERSION = '1.1.13';

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
		
		AddonManager.getAddonByID('{c07d1a49-9894-49ff-a594-38960ede8fb9}', function(addon) {
			moduleAid.loadIf('compatibilityFix/UpdateScanner', (addon && addon.isActive));
		});
		
		moduleAid.load('compatibilityFix/lessChrome');
	}
	
	moduleAid.loadIf('compatibilityFix/FF28', (Services.vc.compare(Services.appinfo.platformVersion, "28.0a1") >= 0));
	
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
	
	moduleAid.unload('compatibilityFix/FF28');
	
	moduleAid.unload('compatibilityFix/lessChrome');
	moduleAid.unload('compatibilityFix/UpdateScanner');
	moduleAid.unload('compatibilityFix/noScript');
	moduleAid.unload('compatibilityFix/TreeStyleTab');
	moduleAid.unload('compatibilityFix/autopager');
};
