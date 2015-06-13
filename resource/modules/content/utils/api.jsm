Modules.VERSION = '1.0.0';

this.api = {
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
				this.checkPage();
			}
		}
	},
	
	checkPage: function() {
		if(document.documentURI.startsWith(addonUris.development)) {
			var unwrap = XPCNativeWrapper.unwrap(content);
			if(unwrap.enable) {
				unwrap.enable(objPathString);
			}
		}
	}
};

Modules.LOADMODULE = function() {
	DOMContentLoaded.add(api);
	
	api.checkPage();
};

Modules.UNLOADMODULE = function() {
	DOMContentLoaded.remove(api);
};
