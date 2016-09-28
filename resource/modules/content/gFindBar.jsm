/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 2.1.0

this.__defineGetter__('findQuery', function() { return gFindBar.query; });

this.gFindBar = {
	open: false,
	query: '',

	MESSAGES: [
		'FindBar:State',
		'FindBar:Query'
	],

	receiveMessage: function(m) {
		let name = messageName(m);

		switch(name) {
			case 'FindBar:State':
				this.open = m.data;
				break;

			case 'FindBar:Query':
				this.query = m.data;
				break;
		}
	}
};

Modules.LOADMODULE = function() {
	if(!self.viewSource) {
		self.viewSource = false;
	}

	for(let msg of gFindBar.MESSAGES) {
		listen(msg, gFindBar);
	}
};

Modules.UNLOADMODULE = function() {
	for(let msg of gFindBar.MESSAGES) {
		unlisten(msg, gFindBar);
	}
};
