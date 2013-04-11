moduleAid.VERSION = '1.0.0';

this.__defineGetter__('gFindBar', function() { return window.gFindBar; });

moduleAid.LOADMODULE = function() {
	gFindBar._open = gFindBar.open;
	gFindBar.open = function(aMode) {
		if(dispatch(gFindBar, { type: 'WillOpenFindBar', detail: aMode })) {
			gFindBar._open(aMode);
			dispatch(gFindBar, { type: 'OpenedFindBar', cancelable: false, detail: aMode });
		}
	};
	gFindBar._close = gFindBar.close;
	gFindBar.close = function() {
		if(dispatch(gFindBar, { type: 'WillCloseFindBar' })) {
			gFindBar._close();
			dispatch(gFindBar, { type: 'ClosedFindBar', cancelable: false });
		}
	};
	gFindBar.__updateFindUI = gFindBar._updateFindUI;
	gFindBar._updateFindUI = function() {
		if(dispatch(gFindBar, { type: 'WillUpdateUIFindBar' })) {
			gFindBar.__updateFindUI();
			dispatch(gFindBar, { type: 'UpdatedUIFindBar', cancelable: false });
		}
	};
	gFindBar.__updateStatusUI = gFindBar._updateStatusUI;
	gFindBar._updateStatusUI = function(res, aFindPrevious) {
		if(dispatch(gFindBar, { type: 'WillUpdateStatusFindBar', detail: { res: res, aFindPrevious: aFindPrevious } })) {
			gFindBar.__updateStatusUI(res, aFindPrevious);
			dispatch(gFindBar, { type: 'UpdatedStatusFindBar', cancelable: false, detail: { res: res, aFindPrevious: aFindPrevious } });
		}
	};
	gFindBar.__find = gFindBar._find;
	gFindBar._find = function(aValue) {
		if(dispatch(gFindBar, { type: 'WillFindFindBar', detail: aValue })) {
			gFindBar.__find(aValue);
			dispatch(gFindBar, { type: 'FoundFindBar', cancelable: false });
		}
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
};
