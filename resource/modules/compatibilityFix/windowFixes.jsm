Modules.VERSION = '1.1.18';

Modules.LOADMODULE = function() {
	if(!viewSource && !FITFull) {
		AddonManager.getAddonByID('autopager@mozilla.org', function(addon) {
			Modules.loadIf('compatibilityFix/autopager', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID('treestyletab@piro.sakura.ne.jp', function(addon) {
			Modules.loadIf('compatibilityFix/TreeStyleTab', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID('{73a6fe31-595d-460b-a920-fcc0f8843232}', function(addon) {
			Modules.loadIf('compatibilityFix/noScript', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID('{c07d1a49-9894-49ff-a594-38960ede8fb9}', function(addon) {
			Modules.loadIf('compatibilityFix/UpdateScanner', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID("s3download@statusbar", function(addon) {
			Modules.loadIf('compatibilityFix/S3', (addon && addon.isActive));
		});
		
		AddonManager.getAddonByID("unloadtab@firefox.ext", function(addon) {
			Modules.loadIf('compatibilityFix/UnloadTab', (addon && addon.isActive));
		});
		
		Modules.load('compatibilityFix/InstantFox');
	}
	
	AddonManager.getAddonByID('clearfields@alex.alexander.googlepages.com', function(addon) {
		Modules.loadIf('compatibilityFix/ClearFields', (addon && addon.isActive));
	});
	
	AddonManager.getAddonByID('findlist@fewlinx.com', function(addon) {
		Modules.loadIf('compatibilityFix/findlist', (addon && addon.isActive));
	});
};

Modules.UNLOADMODULE = function() {
	Modules.unload('compatibilityFix/findlist');
	Modules.unload('compatibilityFix/ClearFields');
	
	Modules.unload('compatibilityFix/UnloadTab');
	Modules.unload('compatibilityFix/S3');
	Modules.unload('compatibilityFix/UpdateScanner');
	Modules.unload('compatibilityFix/noScript');
	Modules.unload('compatibilityFix/TreeStyleTab');
	Modules.unload('compatibilityFix/autopager');
	Modules.unload('compatibilityFix/InstantFox');
};
