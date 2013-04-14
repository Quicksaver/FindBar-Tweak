moduleAid.VERSION = '1.0.1';

this.SHORT_DELAY = 25;
this.LONG_DELAY = 1500;

this.__defineGetter__('contentDocument', function() { return gBrowser.mCurrentBrowser.contentDocument || null; });
this.__defineGetter__('documentHighlighted', function() {
	return (contentDocument && contentDocument.documentElement && contentDocument.documentElement.getAttribute('highlighted') == 'true');
});
this.__defineSetter__('documentHighlighted', function(v) {
	if(contentDocument) { toggleAttribute(contentDocument.documentElement, 'highlighted', v); }
});
this.__defineGetter__('documentReHighlight', function() {
	return (contentDocument && contentDocument.documentElement && contentDocument.documentElement.getAttribute('reHighlight') == 'true');
});
this.__defineSetter__('documentReHighlight', function(v) {
	if(contentDocument) {
		toggleAttribute(contentDocument.documentElement, 'reHighlight', v);
	}
});

this.emptyNoFindUpdating = function(e) {
	if(e.detail.res == gFindBar.nsITypeAheadFind.FIND_NOTFOUND && !gFindBar._findField.value) {
		e.preventDefault();
		e.stopPropagation();
		gFindBar._updateStatusUI(gFindBar.nsITypeAheadFind.FIND_FOUND);
	}
};

this.keepStatusUI = function(e) {
	linkedPanel._statusUI = e.detail.res;
};

this.escHighlights = function(e) {
	if(e.keyCode == e.DOM_VK_ESCAPE) {
		gFindBar.toggleHighlight(false);
	}
};

this.highlightOnClose = function() {
	// Cancel a delayed highlight when closing the find bar
	timerAid.cancel('delayHighlight');
	
	// To remove the grid and the esc key listener if there are no highlights
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
	timerAid.cancel('delayHighlight');
};

// Handler for when switching tabs
this.highlightsTabSelected = function() {
	if(linkedPanel._findWord && (documentHighlighted || documentReHighlight)) {
		gFindBar._findField.value = linkedPanel._findWord;
		gFindBar._enableFindButtons(gFindBar._findField.value);
		if(linkedPanel._statusUI != undefined) {
			gFindBar._updateStatusUI(linkedPanel._statusUI);
		}
		if(findBarHidden) {
			documentReHighlight = false;
		}
	}
	
	if(documentReHighlight) {
		gFindBar.getElement("highlight").checked = documentHighlighted;
		reHighlight(documentHighlighted);
	} else if(linkedPanel._statusUI != undefined && (!linkedPanel._findWord || (!documentHighlighted && !documentReHighlight)) ) {
		gFindBar._updateStatusUI(linkedPanel._statusUI);
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
			reHighlight(documentHighlighted);
		} else {
			setAttribute(doc.documentElement, 'reHighlight', 'true');
		}
	}
};

// Tab progress listeners, handles opening and closing of pages and location changes
this.highlightsProgressListener = {
	// Commands a reHighlight if needed, triggered from history navigation as well
	onLocationChange: function(browser, webProgress, request, location) {
		// Frames don't need to trigger this
		if(webProgress.DOMWindow == browser.contentWindow) {
			// No need to call if there is nothing to find
			if(browser == gBrowser.mCurrentBrowser) {
				if(request && !request.isPending()) {
					reHighlight(documentHighlighted);
				}
			}
			else if(browser.contentDocument) {
				setAttribute(browser.contentDocument.documentElement, 'reHighlight', 'true');
			}
		}
	}
};

// ReDo highlights when hitting FindAgain if necessary (should rarely be triggered actually)
this.highlightsFindAgain = function() {
	if(documentReHighlight) {
		reHighlight(documentHighlighted);
	}
};

// This always calls toggleHighlight() at least once with a false argument, then with a true argument if reDo is true.
// This way we ensure the old highlights are removed before adding new ones.
this.reHighlight = function(reDo) {
	gFindBar.toggleHighlight(false);
	if(reDo && dispatch(gFindBar, { type: 'WillReHighlight' })) {
		gFindBar.toggleHighlight(true);
	}
};

// Add the reHighlight attribute to all tabs
this.reHighlightAll = function() {
	for(var i=0; i<gBrowser.tabContainer.childNodes.length; i++) {
		setAttribute(gBrowser.tabContainer.childNodes[i], 'reHighlight', 'true');
	}
	
	reHighlight(documentHighlighted);
};

this.toggleHighlightByDefault = function() {
	moduleAid.loadIf('highlightByDefault', prefAid.highlightByDefault);
};

this.toggleHideOnClose = function() {
	moduleAid.loadIf('hideOnClose', prefAid.hideWhenFinderHidden);
};

