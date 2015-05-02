Modules.VERSION = '2.0.0';

this.findBarOpen = false;
this.findQuery = '';

this.gFindBar = {
	MESSAGES: [
		'FindBar:State',
		'FindBar:Query'
	],
	
	receiveMessage: function(m) {
		let name = messageName(m);
		
		switch(name) {
			case 'FindBar:State':
				findBarOpen = m.data;
				break;
			
			case 'FindBar:Query':
				findQuery = m.data;
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
