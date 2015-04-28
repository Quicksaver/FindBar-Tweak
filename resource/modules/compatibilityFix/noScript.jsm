Modules.VERSION = '1.0.1';

// If the current notification open is NoScript's, it's at the bottom of the browser, so we don't need to hide the find bar
this.noScriptNotification = function(e) {
	if(gBrowser.getNotificationBox().currentNotification.parentNode.classList.contains('noscript-bottom-notify')) {
		e.preventDefault();
		e.stopPropagation();
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(window, "HideFindBarInNotification", noScriptNotification, true);
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, "HideFindBarInNotification", noScriptNotification, true);
};
