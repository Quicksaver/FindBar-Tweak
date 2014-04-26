moduleAid.VERSION = '1.6.0';

this.__defineGetter__('findCSButton', function() { return gFindBar.getElement(objName+'-find-cs-button'); });
this.__defineGetter__('findCSCheckbox', function() { return gFindBar.getElement('find-case-sensitive'); });
this.__defineGetter__('findButton', function() {
	var node = $('find-button');
	
	// If the node is in the menu-panel for instance, it won't be found on startup, until the panel is opened once so it is built
	if(!node) {
		// Because of https://bugzilla.mozilla.org/show_bug.cgi?id=952963 this needs to be in a try block for now,
		// this can be changed once that bug is fixed.
		try {
			var widget = window.CustomizableUI.getWidget('find-button');
			if(widget.areaType) {
				node = widget.forWindow(window).node;
			}
		} catch(ex) {}
	}
	
	return node;
});

this.customizing = false;

this.doOpenOptions = function() {
	openOptions();
};

this.alwaysFindNormal = function(e) {
	// If opening normal Find bar when quick find is already opened, make sure we trigger the change
	if(!gFindBar.hidden && e.detail == gFindBar.FIND_NORMAL && gFindBar._findMode != gFindBar.FIND_NORMAL && prefAid.FAYTmode != 'alwaysquick') {
		e.preventDefault();
		e.stopPropagation();
		gFindBar._findMode = gFindBar.FIND_NORMAL;
		gFindBar.open(gFindBar.FIND_NORMAL);
		return;
	}
	
	// If typing when Find bar is already opened in normal mode, use that instead of "reopening" as quick find mode
	if(!gFindBar.hidden && gFindBar._findMode == gFindBar.FIND_NORMAL && e.detail == gFindBar.FIND_TYPEAHEAD) {
		e.preventDefault();
		e.stopPropagation();
		return;
	}
	
	// If opening findbar when QuickFind bar is already opened and we're supposed to keep QuickFind, make sure we do
	if(!gFindBar.hidden && prefAid.FAYTmode == 'alwaysquick' && (!e.detail || e.detail == gFindBar.FIND_NORMAL)) {
		e.preventDefault();
		e.stopPropagation();
		gFindBar.open(gFindBar.FIND_TYPEAHEAD);
		if(gFindBar._quickFindTimeout) { window.clearTimeout(gFindBar._quickFindTimeout); }
		gFindBar._quickFindTimeout = window.setTimeout(function(aSelf) { if(aSelf._findMode != aSelf.FIND_NORMAL) aSelf.close(); }, gFindBar._quickFindTimeoutLength, gFindBar);
		return;
	}
	
	// If the FindBar is already open do nothing and keep opening, this prevents the hangup when triggering the QuickFind bar when Find bar is open
	if(!gFindBar.hidden) { return; }
	
	// FAYT: option to force normal mode over quick find mode
	if(e.detail == gFindBar.FIND_TYPEAHEAD && prefAid.FAYTmode == 'normal') {
		e.preventDefault();
		e.stopPropagation();
		gFindBar.open(gFindBar.FIND_NORMAL);
		return;
	}
	
	// Option to force quick find mode over normal mode
	if((!e.detail || e.detail == gFindBar.FIND_NORMAL) && prefAid.FAYTmode == 'alwaysquick') {
		e.preventDefault();
		e.stopPropagation();
		gFindBar.open(gFindBar.FIND_TYPEAHEAD);
		if(gFindBar._quickFindTimeout) { window.clearTimeout(gFindBar._quickFindTimeout); }
		gFindBar._quickFindTimeout = window.setTimeout(function(aSelf) { if(aSelf._findMode != aSelf.FIND_NORMAL) aSelf.close(); }, gFindBar._quickFindTimeoutLength, gFindBar);
		return;
	}
};

this.triggerUIChange = function(bar) {
	dispatch(bar, { type: 'FindBarUIChanged', cancelable: false });
};

// Handler for Ctrl+F, it closes the findbar if it is already opened
this.toggleFindBar = function(event) {
	// Pale Moon doesn't have TabView
	if(!viewSource && window.TabView && window.TabView.isVisible()) {
		window.TabView.enableSearch(event);
	}
	else {
		if(gFindBar.hidden) {
			openFindBar();
		} else {
			gFindBar.close();
		}
	}
};

