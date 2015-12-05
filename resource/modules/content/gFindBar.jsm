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
