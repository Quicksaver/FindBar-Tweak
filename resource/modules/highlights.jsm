moduleAid.VERSION = '1.0.0';

this.SHORT_DELAY = 25;
this.LONG_DELAY = 1500;

this.__defineGetter__('gBrowser', function() { return window.gBrowser; });
this.__defineGetter__('linkedPanel', function() { return $(gBrowser.mCurrentTab.linkedPanel); });
this.__defineGetter__('contentDocument', function() { return gBrowser.mCurrentBrowser.contentDocument || null; });
this.__defineGetter__('documentHighlighted', function() {
	return (contentDocument && contentDocument.documentElement && contentDocument.documentElement.getAttribute('highlighted') == 'true');
});
this.__defineSetter__('documentHighlighted', function(v) {
	if(contentDocument) { toggleAttribute(contentDocument.documentElement, 'highlighted', v); }
});
this.__defineGetter__('documentReHighlight', function() {
	return linkedPanel._reHighlight || (contentDocument && contentDocument.documentElement && contentDocument.documentElement.getAttribute('reHighlight') == 'true');
});
this.__defineSetter__('documentReHighlight', function(v) {
	if(contentDocument) {
		toggleAttribute(contentDocument.documentElement, 'reHighlight', v);
		if(!v) { linkedPanel._reHighlight = false; }
	}
});

this.emptyNoFindUpdating = function(e) {
	if(e.detail.res == gFindBar.nsITypeAheadFind.FIND_NOTFOUND && !gFindBar._findField.value) {
		e.preventDefault();
		e.stopPropagation();
		gFindBar._updateStatusUI(gFindBar.nsITypeAheadFind.FIND_FOUND);
	}
};

this.escHighlights = function(e) {
	if(e.keyCode == e.DOM_VK_ESCAPE) {
		gFindBar.toggleHighlight(false);
	}
};

this.highlightOnClose = function() {
	// Cancel a delayed highlight when closing the find bar
	if(linkedPanel._delayHighlight) {
		linkedPanel._delayHighlight.cancel();
	}
	
	// To remove the grid and the esc key listener if there are no highlights or when commanded by the hideWhenFinderHidden preference
	if(documentHighlighted && (!gFindBar._findField.value || linkedPanel._notFoundHighlights)) {
		gFindBar.toggleHighlight(false);
	}
};

this.highlightsOnToggling = function(e) {
	var aHighlight = e.detail;
	// Remove highlights when hitting Esc
	if(aHighlight) { // this is aHighlight
		listenerAid.add(contentDocument, 'keyup', escHighlights);
	} else {
		listenerAid.remove(contentDocument, 'keyup', escHighlights);
	}
	
	documentHighlighted = aHighlight;
	documentReHighlight = false;
	
	// This is only used by gFindBar.close(), to remove the grid and the esc event if they're not needed
	linkedPanel._notFoundHighlights = false;
	
	// Make sure we cancel any highlight timer that might be running
	if(linkedPanel._delayHighlight) {
		linkedPanel._delayHighlight.cancel();
	}
};

// Handler for when switching tabs
this.highlightsTabSelected = function() {
	if(linkedPanel._findWord && (documentHighlighted || documentReHighlight)) {
		gFindBar._findField.value = linkedPanel._findWord;
		gFindBar._enableFindButtons(gFindBar._findField.value);
		if(gFindBar.hidden) {
			gFindBar.toggleHighlight(false);
		}
	}
	
	if(documentReHighlight) {
		gFindBar.getElement("highlight").checked = documentHighlighted;
		reHighlight(documentHighlighted);
	}
};

// Commands a reHighlight if needed on any tab, triggered from frames as well
// Mainly for back/forward actions
this.highlightsContentLoaded = function(e) {
	// this is the content document of the loaded page.
	var doc = e.originalTarget;
	if(doc instanceof window.HTMLDocument) {
		// is this an inner frame?
		// Find the root document:
		while(doc.defaultView.frameElement) {
			doc = doc.defaultView.frameElement.ownerDocument;
		}
		
		if(doc == contentDocument) {
			reHighlight(documentHighlighted && (!gFindBar.hidden || !prefAid.hideWhenFinderHidden));
		} else {
			setAttribute(doc.documentElement, 'reHighlight', 'true');
		}
	}
};

// This always calls toggleHighlight() at least once with a false argument, then with a true argument if reDo is true.
// This way we ensure the old highlights are removed before adding new ones.
this.reHighlight = function(reDo) {
	gFindBar.toggleHighlight(false);
	if(reDo) {
		gFindBar.toggleHighlight(true);
	}
};

