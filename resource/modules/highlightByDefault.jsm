moduleAid.VERSION = '1.0.0';

this.highlightByDefault = function() {
	gFindBar.getElement("highlight").checked = true;
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(gFindBar, 'OpenedFindBar', highlightByDefault);
	listenerAid.add(gBrowser.tabContainer, "TabSelect", highlightByDefault);
	
	// Sometimes, when restarting firefox, it wouldn't check the box (go figure this one out...)
	aSync(highlightByDefault);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'OpenedFindBar', highlightByDefault);
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", highlightByDefault);
};
