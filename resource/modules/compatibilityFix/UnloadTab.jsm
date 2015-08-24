Modules.VERSION = '1.0.0';

Modules.LOADMODULE = function() {
	Piggyback.add('UnloadTab', window.unloadTabObj, 'tabUnload', function(aTab) {
		saveFindBarState(aTab);
		destroyFindBar(aTab);
		return true;
	}, Piggyback.MODE_BEFORE);
};

Modules.UNLOADMODULE = function() {
	Piggyback.revert('UnloadTab', window.unloadTabObj, 'tabUnload');
};
