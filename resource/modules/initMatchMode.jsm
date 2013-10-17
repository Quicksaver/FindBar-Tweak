moduleAid.VERSION = '1.0.2';

this.MATCH_MODE_NORMAL = 0;
this.MATCH_MODE_CASE_SENSITIVE = 1;

this.modePopupMouse = { x: 0, y: 0 };
this.modePopupDims = {};

this.openModePopup = function(e) {
	// I can use gFindBar directly, mouseover means it needs the find bar to mouse over
	
	// Cancel the hiding timer if it exists, so we don't close it when we don't want to
	if(gFindBar._popupMode.state == 'open') {
		timerAid.cancel('shouldHideModePopup');
		return;
	}
		
	gFindBar._popupMode.openPopup(gFindBar._buttonMode, (trueAttribute(gFindBar, 'movetotop') || gFindBar.getAttribute('position') == 'top') ? 'after_end' : 'before_end');
	gFindBar._popupMode._neverOpened = false;
	
	modePopupDims.popup = gFindBar._popupMode.getBoundingClientRect();
	modePopupDims.button = gFindBar._buttonMode.getBoundingClientRect();
	
	// I can't use mouseout's because when hovering menuitems it sends mouseover and mouseout events all over the place, inclusively mouseout's after mouseover's
	listenerAid.add(window, 'mousemove', delayShouldHideModePopup);
};

this.hideModePopup = function() {
	listenerAid.remove(window, 'mousemove', delayShouldHideModePopup);
	
	if(perTabFB && !gFindBarInitialized) { return; } // We could have changed tabs meanwhile
	if(gFindBar._popupMode.state == 'open') {
		gFindBar._popupMode.hidePopup();
		if(!gFindBar.hidden) {
			gFindBar._findField.focus();
		}
	}
};

this.delayShouldHideModePopup = function(e) {
	modePopupMouse.x = e.clientX;
	modePopupMouse.y = e.clientY;
	
	// Don't over do the mousemove listener, but also don't wait for the user to stop moving the mouse
	if(!timerAid.shouldHideModePopup) {
		timerAid.init('shouldHideModePopup', shouldHideModePopup, 300);
	}
};

this.shouldHideModePopup = function() {
	var x = modePopupMouse.x;
	var y = modePopupMouse.y;
	
	for(var d in modePopupDims) {
		if(x > modePopupDims[d].left
		&& x < modePopupDims[d].right
		&& y > modePopupDims[d].top
		&& y < modePopupDims[d].bottom) {
			return;
		}
	}
	
	hideModePopup();
};

this.commandModeItem = function(item) {
	// It's just weird that it needs to be opened once... If it's never been opened, radio menuitem's can have multiple checked items and throw everything off
	if(item.parentNode._neverOpened) {
		openModePopup();
		hideModePopup();
	}
	
	if(!trueAttribute(item, 'checked')) {
		setAttribute(item, 'checked', 'true'); // it won't autocheck when using keyboard navigation
	} else if(gFindBar._popupMode.state == 'open') {
		listenerAid.add(gFindBar._popupMode, 'popuphiding', function(e) {
			e.preventDefault();
			e.stopPropagation();
		}, true, true);
	}
	
	item.parentNode.parentNode.updateMatchMode();
};

// There is a reason I'm doing this before the findbar opens and not after.
// But I've forgotten it... I think it's so we can check for .hidden before, so we only reset the mode only when it actually opens
this.matchModeOnOpen = function() {
	if(!gFindBar.hidden) { return; }
	
	var mode = prefAid.matchMode;
	if(documentHighlighted && linkedPanel._findWord == gFindBar._findField.value) {
		mode = linkedPanel._matchMode;
	}
	
	gFindBar._buttonMode.updateMatchMode(mode);
};

this.showMatchModeStatus = function(e) {
	var bar = e.originalTarget;
	bar.getElement('match-case-status').hidden = (bar._findMode == bar.FIND_NORMAL || prefAid.keepButtons || bar._matchMode == MATCH_MODE_NORMAL);
};

