Modules.VERSION = '1.0.16';

this.__defineGetter__('isPDFJS', function() { return Finder.isPDFJS; });

this.__defineGetter__('documentHighlighted', function() { return Finder.documentHighlighted; });
this.__defineGetter__('documentReHighlight', function() { return Finder.documentReHighlight; });
this.__defineGetter__('highlightedWord', function() { return Finder.highlightedWord; });
this.__defineGetter__('highlightedText', function() { return Finder.highlightedText; });

this.__defineSetter__('documentHighlighted', function(v) { return Finder.documentHighlighted = v; });
this.__defineSetter__('documentReHighlight', function(v) { return Finder.documentReHighlight = v; });
this.__defineSetter__('highlightedWord', function(v) { return Finder.highlightedWord = v; });
this.__defineSetter__('highlightedText', function(v) { return Finder.highlightedText = v; });

// Because I can't access Finder.jsm in its active context (for some reason), I need to completely replace it.
// A lot of the code here is based on http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/Finder.jsm

XPCOMUtils.defineLazyModuleGetter(this, "Rect", "resource://gre/modules/Geometry.jsm");
XPCOMUtils.defineLazyServiceGetter(this, "Clipboard", "@mozilla.org/widget/clipboard;1", "nsIClipboard");
XPCOMUtils.defineLazyServiceGetter(this, "ClipboardHelper", "@mozilla.org/widget/clipboardhelper;1", "nsIClipboardHelper");
XPCOMUtils.defineLazyServiceGetter(this, "TextToSubURIService", "@mozilla.org/intl/texttosuburi;1", "nsITextToSubURI");

XPCOMUtils.defineLazyGetter(this, "GetClipboardSearchString",
	() => Cu.import("resource://gre/modules/Finder.jsm", {}).GetClipboardSearchString
);

