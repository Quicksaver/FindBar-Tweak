moduleAid.VERSION = '1.2.0';

this.compareRanges = function(aRange, bRange) {
	if(aRange.nodeType || bRange.nodeType) { return false; } // Don't know if this could get here
	if(aRange.startContainer == bRange.startContainer
	&& aRange.endContainer == bRange.endContainer
	&& aRange.startOffset == bRange.startOffset
	&& aRange.endOffset == bRange.endOffset) {
		return true;
	}
	return false;
};

// The following innerText update methods are for properly updating the highlights and the findbar only when it is changed.

// This is a very fast step (can do this 40-50x ~= 0ms), so it shouldn't affect browser performance at all to do it in every onStateChange
this.resetInnerText = function(panel) {
	if(!panel) { return; }
	
	delete panel.innerText;
	delete panel.innerTextDeep;
	
	panel.__defineGetter__('innerText', function() {
		delete this.innerText;
		var browser = this.querySelectorAll('browser')[0];
		var doc = (browser && browser.contentDocument && !inPDFJS(browser.contentDocument)) ? browser.contentDocument : null;
		var body = (doc && doc instanceof Ci.nsIDOMHTMLDocument && doc.body) ? doc.body : doc.documentElement;
		this.innerText = innerText(body);
		return this.innerText;
	});
	
	panel.__defineGetter__('innerTextDeep', function() {
		delete this.innerTextDeep;
		this.innerTextDeep = this.innerText;
		
		var browser = this.querySelectorAll('browser')[0];
		if(browser && browser.contentDocument && !inPDFJS(browser.contentDocument)) {
			this.innerTextDeep += getInnerTextFrames(browser.contentWindow);
		}
		
		return this.innerTextDeep;
	});
};

this.getInnerTextFrames = function(aWindow) {
	var text = '';
	for(var i=0; aWindow.frames && i<aWindow.frames.length; i++) {
		var doc = (aWindow.frames[i]) ? aWindow.frames[i].document : null;
		if(!doc) { continue; }
		var body = (doc instanceof Ci.nsIDOMHTMLDocument && doc.body) ? doc.body : doc.documentElement;
		text += innerText(body);
		text += getInnerTextFrames(aWindow.frames[i]);
	}
	return text;
};

// Most of the update work fall either here or in onStateChange events, which seem to be the most reliable to track for;
// onLocationChange doesn't always work for dynamically loaded pages.
this.innerTextContentLoaded = function(e) {
	// this is the content document of the loaded page.
	var doc = e.originalTarget;
	if(doc instanceof window.HTMLDocument) {
		// is this an inner frame?
		// Find the root document:
		while(doc.defaultView.frameElement) {
			doc = doc.defaultView.frameElement.ownerDocument;
		}
		
		var panel = gBrowser._getTabForContentWindow(doc.defaultView);
		if(panel && panel.linkedPanel) {
			panel = $(panel.linkedPanel);
		}
		
		resetInnerText(panel);
	}
};

this.innerTextProgressListener = {
	onStateChange: function(browser, webProgress, request, aStateFlags, aStatus) {
		if(!webProgress.isLoadingDocument && webProgress.DOMWindow == browser.contentWindow && browser.contentDocument) {
			var doc = browser.contentDocument;
			while(doc.defaultView.frameElement) {
				doc = doc.defaultView.frameElement.ownerDocument;
			}
			
			var panel = gBrowser._getTabForContentWindow(doc.defaultView);
			if(panel && panel.linkedPanel) {
				panel = $(panel.linkedPanel);
			}
			
			resetInnerText(panel);
		}
	}
};

// Selecting with the caret backwards would always reset the caret back to the end of the selection when calling _find() (using the fastFind object),
// we need to work around that so the selection doesn't keep resetting. This happens in the case of fillWithSelection.
// We always return FIND_FOUND in this case because, if the user is selecting in a page, it's obvious the search string exists in it.
this.workAroundFind = false;