this.modeInit = function(bar) {
	// This method is not needed with our system
	bar.__updateCaseSensitivity = bar._updateCaseSensitivity;
	bar._updateCaseSensitivity = function() { return; };
	
	// Ensure we send the correct value for caseSensitivity search
	bar.__dispatchFindEvent = bar._dispatchFindEvent;
	bar._dispatchFindEvent = function(aType, aFindPrevious) {
		let event = document.createEvent("CustomEvent");
		event.initCustomEvent("find" + aType, true, true, {
			query: this._findField.value,
			caseSensitive: this._matchMode == MATCH_MODE_CASE_SENSITIVE,
			highlightAll: this.getElement("highlight").checked,
			findPrevious: aFindPrevious
		});
		return this.dispatchEvent(event);
	};
	
	bar.getElement('find-case-sensitive').disabled = true;
	
	if(!perTabFB) {
		bar.getElement('find-next')._accesskey = bar.getElement('find-next').getAttribute('acesskey');
		bar.getElement('find-previous')._accesskey = bar.getElement('find-previous').getAttribute('acesskey');
		removeAttribute(bar.getElement('find-next'), 'accesskey');
		removeAttribute(bar.getElement('find-previous'), 'accesskey');
	}
	
	// Actual button that acts as the main commander for setting find mode and restrictions
	var modeBtn = document.createElement('toolbarbutton');
	setAttribute(modeBtn, 'anonid', objName+'-match-mode');
	setAttribute(modeBtn, 'class', 'findbar-highlight findbar-findmode tabbable');
	setAttribute(modeBtn, 'autoCheck', 'false');
	modeBtn._findbar = bar;
	modeBtn = bar.getElement("findbar-container").insertBefore(modeBtn, bar.getElement('find-case-sensitive'));
	
	modeBtn.updateMatchMode = function(forceMode) {
		var bar = this._findbar;
		var mode = prefAid.matchMode;
		var previousMode = this._matchMode;
		
		var modeItems = this.querySelectorAll('[name="matchMode"]');
		for(var i=0; i<modeItems.length; i++) {
			if(forceMode !== undefined && forceMode == modeItems[i]._modeValue) {
				setAttribute(modeItems[i], 'checked', 'true');
			}
			
			if(trueAttribute(modeItems[i], 'checked') && (forceMode === undefined || forceMode == modeItems[i]._modeValue)) {
				mode = modeItems[i]._modeValue;
				break;
			}
		}
		
		var label = '';
		switch(mode) {
			case MATCH_MODE_NORMAL:
				label = stringsAid.get('matchMode', 'normalFind');
				break;
			case MATCH_MODE_CASE_SENSITIVE:
				label = stringsAid.get('matchMode', 'caseSensitive');
				break;
			default: break;
		}
		
		this._matchMode = mode;
		setAttribute(this, 'label', label);
		toggleAttribute(this, 'checked', (mode != MATCH_MODE_NORMAL));
		
		setAttribute(bar.getElement("match-case-status"), 'value', '('+label+')');
		
		if(forceMode === undefined && previousMode != mode && bar._findField.value) {
			bar._find();
		}
	};
	
	// Popup menu which contains all the options available for find modes and restrictions
	var popup = document.createElement('panel');
	setAttribute(popup, 'anonid', objName+'-mode-popup');
	popup._neverOpened = true;
	popup = modeBtn.appendChild(popup);
	
	var item = document.createElement('menuitem');
	setAttribute(item, 'name', 'matchMode');
	setAttribute(item, 'type', 'radio');
	setAttribute(item, 'oncommand', objName+'.commandModeItem(this);');
	setAttribute(item, 'onmouseover', 'this.setAttribute("_moz-menuactive", "true");');
	setAttribute(item, 'onmouseout', 'this.removeAttribute("_moz-menuactive");');
	
	var csItem = item.cloneNode(true);
	setAttribute(csItem, 'label', stringsAid.get('matchMode', 'caseSensitive'));
	setAttribute(csItem, 'accesskey', stringsAid.get('matchMode', 'caseSensitiveAccesskey'));
	csItem._modeValue = MATCH_MODE_CASE_SENSITIVE;
	csItem = popup.appendChild(csItem);
	
	var normalItem = item.cloneNode(true);
	setAttribute(normalItem, 'label', stringsAid.get('matchMode', 'normalFind'));
	setAttribute(normalItem, 'accesskey', stringsAid.get('matchMode', 'normalFindAccesskey'));
	normalItem._modeValue = MATCH_MODE_NORMAL;
	normalItem = popup.appendChild(normalItem);
	
	listenerAid.add(modeBtn, 'mouseover', openModePopup);
	keydownPanel.setupPanel(popup);
	
	bar._popupMode = popup;
	bar._buttonMode = modeBtn;
	bar.__defineGetter__('_matchMode', function() { return this._buttonMode._matchMode; });
	
	bar._buttonMode.updateMatchMode(prefAid.matchMode);
};

