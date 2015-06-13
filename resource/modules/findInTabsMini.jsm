Modules.VERSION = '2.1.3';

this.FITMini = {
	get broadcaster() { return $(objName+'-findInTabs-broadcaster'); },
	
	// triggers a find operation, to make sure we have hits to show when selecting one, and that we actually show them as well
	receiveMessage: function(m) {
		var bar = (viewSource) ? gFindBar : gBrowser.getFindBar(gBrowser.getTabForBrowser(m.target));
		
		// don't actually perform the fastFind operation, as it already will have been commanded by the message sender
		bar.browser.finder.workAroundFind = true;
		bar._findField.value = m.data.query;
		bar._setCaseSensitivity(m.data.caseSensitive ? 1 : 0); // implies bar._find()
		bar.browser.finder.workAroundFind = false;
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'TabClose':
				if(FITSandbox.fulls.size > 0) {
					Observers.notify('FIT:Update', e.target.linkedBrowser, 'removeBrowser');
				}
				break;
			
			case 'TabSelect':
				this.sendToUpdate();
				break;
			
			case 'TabOpen':
				// if any FIT window is open, we need to make sure the findInTabs content script is loaded, even if its findbar isn't initialized yet
				if(FITSandbox.fulls.size > 0) {
					Messenger.loadInBrowser(e.target.linkedBrowser, 'findInTabs');
				}
				break;
		}
	},
	
	observe: function(aSubject, aTopic) {
		switch(aTopic) {
			case 'FIT:Load':
				// already opened tabs need to have their findBar created, otherwise FIT won't work there
				if(!viewSource) {
					for(let browser of gBrowser.browsers) {
						Messenger.loadInBrowser(browser, 'findInTabs');
					}
				} else {
					Messenger.loadInBrowser(gFindBar.browser, 'findInTabs');
				}
				break;
			
			case 'FIT:Unload':
				if(!viewSource) {
					for(let browser of gBrowser.browsers) {
						Messenger.unloadFromBrowser(browser, 'findInTabs');
					}
				} else {
					Messenger.unloadFromBrowser(gFindBar.browser, 'findInTabs');
				}
				break;
		}
	},
	
	onFindResult: function(data, browser) {
		FITMini.sendToUpdate(browser);
	},
	
	onPDFJSState: function(browser) {
		if(FITSandbox.fulls.size == 0) { return; }
		
		// We do with a delay to allow the page to render the selected element
		aSync(() => {
			this.sendToUpdate(browser);
		}, 10);
	},
	
	commmand: function() {
		if(!FITFull) {
			this.toggle();
			return;
		}
		
		FIT.shouldFindAll();
	},
	
	toggle: function() {
		if(FITFull) {
			gFindBar.onFindCommand();
			FIT.updateFilterTooltip(); // in findInTabs.jsm, so its placeholder text isn't replaced by the default string
			return;
		}
		
		// Re-use an already opened window if possible
		if(!Prefs.multipleFITFull && FITSandbox.fulls.size > 0) {
			for(let aWindow of FITSandbox.fulls) {
				if(aWindow.document.readyState != 'uninitialized'
				&& (viewSource || gFindBarInitialized)
				&& !gFindBar.hidden
				&& findQuery
				&& findQuery != aWindow.document.getElementById('FindToolbar')._findField.value) {
					aWindow.document.getElementById('FindToolbar')._findField.value = findQuery;
					aWindow[objName].FIT.shouldFindAll();
				}
				aWindow.document.getElementById('FindToolbar').onFindCommand();
				aWindow.focus();
				
				// we only really care about the first window in the set, it's highly unlikely there will be more anyway
				return;
			}
		}
		
		// No window found, we need to open a new one
		var aWindow = window.open("chrome://"+objPathString+"/content/findInTabsFull.xul", '', 'chrome,extrachrome,toolbar,resizable,centerscreen');
		callOnLoad(aWindow, () => {
			if((viewSource || gFindBarInitialized) && (!gFindBar.hidden || documentHighlighted) && findQuery) {
				aWindow.document.getElementById('FindToolbar')._findField.value = findQuery;
			}
			
			if(typeof(aWindow[objName].FIT) == 'undefined') {
				Listeners.add(aWindow, 'FITLoaded', function() {
					aWindow[objName].FIT.lastBrowser = (viewSource) ? gFindBar.browser : gBrowser.mCurrentBrowser;
				}, false, true);
			} else {
				aWindow[objName].FIT.lastBrowser = (viewSource) ? gFindBar.browser : gBrowser.mCurrentBrowser;
			}
		});
	},
	
	sendToUpdate: function(browser) {
		if(FITSandbox.fulls.size == 0) { return; }
		
		browser = browser || (viewSource ? gFindBar.browser : gBrowser.mCurrentBrowser);
		Observers.notify('FIT:Update', browser, 'updateBrowser');
	},
	
	onLoad: function() {
		if(viewSource) {
			FITSandbox.viewSources.add(window);
		} else {
			FITSandbox.navigators.add(window);
		}
		
		initFindBar('findInTabsMini',
			(bar) => {
				var toggleButton = document.createElement('toolbarbutton');
				setAttribute(toggleButton, 'anonid', objName+'-find-tabs');
				setAttribute(toggleButton, 'class', 'findbar-button findbar-tabs tabbable findbar-no-find-fast');
				setAttribute(toggleButton, 'observes', objName+'-findInTabs-broadcaster');
				bar.getElement("findbar-container").insertBefore(toggleButton, bar.getElement('find-case-sensitive').nextSibling);
				
				// make sure the australis styling is also applied to the FIT button
				buttonLabels.toggle();
				
				bar.browser.finder.addResultListener(this);
			},
			(bar) => {
				bar.browser.finder.removeResultListener(this);
				
				bar.getElement(objName+'-find-tabs').remove();
			}
		);
		
		Messenger.listenWindow(window, 'FIT:Find', this);
		
		if(!viewSource) {
			// Update FIT lists as needed
			Listeners.add(gBrowser.tabContainer, 'TabClose', this);
			Listeners.add(gBrowser.tabContainer, 'TabSelect', this);
			Listeners.add(gBrowser.tabContainer, 'TabOpen', this);
		}
		
		Observers.add(this, 'FIT:Load');
		Observers.add(this, 'FIT:Unoad');
		
		// make sure all browsers in this window have the FIT content script loaded, in case it is needed
		if(FITSandbox.fulls.size > 0) {
			this.observe(null, 'FIT:Load');
		}
		
		if(Services.wm.getMostRecentWindow(null) == window) {
			this.sendToUpdate();
		}
	},
	
	onUnload: function() {
		deinitFindBar('findInTabsMini');
		deinitFindBar('findInTabsContent');
		
		Observers.remove(this, 'FIT:Load');
		Observers.remove(this, 'FIT:Unoad');
		
		if(!viewSource) {
			Listeners.remove(gBrowser.tabContainer, 'TabClose', this);
			Listeners.remove(gBrowser.tabContainer, 'TabSelect', this);
			Listeners.remove(gBrowser.tabContainer, 'TabOpen', this);
		}
		
		Messenger.unlistenWindow(window, 'FIT:Find', this);
		
		if((window.closed || window.willClose) && !UNLOADED && Prefs.findInTabs) {
			if(!viewSource) {
				FITSandbox.navigators.delete(window);
				// Ensure we remove tabs of closing windows from lists
				for(let browser of gBrowser.browsers) {
					Observers.notify('FIT:Update', browser, 'removeBrowser');
				}
			}
			else {
				FITSandbox.viewSources.delete(window);
				Observers.notify('FIT:Update', gFindBar.browser, 'removeBrowser');
			}
		}
	}
};

Modules.LOADMODULE = function() {
	if(FITFull) {
		Modules.load('findInTabs');
		return;
	}
	
	Overlays.overlayWindow(window, 'findInTabsMini', FITMini);
};

Modules.UNLOADMODULE = function() {
	if(FITFull) {
		Modules.unload('findInTabs');
		return;
	}
	
	Overlays.removeOverlayWindow(window, 'findInTabsMini');
};
