Modules.VERSION = '1.0.0';

this.SHORT_DELAY = 25;
this.LONG_DELAY = 1500;

this.__defineGetter__('Finder', function() { return gFindBar.browser.finder; });
this.__defineGetter__('isPDFJS', function() { return !viewSource && Finder.isPDFJS; });

this.__defineGetter__('documentHighlighted', function() { return gFindBarInitialized && Finder.documentHighlighted; });
this.__defineGetter__('documentReHighlight', function() { return gFindBarInitialized && Finder.documentReHighlight; });
this.__defineGetter__('highlightedWord', function() { return gFindBarInitialized && Finder.highlightedWord; });
this.__defineGetter__('highlightedText', function() { return gFindBarInitialized && Finder.highlightedText; });
this.__defineGetter__('findWord', function() { return gFindBarInitialized && Finder.findWord; });

this.__defineSetter__('documentHighlighted', function(v) { if(!gFindBarInitialized) return v; return Finder.documentHighlighted = v; });
this.__defineSetter__('documentReHighlight', function(v) { if(!gFindBarInitialized) return v; return Finder.documentReHighlight = v; });
this.__defineSetter__('highlightedWord', function(v) { if(!gFindBarInitialized) return v; return Finder.highlightedWord = v; });
this.__defineSetter__('highlightedText', function(v) { if(!gFindBarInitialized) return v; return Finder.highlightedText = v; });
this.__defineSetter__('findWord', function(v) { if(!gFindBarInitialized) return v; return Finder.findWord = v; });

// Because I can't access Finder.jsm in its active context (for some reason), I need to completely replace it.
// A lot of the code here is based on http://mxr.mozilla.org/mozilla-central/source/toolkit/modules/RemoteFinder.jsm

XPCOMUtils.defineLazyGetter(this, "GetClipboardSearchString",
	() => Cu.import("resource://gre/modules/Finder.jsm", {}).GetClipboardSearchString
);

this.RemoteFinder = function(browser) {
	this[objName] = true;
	this._listeners = new Set();
	this._searchString = null;
	
	this.swapBrowser(browser);
};

