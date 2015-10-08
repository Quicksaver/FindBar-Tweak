// VERSION 2.0.4

this.perTab = {	
	handleEvent: function(e) {
		switch(e.type) {
			case 'WillOpenFindBar':
				if(!e.defaultPrevented && gFindBar.hidden) {
					if(!documentHighlighted && !findQuery) {
						findQuery = gBrowser._lastFindValue;
					}
					gFindBar._findField.selectionStart = 0;
					gFindBar._findField.selectionEnd = findQuery.length;
				}
				break;
			
			case 'WillFindAgainCommand':
				if(!e.defaultPrevented && !viewSource && gFindBar.hidden && !documentHighlighted && gBrowser._lastFindValue) {
					findQuery = gBrowser._lastFindValue;
				}
				break;
		}
	},
	
	// to update the last find value when using quickfind
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
	Listeners.add(window, 'WillOpenFindBar', perTab);
	// If we are hitting F3 and the find bar is closed, it should use the last globally used value
	Listeners.add(window, 'WillFindAgainCommand', perTab);
	
	findbar.init('perTab',
		function(bar) { bar.browser.finder.addResultListener(perTab); },
		function(bar) { if(!bar._destroying) { bar.browser.finder.removeResultListener(perTab); } }
	);
};

Modules.UNLOADMODULE = function() {
	findbar.deinit('perTab');
	Listeners.remove(window, 'WillOpenFindBar', perTab);
	Listeners.remove(window, 'WillFindAgainCommand', perTab);
};