moduleAid.LOADMODULE = function() {
	this.backups = {
		_setHighlightTimeout: gFindBar._setHighlightTimeout
	};
	
	gFindBar._setHighlightTimeout = function() {
		// We want this to be updated regardless of what happens
		linkedPanel._findWord = gFindBar._findField.value;
		
		// Just reset any highlights and the counter if it's not supposed to highlight
		if(!this.getElement("highlight").checked || !this._findField.value) {
			gFindBar.toggleHighlight(false);
			return;
		}
		
		var delay = SHORT_DELAY;
		
		// Delay highlights if search term is too short
		if(this._findField.value && prefAid.minNoDelay > 0 && this._findField.value.length < prefAid.minNoDelay) {
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
		
		var panelCalled = linkedPanel;
		timerAid.init('delayHighlight', function() {
			// We don't want to highlight pages that aren't supposed to be highlighted (happens when switching tabs when delaying highlights)
			if(linkedPanel == panelCalled) {
				reHighlight(gFindBar.getElement("highlight").checked);
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
	
	gFindBar.__findAgain = gFindBar._findAgain;
	gFindBar._findAgain = function(aFindPrevious) {
		if(dispatch(gFindBar, { type: 'WillFindAgain', detail: aFindPrevious })) {
			gFindBar.__findAgain(aFindPrevious);
			dispatch(gFindBar, { type: 'FoundAgain', cancelable: false, detail: aFindPrevious });
		}
	};
	
	listenerAid.add(gFindBar, 'WillUpdateStatusFindBar', emptyNoFindUpdating);
	listenerAid.add(gFindBar, 'UpdatedStatusFindBar', keepStatusUI);
	listenerAid.add(gFindBar, 'ClosedFindBar', highlightOnClose);
	listenerAid.add(gFindBar, 'WillToggleHighlight', highlightsOnToggling);
	listenerAid.add(gFindBar, 'WillFindAgain', highlightsFindAgain);
	listenerAid.add(gBrowser.tabContainer, "TabSelect", highlightsTabSelected);
	listenerAid.add(gBrowser, "DOMContentLoaded", highlightsContentLoaded);
	gBrowser.addTabsProgressListener(highlightsProgressListener);
	observerAid.add(reHighlightAll, 'ReHighlightAll');
	
	moduleAid.load('highlightDoc');
	
	prefAid.listen('highlightByDefault', toggleHighlightByDefault);
	prefAid.listen('hideWhenFinderHidden', toggleHideOnClose);
	
	toggleHighlightByDefault();
	toggleHideOnClose();
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('toggleHideOnClose');
	moduleAid.unload('highlightByDefault');
	
	prefAid.unlisten('highlightByDefault', toggleHighlightByDefault);
	prefAid.unlisten('hideWhenFinderHidden', toggleHideOnClose);
	
	moduleAid.unload('highlightDoc');
	
	// Clean up everything this module may have added to tabs and panels and documents
	for(var t=0; t<gBrowser.mTabs.length; t++) {
		var panel = $(gBrowser.mTabs[t].linkedPanel);
		delete panel._findWord;
		delete panel._statusUI;
		
		if(panel.linkedBrowser && panel.linkedBrowser.contentDocument) {
			listenerAid.remove(panel.linkedBrowser.contentDocument, 'keyup', escHighlights);
			removeAttribute(panel.linkedBrowser.contentDocument.documentElement, 'highlighted');
			removeAttribute(panel.linkedBrowser.contentDocument.documentElement, 'reHighlight');
		}
	}
	
	observerAid.remove(reHighlightAll, 'ReHighlightAll');
	gBrowser.removeTabsProgressListener(highlightsProgressListener);
	listenerAid.remove(gFindBar, 'WillUpdateStatusFindBar', emptyNoFindUpdating);
	listenerAid.remove(gFindBar, 'UpdatedStatusFindBar', keepStatusUI);
	listenerAid.remove(gFindBar, 'ClosedFindBar', highlightOnClose);
	listenerAid.remove(gFindBar, 'WillToggleHighlight', highlightsOnToggling);
	listenerAid.remove(gFindBar, 'WillFindAgain', highlightsFindAgain);
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", highlightsTabSelected);
	listenerAid.remove(gBrowser, "DOMContentLoaded", highlightsContentLoaded);
	
	if(this.backups) {
		gFindBar._setHighlightTimeout = this.backups._setHighlightTimeout;
		delete this.backups;
	}
	
	gFindBar.toggleHighlight = gFindBar._toggleHighlight;
	gFindBar._findAgain = gFindBar.__findAgain;
	delete gFindBar.__findAgain;
	delete gFindBar._toggleHighlight;
};
