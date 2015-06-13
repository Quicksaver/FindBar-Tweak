Modules.VERSION = '2.1.0';

this.ctrlF = function() {
	// See if the findbar should only be closed when it's focused
	if(Prefs.ctrlFClosesOnFocused && !gFindBar.hidden && !isAncestor(document.commandDispatcher.focusedElement, gFindBar)) {
		openFindBar();
		return;
	}
	
	ctrlFToggles();
};
	
this.ctrlFToggles = function() {
	if(Prefs.ctrlFCloses) {
		toggleFindBar();
	} else {
		openFindBar();
	}
};

Modules.LOADMODULE = function() {
	this.backups = {
		oncommand: $('cmd_find').getAttribute('oncommand')
	};
	setAttribute($('cmd_find'), 'oncommand', objName+'.ctrlF(event);');
};

Modules.UNLOADMODULE = function() {
	if(this.backups) {
		setAttribute($('cmd_find'), 'oncommand', this.backups.oncommand);
		delete this.backups;
	}
};
