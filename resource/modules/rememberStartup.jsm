moduleAid.VERSION = '1.0.3';

this.rememberOnOpen = function() {
	if(gFindBar._findMode == gFindBar.FIND_NORMAL) {
		prefAid.findbarHidden = gFindBar.hidden;
	}
};

this.rememberOnClose = function() {
	prefAid.findbarHidden = gFindBar.hidden;
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, 'OpenedFindBar', rememberOnOpen);
	listenerAid.add(window, 'ClosedFindBar', rememberOnClose);
	
	if(STARTED == APP_STARTUP && !prefAid.findbarHidden && gFindBar.hidden) {
		gFindBar.onFindCommand();
	}
	
	if(gFindBarInitialized && !gFindBar.hidden && gFindBar._findMode == gFindBar.FIND_NORMAL) {
		prefAid.findbarHidden = gFindBar.hidden;
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, 'OpenedFindBar', rememberOnOpen);
	listenerAid.remove(window, 'ClosedFindBar', rememberOnClose);
	
	if((UNLOADED && UNLOADED != APP_SHUTDOWN) || !prefAid.onStartup) {
		prefAid.findbarHidden = true;
	}
};
