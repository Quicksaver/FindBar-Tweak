moduleAid.VERSION = '1.0.1';

moduleAid.LOADMODULE = function() {
	overlayAid.overlayURI('chrome://'+objPathString+'/content/options.xul', 'chrome://'+objPathString+'/content/optionsMac.xul');
	overlayAid.overlayURI('chrome://'+objPathString+'/content/findInTabsMini.xul', 'chrome://'+objPathString+'/content/findInTabsMiniMac.xul');
};

moduleAid.UNLOADMODULE = function() {
	overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/options.xul', 'chrome://'+objPathString+'/content/optionsMac.xul');
	overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/findInTabsMini.xul', 'chrome://'+objPathString+'/content/findInTabsMiniMac.xul');
};
