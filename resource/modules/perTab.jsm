moduleAid.VERSION = '1.0.3';

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

moduleAid.LOADMODULE = function() {
	listenerAid.add(gBrowser.tabContainer, "TabSelect", reopenPerTabSelected);
	
	// Keep capture = true so these go before all others, to update _findBarOpen property first for those methods that depend on it like toggleButtonState()
	listenerAid.add(window, 'OpenedFindBar', perTabOnOpen, true);
	listenerAid.add(window, 'ClosedFindBar', perTabOnClose, true);
	
	if(!gFindBar.hidden) {
		linkedPanel._findBarOpen = true;
	}
};

moduleAid.UNLOADMODULE = function() {
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
