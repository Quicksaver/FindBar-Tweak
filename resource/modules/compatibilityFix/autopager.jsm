Modules.VERSION = '1.1.1';

// there's no point in fixing this for e10s, since AutoPager doesn't work at all there

// Handler for when autoPage inserts something into the document
this.autoPagerInserted = function(e) {
	// First get the root document	
	var doc = e.originalTarget.ownerDocument;
	while(doc.defaultView.frameElement) {
		doc = doc.defaultView.frameElement.ownerDocument;
	}
	
	// Reset innerText properties of tab
	var inFindBar = gBrowser._getTabForContentWindow(doc.defaultView)._findBar;
	if(inFindBar) {
		inFindBar.browser.finder.resetInnerText();
		
		// Trigger a reHighlight
		inFindBar.browser.finder.documentReHighlight = true;
		
		if(gFindBarInitialized && inFindBar == gFindBar) {
			if(Prefs.movetoTop && typeof(hideOnChrome) != 'undefined') { hideOnChrome(); }
			
			// Do the reHighlight now if it's the current tab
			highlights.apply();
		}
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(window, "AutoPagerAfterInsert", autoPagerInserted);
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, "AutoPagerAfterInsert", autoPagerInserted);
};
