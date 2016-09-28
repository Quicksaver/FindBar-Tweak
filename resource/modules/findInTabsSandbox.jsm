/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 2.2.1

this.FITSandbox = {
	kBroadcasterId: objName+'-findInTabs-broadcaster',
	kFITuri: 'chrome://'+objPathString+'/content/findInTabsFull.xul',

	fulls: new Set(),
	sidebars: new Set(),
	viewSources: new Set(),
	navigators: new Set(),

	get size() { return this.fulls.size + this.sidebars.size; },

	observe: function(aSubject, aTopic, aData) {
		switch(aTopic) {
			case 'domwindowopened':
				this.fulls.add(aSubject);
				this.initWindow(aSubject);
				break;

			case 'domwindowclosed':
				this.fulls.delete(aSubject);
				this.deinitWindow();
				break;

			case 'SidebarFocused': {
				let aWindow = this.getWindowForSidebar(aSubject);

				// the opener can't do this itself from the button's command, as there are many ways of opening a sidebar
				let state = aWindow[objName].FITMini.getState();
				this.initState(aSubject, state);

				this.sidebars.add(aSubject);
				this.initWindow(aSubject, true);

				// the window must act as if it was using a global findbar, so that it plays well with the FIT sidebar
				aWindow[objName].FITMini.sidebar = aSubject;
				aWindow[objName].togglePerTab();

				// if the sidebar was opened without the use of the find bar, make sure it is also visible, as the sidebar is useless without the find bar
				if(aWindow.gFindBar.hidden || aWindow.gFindBar._findMode != aWindow.gFindBar.FIND_NORMAL) {
					aWindow.gFindBar.onFindCommand();
				}
				break;
			}
			case 'SidebarUnloaded': {
				this.sidebars.delete(aSubject);
				this.deinitWindow();

				let aWindow = this.getWindowForSidebar(aSubject);

				aWindow[objName].FITMini.sidebar = null;
				aWindow[objName].togglePerTab();
				break;
			}
			case 'nsPref:changed':
				if(!Prefs.findInTabs) {
					this.closeWindows();
				}
				break;
		}
	},

	has: function(aWindow) {
		return this.navigators.has(aWindow) || this.viewSources.has(aWindow);
	},

	// param - visibility state; (bool) true forces show the sidebar, (bool) false forces hide the sidebar, (undefined) toggles show<->hide
	commandSidebar: function(aWindow, param) {
		let SidebarUI = aWindow.SidebarUI;
		if(!SidebarUI) { return Promise.reject(); }

		// the button's command acts as a toggle as well, so we close the FIT sidebar if the FIT sidebar is already opened
		let sidebar = this.findSidebar(aWindow);
		if(sidebar && param !== true) {
			return SidebarUI.toggle(this.kBroadcasterId);
		}

		if(param === false) { return Promise.resolve(); }

		// the FIT sidebar isn't open and we want it to be, so let's start it up, the state will be carried by our observer
		return SidebarUI.show(this.kBroadcasterId, Prefs.twinFITSidebar);
	},

	findSidebar: function(aWindow) {
		// try to fetch the sidebar from FITMini's reference, saves on cycles
		if(aWindow[objName] && aWindow[objName].FITMini && aWindow[objName].FITMini.sidebar) {
			return aWindow[objName].FITMini.sidebar;
		}

		let SidebarUI = aWindow.SidebarUI;
		if(!SidebarUI) { return null; }

		if(SidebarUI.sidebars) { // OmniSidebar
			for(let bar of SidebarUI.sidebars()) {
				if(bar.isOpen && bar.command == this.kBroadcasterId) {
					return bar.sidebar.contentWindow;
				}
			}
		}
		else if(SidebarUI.isOpen && SidebarUI.currentID == this.kBroadcasterId) {
			return SidebarUI.browser.contentWindow;
		}
		return null;
	},

	getWindowForSidebar: function(aSidebar) {
		return	window.QueryInterface(Ci.nsIInterfaceRequestor)
				.getInterface(Ci.nsIWebNavigation)
				.QueryInterface(Ci.nsIDocShellTreeItem)
				.rootTreeItem
				.QueryInterface(Ci.nsIInterfaceRequestor)
				.getInterface(Ci.nsIDOMWindow);
	},

	initWindow: function(aWindow, isSidebar) {
		replaceObjStrings(aWindow.document);

		// it should know to differentiate itself from the standalone dialog (we use the same XUL file for both)
		toggleAttribute(aWindow.document.documentElement, 'FITSidebar', isSidebar);

		startAddon(aWindow);

		// as long as a FIT dialog is open, all tabs must be followed so that their content is properly reflected in the lists
		Observers.notify('FIT:Load');
	},

	deinitWindow: function() {
		// there's no need to deinitialize the objects themselves in the window, as it will be closed anyway,

		if(!this.size) {
			// if no more FIT dialogs remain open, unload all the frame scripts in all tabs,
			// there's no point in keeping them registering events and sending info nowhere
			Observers.notify('FIT:Unload');
		}
	},

	commandWindow: function(aOpener, state) {
		// Re-use an already opened window if possible
		if(!Prefs.multipleFITFull && this.fulls.size) {
			for(let aWindow of this.fulls) {
				if(aWindow.FITinitialized) {
					aWindow.FITinitialized.then(() => {
						if(this.carryState(aWindow, state)) {
							aWindow[objName].FIT.shouldFindAll();
						}

						let findbar = aWindow[objName].gFindBar;
						findbar.onFindCommand();
					});
				}
				aWindow.focus();

				// we only really care about the first window in the set, it's highly unlikely there will be more anyway
				return;
			}
		}

		// No window found, we need to open a new one
		let aWindow = aOpener.open(this.kFITuri, '', 'chrome,extrachrome,toolbar,resizable,centerscreen');
		this.initState(aWindow, state);
	},

	initState: function(aWindow, state) {
		// will be resolved by findInTabs.jsm
		aWindow.FITdeferred = new Promise.defer();
		aWindow.FITinitialized = aWindow.FITdeferred.promise;

		aWindow.FITinitialized.then(() => {
			this.carryState(aWindow, state);
		}, function(ex) {
			// in case something goes wrong initializing the FIT window, we need to capture it
			console.log(ex);
		});
	},

	carryState: function(aWindow, state, forceEmpty) {
		if(state.lastBrowser) {
			aWindow[objName].FIT.lastBrowser = state.lastBrowser;
		}

		let findbar = aWindow[objName].gFindBar;
		if((state.query || forceEmpty)
		&& (state.query != findbar._findField.value || state.caseSensitive != findbar.getElement("find-case-sensitive").checked)) {
			findbar._findField.value = state.query;
			findbar.getElement("find-case-sensitive").checked = state.caseSensitive;
			return true;
		}

		return false;
	},

	closeWindows: function() {
		for(let win of this.fulls) {
			try { win.close(); }
			catch(ex) { Cu.reportError(ex); }
		}

		// closing the sidebars is done by FITMini so that the broadcaster still exists then
	}
};

Modules.LOADMODULE = function() {
	Prefs.listen('findInTabs', FITSandbox);

	// Apply the add-on to our own FIT window; none are (or should be!) open yet, so only need to register
	Windows.register(FITSandbox, 'domwindowopened', 'addon:findInTabs');
	Windows.register(FITSandbox, 'domwindowclosed', 'addon:findInTabs');
	Browsers.register(FITSandbox, 'SidebarFocused', FITSandbox.kFITuri);
	Browsers.register(FITSandbox, 'SidebarUnloaded', FITSandbox.kFITuri);
};

Modules.UNLOADMODULE = function() {
	Prefs.unlisten('findInTabs', FITSandbox);
	Windows.unregister(FITSandbox, 'domwindowopened', 'addon:findInTabs');
	Windows.unregister(FITSandbox, 'domwindowclosed', 'addon:findInTabs');
	Browsers.unregister(FITSandbox, 'SidebarFocused', FITSandbox.kFITuri);
	Browsers.unregister(FITSandbox, 'SidebarUnloaded', FITSandbox.kFITuri);

	// If we get to this point it's probably safe to assume we should close all our windows
	FITSandbox.closeWindows();
};
