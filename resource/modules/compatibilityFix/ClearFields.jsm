/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 2.0.0

this.clearFields = {
	handleEvent: function(e) {
		switch(e.type) {
			case 'OpenedFindBar':
				this.setup();
				break;

			case 'click':
				gFindBar._find();
				break;
		}
	},

	setup: function() {
		// ClearFields doesn't distinguish types of clicks (left, middle, right) so I can't either
		Listeners.add($('ClearFields-in-find'), 'click', this);
	}
};

Modules.LOADMODULE = function() {
	clearFields.setup();

	// This is put here because the clear field button isn't added at startup
	Listeners.add(window, 'OpenedFindBar', clearFields);
};

Modules.UNLOADMODULE = function() {
	Listeners.remove($('ClearFields-in-find'), 'click', clearFields);
	Listeners.remove(window, 'OpenedFindBar', clearFields);
};
