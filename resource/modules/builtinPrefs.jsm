moduleAid.VERSION = '1.0.1';

this.changedFAYTTimeout = function() {
	prefAid.unlisten('timeout', changedNativeFAYTTimeout);
	prefAid.timeout = prefAid.FAYTtimeout;
	prefAid.listen('timeout', changedNativeFAYTTimeout);
};

this.changedNativeFAYTTimeout = function() {
	prefAid.timeout = prefAid.FAYTtimeout;
};

this.changedFAYTEnabled = function() {
	prefAid.unlisten('typeaheadfind', changedTypeAheadFind);
	prefAid.typeaheadfind = prefAid.FAYTenabled;
	prefAid.listen('typeaheadfind', changedTypeAheadFind);
};

this.changedTypeAheadFind = function() {
	prefAid.FAYToriginal = prefAid.typeaheadfind;
	prefAid.FAYTenabled = prefAid.typeaheadfind;
};

this.resetFAYT = function() {
	prefAid.unlisten('typeaheadfind', changedTypeAheadFind);
	prefAid.unlisten('timeout', changedNativeFAYTTimeout);
	
	prefAid.reset('timeout');
	prefAid.typeaheadfind = prefAid.FAYToriginal;
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ timeout: 5000 }, 'typeaheadfind', 'accessibility');
	prefAid.setDefaults({ typeaheadfind: false }, 'accessibility', '');
	
	prefAid.listen('FAYTtimeout', changedFAYTTimeout);
	prefAid.listen('FAYTenabled', changedFAYTEnabled);
	
	changedFAYTTimeout();
	
	prefAid.FAYToriginal = prefAid.typeaheadfind;
	prefAid.typeaheadfind = prefAid.FAYTenabled || prefAid.typeaheadfind;
	
	prefAid.listen('typeaheadfind', changedTypeAheadFind);
	
	alwaysRunOnShutdown.push(resetFAYT);
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('FAYTtimeout', changedFAYTTimeout);
	prefAid.unlisten('FAYTenabled', changedFAYTEnabled);
	
	resetFAYT();
};
