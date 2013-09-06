moduleAid.VERSION = '1.1.0';

this._getFindBarHidden = function() { return !linkedPanel._findBarOpen; };

this.reopenPerTabSelected = function() {
	if(linkedPanel._findBarOpen) {
		gFindBar.open();
	} else {
		gFindBar.close();
	}
};

this.perTabOnOpen = function() {
	if(gFindBar._findMode != gFindBar.FIND_TYPEAHEAD) {
		linkedPanel._findBarOpen = true;
	}
};

this.perTabOnClose = function() {
	linkedPanel._findBarOpen = false;
};

this.assumeLastFindValue = function(e) {
	if(!e.defaultPrevented && gFindBar.hidden && !documentHighlighted && !gFindBar._findField.value) {
		gFindBar._findField.value = gBrowser._lastFindValue;
	}
};

moduleAid.LOADMODULE = function() {
	if(perTabFB) {
		// If the findbar has no find value, we should assume the last one used, like it does when it is first created
		listenerAid.add(window, 'WillOpenFindBar', assumeLastFindValue);
		return;
	}
	
	listenerAid.add(gBrowser.tabContainer, "TabSelect", reopenPerTabSelected);
	
	// Keep capture = true so these go before all others, to update _findBarOpen property first for those methods that depend on it like toggleButtonState()
	listenerAid.add(window, 'OpenedFindBar', perTabOnOpen, true);
	listenerAid.add(window, 'ClosedFindBar', perTabOnClose, true);
	
	if(!gFindBar.hidden) {
		linkedPanel._findBarOpen = true;
	}
};

moduleAid.UNLOADMODULE = function() {
	if(perTabFB) {
		listenerAid.remove(window, 'WillOpenFindBar', assumeLastFindValue);
		return;
	}
	
	// Clean up everything this module may have added to tabs and panels and documents
	for(var t=0; t<gBrowser.mTabs.length; t++) {
		delete $(gBrowser.mTabs[t].linkedPanel)._findBarOpen;
	}
	
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", reopenPerTabSelected);
	listenerAid.remove(window, 'OpenedFindBar', perTabOnOpen, true);
	listenerAid.remove(window, 'ClosedFindBar', perTabOnClose, true);
	
	// Have to set this back
	_getFindBarHidden = function() { return gFindBar.hidden; };
};
