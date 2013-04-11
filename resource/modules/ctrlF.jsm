moduleAid.VERSION = '1.0.0';

// Handler for Ctrl+F, it closes the findbar if it is already opened
this.ctrlF = function(event) {
	if(window.TabView.isVisible()) {
		window.TabView.enableSearch(event);
	}
	else {
		if(gFindBar.hidden || !prefAid.ctrlFCloses) {
			gFindBar.onFindCommand();
			gFindBar.open();
			if(gFindBar._findField.value) {
				gFindBar._setHighlightTimeout();
			}
		}
		else {
			gFindBar.close();
		}
	}
};

moduleAid.LOADMODULE = function() {
	overlayAid.overlayURI('chrome://browser/content/browser.xul', 'ctrlF');
};

moduleAid.UNLOADMODULE = function() {
	if(UNLOADED || !prefAid.ctrlFCloses) {
		overlayAid.removeOverlayURI('chrome://browser/content/browser.xul', 'ctrlF');
	}
};