this.Finder = {
	_fastFind: null,
	_docShell: null,
	_listeners: new Set(),
	_previousLink: null,
	_searchString: null,
	
	kHighlightIterationMax: 0,
	
	init: function(docShell) {
		this._fastFind = Cc["@mozilla.org/typeaheadfind;1"].createInstance(Ci.nsITypeAheadFind);
		this._fastFind.init(docShell);
		this._docShell = docShell;
		WebProgress.add(this, Ci.nsIWebProgress.NOTIFY_ALL);
		DOMContentLoaded.add(this);
	},
	
	deinit: function() {
		WebProgress.remove(this, Ci.nsIWebProgress.NOTIFY_ALL);
		DOMContentLoaded.remove(this);
		
		if(document instanceof Ci.nsIDOMHTMLDocument) {
			// can't load attributes module, so leave these in
			document.documentElement.removeAttribute(objName+'-highlighted');
			document.documentElement.removeAttribute(objName+'-reHighlight');
		}
	},
	
	addResultListener: function(aListener) {
		this._listeners.add(aListener);
	},
	
	removeResultListener: function(aListener) {
		this._listeners.delete(aListener);
	},
	
	_notify: function(aSearchString, aResult, aFindBackwards, aDrawOutline, aStoreResult = true) {
		if(aStoreResult) {
			this._searchString = aSearchString;
			this.clipboardSearchString = aSearchString
		}
		this._outlineLink(aDrawOutline);
		
		let foundLink = this._fastFind.foundLink;
		let linkURL = null;
		if(foundLink) {
			let docCharset = null;
			let ownerDoc = foundLink.ownerDocument;
			if(ownerDoc) {
				docCharset = ownerDoc.characterSet;
			}
			
			linkURL = TextToSubURIService.unEscapeURIForUI(docCharset, foundLink.href);
		}
		
		let data = {
			result: aResult,
			findBackwards: aFindBackwards,
			linkURL: linkURL,
			rect: this._getResultRect(),
			searchString: this._searchString,
			storeResult: aStoreResult
		};
		
		for(let l of this._listeners) {
			if(l.onFindResult) {
				try { l.onFindResult(data); }
				catch(ex) { Cu.reportError(ex); }
			}
		}
	},
	
	_notifyFindAgain: function(aFindBackwards) {
		for(let l of this._listeners) {
			if(l.onFindAgain) {
				try { l.onFindAgain(aFindBackwards); }
				catch(ex) { Cu.reportError(ex); }
			}
		}
	},
	
	get searchString() {
		if(!this._searchString && this._fastFind.searchString) {
			this._searchString = this._fastFind.searchString;
		}
		return this._searchString;
	},
	
	get clipboardSearchString() {
		return GetClipboardSearchString(this.getWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsILoadContext));
	},
	
	set clipboardSearchString(aSearchString) {
		if(!aSearchString || !Clipboard.supportsFindClipboard()) { return; }
		
		ClipboardHelper.copyStringToClipboard(aSearchString, Ci.nsIClipboard.kFindClipboard);
	},
	
	set caseSensitive(aSensitive) {
		this._fastFind.caseSensitive = aSensitive;
	},
	
	_lastFindResult: null,
	_lastFindPrevious: false,
	
	// Used for normal search operations, highlights the first match.
	// - aSearchString String to search for.
	// - aLinksOnly Only consider nodes that are links for the search.
	// - aDrawOutline Puts an outline around matched links.
	fastFind: function(aSearchString, aLinksOnly, aDrawOutline) {
		this._lastFindResult = this._fastFind.find(aSearchString, aLinksOnly);
		this._lastFindPrevious = false;
		this._notify(this._fastFind.searchString, this._lastFindResult, false, aDrawOutline);
	},
	
	// Repeat the previous search. Should only be called after a previous call to Finder.fastFind.
	// - aFindBackwards Controls the search direction; true: before current match, false: after current match.
	// - aLinksOnly Only consider nodes that are links for the search.
	// - aDrawOutline Puts an outline around matched links.
	findAgain: function(aFindBackwards, aLinksOnly, aDrawOutline) {
		// the searchString in fastFind could be wrong, i.e. when we select text and highlight it with Prefs.fillSelectedText
		if(this.searchString != this._fastFind.searchString) {
			this.fastFind(this.searchString, aLinksOnly, aDrawOutline);
			
			// usually in this case the first result will be the current selected text
			this.findAgain(aFindBackwards, aLinksOnly, aDrawOutline);
			return;
		}
		
		this._lastFindResult = this._fastFind.findAgain(aFindBackwards, aLinksOnly);
		this._lastFindPrevious = aFindBackwards;
		this._notify(this._fastFind.searchString, this._lastFindResult, aFindBackwards, aDrawOutline);
		
		// _notify doesn't distinguish between fastFind, findAgain and highlight operations
		this._notifyFindAgain(aFindBackwards);
	},
	
	// Search until we find a specific range, to move fastFind's pointer to it.
	// - aSearchString String to search for.
	// - aRange Range we're looking for.
	// - aFindBackwards Controls the search direction; true: before current match, false: after current match.
	// - aLimit How many findAgain loops should it do; basically how many hits does the page have.
	//   Using this speeds up the search, because we don't have to keep checking for defaultViews and editableNodes and stuff
	findRange: function(aSearchString, aRange, aCaseSensitive, aFindBackwards, aLimit) {
		let notifyAgain = true;
		if(this.searchString != aSearchString || this._fastFind.caseSensitive != aCaseSensitive) {
			this._fastFind.caseSensitive = aCaseSensitive;
			this._lastFindResult = this._fastFind.find(aSearchString, false);
			notifyAgain = false;
		}
		
		// obviously we can't proceed if the search term doesn't exist, although this really shouldn't happen at all
		if(this._lastFindResult == Ci.nsITypeAheadFind.FIND_NOTFOUND) {
			this._notify(this._fastFind.searchString, this._lastFindResult, false, false);
			return;
		}
		
		// This doesn't need to be in the loop, since we're only interested in a specific range and not all of them
		let contentWindow = aRange.startContainer.ownerDocument.defaultView;
		let editableNode = this._getEditableNode(aRange.startContainer);
		let controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
		if(!controller) {
			controller = this._getSelectionController(contentWindow);
		}
		
		let loops = 0;
		while(loops < aLimit) {
			if(this._fastFind.currentWindow == contentWindow
			&& this._fastFind.foundEditable == editableNode) {
				let sel = controller.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
				if(sel.rangeCount == 1 && this.compareRanges(aRange, sel.getRangeAt(0))) {
					this._notify(this._fastFind.searchString, this._lastFindResult, aFindBackwards, false);
					if(notifyAgain) {
						this._notifyFindAgain(aFindBackwards);
					}
					return;
				}
			}
			
			this._lastFindResult = this._fastFind.findAgain(aFindBackwards, false);
			
			// We can't rely on FIND_WRAPPED status for pages with frames
			loops++;
		}
		
		// if we get here, we couldn't find our range
		this._lastFindResult = Ci.nsITypeAheadFind.FIND_NOTFOUND;
		this._notify(this._fastFind.searchString, this._lastFindResult, false, false);
	},
	
	// Forcibly set the search string of the find clipboard to the currently selected text in the window, on supported platforms (i.e. OSX).
	setSearchStringToSelection: function() {
		let searchString = this.getActiveSelectionText();
		
		// Empty strings are rather useless to search for.
		if(!searchString.length) {
			return null;
		}
		
		this.clipboardSearchString = searchString;
		return searchString;
	},
	
	highlight: Task.async(function* (aHighlight, aWord, aLinksOnly) {
		// nsFind doesn't work in XML files apparently
		if(document instanceof Ci.nsIDOMXMLDocument) { return; }
		
		// if we're calling highlight() again, we need to ensure any currently sleeping previous highlight() is stopped
		if(this._abortHighlight) {
			this._abortHighlight();
		}
		
		for(let l of this._listeners) {
			if(l.onWillHighlight) {
				try { l.onWillHighlight(aHighlight); }
				catch(ex) { Cu.reportError(ex); }
			}
		}
		
		let found = yield this._highlight(aHighlight, aWord, aLinksOnly);
		this._lastFindResult = found ? Ci.nsITypeAheadFind.FIND_FOUND : Ci.nsITypeAheadFind.FIND_NOTFOUND;
		
		for(let l of this._listeners) {
			if(l.onHighlightFinished) {
				try { l.onHighlightFinished(aHighlight); }
				catch(ex) { Cu.reportError(ex); }
			}
		}
		
		if(aHighlight) {
			this._notify(aWord, this._lastFindResult, false, false, false);
		}
		
		message('HighlightsFinished');
	}),
	
	getFocused: function() {
		let focused = {};
		let focusedWindow = {};
		
		focused.element = Services.focus.getFocusedElementForWindow(this.getWindow, true, focusedWindow);
		focused.window = focusedWindow.value;
		return focused;
	},
	
	getActiveSelectionText: function() {
		let focused = this.getFocused();
		let selText;
		
		if(focused.element instanceof Ci.nsIDOMNSEditableElement && focused.element.editor) {
			// The user may have a selection in an input or textarea.
			selText = focused.element.editor.selectionController.getSelection(Ci.nsISelectionController.SELECTION_NORMAL).toString();
		} else {
			// Look for any selected text on the actual page.
			selText = focused.window.getSelection().toString();
		}
		
		if(!selText) {
			return "";
		}
		
		// Process our text to get rid of unwanted characters.
		//return selText.trim().replace(/\s+/g, " ").substr(0, 150);
		return selText.trim().replace(/\s+/g, " ");
	},
	
	enableSelection: function() {
		this._fastFind.setSelectionModeAndRepaint(Ci.nsISelectionController.SELECTION_ON);
		this._restoreOriginalOutline();
	},
	
	removeSelection: function() {
		this._fastFind.collapseSelection();
		this.enableSelection();
	},
	
	focusContent: function() {
		// Allow Finder listeners to cancel focusing the content.
		for(let l of this._listeners) {
			if(l.shouldFocusContent) {
				try {
					if(!l.shouldFocusContent()) { return; }
				}
				catch(ex) { Cu.reportError(ex); }
			}
		}
		
		let fastFind = this._fastFind;
		const fm = Cc["@mozilla.org/focus-manager;1"].getService(Ci.nsIFocusManager);
		try {
			// Try to find the best possible match that should receive focus and block scrolling on focus since find already scrolls. Further
			// scrolling is due to user action, so don't override this.
			if(fastFind.foundLink) {
				fm.setFocus(fastFind.foundLink, fm.FLAG_NOSCROLL);
			} else if(fastFind.foundEditable) {
				fm.setFocus(fastFind.foundEditable, fm.FLAG_NOSCROLL);
				fastFind.collapseSelection();
			} else {
				this.getWindow.focus()
			}
		}
		catch(ex) {}
	},
	
	keyPress: function(e) {
		let controller = this._getSelectionController(this.getWindow);
		
		switch(e.keyCode) {
			case Ci.nsIDOMKeyEvent.DOM_VK_RETURN:
				if(this._fastFind.foundLink) {
					let view = this._fastFind.foundLink.ownerDocument.defaultView;
					this._fastFind.foundLink.dispatchEvent(new view.MouseEvent("click", {
						view: view,
						cancelable: true,
						bubbles: true,
						ctrlKey: e.ctrlKey,
						altKey: e.altKey,
						shiftKey: e.shiftKey,
						metaKey: e.metaKey
					}));
				}
				break;
				
			case Ci.nsIDOMKeyEvent.DOM_VK_TAB:
				let direction = Services.focus.MOVEFOCUS_FORWARD;
				if(e.shiftKey) {
					direction = Services.focus.MOVEFOCUS_BACKWARD;
				}
				Services.focus.moveFocus(this.getWindow, null, direction, 0);
				break;
				
			case Ci.nsIDOMKeyEvent.DOM_VK_PAGE_UP:
				controller.scrollPage(false);
				break;
			case Ci.nsIDOMKeyEvent.DOM_VK_PAGE_DOWN:
				controller.scrollPage(true);
				break;
			case Ci.nsIDOMKeyEvent.DOM_VK_UP:
				controller.scrollLine(false);
				break;
			case Ci.nsIDOMKeyEvent.DOM_VK_DOWN:
				controller.scrollLine(true);
				break;
		}
	},
	
	// Basic wrapper around nsIFind that provides a generator yielding a range each time an occurence of `aWord` string is found.
	// - aWord the word to search for.
	// - aWindow the window to search in.
	_findIterator: function* (aWord, aWindow) {
		let doc = aWindow.document;
		let body = (doc instanceof Ci.nsIDOMHTMLDocument && doc.body) ? doc.body : doc.documentElement;
		if(!body) { return; }
		
		let searchRange = doc.createRange();
		searchRange.selectNodeContents(body);
		
		let startPt = searchRange.cloneRange();
		startPt.collapse(true);
		
		let endPt = searchRange.cloneRange();
		endPt.collapse(false);
		
		let retRange = null;
		let finder = new rangeFinder(aWord);
		
		while((retRange = finder.Find(searchRange, startPt, endPt))) {
			yield retRange;
			startPt = retRange.cloneRange();
			startPt.collapse(false);
		}
	},
	
	_highlightIterator: Task.async(function* (aWord, aWindow, aHighlight, aLinksOnly, aOnFind) {
		let count = 0;
		for(let range of this._findIterator(aWord, aWindow)) {
			if(aLinksOnly && !this._rangeStartsInLink(range)) { continue; }
			
			aOnFind(range);
			
			// We can stop now if all we're looking for is the found status
			if(!aHighlight && !this._highlights) { break; }
			
			// sleep for a little bit, so the UI doesn't lock up in the pages with tons of highlights
			// don't forget we also do this on removing highlights, we shouldn't sleep in this case, so that it doesn't interfere with the sequencer possible re-highlight
			if(aHighlight && ++count >= this.kHighlightIterationMax) {
				count = 0;
				yield this._highlightSleep(0);
			}
		}
	}),
	
	_abortHighlight: null,
	_highlightSleep: function(delay) {
		return new Promise((resolve, reject) => {
			this._abortHighlight = () => {
				this._abortHighlight = null;
				reject();
			};
			aSync(resolve, delay);
		});
	},
	
	get getWindow() {
		return this._docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
	},
	
	// Get the bounding selection rect in CSS px relative to the origin of the top-level content document.
	_getResultRect: function() {
		let topWin = this.getWindow;
		let win = this._fastFind.currentWindow;
		if(!win) {
			return null;
		}
		
		let selection = win.getSelection();
		if(!selection.rangeCount || selection.isCollapsed) {
			// The selection can be into an input or a textarea element.
			let nodes = $$("input, textarea", win.document);
			for(let node of nodes) {
				if(node instanceof Ci.nsIDOMNSEditableElement && node.editor) {
					let sc = node.editor.selectionController;
					selection = sc.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
					if(selection.rangeCount && !selection.isCollapsed) {
						break;
					}
				}
			}
		}
		
		let utils = topWin.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
		
		let scrollX = {}, scrollY = {};
		utils.getScrollXY(false, scrollX, scrollY);
		
		for(let frame = win; frame != topWin; frame = frame.parent) {
			let rect = frame.frameElement.getBoundingClientRect();
			let left = getComputedStyle(frame.frameElement, "").borderLeftWidth;
			let top = getComputedStyle(frame.frameElement, "").borderTopWidth;
			scrollX.value += rect.left + parseInt(left, 10);
			scrollY.value += rect.top + parseInt(top, 10);
		}
		let rect = Rect.fromRect(selection.getRangeAt(0).getBoundingClientRect());
		return rect.translate(scrollX.value, scrollY.value);
	},
	
	_outlineLink: function(aDrawOutline) {
		let foundLink = this._fastFind.foundLink;
		
		// Optimization: We are drawing outlines and we matched the same link before, so don't duplicate work.
		if(foundLink == this._previousLink && aDrawOutline) { return; }
		
		this._restoreOriginalOutline();
		
		if(foundLink && aDrawOutline) {
			// Backup original outline
			this._tmpOutline = foundLink.style.outline;
			this._tmpOutlineOffset = foundLink.style.outlineOffset;
			
			// Draw pseudo focus rect. Don't set the outline-color, we should always use initial value.
			foundLink.style.outline = "1px dotted";
			foundLink.style.outlineOffset = "0";
			
			this._previousLink = foundLink;
		}
	},
	
	_restoreOriginalOutline: function() {
		// Removes the outline around the last found link.
		if(this._previousLink) {
			this._previousLink.style.outline = this._tmpOutline;
			this._previousLink.style.outlineOffset = this._tmpOutlineOffset;
			this._previousLink = null;
		}
	},
	
	// Add found words to counter and grid arrays if needed
	_highlights: null,
	buildHighlights: new Set(),
	
	// Modified to more accurately handle frames
	_highlight: Task.async(function* (aHighlight, aWord, aLinksOnly, aWindow) {
		let win = aWindow || this.getWindow;
		
		if(!aWindow) {
			// we always construct this object if the counter, grid or sights are being used, they all fetch from here instead of each having their own lists or arrays
			this._highlights = null;
			
			if(this.buildHighlights.size > 0) {
				this._highlights = {
					wins: new Map()
				};
			}
		}
		
		// Prepare highlights two-level arrays for every frame; first entry is highlights from first-level content, then all frames and sub-frames in order
		if(this._highlights) {
			var docHighlights = [];
			this._highlights.wins.set(win, docHighlights);
		}
		
		let found = false;
		for(let i = 0; win.frames && i < win.frames.length; i++) {
			if(yield this._highlight(aHighlight, aWord, aLinksOnly, win.frames[i])) {
				found = true;
			}
		}
		
		let controller = this._getSelectionController(win);
		let doc = win.document;
		if(!controller || !doc || !doc.documentElement) {
			// Without the selection controller, we are unable to (un)highlight any matches
			return found;
		}
		
		// Bugfix: when using neither the highlights nor the counter, toggling the highlights off would trigger the "Phrase not found" status
		// because textFound would never have had the chance to be verified. This doesn't need to happen if a frame already triggered the found status.
		if(aHighlight || this._highlights || !found) {
			yield this._highlightIterator(aWord, win, aHighlight, aLinksOnly, aRange => {
				found = true;
				
				// No need to do any of this if all we're looking for is the found status
				if(aHighlight || this._highlights) {
					// instead of doubling the checks, let's just reuse the first results
					let editableNode = this._getEditableNode(aRange.startContainer)
					
					if(aHighlight) {
						this._highlightRange(aRange, controller, editableNode);
					}
					
					if(this._highlights) {
						docHighlights.push({ range: aRange, editableNode: editableNode });
					}
				}
			});
		}
		
		if(!aWindow) {
			// no point in setting the array if no matches were found
			if(!found) {
				this._highlights = null;
			} else {
				this._highlights.all = [];
				for(let [mWin, mHighlights] of this._highlights.wins) {
					if(mHighlights.length == 0) {
						this._highlights.wins.delete(mWin);
					}
					else {
						// single-level array, with frame highlights coming last
						for(let h of mHighlights) {
							this._highlights.all.push(h);
						}
					}
				}
			}
			
			if(found) {
				// Never take attention from current hit
				let curSel = controller.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
				if(curSel.rangeCount == 1) {
					controller.setDisplaySelection(Ci.nsISelectionController.SELECTION_ATTENTION);
				}
			}
		}
		
		if(!aHighlight) {
			// First, attempt to remove highlighting from main document
			let sel = controller.getSelection(Ci.nsISelectionController.SELECTION_FIND);
			sel.removeAllRanges();
			
			// Next, check our editor cache, for editors belonging to this document
			if(this._editors) {
				for(let x = this._editors.length -1; x >= 0; --x) {
					if(this._editors[x].document == doc) {
						sel = this._editors[x].selectionController.getSelection(Ci.nsISelectionController.SELECTION_FIND);
						sel.removeAllRanges();
						
						// We don't need to listen to this editor any more
						this._unhookListenersAtIndex(x);
					}
				}
			}
		}
		
		return found;
	}),
	
	_highlightRange: function(aRange, aController, aEditableNode) {
		let controller = aController;
		if(aEditableNode) {
			controller = aEditableNode.editor.selectionController;
		}
		
		let findSelection = controller.getSelection(Ci.nsISelectionController.SELECTION_FIND);
		findSelection.addRange(aRange);
		
		if(aEditableNode) {
			// Highlighting added, so cache this editor, and hook up listeners to ensure we deal properly with edits within the highlighting
			if(!this._editors) {
				this._editors = [];
				this._stateListeners = [];
			}
			
			let existingIndex = this._editors.indexOf(aEditableNode.editor);
			if(existingIndex == -1) {
				let x = this._editors.length;
				this._editors[x] = aEditableNode.editor;
				this._stateListeners[x] = this._createStateListener();
				this._editors[x].addEditActionListener(this);
				this._editors[x].addDocumentStateListener(this._stateListeners[x]);
			}
		}
	},
	
	_getSelectionController: function(aWindow) {
		// display: none iframes don't have a selection controller, see bug 493658
		try {
			if(!aWindow.innerWidth || !aWindow.innerHeight) {
				return null;
			}
		}
		catch(ex) {
			// If getting innerWidth or innerHeight throws, we can't get a selection controller.
			return null;
		}
		
		// Yuck. See bug 138068.
		let docShell = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShell);
		let controller = docShell.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsISelectionDisplay).QueryInterface(Ci.nsISelectionController);
		return controller;
	},
	
	get currentTextSelection() {
		let editableNode = this._fastFind.foundEditable;
		let controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
		if(!controller) {
			controller = this._getSelectionController(this._fastFind.currentWindow || this.getWindow);
		}
		return controller.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
	},
	
	// For a given node returns its editable parent or null if there is none.	
	// It's enough to check if aNode is a text node and its parent's parent is instance of nsIDOMNSEditableElement.
	// - aNode the node we want to check
	// - returns the first node in the parent chain that is editable, null if there is no such node
	_getEditableNode: function(aNode) {
		if(aNode.nodeType === aNode.TEXT_NODE
		&& aNode.parentNode && aNode.parentNode.parentNode
		&& aNode.parentNode.parentNode instanceof Ci.nsIDOMNSEditableElement) {
			return aNode.parentNode.parentNode;
		}
		return null;
	},
	
	// Helper method to unhook listeners, remove cached editors and keep the relevant arrays in sync
	// - aIndex the index into the array of editors/state listeners we wish to remove
	_unhookListenersAtIndex: function(aIndex) {
		this._editors[aIndex].removeEditActionListener(this);
		this._editors[aIndex].removeDocumentStateListener(this._stateListeners[aIndex]);
		this._editors.splice(aIndex, 1);
		this._stateListeners.splice(aIndex, 1);
		if(!this._editors.length) {
			delete this._editors;
			delete this._stateListeners;
		}
	},
	
	// Remove ourselves as an nsIEditActionListener and nsIDocumentStateListener from a given cached editor
	// - aEditor the editor we no longer wish to listen to
	_removeEditorListeners: function(aEditor) {
		// aEditor is an editor that we listen to, so therefore must be cached. Find the index of this editor
		let idx = this._editors.indexOf(aEditor);
		if(idx == -1) { return; }
		
		// Now unhook ourselves, and remove our cached copy
		this._unhookListenersAtIndex(idx);
	},
	
	// nsIEditActionListener logic: We implement this interface to allow us to catch the case where the findbar found a match in a HTML <input> or <textarea>. If the
	// user adjusts the text in some way, it will no longer match, so we want to remove the highlight, rather than have it expand/contract when letters are added or removed.
	
	// Helper method used to check whether a selection intersects with some highlighting
	// - aSelectionRange the range from the selection to check
	// - aFindRange the highlighted range to check against
	// - returns true if they intersect, false otherwise
	_checkOverlap: function(aSelectionRange, aFindRange) {
		// The ranges overlap if one of the following is true:
		// 1) At least one of the endpoints of the deleted selection is in the find selection
		// 2) At least one of the endpoints of the find selection is in the deleted selection
		if(aFindRange.isPointInRange(aSelectionRange.startContainer, aSelectionRange.startOffset)
		|| aFindRange.isPointInRange(aSelectionRange.endContainer, aSelectionRange.endOffset)
		|| aSelectionRange.isPointInRange(aFindRange.startContainer, aFindRange.startOffset)
		|| aSelectionRange.isPointInRange(aFindRange.endContainer, aFindRange.endOffset)) {
			return true;
		}
		
		return false;
	},
	
	// Helper method to determine if an edit occurred within a highlight
	// - aSelection the selection we wish to check
	// - aNode the node we want to check is contained in aSelection
	// - aOffset the offset into aNode that we want to check
	// - returns the range containing (aNode, aOffset) or null if no ranges in the selection contain it
	_findRange: function(aSelection, aNode, aOffset) {
		let rangeCount = aSelection.rangeCount;
		let rangeidx = 0;
		let foundContainingRange = false;
		let range = null;
		
		// Check to see if this node is inside one of the selection's ranges
		while(!foundContainingRange && rangeidx < rangeCount) {
			range = aSelection.getRangeAt(rangeidx);
			if(range.isPointInRange(aNode, aOffset)) {
				foundContainingRange = true;
				break;
			}
			rangeidx++;
		}
		
		if(foundContainingRange) {
			return range;
		}
		
		return null;
	},
	
	// Determines whether a range is inside a link.
	// - aRange the range to check
	// - returns true if the range starts in a link
	_rangeStartsInLink: function(aRange) {
		let isInsideLink = false;
		let node = aRange.startContainer;
		
		if(node.nodeType == node.ELEMENT_NODE && node.hasChildNodes) {
			let childNode = node.item(aRange.startOffset);
			if(childNode) {
				node = childNode;
			}
		}
		
		const XLink_NS = "http://www.w3.org/1999/xlink";
		do {
			if(node instanceof node.ownerGlobal.HTMLAnchorElement) {
				isInsideLink = node.hasAttribute("href");
				break;
			} else if(typeof node.hasAttributeNS == "function" && node.hasAttributeNS(XLink_NS, "href")) {
				isInsideLink = (node.getAttributeNS(XLink_NS, "type") == "simple");
				break;
			}
			
			node = node.parentNode;
		}
		while(node);
		
		return isInsideLink;
	},
	
	// quick method to compare two ranges, to see if they cover the same text in a webpage even if they're not the exact same node/reference
	compareRanges: function(aRange, bRange) {
		// if the supplied nodes aren't even ranges, we're pretty sure they're not meant to be compared anyway
		if(!(aRange instanceof content.Range) || !(bRange instanceof content.Range)) {
			return false;
		}
		
		// obviously if the ranges don't belong to the same document, they can't be the same range
		try {
			let aDoc = aRange.commonAncestorContainer;
			let bDoc = bRange.commonAncestorContainer;
			if(aDoc.ownerDocument) {
				aDoc = aDoc.ownerDocument;
			}
			if(bDoc.ownerDocument) {
				bDoc = bDoc.ownerDocument;
			}
			if(aDoc != bDoc) { return false; }
		}
		catch(ex) {
			// if something goes wrong here, we assume the ranges aren't comparable,
			// but still report it to the console, this should be rare though
			Cu.reportError(ex);
			return false;
		}
		
		// first we use the range's own compare methods, they're the fastest and they should correctly match ranges almost 100% percent of the time;
		// reference: https://developer.mozilla.org/en-US/docs/Web/API/Range/compareBoundaryPoints
		if(!aRange.compareBoundaryPoints(aRange.START_TO_START, bRange) && !aRange.compareBoundaryPoints(aRange.END_TO_END, bRange)) {
			return true;
		}
		
		// Most often we want to compare automatically created ranges with user selections,
		// and sometimes these user selections might end in a node boundary, which while being the same selection to the eye,
		// it technically might not have the same range boundary as the equivalent automatically created range.
		// So we have to take a more thorough approach for some cases; see https://github.com/Quicksaver/FindBar-Tweak/issues/223
		// In order to try and save some resources, we try to cache some of these values within the ranges themselves.
		
		// obviously the ranges won't match if their contents don't either
		if(aRange._text === undefined) {
			aRange._text = aRange.toString();
		}
		if(bRange._text === undefined) {
			bRange._text = bRange.toString();
		}
		if(aRange._text != bRange._text) {
			return false;
		}
		
		// the visual boundaries checks below are very resource intensive, so let's try to only continue if it's actually worth doing them,
		// as it's highly unlikely the ranges will match if their closest common ancestors aren't related
		if(!isAncestor(aRange.commonAncestorContainer, bRange.commonAncestorContainer) && !isAncestor(bRange.commonAncestorContainer, aRange.commonAncestorContainer)) {
			return false;
		}
		
		// try to match the ranges by their visual boundaries
		if(aRange._rects === undefined) {
			aRange._rects = aRange.getClientRects();
		}
		if(bRange._rects === undefined) {
			bRange._rects = bRange.getClientRects();
		}
		// empty selections?
		if(!aRange._rects.length || !bRange._rects.length || aRange._rects.length != bRange._rects.length) {
			return false;
		}
		for(let i = 0; i < aRange._rects.length; i++) {
			// we compare by exclusion so that we can stop on the first hint that the ranges don't match
			if(aRange._rects[i].x != bRange._rects[i].x
			|| aRange._rects[i].y != bRange._rects[i].y
			|| aRange._rects[i].width != bRange._rects[i].width
			|| aRange._rects[i].height != bRange._rects[i].height) {
				return false;
			}
		}
		
		// we've gone through every parameter of every client rectangle object of these ranges and haven't excluded any,
		// which means the ranges are visually the same
		return true;
	},
	
	// Start of nsIWebProgressListener implementation.
	
	onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) {
		if(aWebProgress.isTopLevel) {
			this.isFinderValid();
			
			// Avoid leaking if we change the page.
			this._previousLink = null;
		}
	},
	
	// Most of the update work fall either here or in onStateChange events, which seem to be the most reliable to track for;
	// onLocationChange doesn't always work for dynamically loaded pages (to keep innerText accurate at least).
	onDOMContentLoaded: function(e) {
		// this is the content document of the loaded page.
		var doc = e.originalTarget;
		if(doc instanceof content.HTMLDocument) {
			this.resetInnerText();
			
			// is this an inner frame?
			// Find the root document:
			while(doc.defaultView.frameElement) {
				doc = doc.defaultView.frameElement.ownerDocument;
			}
			
			if(doc == document) {
				this.isFinderValid();
			}
		}
	},
	
	onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
		if(!aWebProgress.isLoadingDocument && aWebProgress.DOMWindow == content) {
			this.resetInnerText();
		}
	},
	
	// Mostly handles some necessary browser tags
	onProgressChange: function(aWebProgress, aRequest, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {
		if(curTotalProgress > 3) {
			this.isFinderValid();
		}
	},
	
	// Start of nsIEditActionListener implementations
	
	WillDeleteText: function(aTextNode, aOffset, aLength) {
		let editor = this._getEditableNode(aTextNode).editor;
		let controller = editor.selectionController;
		let fSelection = controller.getSelection(Ci.nsISelectionController.SELECTION_FIND);
		let range = this._findRange(fSelection, aTextNode, aOffset);
		
		if(range) {
			// Don't remove the highlighting if the deleted text is at the end of the range
			if(aTextNode != range.endContainer || aOffset != range.endOffset) {
				// Text within the highlight is being removed - the text can no longer be a match, so remove the highlighting
				fSelection.removeRange(range);
				if(fSelection.rangeCount == 0) {
					this._removeEditorListeners(editor);
				}
			}
		}
	},
	
	DidInsertText: function(aTextNode, aOffset, aString) {
		let editor = this._getEditableNode(aTextNode).editor;
		let controller = editor.selectionController;
		let fSelection = controller.getSelection(Ci.nsISelectionController.SELECTION_FIND);
		let range = this._findRange(fSelection, aTextNode, aOffset);
		
		if(range) {
			// If the text was inserted before the highlight adjust the highlight's bounds accordingly
			if(aTextNode == range.startContainer && aOffset == range.startOffset) {
				range.setStart(range.startContainer, range.startOffset+aString.length);
			} else if(aTextNode != range.endContainer || aOffset != range.endOffset) {
				// The edit occurred within the highlight - any addition of text will result in the text no longer being a match, so remove the highlighting
				fSelection.removeRange(range);
				if(fSelection.rangeCount == 0) {
					this._removeEditorListeners(editor);
				}
			}
		}
	},
	
	WillDeleteSelection: function(aSelection) {
		let editor = this._getEditableNode(aSelection.getRangeAt(0).startContainer).editor;
		let controller = editor.selectionController;
		let fSelection = controller.getSelection(Ci.nsISelectionController.SELECTION_FIND);
		
		let selectionIndex = 0;
		let findSelectionIndex = 0;
		let shouldDelete = {};
		let numberOfDeletedSelections = 0;
		let numberOfMatches = fSelection.rangeCount;
		
		// We need to test if any ranges in the deleted selection (aSelection) are in any of the ranges of the find selection
		// Usually both selections will only contain one range, however either may contain more than one.
		
		for(let fIndex = 0; fIndex < numberOfMatches; fIndex++) {
			shouldDelete[fIndex] = false;
			let fRange = fSelection.getRangeAt(fIndex);
			
			for(let index = 0; index < aSelection.rangeCount; index++) {
				if(shouldDelete[fIndex]) { continue; }
				
				let selRange = aSelection.getRangeAt(index);
				if(this._checkOverlap(selRange, fRange)) {
					shouldDelete[fIndex] = true;
					numberOfDeletedSelections++;
				}
			}
		}
		
		// OK, so now we know what matches (if any) are in the selection that is being deleted. Time to remove them.
		if(numberOfDeletedSelections == 0) { return; }
		
		for(let i = numberOfMatches -1; i >= 0; i--) {
			if(shouldDelete[i]) {
				fSelection.removeRange(fSelection.getRangeAt(i));
			}
		}
		
		// Remove listeners if no more highlights left
		if(fSelection.rangeCount == 0) {
			this._removeEditorListeners(editor);
		}
	},
	
	// nsIDocumentStateListener logic: When attaching nsIEditActionListeners, there are no guarantees as to whether the findbar or the documents in the browser will get
	// destructed first. This leads to the potential to either leak, or to hold on to a reference an editable element's editor for too long, preventing it from being destructed.
	// However, when an editor's owning node is being destroyed, the editor sends out a DocumentWillBeDestroyed notification. We can use this to clean up our references to the
	// object, to allow it to be destroyed in a timely fashion.
	
	// Unhook ourselves when one of our state listeners has been called. This can happen in 4 cases:
	// 1) The document the editor belongs to is navigated away from, and the document is not being cached
	// 2) The document the editor belongs to is expired from the cache
	// 3) The tab containing the owning document is closed
	// 4) The <input> or <textarea> that owns the editor is explicitly removed from the DOM
	// - the listener that was invoked
	_onEditorDestruction: function(aListener) {
		// First find the index of the editor the given listener listens to. The listeners and editors arrays must always be in sync.
		// The listener will be in our array of cached listeners, as this method could not have been called otherwise.
		let idx = 0;
		while(this._stateListeners[idx] != aListener) {
			idx++;
		}
		
		// Unhook both listeners
		this._unhookListenersAtIndex(idx);
	},
	
	// Creates a unique document state listener for an editor.
	// It is not possible to simply have the findbar implement the listener interface itself, as it wouldn't have sufficient information to work out which editor was being
	// destroyed. Therefore, we create new listeners on the fly, and cache them in sync with the editors they listen to.
	_createStateListener: function() {
		return {
			findbar: this,
			
			QueryInterface: function(aIID) {
				if(aIID.equals(Ci.nsIDocumentStateListener) || aIID.equals(Ci.nsISupports)) { return this; }
				
				throw Components.results.NS_ERROR_NO_INTERFACE;
			},
			
			NotifyDocumentWillBeDestroyed: function() {
				this.findbar._onEditorDestruction(this);
			},
			
			// Unimplemented
			notifyDocumentCreated: function() {},
			notifyDocumentStateChanged: function(aDirty) {}
		};
	},
	
	// should Finder even be used in this browser?
	get isValid() {
		return	viewSource
			|| document instanceof Ci.nsIDOMHTMLDocument
			// don't use the findbar in preferences tabs
			|| (document instanceof Ci.nsIDOMXMLDocument && !document.documentElement.hasAttribute('currentcategory'));
	},
	
	isFinderValid: function() {
		// do aSync so we don't fire more than necessary.
		// Also update the highlighted status in the main process, as we might be switching between pages that aren't highlighted,
		// if we didn't do this, the highlights would always be placed when going back and forth in history or when reloading a page
		Timers.init('isFinderValid', () => {
			message('IsValidResult', {
				isValid: this.isValid,
				documentHighlighted: this.documentHighlighted
			});
		}, 0);
	},
	
	// The following innerText update methods are for properly updating the highlights and the findbar only when it is changed.
	_innerText: null,
	_innerTextDeep: null,
	
	get innerText() {
		if(!this._innerText) {
			this._innerText = new Promise((resolve, reject) => {
				let text = '';
				if(this.isPDFJS) {
					text = 'PDF.JS '+document.URL+' '+(new Date().getTime());
				}
				else if(!document) {
					text = '';
				}
				else {		
					var body = (document instanceof Ci.nsIDOMHTMLDocument && document.body) ? document.body : document.documentElement;
					text = innerText(body);
				}
				resolve(text);
			});
		}
		
		return this._innerText;
	},
	
	get innerTextDeep() {
		if(!this._innerTextDeep) {
			this._innerTextDeep = new Promise((resolve, reject) => {
				this.innerText.then(text => {
					let textDeep = text;
					if(document && !isPDFJS) {
						textDeep += this.getInnerTextFrames(content);
					}
					
					resolve(textDeep);
				});
			});
		}
		
		return this._innerTextDeep;
	},
	
	getInnerTextFrames: function(aWindow) {
		var text = '';
		for(var i=0; aWindow.frames && i<aWindow.frames.length; i++) {
			var doc = (aWindow.frames[i]) ? aWindow.frames[i].document : null;
			if(!doc) { continue; }
			var body = (doc instanceof Ci.nsIDOMHTMLDocument && doc.body) ? doc.body : doc.documentElement;
			text += innerText(body);
			text += this.getInnerTextFrames(aWindow.frames[i]);
		}
		return text;
	},
	
	resetInnerText: function() {
		this._innerText = null;
		this._innerTextDeep = null;
		message('ResetInnerText');
	},
	
	// main indicators of whether the highlights are on or off,
	// these are attributes of the documentElement so that they're preserved when surfing back/forward
	get documentHighlighted() { return document instanceof Ci.nsIDOMHTMLDocument && trueAttribute(document.documentElement, objName+'-highlighted'); },
	set documentHighlighted(v) {
		if(document instanceof Ci.nsIDOMHTMLDocument && this.documentHighlighted != v) {
			toggleAttribute(document.documentElement, objName+'-highlighted', v);
			message('highlightsResult', { documentHighlighted: v });
		}
	},
	get documentReHighlight() { return document instanceof Ci.nsIDOMHTMLDocument && trueAttribute(document.documentElement, objName+'-reHighlight'); },
	set documentReHighlight(v) {
		if(document instanceof Ci.nsIDOMHTMLDocument && this.documentReHighlight != v) {
			toggleAttribute(document.documentElement, objName+'-reHighlight', v);
			message('highlightsContent', { documentReHighlight: v });
		}
	},
	
	// other information about the current highlights
	highlightedWord: '',
	highlightedText: '',
	
	highlightsInfo: function(data) {
		// don't trigger the normal routines, because this comes from chrome and we don't need to send the data back, as chrome updates itself in this case
		for(var d in data) {
			switch (d) {
				case 'documentHighlighted':
					if(document instanceof Ci.nsIDOMHTMLDocument) {
						toggleAttribute(document.documentElement, objName+'-highlighted', data[d]);
					}
					break;
					
				case 'documentReHighlight':
					if(document instanceof Ci.nsIDOMHTMLDocument) {
						toggleAttribute(document.documentElement, objName+'-reHighlight', data[d]);
					}
					break;
					
				default:
					this[d] = data[d];
					break;
			}
		}
	},
	
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
};

