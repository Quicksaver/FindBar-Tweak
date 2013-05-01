moduleAid.VERSION = '1.0.1';

moduleAid.LOADMODULE = function() {
	setAttribute(viewSource || $('main-window'), objName+'-oscpu', 'Windows NT 5.1');
};

moduleAid.UNLOADMODULE = function() {
	removeAttribute(viewSource || $('main-window'), objName+'-oscpu', 'Windows NT 5.1');
};
