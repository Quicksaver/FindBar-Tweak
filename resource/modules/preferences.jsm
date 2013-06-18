moduleAid.VERSION = '1.2.0';

this.inPreferences = true;
this.__defineGetter__('linkedPanel', function() { return window.document; });

this.previewSights = function(box, style) {
	moduleAid.load('sights');
	
	// Hide the current sights
	for(var i=0; i<sights.childNodes.length; i++) {
		if(sights.childNodes[i]._sights.current) {
			sights.childNodes[i].hidden = true;
		}
	}
	
	var dimensions = box.getBoundingClientRect();
	buildSights(dimensions.left +(dimensions.width /2), dimensions.top +(dimensions.height /2), 0, 0, true, style);
};

this.resetNativePrefs = function() {
	prefAid.reset('FAYTenabled');
	prefAid.reset('FAYToriginal');
	prefAid.reset('FAYTtimeout');
	prefAid.reset('FAYTprefill');
	prefAid.reset('layoutEatSpaces');
	prefAid.reset('layoutStopAtPunctuation');
	prefAid.reset('selectColor');
	prefAid.reset('highlightColor');
	
	prefAid.reset('typeaheadfind');
	prefAid.reset('timeout');
	prefAid.reset('prefillwithselection');
	prefAid.reset('textHighlightBackground');
	prefAid.reset('textHighlightForeground');
	prefAid.reset('textSelectBackgroundAttention');
	prefAid.reset('textSelectForeground');
	
	$('pref-typeaheadfind').value = $('pref-typeaheadfind').valueFromPreferences;
	$('pref-timeout').value = $('pref-timeout').valueFromPreferences;
	$('pref-FAYTprefill').value = $('pref-FAYTprefill').valueFromPreferences;
	$('pref-layoutEatSpaces').value = $('pref-layoutEatSpaces').valueFromPreferences;
	$('pref-layoutStopAtPunctuation').value = $('pref-layoutStopAtPunctuation').valueFromPreferences;
	$('pref-highlightColor').value = $('pref-highlightColor').valueFromPreferences;
	$('pref-selectColor').value = $('pref-selectColor').valueFromPreferences;
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('sights');
};
