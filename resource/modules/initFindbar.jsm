moduleAid.VERSION = '2.0.3';

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

this.baseInit = function(bar) {
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
	bar.__find = bar._find;
	bar._find = function(aValue) {
		var suffix = (perTabFB && !viewSource && this.linkedPanel != gBrowser.mCurrentTab.linkedPanel) ? 'AnotherTab' : '';
		
		if(dispatch(this, { type: 'WillFindFindBar'+suffix, detail: aValue })) {
			var ret = this.__find(aValue);
			dispatch(this, { type: 'FoundFindBar'+suffix, cancelable: false, detail: { aValue: aValue, retValue: ret } });
			return ret;
		}
		return null;
	};
	
	if(perTabFB) {
		bar.__defineGetter__('linkedPanel', function() { return this.parentNode.parentNode.parentNode.id; });
	}
};

this.baseDeinit = function(bar) {
	bar.open = bar._open;
	bar.close = bar._close;
	bar._updateFindUI = bar.__updateFindUI;
	bar._updateStatusUI = bar.__updateStatusUI;
	bar._find = bar.__find;
	delete bar._open;
	delete bar._close;
	delete bar.__updateFindUI;
	delete bar.__updateStatusUI;
	delete bar.__find;
	delete bar.linkedPanel;
	
	bar._findStatusDesc.hidden = false;
	bar._findStatusIcon.hidden = false;
};

// Support for per-tab findbar introduced in FF25.
// This method works with all versions of firefox.
this.initRoutines = {};

this.initFindBar = function(name, init, deinit, force) {
	if(!force && initRoutines[name]) { return; }
	initRoutines[name] = { init: init, deinit: deinit };
	
	if(viewSource || !perTabFB) {
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
	
	if(viewSource || !perTabFB) {
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
	if(!viewSource && perTabFB) {
		listenerAid.add(gBrowser.tabContainer, "TabSelect", tabSelectBaseListener);
		tabSelectBaseListener();
		
		listenerAid.add(window, 'TabFindInitialized', initializeListener);
	}
	
	initFindBar('base', baseInit, baseDeinit);
};

moduleAid.UNLOADMODULE = function() {
	deinitFindBar('base');
	
	if(!viewSource && perTabFB) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", tabSelectBaseListener);
		listenerAid.remove(window, 'TabFindInitialized', initializeListener);
	}
	
	/* Prevent a ZC */
	if(viewSource || !perTabFB) {
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
