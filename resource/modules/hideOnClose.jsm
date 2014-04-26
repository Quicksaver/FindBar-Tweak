moduleAid.VERSION = '1.2.3';

this.hideTabSelected = function() {
	if(gFindBarInitialized) {
		hideFindBarClosed();
	}
};

this.hideFindBarClosed = function() {
	if(gFindBar.hidden && (documentHighlighted || documentReHighlight)) {
		highlightsOff();
	}
};

this.hideFindBarClosedAnotherTab = function() {
	if(currentTab && currentTab._findBar && trueAttribute(currentTab._findBar.browser.contentDocument.documentElement, 'highlighted')) {
		removeAttribute(currentTab._findBar.browser.contentDocument.documentElement, 'highlighted');
		setAttribute(currentTab._findBar.browser.contentDocument.documentElement, 'reHighlight', 'true');
	}
};

this.hideReHighlighting = function(e) {
	if(gFindBar.hidden) {
		e.preventDefault();
		e.stopPropagation();
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, 'WillReHighlight', hideReHighlighting, true);
	listenerAid.add(window, 'ClosedFindBar', hideFindBarClosed);
	listenerAid.add(window, 'ClosedFindBarAnotherTab', hideFindBarClosedAnotherTab);
	
	if(!viewSource) {
		listenerAid.add(gBrowser.tabContainer, "TabSelect", hideFindBarClosed);
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, 'WillReHighlight', hideReHighlighting, true);
	listenerAid.remove(window, 'ClosedFindBar', hideFindBarClosed);
	listenerAid.remove(window, 'ClosedFindBarAnotherTab', hideFindBarClosedAnotherTab);
	
	if(!viewSource) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", hideFindBarClosed);
	}
};
