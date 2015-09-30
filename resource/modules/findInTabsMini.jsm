Modules.VERSION = '2.2.3';

this.FITMini = {
	get broadcaster() { return $(FITSandbox.kBroadcasterId); },
	
	sidebar: null,
	
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
				
				if(FITSandbox.size) {
					Observers.notify('FIT:Update', e.target.linkedBrowser, 'removeBrowser');
				}
				break;
			
			case 'TabSelect':
				this.sendToUpdate();
				break;
			
			case 'TabOpen':
			case 'TabRemotenessChange':
				// if any FIT window is open, we need to make sure the findInTabs content script is loaded, even if its findbar isn't initialized yet
				if(FITSandbox.size) {
					Messenger.loadInBrowser(e.target.linkedBrowser, 'findInTabs');
				}
				break;
			
			case 'WillFindFindBar':
				// we need to send the findbar's value to the FIT sidebar if it's opened, so that the lists are always up-to-date
				if(this.sidebar) {
					let state = this.getState(true);
					if(FITSandbox.carryState(this.sidebar, state, true)) {
						this.sidebar[objName].FIT.shouldFindAll();
					}
				}
				break;
			
			case 'OpenedFindBar':
				// never show the sidebar when using the quick findbar
				if(gFindBar._findMode != gFindBar.FIND_NORMAL) {
					FITSandbox.commandSidebar(window, false);
					break;
				}
				
				// the FIT sidebar should already be in the correct state when switching tabs!
				// There's no need to toggle the sidebar if the find bar "was already open".
				if(Prefs.autoShowHideFIT && !trueAttribute(gFindBar, 'noAnimation')) {
					FITSandbox.commandSidebar(window, true);
				}
				break;
			
			case 'ClosedFindBar':
				if(Prefs.autoShowHideFIT && !trueAttribute(gFindBar, 'noAnimation')) {
					FITSandbox.commandSidebar(window, false);
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
			
			case 'nsPref:changed':
				switch(aSubject) {
					case 'findInTabsAction':
						this.updateBroadcaster();
						// no break; continue to autoShowHideFIT
					
					case 'autoShowHideFIT':
						// in case the user doesn't want the button to toggle the sidebar, make sure we close it now,
						// otherwise the user would have to do it manually
						if(Prefs.findInTabsAction != 'sidebar') {
							FITSandbox.commandSidebar(window, false);
						}
						
						// otherwise see if the findbar is already opened and show the sidebar if it isn't shown already;
						else if(Prefs.autoShowHideFIT && gFindBarInitialized && !gFindBar.hidden && !this.sidebar) {
							this.toggle();
						}
						break;
				}
				break;
		}
	},
	
	onFindResult: function(data, browser) {
		this.sendToUpdate(browser);
	},
	
	onPDFJSState: function(browser) {
		if(!FITSandbox.size) { return; }
		
		// We do with a delay to allow the page to render the selected element
		aSync(() => {
			this.sendToUpdate(browser);
		}, 10);
	},
	
	toggle: function() {
		if(FITFull) {
			// pressing Ctrl+F while in FITSidebar should act as if it was pressed in the webpage
			if(FITSidebar) {
				let aWindow = FITSandbox.getWindowForSidebar(window);
				aWindow[objName].ctrlF();
				return;
			}
			
			gFindBar.onFindCommand();
			FIT.updateFilterTooltip(); // in findInTabs.jsm, so its placeholder text isn't replaced by the default string
			return;
		}
		
		// should the command toggle the sidebar instead of opening the standalone dialog?
		if(!viewSource && Prefs.findInTabsAction == 'sidebar') {
			FITSandbox.commandSidebar(window);
			return;
		}
		
		// bring forth a FIT window I say!
		let state = this.getState();
		FITSandbox.commandWindow(window, state);
	},
	
	getState: function(forceEmpty) {
		let state = {};
		
		if(FITFull) {
			state.lastBrowser = FIT.lastBrowser;
		} else if(viewSource) {
			state.lastBrowser = gFindBar.browser;
		} else {
			state.lastBrowser = gBrowser.mCurrentBrowser;
		}
		
		if((FITFull || viewSource || gFindBarInitialized)
		&& ((!gFindBar.hidden && findQuery) || forceEmpty)) {
			state.query = findQuery;
			state.caseSensitive = gFindBar.getElement("find-case-sensitive").checked;
		}
		
		return state;
	},
	
	goToFITFull: function() {
		let state = this.getState();
		FITSandbox.commandWindow(window, state);
	},
	
	sendToUpdate: function(browser) {
		if(!FITSandbox.size) { return; }
		
		browser = browser || (viewSource ? gFindBar.browser : gBrowser.mCurrentBrowser);
		Observers.notify('FIT:Update', browser, 'updateBrowser');
	},
	
	// make sure all the buttons have the proper labels and states
	updateBroadcaster: function() {
		let broadcaster = this.broadcaster;
		
		if(Prefs.findInTabsAction == 'sidebar' && !viewSource && !FITFull) {
			var mode = 'sidebar';
			var label = Strings.get('findInTabs', 'findAllButtonLabel');
			var tooltip = Strings.get('findInTabs', 'findAllButtonTooltip');
			var accesskey = Strings.get('findInTabs', 'findAllButtonAccesskey');
		} else {
			var mode = 'tabs';
			var label = Strings.get('findInTabs', 'findTabsButtonLabel');
			var tooltip = Strings.get('findInTabs', 'findTabsButtonTooltip');
			var accesskey = Strings.get('findInTabs', 'findTabsButtonAccesskey');
		}
		
		setAttribute(broadcaster, 'mode', mode);
		setAttribute(broadcaster, 'label', label);
		setAttribute(broadcaster, 'tooltiptext', tooltip);
		setAttribute(broadcaster, 'accesskey', accesskey);
		setAttribute(broadcaster, 'sidebartitle', Strings.get('findInTabs', 'findAllButtonLabel'));
	},
	
	onLoad: function() {
		if(viewSource) {
			FITSandbox.viewSources.add(window);
		} else {
			FITSandbox.navigators.add(window);
		}
		
		this.updateBroadcaster();
		if(!viewSource) {
			Prefs.listen('findInTabsAction', this);
			Prefs.listen('autoShowHideFIT', this);
			Listeners.add(window, 'OpenedFindBar', this);
			Listeners.add(window, 'ClosedFindBar', this);
		}
		
		initFindBar('findInTabsMini',
			(bar) => {
				let toggleButton = document.createElement('toolbarbutton');
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
		Listeners.add(window, 'WillFindFindBar', this);
		
		Observers.add(this, 'FIT:Load');
		Observers.add(this, 'FIT:Unoad');
		
		// make sure all browsers in this window have the FIT content script loaded, in case it is needed
		if(FITSandbox.size) {
			this.observe(null, 'FIT:Load');
		}
		
		if(Services.wm.getMostRecentWindow(null) == window) {
			this.sendToUpdate();
		}
	},
	
	onUnload: function() {
		// close the FIT sidebar if it's open in this window
		if(!viewSource && this.sidebar) {
			FITSandbox.commandSidebar(window, false);
		}
		
		deinitFindBar('findInTabsMini');
		
		Observers.remove(this, 'FIT:Load');
		Observers.remove(this, 'FIT:Unoad');
		
		if(!viewSource) {
			Listeners.remove(gBrowser.tabContainer, 'TabClose', this);
			Listeners.remove(gBrowser.tabContainer, 'TabSelect', this);
			Listeners.remove(gBrowser.tabContainer, 'TabOpen', this);
			Listeners.remove(gBrowser.tabContainer, 'TabRemotenessChange', this);
		}
		Listeners.remove(window, 'WillFindFindBar', this);
		
		Messenger.unlistenWindow(window, 'FIT:Find', this);
		
		if(!viewSource) {
			Prefs.unlisten('findInTabsAction', this);
			Prefs.unlisten('autoShowHideFIT', this);
			Listeners.remove(window, 'OpenedFindBar', this);
			Listeners.remove(window, 'ClosedFindBar', this);
		}
		
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
