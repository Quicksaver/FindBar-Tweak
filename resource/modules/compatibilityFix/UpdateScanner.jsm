Modules.VERSION = '2.0.3';

this.UpdateScanner = {
	handleEvent: function(e) {
		switch(e.type) {
			case 'IsFinderValid':
				if(e.target.currentURI.spec.startsWith('chrome://updatescan/')) {
					e.preventDefault();
					e.stopPropagation();
				}
				break;
			
			case 'AdjustFrameGrid':
				this.adjustGrid();
				break;
		}
	},
	
	observe: function(aSubject, aTopic, aData) {
		this.gridColors();
	},
	
	adjustGrid: function() {
		if(!grids.lastAdjust) { return; }
		
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document url-prefix("chrome://updatescan/") {\n\
				hbox[ownedbyfindbartweak][anonid="gridBox"] vbox[anonid="findGrid"] {\n' +
					grids.lastAdjust + '\
				}\n\
			}\n';
		
		Styles.load('adjustUpdateScannerFrameGrid_'+_UUID, sscode, true);
	},
	
	gridColors: function() {
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document url-prefix("chrome://updatescan/") {\n\
				hbox[ownedbyfindbartweak][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight]:not([current]):not([hover]) {\n\
					background-color: '+Prefs.highlightColor+';\n\
				}\n\
				hbox[ownedbyfindbartweak][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight][current],\n\
				hbox[ownedbyfindbartweak][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight][hover] {\n\
					background-color: '+Prefs.selectColor+';\n\
				}\n\
			}';
		
		Styles.load('ColorUpdateScannerFrameGrid_'+_UUID, sscode, true);
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(window, "IsFinderValid", UpdateScanner, true);
	Listeners.add(window, "AdjustFrameGrid", UpdateScanner);
	
	Prefs.listen('highlightColor', UpdateScanner);
	Prefs.listen('selectColor', UpdateScanner);
	
	UpdateScanner.adjustGrid();
	UpdateScanner.gridColors();
};

Modules.UNLOADMODULE = function() {
	Styles.unload('adjustUpdateScannerFrameGrid_'+_UUID);
	Styles.unload('ColorUpdateScannerFrameGrid_'+_UUID);
	
	Listeners.remove(window, "IsFinderValid", UpdateScanner, true);
	Listeners.remove(window, "AdjustFrameGrid", UpdateScanner);
	
	Prefs.unlisten('highlightColor', UpdateScanner);
	Prefs.unlisten('selectColor', UpdateScanner);
};
