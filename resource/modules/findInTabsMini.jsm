moduleAid.VERSION = '1.0.3';

this.__defineGetter__('FITbroadcaster', function() { return $(objName+'-findInTabs-broadcaster'); });

this.commandUpdateFIT = function() {
	if(!FITFull && (viewSource || prefAid.FITFull || FITbox.hidden)) {
		toggleFIT();
		return;
	}
	
	if(FITFull || (!viewSource && !prefAid.FITFull && !FITbox.hidden)) {
		shouldFindAll();
	}
};

this.toggleFIT = function() {
	if(FITFull) {
		gFindBar.onFindCommand();
		return;
	}
	
	var aWindow = null;
	
	// Re-use an already opened window if possible
	if(!prefAid.multipleFITFull) {
		windowMediator.callOnAll(function(bWindow) {
			if(!aWindow) {
				aWindow = bWindow;
				if((viewSource || !perTabFB || gFindBarInitialized)
				&& !gFindBar.hidden
				&& gFindBar._findField.value
				&& aWindow.document.readyState != 'uninitialized'
				&& aWindow[objName].lastWindow == contentDocument.defaultView
				&& gFindBar._findField.value != aWindow.document.getElementById('FindToolbar')._findField.value) {
					aWindow.document.getElementById('FindToolbar')._findField.value = gFindBar._findField.value;
					aWindow[objName].shouldFindAll();
				}
				aWindow.document.getElementById('FindToolbar').onFindCommand();
				aWindow.focus();	
			}
		}, 'addon:findInTabs');
		
		if(aWindow) { return; }
	}
	
	if(prefAid.FITFull || viewSource) {
		// No window found, we need to open a new one
		aWindow = window.open("chrome://"+objPathString+"/content/findInTabsFull.xul", '', 'chrome,extrachrome,toolbar,resizable');
		
		if(aWindow.document.readyState == 'uninitialized') {
			listenerAid.add(aWindow, 'load', function() {
				carryDataToFITFull(aWindow);
			}, false, true);
		} else {
			carryDataToFITFull(aWindow);
		}
		return;
	}
	
	toggleFITBox();
};

this.carryDataToFITFull = function(aWindow) {
	if((viewSource || !perTabFB || gFindBarInitialized) && (!gFindBar.hidden || documentHighlighted) && gFindBar._findField.value) {
		aWindow.document.getElementById('FindToolbar')._findField.value = gFindBar._findField.value;
	}
	if(typeof(aWindow[objName].lastWindow) == 'undefined') {
		listenerAid.add(aWindow, 'FITLoaded', function() {
			aWindow[objName].lastWindow = contentDocument.defaultView;
		}, false, true);
	} else {
		aWindow[objName].lastWindow = contentDocument.defaultView;
	}
};

this.addFITMainButton = function(bar) {
	var container = bar.getElement("findbar-container");
	
	var toggleButton = document.createElement('toolbarbutton');
	setAttribute(toggleButton, 'anonid', objName+'-find-tabs');
	setAttribute(toggleButton, 'class', 'findbar-highlight findbar-tabs tabbable findbar-no-find-fast');
	setAttribute(toggleButton, 'observes', objName+'-findInTabs-broadcaster');
	bar._FITtoggle = container.insertBefore(toggleButton, bar.getElement('find-case-sensitive').nextSibling);
};

this.removeFITMainButton = function(bar) {
	bar._FITtoggle.parentNode.removeChild(bar._FITtoggle);
	delete bar._FITtoggle;
};

this.FITtabLoaded = function(e) {
	// this is the content document of the loaded page.
	var doc = e.originalTarget;
	if(doc instanceof window.HTMLDocument) {
		// is this an inner frame?
		// Find the root document:
		while(doc.defaultView.frameElement) {
			doc = doc.defaultView.frameElement.ownerDocument;
		}
		
		observerAid.notify('FIT-update-doc', doc, e.type);
	}
};

this.FITtabClosed = function(e) {
	observerAid.notify('FIT-update-doc', e.target, e.type);
};

