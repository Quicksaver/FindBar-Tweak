Modules.VERSION = '1.0.1';

this.TSTmoveTopCollapsed = function() {
	if(Prefs.movetoTop) {
		moveTop();
	}
};

Modules.LOADMODULE = function() {
	Watchers.addAttributeWatcher($('TabsToolbar'), 'collapsed', TSTmoveTopCollapsed);
};

Modules.UNLOADMODULE = function() {
	Watchers.removeAttributeWatcher($('TabsToolbar'), 'collapsed', TSTmoveTopCollapsed);
};
