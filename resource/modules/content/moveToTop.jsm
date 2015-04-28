Modules.VERSION = '1.0.0';

this.__defineGetter__('PDFJSloadingBar', function() { return $('loadingBar') && $('loadingBar').clientHeight; });

this.containerPDFResize = function() {
	if(!isPDFJS) {
		Listeners.remove(content, 'resize', containerPDFResize, true);
		Timers.cancel('containerPDFResize');
		return;
	}
	
	Timers.init('containerPDFResize', function() {
		Finder.syncPDFJS();
	}, 0);
};

this.finderTopListener = {
	onPDFJS: function() {
		if(isPDFJS) {
			if(PDFJSloadingBar) {
				// Make sure we move the find bar back to its place when the loading bar is hidden
				Timers.init('moveTopPDFJSLoadingBar', function() {
					try {
						if(!isPDFJS || !PDFJSloadingBar) {
							Timers.cancel('moveTopPDFJSLoadingBar');
							Finder.syncPDFJS();
						}
					}
					catch(ex) {
						Timers.cancel('moveTopPDFJSLoadingBar');
					}
				}, 50, 'slack');
			}
			
			Listeners.add(content, 'resize', containerPDFResize, true);
		}
		else {
			Listeners.remove(content, 'resize', containerPDFResize, true);
		}
	}
};

Modules.LOADMODULE = function() {
	Finder._syncPDFJS.__defineGetter__('loadingBar', function() { return PDFJSloadingBar; });
	Finder._syncPDFJS.__defineGetter__('toolbar', function() { return !!$('toolbarViewer'); });
	Finder._syncPDFJS.__defineGetter__('toolbarHeight', function() { return $('toolbarViewer') && $('toolbarViewer').clientHeight; });
	Finder._syncPDFJS.__defineGetter__('sidebarWidth', function() {
		var width = 0;
		var outerContainer = $('outerContainer');
		var sidebarContainer = $('sidebarContainer');
		if(outerContainer && outerContainer.classList.contains('sidebarOpen')) {
			width = sidebarContainer.clientWidth;
		}
		return width;
	});
	
	Finder.addResultListener(finderTopListener);
	
	// make sure the info stays updated
	Finder.syncPDFJS();
};

Modules.UNLOADMODULE = function() {
	Timers.cancel('moveTopPDFJSLoadingBar');
	Timers.cancel('containerPDFResize');
	
	Finder.removeResultListener(finderTopListener);
	Listeners.remove(content, 'resize', containerPDFResize, true);
	
	delete Finder._syncPDFJS.loadingBar;
	delete Finder._syncPDFJS.toolbar;
	delete Finder._syncPDFJS.toolbarHeight;
	delete Finder._syncPDFJS.sidebarWidth;
};
