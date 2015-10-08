// VERSION 1.2.4

this.hideTabSelected = function() {
	if(gFindBarInitialized) {
		hideFindBarClosed();
	}
};

this.hideFindBarClosed = function() {
	if(gFindBar.hidden && (documentHighlighted || documentReHighlight)) {
		highlights.off();
	}
};

this.hideFindBarClosedBackground = function(e) {
	if(e.originalTarget.browser.finder.documentHighlighted) {
		e.originalTarget.browser.finder.documentHighlighted = false;
		e.originalTarget.browser.finder.documentReHighlight = true;
	}
};

this.hideReHighlighting = function(e) {
	if(gFindBar.hidden) {
		e.preventDefault();
		e.stopPropagation();
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(window, 'WillReHighlight', hideReHighlighting, true);
	Listeners.add(window, 'ClosedFindBar', hideFindBarClosed);
	Listeners.add(window, 'ClosedFindBarBackground', hideFindBarClosedBackground);
	
	if(!viewSource) {
		Listeners.add(gBrowser.tabContainer, "TabSelect", hideFindBarClosed);
	}
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, 'WillReHighlight', hideReHighlighting, true);
	Listeners.remove(window, 'ClosedFindBar', hideFindBarClosed);
	Listeners.remove(window, 'ClosedFindBarBackground', hideFindBarClosedBackground);
	
	if(!viewSource) {
		Listeners.remove(gBrowser.tabContainer, "TabSelect", hideFindBarClosed);
	}
};
