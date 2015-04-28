Modules.VERSION = '1.0.4';

this.rememberOnOpen = function() {
	if(gFindBar._findMode == gFindBar.FIND_NORMAL) {
		Prefs.findbarHidden = gFindBar.hidden;
	}
};

this.rememberOnClose = function() {
	Prefs.findbarHidden = gFindBar.hidden;
};

Modules.LOADMODULE = function() {
	Listeners.add(window, 'OpenedFindBar', rememberOnOpen);
	Listeners.add(window, 'ClosedFindBar', rememberOnClose);
	
	if(STARTED == APP_STARTUP && !Prefs.findbarHidden && gFindBar.hidden) {
		gFindBar.onFindCommand();
	}
	
	if(gFindBarInitialized && !gFindBar.hidden && gFindBar._findMode == gFindBar.FIND_NORMAL) {
		Prefs.findbarHidden = gFindBar.hidden;
	}
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, 'OpenedFindBar', rememberOnOpen);
	Listeners.remove(window, 'ClosedFindBar', rememberOnClose);
	
	if((UNLOADED && UNLOADED != APP_SHUTDOWN) || !Prefs.onStartup) {
		Prefs.findbarHidden = true;
	}
};
