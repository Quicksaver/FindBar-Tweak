/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.0.0

this.modalHighlight = {
	_defaultValue: null,

	lock: function() {
		// This is only enabled by default in Nightly.
		let defaults = Services.prefs.getDefaultBranch('findbar.');
		this._defaultValue = defaults.getBoolPref('modalHighlight');

		// Ensure anything currently relying on this preference is disabled (flipping default values doesn't trigger pref change listeners).
		let pref = Services.prefs.getBoolPref('findbar.modalHighlight');
		if(pref) {
			Services.prefs.setBoolPref('findbar.modalHighlight', false);
		}

		// Now we lock the preference in a false state, so that it can't be switched while the add-on is enabled.
		// We will unlock it and reverse everything when disabling the add-on.
		defaults.setBoolPref('modalHighlight', false);
		defaults.lockPref('modalHighlight');
	},

	unlock: function() {
		let defaults = Services.prefs.getDefaultBranch('findbar.');
		defaults.unlockPref('modalHighlight');

		// Ensure everything is properly initialized with this pref if necessary (flipping default values doesn't trigger pref change listeners).
		let pref = Services.prefs.getBoolPref('findbar.modalHighlight');
		if(pref != this._defaultValue) {
			Services.prefs.setBoolPref('findbar.modalHighlight', this._defaultValue);
		}

		defaults.setBoolPref('modalHighlight', this._defaultValue);
	}
}

Modules.LOADMODULE = function() {
	// The add-on doesn't work with the new modal highlight mode. So we disable it while the add-on is disabled.
	modalHighlight.lock();
};

Modules.UNLOADMODULE = function() {
	modalHighlight.unlock();
};
