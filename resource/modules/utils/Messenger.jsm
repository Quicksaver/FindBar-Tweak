Modules.VERSION = '1.4.0';
Modules.UTILS = true;

// Messenger - 	Aid object to communicate with browser content scripts (e10s).
//		Important: this loads the defaults.js file into every browser window, so make sure that everything in it is wrapped in their own methods,
//		or that at least it won't fail when loaded like this.
// messageBrowser(aBrowser, aMessage, aData, aCPOW) - sends a message to content scripts of a browser
//	aBrowser - (xul element) the browser element to send the message to
//	aMessage - (string) message to send, will be sent as objName-aMessage
//	aData - (string) data to be passed along with the message; can be a JSON-serializable object
//	aCPOW - (object) an object, typically a xul element, that will be proxied to the content script
// messageWindow(aWindow, aMessage, aData, aCPOW) - sends a message to content scripts of all browsers in the provided window
//	aWindow - (obj) window of which all browsers should receive this message
//	see messageBrowser()
// messageAll(aMessage, aData, aCPOW) - sends a message to content scripts of all browsers in all windows
//	see messageBrowser()
// listenBrowser(aBrowser, aMessage, aListener) - registers a listener for messages sent from content scripts through this backbone's methods
//	aBrowser - (xul element) the browser element from which to listen to messages
//	aMessage - (string) message to listen for
//	aListener - (function) the listener that will respond to the message. Expects (message) as its only argument; see https://developer.mozilla.org/en-US/docs/The_message_manager
// unlistenBrowser(aBrowser, aMessage, aListener) - unregisters a listener for messages sent from content scripts
//	see listenBrowser()
// listenWindow(aWindow, aMessage, aListener) - registers a listener for messages sent from all browsers in the provided window
//	aWindow - (obj) window of which all browsers should be listened to
//	see listenBrowser()
// unlistenWindow(aWindow, aMessage, aListener) - unregisters a listener for messages sent from all browsers in the provided window
//	see listenWindow()
// listenAll(aMessage, aListener) - registers a listener for messages sent from all browsers open in all windows
//	see listenBrowser()
// unlistenAll(aMessage, aListener) - unregisters a listener for messages sent from all browsers open in all windows
//	see listenBrowser()
// loadInBrowser(aBrowser, aModule) - loads a module into the content script of the specified browser
//	aBrowser - (xul element) the browser element corresponding to the content script into which to load the module
//	aModule - (string) name of the module to load
// unloadFromBrowser(aBrowser, aModule) - unloads a module from a content script [undoes loadInBrowser()]
//	see loadInBrowser()
// loadInWindow(aWindow, aModule) - loads a module into all the content scripts of a specified window
//	aWindow - (xul element) navigator window of which all content scripts will have the module loaded into
//	see loadInBrowser()
// unloadFromWindow(aWindow, aModule) - unloads a module from all the content scripts of a window [undoes loadInWindow()]
//	see loadInWindow()
// loadInAll(aModule) - loads a module into all content scripts
//	see loadInBrowser()
// unloadFromAll(aModule) - unloads a module from all content scripts [undoes loadInAll()]
//	see loadInBrowser()
this.Messenger = {
	loadedInAll: [],
	
	globalMM: Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager),
	
	messageBrowser: function(aBrowser, aMessage, aData, aCPOW) {
		if(!aBrowser || !aBrowser.messageManager) { return; }
		
		aBrowser.messageManager.sendAsyncMessage(objName+':'+aMessage, aData, aCPOW);
	},
	
	messageWindow: function(aWindow, aMessage, aData, aCPOW) {
		if(!aWindow || !aWindow.messageManager) { return; }
		
		aWindow.messageManager.broadcastAsyncMessage(objName+':'+aMessage, aData, aCPOW);
	},
	
	messageAll: function(aMessage, aData, aCPOW) {
		this.globalMM.broadcastAsyncMessage(objName+':'+aMessage, aData, aCPOW);
	},
	
	listenBrowser: function(aBrowser, aMessage, aListener) {
		if(!aBrowser || !aBrowser.messageManager) { return; }
		
		aBrowser.messageManager.addMessageListener(objName+':'+aMessage, aListener);
	},
	
	unlistenBrowser: function(aBrowser, aMessage, aListener) {
		if(!aBrowser || !aBrowser.messageManager) { return; }
		
		aBrowser.messageManager.removeMessageListener(objName+':'+aMessage, aListener);
	},
	
	listenWindow: function(aWindow, aMessage, aListener) {
		if(!aWindow || !aWindow.messageManager) { return; }
		
		aWindow.messageManager.addMessageListener(objName+':'+aMessage, aListener);
	},
	
	unlistenWindow: function(aWindow, aMessage, aListener) {
		if(!aWindow || !aWindow.messageManager) { return; }
		
		aWindow.messageManager.removeMessageListener(objName+':'+aMessage, aListener);
	},
	
	listenAll: function(aMessage, aListener) {
		this.globalMM.addMessageListener(objName+':'+aMessage, aListener);
	},
	
	unlistenAll: function(aMessage, aListener) {
		this.globalMM.removeMessageListener(objName+':'+aMessage, aListener);
	},
	
	loadInBrowser: function(aBrowser, aModule) {
		this.messageBrowser(aBrowser, 'load', aModule);
	},
	
	unloadFromBrowser: function(aBrowser, aModule) {
		this.messageBrowser(aBrowser, 'unload', aModule);
	},
	
	loadInWindow: function(aWindow, aModule) {
		if(aWindow.gBrowser && aWindow.gBrowser.tabContainer) {
			if(!aWindow.gBrowser.tabContainer[objName+'Content']) {
				aWindow.gBrowser.tabContainer[objName+'Content'] = {
					modules: [aModule],
					handleEvent: function(e) {
						Messenger.messageBrowser(e.target.linkedBrowser, 'reinit');
					}
				};
				aWindow.gBrowser.tabContainer.addEventListener('TabOpen', aWindow.gBrowser.tabContainer[objName+'Content'], true);
			}
			else if(aWindow.gBrowser.tabContainer[objName+'Content'].modules.indexOf(aModule) == -1) {
				aWindow.gBrowser.tabContainer[objName+'Content'].modules.push(aModule);
			}
		}
		
		this.messageWindow(aWindow, 'load', aModule);
	},
	
	unloadFromWindow: function(aWindow, aModule) {
		if(aWindow.gBrowser && aWindow.gBrowser.tabContainer) {
			if(aWindow.gBrowser.tabContainer[objName+'Content'] && aWindow.gBrowser.tabContainer[objName+'Content'].modules.indexOf(aModule) != -1) {
				aWindow.gBrowser.tabContainer[objName+'Content'].modules.splice(aWindow.gBrowser.tabContainer[objName+'Content'].modules.indexOf(aModule), 1);
				if(aWindow.gBrowser.tabContainer[objName+'Content'].modules.length == 0) {
					aWindow.gBrowser.tabContainer.removeEventListener('TabOpen', aWindow.gBrowser.tabContainer[objName+'Content'], true);
					delete aWindow.gBrowser.tabContainer[objName+'Content'];
				}
			}
		}
		
		this.messageWindow(aWindow, 'unload', aModule);
	},
	
	loadInAll: function(aModule) {
		if(this.loadedInAll.indexOf(aModule) != -1) { return; }
		this.loadedInAll.push(aModule);
		
		this.messageAll('load', aModule);
	},
	
	unloadFromAll: function(aModule) {
		if(this.loadedInAll.indexOf(aModule) == -1) { return; }
		this.loadedInAll.splice(this.loadedInAll.indexOf(aModule), 1);
		
		this.messageAll('unload', aModule);
	},
	
	receiveMessage: function(m) {
		// if this is a preloaded browser, we don't need to load in it, the content script will still be loaded in the actual tab's browser
		if(m.target.parentNode.localName == 'window' && m.target.parentNode.id == 'win') { return; }
		
		// can't stringify AddonData directly, because it contains an nsIFile instance (installPath) and an nsIURI instance (resourceURI)
		var carryData = {
			id: AddonData.id,
			initTime: AddonData.initTime,
			version: AddonData.version,
			oldVersion: AddonData.oldVersion,
			newVersion: AddonData.newVersion
		};	
		this.messageBrowser(m.target, 'init', carryData);
		
		// carry the preferences current values into content
		var current = {};
		for(let pref in prefList) {
			if(pref.startsWith('NoSync_')) { continue; }
			current[pref] = Prefs[pref];
		}
		this.messageBrowser(m.target, 'pref', current);
		
		// load into this browser all the content modules that should be loaded in all content scripts
		for(let module of this.loadedInAll) {
			this.messageBrowser(m.target, 'load', module);
		}
		
		// load into this browser all the content modules that should be loaded into content scripts of this window
		if(m.target.ownerGlobal.gBrowser && m.target.ownerGlobal.gBrowser.tabContainer && m.target.ownerGlobal.gBrowser.tabContainer[objName+'Content']) {
			for(let module of m.target.ownerGlobal.gBrowser.tabContainer[objName+'Content'].modules) {
				this.messageBrowser(m.target, 'load', module);
			}
		}
		
		// now we can load other individual modules that have been queued in the meantime (between window opening and content process finishing to initialize)
		this.messageBrowser(m.target, 'loadQueued');
	},
	
	observe: function(aSubject, aTopic, aData) {
		switch(aTopic) {
			case 'nsPref:changed':
				if(aSubject.startsWith('NoSync_')) { return; }
				
				var carry = {};
				carry[aSubject] = aData;
				Messenger.messageAll('pref', carry);
				break;
		}
	},
	
	cleanWindow: function(aWindow) {
		if(aWindow.gBrowser && aWindow.gBrowser.tabContainer && aWindow.gBrowser.tabContainer[objName+'Content']) {
			aWindow.gBrowser.tabContainer.removeEventListener('TabOpen', aWindow.gBrowser.tabContainer[objName+'Content'], true);
			delete aWindow.gBrowser.tabContainer[objName+'Content'];
		}
	}
};

Modules.LOADMODULE = function() {
	Messenger.listenAll('init', Messenger);
	Messenger.globalMM.loadFrameScript('resource://'+objPathString+'/modules/utils/content.js?'+AddonData.initTime, true);
	
	for(let pref in prefList) {
		if(pref.startsWith('NoSync_')) { continue; }
		
		Prefs.listen(pref, Messenger);
	}
};

Modules.UNLOADMODULE = function() {
	Messenger.unlistenAll('init', Messenger);
	
	for(let pref in prefList) {
		if(pref.startsWith('NoSync_')) { continue; }
		
		Prefs.unlisten(pref, Messenger);
	}
	
	Windows.callOnAll(Messenger.cleanWindow, 'navigator:browser');
	
	Messenger.globalMM.removeDelayedFrameScript('resource://'+objPathString+'/modules/utils/content.js?'+AddonData.initTime);
	Messenger.messageAll('shutdown');
};
