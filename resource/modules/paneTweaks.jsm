/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.0.1

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
};
