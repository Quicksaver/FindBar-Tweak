moduleAid.VERSION = '2.1.4';
moduleAid.LAZY = true;

// windowMediator - Aid object to help with window tasks involving window-mediator and window-watcher
// getEnumerator(aType) - returns an nsISimpleEnumerator object with all windows of aType
//	(optional) aType - (string) window type to get, defaults to null (all)
// callOnMostRecent(aCallback, aType, aURI) - calls aCallback passing it the most recent window of aType as an argument. If successful it returns the return value of aCallback.
//	aCallback - (function(window)) to be called on window
//	(optional) aType - type of windows to execute aCallback on, defaults to null (all)
//	(optional) aURI - (string) when defined, checks the documentURI property against the aURI value and only executes aCallback when true, defaults to null
// callOnAll(aCallback, aType, aURI, beforeComplete) - goes through every opened browser window of aType and executes aCallback on it
//	(optional) beforeComplete - true calls aCallback immediatelly regardless of readyState, false fires aCallback when window loads if readyState != complete, defaults to false.
//	see callOnMostRecent()
// register(aHandler, aTopic, aType, aURI, beforeComplete) - registers aHandler to be notified of every aTopic
//	aHandler - (function(aWindow)) handler to be fired. IMPORTANT: handler does not keep its original scope! Use as if in global sandbox scope, never use 'this' in it.
//	aTopic - (string) "domwindowopened" or (string) "domwindowclosed"
//	(optional) beforeComplete -	See callOnAll()
//					Note that regardless of this value, if you set aType, no callback will be performed before the window is loaded because the windowtype attribute
//					won't be loaded yet! In some cases even the URI might not be loaded either so there's no point in setting this at all.
//	see callOnMostRecent() and callOnAll()
// unregister(aHandler, aTopic, aType, aURI, beforeComplete) - unregisters aHandler from being notified of every aTopic
//	see register()
// watching(aHandler, aTopic, aType, aURI, beforeComplete) - 	returns (int) with corresponding watcher index in watchers[] if aHandler has been registered for aTopic
//								returns (bool) false otherwise
//	see register()
this.windowMediator = {
	watchers: [],
	
	getEnumerator: function(aType) {
		var type = aType || null;
		return Services.wm.getEnumerator(type);
	},
	
	callOnMostRecent: function(aCallback, aType, aURI) {
		var type = aType || null;
		if(aURI) {
			var browserEnumerator = this.getEnumerator(type);
			while(browserEnumerator.hasMoreElements()) {
				var window = browserEnumerator.getNext();
				if(window.document.documentURI == aURI && window.document.readyState == 'complete') {
					return aCallback(window);
				}
			}
			return null;
		}
		
		var window = Services.wm.getMostRecentWindow(type);
		if(window) {
			return aCallback(window);
		}
		return null;
	},
	
	// expects aCallback() and sets its this as the window
	callOnAll: function(aCallback, aType, aURI, beforeComplete) {
		var browserEnumerator = this.getEnumerator(aType);
		while(browserEnumerator.hasMoreElements()) {
			var window = browserEnumerator.getNext();
			if(!aURI || window.document.documentURI == aURI) {
				if(window.document.readyState == "complete" || beforeComplete) {
					aCallback(window);
				} else if(!UNLOADED) {
					callOnLoad(window, aCallback);
				}
			}
		}
	},
	
	register: function(aHandler, aTopic, aType, aURI, beforeComplete) {
		if(this.watching(aHandler, aTopic, aType, aURI, beforeComplete) === false) {
			this.watchers.push({ handler: aHandler, topic: aTopic, type: aType || null, uri: aURI || null, beforeComplete: beforeComplete || false });
		}
	},
	
	unregister: function(aHandler, aTopic, aType, aURI, beforeComplete) {
		var i = this.watching(aHandler, aTopic, aType, aURI, beforeComplete);
		if(i !== false) {
			this.watchers.splice(i, 1);
		}
	},
	
	callHandlers: function(aSubject, aTopic, noBefore) {
		var scheduleOnLoad = false;
		for(var i = 0; i < windowMediator.watchers.length; i++) {
			// windowtype is undefined until the window loads
			if(!noBefore && aSubject.document.readyState != 'complete' && windowMediator.watchers[i].type) {
				scheduleOnLoad = true;
			}
			
			if(windowMediator.watchers[i].topic == aTopic
			&& (!windowMediator.watchers[i].type || aSubject.document.documentElement.getAttribute('windowtype') == windowMediator.watchers[i].type)
			&& (!windowMediator.watchers[i].uri || aSubject.document.documentURI == windowMediator.watchers[i].uri)) {
				if(noBefore) {
					if(!windowMediator.watchers[i].beforeComplete) {
						windowMediator.watchers[i].handler(aSubject);
					}
					continue;
				}
				
				if(aSubject.document.readyState == 'complete' || windowMediator.watchers[i].beforeComplete) {
					windowMediator.watchers[i].handler(aSubject);
				}
			}
			
			if(scheduleOnLoad) {
				callOnLoad(aSubject, windowMediator.callLoadedHandlers, aTopic);
			}
		}
	},
	
	callWatchers: function(aSubject, aTopic) {
		windowMediator.callHandlers(aSubject, aTopic, false);
	},
	
	callLoadedHandlers: function(aSubject, aTopic) {
		windowMediator.callHandlers(aSubject, aTopic, true);
	},
	
	watching: function(aHandler, aTopic, aType, aURI, beforeComplete) {
		var type = aType || null;
		var uri = aURI || null;
		var before = beforeComplete || false;
		
		for(var i = 0; i < this.watchers.length; i++) {
			if(this.watchers[i].handler == aHandler
			&& this.watchers[i].topic == aTopic
			&& this.watchers[i].type == type
			&& this.watchers[i].uri == uri
			&& this.watchers[i].beforeComplete == before) {
				return i;
			}
		}
		return false;
	}
};

moduleAid.LOADMODULE = function() {
	Services.ww.registerNotification(windowMediator.callWatchers);
};

moduleAid.UNLOADMODULE = function() {
	Services.ww.unregisterNotification(windowMediator.callWatchers);
};
