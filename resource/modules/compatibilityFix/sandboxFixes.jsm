/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.0.10

this.gFx50 = Services.vc.compare(Services.appinfo.version, "50.0a1") >= 0;

Modules.LOADMODULE = function() {
	AddonManager.getAddonByID('{097d3191-e6fa-4728-9826-b533d755359d}', function(addon) {
		Modules.loadIf('compatibilityFix/AiOS', (addon && addon.isActive));
	});

	AddonManager.getAddonByID('{77d2ed30-4cd2-11e0-b8af-0800200c9a66}', function(addon) {
		Modules.loadIf('compatibilityFix/FTDeepDark', (addon && addon.isActive));
	});

	AddonManager.getAddonByID('{c0c588b6-b11d-4898-af00-079fed05aa32}', function(addon) {
		Modules.loadIf('compatibilityFix/FXChrome', (addon && addon.isActive));
	});

	Modules.loadIf('compatibilityFix/Mac', DARWIN);
	Modules.load('compatibilityFix/omnisidebar');
	Modules.loadIf('compatibilityFix/modalHighlight', gFx50);
};

Modules.UNLOADMODULE = function() {
	Modules.unload('compatibilityFix/AiOS');
	Modules.unload('compatibilityFix/FTDeepDark');
	Modules.unload('compatibilityFix/FXChrome');
	Modules.unload('compatibilityFix/Mac');
	Modules.unload('compatibilityFix/omnisidebar');
	Modules.unload('compatibilityFix/modalHighlight');
};
