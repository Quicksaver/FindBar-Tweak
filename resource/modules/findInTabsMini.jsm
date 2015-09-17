Modules.VERSION = '2.1.9';

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
		
		dispatch(bar, { type: 'SelectedFITHit', cancelable: false });
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'TabClose':
				// make sure any focus or state changes that may happen while the browser is being removed don't recreate the tab entry
				Messenger.unloadFromBrowser(e.target.linkedBrowser, 'findInTabs');
				
				if(FITSandbox.fulls.size > 0) {
					Observers.notify('FIT:Update', e.target.linkedBrowser, 'removeBrowser');
				}
				break;
			
			case 'TabSelect':
				this.sendToUpdate();
				break;
			
			case 'TabOpen':
			case 'TabRemotenessChange':
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
		this.sendToUpdate(browser);
	},
	
	onPDFJSState: function(browser) {
		if(FITSandbox.fulls.size == 0) { return; }
		
		// We do with a delay to allow the page to render the selected element
		aSync(() => {
			this.sendToUpdate(browser);
		}, 10);
	},
	
	command: function() {
		this.toggle();
		
		if(FITFull) {
			FIT.shouldFindAll();
		}
	},
	
	toggle: function() {
		if(FITFull) {
			gFindBar.onFindCommand();
			FIT.updateFilterTooltip(); // in findInTabs.jsm, so its placeholder text isn't replaced by the default string
			return;
		}
		
		let state = {
			lastBrowser: (viewSource) ? gFindBar.browser : gBrowser.mCurrentBrowser
		};
		if((viewSource || gFindBarInitialized) && !gFindBar.hidden && findQuery) {
			state.query = findQuery;
			state.caseSensitive = gFindBar.getElement("find-case-sensitive").checked;
		}
		
		FITSandbox.commandWindow(window, state);
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
				if(bar._destroying) { return; }
				
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
			Listeners.add(gBrowser.tabContainer, 'TabRemotenessChange', this);
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
		
		Observers.remove(this, 'FIT:Load');
		Observers.remove(this, 'FIT:Unoad');
		
		if(!viewSource) {
			Listeners.remove(gBrowser.tabContainer, 'TabClose', this);
			Listeners.remove(gBrowser.tabContainer, 'TabSelect', this);
			Listeners.remove(gBrowser.tabContainer, 'TabOpen', this);
			Listeners.remove(gBrowser.tabContainer, 'TabRemotenessChange', this);
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