this.FITProgressListener = {
	onLocationChange: function(aBrowser, webProgress, request, location) {
		// Frames don't need to trigger this
		if(webProgress.DOMWindow == aBrowser.contentWindow) {
			observerAid.notify('FIT-update-doc', aBrowser.contentDocument, 'location-change');
		}
	}
};

this.sendToAutoSelectFITtab = function() {
	observerAid.notify('FIT-update-doc', contentDocument, 'autoSelectFITtab');
};

this.sendToAutoSelectFITtabFoundFindBar = function() {
	observerAid.notify('FIT-update-doc', contentDocument, 'autoSelectFITtabFoundFindBar');
};

this.autoSelectOnUpdateStatus = function() {
	// We only need this in pdf documents, the 'FoundAgain' listener will handle the other documents.
	// We do with a delay to allow the page to render the selected element
	if(isPDFJS) { timerAid.init('autoSelectOnUpdateStatus', sendToAutoSelectFITtab, 10); }
};

this.focusedThisWindow = function(e) {
	if(e.target.document == contentDocument) {
		sendToAutoSelectFITtab();
	}
};

this.loadFindInTabsMini = function() {
	initFindBar('findInTabsMini', addFITMainButton, removeFITMainButton);
	
	listenerAid.add(window, 'FoundFindBar', sendToAutoSelectFITtabFoundFindBar);
	listenerAid.add(window, 'FoundAgain', sendToAutoSelectFITtab);
	listenerAid.add(window, 'SelectedFIThit', sendToAutoSelectFITtab);
	listenerAid.add(window, 'focus', focusedThisWindow, true);
	
	if(Services.wm.getMostRecentWindow(null) == window) { sendToAutoSelectFITtab(); }
	
	if(!viewSource) {
		// Update FIT lists as needed
		listenerAid.add(window, 'UpdatedStatusFindBar', autoSelectOnUpdateStatus);
		listenerAid.add(gBrowser, 'load', FITtabLoaded, true);
		listenerAid.add(gBrowser.tabContainer, 'TabClose', FITtabClosed, false);
		listenerAid.add(gBrowser.tabContainer, 'TabSelect', sendToAutoSelectFITtab);
		gBrowser.addTabsProgressListener(FITProgressListener);
	}
	
	prefAid.listen('FITFull', loadFITmodule);
	loadFITmodule();
};

this.loadFITmodule = function() {
	var load = FITFull || (!prefAid.FITFull && !viewSource);
	moduleAid.loadIf('findInTabs', load);
	if(!load) {
		removeAttribute(FITbroadcaster, 'checked');
	}
};

moduleAid.LOADMODULE = function() {
	if(!FITFull) {
		overlayAid.overlayWindow(window, 'findInTabsMini', null, loadFindInTabsMini);
	} else {
		loadFITmodule();
	}
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('FITFull', loadFITmodule);
	moduleAid.unload('findInTabs');
	
	if(FITFull) { return; }
	
	deinitFindBar('findInTabsMini');
	
	listenerAid.remove(window, 'FoundFindBar', sendToAutoSelectFITtabFoundFindBar);
	listenerAid.remove(window, 'FoundAgain', sendToAutoSelectFITtab);
	listenerAid.remove(window, 'SelectedFIThit', sendToAutoSelectFITtab);
	listenerAid.remove(window, 'focus', focusedThisWindow, true);
	
	if(!viewSource) {
		listenerAid.remove(window, 'UpdatedStatusFindBar', autoSelectOnUpdateStatus);
		listenerAid.remove(gBrowser, 'load', FITtabLoaded, true);
		listenerAid.remove(gBrowser.tabContainer, 'TabClose', FITtabClosed, false);
		listenerAid.remove(gBrowser.tabContainer, 'TabSelect', sendToAutoSelectFITtab);
		gBrowser.removeTabsProgressListener(FITProgressListener);
		
		// Ensure we remove tabs of closing windows from lists
		if((window.closed || window.willClose) && !UNLOADED && prefAid.findInTabs) {
			for(var t=0; t<gBrowser.mTabs.length; t++) {
				observerAid.notify('FIT-update-doc', gBrowser.mTabs[t], 'TabClose');
			}
		}
	}
	
	overlayAid.removeOverlayWindow(window, 'findInTabsMini');
};
