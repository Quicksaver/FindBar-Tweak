moduleAid.VERSION = '1.2.3';

this.compareRanges = function(aRange, bRange) {
	if(aRange.nodeType || bRange.nodeType) { return false; } // Don't know if this could get here
	if(aRange.startContainer.ownerDocument != bRange.startContainer.ownerDocument) { return false; }
	return (aRange.compareBoundaryPoints(aRange.START_TO_START, bRange) === 0 && aRange.compareBoundaryPoints(aRange.END_TO_END, bRange) === 0);
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
		
		var doc = (browser && browser.contentDocument) ? browser.contentDocument : null;
		if(inPDFJS(browser.contentDocument)) {
			this.innerText = 'PDF.JS '+browser.contentDocument.URL+' '+(new Date().getTime());
		}
		else if(!doc) {
			this.innerText = '';
		}
		else {		
			var body = (doc instanceof Ci.nsIDOMHTMLDocument && doc.body) ? doc.body : doc.documentElement;
			this.innerText = innerText(body);
		}
		
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

// This moves ranges from frames to the end of the results array
this.moveFrameRanges = function(level) {
	var newOrder = [];
	
	for(var l=0; l<level.length; l++) {
		if(typeof(level[l].highlights) != 'undefined') {
			for(var i=0; i<level[l].highlights.length; i++) {
				newOrder.push(level[l].highlights[i]);
			}
		}
		if(typeof(level[l].levels) != 'undefined') {
			newOrder = newOrder.concat(moveFrameRanges(level[l].levels));
		}
	}
	
	return newOrder;
};

// Taken from https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions
this.escapeRegExp = function(str) {
	return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
};

this.getAllRegExpOccurencesOf = function(bar, wordList, aWindow) {
	var ranges = [];
	var levels = [];
	var win = aWindow || tweakGetWindow(bar);
	
	for(var i = 0; win.frames && i < win.frames.length; i++) {
		levels.push(getAllRegExpOccurencesOf(bar, wordList, win.frames[i]));
	}
	
	var doc = win.document;
	if(!tweakGetSelectionController(bar, win) || !doc || !doc.documentElement) {
		return;
	}
	
	var body = (doc instanceof Ci.nsIDOMHTMLDocument && doc.body) ? doc.body : doc.documentElement;
	
	for(var w=0; w<wordList.length; w++) {
		var i = 0;
		
		var searchRange = doc.createRange();
		searchRange.selectNodeContents(body);
		
		var startPt = searchRange.cloneRange();
		startPt.collapse(true);
		
		var endPt = searchRange.cloneRange();
		endPt.collapse(false);
		
		var retRange = null;
		var finder = new tweakFindRange(bar, wordList[w]);
		
		ranges_loop: while((retRange = finder.Find(searchRange, startPt, endPt))) {
			startPt = retRange.cloneRange();
			startPt.collapse(false);
			
			while(i<ranges.length) {
				// No point in adding duplicate ranges, although this should rarely be triggered, if ever
				if(compareRanges(retRange, ranges[i])) { continue ranges_loop; }
				
				var compare = ranges[i].compareBoundaryPoints(retRange.START_TO_START, retRange);
				if(compare >= 0) {
					if(compare > 0 || ranges[i].compareBoundaryPoints(retRange.END_TO_END, retRange) < 0) {
						break;
					}
				}
				
				i++;
			}
			
			ranges.splice(i, 0, retRange);
			i++;
			continue;
		}
	}
	
	return { highlights: ranges, levels: levels };
};

// Selecting with the caret backwards would always reset the caret back to the end of the selection when calling _find() (using the fastFind object),
// we need to work around that so the selection doesn't keep resetting. This happens in the case of fillWithSelection.
// We always return FIND_FOUND in this case because, if the user is selecting in a page, it's obvious the search string exists in it.
this.workAroundFind = false;
this.test = null;
// By doing it this way, we actually only check for mFinder once, if we did this inside each method, we would be checking multiple times unnecessarily.
if(mFinder) {
	this.tweakFastFindNormal = function(browser, val, aLinksOnly, aDrawOutline, aCompare) {
		// Our own Regex search implementation
		if(gFindBar._matchMode <= MATCH_MODE_REGEX) {
			if(!linkedPanel.RegexMatches) {
				linkedPanel.RegexMatches = {
					innerText: '',
					query: '',
					matches: null,
					current: -1,
					mode: MATCH_MODE_REGEX
				};
			}
			
			// We don't need to re-do everything all the time
			if(linkedPanel.RegexMatches.innerText != linkedPanel.innerTextDeep
			|| linkedPanel.RegexMatches.query != val
			|| linkedPanel.RegexMatches.mode != gFindBar._matchMode) {
				linkedPanel.RegexMatches = {
					innerText: linkedPanel.innerTextDeep,
					query: val,
					current: -1,
					mode: gFindBar._matchMode
				};
				
				if(val.search('/[gimy]{0,4}$') > -1) { // has custom flags
					var regex = new RegExp('^/?(.*)/([gimy]{0,4})$');
					var expression = val.replace(regex, '$1');
					var flags = 'gm' + ((val.replace(regex, '$2').search('i') > -1) ? 'i' : ''); // 'g' and 'm' flags are always set, 'i' is checked, 'y' is ignored
				} else {
					var regex = new RegExp('^/?(.*)');
					var expression = val.replace(regex, '$1');
					var flags = 'gm';
				}
				
				var regex = new RegExp(expression, flags);
				
				// If it has no matches, let's escape from here now
				if(regex.test(linkedPanel.innerTextDeep)) {
					var matches = linkedPanel.innerTextDeep.match(regex);
					var wordList = [];
					
					match_loop: for(var m=0; m<matches.length; m++) {
						for(var w=0; w<wordList.length; w++) {
							if(!matches[m] || wordList[w] == matches[m]) {
								continue match_loop;
							}
						}
						
						// This match hasn't been done yet
						wordList.push(matches[m]);
					}
					
					linkedPanel.RegexMatches.matches = moveFrameRanges([getAllRegExpOccurencesOf(gFindBar, wordList)]);
				}
			}
			
			// There are no results for this search
			var matches = linkedPanel.RegexMatches.matches;
			if(matches.length == 0) {
				return gFindBar.nsITypeAheadFind.FIND_NOTFOUND;
			}
			
			// Let's try to start from the current cursor position
			var editableNode = tweakFoundEditable(gFindBar);
			var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
			if(!controller) {
				controller = tweakGetSelectionController(gFindBar, contentWindow);
			}
			var sel = controller.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
			sel.collapseToStart();
			
			var m = 0;
			if(sel.anchorNode) {
				while(m < matches.length) {
					if(matches[m].startContainer.ownerDocument == sel.anchorNode.ownerDocument
					&& matches[m].comparePoint(sel.anchorNode, sel.anchorOffset) == -1) {
						break;
					}
				}
			}
			m = Math.min(m, matches.length);
			
			var aCompare = {
				aFindPrevious: false,
				range: matches[m],
				currentWindow: matches[m].startContainer.ownerDocument.defaultView,
				foundEditable: tweakGetEditableNode(gFindBar, selectRange.startContainer),
				//foundLink: null, // We can't rely on foundLink for this as we don't check this in our ranges
				bar: gFindBar,
				limit: matches.length
			};
			
			return tweakFastFindUntil(browser, matches[m].toString(), aCompare);
		}
		
		// Avoid keeping results in memory when they're not needed anymore
		delete linkedPanel.RegexMatches;
		
		// I don't think _find() or _findAgain() are ever called on other tabs. If they are, I need to change this line
		browser.finder.caseSensitive = (gFindBar._matchMode == MATCH_MODE_CASE_SENSITIVE);
		return browser.finder.fastFind(val, aLinksOnly, aDrawOutline);
	};
	this.tweakFindAgain = function(browser, aFindPrevious, aLinksOnly, aDrawOutline) {
		return browser.finder.findAgain(aFindPrevious, aLinksOnly, aDrawOutline);
	};
	this.tweakFastFindUntil = function(browser, val, aCompare) {
		// I don't think _find() or _findAgain() are ever called on other tabs. If they are, I need to change this line
		browser.finder.caseSensitive = (gFindBar._matchMode == MATCH_MODE_CASE_SENSITIVE);
		
		// This doesn't need to be in the loop
		var controller = (aCompare.foundEditable && aCompare.foundEditable.editor) ? aCompare.foundEditable.editor.selectionController : null;
		if(!controller) {
			controller = tweakGetSelectionController(aCompare.bar, aCompare.currentWindow);
		}
		
		var loops = 0;
		var res = browser.finder.fastFind(val, false, false);
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
		var res = browser.fastFind.find(val, aLinksOnly);
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
			delete panel.RegexMatches;
		}
	}
	else if(viewSource) {
		delete linkedPanel.innerText;
		delete linkedPanel.innerTextDeep;
		delete linkedPanel.RegexMatches;
	}
};
