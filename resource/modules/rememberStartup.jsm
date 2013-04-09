moduleAid.VERSION = '1.0.0';

this.rememberOnOpen = function() {
	if(gFindBar._findMode == gFindBar.FIND_NORMAL) {
		prefAid.findbarHidden = gFindBar.hidden;
	}
};

this.rememberOnClose = function() {
	prefAid.findbarHidden = gFindBar.hidden;
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(gFindBar, 'OpenedFindBar', rememberOnOpen);
	listenerAid.add(gFindBar, 'ClosedFindBar', rememberOnClose);
	
	if(!prefAid.findbarHidden) {
		gFindBar.open();
	}
	
	if(!gFindBar.hidden && gFindBar._findMode == gFindBar.FIND_NORMAL) {
		prefAid.findbarHidden = gFindBar.hidden;
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'OpenedFindBar', rememberOnOpen);
	listenerAid.remove(gFindBar, 'ClosedFindBar', rememberOnClose);
	
	if(UNLOADED && UNLOADED != APP_SHUTDOWN) {
		prefAid.findbarHidden = true;
	}
};
