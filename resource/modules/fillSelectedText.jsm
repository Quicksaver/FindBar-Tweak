Modules.VERSION = '2.0.0';

this.fillSelectedText = function(m) {
	var selText = m.data;
	
	if(selText
	&& (findQuery != selText || (Prefs.highlightByDefault && !documentHighlighted))
	&& dispatch(gFindBar, { type: 'WillFillSelectedText' })) {
		findQuery = selText;
		highlightedWord = selText; // Make sure we highlight it if needed
		
		Timers.init('fillSelectedText', function() {
			Finder.workAroundFind = true;
			try { gFindBar._find(); }
			catch(ex) { Cu.reportError(ex); }
			
			// ensure we reset workAroundFind even if this errors for some reason, it shouldn't though
			Finder.workAroundFind = false;
		}, 0);
		
		if(Prefs.fillTextShowFindBar && gFindBar.hidden) {
			gFindBar.open(gFindBar.FIND_TYPEAHEAD);
			
			if(gFindBar._quickFindTimeout) {
				window.clearTimeout(gFindBar._quickFindTimeout);
			}
			
			gFindBar._quickFindTimeout = window.setTimeout(function(aSelf) {
				if(aSelf._findMode != aSelf.FIND_NORMAL) aSelf.close();
			}, gFindBar._quickFindTimeoutLength, gFindBar);
		}
	}
};

Modules.LOADMODULE = function() {
	Messenger.listenWindow(window, 'FillSelectedText', fillSelectedText);
	
	initFindBar('fillSelectedText',
		function(bar) {
			Messenger.loadInBrowser(bar.browser, 'fillSelectedText');
		},
		function(bar) {
			Messenger.unloadFromBrowser(bar.browser,  'fillSelectedText');
		}
	);
};

Modules.UNLOADMODULE = function() {
	deinitFindBar('fillSelectedText');
	
	Messenger.unlistenWindow(window, 'FillSelectedText', fillSelectedText);
};
