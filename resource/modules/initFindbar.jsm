moduleAid.VERSION = '2.1.0';

this.__defineGetter__('gFindBar', function() { return window.gFindBar || $('FindToolbar'); });
this.__defineGetter__('gFindBarInitialized', function() { return window.gFindBarInitialized; });
this.__defineGetter__('gBrowser', function() { return window.gBrowser; });
this.__defineGetter__('linkedPanel', function() { return (viewSource) ? $('appcontent') : $(gBrowser.mCurrentTab.linkedPanel); });
this.__defineGetter__('contentDocument', function() { return (!viewSource) ? gBrowser.mCurrentBrowser.contentDocument : $('content').contentDocument; });
this.__defineGetter__('contentWindow', function() { return gFindBar.browser._fastFind.currentWindow || gFindBar.browser.contentWindow; });
this.__defineGetter__('browserPanel', function() { return $('browser-panel') || viewSource; });
this.getComputedStyle = function(el) { return window.getComputedStyle(el); };

this.inPDFJS = function(aDoc) { return (aDoc && aDoc.contentType == 'application/pdf' && aDoc.baseURI == 'resource://pdf.js/web/'); };
this.__defineGetter__('isPDFJS', function() { return inPDFJS(contentDocument); });

this._getFindBarHidden = function() { return gFindBar.hidden; };
this.__defineGetter__('findBarHidden', function() { return _getFindBarHidden(); });
this.__defineSetter__('findBarHidden', function(v) { return gFindBar.hidden = v; });

this.currentTab = null;

this.doFastFind = true;

this.workAroundFastFind = function(aWord, aWindow) {
	var win = aWindow || gFindBar.browser.contentWindow;
	for(var i = 0; win.frames && i < win.frames.length; i++) {
		if(workAroundFastFind(aWord, win.frames[i])) {
			return gFindBar.nsITypeAheadFind.FIND_FOUND;
		}
	}
	
	var doc = win.document;
	if(!doc || !(doc instanceof window.HTMLDocument) || !doc.body) {
		return gFindBar.nsITypeAheadFind.FIND_NOTFOUND;
	}
	
	var searchRange = doc.createRange();
	searchRange.selectNodeContents(doc.body);
	
	var startPt = searchRange.cloneRange();
	startPt.collapse(true);
	
	var endPt = searchRange.cloneRange();
	endPt.collapse(false);
	
	var retRange = null;
	var finder = Components.classes['@mozilla.org/embedcomp/rangefind;1'].createInstance().QueryInterface(Components.interfaces.nsIFind);
	finder.caseSensitive = gFindBar._shouldBeCaseSensitive(aWord);
	
	while((retRange = finder.Find(aWord, searchRange, startPt, endPt))) {
		return gFindBar.nsITypeAheadFind.FIND_FOUND;
	}
	
	return gFindBar.nsITypeAheadFind.FIND_NOTFOUND;
};

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

this.cancelKeypressTextfield = function(e) {
	switch(e.keyCode) {
		case e.DOM_VK_RETURN:
		case e.DOM_VK_TAB:
			e.preventDefault();
			break;
		case e.DOM_VK_PAGE_UP:
		case e.DOM_VK_PAGE_DOWN:
			if(!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
				e.preventDefault();
			}
			break;
		case e.DOM_VK_UP:
		case e.DOM_VK_DOWN:
			e.preventDefault();
			break;
		default: break;
	}
};