this.openFindBar = function() {
	gFindBar.onFindCommand();
	if(gFindBar._findField.value && (gFindBar._findField.value != linkedPanel._findWord || !documentHighlighted)) {
		gFindBar._setHighlightTimeout();
	}
};

this.toggleButtonState = function() {
	toggleAttribute(findButton, 'checked', (gFindBarInitialized && !gFindBar.hidden));
};

this.overrideButtonCommand = function(e) {
	if(e.originalTarget && e.originalTarget.id == 'find-button' && !e.defaultPrevented) {
		e.preventDefault(); // Don't do the default command
		e.stopPropagation();
		toggleFindBar();
	}
};

this.setFindButton = function() {
	customizing = false;
	
	if(findButton) {
		// I really don't like setting this listener on window, but setting it on findButton the event will be at phase AT_TARGET, and can't be
		// cancelled there.
		listenerAid.add(window, 'command', overrideButtonCommand, true);
		toggleButtonState();
	}
};

this.unsetFindButton = function() {
	customizing = true;
	
	if(findButton) {
		listenerAid.remove(window, 'command', overrideButtonCommand, true);
		removeAttribute(findButton, 'checked');
	}
};

// This is in case the button is added when a toolbar is created for example
this.setButtonListener = {
	onWidgetAdded: function(aId) {
		if(!customizing && aId == 'find-button') { setFindButton(); }
	}
};

this.toggleClose = function() {
	initFindBar('toggleClose',
		function(bar) {
			toggleAttribute(bar, 'noClose', prefAid.hideClose);
			triggerUIChange(bar);
		},
		function(bar) {
			removeAttribute(bar, 'noClose');
		},
		true
	);
};

this.toggleLabels = function() {
	initFindBar('toggleLabels',
		function(bar) {
			toggleAttribute(bar, 'hideLabels', prefAid.hideLabels);
			triggerUIChange(bar);
		},
		function(bar) {
			removeAttribute(bar, 'hideLabels');
		},
		true
	);
};

this.toggleMoveToTop = function() {
	// Because fb on top was backed out, let's ensure pref movetoBottom is disabled and stays that way
	if(prefAid.movetoBottom) { prefAid.movetoBottom = false; }
	
	moduleAid.loadIf('moveToTop', prefAid.movetoTop && (!onTopFB || !prefAid.movetoBottom));
	moduleAid.loadIf('moveToBottom', prefAid.movetoBottom && onTopFB);
};

this.toggleMoveToRight = function(startup) {
	initFindBar('toggleMoveToRight',
		function(bar) {
			toggleAttribute(bar, 'movetoright', prefAid.movetoRight);
		},
		function(bar) {
			removeAttribute(bar, 'movetoright');
		},
		true
	);
};

this.toggleKeepButtons = function(startup) {
	initFindBar('toggleKeepButtons',
		function(bar) {
			toggleAttribute(bar, 'keepButtons', prefAid.keepButtons);
		},
		function(bar) {
			removeAttribute(bar, 'keepButtons');
		},
		true
	);
};

this.toggleFF25Tweaks = function() {
	moduleAid.loadIf('FF25Tweaks', onTopFB && !viewSource && prefAid.FF25Tweaks && !prefAid.movetoTop && !prefAid.movetoBottom);
};

this.toolboxBorderCounter = { length: 0 };
this.noToolboxBorder = function(name, incr) {
	if(incr) {
		if(!toolboxBorderCounter[name]) {
			toolboxBorderCounter.length++;
			toolboxBorderCounter[name] = true;
		}
	} else {
		if(toolboxBorderCounter[name]) {
			toolboxBorderCounter.length--;
			delete toolboxBorderCounter[name];
		}
	}
	
	toggleAttribute(document.documentElement, 'noToolboxBorder', toolboxBorderCounter.length);
};

