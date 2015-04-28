Modules.VERSION = '1.0.2';

this.watchS3Bar = function() {
	if(Prefs.movetoTop && gFindBarInitialized && !gFindBar.hidden && typeof(moveTop) != 'undefined') {
		moveTop();
	}
};

Modules.LOADMODULE = function() {
	Watchers.addAttributeWatcher($('s3downbar_toolbar_panel'), 'collapsed', watchS3Bar);
};

Modules.UNLOADMODULE = function() {
	Watchers.removeAttributeWatcher($('s3downbar_toolbar_panel'), 'collapsed', watchS3Bar);
};
