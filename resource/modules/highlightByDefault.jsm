moduleAid.VERSION = '1.0.0';

this.highlightByDefault = function() {
	gFindBar.getElement("highlight").checked = true;
};

this.highlightByDefaultOnContentLoaded = function(e) {
	// this is the content document of the loaded page.
	var doc = e.originalTarget;
	if(doc instanceof window.HTMLDocument) {
		// is this an inner frame?
		// Find the root document:
		while(doc.defaultView.frameElement) {
			doc = doc.defaultView.frameElement.ownerDocument;
		}
		
		if(doc == contentDocument) {
			highlightByDefault();
		}
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(gFindBar, 'OpenedFindBar', highlightByDefault);
	listenerAid.add(gBrowser.tabContainer, "TabSelect", highlightByDefault);
	listenerAid.add(gBrowser, "DOMContentLoaded", highlightByDefaultOnContentLoaded);
	
	// Sometimes, when restarting firefox, it wouldn't check the box (go figure this one out...)
	aSync(highlightByDefault);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'OpenedFindBar', highlightByDefault);
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", highlightByDefault);
	listenerAid.remove(gBrowser, "DOMContentLoaded", highlightByDefaultOnContentLoaded);
};
