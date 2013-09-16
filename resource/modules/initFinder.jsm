moduleAid.VERSION = '1.0.0';

// Selecting with the caret backwards would always reset the caret back to the end of the selection when calling _find() (using the fastFind object),
// we need to work around that so the selection doesn't keep resetting. This happens in the case of fillWithSelection.
// We always return FIND_FOUND in this case because, if the user is selecting in a page, it's obvious the search string exists in it.
this.workAroundFind = false;

// By doing it this way, we actually only check for mFinder once, if we did this inside each method, we would be checking multiple times unnecessarily.
if(mFinder) {
	this.tweakFastFindNormal = function(browser, val, onlyLinks) {
		return browser.finder.fastFind(val, onlyLinks);
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
	this.tweakFastFindNormal = function(browser, val, onlyLinks) {
		return browser.fastFind.find(val, onlyLinks);
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
