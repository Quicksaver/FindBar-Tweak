moduleAid.VERSION = '1.1.0';

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

// Selecting with the caret backwards would always reset the caret back to the end of the selection when calling _find() (using the fastFind object),
// we need to work around that so the selection doesn't keep resetting. This happens in the case of fillWithSelection.
// We always return FIND_FOUND in this case because, if the user is selecting in a page, it's obvious the search string exists in it.
this.workAroundFind = false;

// By doing it this way, we actually only check for mFinder once, if we did this inside each method, we would be checking multiple times unnecessarily.
if(mFinder) {
	this.tweakFastFindNormal = function(browser, val, onlyLinks, aCompare) {
		if(!aCompare) { return browser.finder.fastFind(val, onlyLinks); }
		
		// This doesn't need to be in the loop
		var controller = (aCompare.foundEditable && aCompare.foundEditable.editor) ? aCompare.foundEditable.editor.selectionController : null;
		if(!controller) {
			controller = tweakGetSelectionController(aCompare.bar, aCompare.currentWindow);
		}
		
		var loops = 0;
		var res = browser.finder.fastFind(val, onlyLinks);
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
	this.tweakFindAgain = function(browser, aFindPrevious, onlyLinks) {
		return browser.finder.findAgain(aFindPrevious, onlyLinks);
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
	this.tweakFastFindNormal = function(browser, val, onlyLinks, aCompare) {
		if(!aCompare) { return browser.fastFind.find(val, onlyLinks); }
		
		// This doesn't need to be in the loop
		var controller = (aCompare.foundEditable && aCompare.foundEditable.editor) ? aCompare.foundEditable.editor.selectionController : null;
		if(!controller) {
			controller = tweakGetSelectionController(aCompare.bar, aCompare.currentWindow);
		}
		
		var loops = 0;
		var res = browser.fastFind.find(val, onlyLinks);
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
	this.tweakFindAgain = function(browser, aFindPrevious, onlyLinks) {
		return browser.fastFind.findAgain(aFindPrevious, onlyLinks);
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

this.tweakFastFind = function(browser, val, onlyLinks) {
	if(workAroundFind) { return Ci.nsITypeAheadFind.FIND_FOUND; }
	return tweakFastFindNormal(browser, val, onlyLinks);
};

this.tweakFindRange = function(bar, aWord, caseSensitive) {
	this._finder = Cc["@mozilla.org/embedcomp/rangefind;1"].createInstance().QueryInterface(Ci.nsIFind);
	this.word = aWord;
	if(typeof(caseSensitive) == 'undefined') { this.setCaseSensitive(bar); }
	else { this._finder.caseSensitive = caseSensitive; }
};

moduleAid.LOADMODULE = function() {
	// By doing it this way, we actually only check for mFinder once, if we did this inside each method, we would be checking multiple times unnecessarily.
	if(mFinder) {
		tweakFindRange.prototype.setCaseSensitive = function(bar) {
			this._finder.caseSensitive = bar.browser.finder._fastFind.caseSensitive;
		};
	}
	else {
		tweakFindRange.prototype.setCaseSensitive = function(bar) {
			this._finder.caseSensitive = bar._shouldBeCaseSensitive(this.word);
		};
	}
	
	tweakFindRange.prototype.Find = function(searchRange, startPt, endPt) {
		return this._finder.Find(this.word, searchRange, startPt, endPt);
	};
};
