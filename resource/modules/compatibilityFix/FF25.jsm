moduleAid.VERSION = '1.0.0';

moduleAid.LOADMODULE = function() {
	overlayAid.overlayURI('chrome://'+objPathString+'/content/options.xul', 'chrome://'+objPathString+'/content/optionsFF25.xul');
	overlayAid.overlayURI('chrome://'+objPathString+'/content/findInTabs.xul', 'movetoTop_FIT');
};

moduleAid.UNLOADMODULE = function() {
	overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/findInTabs.xul', 'movetoTop_FIT');
	overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/options.xul', 'chrome://'+objPathString+'/content/optionsFF25.xul');
};
