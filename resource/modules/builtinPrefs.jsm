moduleAid.VERSION = '1.0.0';

this.changedFAYTTimeout = function() {
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

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ timeout: 5000 }, 'typeaheadfind', 'accessibility');
	prefAid.setDefaults({ typeaheadfind: false }, 'accessibility', '');
	
	prefAid.listen('FAYTtimeout', changedFAYTTimeout);
	prefAid.listen('FAYTenabled', changedFAYTEnabled);
	
	changedFAYTTimeout();
	
	prefAid.FAYToriginal = prefAid.typeaheadfind;
	prefAid.typeaheadfind = prefAid.FAYTenabled || prefAid.typeaheadfind;
	prefAid.listen('typeaheadfind', changedTypeAheadFind);
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('FAYTtimeout', changedFAYTTimeout);
	prefAid.unlisten('FAYTenabled', changedFAYTEnabled);
	prefAid.unlisten('typeaheadfind', changedTypeAheadFind);
	
	prefAid.reset('timeout');
	prefAid.typeaheadfind = prefAid.FAYToriginal;
};
