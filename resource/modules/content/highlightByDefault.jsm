// VERSION 1.0.1

this.highlightByDefault = {
	hook: function() {
		message('HighlightByDefault');
	},
	
	onDOMContentLoaded: function(e) {
		// this is the content document of the loaded page.
		var doc = e.originalTarget;
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
	onLocationChange: function(aWebProgress, aRequest, aLocation) {
		// Frames don't need to trigger this
		if(aWebProgress.isTopLevel) {
			if(aRequest && !aRequest.isPending()) {
				this.hook();
			}
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
