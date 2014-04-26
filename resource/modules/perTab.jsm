moduleAid.VERSION = '1.2.0';

this.assumeLastFindValue = function(e) {
	if(!e.defaultPrevented && gFindBar.hidden && !documentHighlighted && !gFindBar._findField.value) {
		gFindBar._findField.value = gBrowser._lastFindValue;
	}
};

this.assumeLastFindAgainCommandValue = function(e) {
	if(!e.defaultPrevented && !viewSource && gFindBar.hidden && !documentHighlighted && gBrowser._lastFindValue) {
		gFindBar._findField.value = gBrowser._lastFindValue;
	}
};

this.updateLastFindValueOnQuickFind = function(e) {
	// Other cases should be covered by gBrowser.updateCurrentBrowser()
	if(e.type != 'FoundFindBar' || (gFindBar._findMode != gFindBar.FIND_NORMAL && !gFindBar.hidden)) {
		gBrowser._lastFindValue = gFindBar._findField.value;
	}
};

moduleAid.LOADMODULE = function() {
	// If the findbar has no find value, we should assume the last one used, like it does when it is first created
	listenerAid.add(window, 'WillOpenFindBar', assumeLastFindValue);
	// If we are hitting F3 and the find bar is closed, it should use the last globally used value
	listenerAid.add(window, 'WillFindAgainCommand', assumeLastFindAgainCommandValue);
	listenerAid.add(window, 'FoundFindBar', updateLastFindValueOnQuickFind);
	listenerAid.add(window, 'FoundAgain', updateLastFindValueOnQuickFind);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, 'WillOpenFindBar', assumeLastFindValue);
	listenerAid.remove(window, 'WillFindAgainCommand', assumeLastFindAgainCommandValue);
	listenerAid.remove(window, 'FoundFindBar', updateLastFindValueOnQuickFind);
	listenerAid.remove(window, 'FoundAgain', updateLastFindValueOnQuickFind);
};
