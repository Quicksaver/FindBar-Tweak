Modules.VERSION = '1.0.2';

this.clearFieldsOnClick = function() {
	gFindBar._find();
};

this.clearFieldsAddListener = function() {
	// ClearFields doesn't distinguish types of clicks (left, middle, right) so I can't either
	Listeners.add($('ClearFields-in-find'), 'click', clearFieldsOnClick);
};

Modules.LOADMODULE = function() {
	clearFieldsAddListener();
	
	// This is put here because the clear field button isn't added at startup
	Listeners.add(window, 'OpenedFindBar', clearFieldsAddListener);
};

Modules.UNLOADMODULE = function() {
	Listeners.remove($('ClearFields-in-find'), 'click', clearFieldsOnClick);
	Listeners.remove(window, 'OpenedFindBar', clearFieldsAddListener);
};
