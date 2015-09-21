Modules.VERSION = '2.0.6';

this.globalFB = {
	hidden: true,
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'OpenedFindBar':
				// Quick Find shouldn't be global
				if(gFindBar._findMode != gFindBar.FIND_NORMAL) { return; }
				
				this.hidden = false;
				break;
			
			case 'ClosedFindBar':
				this.hidden = true;
				break;
			
			case 'TabSelectPrevious':
				// we only check the find bar state when toggling between tabs, there's no need to oveload all tabs when opening a single findbar,
				// it might not even be needed in other tabs if the user closes it afterwards.
				if(this.hidden && gFindBarInitialized && !gFindBar.hidden) {
					this.noAnimation(gFindBar);
					gFindBar.close();
				}
				else if(!this.hidden && (gFindBar.hidden || gFindBar._findMode != gFindBar.FIND_NORMAL)) {
					this.noAnimation(gFindBar);
					gFindBar.open(gFindBar.FIND_NORMAL);
				}
				
				// Copy the values of the findField from one tab to another
				if(currentTab && currentTab._findBar) {
					findQuery = currentTab._findBar._findField.value;
					gFindBar._findField.selectionStart = currentTab._findBar._findField.selectionStart;
					gFindBar._findField.selectionEnd = currentTab._findBar._findField.selectionEnd;
					gFindBar.getElement('highlight').checked = currentTab._findBar.getElement('highlight').checked;
					gFindBar.getElement('find-case-sensitive').checked = currentTab._findBar.getElement('find-case-sensitive').checked;
					gFindBar._enableFindButtons(findQuery);
					
					// try to mimic the focused status from one findbar to another.
					// I'm not sure why aSync is needed, but when sync the findbars are never focused when switching tabs
					var thisBar = gFindBar;
					if(trueAttribute(currentTab._findBar._findField, 'focused')) {
						aSync(function() {
							if(!trueAttribute(thisBar._findField, 'focused')) {
								thisBar._findField.focus();
							}
						});
					} else {
						aSync(function() {
							if(trueAttribute(thisBar._findField, 'focused')) {
								thisBar.browser.finder.focusContent();
							}
						});
					}
					
					// remove highlights from a previous search query
					if(documentHighlighted && highlightedWord && highlightedWord != findQuery) {
						highlights.off();
					}
				}
				break;
		}
	},
	
	noAnimation: function(bar) {
		setAttribute(bar, 'noAnimation', 'true');
		aSync(function() {
			removeAttribute(bar, 'noAnimation');
		}, 50);
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(gBrowser.tabContainer, "TabSelectPrevious", globalFB);
	Listeners.add(window, 'OpenedFindBar', globalFB);
	Listeners.add(window, 'ClosedFindBar', globalFB);
	
	globalFB.hidden = !gFindBarInitialized || gFindBar.hidden || gFindBar._findMode != gFindBar.FIND_NORMAL;
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(gBrowser.tabContainer, "TabSelectPrevious", globalFB);
	Listeners.remove(window, 'OpenedFindBar', globalFB);
	Listeners.remove(window, 'ClosedFindBar', globalFB);
	
	for(let tab of gBrowser.tabs) {
		// leave the findbar in the current tab as it is
		if(tab == gBrowser.mCurrentTab) { continue; }
		
		if(gBrowser.isFindBarInitialized(tab) && !tab.linkedBrowser.finder.searchString) {
			let bar = gBrowser.getFindBar(tab);
			if(!bar.hidden) {
				bar.close();
			}
		}
	}
};
