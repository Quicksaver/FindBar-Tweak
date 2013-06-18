moduleAid.VERSION = '1.1.0';

this.layoutBackup = {};

this.changedFAYTTimeout = function() {
	prefAid.unlisten('timeout', changedNativeFAYTTimeout);
	prefAid.timeout = prefAid.FAYTtimeout;
	prefAid.listen('timeout', changedNativeFAYTTimeout);
};

this.changedNativeFAYTTimeout = function() {
	prefAid.timeout = prefAid.FAYTtimeout;
};

this.changedFAYTPrefill = function() {
	prefAid.unlisten('timeout', changedNativeFAYTPrefill);
	prefAid.prefillwithselection = prefAid.FAYTprefill;
	prefAid.listen('timeout', changedNativeFAYTPrefill);
};

this.changedNativeFAYTPrefill = function() {
	prefAid.prefillwithselection = prefAid.FAYTprefill;
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

this.handleLayoutEatSpaces = function(noUpdate) {
	layoutBackup.eat_space_to_next_word = prefAid.eat_space_to_next_word;
	if(!noUpdate) { changeLayoutEatSpaces(); }
};

this.handleLayoutStopAtPunctuation = function(noUpdate) {
	layoutBackup.stop_at_punctuation = prefAid.stop_at_punctuation;
	if(!noUpdate) { changeLayoutStopAtPunctuation(); }
};

this.changeLayoutEatSpaces = function() {
	// Have to remove the listeners and add them back after, so the backups aren't overwritten with our values
	prefAid.unlisten('eat_space_to_next_word', handleLayoutEatSpaces);
	
	prefAid.eat_space_to_next_word = prefAid.layoutEatSpaces;
	
	prefAid.listen('eat_space_to_next_word', handleLayoutEatSpaces);
};

this.changeLayoutStopAtPunctuation = function() {
	// Have to remove the listeners and add them back after, so the backups aren't overwritten with our values
	prefAid.unlisten('stop_at_punctuation', handleLayoutStopAtPunctuation);
	
	prefAid.stop_at_punctuation = prefAid.layoutStopAtPunctuation;
	
	prefAid.listen('stop_at_punctuation', handleLayoutStopAtPunctuation);
};

this.resetFAYT = function() {
	prefAid.unlisten('typeaheadfind', changedTypeAheadFind);
	prefAid.unlisten('timeout', changedNativeFAYTTimeout);
	prefAid.unlisten('prefillwithselection', changedNativeFAYTPrefill);
	prefAid.unlisten('eat_space_to_next_word', handleLayoutEatSpaces);
	prefAid.unlisten('stop_at_punctuation', handleLayoutStopAtPunctuation);
	
	prefAid.reset('timeout');
	prefAid.reset('prefillwithselection');
	if(!prefAid.resetNative) { prefAid.typeaheadfind = prefAid.FAYToriginal; } else { prefAid.reset('typeaheadfind'); }
	
	if(!prefAid.resetNative && typeof(layoutBackup.eat_space_to_next_word) != 'undefined') { prefAid.eat_space_to_next_word = layoutBackup.eat_space_to_next_word; }
	else { prefAid.reset('eat_space_to_next_word'); }
	if(!prefAid.resetNative && typeof(layoutBackup.stop_at_punctuation) != 'undefined') { prefAid.stop_at_punctuation = layoutBackup.stop_at_punctuation; }
	else { prefAid.reset('stop_at_punctuation'); }
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ timeout: 5000, prefillwithselection: true }, 'typeaheadfind', 'accessibility');
	prefAid.setDefaults({ typeaheadfind: false }, 'accessibility', '');
	prefAid.setDefaults({ eat_space_to_next_word: true, stop_at_punctuation: true }, 'word_select', 'layout');
	
	handleLayoutEatSpaces(true);
	handleLayoutStopAtPunctuation(true);
	
	prefAid.listen('FAYTtimeout', changedFAYTTimeout);
	prefAid.listen('FAYTenabled', changedFAYTEnabled);
	prefAid.listen('FAYTprefill', changedFAYTPrefill);
	prefAid.listen('layoutEatSpaces', changeLayoutEatSpaces);
	prefAid.listen('layoutStopAtPunctuation', changeLayoutStopAtPunctuation);
	
	changedFAYTTimeout();
	changedFAYTPrefill();
	changeLayoutEatSpaces();
	changeLayoutStopAtPunctuation();
	
	prefAid.FAYToriginal = prefAid.typeaheadfind;
	prefAid.typeaheadfind = prefAid.FAYTenabled || prefAid.typeaheadfind;
	
	prefAid.listen('typeaheadfind', changedTypeAheadFind);
	
	alwaysRunOnShutdown.push(resetFAYT);
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('FAYTtimeout', changedFAYTTimeout);
	prefAid.unlisten('FAYTenabled', changedFAYTEnabled);
	prefAid.unlisten('FAYTprefill', changedFAYTPrefill);
	prefAid.unlisten('layoutEatSpaces', changeLayoutEatSpaces);
	prefAid.unlisten('layoutStopAtPunctuation', changeLayoutStopAtPunctuation);
	
	resetFAYT();
};
