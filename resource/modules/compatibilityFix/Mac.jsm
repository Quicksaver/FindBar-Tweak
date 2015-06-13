Modules.VERSION = '1.0.3';

Modules.LOADMODULE = function() {
	Overlays.overlayURI('chrome://'+objPathString+'/content/paneTweaks.xul', 'chrome://'+objPathString+'/content/paneTweaksMac.xul');
	Overlays.overlayURI('chrome://'+objPathString+'/content/findInTabsMini.xul', 'chrome://'+objPathString+'/content/findInTabsMiniMac.xul');
};

Modules.UNLOADMODULE = function() {
	Overlays.removeOverlayURI('chrome://'+objPathString+'/content/paneTweaks.xul', 'chrome://'+objPathString+'/content/paneTweaksMac.xul');
	Overlays.removeOverlayURI('chrome://'+objPathString+'/content/findInTabsMini.xul', 'chrome://'+objPathString+'/content/findInTabsMiniMac.xul');
};
