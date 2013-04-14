moduleAid.VERSION = '1.1.0';

this.hideTabSelected = function() {
	if(findBarHidden && (documentHighlighted || documentReHighlight)) {
		gFindBar.toggleHighlight(false);
	}
};

this.hideFindBarClosed = function() {
	if(gFindBar.hidden && (documentHighlighted || documentReHighlight)) {
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
	listenerAid.add(gFindBar, 'WillReHighlight', hideReHighlighting, true);
	listenerAid.add(gFindBar, 'ClosedFindBar', hideFindBarClosed);
	
	if(!viewSource) {
		listenerAid.add(gBrowser.tabContainer, "TabSelect", hideTabSelected);
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'WillReHighlight', hideReHighlighting, true);
	listenerAid.remove(gFindBar, 'ClosedFindBar', hideFindBarClosed);
	
	if(!viewSource) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", hideTabSelected);
	}
};
