moduleAid.VERSION = '1.0.0';

// If the current notification open is NoScript's, it's at the bottom of the browser, so we don't need to hide the find bar
this.customButtonsBrowserValid = function(e) {
	if(e.target.currentURI.spec == 'chrome://custombuttons/content/editor.xul'
	|| (e.target.currentURI.spec == 'about:blank' && e.target.userTypedValue == 'chrome://custombuttons/content/editor.xul')) {
		e.preventDefault();
		e.stopPropagation();
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, "IsBrowserValid", customButtonsBrowserValid, true);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, "IsBrowserValid", customButtonsBrowserValid, true);
};
