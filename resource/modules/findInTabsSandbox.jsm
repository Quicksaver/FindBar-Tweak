Modules.VERSION = '2.0.0';

this.FITSandbox = {
	fulls: new Set(),
	viewSources: new Set(),
	navigators: new Set(),
	
	startWindow: function(aWindow) {
		FITSandbox.fulls.add(aWindow);
		listenOnce(aWindow, 'unload', function() {
			FITSandbox.fulls.delete(aWindow);
			if(FITSandbox.fulls.size == 0) {
				Observers.notify('FIT:Unload');
			}
		});
		
		replaceObjStrings(aWindow.document);
		startAddon(aWindow);
		Observers.notify('FIT:Load');
	},
	
	closeWindows: function() {
		Windows.callOnAll(function(aWindow) {
			try { aWindow.close(); }
			catch(ex) { Cu.reportError(ex); }
		}, 'addon:findInTabs');
	},
	
	enabledListener: function() {
		if(!Prefs.findInTabs) {
			FITSandbox.closeWindows();
		}
	}
};

Modules.LOADMODULE = function() {
	Prefs.listen('findInTabs', FITSandbox.enabledListener);
	
	// Apply the add-on to our own FIT window; none are (or should be!) open yet, so only need to register
	Windows.register(FITSandbox.startWindow, 'domwindowopened', null, "chrome://"+objPathString+"/content/findInTabsFull.xul");
};

Modules.UNLOADMODULE = function() {
	Prefs.unlisten('findInTabs', FITSandbox.enabledListener);
	
	// If we get to this point it's probably safe to assume we should close all our windows
	FITSandbox.closeWindows();
};
