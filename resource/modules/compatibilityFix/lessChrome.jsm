moduleAid.VERSION = '1.0.1';

// Handler for when autoPage inserts something into the document
this.lessChromeShowing = function(e) {
	if(isAncestor(e.target, gFindBar) || isAncestor(e.target, $(objPathString+'_findbarMenu'))) {
		e.preventDefault();
		e.stopPropagation();
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, "LessChromeShowing", lessChromeShowing);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, "LessChromeShowing", lessChromeShowing);
};
