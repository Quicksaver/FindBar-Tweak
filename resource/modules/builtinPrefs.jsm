moduleAid.VERSION = '2.0.1';

this.nativePrefs = {};

this.handleNativePref = function(nPref, cPref) {
	nativePrefs[nPref] = {
		cPref: cPref,
		revertValue: prefAid[nPref],
		changedNative: function() {
			nativePrefs[nPref].revertValue = prefAid[nPref];
			
			prefAid.unlisten(cPref, nativePrefs[nPref].changedCustom);
			prefAid[cPref] = prefAid[nPref];
			prefAid.listen(cPref, nativePrefs[nPref].changedCustom);
		},
		changedCustom: function() {
			prefAid.unlisten(nPref, nativePrefs[nPref].changedNative);
			prefAid[nPref] = prefAid[cPref];
			prefAid.listen(nPref, nativePrefs[nPref].changedNative);
		}
	};
	
	prefAid.listen(cPref, nativePrefs[nPref].changedCustom);
	
	nativePrefs[nPref].changedCustom();
};

this.resetNativePrefs = function() {
	for(var x in nativePrefs) {
		prefAid.unlisten(nativePrefs[x].cPref, nativePrefs[x].changedCustom);
		prefAid.unlisten(x, nativePrefs[x].changedNative);
	}
	
	if(!prefAid.resetNative) {
		for(var x in nativePrefs) {
			prefAid[x] = nativePrefs[x].revertValue;
		}
	} else {
		for(var x in nativePrefs) {
			prefAid.reset(x);
		}
	}
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ timeout: 5000, prefillwithselection: true }, 'typeaheadfind', 'accessibility');
	prefAid.setDefaults({ typeaheadfind: false }, 'accessibility', '');
	prefAid.setDefaults({ eat_space_to_next_word: true, stop_at_punctuation: true }, 'word_select', 'layout');
	
	handleNativePref('timeout', 'FAYTtimeout');
	handleNativePref('typeaheadfind', 'FAYTenabled');
	handleNativePref('prefillwithselection', 'FAYTprefill');
	handleNativePref('eat_space_to_next_word', 'layoutEatSpaces');
	handleNativePref('stop_at_punctuation', 'layoutStopAtPunctuation');
	
	alwaysRunOnShutdown.push(resetNativePrefs);
};

moduleAid.UNLOADMODULE = function() {
	resetNativePrefs();
};
