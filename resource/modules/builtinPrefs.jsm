// VERSION 2.0.3

this.nativePrefs = {};

this.handleNativePref = function(nPref, cPref) {
	nativePrefs[nPref] = {
		cPref: cPref,
		revertValue: Prefs[nPref],
		changedNative: function() {
			nativePrefs[nPref].revertValue = Prefs[nPref];
			
			Prefs.unlisten(cPref, nativePrefs[nPref].changedCustom);
			Prefs[cPref] = Prefs[nPref];
			Prefs.listen(cPref, nativePrefs[nPref].changedCustom);
		},
		changedCustom: function() {
			Prefs.unlisten(nPref, nativePrefs[nPref].changedNative);
			Prefs[nPref] = Prefs[cPref];
			Prefs.listen(nPref, nativePrefs[nPref].changedNative);
		}
	};
	
	Prefs.listen(cPref, nativePrefs[nPref].changedCustom);
	
	nativePrefs[nPref].changedCustom();
};

this.resetNativePrefs = function() {
	for(let x in nativePrefs) {
		Prefs.unlisten(nativePrefs[x].cPref, nativePrefs[x].changedCustom);
		Prefs.unlisten(x, nativePrefs[x].changedNative);
	}
	
	if(!Prefs.resetNative) {
		for(let x in nativePrefs) {
			Prefs[x] = nativePrefs[x].revertValue;
		}
	} else {
		for(let x in nativePrefs) {
			Prefs.reset(x);
		}
	}
};

Modules.LOADMODULE = function() {
	Prefs.setDefaults({ timeout: 5000, prefillwithselection: true }, 'typeaheadfind', 'accessibility');
	Prefs.setDefaults({ typeaheadfind: false }, 'accessibility', '');
	Prefs.setDefaults({ eat_space_to_next_word: true, stop_at_punctuation: true }, 'word_select', 'layout');
	
	handleNativePref('timeout', 'FAYTtimeout');
	handleNativePref('typeaheadfind', 'FAYTenabled');
	handleNativePref('prefillwithselection', 'FAYTprefill');
	handleNativePref('eat_space_to_next_word', 'layoutEatSpaces');
	handleNativePref('stop_at_punctuation', 'layoutStopAtPunctuation');
	
	alwaysRunOnShutdown.push(resetNativePrefs);
};

Modules.UNLOADMODULE = function() {
	resetNativePrefs();
};
