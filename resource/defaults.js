var defaultsVersion = '1.4.3';
var objName = 'findbartweak';
var objPathString = 'findbartweak';

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

var prefList = {
	highlightByDefault: true,
	highlightOnFindAgain: false,
	hideWhenFinderHidden: false,
	minNoDelay: 3,
	highlightColor: "#EF0FFF",
	useCounter: true,
	
	findInTabs: true,
	multipleFITFull: false,
	
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
	perTab: true,
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
	fillTextShowFindBar: true,
	layoutEatSpaces: defaultBranch.getBoolPref('layout.word_select.eat_space_to_next_word'),
	layoutStopAtPunctuation: defaultBranch.getBoolPref('layout.word_select.stop_at_punctuation'),
	
	ctrlFCloses: true,
	ctrlFClosesOnValue: true,
	keepButtons: false,
	FAYTmode: 'quick',
	
	/* to revert the builtin preferences */
	FAYTtimeout: defaultBranch.getIntPref('accessibility.typeaheadfind.timeout'),
	FAYTenabled: defaultBranch.getBoolPref('accessibility.typeaheadfind'),
	FAYTprefill: defaultBranch.getBoolPref('accessibility.typeaheadfind.prefillwithselection'),
	resetNative: false,
	
	// for the what's new tab, it's better they're here so they're automatically carried over to content
	lastVersionNotify: '0',
	notifyOnUpdates: true
};

function startAddon(window) {
	prepareObject(window);
	window[objName].Modules.load(objName, window.gBrowserInit);
}

function stopAddon(window) {
	removeObject(window);
}

function startPreferences(window) {
	replaceObjStrings(window.document);
	preparePreferences(window);
	window[objName].Modules.load('preferences', true);
}

function onStartup(aReason) {
	Modules.load('builtinPrefs');
	Modules.load('highlightColor');
	Modules.load('findInTabsSandbox');
	Modules.load('compatibilityFix/sandboxFixes');
	
	// Apply the add-on to every window opened and to be opened
	Windows.callOnAll(startAddon, 'navigator:browser');
	Windows.register(startAddon, 'domwindowopened', 'navigator:browser');
	
	// Apply the add-on to every window opened and to be opened
	Windows.callOnAll(startAddon, 'navigator:view-source');
	Windows.register(startAddon, 'domwindowopened', 'navigator:view-source');
	
	// Apply the add-on to every preferences window opened and to be opened
	Windows.callOnAll(startPreferences, null, "chrome://"+objPathString+"/content/options.xul");
	Windows.register(startPreferences, 'domwindowopened', null, "chrome://"+objPathString+"/content/options.xul");
	Browsers.callOnAll(startPreferences, "chrome://"+objPathString+"/content/options.xul");
	Browsers.register(startPreferences, 'pageshow', "chrome://"+objPathString+"/content/options.xul");
}

function onShutdown(aReason) {
	// remove the add-on from all windows
	Windows.callOnAll(stopAddon, null, null, true);
	Browsers.callOnAll(stopAddon, null, true);
	
	Modules.unload('compatibilityFix/sandboxFixes');
	Modules.unload('findInTabsSandbox');
	Modules.unload('highlightColor');
	Modules.unload('builtinPrefs');
}