this.RemoteFinder.prototype = {
	_messages: null,
	
	swapBrowser: function(aBrowser) {
		// make sure that if we're changing browsers, this finder doesn't stay connected with the previous browser
		this.deinit();
		
		this._browser = aBrowser;
		this._messageManager = this._browser.messageManager;
		
		// Ideally listeners would have removed themselves but that doesn't happen right now
		this._listeners.clear();
		
		// refactored the MESSAGES array into a map, it's just easier to add and remove listeners on the fly by using the .addMesage() and .removeMessage() methods
		this._messages = new Map();
		
		this.addMessage("Result", (data) => {
			this._searchString = data.searchString;
			return { callback: "onFindResult", params: [ data, this._browser ] };
		});
		
		this.addMessage("CurrentSelectionResult", (data) => {
			return { callback: "onCurrentSelection", params: [ data.selection, data.initial ] };
		});
		
		this.addMessage("TextSelectionResult", (data) => {
			if(this._getTextSelection) {
				this._getTextSelection.resolve(data);
				this._getTextSelection = null;
			}
		});
		
		this.addMessage("IsValidResult", (data) => {
			if(this._isValid == data) { return null; }
			
			this._isValid = data;
			return { callback: "onIsValid", params: [ this._browser ] };
		});
		
		this.addMessage("ResetInnerText", () => {
			this.resetInnerText();
		});
		
		this.addMessage("InnerTextResult", (data) => {
			if(!this._innerText) {
				this._innerText = Promise.defer();
			}
			this._innerText.resolve(data);
		});
		
		this.addMessage("InnerTextDeepResult", (data) => {
			if(!this._innerTextDeep) {
				this._innerTextDeep = Promise.defer();
			}
			this._innerTextDeep.resolve(data);
		});
		
		this.addMessage("HighlightsResult", (data) => {
			for(var d in data) {
				this[d] = data[d];
			}
		});
		
		this.addMessage("HighlightsFinished", () => {
			return { callback: "onHighlights", params: [ this._browser, this.documentHighlighted ] };
		});
		
		// There's a possibility that a finder might be deinited, then reinited without being nuked first, so we may end up with some external messages not being registered.
		// The problem is I have no idea how to test for this (how to cause it), so I'll just postpone investigating this until I do.
	},
	
	deinit: function() {
		if(this._messageManager) {
			for(let msg of this._messages.keys()) {
				Messenger.unlistenBrowser(this._browser, msg, this);
			}
			this._messages.clear();
		}
	},
	
	addMessage: function(msg, aHandler) {
		if(this._messageManager && !this._messages.has(msg)) {
			this._messages.set(msg, aHandler);
			Messenger.listenBrowser(this._browser, msg, this);
		}
	},
	
	removeMessage: function(msg) {
		if(this._messageManager && this._messages.has(msg)) {
			Messenger.unlistenBrowser(this._browser, msg, this);
			this._messages.delete(msg);
		}
	},
	
	receiveMessage: function(m) {
		// +1 is for the ':' after objName
		let name = m.name.substr(objName.length +1);
		
		if(this._messages.has(name)) {
			let { callback, params } = this._messages.get(name)(m.data) || {};
			
			if(callback && params) {
				for(let l of this._listeners) {
					if(l[callback]) {
						// Don't let one callback throwing stop us calling the rest
						try { l[callback].apply(l, params); }
						catch(ex) { Cu.reportError(ex); }
					}
				}
			}
		}
	},
	
	addResultListener: function(aListener) {
		this._listeners.add(aListener);
	},
	
	removeResultListener: function(aListener) {
		this._listeners.delete(aListener);
	},
	
	get searchString() { return this._searchString; },
	get clipboardSearchString() { return GetClipboardSearchString(this._browser.loadContext); },
	setSearchStringToSelection() { Messenger.messageBrowser(this._browser, 'SetSearchStringToSelection', {}); },
	set caseSensitive(aSensitive) { Messenger.messageBrowser(this._browser, 'CaseSensitive', { caseSensitive: aSensitive }); },
	getInitialSelection: function() { Messenger.messageBrowser(this._browser, 'GetInitialSelection', {}); },
	
	// gets the current text selection in the content browser in the form of a promise
	_getTextSelection: null,
	get getTextSelection() {
		if(!this._getTextSelection) {
			this._getTextSelection = Promise.defer();
			Messenger.messageBrowser(this._browser, 'GetTextSelection');
		}
		return this._getTextSelection.promise;
	},
	
	onTextSelection: function(selection) {
		if(this._getTextSelection) {
			this._getTextSelection.resolve(selection);
			this._getTextSelection = null;
		}
	},
	
	// Selecting with the caret backwards would always reset the caret back to the end of the selection when calling _find() (using the fastFind object),
	// we need to work around that so the selection doesn't keep resetting. This happens in the case of fillWithSelection, and also needed for selecting hits in FIT.
	workAroundFind: false,
	tweakFastFind: function(aSearchString, aLinksOnly, aDrawOutline) {
		if(this.workAroundFind) {
			this.workAroundFind = false;
			return;
		}
		
		this.fastFind(aSearchString, aLinksOnly, aDrawOutline);
	},
	
	fastFind: function(aSearchString, aLinksOnly, aDrawOutline) {
		Messenger.messageBrowser(this._browser, 'FastFind', { searchString: aSearchString, linksOnly: aLinksOnly, drawOutline: aDrawOutline });
	},
	
	findAgain: function(aFindBackwards, aLinksOnly, aDrawOutline) {
		Messenger.messageBrowser(this._browser, 'FindAgain', { findBackwards: aFindBackwards, linksOnly: aLinksOnly, drawOutline: aDrawOutline });
	},
	
	highlight: function(aHighlight, aWord) {
		Messenger.messageBrowser(this._browser, 'Highlight', { highlight: aHighlight, word: aWord });
	},
	
	enableSelection: function() {
		Messenger.messageBrowser(this._browser, 'EnableSelection');
	},
	
	removeSelection: function() {
		Messenger.messageBrowser(this._browser, 'RemoveSelection');
	},
	
	focusContent: function() {
		// Allow Finder listeners to cancel focusing the content.
		for(let l of this._listeners) {
			if(l.shouldFocusContent) {
				try {
					if(!l.shouldFocusContent()) { return; }
				}
				catch (ex) { Cu.reportError(ex); }
			}
		}
		
		this._browser.focus();
		Messenger.messageBrowser(this._browser, 'FocusContent');
	},
	
	keyPress: function(e) {
		Messenger.messageBrowser(this._browser, 'KeyPress', { keyCode: e.keyCode, shiftKey: e.shiftKey });
	},
	
	// We completely override Firefox's own matches counter with ours, just leaving this dummy function here in case someone tries to use it for now.
	requestMatchesCount: function() {},
	
	// should Finder even be used in this browser?
	_isValid: true,
	get isValid() {
		return viewSource
		// if cmd_find is disabled, we assume the find bar can't (or shouldn't) be used
		|| (!trueAttribute($('cmd_find'), 'disabled') && dispatch(this._browser, { type: 'IsFinderValid' }) && this._isValid);
	},
	
	// this resets the innerText and innerTextDeep properties of this browser, to new promises to be resolved when content sends back these values;
	// these promises are only triggered when they are called.
	resetInnerText: function() {
		//if(this._innerText) { this._innerText.reject(); }
		//if(this._innerTextDeep) { this._innerTextDeep.reject(); }
		this._innerText = null;
		this._innerTextDeep = null;
	},
	
	_innerText: null,
	_innerTextDeep: null,
	
	get innerText() {
		if(this._innerText) {
			return this._innerText.promise;
		}
		
		this._innerText = Promise.defer();
		Messenger.messageBrowser(this._browser, 'InnerText');
		return this._innerText.promise;
	},
	
	get innerTextDeep() {
		if(this._innerTextDeep) {
			return this._innerTextDeep.promise;
		}
		
		this.innerText; // when populating Deep, we should ensure innerText is populated as well (it will exist in content anyway, might as well have it here too)
		this._innerTextDeep = Promise.defer();
		Messenger.messageBrowser(this._browser, 'InnerTextDeep');
		return this._innerTextDeep.promise;
	},
	
	// to manage highlights in the page more easily
	_documentHighlighted: false,
	_documentReHighlight: false,
	_highlightedWord: '',
	_highlightedText: '',
	_findWord: '',
	
	get documentHighlighted() { return this._documentHighlighted; },
	get documentReHighlight() { return this._documentReHighlight; },
	get highlightedWord() { return this._highlightedWord; },
	get highlightedText() { return this._highlightedText; },
	get findWord() { return this._findWord; },
	
	set documentHighlighted(v) {
		this._documentHighlighted = v;
		this.highlightsInfo();
	},
	set documentReHighlight(v) {
		this._documentReHighlight = v;
		this.highlightsInfo();
	},
	set highlightedWord(v) {
		this._highlightedWord = v;
		this.highlightsInfo();
	},
	set highlightedText(v) {
		this._highlightedText = v;
		this.highlightsInfo();
	},
	set findWord(v) {
		this._findWord = v;
		this.highlightsInfo();
	},
	
	_highlightsInfoTimer: null,
	highlightsInfo: function() {
		// we don't need to send immediately everything, one by one, we might as well just gather it all up and send it down at once
		if(this._highlightsInfoTimer) {
			this._highlightsInfoTimer.cancel();
			this._highlightsInfoTimer = null;
		}
		
		this._highlightsInfoTimer = aSync(() => {
			this._highlightsInfoTimer = null;
			Messenger.messageBrowser(this._browser, 'Highlights:Info', {
				documentHighlighted: this.documentHighlighted,
				documentReHighlight: this.documentReHighlight,
				highlightedWord: this.highlightedWord,
				highlightedText: this.highlightedText,
				findWord: this.findWord
			});
		});
	}
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

Modules.LOADMODULE = function() {
	initFindBar('mFinder',
		function(bar) {
			// load our ._remoteFinder now to prevent the original from loading (it still exists and is fully functional, we just don't want it to be used)
			Messenger.loadInBrowser(bar.browser, 'mFinder');
			
			if(bar.browser.isRemoteBrowser) {
				if(bar.browser._remoteFinder && !bar.browser._remoteFinder[objName]) {
					bar.browser._remoteFinder._messageManager.removeMessageListener("Finder:Result", bar.browser._remoteFinder);
					bar.browser._remoteFinder._messageManager.removeMessageListener("Finder:MatchesResult", bar.browser._remoteFinder);
					bar.browser._remoteFinder._messageManager.removeMessageListener("Finder:CurrentSelectionResult", bar.browser._remoteFinder);
					bar.browser._remoteFinder.removeResultListener(bar);
					bar.browser._remoteFinder = null;
				}
				bar.browser._remoteFinder = new RemoteFinder(bar.browser);
			}
			else {
				if(bar.browser._finder) {
					bar.browser._finder.removeResultListener(bar);
				}
				bar.browser._finder = new RemoteFinder(bar.browser);
			}
			
			// this would usually be set when setting bar.browser, but there's no need to do all of that just for registering it with Finder
			bar.browser.finder.addResultListener(bar);
			
			// get the initial isValid status for this bar's browser
			Messenger.messageBrowser(bar.browser, 'IsValid');
		},
		function(bar) {
			Messenger.unloadFromBrowser(bar.browser, 'mFinder');
			if(bar.browser._remoteFinder || bar.browser._finder) {
				bar.browser.finder.deinit();
			}
			if(bar.browser.isRemoteBrowser) {
				bar.browser._remoteFinder = null;
			} else {
				bar.browser._finder = null;
			}
			
			// this would usually be set when setting bar.browser, but there's no need to do all of that just for registering it with Finder
			bar.browser.finder.addResultListener(bar);
		}
	);
	
	Modules.load('PDFJS');
};

Modules.UNLOADMODULE = function() {
	Modules.unload('PDFJS');
	
	deinitFindBar('mFinder');
};
