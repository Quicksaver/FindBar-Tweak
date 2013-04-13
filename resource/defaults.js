var defaultsVersion = '1.0.0';
var objName = 'findbartweak';
var objPathString = 'findbartweak';
var prefList = {
	highlightByDefault: true,
	hideWhenFinderHidden: false,
	minNoDelay: 3,
	highlightColor: "#EF0FFF",
	useCounter: true,
	useGrid: true,
	gridLimit: 250,
	
	onStartup: false,
	findbarHidden: true,
	
	movetoTop: false,
	hideClose: false,
	hideLabels: false,
	
	ctrlFCloses: true,
	keepButtons: false,
	FAYTmode: 'quick',
	
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
}

function startConditions(aReason) {
	return true;
}

function onStartup(aReason) {
	moduleAid.load('highlightColor');
	moduleAid.load('compatibilityFix/sandboxFixes');
	
	// Apply the add-on to every window opened and to be opened
	windowMediator.callOnAll(startAddon, 'navigator:browser');
	windowMediator.register(startAddon, 'domwindowopened', 'navigator:browser');
	
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
}
