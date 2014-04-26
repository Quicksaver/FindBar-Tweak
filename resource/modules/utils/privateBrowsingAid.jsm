moduleAid.VERSION = '3.0.0';
moduleAid.LAZY = true;

// privateBrowsingAid - Aid object for private browsing mode
// get autoStarted - returns (bool) pb permanentPrivateBrowsing
// get inPrivateBrowing - returns (bool) isWindowPrivate(window) for this window
// addWatcher(aWatcher) - 	prepares aWatcher to be used as a PB handler
//	aWatcher - (object) to register as a pb observer,
//		expects methods (all optional):
//			init: called when object is applied as a private browsing mode watcher
//			autoStarted: called when private browsing is enabled when the add-on was started with the application
//			addonEnabled: called when private browsing is enabled when the add-on wasn't started with the application
//			addonDisabled: called when private browsing is enabled when the add-on is disabled without quitting the application
//			onQuit: called when application is shutdown
//		if it doesn't have an observe method it is created
// removeWatcher(aWatcher) - removes aWatcher from handling PB sessions
//	see addWatcher()
this.privateBrowsingAid = {
	get autoStarted () { return PrivateBrowsingUtils.permanentPrivateBrowsing; },
	get inPrivateBrowsing () { return PrivateBrowsingUtils.isWindowPrivate(window); },
	
	prepare: function(aWatcher) {
		var watcherObj = aWatcher;
		if(!watcherObj.observe) {
			watcherObj.observe = function(aSubject, aTopic, aData) {
				try {
					if(aTopic == "quit-application" && this.onQuit) {
						this.onQuit();
					}
				}
				// write errors in the console only after it has been cleared
				catch(ex) { aSync(function() { Cu.reportError(ex); }); }
			};
		}
		if(!watcherObj.init) { watcherObj.init = null; }
		if(!watcherObj.autoStarted) { watcherObj.autoStarted = null; }
		if(!watcherObj.addonEnabled) { watcherObj.addonEnabled = null; }
		if(!watcherObj.addonDisabled) { watcherObj.addonDisabled = null; }
		if(!watcherObj.onEnter) { watcherObj.onEnter = null; }
		if(!watcherObj.onExit) { watcherObj.onExit = null; }
		if(!watcherObj.onQuit) { watcherObj.onQuit = null; }
		return watcherObj;
	},
	
	addWatcher: function(aWatcher) {
		var watcher = this.prepare(aWatcher);
		
		observerAid.add(watcher, "quit-application");
		
		if(watcher.init) {
			try { watcher.init(); }
			catch(ex) { aSync(function() { Cu.reportError(ex); }); }
		}
		
		if(this.inPrivateBrowsing) {
			if(watcher.addonEnabled && STARTED != APP_STARTUP) {
				try { watcher.addonEnabled(); }
				catch(ex) { aSync(function() { Cu.reportError(ex); }); }
			} else if(watcher.autoStarted) {
				try { watcher.autoStarted(); }
				catch(ex) { aSync(function() { Cu.reportError(ex); }); }
			}
		}
	},
	
	removeWatcher: function(aWatcher) {
		var watcher = this.prepare(aWatcher);
		
		if(watcher.addonDisabled && this.inPrivateBrowsing && UNLOADED && UNLOADED != APP_SHUTDOWN) {
			try { watcher.addonDisabled(); }
			catch(ex) { aSync(function() { Cu.reportError(ex); }); }
		}
		
		observerAid.remove(watcher, "quit-application");
	}
};