// By doing it this way, we actually only check for mFinder once, if we did this inside each method, we would be checking multiple times unnecessarily.
if(mFinder) {
	this.tweakFastFindNormal = function(browser, val, aLinksOnly, aDrawOutline, aCompare) {
		// I don't think _find() or _findAgain() are ever called on other tabs. If they are, I need to change this line
		browser.finder.caseSensitive = (gFindBar._matchMode == MATCH_MODE_CASE_SENSITIVE);
		if(!aCompare) { return browser.finder.fastFind(val, aLinksOnly, aDrawOutline); }
		
		// This doesn't need to be in the loop
		var controller = (aCompare.foundEditable && aCompare.foundEditable.editor) ? aCompare.foundEditable.editor.selectionController : null;
		if(!controller) {
			controller = tweakGetSelectionController(aCompare.bar, aCompare.currentWindow);
		}
		
		var loops = 0;
		var res = browser.finder.fastFind(val);
		while(loops < aCompare.limit) {
			if(res == browser.finder._fastFind.FIND_NOTFOUND) {
				break;
			}
			
			if(browser.finder._fastFind.currentWindow == aCompare.currentWindow
			// && browser.fastFind.foundLink == aCompare.foundLink // Not a good idea to filter for this
			&& browser.finder._fastFind.foundEditable == aCompare.foundEditable) {
				var sel = controller.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
				if(sel.rangeCount == 1 && compareRanges(aCompare.range, sel.getRangeAt(0))) {
					return res;
				}
			}
			
			loops++; // We can't rely on FIND_WRAPPED status for pages with frames
			res = tweakFindAgain(browser, aCompare.aFindPrevious);
		}
		return browser.finder._fastFind.FIND_NOTFOUND;
	};
	this.tweakFindAgain = function(browser, aFindPrevious, aLinksOnly, aDrawOutline) {
		return browser.finder.findAgain(aFindPrevious, aLinksOnly, aDrawOutline);
	};
	this.tweakGetSelectionController = function(bar, win) {
		return bar.browser.finder._getSelectionController(win);
	};
	this.tweakGetWindow = function(bar) {
		return bar.browser.finder._getWindow();
	};
	this.tweakHighlightRange = function(bar, retRange, controller) {
		bar.browser.finder._highlightRange(retRange, controller);
	};
	this.tweakGetEditableNode = function(bar, aNode) {
		return bar.browser.finder._getEditableNode(aNode);
	};
	this.tweakGetEditors = function(bar) {
		return bar.browser.finder._editors;
	};
	this.tweakUnhookListenersAtIndex = function(bar, x) {
		bar.browser.finder._unhookListenersAtIndex(x);
	};
	this.tweakFoundEditable = function(bar, val) {
		if(typeof(val) != 'undefined') { bar.browser.finder._fastFind.foundEditable = val; }
		return bar.browser.finder._fastFind.foundEditable;
	};
}
else {
	this.tweakFastFindNormal = function(browser, val, aLinksOnly, aDrawOutline, aCompare) {
		// I don't think _find() or _findAgain() are ever called on other tabs. If they are, I need to change this line
		browser.fastFind.caseSensitive = (gFindBar._matchMode == MATCH_MODE_CASE_SENSITIVE);
		if(!aCompare) { return browser.fastFind.find(val, aLinksOnly); }
		
		// This doesn't need to be in the loop
		var controller = (aCompare.foundEditable && aCompare.foundEditable.editor) ? aCompare.foundEditable.editor.selectionController : null;
		if(!controller) {
			controller = tweakGetSelectionController(aCompare.bar, aCompare.currentWindow);
		}
		
		var loops = 0;
		var res = browser.fastFind.find(val);
		while(loops < aCompare.limit) {
			if(res == browser._fastFind.FIND_NOTFOUND) {
				break;
			}
			
			if(browser.fastFind.currentWindow == aCompare.currentWindow
			// && browser.fastFind.foundLink == aCompare.foundLink // Not a good idea to filter for this
			&& browser.fastFind.foundEditable == aCompare.foundEditable) {
				var sel = controller.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
				if(sel.rangeCount == 1 && compareRanges(aCompare.range, sel.getRangeAt(0))) {
					return res;
				}
			}
			
			loops++; // We can't rely on FIND_WRAPPED status for pages with frames
			res = tweakFindAgain(browser, aCompare.aFindPrevious);
		}
		return browser._fastFind.FIND_NOTFOUND;
	};
	this.tweakFindAgain = function(browser, aFindPrevious, aLinksOnly, aDrawOutline) {
		return browser.fastFind.findAgain(aFindPrevious, aLinksOnly);
	};
	this.tweakGetSelectionController = function(bar, win) {
		return bar._getSelectionController(win);
	};
	this.tweakGetWindow = function(bar) {
		return bar.browser.contentWindow;
	};
	this.tweakHighlightRange = function(bar, retRange, controller) {
		bar._highlight(retRange, controller);
	};
	this.tweakGetEditableNode = function(bar, aNode) {
		return bar._getEditableNode(aNode);
	};
	this.tweakGetEditors = function(bar) {
		return bar._editors;
	};
	this.tweakUnhookListenersAtIndex = function(bar, x) {
		bar._unhookListenersAtIndex(x);
	};
	this.tweakFoundEditable = function(bar, val) {
		if(typeof(val) != 'undefined') { bar.browser._fastFind.foundEditable = val; }
		return bar.browser._fastFind.foundEditable;
	};
}

this.tweakFastFind = function(browser, val, aLinksOnly, aDrawOutline) {
	if(workAroundFind) { return Ci.nsITypeAheadFind.FIND_FOUND; }
	return tweakFastFindNormal(browser, val, aLinksOnly, aDrawOutline);
};

this.tweakFindRange = function(bar, aWord) {
	this._finder = Cc["@mozilla.org/embedcomp/rangefind;1"].createInstance().QueryInterface(Ci.nsIFind);
	this._finder.caseSensitive = (bar._matchMode == MATCH_MODE_CASE_SENSITIVE);
	this.word = aWord;
};

this.getLinkElement = function(aNode) {
	while(aNode) {
		if(aNode instanceof Ci.nsIDOMHTMLAnchorElement) {
			return aNode;
		}
		aNode = aNode.parentNode;
	}
	return null;
};

moduleAid.LOADMODULE = function() {
	tweakFindRange.prototype.Find = function(searchRange, startPt, endPt) {
		return this._finder.Find(this.word, searchRange, startPt, endPt);
	};
	
	if(!viewSource && !FITFull) {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			resetInnerText($(gBrowser.mTabs[t].linkedPanel));
		}
		
		listenerAid.add(gBrowser, "DOMContentLoaded", innerTextContentLoaded);
		gBrowser.addTabsProgressListener(innerTextProgressListener);
	}
	else if(viewSource) {
		resetInnerText(linkedPanel);
	}
};

moduleAid.UNLOADMODULE = function() {
	if(!viewSource && !FITFull) {
		listenerAid.remove(gBrowser, "DOMContentLoaded", innerTextContentLoaded);
		gBrowser.removeTabsProgressListener(innerTextProgressListener);
		
		// Clean up everything this module may have added to tabs and panels and documents
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var panel = $(gBrowser.mTabs[t].linkedPanel);
			delete panel.innerText;
			delete panel.innerTextDeep;
		}
	}
	else if(viewSource) {
		delete linkedPanel.innerText;
		delete linkedPanel.innerTextDeep;
	}
};
