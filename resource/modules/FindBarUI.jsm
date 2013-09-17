moduleAid.VERSION = '1.5.2';

this.__defineGetter__('findCSButton', function() { return gFindBar.getElement(objName+'-find-cs-button'); });
this.__defineGetter__('findCSCheckbox', function() { return gFindBar.getElement('find-case-sensitive'); });

this.doOpenOptions = function() {
	openOptions();
};

this.alwaysFindNormal = function(e) {
	// When opening FIT, enforce normal findbar mode
	if(prefAid.findInTabs && typeof(FITbox) != 'undefined' && FITbox && !FITbox.hidden) {
		if((!e.detail && gFindBar._findMode != gFindBar.FIND_NORMAL) || e.detail == gFindBar.FIND_TYPEAHEAD) {
			e.preventDefault();
			e.stopPropagation();
			gFindBar._findMode = gFindBar.FIND_NORMAL;
			gFindBar.open(gFindBar.FIND_NORMAL);
		}
		return;
	}
	
	// If opening normal Find bar when quick find is already opened, make sure we trigger the change
	if(!gFindBar.hidden && e.detail != gFindBar.FIND_TYPEAHEAD && gFindBar._findMode == gFindBar.FIND_TYPEAHEAD && prefAid.FAYTmode != 'alwaysquick') {
		e.preventDefault();
		e.stopPropagation();
		gFindBar._findMode = gFindBar.FIND_NORMAL;
		gFindBar.open(gFindBar.FIND_NORMAL);
		return;
	}
	
	// If typing when Find bar is already opened in normal mode, use that instead of "reopening" as quick find mode
	if(!gFindBar.hidden && e.detail == gFindBar.FIND_TYPEAHEAD) {
		e.preventDefault();
		e.stopPropagation();
		return;
	}
	
	// If opening findbar when QuickFind bar is already opened and we're supposed to keep QuickFind
	if(!gFindBar.hidden && ((!e.detail && gFindBar._findMode != gFindBar.FIND_TYPEAHEAD) || e.detail != gFindBar.FIND_TYPEAHEAD) && prefAid.FAYTmode == 'alwaysquick') {
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
	if(e.detail != gFindBar.FIND_TYPEAHEAD && prefAid.FAYTmode == 'alwaysquick') {
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
			gFindBar.onFindCommand();
			if(gFindBar._findField.value) {
				gFindBar._setHighlightTimeout();
			}
		}
		else {
			gFindBar.close();
		}
	}
};

this.csButtonCommand = function(e) {
	if(e.which != 0) {
		e.preventDefault();
		e.stopPropagation();
		return false;
	}
	
	findCSCheckbox.checked = !findCSCheckbox.checked;
	toggleAttribute(findCSButton, 'checked', findCSCheckbox.checked);
  	gFindBar._setCaseSensitivity(findCSCheckbox.checked);
	return true;
};

this.toggleButtonState = function() {
	toggleAttribute($(objName+'-button'), 'checked', ((!perTabFB || gFindBarInitialized) && !findBarHidden));
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
			if(!perTabFB) {
				var csButton = bar.getElement(objName+'-find-cs-button');
				if(prefAid.hideLabels && !csButton) {
					var button = document.createElement('toolbarbutton');
					button.setAttribute('anonid', objName+'-find-cs-button');
					button.setAttribute('class', 'findbar-highlight findbar-cs-button tabbable');
					button.setAttribute('tooltiptext', bar.getElement('find-case-sensitive').getAttribute('label'));
					toggleAttribute(button, 'checked', prefAid.casesensitive);
					csButton = bar.getElement("findbar-container").insertBefore(button, bar.getElement('find-case-sensitive'));
					listenerAid.add(csButton, 'command', csButtonCommand, true);
				} else if(!prefAid.hideLabels && csButton) {
					listenerAid.remove(csButton, 'command', csButtonCommand, true);
					csButton.parentNode.removeChild(csButton);
				}
			}
			
			toggleAttribute(bar, 'hideLabels', prefAid.hideLabels);
			triggerUIChange(bar);
		},
		function(bar) {
			if(!perTabFB) {
				var csButton = bar.getElement(objName+'-find-cs-button');
				if(csButton) {
					listenerAid.remove(csButton, 'command', csButtonCommand, true);
					csButton.parentNode.removeChild(csButton);
				}
			}
			
			removeAttribute(bar, 'hideLabels');
		},
		true
	);
};

this.toggleFindLabel = function() {
	toggleAttribute(gFindBar, 'hideFindLabel', prefAid.hideFindLabel);
};

this.toggleMoveToTop = function() {
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
	
	// The dummy function in this call prevents a weird bug where the overlay wouldn't be properly applied when opening a second window... for some reason...
	overlayAid.overlayURI('chrome://browser/content/browser.xul', 'findbar', function(window) { if(!perTabFB) { window.gFindBar; } });
	overlayAid.overlayURI('chrome://global/content/viewSource.xul', 'findbar');
	overlayAid.overlayURI('chrome://global/content/viewPartialSource.xul', 'findbar');
	
	if(!perTabFB) {
		prefAid.listen('hideFindLabel', toggleFindLabel);
		toggleFindLabel();
	}
	
	prefAid.listen('hideClose', toggleClose);
	prefAid.listen('hideLabels', toggleLabels);
	prefAid.listen('movetoRight', toggleMoveToRight);
	
	moduleAid.load('resizeTextbox');
	
	toggleClose();
	toggleLabels();
	toggleMoveToRight();
	
	if(!FITFull) {
		if(perTabFB) {
			initFindBar('contextMenu', function(bar) { setAttribute(bar, 'context', objPathString+'_findbarMenu'); }, function(bar) { removeAttribute(bar, 'context'); });
		}
		
		prefAid.listen('movetoTop', toggleMoveToTop);
		prefAid.listen('movetoBottom', toggleMoveToTop);
		prefAid.listen('keepButtons', toggleKeepButtons);
		prefAid.listen('movetoTop', toggleFF25Tweaks);
		prefAid.listen('movetoBottom', toggleFF25Tweaks);
		prefAid.listen('FF25Tweaks', toggleFF25Tweaks);
		
		listenerAid.add(window, 'WillOpenFindBar', alwaysFindNormal, true);
		listenerAid.add(window, 'OpenedFindBar', toggleButtonState);
		listenerAid.add(window, 'ClosedFindBar', toggleButtonState);
		
		if(!viewSource && perTabFB) {
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
		
		if(perTabFB) {
			if(!viewSource) {
				listenerAid.remove(gBrowser.tabContainer, "TabSelect", toggleButtonState);
			}
			deinitFindBar('contextMenu');
		}
	}
		
	prefAid.unlisten('hideClose', toggleClose);
	prefAid.unlisten('hideLabels', toggleLabels);
	prefAid.unlisten('movetoRight', toggleMoveToRight);
	
	moduleAid.unload('resizeTextbox');
	
	deinitFindBar('toggleClose');
	deinitFindBar('toggleLabels');
	deinitFindBar('toggleMoveToRight');
	
	if(!perTabFB) {
		prefAid.unlisten('hideFindLabel', toggleFindLabel);
		removeAttribute(gFindBar, 'hideFindLabel');
	}
	
	if(UNLOADED) {
		overlayAid.removeOverlayURI('chrome://browser/content/browser.xul', 'findbar');
		overlayAid.removeOverlayURI('chrome://global/content/viewSource.xul', 'findbar');
		overlayAid.removeOverlayURI('chrome://global/content/viewPartialSource.xul', 'findbar');
	}
};
