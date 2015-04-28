Modules.VERSION = '2.0.0';

this.FITMini = {
	get broadcaster() { return $(objName+'-findInTabs-broadcaster'); },
	
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
		
		if(aWindow.document.readyState == 'uninitialized') {
			callOnLoad(aWindow, this.carryData);
		} else {
			this.carryData(aWindow);
		}
	},
	
	carryData: function(aWindow) {
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
	},
	
	// triggers a find operation, to make sure we have hits to show when selecting one, and that we actually show them as well
	find: function(m) {
		var bar = (viewSource) ? gFindBar : gBrowser.getFindBar(gBrowser.getTabForBrowser(m.target));
		
		// don't actually perform the fastFind operation, as it already will have been commanded by the message sender
		bar.browser.finder.workAroundFind = true;
		bar._findField.value = m.data.query;
		bar._setCaseSensitivity(m.data.caseSensitive ? 1 : 0); // implies bar._find()
		bar.browser.finder.workAroundFind = false;
	},
	
	sendToUpdate: function(browser) {
		if(FITSandbox.fulls.size == 0) { return; }
		
		browser = browser || (viewSource ? gFindBar.browser : gBrowser.mCurrentBrowser);
		Observers.notify('FIT:Update', browser, 'updateBrowser');
	},
	
	onTabClose: function(e) {
		if(FITSandbox.fulls.size == 0) { return; }
		
		Observers.notify('FIT:Update', e.target.linkedBrowser, 'removeBrowser');
	},
	
	onTabSelect: function(e) {
		FITMini.sendToUpdate();
	},
	
	onTabOpen: function(e) {
		if(FITSandbox.fulls.size == 0) { return; }
		
		// if any FIT window is open, we need to make sure the findInTabs content script is loaded, even if its findbar isn't initialized yet
		Messenger.loadInBrowser(e.target.linkedBrowser, 'findInTabs');
	},
	
	onFindResult: function(data, browser) {
		FITMini.sendToUpdate(browser);
	},
	
	onPDFJSState: function(browser) {
		if(FITSandbox.fulls.size == 0) { return; }
		
		// We do with a delay to allow the page to render the selected element
		aSync(function() {
			FITMini.sendToUpdate(browser);
		}, 10);
	},
	
	onUnload: function() {
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
	}
};

Modules.LOADMODULE = function() {
	if(FITFull) {
		Modules.load('findInTabs');
		return;
	}
	
	Overlays.overlayWindow(window, 'findInTabsMini', null, function() {
		alwaysRunOnClose.push(FITMini.onUnload);
		if(viewSource) {
			FITSandbox.viewSources.add(window);
		} else {
			FITSandbox.navigators.add(window);
		}
		
		initFindBar('findInTabsMini',
			function(bar) {
				var toggleButton = document.createElement('toolbarbutton');
				setAttribute(toggleButton, 'anonid', objName+'-find-tabs');
				setAttribute(toggleButton, 'class', 'findbar-highlight findbar-tabs tabbable findbar-no-find-fast');
				setAttribute(toggleButton, 'observes', objName+'-findInTabs-broadcaster');
				bar.getElement("findbar-container").insertBefore(toggleButton, bar.getElement('find-case-sensitive').nextSibling);
				
				bar.browser.finder.addResultListener(FITMini);
			},
			function(bar) {
				bar.browser.finder.removeResultListener(FITMini);
				
				bar.getElement(objName+'-find-tabs').remove();
			}
		);
		
		Messenger.listenWindow(window, 'FIT:Find', FITMini.find);
		
		if(!viewSource) {
			// Update FIT lists as needed
			Listeners.add(gBrowser.tabContainer, 'TabClose', FITMini.onTabClose);
			Listeners.add(gBrowser.tabContainer, 'TabSelect', FITMini.onTabSelect);
			Listeners.add(gBrowser.tabContainer, 'TabOpen', FITMini.onTabOpen);
		}
		
		Observers.add(FITMini, 'FIT:Load');
		Observers.add(FITMini, 'FIT:Unoad');
		
		// make sure all browsers in this window have the FIT content script loaded, in case it is needed
		if(FITSandbox.fulls.size > 0) {
			FITMini.observe(null, 'FIT:Load');
		}
		
		if(Services.wm.getMostRecentWindow(null) == window) {
			FITMini.sendToUpdate();
		}
	});
};

Modules.UNLOADMODULE = function() {
	if(FITFull) {
		Modules.unload('findInTabs');
		return;
	}
	
	deinitFindBar('findInTabsMini');
	deinitFindBar('findInTabsContent');
	
	Observers.remove(FITMini, 'FIT:Load');
	Observers.remove(FITMini, 'FIT:Unoad');
	
	if(!viewSource) {
		Listeners.remove(gBrowser.tabContainer, 'TabClose', FITMini.onTabClose);
		Listeners.remove(gBrowser.tabContainer, 'TabSelect', FITMini.onTabSelect);
		Listeners.remove(gBrowser.tabContainer, 'TabOpen', FITMini.onTabOpen);
	}
	
	Messenger.unlistenWindow(window, 'FIT:Find', FITMini.find);
	
	Overlays.removeOverlayWindow(window, 'findInTabsMini');
	
	// this should run in alwaysRunOnClose but making sure here either way, doesn't hurt
	FITMini.onUnload();
};
