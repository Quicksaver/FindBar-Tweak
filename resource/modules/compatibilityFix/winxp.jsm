moduleAid.VERSION = '1.0.0';

moduleAid.LOADMODULE = function() {
	setAttribute(viewSource || $('main-window'), 'oscpu', 'Windows NT 5.1');
};

moduleAid.UNLOADMODULE = function() {
	removeAttribute(viewSource || $('main-window'), 'oscpu', 'Windows NT 5.1');
};
