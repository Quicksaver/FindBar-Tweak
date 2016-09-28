/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.0.3

this.overrideFindlistWidth = function() {
	Prefs.fieldWidth = Prefs.findFieldWidth;
	findbar.init('findlistFix',
		function(bar) {
			bar.getElement('findbar-textbox').style.width = Prefs.fieldWidth+'px';
		},
		function(bar) {
			if(bar._destroying) { return; }

			bar.getElement('findbar-textbox').style.width = '';
		},
		true
	);
};

Modules.LOADMODULE = function() {
	Prefs.setDefaults({ fieldWidth: 150 }, 'findlist');

	Prefs.listen('findFieldWidth', overrideFindlistWidth);
	overrideFindlistWidth();
};

Modules.UNLOADMODULE = function() {
	Prefs.unlisten('findFieldWidth', overrideFindlistWidth);

	findbar.deinit('findlistFix');
};
