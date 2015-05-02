Modules.VERSION = '2.0.0';

this.blurCloses = {
	handleEvent: function(e) {
		switch(e.type) {
			'focus':
				// The timer is for FAYT feature, to give it time to focus the findbar and not the document window
				Timers.init('blurCloses', () => {
					var focusedNode = document.commandDispatcher.focusedElement || e.target;
					if(!isAncestor(focusedNode, gFindBar)
					&& !isAncestor(focusedNode, $(objPathString+'_findbarMenu'))
					&& dispatch(gFindBar, { type: 'ClosingFindbarOnBlur', detail: focusedNode })) {
						gFindBar.close();
					}
				}, 0);
				break;
			
			'OpenedFindBar':
				Listeners.add(window, 'focus', this, true);
				break;
			
			'ClosedFindBar':
			'ClosedFindBarBackground':
				Listeners.remove(window, 'focus', this, true);
				break;
			
			'TabSelectPrevious':
				if(currentTab && currentTab._findBar) {
					currentTab._findBar.close();
					if(gFindBarInitialized) {
						gFindBar.close();
					}
				}
				break;
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
	
	Listeners.add(window, 'OpenedFindBar', blurCloses);
	Listeners.add(window, 'ClosedFindBar', blurCloses);
	Listeners.add(window, 'ClosedFindBarBackground', blurCloses);
	
	if(!viewSource) {
		Listeners.add(gBrowser.tabContainer, "TabSelectPrevious", blurCloses);
	}
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, 'OpenedFindBar', blurCloses);
	Listeners.remove(window, 'ClosedFindBar', blurCloses);
	Listeners.remove(window, 'ClosedFindBarBackground', blurCloses);
	Listeners.remove(window, 'focus', blurCloses, true);
	
	if(!viewSource) {
		Listeners.remove(gBrowser.tabContainer, "TabSelectPrevious", blurCloses);
	}
};
