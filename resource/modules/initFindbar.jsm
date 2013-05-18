moduleAid.VERSION = '1.1.6';

this.__defineGetter__('gFindBar', function() { return window.gFindBar || $('FindToolbar'); });
this.__defineGetter__('gBrowser', function() { return window.gBrowser; });
this.__defineGetter__('linkedPanel', function() { return (viewSource) ? $('appcontent') : $(gBrowser.mCurrentTab.linkedPanel); });
this.__defineGetter__('contentDocument', function() { return (!viewSource) ? gBrowser.mCurrentBrowser.contentDocument : $('content').contentDocument; });
this.__defineGetter__('browserPanel', function() { return $('browser-panel') || viewSource; });

this._getFindBarHidden = function() { return gFindBar.hidden; };
this.__defineGetter__('findBarHidden', function() { return _getFindBarHidden(); });
this.__defineSetter__('findBarHidden', function(v) { return gFindBar.hidden = v; });

moduleAid.LOADMODULE = function() { printO(gFindBar);
	gFindBar._open = gFindBar.open;
	gFindBar.open = function(aMode) {
		if(dispatch(gFindBar, { type: 'WillOpenFindBar', detail: aMode })) {
			var ret = this._open(aMode);
			dispatch(this, { type: 'OpenedFindBar', cancelable: false, detail: aMode });
			return ret;
		}
		return false;
	};
	gFindBar._close = gFindBar.close;
	gFindBar.close = function() {
		if(dispatch(gFindBar, { type: 'WillCloseFindBar' })) {
			this._close();
			dispatch(this, { type: 'ClosedFindBar', cancelable: false });
		}
	};
	gFindBar.__updateFindUI = gFindBar._updateFindUI;
	gFindBar._updateFindUI = function() {
		if(dispatch(gFindBar, { type: 'WillUpdateUIFindBar' })) {
			this.__updateFindUI();
			dispatch(this, { type: 'UpdatedUIFindBar', cancelable: false });
		}
	};
	gFindBar.__updateStatusUI = gFindBar._updateStatusUI;
	gFindBar._updateStatusUI = function(res, aFindPrevious) {
		if(dispatch(gFindBar, { type: 'WillUpdateStatusFindBar', detail: { res: res, aFindPrevious: aFindPrevious } })) {
			this.__updateStatusUI(res, aFindPrevious);
			this._findStatusDesc.hidden = !this._findStatusDesc.textContent;
			this._findStatusIcon.hidden = !this._findStatusIcon.getAttribute('status');
			dispatch(this, { type: 'UpdatedStatusFindBar', cancelable: false, detail: { res: res, aFindPrevious: aFindPrevious } });
		}
	};
	gFindBar.__find = gFindBar._find;
	gFindBar._find = function(aValue) {
		if(dispatch(this, { type: 'WillFindFindBar', detail: aValue })) {
			var ret = this.__find(aValue);
			dispatch(this, { type: 'FoundFindBar', cancelable: false, detail: { aValue: aValue, retValue: ret } });
			return ret;
		}
		return null;
	};
};

moduleAid.UNLOADMODULE = function() {
	gFindBar.open = gFindBar._open;
	gFindBar.close = gFindBar._close;
	gFindBar._updateFindUI = gFindBar.__updateFindUI;
	gFindBar._updateStatusUI = gFindBar.__updateStatusUI;
	gFindBar._find = gFindBar.__find;
	delete gFindBar._open;
	delete gFindBar._close;
	delete gFindBar.__updateFindUI;
	delete gFindBar.__updateStatusUI;
	delete gFindBar.__find;
	
	gFindBar._findStatusDesc.hidden = false;
	gFindBar._findStatusIcon.hidden = false;
};
