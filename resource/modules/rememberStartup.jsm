Modules.VERSION = '2.0.1';

this.rememberStartup = {
	handleEvent: function(e) {
		switch(e.type) {
			case 'OpenedFindBar':
				if(gFindBar._findMode == gFindBar.FIND_NORMAL) {
					Prefs.findbarHidden = gFindBar.hidden;
				}
				break;
			
			case 'ClosedFindBar':
				Prefs.findbarHidden = gFindBar.hidden;
				break;
		}
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(window, 'OpenedFindBar', rememberStartup);
	Listeners.add(window, 'ClosedFindBar', rememberStartup);
	
	if(STARTED == APP_STARTUP && !Prefs.findbarHidden && gFindBar.hidden) {
		gFindBar.onFindCommand();
	}
	
	if(Prefs.findbarHidden && gFindBarInitialized && !gFindBar.hidden && gFindBar._findMode == gFindBar.FIND_NORMAL) {
		Prefs.findbarHidden = false;
	}
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, 'OpenedFindBar', rememberStartup);
	Listeners.remove(window, 'ClosedFindBar', rememberStartup);
	
	if((UNLOADED && UNLOADED != APP_SHUTDOWN) || !Prefs.onStartup) {
		Prefs.findbarHidden = true;
	}
};
