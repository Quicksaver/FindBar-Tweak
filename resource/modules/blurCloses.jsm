moduleAid.VERSION = '1.2.0';

this.blurClosesAdd = function() {
	listenerAid.add(window, 'focus', delayBlurCloses, true);
};

this.blurClosesRemove = function() {
	listenerAid.remove(window, 'focus', delayBlurCloses, true);
};

// The delay is for FAYT feature, to give it time to focus the findbar and not the document window
this.delayBlurCloses = function(e) {
	timerAid.init('blurCloses', function() { blurCloses(e); }, 0);
};

this.blurCloses = function(e) {
	var focusedNode = document.commandDispatcher.focusedElement || e.target;
	if(!isAncestor(focusedNode, gFindBar)
	&& !isAncestor(focusedNode, $(objPathString+'_findbarMenu'))
	&& dispatch(gFindBar, { type: 'ClosingFindbarOnBlur', detail: focusedNode })) {
		gFindBar.close();
	}
};

this.blurClosesTabSelect = function(e) {
	if(!dispatch(currentTab._findBar, { type: 'ClosingFindbarOnBlurTabSelect' })) { return; }
	
	if(e.type == 'TabSelect') {
		gFindBar.close();
	} else if(currentTab && currentTab._findBar) {
		currentTab._findBar.close();
		if(gFindBarInitialized) {
			gFindBar.close();
		}
	}
};

moduleAid.LOADMODULE = function() {
	if(!viewSource) {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var tab = gBrowser.mTabs[t];
			if(tab._findBar && !tab._findBar.hidden) {
				tab._findBar.close();
			}
		}
	}
	
	listenerAid.add(window, 'OpenedFindBar', blurClosesAdd);
	listenerAid.add(window, 'ClosedFindBar', blurClosesRemove);
	listenerAid.add(window, 'ClosedFindBarAnotherTab', blurClosesRemove);
	
	if(!viewSource) {
		listenerAid.add(gBrowser.tabContainer, "TabSelectPrevious", blurClosesTabSelect);
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, 'OpenedFindBar', blurClosesAdd);
	listenerAid.remove(window, 'ClosedFindBar', blurClosesRemove);
	listenerAid.remove(window, 'ClosedFindBarAnotherTab', blurClosesRemove);
	
	blurClosesRemove();
	
	if(!viewSource) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelectPrevious", blurClosesTabSelect);
	}
};
