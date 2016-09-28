/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.0.1

Modules.LOADMODULE = function() {
	Piggyback.add('autoUnloadTab', gBrowser.autoUnloadTab, 'unloadTab', function(aTab) {
		findbar.destroy(aTab);
		return true;
	}, Piggyback.MODE_BEFORE);
};

Modules.UNLOADMODULE = function() {
	Piggyback.revert('autoUnloadTab', gBrowser.autoUnloadTab, 'unloadTab');
};
