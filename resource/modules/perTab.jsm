Modules.VERSION = '1.3.0';

this.assumeLastFindValue = function(e) {
	if(!e.defaultPrevented && gFindBar.hidden && !documentHighlighted && !findQuery) {
		findQuery = gBrowser._lastFindValue;
	}
};

this.assumeLastFindAgainCommandValue = function(e) {
	if(!e.defaultPrevented && !viewSource && gFindBar.hidden && !documentHighlighted && gBrowser._lastFindValue) {
		findQuery = gBrowser._lastFindValue;
	}
};

this.updateLastFindValueOnQuickFind = {
	onFindResult: function(data, aBrowser) {
		if(!gFindBarInitialized || gFindBar.browser != aBrowser) { return; }
		
		// Other cases should be covered by gFindBar._find() and gBrowser.updateCurrentBrowser()
		if(gFindBar._findMode != gFindBar.FIND_NORMAL && !gFindBar.hidden) {
			gBrowser._lastFindValue = findQuery;
		}
	}
};

Modules.LOADMODULE = function() {
	// If the findbar has no find value, we should assume the last one used, like it does when it is first created
	Listeners.add(window, 'WillOpenFindBar', assumeLastFindValue);
	// If we are hitting F3 and the find bar is closed, it should use the last globally used value
	Listeners.add(window, 'WillFindAgainCommand', assumeLastFindAgainCommandValue);
	
	initFindBar('perTab',
		function(bar) { bar.browser.finder.addResultListener(updateLastFindValueOnQuickFind); },
		function(bar) { bar.browser.finder.removeResultListener(updateLastFindValueOnQuickFind); }
	);
};

Modules.UNLOADMODULE = function() {
	deinitFindBar('perTab');
	Listeners.remove(window, 'WillOpenFindBar', assumeLastFindValue);
	Listeners.remove(window, 'WillFindAgainCommand', assumeLastFindAgainCommandValue);
};
