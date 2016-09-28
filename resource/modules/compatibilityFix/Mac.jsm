/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
