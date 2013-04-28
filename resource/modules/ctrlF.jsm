moduleAid.VERSION = '1.1.1';

// Handler for Ctrl+F, it closes the findbar if it is already opened
this.ctrlF = function(event) {
	if(!viewSource && window.TabView.isVisible()) {
		window.TabView.enableSearch(event);
	}
	else {
		if(gFindBar.hidden) {
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
	overlayAid.overlayURI('chrome://global/content/viewSource.xul', 'ctrlF');
	overlayAid.overlayURI('chrome://global/content/viewPartialSource.xul', 'ctrlF');
};

moduleAid.UNLOADMODULE = function() {
	if(UNLOADED || !prefAid.ctrlFCloses) {
		overlayAid.removeOverlayURI('chrome://browser/content/browser.xul', 'ctrlF');
		overlayAid.removeOverlayURI('chrome://global/content/viewSource.xul', 'ctrlF');
		overlayAid.removeOverlayURI('chrome://global/content/viewPartialSource.xul', 'ctrlF');
	}
};