moduleAid.LOADMODULE = function() {
	// For the case-sensitive button
	prefAid.setDefaults({ casesensitive: 0 }, 'typeaheadfind', 'accessibility');
	
	overlayAid.overlayURI('chrome://browser/content/browser.xul', 'findbar');
	overlayAid.overlayURI('chrome://global/content/viewSource.xul', 'findbar');
	overlayAid.overlayURI('chrome://global/content/viewPartialSource.xul', 'findbar');
	
	prefAid.listen('hideClose', toggleClose);
	prefAid.listen('hideLabels', toggleLabels);
	prefAid.listen('movetoRight', toggleMoveToRight);
	
	moduleAid.load('resizeTextbox');
	
	toggleClose();
	toggleLabels();
	toggleMoveToRight();
	
	if(!FITFull) {
		if(!viewSource) {
			listenerAid.add(window, 'beforecustomization', unsetFindButton);
			listenerAid.add(window, 'aftercustomization', setFindButton);
			window.CustomizableUI.addListener(setButtonListener);
			
			setFindButton();
		}
		
		initFindBar('contextMenu', function(bar) { setAttribute(bar, 'context', objPathString+'_findbarMenu'); }, function(bar) { removeAttribute(bar, 'context'); });
		
		prefAid.listen('movetoTop', toggleMoveToTop);
		prefAid.listen('movetoBottom', toggleMoveToTop);
		prefAid.listen('keepButtons', toggleKeepButtons);
		prefAid.listen('movetoTop', toggleFF25Tweaks);
		prefAid.listen('movetoBottom', toggleFF25Tweaks);
		prefAid.listen('FF25Tweaks', toggleFF25Tweaks);
		
		listenerAid.add(window, 'WillOpenFindBar', alwaysFindNormal, true);
		listenerAid.add(window, 'OpenedFindBar', toggleButtonState);
		listenerAid.add(window, 'ClosedFindBar', toggleButtonState);
		
		if(!viewSource) {
			listenerAid.add(gBrowser.tabContainer, "TabSelect", toggleButtonState);
		}
		
		toggleMoveToTop();
		toggleKeepButtons();
		toggleFF25Tweaks();
	}
};

moduleAid.UNLOADMODULE = function() {
	if(!FITFull) {
		prefAid.unlisten('movetoTop', toggleMoveToTop);
		prefAid.unlisten('movetoBottom', toggleMoveToTop);
		prefAid.unlisten('keepButtons', toggleKeepButtons);
		prefAid.unlisten('movetoTop', toggleFF25Tweaks);
		prefAid.unlisten('movetoBottom', toggleFF25Tweaks);
		prefAid.unlisten('FF25Tweaks', toggleFF25Tweaks);
		
		moduleAid.unload('FF25Tweaks');
		moduleAid.unload('moveToTop');
		moduleAid.unload('moveToBottom');
		
		deinitFindBar('toggleKeepButtons');
		
		listenerAid.remove(window, 'WillOpenFindBar', alwaysFindNormal, true);
		listenerAid.remove(window, 'OpenedFindBar', toggleButtonState);
		listenerAid.remove(window, 'ClosedFindBar', toggleButtonState);
		
		if(!viewSource) {
			listenerAid.remove(gBrowser.tabContainer, "TabSelect", toggleButtonState);
		}
		deinitFindBar('contextMenu');
	
		if(!viewSource) {
			listenerAid.remove(window, 'beforecustomization', unsetFindButton);
			listenerAid.remove(window, 'aftercustomization', setFindButton);
			window.CustomizableUI.removeListener(setButtonListener);
			
			unsetFindButton();
		}
	}
		
	prefAid.unlisten('hideClose', toggleClose);
	prefAid.unlisten('hideLabels', toggleLabels);
	prefAid.unlisten('movetoRight', toggleMoveToRight);
	
	moduleAid.unload('resizeTextbox');
	
	deinitFindBar('toggleClose');
	deinitFindBar('toggleLabels');
	deinitFindBar('toggleMoveToRight');
	
	if(UNLOADED) {
		overlayAid.removeOverlayURI('chrome://browser/content/browser.xul', 'findbar');
		overlayAid.removeOverlayURI('chrome://global/content/viewSource.xul', 'findbar');
		overlayAid.removeOverlayURI('chrome://global/content/viewPartialSource.xul', 'findbar');
	}
};
