moduleAid.VERSION = '1.0.1';

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
	if(!isAncestor(focusedNode, gFindBar) && !isAncestor(focusedNode, $('findBarMenu'))) {
		gFindBar.close();
	}
};

this.blurClosesTabSelect = function() {
	gFindBar.close();
};

moduleAid.LOADMODULE = function() {
	if(!gFindBar.hidden) {
		gFindBar.close();
	}
	
	listenerAid.add(gFindBar, 'OpenedFindBar', blurClosesAdd);
	listenerAid.add(gFindBar, 'ClosedFindBar', blurClosesRemove);
	
	if(!viewSource) {
		listenerAid.add(gBrowser.tabContainer, "TabSelect", blurClosesTabSelect);
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'OpenedFindBar', blurClosesAdd);
	listenerAid.remove(gFindBar, 'ClosedFindBar', blurClosesRemove);
	blurClosesRemove();
	
	if(!viewSource) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", blurClosesTabSelect);
	}
};
