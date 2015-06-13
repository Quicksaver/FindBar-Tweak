Modules.VERSION = '1.0.0';

this.resetNativePrefs = function() {
	Prefs.reset('typeaheadfind');
	Prefs.reset('timeout');
	Prefs.reset('prefillwithselection');
	Prefs.reset('eat_space_to_next_word');
	Prefs.reset('stop_at_punctuation');
	Prefs.reset('textHighlightForeground');
	Prefs.reset('textHighlightBackground');
	Prefs.reset('textSelectForeground');
	Prefs.reset('textSelectBackgroundAttention');
	
	$('pref-typeaheadfind').value = $('pref-typeaheadfind').valueFromPreferences;
	$('pref-timeout').value = $('pref-timeout').valueFromPreferences;
	$('pref-FAYTprefill').value = $('pref-FAYTprefill').valueFromPreferences;
	$('pref-layoutEatSpaces').value = $('pref-layoutEatSpaces').valueFromPreferences;
	$('pref-layoutStopAtPunctuation').value = $('pref-layoutStopAtPunctuation').valueFromPreferences;
	$('pref-highlightColor').value = $('pref-highlightColor').valueFromPreferences;
	$('pref-selectColor').value = $('pref-selectColor').valueFromPreferences;
};
