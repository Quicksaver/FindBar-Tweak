moduleAid.VERSION = '2.1.0';
moduleAid.LAZY = true;

// privateBrowsingAid - Private browsing mode listener as on https://developer.mozilla.org/En/Supporting_private_browsing_mode, with a few modifications
// get autoStarted - returns (bool) pb autoStarted
// get inPrivateBrowing - returns (bool) privateBrowsingEnabled
// addWatcher(aWatcher) - prepares aWatcher to be used as a pb listener and registers it
//	aWatcher - (object) to register as a pb observer,
//		expects methods (all optional):
//			init: called when object is applied as a private browsing mode watcher
//			autoStarted: called when private browsing is enabled when both the add-on and private browsing were started with the application
//			addonEnabled: called when private browsing is enabled when the add-on wasn't started with the application
//			addonDisabled: called when private browsing is enabled when the add-on is disabled without quitting the application 
//			onEnter: called when turning on private browsing
//			onExit: called when turning off private browing
//			onQuit: called when application is shutdown
//		if it doesn't have an observe method it is created
// removeWatcher(aWatcher) - removes aWatcher from listening to pb notifications
//	see addWatcher()
this.privateBrowsingAid = {
	get autoStarted () { return Services.privateBrowsing.autoStarted; },
	get inPrivateBrowsing () { return Services.privateBrowsing.privateBrowsingEnabled; },
	
	prepare: function(aWatcher) {
		var watcherObj = aWatcher;
		if(!watcherObj.observe) {
			watcherObj.observe = function(aSubject, aTopic, aData) {
				try {
					if(aTopic == "private-browsing") {
						if(aData == "enter" && this.onEnter) {
							this.onEnter();
						} else if(aData == "exit" && this.onExit) {
							this.onExit();
						}
					} else if(aTopic == "quit-application" && this.onQuit) {
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
		
		observerAid.add(watcher, "private-browsing");
		observerAid.add(watcher, "quit-application");
		
		if(watcher.init) {
			try { watcher.init(); }
			catch(ex) { aSync(function() { Cu.reportError(ex); }); }
		}
		
		if(this.inPrivateBrowsing) {
			if(watcher.autoStarted && this.autoStarted && STARTED == APP_STARTUP) {
				try { watcher.autoStarted(); }
				catch(ex) { aSync(function() { Cu.reportError(ex); }); }
			}
			else if(watcher.addonEnabled && STARTED != APP_STARTUP) {
				try { watcher.addonEnabled(); }
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
		
		observerAid.remove(watcher, "private-browsing");
		observerAid.remove(watcher, "quit-application");
	}
};
