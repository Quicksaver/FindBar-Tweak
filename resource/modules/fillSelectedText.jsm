moduleAid.VERSION = '1.2.3';

this.fillSelectedText = function() {
	if(!isCurrentBrowserValid) { return; }
	
	var selText = gFindBar._getInitialSelection();
	if(selText && gFindBar._findField.value != selText && dispatch(gFindBar, { type: 'WillFillSelectedText' })) {
		gFindBar._findField.value = selText;
		linkedPanel._highlightedWord = selText; // Make sure we highlight it if needed
		workAroundFind = true;
		timerAid.init('fillSelectedText', function() {
			try { gFindBar._find(); } catch(ex) { Cu.reportError(ex); } // ensure we reset workAroundFind even if this errors for some reason, it shouldn't though
			workAroundFind = false;
		}, 0);
		
		if(prefAid.fillTextShowFindBar && gFindBar.hidden) {
			gFindBar.open(gFindBar.FIND_TYPEAHEAD);
			if(gFindBar._quickFindTimeout) { window.clearTimeout(gFindBar._quickFindTimeout); }
			gFindBar._quickFindTimeout = window.setTimeout(function(aSelf) { if(aSelf._findMode != aSelf.FIND_NORMAL) aSelf.close(); }, gFindBar._quickFindTimeoutLength, gFindBar);
		}
	}
};

this.fillSelectedTextMouseUp = function(e) {
	if(e.button != 0 || e.target.nodeName == 'HTML') { return; }
	
	fillSelectedText();
};

this.fillSelectedTextKeyUp = function(e) {
	switch(e.keyCode) {
		case e.DOM_VK_PAGE_UP:
		case e.DOM_VK_PAGE_DOWN:
		case e.DOM_VK_END:
		case e.DOM_VK_HOME:
		case e.DOM_VK_LEFT:
		case e.DOM_VK_UP:
		case e.DOM_VK_RIGHT:
		case e.DOM_VK_DOWN:
			fillSelectedText();
			break;
		
		default: return;
        }
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(gBrowser, 'mouseup', fillSelectedTextMouseUp);
	listenerAid.add(gBrowser, 'keyup', fillSelectedTextKeyUp);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gBrowser, 'mouseup', fillSelectedTextMouseUp);
	listenerAid.remove(gBrowser, 'keyup', fillSelectedTextKeyUp);
};