this.RemoteFinderListener = {
	_messages: null,
	
	init: function() {
		Finder.addResultListener(this);
		
		// refactored the MESSAGES array into a map, it's just easier to add and remove listeners on the fly by using the .addMesage() and .removeMessage() methods
		this._messages = new Map();
		
		this.addMessage("CaseSensitive", (data) => {
			Finder.caseSensitive = data.caseSensitive;
		});
		
		this.addMessage("SetSearchStringToSelection", () => {
			var selection = Finder.setSearchStringToSelection();
			message("CurrentSelectionResult", { selection: selection, initial: false });
		});
		
		this.addMessage("GetInitialSelection", () => {
			var selection = Finder.getActiveSelectionText();
			message("CurrentSelectionResult", { selection: selection, initial: true });
		});
		
		this.addMessage("GetTextSelection", () => {
			var selection = Finder.getActiveSelectionText();
			message("TextSelectionResult", selection);
		});
		
		this.addMessage("FastFind", (data) => {
			Finder.fastFind(data.searchString, data.linksOnly, data.drawOutline);
		});
		
		this.addMessage("FindAgain", (data) => {
			Finder.findAgain(data.findBackwards, data.linksOnly, data.drawOutline);
		});
		
		this.addMessage("Highlight", (data) => {
			Finder.highlight(data.highlight, data.word, data.linksOnly);
		});
		
		this.addMessage("EnableSelection", () => {
			Finder.enableSelection();
		});
		
		this.addMessage("RemoveSelection", () => {
			Finder.removeSelection();
		});
		
		this.addMessage("FocusContent", () => {
			Finder.focusContent();
		});
		
		this.addMessage("KeyPress", (data) => {
			Finder.keyPress(data);
		});
		
		this.addMessage("IsValid", () => {
			Finder.isFinderValid();
		});
		
		this.addMessage("InnerText", () => {
			Finder.innerText.then(text => {
				message('InnerTextResult', text);
			});
		});
		
		this.addMessage("InnerTextDeep", () => {
			Finder.innerTextDeep.then(textDeep => {
				message('InnerTextDeepResult', textDeep);
			});
		});
		
		this.addMessage("Highlights:Info", (data) => {
			Finder.highlightsInfo(data);
		});
		
		this.addMessage("SetSearchString", (data) => {
			Finder._notify(data, Ci.nsITypeAheadFind.FIND_FOUND, false, false);
		});
	},
	
	deinit: function() {
		Finder.removeResultListener(this);
		
		for(let msg of this._messages.keys()) {
			unlisten(msg, this);
		}
		this._messages.clear();
	},
	
	addMessage: function(msg, aHandler) {
		if(!this._messages.has(msg)) {
			this._messages.set(msg, aHandler);
			listen(msg, this);
		}
	},
	
	removeMessage: function(msg) {
		if(this._messages.has(msg)) {
			unlisten(msg, this);
			this._messages.delete(msg);
		}
	},
	
	onFindResult: function(aData) {
		message("Result", aData);
	},
	
	receiveMessage: function(m) {
		// +1 is for the ':' after objName
		var name = m.name.substr(objName.length +1);
		
		if(this._messages.has(name)) {
			this._messages.get(name)(m.data);
		}
	}
};

this.rangeFinder = function(aWord, caseSensitive) {
	this._finder = Cc["@mozilla.org/embedcomp/rangefind;1"].createInstance().QueryInterface(Ci.nsIFind);
	this._finder.caseSensitive = (caseSensitive !== undefined) ? caseSensitive : Finder._fastFind.caseSensitive;
	this._word = aWord;
};

this.rangeFinder.prototype = {
	Find: function(searchRange, startPt, endPt) {
		return this._finder.Find(this._word, searchRange, startPt, endPt);
	}
};

Modules.LOADMODULE = function() {
	Finder.init(Scope.docShell);
	RemoteFinderListener.init();
};

Modules.UNLOADMODULE = function() {
	RemoteFinderListener.deinit();
	Finder.deinit();
};
