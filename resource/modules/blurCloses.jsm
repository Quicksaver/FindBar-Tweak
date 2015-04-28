Modules.VERSION = '1.2.1';

this.blurClosesAdd = function() {
	Listeners.add(window, 'focus', delayBlurCloses, true);
};

this.blurClosesRemove = function() {
	Listeners.remove(window, 'focus', delayBlurCloses, true);
};

// The delay is for FAYT feature, to give it time to focus the findbar and not the document window
this.delayBlurCloses = function(e) {
	Timers.init('blurCloses', () => { blurCloses(e); }, 0);
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
	if(e.type == 'TabSelect') {
		gFindBar.close();
	} else if(currentTab && currentTab._findBar) {
		currentTab._findBar.close();
		if(gFindBarInitialized) {
			gFindBar.close();
		}
	}
};

Modules.LOADMODULE = function() {
	if(!viewSource) {
		for(var tab of gBrowser.tabs) {
			if(tab._findBar && !tab._findBar.hidden) {
				tab._findBar.close();
			}
		}
	}
	
	Listeners.add(window, 'OpenedFindBar', blurClosesAdd);
	Listeners.add(window, 'ClosedFindBar', blurClosesRemove);
	Listeners.add(window, 'ClosedFindBarBackground', blurClosesRemove);
	
	if(!viewSource) {
		Listeners.add(gBrowser.tabContainer, "TabSelectPrevious", blurClosesTabSelect);
	}
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, 'OpenedFindBar', blurClosesAdd);
	Listeners.remove(window, 'ClosedFindBar', blurClosesRemove);
	Listeners.remove(window, 'ClosedFindBarBackground', blurClosesRemove);
	
	blurClosesRemove();
	
	if(!viewSource) {
		Listeners.remove(gBrowser.tabContainer, "TabSelectPrevious", blurClosesTabSelect);
	}
};
