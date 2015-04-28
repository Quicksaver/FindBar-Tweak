Modules.VERSION = '1.0.2';

Modules.LOADMODULE = function() {
	Overlays.overlayURI('chrome://'+objPathString+'/content/options.xul', 'chrome://'+objPathString+'/content/optionsMac.xul');
	Overlays.overlayURI('chrome://'+objPathString+'/content/findInTabsMini.xul', 'chrome://'+objPathString+'/content/findInTabsMiniMac.xul');
};

Modules.UNLOADMODULE = function() {
	Overlays.removeOverlayURI('chrome://'+objPathString+'/content/options.xul', 'chrome://'+objPathString+'/content/optionsMac.xul');
	Overlays.removeOverlayURI('chrome://'+objPathString+'/content/findInTabsMini.xul', 'chrome://'+objPathString+'/content/findInTabsMiniMac.xul');
};
