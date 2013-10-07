moduleAid.VERSION = '1.0.4';

this.findBarHiddenState = true;

this.globalFBOnOpen = function() {
	// Quick Find shouldn't be global
	if(gFindBar._findMode != gFindBar.FIND_NORMAL) { return; }
	
	findBarHiddenState = false;
	timerAid.cancel('globalFBOnClose');
	timerAid.init('globalFBOnOpen', globalFBOpenAll, 50);
};

this.globalFBOpenAll = function() {
	for(var t=0; t<gBrowser.mTabs.length; t++) {
		var bar = gBrowser.getFindBar(gBrowser.mTabs[t]);
		if(bar == gFindBar && !gFindBar.hidden) { continue; }
		bar.open();
	}
};

this.globalFBOnClose = function() {
	findBarHiddenState = true;
	timerAid.cancel('globalFBOnOpen');
	timerAid.init('globalFBOnClose', globalFBCloseAll, 50);
};

this.globalFBCloseAll = function() {
	for(var t=0; t<gBrowser.mTabs.length; t++) {
		if(gBrowser.mTabs[t]._findBar) {
			var bar = gBrowser.getFindBar(gBrowser.mTabs[t]);
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
	
	// Copy the values of the findField from one tab to another if there hasn't been a search run in that tab yet
	if(currentTab && currentTab._findBar && (!linkedPanel._findWord || (gFindBar.hidden && !documentHighlighted) || gFindBar._keepCurrentValue)) {
		gFindBar._findField.value = currentTab._findBar._findField.value;
		gFindBar.getElement('highlight').checked = currentTab._findBar.getElement('highlight').checked;
		gFindBar._buttonMode.updateMatchMode(currentTab._findBar._matchMode);
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(gBrowser.tabContainer, "TabOpen", globalFBTabOpen);
	listenerAid.add(gBrowser.tabContainer, "TabSelectPrevious", globalFBTabSelect);
	listenerAid.add(window, 'OpenedFindBar', globalFBOnOpen);
	listenerAid.add(window, 'ClosedFindBar', globalFBOnClose);
	
	findBarHiddenState = !gFindBarInitialized || gFindBar.hidden;
	if(!findBarHiddenState) {
		globalFBOnOpen();
	} else {
		globalFBOnClose();
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gBrowser.tabContainer, "TabOpen", globalFBTabOpen);
	listenerAid.remove(gBrowser.tabContainer, "TabSelectPrevious", globalFBTabSelect);
	listenerAid.remove(window, 'OpenedFindBar', globalFBOnOpen);
	listenerAid.remove(window, 'ClosedFindBar', globalFBOnClose);
	
	for(var t=0; t<gBrowser.mTabs.length; t++) {
		if(gBrowser.mTabs[t] == gBrowser.mCurrentTab) { continue; }
		
		if(gBrowser.mTabs[t]._findbar && !$(gBrowser.mTabs[t].linkedPanel)._findWord) {
			var bar = gBrowser.mTabs[t]._findbar;
			bar.close();
		}
	}
};
