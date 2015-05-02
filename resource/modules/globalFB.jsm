Modules.VERSION = '2.0.0';

this.globalFB = {
	// findBarHiddenState
	hidden: true,
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'OpenedFindBar':
				this.onOpen();
				break;
			
			case 'ClosedFindBar':
				this.onClose();
				break;
			
			case 'TabOpen':
				// No need to do anything if the find bar should be closed
				if(this.hidden) { return; }
				
				var tab = e.target;
				gBrowser.getFindBar(tab).open();
				break;
			
			case 'TabSelectPrevious':
				// mostly a failsafe, it shouldn't be needed but just in case something fails somewhere, we also check the find bar state when toggling between tabs
				if(this.hidden && gFindBarInitialized && !gFindBar.hidden) {
					gFindBar.close();
				}
				else if(!this.hidden && (!gFindBarInitialized || gFindBar.hidden)) {
					gFindBar.open();
				}
				
				// Copy the values of the findField from one tab to another
				if(currentTab && currentTab._findBar) {
					findQuery = currentTab._findBar._findField.value;
					gFindBar.getElement('highlight').checked = currentTab._findBar.getElement('highlight').checked;
					gFindBar.getElement('find-case-sensitive').checked = currentTab._findBar.getElement('find-case-sensitive').checked;
					gFindBar._enableFindButtons(findQuery);
					
					// remove highlights from a previous search query
					if(documentHighlighted && highlightedWord && highlightedWord != findQuery) {
						highlights.off();
					}
				}
				break:
		}
	},
	
	onOpen: function() {
		// Quick Find shouldn't be global
		if(gFindBar._findMode != gFindBar.FIND_NORMAL) { return; }
		
		this.hidden = false;
		Timers.cancel('globalFBOnClose');
		Timers.init('globalFBOnOpen', () => {
			for(let tab of gBrowser.tabs) {
				let bar = gBrowser.getFindBar(tab);
				if(bar == gFindBar && !gFindBar.hidden) { continue; }
				bar.open();
			}
		}, 50);
	},
	
	onClose: function() {
		this.hidden = true;
		Timers.cancel('globalFBOnOpen');
		Timers.init('globalFBOnClose', () => {
			for(let tab of gBrowser.tabs) {
				if(gBrowser.isFindBarInitialized(tab)) {
					let bar = gBrowser.getFindBar(tab);
					if(gFindBarInitialized && bar == gFindBar && gFindBar.hidden) { continue; }
					bar.close();
				}
			}
		}, 50);
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(gBrowser.tabContainer, "TabOpen", globalFB);
	Listeners.add(gBrowser.tabContainer, "TabSelectPrevious", globalFB);
	Listeners.add(window, 'OpenedFindBar', globalFB);
	Listeners.add(window, 'ClosedFindBar', globalFB);
	
	findBarHiddenState = !gFindBarInitialized || gFindBar.hidden;
	if(!findBarHiddenState) {
		globalFB.onOpen();
	} else {
		globalFB.onClose();
	}
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(gBrowser.tabContainer, "TabOpen", globalFB);
	Listeners.remove(gBrowser.tabContainer, "TabSelectPrevious", globalFB);
	Listeners.remove(window, 'OpenedFindBar', globalFB);
	Listeners.remove(window, 'ClosedFindBar', globalFB);
	
	for(var tab of gBrowser.tabs) {
		if(tab == gBrowser.mCurrentTab) { continue; }
		
		if(gBrowser.isFindBarInitialized(tab) && !tab.linkedBrowser.finder.findWord) {
			var bar = gBrowser.getFindBar(tab);
			bar.close();
		}
	}
};
