Modules.VERSION = '2.1.1';

this.FITSandbox = {
	fulls: new Set(),
	viewSources: new Set(),
	navigators: new Set(),
	
	observe: function(aSubject, aTopic, aData) {
		switch(aTopic) {
			case 'domwindowopened':
				this.fulls.add(aSubject);
				listenOnce(aSubject, 'unload', () => {
					this.fulls.delete(aSubject);
					if(this.fulls.size == 0) {
						// if no more FIT dialogs remain open, unload all the frame scripts in all tabs,
						// there's no point in keeping them registering events and sending info nowhere
						Observers.notify('FIT:Unload');
					}
				});
				
				replaceObjStrings(aSubject.document);
				startAddon(aSubject);
				
				// as long as a FIT dialog is open, all tabs must be followed so that their content is properly reflected in the lists
				Observers.notify('FIT:Load');
				break;
			
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
	
	commandWindow: function(aOpener, state) {
		// Re-use an already opened window if possible
		if(!Prefs.multipleFITFull && this.fulls.size > 0) {
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
		let aWindow = aOpener.open("chrome://"+objPathString+"/content/findInTabsFull.xul", '', 'chrome,extrachrome,toolbar,resizable,centerscreen');
		
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
	
	carryState: function(aWindow, state) {
		if(state.lastBrowser) {
			aWindow[objName].FIT.lastBrowser = state.lastBrowser;
		}
		
		let findbar = aWindow[objName].gFindBar;
		if(state.query
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
	}
};

Modules.LOADMODULE = function() {
	Prefs.listen('findInTabs', FITSandbox);
	
	// Apply the add-on to our own FIT window; none are (or should be!) open yet, so only need to register
	Windows.register(FITSandbox, 'domwindowopened', 'addon:findInTabs');
};

Modules.UNLOADMODULE = function() {
	Prefs.unlisten('findInTabs', FITSandbox);
	Windows.unregister(FITSandbox, 'domwindowopened', 'addon:findInTabs');
	
	// If we get to this point it's probably safe to assume we should close all our windows
	FITSandbox.closeWindows();
};
