moduleAid.VERSION = '1.1.0';

// Handler for when autoPage inserts something into the document
this.autoPagerInserted = function(e) {
	// First get the root document	
	var doc = e.originalTarget.ownerDocument;
	while(doc.defaultView.frameElement) {
		doc = doc.defaultView.frameElement.ownerDocument;
	}
	
	// Reset innerText properties of panl
	var panel = gBrowser._getTabForContentWindow(doc.defaultView);
	if(panel && panel.linkedPanel) {
		panel = $(panel.linkedPanel);
	}
	resetInnerText(panel);
	
	// Trigger a reHighlight
	setAttribute(doc.documentElement, 'reHighlight', 'true');
	
	if(doc == contentDocument) {
		if(prefAid.movetoTop) { hideOnChrome(); }
		
		// Do the reHighlight now if it's the current tab
		delayReHighlight(doc);
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, "AutoPagerAfterInsert", autoPagerInserted);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, "AutoPagerAfterInsert", autoPagerInserted);
};
