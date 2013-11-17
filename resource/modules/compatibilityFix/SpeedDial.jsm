moduleAid.VERSION = '1.0.0';

// If the current notification open is NoScript's, it's at the bottom of the browser, so we don't need to hide the find bar
this.SpeedDialBrowserValid = function(e) {
	if(e.target.currentURI.spec == 'chrome://speeddial/content/speeddial.xul') {
		e.preventDefault();
		e.stopPropagation();
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, "IsBrowserValid", SpeedDialBrowserValid, true);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, "IsBrowserValid", SpeedDialBrowserValid, true);
};