// Add the reHighlight attribute to all tabs
this.reHighlightAll = function() {
	for(var i=0; i<gBrowser.tabContainer.childNodes.length; i++) {
		gBrowser.tabContainer.childNodes[i]._reHighlight = true;
	}
	
	reHighlight(documentHighlighted);
};

this.toggleHighlightByDefault = function() {
	moduleAid.loadIf('highlightByDefault', prefAid.highlightByDefault);
};

moduleAid.LOADMODULE = function() {
	this.backups = {
		_setHighlightTimeout: gFindBar._setHighlightTimeout
	};
	
	gFindBar._setHighlightTimeout = function(aValue) {
		// Just reset any highlights and the counter if it's not supposed to highlight
		if(!this.getElement("highlight").checked && this._findField.value.length == 0) {
			gFindBar.toggleHighlight(false);
			return;
		}
		
		var delay = SHORT_DELAY;
		
		// Delay highlights if search term is too short
		if(prefAid.minNoDelay > 0 && this._findField.value.length < prefAid.minNoDelay) {
			delay = LONG_DELAY;
		}
			
		// Remove highlights when hitting Esc
		// Needs to be both in here and in toggleHighlight() because the delay could prevent it from being set
		if(!documentHighlighted) {
			listenerAid.add(contentDocument, 'keyup', escHighlights);
		}
		
		// Make sure it triggers the highlight if we switch tabs meanwhile
		documentHighlighted = true;
		documentReHighlight = true;
		linkedPanel._findWord = gFindBar._findField.value;
		
		linkedPanel._delayHighlight = timerAid.create(function(timer) {
			// We don't want to highlight pages that aren't supposed to be highlighted (happens when switching tabs when delaying highlights)
			if(linkedPanel._delayHighlight && linkedPanel._delayHighlight.timer == timer) {
				reHighlight(true);
			}
		}, delay);
	};
	
	gFindBar._toggleHighlight = gFindBar.toggleHighlight;
	gFindBar.toggleHighlight = function(aHighlight) {
		if(dispatch(gFindBar, { type: 'WillToggleHighlight', detail: aHighlight })) {
			gFindBar._toggleHighlight(aHighlight);
			dispatch(gFindBar, { type: 'ToggledHighlight', detail: aHighlight, cancelable: false });
		}
	};
	
	listenerAid.add(gFindBar, 'WillUpdateStatusFindBar', emptyNoFindUpdating);
	listenerAid.add(gFindBar, 'ClosedFindBar', highlightOnClose);
	listenerAid.add(gFindBar, 'WillToggleHighlight', highlightsOnToggling);
	listenerAid.add(gBrowser.tabContainer, "TabSelect", highlightsTabSelected);
	listenerAid.add(gBrowser, "DOMContentLoaded", highlightsContentLoaded);
	
	observerAid.add(reHighlightAll, 'ReHighlightAll');
	
	prefAid.listen('highlightByDefault', toggleHighlightByDefault);
	
	toggleHighlightByDefault();
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('highlightByDefault');
	
	prefAid.unlisten('highlightByDefault', toggleHighlightByDefault);
	
	// Clean up everything this module may have added to tabs and panels and documents
	for(var t=0; t<gBrowser.mTabs.length; t++) {
		var panel = $(gBrowser.mTabs[t].linkedPanel);
		if(panel._delayHighlight) { panel._delayHighlight.cancel(); }
		delete panel._delayHighlight;
		delete panel._findWord;
		
		if(panel.linkedBrowser && panel.linkedBrowser.contentDocument) {
			listenerAid.remove(panel.linkedBrowser.contentDocument, 'keyup', escHighlights);
			removeAttribute(panel.linkedBrowser.contentDocument.documentElement, 'highlighted');
			removeAttribute(panel.linkedBrowser.contentDocument.documentElement, 'reHighlight');
		}
	}
	
	observerAid.remove(reHighlightAll, 'ReHighlightAll');
	
	listenerAid.remove(gFindBar, 'WillUpdateStatusFindBar', emptyNoFindUpdating);
	listenerAid.remove(gFindBar, 'ClosedFindBar', highlightOnClose);
	listenerAid.remove(gFindBar, 'WillToggleHighlight', highlightsOnToggling);
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", highlightsTabSelected);
	listenerAid.remove(gBrowser, "DOMContentLoaded", highlightsContentLoaded);
	
	if(this.backups) {
		gFindBar._setHighlightTimeout = this.backups._setHighlightTimeout;
		delete this.backups;
	}
	
	gFindBar.toggleHighlight = gFindBar._toggleHighlight;
	delete gFindBar._toggleHighlight;
};
