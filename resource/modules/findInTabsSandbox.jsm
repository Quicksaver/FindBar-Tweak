moduleAid.VERSION = '1.0.1';

this.toggleMoveFITtoTop = function() {
	if((onTopFB && !prefAid.movetoBottom) || prefAid.movetoTop) {
		overlayAid.overlayURI('chrome://'+objPathString+'/content/findInTabs.xul', 'movetoTop_FIT');
	} else {
		overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/findInTabs.xul', 'movetoTop_FIT');
	}
};

this.startFITWindow = function(aWindow) {
	replaceObjStrings(aWindow.document);
	startAddon(aWindow);
};

this.closeFITWindows = function() {
	windowMediator.callOnAll(function(aWindow) { try { aWindow.close(); } catch(ex) { Cu.reportError(ex); } }, null, "chrome://"+objPathString+"/content/findInTabsFull.xul");
};

this.FITenabledListener = function() {
	if(!prefAid.findInTabs) {
		closeFITWindows();
	}
};

moduleAid.LOADMODULE = function() {
	prefAid.listen('findInTabs', FITenabledListener);
	prefAid.listen('movetoTop', toggleMoveFITtoTop);
	prefAid.listen('movetoBottom', toggleMoveFITtoTop);
	
	toggleMoveFITtoTop();
	
	// Apply the add-on to our own FIT window; none are (or should be!) open yet, so only need to register
	windowMediator.register(startFITWindow, 'domwindowopened', null, "chrome://"+objPathString+"/content/findInTabsFull.xul");
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('findInTabs', FITenabledListener);
	prefAid.unlisten('movetoTop', toggleMoveFITtoTop);
	prefAid.unlisten('movetoBottom', toggleMoveFITtoTop);
	
	overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/findInTabs.xul', 'movetoTop_FIT');
	
	// If we get to this point it's probably safe to assume we should close all our windows
	closeFITWindows();
};
