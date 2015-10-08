// VERSION 1.0.5

Modules.LOADMODULE = function() {
	Overlays.overlayURI('chrome://'+objPathString+'/content/paneTweaks.xul', 'chrome://'+objPathString+'/content/paneTweaksMac.xul', {
		onLoad: function(aWindow) {
			// replace the string in the helptext as well, Overlays doesn't handle this
			let checkbox = aWindow.document.getElementById('ctrlFClosesCheckbox');
			let helptext = aWindow.document.getElementById('ctrlFClosesHelptext');
			helptext.textContent = checkbox.getAttribute('label');
		}
	});
};

Modules.UNLOADMODULE = function() {
	Overlays.removeOverlayURI('chrome://'+objPathString+'/content/paneTweaks.xul', 'chrome://'+objPathString+'/content/paneTweaksMac.xul');
};
