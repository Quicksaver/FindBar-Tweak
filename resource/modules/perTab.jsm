moduleAid.VERSION = '1.0.0';

this._getFindBarHidden = function() { return (!linkedPanel._findBarOpen); };

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
	listenerAid.add(gFindBar, 'OpenedFindBar', perTabOnOpen);
	listenerAid.add(gFindBar, 'ClosedFindBar', perTabOnClose);
	
	if(!gFindBar.hidden) {
		linkedPanel._findBarOpen = true;
	}
};

moduleAid.UNLOADMODULE = function() {
	// Clean up everything this module may have added to tabs and panels and documents
	for(var t=0; t<gBrowser.mTabs.length; t++) {
		var panel = $(gBrowser.mTabs[t].linkedPanel);
		delete panel._findBarOpen;
	}
	
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", reopenPerTabSelected);
	listenerAid.remove(gFindBar, 'OpenedFindBar', perTabOnOpen);
	listenerAid.remove(gFindBar, 'ClosedFindBar', perTabOnClose);
	
	// Have to set this back
	_getFindBarHidden = function() { return gFindBar.hidden; };
};
