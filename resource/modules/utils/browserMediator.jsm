moduleAid.VERSION = '2.0.4';
moduleAid.LAZY = true;

// browserMediator - Aid object to track and perform tasks on all document browsers across the windows
// callOnAll(aCallback, aURI, beforeComplete, onlyTabs) - goes through every opened browser (tabs and sidebar) and executes aCallback on it
//	aCallback - (function(aBrowser)) to be called on aBrowser
//	(optional) aURI - (string) when defined, checks the documentURI property against the aURI value and only executes aCallback when true, defaults to null
//	(optional) beforeComplete - 	true calls aCallback immediatelly regardless of readyState, false fires aCallback when window loads if readyState != complete, defaults to false
//					see notes on windowMediator.register()
//	(optional) onlyTabs - (bool) true only executes aCallback on actual tabs, not sidebars or others, defaults to (bool) false
// register(aHandler, aTopic, aURI, beforeComplete) - registers aHandler to be notified of every aTopic
//	aHandler - (function(aBrowser)) handler to be fired
//	aTopic - (string) "pageshow" or (string) "pagehide" or (string) "SidebarFocused"
//	see callOnAll()
// unregister(aHandler, aTopic, aURI, beforeComplete) - unregisters aHandler from being notified of every aTopic
//	see register()
// watching(aHandler, aTopic, aURI, beforeComplete) - returns (int) with corresponding watcher index in watchers[] if aHandler has been registered for aTopic, returns (bool) false otherwise
//	see register()
this.browserMediator = {
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
					if(!aURI || aBrowser.contentDocument.documentURI == aURI) {
						if(aBrowser.contentDocument.readyState == "complete" || beforeComplete) {
							aCallback(aBrowser.contentWindow);
						} else if(!UNLOADED) {
							callOnLoad(aBrowser.contentWindow, aCallback);
						}
					}
				}
				
				if(onlyTabs) { continue; }
				
				// Customize panel in OS X
				if(aWindow.document.getElementById('customizeToolbarSheetIFrame')
				&& aWindow.document.getElementById('customizeToolbarSheetIFrame').contentWindow
				&& (!aURI || aWindow.document.getElementById('customizeToolbarSheetIFrame').contentDocument.documentURI == aURI)) {
					if(aWindow.document.getElementById('customizeToolbarSheetIFrame').contentDocument.readyState == "complete" || beforeComplete) {
						aCallback(aWindow.document.getElementById('customizeToolbarSheetIFrame').contentWindow);
					} else if(!UNLOADED) {
						callOnLoad(aWindow.document.getElementById('customizeToolbarSheetIFrame').contentWindow, aCallback);
					}
				}
				
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
		for(var i = 0; i < browserMediator.watchers.length; i++) {
			if(browserMediator.watchers[i].topic == e.type
			&& (!browserMediator.watchers[i].uri || aSubject.document.documentURI == browserMediator.watchers[i].uri)) {
				if(aSubject.document.readyState == 'complete' || browserMediator.watchers[i].beforeComplete) {
					browserMediator.watchers[i].handler(aSubject);
				} else {
					callOnLoad(aSubject, browserMediator.watchers[i].handler);
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
	
	// pagehide and unload by themselves don't catch everything, this completes it
	tabClosed: function(e) {
		browserMediator.callWatchers({
			type: 'pagehide',
			originalTarget: e.target.linkedBrowser.contentDocument
		});
	},
	
	sidebarLoaded: function(e) {
		browserMediator.callWatchers({
			type: e.type,
			originalTarget: e.target.document
		});
	},
	
	iframeLoaded: function(e) {
		browserMediator.callWatchers({
			type: (e.type == 'load') ? 'pageshow' : 'pagehide',
			originalTarget: e.originalTarget
		});
	},
	
	prepareWindow: function(aWindow) {
		if(aWindow.document.readyState != 'complete') {
			callOnLoad(aWindow, function() { browserMediator.prepareWindow(aWindow); });
			return;
		}
		
		if(aWindow.gBrowser) {
			// The event can be DOMContentLoaded, pageshow, pagehide, load or unload.
			// These seem to be enough
			aWindow.gBrowser.addEventListener('pageshow', browserMediator.callWatchers, true);
			aWindow.gBrowser.addEventListener('pagehide', browserMediator.callWatchers, true);
			// The event can be TabOpen, TabClose, TabSelect, TabShow, TabHide, TabPinned, TabUnpinned and possibly more.
			aWindow.gBrowser.tabContainer.addEventListener('TabClose', browserMediator.tabClosed, true);
			// Also listen for the sidebars
			aWindow.addEventListener('SidebarFocused', browserMediator.sidebarLoaded, true);
			aWindow.addEventListener('SidebarClosed', browserMediator.sidebarLoaded, true);
			// Customize Toolbar Screen is a popup panel in OSX
			aWindow.document.getElementById('customizeToolbarSheetPopup').addEventListener('load', browserMediator.iframeLoaded, true);
			//aWindow.document.getElementById('customizeToolbarSheetPopup').addEventListener('unload', browserMediator.iframeLoaded, true);
		}
	},
	
	forgetWindow: function(aWindow) {
		if(aWindow.document.readyState == 'complete' && aWindow.gBrowser) {
			aWindow.gBrowser.removeEventListener('pageshow', browserMediator.callWatchers, true);
			aWindow.gBrowser.removeEventListener('pagehide', browserMediator.callWatchers, true);
			aWindow.gBrowser.tabContainer.removeEventListener('TabClose', browserMediator.tabClosed, true);
			aWindow.removeEventListener('SidebarFocused', browserMediator.sidebarLoaded, true);
			aWindow.removeEventListener('SidebarClosed', browserMediator.sidebarLoaded, true);
			aWindow.document.getElementById('customizeToolbarSheetPopup').removeEventListener('load', browserMediator.iframeLoaded, true);
			//aWindow.document.getElementById('customizeToolbarSheetPopup').removeEventListener('unload', browserMediator.iframeLoaded, true);
		}
	}
};

moduleAid.LOADMODULE = function() {
	windowMediator.callOnAll(browserMediator.prepareWindow, 'navigator:browser');
	windowMediator.register(browserMediator.prepareWindow, 'domwindowopened', 'navigator:browser');
	windowMediator.register(browserMediator.forgetWindow, 'domwindowclosed', 'navigator:browser');
};

moduleAid.UNLOADMODULE = function() {
	windowMediator.unregister(browserMediator.prepareWindow, 'domwindowopened', 'navigator:browser');
	windowMediator.unregister(browserMediator.forgetWindow, 'domwindowclosed', 'navigator:browser');
	windowMediator.callOnAll(browserMediator.forgetWindow, 'navigator:browser', null, true);
};
