var defaultsVersion = '1.2.5';
var objName = 'findbartweak';
var objPathString = 'findbartweak';

// We define this here so we can use it also as the default value for the preference
this.__defineGetter__('minTextboxWidth', function() {
	if(Services.appinfo.OS == 'Darwin') { return 176; }
	else if(Services.appinfo.OS == 'WINNT') {
		if(Services.navigator.oscpu && Services.navigator.oscpu.indexOf('Windows NT 5.1') == 0) { return 127; }
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
	alwaysOpenFIT: false,
	maxFIT: 1000,
	FITFull: false,
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
	perTab: (Services.vc.compare(Services.appinfo.platformVersion, "25.0a1") >= 0),
	onStartup: false,
	findbarHidden: true,
	
	movetoTop: false,
	movetoBottom: false,
	movetoRight: false,
	FF25Tweaks: true,
	hideClose: false,
	hideLabels: false,
	hideFindLabel: false,
	findFieldWidth: (Services.appinfo.OS != 'Darwin' && Services.appinfo.OS != 'WINNT') ? 240 : minTextboxWidth,
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
	
	lwthemebgImage: '',
	lwthemebgWidth: 0,
	lwthemecolor: '',
	lwthemebgColor: ''
};

var perTabFB = false;
var onTopFB = false;
var mFinder = false;

function startAddon(window) {
	prepareObject(window);
	window[objName].moduleAid.load(objName, true);
}

function stopAddon(window) {
	removeObject(window);
}

function startPreferences(window) {
	replaceObjStrings(window.document);
	preparePreferences(window);
	window[objName].moduleAid.load('preferences', true);
}

function startConditions(aReason) {
	return true;
}

function onStartup(aReason) {
	if(Services.vc.compare(Services.appinfo.platformVersion, "25.0a1") >= 0) { perTabFB = true; }
	//if(Services.vc.compare(Services.appinfo.platformVersion, "26.0a1") >= 0) { onTopFB = true; } // Backed out of Trunk until further notice
	
	// After https://bugzilla.mozilla.org/show_bug.cgi?id=916536 lands, I can change this to a more simple check
	if(Services.vc.compare(Services.appinfo.platformVersion, "26.0a1") >= 0) {
		try {
			let FinderModule = {};
			Cu.import("resource://gre/modules/Finder.jsm", FinderModule);
			delete FinderModule;
			mFinder = true;
		}
		catch(ex) {}
	}
	
	moduleAid.load('builtinPrefs');
	moduleAid.load('highlightColor');
	moduleAid.load('findInTabsSandbox');
	moduleAid.load('compatibilityFix/sandboxFixes');
	
	// Apply the add-on to every window opened and to be opened
	windowMediator.callOnAll(startAddon, 'navigator:browser');
	windowMediator.register(startAddon, 'domwindowopened', 'navigator:browser');
	
	// Apply the add-on to every window opened and to be opened
	windowMediator.callOnAll(startAddon, 'navigator:view-source');
	windowMediator.register(startAddon, 'domwindowopened', 'navigator:view-source');
	
	// Apply the add-on to every preferences window opened and to be opened
	windowMediator.callOnAll(startPreferences, null, "chrome://"+objPathString+"/content/options.xul");
	windowMediator.register(startPreferences, 'domwindowopened', null, "chrome://"+objPathString+"/content/options.xul");
	browserMediator.callOnAll(startPreferences, "chrome://"+objPathString+"/content/options.xul");
	browserMediator.register(startPreferences, 'pageshow', "chrome://"+objPathString+"/content/options.xul");
}

function onShutdown(aReason) {
	// remove the add-on from all windows
	windowMediator.callOnAll(stopAddon, null, null, true);
	browserMediator.callOnAll(stopAddon, null, true);
	
	moduleAid.unload('compatibilityFix/sandboxFixes');
	moduleAid.unload('findInTabsSandbox');
	moduleAid.unload('highlightColor');
	moduleAid.unload('builtinPrefs');
}
