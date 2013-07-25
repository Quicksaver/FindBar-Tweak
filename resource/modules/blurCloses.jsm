moduleAid.VERSION = '1.1.0';

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
	if(!isAncestor(focusedNode, gFindBar) && !isAncestor(focusedNode, $(objPathString+'_findbarMenu'))) {
		gFindBar.close();
	}
};

this.blurClosesTabSelect = function(e) {
	if(e.type == 'TabSelect') {
		gFindBar.close();
	} else if(currentTab && currentTab._findBar) {
		currentTab._findBar.close();
	}
};

moduleAid.LOADMODULE = function() {
	if(!perTabFB) {
		if(!gFindBar.hidden) {
			gFindBar.close();
		}
	} else if(!viewSource) {
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
		if(!perTabFB) {
			listenerAid.add(gBrowser.tabContainer, "TabSelect", blurClosesTabSelect);
		} else {
			listenerAid.add(gBrowser.tabContainer, "TabSelectPrevious", blurClosesTabSelect);
		}
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, 'OpenedFindBar', blurClosesAdd);
	listenerAid.remove(window, 'ClosedFindBar', blurClosesRemove);
	listenerAid.remove(window, 'ClosedFindBarAnotherTab', blurClosesRemove);
	
	blurClosesRemove();
	
	if(!viewSource) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", blurClosesTabSelect);
		listenerAid.remove(gBrowser.tabContainer, "TabSelectPrevious", blurClosesTabSelect);
	}
};
