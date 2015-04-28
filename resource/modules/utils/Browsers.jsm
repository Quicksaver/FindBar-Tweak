Modules.VERSION = '2.3.1';
Modules.UTILS = true;

// Browsers - Aid object to track and perform tasks on all document browsers across the windows.
// callOnAll(aCallback, aURI, beforeComplete, onlyTabs) - goes through every opened browser (tabs and sidebar) and executes aCallback on it
//	Important note: this method will no-op in remote browsers (e10s, anything not about: or chrome://).
//	aCallback - (function(aBrowser)) to be called on aBrowser
//	(optional) aURI - (string) when defined, checks the documentURI property against the aURI value and only executes aCallback when true, defaults to null
//	(optional) beforeComplete - 	true calls aCallback immediatelly regardless of readyState, false fires aCallback when window loads if readyState != complete, defaults to false
//					see notes on Windows.register()
//	(optional) onlyTabs - (bool) true only executes aCallback on actual tabs, not sidebars or others, defaults to (bool) false
// register(aHandler, aTopic, aURI, beforeComplete) - registers aHandler to be notified of every aTopic
//	Important note: handlers will no-op in remote browsers (e10s).
//	aHandler - (function(aBrowser)) handler to be fired
//	aTopic - (string) "pageshow" or (string) "pagehide" or (string) "SidebarFocused"
//	see callOnAll()
// unregister(aHandler, aTopic, aURI, beforeComplete) - unregisters aHandler from being notified of every aTopic
//	see register()
// watching(aHandler, aTopic, aURI, beforeComplete) -	returns (int) with corresponding watcher index in watchers[] if aHandler has been registered for aTopic,
//							returns (bool) false otherwise
//	see register()
this.Browsers = {
	watchers: [],
	
	// expects aCallback() and sets its this as the window
	callOnAll: function(aCallback, aURI, beforeComplete, onlyTabs) {
		var browserEnumerator = Services.wm.getEnumerator('navigator:browser');
		while(browserEnumerator.hasMoreElements()) {
			var aWindow = browserEnumerator.getNext();
			if(aWindow.gBrowser) {
				// Browser panels (tabs)
				for(var b=0; b<aWindow.gBrowser.browsers.length; b++) {
					var aBrowser = aWindow.gBrowser.getBrowserAtIndex(b);
					
					// e10s fix, we don't check remote tabs
					if(aBrowser.isRemoteBrowser) { continue; }
					
					if(!aURI || aBrowser.contentDocument.documentURI == aURI) {
						if(aBrowser.contentDocument.readyState == "complete" || beforeComplete) {
							aCallback(aBrowser.contentWindow);
						} else if(!UNLOADED) {
							callOnLoad(aBrowser.contentWindow, aCallback);
						}
					}
				}
				
				if(onlyTabs) { continue; }
				
				// Sidebars (compatible with OmniSidebar)
				if(aWindow.document.getElementById('sidebar')
				&& aWindow.document.getElementById('sidebar').docShell
				&& aWindow.document.getElementById('sidebar').contentWindow
				&& (!aURI || aWindow.document.getElementById('sidebar').contentDocument.documentURI == aURI)) {
					if(aWindow.document.getElementById('sidebar').contentDocument.readyState == "complete" || beforeComplete) {
						aCallback(aWindow.document.getElementById('sidebar').contentWindow);
					} else if(!UNLOADED) {
						callOnLoad(aWindow.document.getElementById('sidebar').contentWindow, aCallback);
					}
				}
				
				if(aWindow.document.getElementById('omnisidebar-sidebar-twin')
				&& aWindow.document.getElementById('omnisidebar-sidebar-twin').docShell
				&& aWindow.document.getElementById('omnisidebar-sidebar-twin').contentWindow
				&& (!aURI || aWindow.document.getElementById('omnisidebar-sidebar-twin').contentDocument.documentURI == aURI)) {
					if(aWindow.document.getElementById('omnisidebar-sidebar-twin').contentDocument.readyState == "complete" || beforeComplete) {
						aCallback(aWindow.document.getElementById('omnisidebar-sidebar-twin').contentWindow);
					} else if(!UNLOADED) {
						callOnLoad(aWindow.document.getElementById('omnisidebar-sidebar-twin').contentWindow, aCallback);
					}
				}
			}
		}
	},
	
	register: function(aHandler, aTopic, aURI, beforeComplete) {
		if(this.watching(aHandler, aTopic) === false) {
			this.watchers.push({ handler: aHandler, topic: aTopic, uri: aURI || null, beforeComplete: beforeComplete || false });
		}
	},
	
	unregister: function(aHandler, aTopic, aURI, beforeComplete) {
		var i = this.watching(aHandler, aTopic, aURI, beforeComplete);
		if(i !== false) {
			this.watchers.splice(i, 1);
		}
	},
	
	callWatchers: function(e) {
		var aDoc = e.originalTarget;
		if(aDoc.nodeName != '#document') { return; }
		
		var aSubject = aDoc.defaultView;
		for(var i = 0; i < Browsers.watchers.length; i++) {
			if(Browsers.watchers[i].topic == e.type
			&& (!Browsers.watchers[i].uri || aSubject.document.documentURI == Browsers.watchers[i].uri)) {
				if(aSubject.document.readyState == 'complete' || Browsers.watchers[i].beforeComplete) {
					Browsers.watchers[i].handler(aSubject);
				} else {
					callOnLoad(aSubject, Browsers.watchers[i].handler);
				}
			}
		}
	},
	
	watching: function(aHandler, aTopic, aURI, beforeComplete) {
		var uri = aURI || null;
		var before = beforeComplete || false;
		
		for(var i = 0; i < this.watchers.length; i++) {
			if(this.watchers[i].handler == aHandler
			&& this.watchers[i].topic == aTopic
			&& this.watchers[i].uri == uri
			&& this.watchers[i].beforeComplete == before) {
				return i;
			}
		}
		return false;
	},
	
	tabNonRemote: function(tab) {
		// The event can be DOMContentLoaded, pageshow, pagehide, load or unload. Don't use these in remote browsers as they use CPOWs to work there.
		// These seem to be enough
		tab.linkedBrowser.addEventListener('pageshow', Browsers.callWatchers, true);
		tab.linkedBrowser.addEventListener('pagehide', Browsers.callWatchers, true);
	},
	
	tabRemote: function(tab) {
		tab.linkedBrowser.removeEventListener('pageshow', Browsers.callWatchers, true);
		tab.linkedBrowser.removeEventListener('pagehide', Browsers.callWatchers, true);
	},
	
	tabRemotenessChanged: function(e) {
		if(e.target.linkedBrowser.isRemoteBrowser) {
			Browsers.tabRemote(e.target);
		} else {
			Browsers.tabNonRemote(e.target);
		}
	},
	
	tabOpened: function(e) {
		e.target.addEventListener('TabRemotenessChange', Browsers.tabRemotenessChanged);
		Browsers.tabRemotenessChanged(e);
	},
	
	// pagehide and unload by themselves don't catch everything, this completes it
	tabClosed: function(e) {
		e.target.removeEventListener('TabRemotenessChange', Browsers.tabRemotenessChanged);
		
		// e10s fix, we don't check remote tabs, we only check about: and chrome:// tabs
		if(e.target.linkedBrowser.isRemoteBrowser) { return; }
		
		Browsers.tabRemote(e.target); // this removes the listeners, which is what we want to do
		Browsers.callWatchers({
			type: 'pagehide',
			originalTarget: e.target.linkedBrowser.contentDocument
		});
	},
	
	sidebarLoaded: function(e) {
		Browsers.callWatchers({
			type: e.type,
			originalTarget: e.target.document
		});
	},
	
	prepareWindow: function(aWindow) {
		if(aWindow.document.readyState != 'complete') {
			callOnLoad(aWindow, function() { Browsers.prepareWindow(aWindow); });
			return;
		}
		
		if(aWindow.gBrowser) {
			for(var tab of aWindow.gBrowser.mTabs) {
				Browsers.tabOpened({ target: tab });
			}
			// The event can be TabOpen, TabClose, TabSelect, TabShow, TabHide, TabPinned, TabUnpinned and possibly more.
			aWindow.gBrowser.tabContainer.addEventListener('TabOpen', Browsers.tabOpened, true);
			aWindow.gBrowser.tabContainer.addEventListener('TabClose', Browsers.tabClosed, true);
			// Also listen for the sidebars
			aWindow.addEventListener('SidebarFocused', Browsers.sidebarLoaded, true);
			aWindow.addEventListener('SidebarClosed', Browsers.sidebarLoaded, true);
		}
	},
	
	forgetWindow: function(aWindow) {
		if(aWindow.document.readyState == 'complete' && aWindow.gBrowser) {
			for(var tab of aWindow.gBrowser.mTabs) {
				tab.removeEventListener('TabRemotenessChange', Browsers.tabRemotenessChanged);
				if(!tab.linkedBrowser.isRemoteBrowser) {
					Browsers.tabRemote(tab); // this removes the listeners, which is what we want to do
				}
			}
			aWindow.gBrowser.tabContainer.removeEventListener('TabOpen', Browsers.tabOpened, true);
			aWindow.gBrowser.tabContainer.removeEventListener('TabClose', Browsers.tabClosed, true);
			aWindow.removeEventListener('SidebarFocused', Browsers.sidebarLoaded, true);
			aWindow.removeEventListener('SidebarClosed', Browsers.sidebarLoaded, true);
		}
	}
};

Modules.LOADMODULE = function() {
	Windows.callOnAll(Browsers.prepareWindow, 'navigator:browser');
	Windows.register(Browsers.prepareWindow, 'domwindowopened', 'navigator:browser');
	Windows.register(Browsers.forgetWindow, 'domwindowclosed', 'navigator:browser');
};

Modules.UNLOADMODULE = function() {
	Windows.unregister(Browsers.prepareWindow, 'domwindowopened', 'navigator:browser');
	Windows.unregister(Browsers.forgetWindow, 'domwindowclosed', 'navigator:browser');
	Windows.callOnAll(Browsers.forgetWindow, 'navigator:browser', null, true);
};