this.modeDeinit = function(bar) {
	listenerAid.remove(bar._buttonMode, 'mouseover', openModePopup);
	listenerAid.remove(window, 'mousemove', delayShouldHideModePopup);
	keydownPanel.unsetPanel(bar._popupMode);
	
	bar._buttonMode.parentNode.removeChild(bar._buttonMode);
	delete bar._popupMode;
	delete bar._buttonMode;
	delete bar._matchMode;
	
	setAttribute(bar.getElement("match-case-status"), 'value', '');
	bar.getElement('find-case-sensitive').disabled = false;
	
	if(!perTabFB) {
		setAttribute(bar.getElement('find-next'), 'accesskey', bar.getElement('find-next')._accesskey);
		setAttribute(bar.getElement('find-previous'), 'accesskey', bar.getElement('find-previous')._accesskey);
		delete bar.getElement('find-next')._accesskey;
		delete bar.getElement('find-previous')._accesskey;
	}
	
	bar._updateCaseSensitivity = bar.__updateCaseSensitivity;
	bar._dispatchFindEvent = bar.__dispatchFindEvent;
	delete bar.__updateCaseSensitivity;
	delete bar._dispatchFindEvent;
};

this.followModeAccesskey = function(e) {
	if(e.defaultPrevented || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) { return; }
	if(perTabFB && !gFindBarInitialized) { return; }
	if(gFindBar.hidden
	|| !isAncestor(e.originalTarget, gFindBar)
	|| (gFindBar._buttonMode.hidden && !prefAid.keepButtons)
	|| trueAttribute(gFindBar._buttonMode, 'disabled')) { return; }
	
	switch(e.which) {
		case e.DOM_VK_A: case e.DOM_VK_B: case e.DOM_VK_C: case e.DOM_VK_D: case e.DOM_VK_E: case e.DOM_VK_F: case e.DOM_VK_G: case e.DOM_VK_H: case e.DOM_VK_I: case e.DOM_VK_J: case e.DOM_VK_K: case e.DOM_VK_L: case e.DOM_VK_M: case e.DOM_VK_N: case e.DOM_VK_O: case e.DOM_VK_P: case e.DOM_VK_Q: case e.DOM_VK_R: case e.DOM_VK_S: case e.DOM_VK_T: case e.DOM_VK_U: case e.DOM_VK_V: case e.DOM_VK_W: case e.DOM_VK_X: case e.DOM_VK_Y: case e.DOM_VK_Z:
			var items = gFindBar._popupMode.querySelectorAll('menuitem');
			for(var i=0; i<items.length; i++) {
				if(keydownPanel.menuItemAccesskeyCode(items[i].getAttribute('accesskey'), e) == e.which
				&& !trueAttribute(items[i], 'checked')) {
					e.preventDefault();
					e.stopPropagation();
					items[i].doCommand();
					return;
				}
			}
			break;
			
		default: break;
	}
};

moduleAid.LOADMODULE = function() {
	initFindBar('matchMode', modeInit, modeDeinit);
	
	listenerAid.add(window, 'OpenedFindBarAnotherTab', showMatchModeStatus);
	listenerAid.add(window, 'OpenedFindBar', showMatchModeStatus);
	
	// Mac keys are behaving differently, I think altKey should fire when I hit option, but ctrlKey is firing (only in this handler!)
	// Since I'm not sure this is the correct behavior, I'm disabling this in Mac for now
	if(Services.appinfo.OS != 'Darwin') {
		listenerAid.add(window, 'keydown', followModeAccesskey, true);
	}
	
	if(!FITFull && !viewSource) {
		listenerAid.add(window, 'WillOpenFindBar', matchModeOnOpen);
		
		// ensure we have the popup hidden when we switch tab
		listenerAid.add(gBrowser.tabContainer, "TabSelect", hideModePopup);
	}
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, 'OpenedFindBarAnotherTab', showMatchModeStatus);
	listenerAid.remove(window, 'OpenedFindBar', showMatchModeStatus);
	listenerAid.remove(window, 'keydown', followModeAccesskey, true);
	
	if(!FITFull && !viewSource) {
		listenerAid.remove(window, 'WillOpenFindBar', matchModeOnOpen);
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", hideModePopup);
	}
	
	deinitFindBar('matchMode');
};
