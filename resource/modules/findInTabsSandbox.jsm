Modules.VERSION = '2.1.0';

this.FITSandbox = {
	fulls: new Set(),
	viewSources: new Set(),
	navigators: new Set(),
	
	observe: function(aSubject, aTopic, aData) {
		switch(aTopic) {
			case 'domwindowopened':
				this.fulls.add(aSubject);
				listenOnce(aSubject, 'unload', () => {
					this.fulls.delete(aSubject);
					if(this.fulls.size == 0) {
						Observers.notify('FIT:Unload');
					}
				});
				
				replaceObjStrings(aSubject.document);
				startAddon(aSubject);
				Observers.notify('FIT:Load');
				break;
			
			case 'nsPref:changed':
				if(!Prefs.findInTabs) {
					this.closeWindows();
				}
				break;
		}
	},
	
	closeWindows: function() {
		Windows.callOnAll(function(aWindow) {
			try { aWindow.close(); }
			catch(ex) { Cu.reportError(ex); }
		}, 'addon:findInTabs');
	}
};

Modules.LOADMODULE = function() {
	Prefs.listen('findInTabs', FITSandbox);
	
	// Apply the add-on to our own FIT window; none are (or should be!) open yet, so only need to register
	Windows.register(FITSandbox, 'domwindowopened', null, "chrome://"+objPathString+"/content/findInTabsFull.xul");
};

Modules.UNLOADMODULE = function() {
	Prefs.unlisten('findInTabs', FITSandbox);
	Windows.unregister(FITSandbox, 'domwindowopened');
	
	// If we get to this point it's probably safe to assume we should close all our windows
	FITSandbox.closeWindows();
};
