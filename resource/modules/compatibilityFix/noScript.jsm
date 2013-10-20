moduleAid.VERSION = '1.0.0';

// If the current notification open is NoScript's, it's at the bottom of the browser, so we don't need to hide the find bar
this.noScriptNotification = function(e) {
	if(gBrowser.getNotificationBox().currentNotification.parentNode.classList.contains('noscript-bottom-notify')) {
		e.preventDefault();
		e.stopPropagation();
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, "HideFindBarInNotification", noScriptNotification, true);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, "HideFindBarInNotification", noScriptNotification, true);
};
