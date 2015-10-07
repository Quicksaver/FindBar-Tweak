Modules.VERSION = '1.0.0';

Modules.LOADMODULE = function() {
	Piggyback.add('autoUnloadTab', gBrowser.autoUnloadTab, 'unloadTab', function(aTab) {
		destroyFindBar(aTab);
		return true;
	}, Piggyback.MODE_BEFORE);
};

Modules.UNLOADMODULE = function() {
	Piggyback.revert('autoUnloadTab', gBrowser.autoUnloadTab, 'unloadTab');
};
