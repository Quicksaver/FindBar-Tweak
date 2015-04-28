Modules.VERSION = '1.1.0';

this.UpdateScannerIsBrowserValid = function(e) {
	if(e.target.currentURI.spec.indexOf('chrome://updatescan/') == 0) {
		e.preventDefault();
		e.stopPropagation();
	}
};

this.UpdateScannerAdjustGrid = function() {
	if(!grids.lastAdjust) { return; }
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url-prefix("chrome://updatescan/") {\n';
	sscode += '	hbox[ownedByFindBarTweak][anonid="gridBox"] vbox[anonid="findGrid"] {\n';
	sscode += 		grids.lastAdjust;
	sscode += '	}\n';
	sscode += '}\n';
	
	Styles.load('adjustUpdateScannerFrameGrid_'+_UUID, sscode, true);
};

this.UpdateScannerGridColors = function() {
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url-prefix("chrome://updatescan/") {\n';
	sscode += '	hbox[ownedByFindBarTweak][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight]:not([current]):not([hover]) {\n';
	sscode += '		background-color: '+Prefs.highlightColor+';\n';
	sscode += '	}\n';
	sscode += '	hbox[ownedByFindBarTweak][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight][current],\n';
	sscode += '	hbox[ownedByFindBarTweak][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight][hover] {\n';
	sscode += '		background-color: '+Prefs.selectColor+';\n';
	sscode += '	}\n';
	sscode += '}';
	
	Styles.load('ColorUpdateScannerFrameGrid_'+_UUID, sscode, true);
};

Modules.LOADMODULE = function() {
	Listeners.add(window, "IsFinderValid", UpdateScannerIsBrowserValid, true);
	Listeners.add(window, "AdjustFrameGrid", UpdateScannerAdjustGrid);
	
	Prefs.listen('highlightColor', UpdateScannerGridColors);
	Prefs.listen('selectColor', UpdateScannerGridColors);
	
	UpdateScannerAdjustGrid();
	UpdateScannerGridColors();
};

Modules.UNLOADMODULE = function() {
	Styles.unload('adjustUpdateScannerFrameGrid_'+_UUID);
	Styles.unload('ColorUpdateScannerFrameGrid_'+_UUID);
	
	Listeners.remove(window, "IsFinderValid", UpdateScannerIsBrowserValid, true);
	Listeners.remove(window, "AdjustFrameGrid", UpdateScannerAdjustGrid);
	
	Prefs.unlisten('highlightColor', UpdateScannerGridColors);
	Prefs.unlisten('selectColor', UpdateScannerGridColors);
};
