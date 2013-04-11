moduleAid.VERSION = '1.0.0';

this.doOpenOptions = function() {
	openOptions();
};

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
	// If typing when Find bar is already opened in normal mode, use that instead of "reopening" as quick find mode
	if(!gFindBar.hidden && e.detail == gFindBar.FIND_TYPEAHEAD && gFindBar._findMode == gFindBar.FIND_NORMAL) {
		e.preventDefault();
		e.stopPropagation();
		gFindBar.open(gFindBar.FIND_NORMAL);
		return;
	}
	
	// If the FindBar is already open do nothing, this prevents the hangup when triggering the QuickFind bar when Find bar is open
	if(!gFindBar.hidden) { return; }
	
	// FAYT: option to force normal mode over quick find mode
	if(e.detail == gFindBar.FIND_TYPEAHEAD && prefAid.FAYTmode != 'quick') {
		e.preventDefault();
		e.stopPropagation();
		gFindBar.open(gFindBar.FIND_NORMAL);
	}
};

this.toggleClose = function() {
	toggleAttribute(gFindBar, 'noClose', prefAid.hideClose);
};

this.toggleLabels = function() {
	toggleAttribute(gFindBar, 'hideLabels', prefAid.hideLabels);
};

this.toggleMoveToTop = function() {
	moduleAid.loadIf('moveToTop', prefAid.movetoTop);
};
	
moduleAid.LOADMODULE = function() {
	overlayAid.overlayURI('chrome://browser/content/browser.xul', 'findbar');
	
	listenerAid.add(gFindBar, 'UpdatedUIFindBar', updateButtonsUI, false);
	listenerAid.add(gFindBar, 'UpdatedUIFindBar', updateCSUI, false);
	listenerAid.add(gFindBar, 'FoundFindBar', updateCSUI, false);
	listenerAid.add(gFindBar, 'WillOpenFindBar', alwaysFindNormal, true);
	
	prefAid.listen('hideClose', toggleClose);
	prefAid.listen('hideLabels', toggleLabels);
	prefAid.listen('movetoTop', toggleMoveToTop);
	
	toggleClose();
	toggleLabels();
	toggleMoveToTop();
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('hideClose', toggleClose);
	prefAid.unlisten('hideLabels', toggleLabels);
	prefAid.unlisten('movetoTop', toggleMoveToTop);
	
	moduleAid.unload('moveToTop');
	
	removeAttribute(gFindBar, 'noClose');
	removeAttribute(gFindBar, 'hideLabels');
	
	listenerAid.remove(gFindBar, 'UpdatedUIFindBar', updateButtonsUI, false);
	listenerAid.remove(gFindBar, 'UpdatedUIFindBar', updateCSUI, false);
	listenerAid.remove(gFindBar, 'FoundFindBar', updateCSUI, false);
	listenerAid.remove(gFindBar, 'WillOpenFindBar', alwaysFindNormal, true);
	
	if(UNLOADED) {
		overlayAid.removeOverlayURI('chrome://browser/content/browser.xul', 'findbar');
	}
};
