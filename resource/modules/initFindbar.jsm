moduleAid.VERSION = '2.2.13';

this.__defineGetter__('gFindBar', function() { return window.gFindBar || $('FindToolbar'); });
this.__defineGetter__('gFindBarInitialized', function() { return window.gFindBarInitialized; });
this.__defineGetter__('gBrowser', function() { return window.gBrowser; });
this.__defineGetter__('linkedPanel', function() { return (viewSource) ? $('appcontent') : $(gBrowser.mCurrentTab.linkedPanel); });
this.__defineGetter__('contentDocument', function() { return (!viewSource) ? gBrowser.mCurrentBrowser.contentDocument : $('content').contentDocument; });
this.__defineGetter__('browserPanel', function() { return $('browser-panel') || viewSource; });
this.getComputedStyle = function(el) { return window.getComputedStyle(el); };

if(mFinder) {
	this._getCurrentWindowForBrowser = function(browser) { return browser.finder._fastFind.currentWindow || browser.contentWindow; };
} else {
	this._getCurrentWindowForBrowser = function(browser) { return browser._fastFind.currentWindow || browser.contentWindow; };
}
this.__defineGetter__('contentWindow', function() { return _getCurrentWindowForBrowser(gFindBar.browser); });

this.inPDFJS = function(aDoc) { return (aDoc && aDoc.contentType == 'application/pdf' && aDoc.baseURI == 'resource://pdf.js/web/'); };
this.__defineGetter__('isPDFJS', function() { return inPDFJS(contentDocument); });

this._getFindBarHidden = function() { return gFindBar.hidden; };
this.__defineGetter__('findBarHidden', function() { return _getFindBarHidden(); });
this.__defineSetter__('findBarHidden', function(v) { return gFindBar.hidden = v; });

this.__defineGetter__('isCurrentBrowserValid', function() {
	// this one is obvious
	if(trueAttribute($('cmd_find'), 'disabled')) { return false; }
	
	return isBrowserValid(gBrowser.mCurrentBrowser);
});

this.isBrowserValid = function(browser) {
	// Let's try to do as less checks as possible to boost performance
	if(!browser) { return false; }
	
	// This should be a very good approximation of where we should be able to use the find bar
	// Listeners should preventDefault IsBrowserValid event if it is a valid webpage
	return	(browser.contentDocument instanceof Ci.nsIDOMHTMLDocument)
		|| (browser.contentDocument instanceof Ci.nsIDOMXMLDocument)
		|| !dispatch(browser, { type: 'IsBrowserValid' })
	;
};

this.currentTab = null;

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
	
	bar._close = bar.close;
	bar.close = function() {
		if(FITFull) {
			window.close();
			return;
		}
		
		var suffix = (perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
		
		if(dispatch(this, { type: 'WillCloseFindBar'+suffix })) {
			this._close();
			dispatch(this, { type: 'ClosedFindBar'+suffix, cancelable: false });
		}
	};
	
	bar.__find = bar._find;
	bar._find = function(aValue) {
		var suffix = (!FITFull && perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
		
		if(dispatch(this, { type: 'WillFindFindBar'+suffix, detail: aValue })) {
			if(FITFull || (this._dispatchFindEvent && !this._dispatchFindEvent(""))) {
				dispatch(this, { type: 'FoundFindBar'+suffix, cancelable: false, detail: { aValue: aValue, retValue: this.nsITypeAheadFind.FIND_PENDING } });
				return this.nsITypeAheadFind.FIND_PENDING;
			}
			
			var val = aValue || this._findField.value;
			var res = this.nsITypeAheadFind.FIND_NOTFOUND;
			
			if(perTabFB && !viewSource) {
				gBrowser._lastFindValue = val;
			}
			
			if(mFinder) {
				// We have to carry around an explicit version of this,
				// because finder.searchString doesn't update on failed
				// searches.
				this.browser._lastSearchString = val;
			}
			
			// Only search on input if we don't have a last-failed string,
			// or if the current search string doesn't start with it.
			// https://bugzilla.mozilla.org/show_bug.cgi?id=926033
			if(!this._findFailedString || val.indexOf(this._findFailedString) != 0) {
				this._enableFindButtons(val);
				if(this.getElement("highlight").checked)
					this._setHighlightTimeout();
				
				this._updateCaseSensitivity(val);
				
				res = tweakFastFind(this.browser, val, this._findMode == this.FIND_LINKS, this._findMode != this.FIND_NORMAL);
				
				if(!mFinder) {
					this._updateFoundLink(res);
					this._updateStatusUI(res, false);
					
					if (res == this.nsITypeAheadFind.FIND_NOTFOUND)
						this._findFailedString = val;
					else
						this._findFailedString = null;
				}
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
			
			dispatch(this, { type: 'FoundFindBar'+suffix, cancelable: false, detail: { aValue: aValue, retValue: res } });
			return res;
		}
		return null;
	};
	
	bar.__findAgain = bar._findAgain;
	bar._findAgain = function(aFindPrevious) {
		var suffix = (perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
		
		if(dispatch(this, { type: 'WillFindAgain'+suffix, detail: { aFindPrevious: aFindPrevious } })) {
			var res = tweakFindAgain(this.browser, aFindPrevious, this._findMode == this.FIND_LINKS, this._findMode != this.FIND_NORMAL);
			
			if(!mFinder) {
				this._updateFoundLink(res);
				this._updateStatusUI(res, aFindPrevious);
				
				if (this._findMode != this.FIND_NORMAL && !this.hidden)
					this._setFindCloseTimeout();
			}
			
			dispatch(this, { type: 'FoundAgain'+suffix, cancelable: false, detail: { aFindPrevious: aFindPrevious, retValue: res } });
			return res;
		}
		return null;
	};
	
	bar._onFindAgainCommand = bar.onFindAgainCommand;
	bar.onFindAgainCommand = function(aFindPrevious) {
		var suffix = (perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
		
		if(dispatch(this, { type: 'WillFindAgainCommand'+suffix, detail: { aFindPrevious: aFindPrevious } })) {
			this._onFindAgainCommand(aFindPrevious);
			dispatch(this, { type: 'FoundAgainCommand'+suffix, cancelable: false, detail: { aFindPrevious: aFindPrevious } });
		}
	};
	
	// Changing the pref doesn't automatically update this value
	bar.__quickFindTimeoutLength = bar._quickFindTimeoutLength;
	delete bar._quickFindTimeoutLength;
	bar.__defineGetter__('_quickFindTimeoutLength', function() { return prefAid.FAYTtimeout; });
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
	
	delete bar._quickFindTimeoutLength;
	bar._quickFindTimeoutLength = bar.__quickFindTimeoutLength;
	delete bar.__quickFindTimeoutLength;
	
	bar._find = bar.__find;
	bar._findAgain = bar.__findAgain;
	bar.onFindAgainCommand = bar._onFindAgainCommand;
	delete bar.__find;
	delete bar.__findAgain;
	delete bar._onFindAgainCommand;
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
