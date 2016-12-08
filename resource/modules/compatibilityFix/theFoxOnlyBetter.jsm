/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.0.0

this.tFOB = {
	id: 'thefoxonlybetter@quicksaver',

	enabled: false,
	listeners: new Set(),

	add: function(aListener) {
		this.listeners.add(aListener);
	},

	remove: function(aListener) {
		this.listeners.delete(aListener);
	},

	onEnabled: function(addon) {
		if(addon.id == this.id) { this.enable(); }
	},

	onDisabled: function(addon) {
		if(addon.id == this.id) { this.disable(); }
	},

	listen: function() {
		AddonManager.addAddonListener(this);
		AddonManager.getAddonByID(this.id, (addon) => {
			if(addon && addon.isActive) { this.enable(); }
		});
	},

	unlisten: function() {
		AddonManager.removeAddonListener(this);
		this.disable();
	},

	enable: function() {
		this.enabled = true;

		Listeners.add(window, 'LoadedSlimChrome', this);
		Listeners.add(window, 'UnloadedSlimChrome', this);
		Listeners.add(window, 'MovedSlimChrome', this);
	},

	disable: function() {
		this.enabled = false;

		Timers.cancel('tFOB_persona');
		Listeners.remove(window, 'LoadedSlimChrome', this);
		Listeners.remove(window, 'UnloadedSlimChrome', this);
		Listeners.remove(window, 'MovedSlimChrome', this);
	},

	handleEvent: function(e) {
		Timers.init('tFOB_persona', function() {
			if(Prefs.movetoTop && self.moveToTop && gFindBarInitialized && !gFindBar.hidden) {
				moveToTop.placePersona();
			}
		}, 0);
	}
};

Modules.LOADMODULE = function() {
	tFOB.listen();
};

Modules.UNLOADMODULE = function() {
	tFOB.unlisten();
};
