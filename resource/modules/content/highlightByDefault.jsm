/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.0.3

this.highlightByDefault = {
	hook: function() {
		message('HighlightByDefault');
	},

	handleEvent: function(e) {
		// We're listening only for DOMContentLoaded here.
		// this is the content document of the loaded page.
		let doc = e.originalTarget;
		if(doc instanceof content.HTMLDocument) {
			// is this an inner frame?
			// Find the root document:
			while(doc.defaultView.frameElement) {
				doc = doc.defaultView.frameElement.ownerDocument;
			}

			if(doc == document) {
				this.hook();
			}
		}
	},

	// Commands a reHighlight if needed, triggered from history navigation as well
	onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) {
		// Frames don't need to trigger this
		if(!aWebProgress.isTopLevel) { return; }

		// Ignore events that don't change the document.
		if(aFlags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) { return; }

		if(aRequest && !aRequest.isPending()) {
			this.hook();
		}
	},

	QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
};

Modules.LOADMODULE = function() {
	if(!viewSource) {
		WebProgress.add(highlightByDefault, Ci.nsIWebProgress.NOTIFY_LOCATION);
		DOMContentLoaded.add(highlightByDefault);
	}
};

Modules.UNLOADMODULE = function() {
	if(!viewSource) {
		WebProgress.remove(highlightByDefault, Ci.nsIWebProgress.NOTIFY_LOCATION);
		DOMContentLoaded.remove(highlightByDefault);
	}
};
