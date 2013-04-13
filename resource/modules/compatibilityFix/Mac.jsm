moduleAid.VERSION = '1.0.0';

moduleAid.LOADMODULE = function() {
	overlayAid.overlayURI('chrome://'+objPathString+'/content/options.xul', 'chrome://'+objPathString+'/content/optionsMac.xul');
};

moduleAid.UNLOADMODULE = function() {
	overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/options.xul', 'chrome://'+objPathString+'/content/optionsMac.xul');
};
