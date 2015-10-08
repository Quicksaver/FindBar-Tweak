Modules.VERSION = '1.0.0';

this.findbarUI = {
	onPDFJS: function() {
		if(!isPDFJS) { return; }
		
		Watchers.addAttributeWatcher(document.body, 'class', this);
		Watchers.addAttributeWatcher($('outerContainer'), 'class', this);
	},
	
	attrWatcher: function(obj, attr, oldVal, newVal) {
		Finder.syncPDFJS();
	}
};

Modules.LOADMODULE = function() {
	Finder._syncPDFJS.__defineGetter__('loadingBar', function() { return document.body.classList.contains('loadingInProgress'); });
	Finder._syncPDFJS.__defineGetter__('sidebarOpen', function() { return $('outerContainer').classList.contains('sidebarOpen'); });
	
	Finder.addResultListener(findbarUI);
	
	// make sure the info stays updated
	Finder.syncPDFJS();
};

Modules.UNLOADMODULE = function() {
	Finder.removeResultListener(findbarUI);
	
	if(isPDFJS) {
		Watchers.removeAttributeWatcher(document.body, 'class', findbarUI);
		Watchers.removeAttributeWatcher($('outerContainer'), 'class', findbarUI);
	}
	
	delete Finder._syncPDFJS.loadingBar;
	delete Finder._syncPDFJS.sidebarOpen;
};
