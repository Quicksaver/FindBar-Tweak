Modules.VERSION = '1.0.1';

Modules.LOADMODULE = function() {
	Piggyback.add('autoUnloadTab', gBrowser.autoUnloadTab, 'unloadTab', function(aTab) {
		findbar.destroy(aTab);
		return true;
	}, Piggyback.MODE_BEFORE);
};

Modules.UNLOADMODULE = function() {
	Piggyback.revert('autoUnloadTab', gBrowser.autoUnloadTab, 'unloadTab');
};
