Modules.VERSION = '1.0.8';

this.findBarHiddenState = true;

this.globalFBOnOpen = function() {
	// Quick Find shouldn't be global
	if(gFindBar._findMode != gFindBar.FIND_NORMAL) { return; }
	
	findBarHiddenState = false;
	Timers.cancel('globalFBOnClose');
	Timers.init('globalFBOnOpen', globalFBOpenAll, 50);
};

this.globalFBOpenAll = function() {
	for(var tab of gBrowser.tabs) {
		var bar = gBrowser.getFindBar(tab);
		if(bar == gFindBar && !gFindBar.hidden) { continue; }
		bar.open();
	}
};

this.globalFBOnClose = function() {
	findBarHiddenState = true;
	Timers.cancel('globalFBOnOpen');
	Timers.init('globalFBOnClose', globalFBCloseAll, 50);
};

this.globalFBCloseAll = function() {
	for(var tab of gBrowser.tabs) {
		if(gBrowser.isFindBarInitialized(tab)) {
			var bar = gBrowser.getFindBar(tab);
			if(gFindBarInitialized && bar == gFindBar && gFindBar.hidden) { continue; }
			bar.close();
		}
	}
};

this.globalFBTabOpen = function(e) {
	// No need to do anything if the find bar should be closed
	if(findBarHiddenState) { return; }
	
	var tab = e.target;
	gBrowser.getFindBar(tab).open();
};

this.globalFBTabSelect = function() {
	// This is mostly a failsafe, it shouldn't be needed but just in case something fails somewhere, we also check the find bar state when toggling between tabs
	if(findBarHiddenState && gFindBarInitialized && !gFindBar.hidden) {
		gFindBar.close();
	}
	else if(!findBarHiddenState && (!gFindBarInitialized || gFindBar.hidden)) {
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
};

Modules.LOADMODULE = function() {
	Listeners.add(gBrowser.tabContainer, "TabOpen", globalFBTabOpen);
	Listeners.add(gBrowser.tabContainer, "TabSelectPrevious", globalFBTabSelect);
	Listeners.add(window, 'OpenedFindBar', globalFBOnOpen);
	Listeners.add(window, 'ClosedFindBar', globalFBOnClose);
	
	findBarHiddenState = !gFindBarInitialized || gFindBar.hidden;
	if(!findBarHiddenState) {
		globalFBOnOpen();
	} else {
		globalFBOnClose();
	}
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(gBrowser.tabContainer, "TabOpen", globalFBTabOpen);
	Listeners.remove(gBrowser.tabContainer, "TabSelectPrevious", globalFBTabSelect);
	Listeners.remove(window, 'OpenedFindBar', globalFBOnOpen);
	Listeners.remove(window, 'ClosedFindBar', globalFBOnClose);
	
	for(var tab of gBrowser.tabs) {
		if(tab == gBrowser.mCurrentTab) { continue; }
		
		if(gBrowser.isFindBarInitialized(tab) && !tab.linkedBrowser.finder.findWord) {
			var bar = gBrowser.getFindBar(tab);
			bar.close();
		}
	}
};
