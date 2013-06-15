var defaultsVersion = '1.0.15';
var objName = 'findbartweak';
var objPathString = 'findbartweak';
var prefList = {
	highlightByDefault: true,
	hideWhenFinderHidden: false,
	minNoDelay: 3,
	highlightColor: "#EF0FFF",
	useCounter: true,
	
	findInTabs: true,
	alwaysOpenFIT: false,
	maxFIT: 1000,
	
	useGrid: true,
	gridLimit: 250,
	gridAdjustPadding: 0,
	gridAdjustWidth: 0,
	
	sightsCurrent: true,
	sightsHighlights: false,
	sightsStyle: 'focus',
	sightsColor: '#EF0FFF',
	sightsSameColor: false,
	sightsSameColorAll: true,
	sightsAllColor: '#EF0FFF',
	sightsAllSameColor: true,
	
	blurCloses: false,
	perTab: false,
	onStartup: false,
	findbarHidden: true,
	
	movetoTop: false,
	movetoRight: false,
	hideClose: false,
	hideLabels: false,
	selectColor: '#38d878',
	keepSelectContrast: true,
	
	/* hidden settings for now, mechanism isn't good enough yet */
	squareLook: false,
	placeAbove: false,
	
	ctrlFCloses: true,
	keepButtons: false,
	FAYTmode: 'quick',
	
	/* to revert the builtin preferences */
	FAYTtimeout: 5000,
	FAYTenabled: false,
	FAYToriginal: false,
	
	lwthemebgImage: '',
	lwthemebgWidth: 0,
	lwthemecolor: '',
	lwthemebgColor: ''
};

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
	moduleAid.load('builtinPrefs');
	moduleAid.load('highlightColor');
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
	moduleAid.unload('highlightColor');
	moduleAid.unload('builtinPrefs');
}
