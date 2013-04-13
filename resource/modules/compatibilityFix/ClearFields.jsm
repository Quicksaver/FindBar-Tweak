moduleAid.VERSION = '1.0.0';

this.clearFieldsOnClick = function() {
	gFindBar._find();
};

this.clearFieldsAddListener = function() {
	// ClearFields doesn't distinguish types of clicks (left, middle, right) so I can't either
	listenerAid.add($('ClearFields-in-find'), 'click', clearFieldsOnClick);
};

moduleAid.LOADMODULE = function() {
	clearFieldsAddListener();
	
	// This is put here because the clear field button isn't added at startup
	listenerAid.add(gFindBar, 'OpenedFindBar', clearFieldsAddListener);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove($('ClearFields-in-find'), 'click', clearFieldsOnClick);
	listenerAid.remove(gFindBar, 'OpenedFindBar', clearFieldsAddListener);
};
