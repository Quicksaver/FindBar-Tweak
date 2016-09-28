/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.4.2

objName = 'findbartweak';
objPathString = 'findbartweak';
addonUUID = '9596d590-f177-11e4-b939-0800200c9a66';

addonUris = {
	homepage: 'https://addons.mozilla.org/firefox/addon/findbar-tweak/',
	support: 'https://github.com/Quicksaver/FindBar-Tweak/issues',
	fullchangelog: 'https://github.com/Quicksaver/FindBar-Tweak/commits/master',
	email: 'mailto:quicksaver@gmail.com',
	profile: 'https://addons.mozilla.org/firefox/user/quicksaver/',
	api: 'http://fasezero.com/addons/api/findbartweak',
	development: 'http://fasezero.com/addons/'
};

// We define this here so we can use it also as the default value for the preference
this.__defineGetter__('minTextboxWidth', function() {
	if(DARWIN) { return 176; }
	else if(WINNT) {
		if(Services.navigator.oscpu && Services.navigator.oscpu.startsWith('Windows NT 5.1')) { return 127; }
		else { return 120; }
	}
	else { return 180; }
});

// Some of our preferences should coincide with firefox defaults that may change with OS
var defaultBranch = Services.prefs.getDefaultBranch('');

prefList = {
	highlightByDefault: true,
	highlightOnFindAgain: false,
	hideWhenFinderHidden: false,
	minNoDelay: 3,
	highlightColor: "#EF0FFF",
	useCounter: true,

	findInTabs: true,
	findInTabsAction: 'sidebar',
	autoShowHideFIT: false,
	multipleFITFull: false,
	showTabsInFITSidebar: false,
	twinFITSidebar: true,

	useGrid: true,
	gridLimit: 100,
	gridAdjustPadding: 0,
	gridAdjustWidth: 0,

	sightsCurrent: true,
	sightsHighlights: false,
	sightsStyle: 'focus',
	sightsRepeat: 1,
	sightsColor: '#EF0FFF',
	sightsSameColor: false,
	sightsSameColorAll: true,
	sightsAllColor: '#EF0FFF',
	sightsAllSameColor: true,
	sightsLimit: 10,

	blurCloses: false,
	globalFB: false,
	onStartup: false,
	findbarHidden: true,

	movetoTop: false,
	movetoRight: false,
	hideClose: false,
	hideLabels: false,
	findFieldWidth: (LINUX) ? 240 : minTextboxWidth,
	selectColor: '#38d878',
	keepSelectContrast: true,

	fillSelectedText: false,
	emptySelectedText: true,
	fillTextShowFindBar: true,
	fillTextFromEditable: false,
	fillTextIntoClipboard: false,
	layoutEatSpaces: defaultBranch.getBoolPref('layout.word_select.eat_space_to_next_word'),
	layoutStopAtPunctuation: defaultBranch.getBoolPref('layout.word_select.stop_at_punctuation'),

	ctrlFCloses: true,
	ctrlFClosesOnFocused: true,
	keepButtons: false,
	FAYTmode: 'quick',

	// for internal use
	highlightColorContrast: '',
	selectColorContrast: '',
	findButtonMoved: false,
	findButtonOriginalPos: -1,

	// to revert the builtin preferences
	FAYTtimeout: defaultBranch.getIntPref('accessibility.typeaheadfind.timeout'),
	FAYTenabled: defaultBranch.getBoolPref('accessibility.typeaheadfind'),
	FAYTprefill: defaultBranch.getBoolPref('accessibility.typeaheadfind.prefillwithselection'),
	resetNative: false
};

// If we're initializing in a content process, we don't care about the rest
if(isContent) { throw 'isContent'; }

paneList = [
	[ "paneGeneral" ],
	[ "paneAppearance" ],
	[ "paneHighlights" ],
	[ "paneSights", true ],
	[ "paneFindAll", true ],
	[ "paneTweaks", true ]
];

function startAddon(window) {
	prepareObject(window);
	window[objName].Modules.load(objName, window.gBrowserInit);
}

function stopAddon(window) {
	removeObject(window);
}

function onStartup(aReason) {
	// These preferences are proxies for the following native Firefox preferences.
	// No need to undo these on shutdown, they will be removed by the Prefs object deinitialization anyway.
	Prefs.proxyNative('FAYTtimeout', 'timeout', 5000, 'typeaheadfind', 'accessibility');
	Prefs.proxyNative('FAYTprefill', 'prefillwithselection', true, 'typeaheadfind', 'accessibility');
	Prefs.proxyNative('FAYTenabled', 'typeaheadfind', false, 'accessibility', '');
	Prefs.proxyNative('layoutEatSpaces', 'eat_space_to_next_word', true, 'word_select', 'layout');
	Prefs.proxyNative('layoutStopAtPunctuation', 'stop_at_punctuation', true, 'word_select', 'layout');
	Prefs.proxyNative('highlightColor', 'textHighlightBackground', '', 'ui', '');
	Prefs.proxyNative('highlightColorContrast', 'textHighlightForeground', '', 'ui', '');
	Prefs.proxyNative('selectColor', 'textSelectBackgroundAttention', '', 'ui', '');
	Prefs.proxyNative('selectColorContrast', 'textSelectForeground', '', 'ui', '');

	Modules.load('highlightColor');
	Modules.load('findInTabsSandbox');
	Modules.load('compatibilityFix/sandboxFixes');

	// Apply the add-on to every window opened and to be opened
	Windows.callOnAll(startAddon, 'navigator:browser');
	Windows.register(startAddon, 'domwindowopened', 'navigator:browser');

	// Apply the add-on to every window opened and to be opened
	Windows.callOnAll(startAddon, 'navigator:view-source');
	Windows.register(startAddon, 'domwindowopened', 'navigator:view-source');
}

function onShutdown(aReason) {
	// remove the add-on from all windows
	Windows.callOnAll(stopAddon, null, null, true);

	Modules.unload('compatibilityFix/sandboxFixes');
	Modules.unload('findInTabsSandbox');
	Modules.unload('highlightColor');
}