this.baseInit = function(bar) {
	if(!FITFull) {
		bar._open = bar.open;
		bar.open = function(aMode) {
			var suffix = (perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
			
			if(dispatch(this, { type: 'WillOpenFindBar'+suffix, detail: aMode })) {
				var ret = this._open(aMode);
				dispatch(this, { type: 'OpenedFindBar'+suffix, cancelable: false, detail: aMode });
				return ret;
			}
			return false;
		};
		bar._close = bar.close;
		bar.close = function() {
			var suffix = (perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
			
			if(dispatch(this, { type: 'WillCloseFindBar'+suffix })) {
				this._close();
				dispatch(this, { type: 'ClosedFindBar'+suffix, cancelable: false });
			}
		};
		bar.__updateFindUI = bar._updateFindUI;
		bar._updateFindUI = function() {
			var suffix = (perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
			
			if(dispatch(this, { type: 'WillUpdateUIFindBar'+suffix })) {
				this.__updateFindUI();
				dispatch(this, { type: 'UpdatedUIFindBar'+suffix, cancelable: false });
			}
		};
		bar.__updateStatusUI = bar._updateStatusUI;
		bar._updateStatusUI = function(res, aFindPrevious) {
			var suffix = (perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
			
			if(dispatch(this, { type: 'WillUpdateStatusFindBar'+suffix, detail: { res: res, aFindPrevious: aFindPrevious } })) {
				this.__updateStatusUI(res, aFindPrevious);
				this._findStatusDesc.hidden = !this._findStatusDesc.textContent;
				this._findStatusIcon.hidden = !this._findStatusIcon.getAttribute('status');
				dispatch(this, { type: 'UpdatedStatusFindBar'+suffix, cancelable: false, detail: { res: res, aFindPrevious: aFindPrevious } });
			}
		};
		
		if(perTabFB) {
			bar.__defineGetter__('linkedPanel', function() { return this.parentNode.parentNode.parentNode.id; });
		}
	}
	
	bar.___find = bar._find;
	bar._find = function(aValue) {
		var suffix = (!FITFull && perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
		
		if(dispatch(this, { type: 'WillFindFindBar'+suffix, detail: aValue })) {
			var ret = this.__find(aValue);
			dispatch(this, { type: 'FoundFindBar'+suffix, cancelable: false, detail: { aValue: aValue, retValue: ret } });
			return ret;
		}
		return null;
	};
	
	// Selecting with the caret backwards would always reset the caret back to the end of the selection when calling _find(),
	// we need to work around that so the selection doesn't keep resetting. This happens in the case of fillWithSelection.
	bar.__find = function(aValue) {
		if(FITFull)
			return this.nsITypeAheadFind.FIND_FOUND;
		
		if(this._dispatchFindEvent && !this._dispatchFindEvent(""))
			return this.nsITypeAheadFind.FIND_PENDING;
		
		var val = aValue || this._findField.value;
		var res = this.nsITypeAheadFind.FIND_NOTFOUND;
		
		// Only search on input if we don't have a last-failed string,
		// or if the current search string doesn't start with it.
		if(this._findFailedString == null || val.indexOf(this._findFailedString) != 0) {
			this._enableFindButtons(val);
			if(this.getElement("highlight").checked)
				this._setHighlightTimeout();
			
			this._updateCaseSensitivity(val);
			
			if(doFastFind) {
				// This is what resets the caret
				var fastFind = this.browser.fastFind;
				res = fastFind.find(val, this._findMode == this.FIND_LINKS);
			} else {
				res = workAroundFastFind(val);
			}
			
			this._updateFoundLink(res);
			this._updateStatusUI(res, false);
			
			if (res == this.nsITypeAheadFind.FIND_NOTFOUND)
				this._findFailedString = val;
			else
				this._findFailedString = null;
		}
		
		if (this._findMode != this.FIND_NORMAL)
			this._setFindCloseTimeout();
		
		if (this._findResetTimeout != -1)
			window.clearTimeout(this._findResetTimeout);
		
		// allow a search to happen on input again after a second has
		// expired since the previous input, to allow for dynamic
		// content and/or page loading
		this._findResetTimeout = window.setTimeout(function(self) {
			self._findFailedString = null;
			self._findResetTimeout = -1; },
		1000, this);
		
		return res;
	};
};

this.baseDeinit = function(bar) {
	if(!FITFull) {
		bar.open = bar._open;
		bar.close = bar._close;
		bar._updateFindUI = bar.__updateFindUI;
		bar._updateStatusUI = bar.__updateStatusUI;
		delete bar._open;
		delete bar._close;
		delete bar.__updateFindUI;
		delete bar.__updateStatusUI;
		delete bar.linkedPanel;
		
		bar._findStatusDesc.hidden = false;
		bar._findStatusIcon.hidden = false;
	}
	
	bar._find = bar.___find;
	delete bar.___find;
	delete bar.__find;
};

this.cancelEvent = function(e) {
	e.preventDefault();
	e.stopPropagation();
	return false;
};

// Support for per-tab findbar introduced in FF25.
// This method works with all versions of firefox.
this.initRoutines = {};

this.initFindBar = function(name, init, deinit, force) {
	if(!force && initRoutines[name]) { return; }
	initRoutines[name] = { init: init, deinit: deinit };
	
	if(FITFull || viewSource || !perTabFB) {
		if(force || !gFindBar[objName+'_initialized'] || !gFindBar[objName+'_initialized'][name]) {
			if(!gFindBar[objName+'_initialized']) {
				gFindBar[objName+'_initialized'] = { length: 0 };
			}
			init(gFindBar);
			if(!gFindBar[objName+'_initialized'][name]) {
				gFindBar[objName+'_initialized'].length++;
			}
			gFindBar[objName+'_initialized'][name] = true;
		}
	} else {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var tab = gBrowser.mTabs[t];
			if(gBrowser.isFindBarInitialized(tab)) {
				var bar = gBrowser.getFindBar(tab);
				if(force || !bar[objName+'_initialized'] || !bar[objName+'_initialized'][name]) {
					if(!bar[objName+'_initialized']) {
						bar[objName+'_initialized'] = { length: 0 };
					}
					init(bar);
					if(!bar[objName+'_initialized'][name]) {
						bar[objName+'_initialized'].length++;
					}
					bar[objName+'_initialized'][name] = true;
				}
			}
		}
	}
};

this.deinitFindBar = function(name) {
	if(!initRoutines[name]) { return; }
	var deinit = initRoutines[name].deinit;
	delete initRoutines[name];
	
	if(FITFull || viewSource || !perTabFB) {
		if(gFindBar[objName+'_initialized'] && gFindBar[objName+'_initialized'][name]) {
			deinit(gFindBar);
			delete gFindBar[objName+'_initialized'][name];
			gFindBar[objName+'_initialized'].length--;
			if(gFindBar[objName+'_initialized'].length == 0) {
				delete gFindBar[objName+'_initialized'];
			}
		}
	} else {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var tab = gBrowser.mTabs[t];
			if(gBrowser.isFindBarInitialized(tab)) {
				var bar = gBrowser.getFindBar(tab);
				if(bar[objName+'_initialized'] && bar[objName+'_initialized'][name]) {
					deinit(bar);
					delete bar[objName+'_initialized'][name];
					bar[objName+'_initialized'].length--;
					if(bar[objName+'_initialized'].length == 0) {
						delete bar[objName+'_initialized'];
					}
				}
			}
		}
	}
};

this.initializeListener = function(e) {
	var bar = e.target._findBar;
	if(!bar) { return; }
	
	bar[objName+'_initialized'] = { length: 0 };
	for(var r in initRoutines) {
		initRoutines[r].init(bar);
		bar[objName+'_initialized'][r] = true;
		bar[objName+'_initialized'].length++;
	}
};

this.tabSelectBaseListener = function() {
	dispatch(gBrowser.tabContainer, { type: 'TabSelectPrevious', cancelable: false });
	currentTab = gBrowser.mCurrentTab;
};

moduleAid.LOADMODULE = function() {
	if(!FITFull && !viewSource && perTabFB) {
		listenerAid.add(gBrowser.tabContainer, "TabSelect", tabSelectBaseListener);
		tabSelectBaseListener();
		
		listenerAid.add(window, 'TabFindInitialized', initializeListener);
	}
	
	initFindBar('base', baseInit, baseDeinit);
};

moduleAid.UNLOADMODULE = function() {
	deinitFindBar('base');
	
	if(!FITFull && !viewSource && perTabFB) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", tabSelectBaseListener);
		listenerAid.remove(window, 'TabFindInitialized', initializeListener);
	}
	
	/* Prevent a ZC */
	if(FITFull || viewSource || !perTabFB) {
		delete gFindBar[objName+'_initialized']
	} else {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var tab = gBrowser.mTabs[t];
			if(gBrowser.isFindBarInitialized(tab)) {
				var bar = gBrowser.getFindBar(tab);
				delete bar[objName+'_initialized'];
			}
		}
	}
};
