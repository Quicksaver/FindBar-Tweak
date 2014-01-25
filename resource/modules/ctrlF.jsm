moduleAid.VERSION = '1.3.3';

this.ctrlF = function(event) {
	// Pale Moon doesn't have TabView
	if(!viewSource && window.TabView && window.TabView.isVisible()) {
		window.TabView.enableSearch(event);
		return;
	}
	
	// See if there is text selection and if it's the same as the findbar's value
	if(prefAid.ctrlFClosesOnValue && prefAid.FAYTprefill && !gFindBar.hidden) {
		var selText = gFindBar._getInitialSelection();
		if(selText && selText != gFindBar._findField.value) {
			openFindBar();
			return;
		}
	}
	
	if(prefAid.ctrlFCloses) {
		toggleFindBar(event);
	} else {
		openFindBar();
	}
};

moduleAid.LOADMODULE = function() {
	this.backups = {
		oncommand: $('cmd_find').getAttribute('oncommand')
	};
	setAttribute($('cmd_find'), 'oncommand', objName+'.ctrlF(event);');
};

moduleAid.UNLOADMODULE = function() {
	if(this.backups) {
		setAttribute($('cmd_find'), 'oncommand', this.backups.oncommand);
		delete this.backups;
	}
};
