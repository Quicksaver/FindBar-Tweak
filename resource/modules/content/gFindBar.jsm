Modules.VERSION = '1.0.0';

this.getComputedStyle = function(el) { return content.getComputedStyle(el); };

// keep the find bar state here, so we know in-content if it is open or not
this.findBarOpen = false;
this.findBarStateListener = function(m) {
	findBarOpen = m.data;
};

this.findQuery = '';
this.findBarQuery = function(m) {
	findQuery = m.data;
};

Modules.LOADMODULE = function() {
	if(!self.viewSource) {
		self.viewSource = false;
	}
	
	listen('FindBar:State', findBarStateListener);
	listen('FindBar:Query', findBarQuery);
};

Modules.UNLOADMODULE = function() {
	unlisten('FindBar:State', findBarStateListener);
	unlisten('FindBar:Query', findBarQuery);
};
