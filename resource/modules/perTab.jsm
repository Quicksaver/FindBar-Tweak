moduleAid.VERSION = '1.0.1';

this._getFindBarHidden = function() { return linkedPanel._findBarHidden; };

this.reopenPerTabSelected = function() {
	if(!linkedPanel._findBarHidden) {
		gFindBar.open();
	} else {
		gFindBar.close();
	}
};

this.perTabOnOpen = function() {
	if(gFindBar._findMode != gFindBar.FIND_TYPEAHEAD) {
		linkedPanel._findBarHidden = true;
	}
};

this.perTabOnClose = function() {
	linkedPanel._findBarHidden = false;
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(gBrowser.tabContainer, "TabSelect", reopenPerTabSelected);
	listenerAid.add(window, 'OpenedFindBar', perTabOnOpen);
	listenerAid.add(window, 'ClosedFindBar', perTabOnClose);
	
	if(!gFindBar.hidden) {
		linkedPanel._findBarHidden = true;
	}
};

moduleAid.UNLOADMODULE = function() {
	// Clean up everything this module may have added to tabs and panels and documents
	for(var t=0; t<gBrowser.mTabs.length; t++) {
		delete $(gBrowser.mTabs[t].linkedPanel)._findBarHidden;
	}
	
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", reopenPerTabSelected);
	listenerAid.remove(window, 'OpenedFindBar', perTabOnOpen);
	listenerAid.remove(window, 'ClosedFindBar', perTabOnClose);
	
	// Have to set this back
	_getFindBarHidden = function() { return gFindBar.hidden; };
};
