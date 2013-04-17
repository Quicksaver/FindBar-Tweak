moduleAid.VERSION = '1.0.0';

this.TSTmoveTopCollapsed = function() {
	if(prefAid.movetoTop) {
		moveTop();
	}
};

moduleAid.LOADMODULE = function() {
	objectWatcher.addAttributeWatcher($('TabsToolbar'), 'collapsed', TSTmoveTopCollapsed);
};

moduleAid.UNLOADMODULE = function() {
	objectWatcher.removeAttributeWatcher($('TabsToolbar'), 'collapsed', TSTmoveTopCollapsed);
};
