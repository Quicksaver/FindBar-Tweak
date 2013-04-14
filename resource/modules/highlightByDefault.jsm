moduleAid.VERSION = '1.1.0';

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

// Tab progress listeners, handles opening and closing of pages and location changes
this.highlightByDefaultProgressListener = {
	// Commands a reHighlight if needed, triggered from history navigation as well
	onLocationChange: function(browser, webProgress, request, location) {
		// Frames don't need to trigger this
		if(webProgress.DOMWindow == browser.contentWindow) {
			if(browser == gBrowser.mCurrentBrowser) {
				if(request && !request.isPending()) {
					gFindBar.getElement("highlight").checked = true;
				}
			}
		}
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(gFindBar, 'OpenedFindBar', highlightByDefault);
	
	if(!viewSource) {
		listenerAid.add(gBrowser.tabContainer, "TabSelect", highlightByDefault);
		listenerAid.add(gBrowser, "DOMContentLoaded", highlightByDefaultOnContentLoaded);
		gBrowser.addTabsProgressListener(highlightByDefaultProgressListener);
	}
	
	// Sometimes, when restarting firefox, it wouldn't check the box (go figure this one out...)
	aSync(highlightByDefault);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'OpenedFindBar', highlightByDefault);
	
	if(!viewSource) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", highlightByDefault);
		listenerAid.remove(gBrowser, "DOMContentLoaded", highlightByDefaultOnContentLoaded);
		gBrowser.removeTabsProgressListener(highlightByDefaultProgressListener);
	}
};
