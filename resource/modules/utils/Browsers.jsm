Modules.VERSION = '2.4.0';
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
//	aHandler - (function(aWindow)) handler to be fired. Or (nsiObserver object) with observe() method which will be passed aWindow and aTopic as its only two arguments.
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
				for(let aBrowser of aWindow.gBrowser.browsers) {
					// e10s fix, we don't check remote tabs
					if(aBrowser.isRemoteBrowser) { continue; }
					
					if(!aURI || aBrowser.contentDocument.documentURI == aURI) {
						callOnLoad(aBrowser.contentWindow, aCallback, beforeComplete);
					}
				}
				
				if(onlyTabs) { continue; }
				
				// Sidebars (compatible with OmniSidebar)
				let sidebar = aWindow.document.getElementById('sidebar');
				if(sidebar
				&& sidebar.docShell
				&& sidebar.contentWindow
				&& (!aURI || sidebar.contentDocument.documentURI == aURI)) {
					callOnLoad(sidebar.contentWindow, aCallback, beforeComplete);
				}
				
				let sidebarTwin = aWindow.document.getElementById('omnisidebar-sidebar-twin');
				if(sidebarTwin
				&& sidebarTwin.docShell
				&& sidebarTwin.contentWindow
				&& (!aURI || sidebarTwin.contentDocument.documentURI == aURI)) {
					callOnLoad(sidebarTwin.contentWindow, aCallback, beforeComplete);
				}
			}
		}
	},
	
	register: function(aHandler, aTopic, aURI, beforeComplete) {
		if(this.watching(aHandler, aTopic) === false) {
			this.watchers.push({
				handler: aHandler,
				topic: aTopic,
				uri: aURI || null,
				beforeComplete: beforeComplete || false
			});
		}
	},
	
	unregister: function(aHandler, aTopic, aURI, beforeComplete) {
		var i = this.watching(aHandler, aTopic, aURI, beforeComplete);
		if(i !== false) {
			this.watchers.splice(i, 1);
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
	
	observe: function(aWindow, aTopic) {
		switch(aTopic) {
			case 'domwindowopened':
				callOnLoad(aWindow, () => {
					if(aWindow.gBrowser) {
						for(let tab of aWindow.gBrowser.mTabs) {
							this.handleEvent({ type: 'TabOpen', target: tab });
						}
						// The event can be TabOpen, TabClose, TabSelect, TabShow, TabHide, TabPinned, TabUnpinned and possibly more.
						aWindow.gBrowser.tabContainer.addEventListener('TabOpen', this, true);
						aWindow.gBrowser.tabContainer.addEventListener('TabClose', this, true);
						// Also listen for the sidebars
						aWindow.addEventListener('SidebarFocused', this, true);
						aWindow.addEventListener('SidebarClosed', this, true);
					}
				});
				break;
				
			case 'domwindowclosed':
				if(aWindow.document.readyState == 'complete' && aWindow.gBrowser) {
					for(var tab of aWindow.gBrowser.mTabs) {
						tab.removeEventListener('TabRemotenessChange', this);
						if(!tab.linkedBrowser.isRemoteBrowser) {
							this.tabRemote(tab); // this removes the listeners, which is what we want to do
						}
					}
					aWindow.gBrowser.tabContainer.removeEventListener('TabOpen', this, true);
					aWindow.gBrowser.tabContainer.removeEventListener('TabClose', this, true);
					aWindow.removeEventListener('SidebarFocused', this, true);
					aWindow.removeEventListener('SidebarClosed', this, true);
				}
				break;
		}
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'TabOpen':
				e.target.addEventListener('TabRemotenessChange', this);
				// no break; let it run TabRemotenessChange
				
			case 'TabRemotenessChange':
				if(e.target.linkedBrowser.isRemoteBrowser) {
					this.tabRemote(e.target);
				} else {
					this.tabNonRemote(e.target);
				}
				break;
			
			case 'TabClose':
				e.target.removeEventListener('TabRemotenessChange', this);
				
				// e10s fix, we don't check remote tabs, we only check about: and chrome:// tabs
				if(e.target.linkedBrowser.isRemoteBrowser) { break; }
				
				this.tabRemote(e.target); // this removes the listeners, which is what we want to do
				this.callWatchers(e.target.linkedBrowser.contentDocument, 'pagehide');
				break;
			
			case 'SidebarFocused':
			case 'SidebarClosed':
				this.callWatchers(e.target.document, e.type);
				break;
				
			default:
				this.callWatchers(e.originalTarget, e.type);
				break;
		}
	},
	
	callWatchers: function(aDoc, aTopic) {
		if(aDoc.nodeName != '#document') { return; }
		
		var aSubject = aDoc.defaultView;
		for(let watcher of this.watchers) {
			if(watcher.topic == aTopic
			&& (!watcher.uri || aSubject.document.documentURI == watcher.uri)) {
				if(watcher.handler.observe) {
					callOnLoad(aSubject, () => {
						watcher.handler.observe(aSubject, aTopic);
					}, watcher.beforeComplete);
				} else {
					callOnLoad(aSubject, watcher.handler, watcher.beforeComplete);
				}
			}
		}
	},
	
	tabNonRemote: function(tab) {
		// The event can be DOMContentLoaded, pageshow, pagehide, load or unload. Don't use these in remote browsers as they use CPOWs to work there.
		// These seem to be enough
		tab.linkedBrowser.addEventListener('pageshow', this, true);
		tab.linkedBrowser.addEventListener('pagehide', this, true);
	},
	
	tabRemote: function(tab) {
		tab.linkedBrowser.removeEventListener('pageshow', this, true);
		tab.linkedBrowser.removeEventListener('pagehide', this, true);
	}
};

Modules.LOADMODULE = function() {
	Windows.callOnAll((aWindow) => {
		Browsers.observe(aWindow, 'domwindowopened');
	}, 'navigator:browser');
	
	Windows.register(Browsers, 'domwindowopened', 'navigator:browser');
	Windows.register(Browsers, 'domwindowclosed', 'navigator:browser');
};

Modules.UNLOADMODULE = function() {
	Windows.unregister(Browsers, 'domwindowopened', 'navigator:browser');
	Windows.unregister(Browsers, 'domwindowclosed', 'navigator:browser');
	
	Windows.callOnAll((aWindow) => {
		Browsers.observe(aWindow, 'domwindowclosed');
	}, 'navigator:browser', null, true);
};
