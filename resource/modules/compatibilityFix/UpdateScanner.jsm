moduleAid.VERSION = '1.0.0';

this.UpdateScannerIsBrowserValid = function(e) {
	if(e.target.currentURI.spec.indexOf('chrome://updatescan/') == 0) {
		e.preventDefault();
		e.stopPropagation();
	}
};

this.UpdateScannerAdjustGrid = function() {
	if(!lastAdjustGrid) { return; }
	
	styleAid.unload('adjustUpdateScannerFrameGrid_'+_UUID);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url-prefix("chrome://updatescan/") {\n';
	sscode += '	hbox[ownedByFindBarTweak="'+_UUID+'"][anonid="gridBox"] vbox[anonid="findGrid"] {\n';
	sscode += lastAdjustGrid;
	sscode += '	}\n';
	sscode += '}\n';
	
	styleAid.load('adjustUpdateScannerFrameGrid_'+_UUID, sscode, true);
};

this.UpdateScannerGridColors = function() {
	styleAid.unload('ColorUpdateScannerFrameGrid_'+_UUID);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url-prefix("chrome://updatescan/") {\n';
	sscode += '	hbox[ownedByFindBarTweak="'+_UUID+'"][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight]:not([current]):not([hover]) {\n';
	sscode += '		background-color: '+prefAid.highlightColor+';\n';
	sscode += '	}\n';
	sscode += '	hbox[ownedByFindBarTweak="'+_UUID+'"][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight][current],\n';
	sscode += '	hbox[ownedByFindBarTweak="'+_UUID+'"][anonid="gridBox"] vbox[anonid="findGrid"] vbox[highlight][hover] {\n';
	sscode += '		background-color: '+prefAid.selectColor+';\n';
	sscode += '	}\n';
	sscode += '}';
	
	styleAid.load('ColorUpdateScannerFrameGrid_'+_UUID, sscode, true);
};

moduleAid.LOADMODULE = function() {
	overlayAid.overlayURI('chrome://updatescan/', 'UpdateScanner');
	
	listenerAid.add(window, "IsBrowserValid", UpdateScannerIsBrowserValid, true);
	listenerAid.add(window, "FBTAdjustFrameGrid", UpdateScannerAdjustGrid);
	
	prefAid.listen('highlightColor', UpdateScannerGridColors);
	prefAid.listen('selectColor', UpdateScannerGridColors);
	
	UpdateScannerAdjustGrid();
	UpdateScannerGridColors();
};

moduleAid.UNLOADMODULE = function() {
	styleAid.unload('adjustUpdateScannerFrameGrid_'+_UUID);
	styleAid.unload('ColorUpdateScannerFrameGrid_'+_UUID);
	
	listenerAid.remove(window, "IsBrowserValid", UpdateScannerIsBrowserValid, true);
	listenerAid.remove(window, "FBTAdjustFrameGrid", UpdateScannerAdjustGrid);
	
	prefAid.unlisten('highlightColor', UpdateScannerGridColors);
	prefAid.unlisten('selectColor', UpdateScannerGridColors);
	
	overlayAid.removeOverlayURI('chrome://updatescan/', 'UpdateScanner');
};
