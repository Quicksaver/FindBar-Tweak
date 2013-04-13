moduleAid.VERSION = '1.0.0';

// Handler for when autoPage inserts something into the document
this.autoPagerInserted = function(e) {
	if(contentDocument == e.originalTarget.ownerDocument) {
		if(prefAid.movetoTop) { hideOnChrome(); }
		reHighlight(documentHighlighted);
	} else {
		setAttribute(e.originalTarget.ownerDocument.documentElement, 'reHighlight', 'true');
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, "AutoPagerAfterInsert", autoPagerInserted);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, "AutoPagerAfterInsert", autoPagerInserted);
};
