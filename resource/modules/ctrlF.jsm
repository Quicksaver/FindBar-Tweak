Modules.VERSION = '2.0.0';

this.ctrlF = function() {
	// See if there is text selection and if it's the same as the findbar's value
	if(Prefs.ctrlFClosesOnValue && Prefs.FAYTprefill && !gFindBar.hidden) {
		Finder.getTextSelection.then(selText => {
			if(selText && selText != findQuery) {
				openFindBar();
				return;
			}
			
			ctrlFToggles();
		});
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
