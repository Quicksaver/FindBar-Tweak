moduleAid.VERSION = '1.0.0';

this.blurClosesAdd = function() {
	listenerAid.add(window, 'focus', blurCloses, true);
};

this.blurClosesRemove = function() {
	listenerAid.remove(window, 'focus', blurCloses, true);
};

this.blurCloses = function(e) {
	var focusedNode = document.commandDispatcher.focusedElement || e.target;
	if(!isAncestor(focusedNode, gFindBar) && !isAncestor(focusedNode, $('findBarMenu'))) {
		gFindBar.close();
	}
};

moduleAid.LOADMODULE = function() {
	if(!gFindBar.hidden) {
		gFindBar.close();
	}
	
	listenerAid.add(gFindBar, 'OpenedFindBar', blurClosesAdd);
	listenerAid.add(gFindBar, 'ClosedFindBar', blurClosesRemove);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'OpenedFindBar', blurClosesAdd);
	listenerAid.remove(gFindBar, 'ClosedFindBar', blurClosesRemove);
	blurClosesRemove();
};
