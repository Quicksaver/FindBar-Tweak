Modules.VERSION = '1.0.4';

Modules.LOADMODULE = function() {
	Overlays.overlayURI('chrome://'+objPathString+'/content/paneTweaks.xul', 'chrome://'+objPathString+'/content/paneTweaksMac.xul', {
		onLoad: function(aWindow) {
			// replace the string in the helptext as well, Overlays doesn't handle this
			let checkbox = aWindow.document.getElementById('ctrlFClosesCheckbox');
			let helptext = aWindow.document.getElementById('ctrlFClosesHelptext');
			helptext.textContent = checkbox.getAttribute('label');
		}
	});
	Overlays.overlayURI('chrome://'+objPathString+'/content/findInTabsMini.xul', 'chrome://'+objPathString+'/content/findInTabsMiniMac.xul');
};

Modules.UNLOADMODULE = function() {
	Overlays.removeOverlayURI('chrome://'+objPathString+'/content/paneTweaks.xul', 'chrome://'+objPathString+'/content/paneTweaksMac.xul');
	Overlays.removeOverlayURI('chrome://'+objPathString+'/content/findInTabsMini.xul', 'chrome://'+objPathString+'/content/findInTabsMiniMac.xul');
};
