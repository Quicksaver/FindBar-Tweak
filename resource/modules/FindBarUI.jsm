moduleAid.VERSION = '1.0.0';

this.updateButtonsUI = function() {
	if(prefAid.keepButtons && gFindBar._findMode != gFindBar.FIND_NORMAL) {
		var nodes = gFindBar.getElement("findbar-container").childNodes;
		for(var i = 0; i < nodes.length; i++) {
			if(nodes[i].className.indexOf("findbar-find-fast") != -1) { continue; }
			nodes[i].hidden = false;
		}
	}
};

this.updateCSUI = function() {
	if(prefAid.keepButtons && gFindBar._findMode != gFindBar.FIND_NORMAL) {
		gFindBar.getElement("find-case-sensitive").hidden = (gFindBar._typeAheadCaseSensitive != 0 && gFindBar._typeAheadCaseSensitive != 1);
	}
};

this.alwaysFindNormal = function(e) {
	// If the FindBar is already open do nothing, this prevents the hangup when triggering the QuickFind bar when Find bar is open
	if(!gFindBar.hidden) { return; }
	
	// FAYT: option to force normal mode over quick find mode
	if(e.detail == gFindBar.FIND_TYPEAHEAD && prefAid.FAYTmode != 'quick') {
		e.preventDefault();
		e.stopPropagation();
		gFindBar.open(gFindBar.FIND_NORMAL);
	}
};
	
moduleAid.LOADMODULE = function() {
	listenerAid.add(gFindBar, 'UpdatedUIFindBar', updateButtonsUI, false);
	listenerAid.add(gFindBar, 'UpdatedUIFindBar', updateCSUI, false);
	listenerAid.add(gFindBar, 'FoundFindBar', updateCSUI, false);
	listenerAid.add(gFindBar, 'WillOpenFindBar', alwaysFindNormal, true);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'UpdatedUIFindBar', updateButtonsUI, false);
	listenerAid.remove(gFindBar, 'UpdatedUIFindBar', updateCSUI, false);
	listenerAid.remove(gFindBar, 'FoundFindBar', updateCSUI, false);
	listenerAid.remove(gFindBar, 'WillOpenFindBar', alwaysFindNormal, true);
};
