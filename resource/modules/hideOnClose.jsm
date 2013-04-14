moduleAid.VERSION = '1.0.2';

this.hideTabSelected = function() {
	if(findBarHidden && (documentHighlighted || documentReHighlight)) {
		gFindBar.toggleHighlight(false);
	}
};

this.hideReHighlighting = function(e) {
	if(gFindBar.hidden) {
		e.preventDefault();
		e.stopPropagation();
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(gBrowser.tabContainer, "TabSelect", hideTabSelected);
	listenerAid.add(gFindBar, 'WillReHighlight', hideReHighlighting, true);
	listenerAid.add(gFindBar, 'ClosedFindBar', hideTabSelected);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", hideTabSelected);
	listenerAid.remove(gFindBar, 'WillReHighlight', hideReHighlighting, true);
	listenerAid.remove(gFindBar, 'ClosedFindBar', hideTabSelected);
};
