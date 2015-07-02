Modules.VERSION = '2.0.7';

this.__defineGetter__('gBrowserBox', function() { return $('browser'); });
this.__defineGetter__('gAppContent', function() { return $('appcontent'); });
this.__defineGetter__('TabsToolbar', function() { return $('TabsToolbar'); });

// until I find a better way of finding out on which side of the browser is the scrollbar, I'm setting equal margins
this.MIN_LEFT = 22;
this.MIN_RIGHT = 22;
this.CORNER_WIDTH = 16;
this.moveTopStyle = null;

this.shouldReMoveTop = function(newStyle) {
	if(!moveTopStyle) { return true; }
	
	if(!newStyle) {
		if(isPDFJS != moveTopStyle.inPDFJS || (isPDFJS && isPDFJS.loadingBar != moveTopStyle.PDFJSloadingBar)) { return true; }
		return (gFindBar.clientWidth != moveTopStyle.clientWidth);
	}
	else if(newStyle.top != moveTopStyle.top
		|| newStyle.right != moveTopStyle.right
		|| newStyle.left != moveTopStyle.left
		|| newStyle.maxWidth != moveTopStyle.maxWidth
		|| newStyle.clientWidth != moveTopStyle.clientWidth
		|| newStyle.movetoRight != moveTopStyle.movetoRight) {
			return true;
	}
	
	return false;
};

this.delayMoveTop = function() {
	Timers.init('delayMoveTop', moveTop, 0);
};

this.moveTopAsNeeded = function(e) {
	if(shouldReMoveTop()) {
		if(e.type == 'FindBarUIChanged') {
			moveTop();
		} else {
			delayMoveTop();
		}
	}
};

// Handles the position of the findbar
this.moveTop = function() {
	// always move it at least once to prevent the initial hangup
	if(moveTopStyle) {
		// no need to move it again if it's hidden, the stylesheet should remain valid
		if((!viewSource && !gFindBarInitialized) || gFindBar.hidden) { return; }
	} else if(!viewSource) {
		gFindBar; // make sure the find bar is initialized past this point
	}
	
	// The textbox maxWidth code should be removed, so we have an accurate size of the find bar here
	dispatch(gFindBar, { type: 'FindBarMaybeMoveTop', cancelable: false });
	
	var topStyle = {
		movetoRight: Prefs.movetoRight,
		maxWidth: -MIN_RIGHT -MIN_LEFT,
		clientWidth: gFindBar.clientWidth,
		left: MIN_LEFT,
		right: MIN_RIGHT,
		PDFJSloadingBar: 0,
		inPDFJS: false,
		top: -1 // Move the find bar one pixel up so it covers the toolbox borders, giving it a more seamless look
	};
	
	var contentPos = $('content').getBoundingClientRect();
	topStyle.maxWidth += contentPos.width;
	topStyle.top += contentPos.top;
	topStyle.left += contentPos.left;
	topStyle.right += document.documentElement.clientWidth -contentPos.right;
	
	// Compatibility with TreeStyleTab
	if(!viewSource && TabsToolbar && !TabsToolbar.collapsed && TabsToolbar.getAttribute('treestyletab-tabbar-autohide-state') != 'hidden') {
		// This is also needed when the tabs are on the left, the width of the findbar doesn't follow with the rest of the window for some reason
		if(TabsToolbar.getAttribute('treestyletab-tabbar-position') == 'left' || TabsToolbar.getAttribute('treestyletab-tabbar-position') == 'right') {
			var TabsSplitter = $ª($('content'), 'treestyletab-splitter', 'class');
			topStyle.maxWidth -= TabsToolbar.clientWidth;
			topStyle.maxWidth -= TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			if(TabsToolbar.getAttribute('treestyletab-tabbar-position') == 'left') {
				topStyle.left += TabsToolbar.clientWidth;
				topStyle.left += TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			}
			if(TabsToolbar.getAttribute('treestyletab-tabbar-position') == 'right') {
				topStyle.right += TabsToolbar.clientWidth;
				topStyle.right += TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			}
		}
	}
	
	// Compatibility with PDF.JS
	if(isPDFJS && isPDFJS.toolbar) {
		topStyle.inPDFJS = true;
		topStyle.top += isPDFJS.toolbarHeight;
		topStyle.left += isPDFJS.sidebarWidth;
		topStyle.maxWidth -= isPDFJS.sidebarWidth;
		if(isPDFJS.loadingBar) {
			topStyle.top += isPDFJS.loadingBar;
			topStyle.PDFJSloadingBar = isPDFJS.loadingBar;
			
			// don't cover the loading bar
			topStyle.top++;
		}
	}
	
	toggleAttribute(gFindBar, 'inPDFJS', topStyle.inPDFJS);
	toggleNotificationState();
	
	if(!shouldReMoveTop(topStyle)) {
		dispatch(gFindBar, { type: 'FindBarMovedTop', cancelable: false });
		return;
	}
	
	moveTopStyle = topStyle;
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop] {\n';
	sscode += '		max-width: ' + Math.max(topStyle.maxWidth, 5) + 'px;\n';
	// Bug 893446 sets left and right values to 0, so we need to overwrite them
	if(!Prefs.movetoRight) {
		sscode += '	left: ' + topStyle.left + 'px;\n';
	//	sscode += '	right: auto;\n';
	} else {
		sscode += '	right: ' + topStyle.right + 'px;\n';
	//	sscode += '	left: auto;\n';
	}
	sscode += '		top: ' + topStyle.top + 'px;\n';
	sscode += '		bottom: auto;\n';
	sscode += '	}';
	sscode += '}';
	
	Styles.load('topFindBar_'+_UUID, sscode, true);
	
	dispatch(gFindBar, { type: 'FindBarMovedTop', cancelable: false });
	
	moveTopCorners();
	if(!viewSource) { stylePersonaFindBar(); }
	
	// Doing it aSync prevents the window elements from jumping at startup (stylesheet not loaded yet)
	aSync(function() { setOnTop(); });
};

this.moveTopCorners = function() {
	// We also need to properly place the corners, these vary with OS, FF version, theme...
	var barStyle = getComputedStyle(gFindBar);
	var container = gFindBar.getElement('findbar-container');
	
	if(barStyle.getPropertyValue('direction') == 'ltr') {
		var findBarPaddingStart = parseInt(barStyle.paddingLeft);
		var findBarPaddingEnd = parseInt(barStyle.paddingRight);
		var findBarBorderStart = parseInt(barStyle.borderLeftWidth);
		var findBarBorderEnd = parseInt(barStyle.borderRightWidth);
	} else {
		var findBarPaddingStart = parseInt(barStyle.paddingRight);
		var findBarPaddingEnd = parseInt(barStyle.paddingLeft);
		var findBarBorderStart = parseInt(barStyle.borderRightWidth);
		var findBarBorderEnd = parseInt(barStyle.borderLeftWidth);
	}
	
	var beforeStart = -CORNER_WIDTH -findBarPaddingStart -(findBarBorderStart -1);
	var afterStart = gFindBar.clientWidth -container.clientWidth +(findBarBorderEnd -1);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:before { -moz-margin-start: ' + beforeStart + 'px; }\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:after { -moz-margin-start: ' + afterStart + 'px; }\n';
	sscode += '}';
	
	Styles.load('topFindBarCorners_'+_UUID, sscode, true);
	
	forceCornerRedraw();
};

this.forceCornerRedraw = function() {
	// Bugfix (a bit ugly, I know) to force the corners to redraw on changing tabs or resizing windows
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:before, findbar[movetotop]:after { padding-bottom: 1px; }\n';
	sscode += '}';
	Styles.load('tempRedrawCorners_'+_UUID, sscode, true);
	aSync(function() {
		Styles.unload('tempRedrawCorners_'+_UUID);
	}, 10);
};

this.lwtheme = {
	bgImage: '',
	color: '',
	bgColor: ''
};

this.personaChanged = function() {
	aSync(stylePersonaFindBar);
};

this.stylePersonaFindBar = function() {
	if(!moveTopStyle) { return; }
	
	if(!trueAttribute(document.documentElement, 'lwtheme')) {
		lwtheme.bgImage = '';
		lwtheme.color = '';
		lwtheme.bgColor = '';
	}
	else {
		var windowStyle = getComputedStyle(document.documentElement);
		if(lwtheme.bgImage != windowStyle.backgroundImage && windowStyle.backgroundImage != 'none') {
			lwtheme.bgImage = windowStyle.backgroundImage;
			lwtheme.color = windowStyle.color;
			lwtheme.bgColor = windowStyle.backgroundColor;
		}
	}
	
	// Unload current stylesheet if it's been loaded
	if(!lwtheme.bgImage) {
		Styles.unload('personaFindBar_'+_UUID);
		return;
	}
	
	var windowStyle = getComputedStyle(document.documentElement);
	var barStyle = getComputedStyle(gFindBar);
	
	// Another personas in OSX tweak
	var offsetY = -moveTopStyle.top;
	
	if(barStyle.direction == 'ltr') {
		var borderStart = parseInt(barStyle.borderLeftWidth);
		var borderEnd = parseInt(barStyle.borderRightWidth);
	} else {
		var borderStart = parseInt(barStyle.borderRightWidth);
		var borderEnd = parseInt(barStyle.borderLeftWidth);
	}
	
	// I have no idea where does the -1 come from, it's not the findbars own border
	// or maybe it is, I'm using that for now.
	if(!Prefs.movetoRight) {
		var offsetXSide = 'left';
		var offsetX = -moveTopStyle.left +document.documentElement.clientWidth -borderStart;
	} else {
		var offsetXSide = 'right';
		var offsetX = -moveTopStyle.right -borderStart;
	}
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS]) {\n';
	sscode += '	  background-image: ' + lwtheme.bgImage + ';\n';
	sscode += '	  background-color: ' + lwtheme.bgColor + ';\n';
	sscode += '	  color: ' + lwtheme.color + ';\n';
	sscode += '	  background-position: '+offsetXSide+' '+offsetX+'px top '+offsetY+'px;\n';
	sscode += '	  background-repeat: repeat;\n';
	sscode += '	  background-size: auto auto;\n';
	sscode += '	}\n';
	
	// There's just no way I can have rounded corners with personas
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS]):before,\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS]):after {\n';
	sscode += '		display: none !important;\n';
	sscode += '	}\n';
	
	sscode += '}';
	
	Styles.load('personaFindBar_'+_UUID, sscode, true);
};

this.toggleNotificationState = function() {
	var inNotification =
		!viewSource
		&& gBrowser.getNotificationBox().currentNotification
		&& !gBrowser.getNotificationBox().notificationsHidden
		&& dispatch(gFindBar, { type: 'HideFindBarInNotification' }); // If something preventDefault()s this, it means the find bar can be shown
	
	toggleAttribute(gFindBar, 'inNotification', inNotification);
	
	if(!inNotification) {
		Styles.unload('inNotification_'+_UUID);
		return;
	}
	
	// I'm not using top and moveTopStyle values incremented because this comes before moveTop, and on resizing window, values wouldn't be accurate
	var notificationHeight = gBrowser.getNotificationBox().currentNotification.clientHeight + (gBrowser.getNotificationBox().currentNotification.clientTop *2) +1;
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop][inNotification] {\n';
	sscode += '		margin-top: '+notificationHeight+'px !important;\n';
	sscode += '	}\n';
	sscode += '}';
	
	Styles.load('inNotification_'+_UUID, sscode, true);
};

this.findBarMaxHeight = 0;
this.setOnTop = function(e) {
	if(!e || !e.defaultPrevented) {
		// Bugfix: in windows 8 the findbar's bottom border will jump clicking a button if we are showing the icons instead of the labels.
		// I have no idea why this happens as none of its children elements increase heights or margins.
		// But at least the findbar itself increases its height by 1px.
		// We only need to do this once, the findbar's height doesn't (or shouldn't) change
		var container = gFindBar.getElement('findbar-container');
		var height = container.clientHeight || gFindBar.clientHeight;
		
		// if !container.clientHeight means findbar is hidden, we can use bar.clientHeight because it takes the desired value in this case.
		// Sometimes, with the the bar closed, the height value is lower than it should be, so we check for that.
		if(findBarMaxHeight && findBarMaxHeight >= height) { return; }
		
		findBarMaxHeight = height;
		
		var containerStyle = getComputedStyle(container);
		var barStyle = getComputedStyle(gFindBar);
		
		height += parseInt(containerStyle.marginBottom) + parseInt(containerStyle.marginTop);
		height += parseInt(barStyle.paddingBottom) + parseInt(barStyle.paddingTop);
		height += parseInt(barStyle.borderBottomWidth) + parseInt(barStyle.borderTopWidth);
		
		initFindBar('movetotop',
			function(bar) {
				setAttribute(bar, 'movetotop', 'true');
				bar.style.maxHeight = height+'px';
			},
			function(bar) {
				if(bar._destroying) { return; }
				
				removeAttribute(bar, 'movetotop');
				bar.style.maxHeight = '';
			},
			true
		);
		
		// We also need to properly place the rounder corners, as their position can vary with themes
		var cornerMarginTop = -parseInt(barStyle.paddingTop);
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:before,\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:after {\n';
		sscode += '	  margin-top: ' + cornerMarginTop + 'px;\n';
		sscode += '	}\n';
		sscode += '}';
		
		Styles.load('placeCornersFindBar_'+_UUID, sscode, true);
	}
};

this.finderTopListener = {
	onPDFJS: function(aBrowser) {
		if(!viewSource && aBrowser != gBrowser.mCurrentBrowser) { return; }
		
		if(shouldReMoveTop()) {
			moveTop();
		}
	},
	
	onIsValid: function(aBrowser) {
		if(!viewSource && aBrowser != gBrowser.mCurrentBrowser) { return; }
		
		hideOnChrome();
	}
};

this.changeLook = function(previous) {
	var current = trueAttribute(gFindBar, 'inPDFJS');
	
	// Apply the special style for the findbar in pdf documents
	if((isPDFJS && !current)
	|| (!isPDFJS && current)
	|| (previous !== undefined && current != previous)) {
		moveTop();
	}
};

// Prevent the FindBar from being visible in chrome pages like the add-ons manager
this.hideOnChrome = function(previous) {
	// Bugfix for Tree Style Tab (and possibly others): findbar is on the background after uncollapsing
	// So we do all this stuff aSync, should allow the window to repaint
	Timers.init('hideOnChrome', function() {
		if(!gFindBarInitialized) { return; }
		
		var isValid = Finder.isValid;
		if(isValid == gFindBar.collapsed) {
			hideIt(gFindBar, isValid);
			if(isValid) {
				// Sometimes switching to the add-ons manager and then back to another tab, the find bar would be poorly positioned
				moveTop();
			}
		}
		
		changeLook(previous);
		toggleNotificationState();
	}, 0);
};

this.hideOnChromeTabSelect = function() {
	hideOnChrome(trueAttribute(currentTab._findBar, 'inPDFJS'));
};

this.hideOnChromeAttrWatcher = function(obj, prop, oldVal, newVal) {
	if(oldVal != newVal) {
		hideOnChrome();
	}
};

Modules.LOADMODULE = function() {
	Prefs.listen('movetoRight', moveTop);
	
	Listeners.add(window, 'WillOpenFindBar', setOnTop);
	Listeners.add(window, 'OpenedFindBar', moveTop);
	Listeners.add(window, "UpdatedStatusFindBar", moveTopAsNeeded);
	Listeners.add(window, 'FindBarUIChanged', moveTopAsNeeded);
	
	// Reposition the findbar when the window resizes
	Listeners.add(window, "resize", delayMoveTop);
	
	if(!viewSource) {
		initFindBar('moveToTopContent',
			function(bar) {
				Messenger.loadInBrowser(bar.browser, 'moveToTop');
				bar.browser.finder.addResultListener(finderTopListener);
			},
			function(bar) {
				if(!bar._destroying) {
					bar.browser.finder.removeResultListener(finderTopListener);
				}
				Messenger.unloadFromBrowser(bar.browser, 'moveToTop');
			}
		);
		
		Listeners.add(gBrowser.tabContainer, "TabSelectPrevious", hideOnChromeTabSelect);
		Watchers.addAttributeWatcher($('cmd_find'), 'disabled', hideOnChromeAttrWatcher);
		Observers.add(personaChanged, "lightweight-theme-styling-update");
	}
	
	// To fix the findbar's close button being outside the container of the rest of its buttons.
	// This will probably need to be changed/remove once https://bugzilla.mozilla.org/show_bug.cgi?id=939523 is addressed
	initFindBar('fixCloseButtonTop',
		function(bar) {
			bar._mainCloseButton = bar.getElement('find-closebutton');
			bar._topCloseButton = bar.getElement('findbar-container').appendChild(bar._mainCloseButton.cloneNode(true));
			setAttribute(bar._topCloseButton, 'oncommand', 'close();');
			removeAttribute(bar._mainCloseButton, 'anonid');
		},
		function(bar) {
			if(bar._destroying) { return; }
			
			bar._topCloseButton.remove();
			setAttribute(bar._mainCloseButton, 'anonid', 'find-closebutton');
			delete bar._mainCloseButton;
			delete bar._topCloseButton;
		}
	);
	
	moveTop();
	
	if(!viewSource) {
		// we just init this so we can easily remove the collapsed state and others later when disabling the module if necessary
		initFindBar('resetTopState',
			function(bar) {},
			function(bar) {
				if(bar._destroying) { return; }
				
				hideIt(bar, true);
				removeAttribute(bar, 'inPDFJS');
				removeAttribute(bar, 'inNotification');
			}
		);
		
		hideOnChrome();
	}
};

Modules.UNLOADMODULE = function() {
	if(!viewSource) {
		Observers.remove(personaChanged, "lightweight-theme-styling-update");
		Watchers.removeAttributeWatcher($('cmd_find'), 'disabled', hideOnChromeAttrWatcher);
		Listeners.remove(gBrowser.tabContainer, "TabSelectPrevious", hideOnChromeTabSelect);
		
		Styles.unload('inNotification_'+_UUID);
		
		deinitFindBar('resetTopState');
		deinitFindBar('moveToTopContent');
	}
	
	Listeners.remove(window, "resize", delayMoveTop);
	Listeners.remove(window, 'FindBarUIChanged', moveTopAsNeeded);
	Listeners.remove(window, 'WillOpenFindBar', setOnTop);
	Listeners.remove(window, 'OpenedFindBar', moveTop);
	Listeners.remove(window, "UpdatedStatusFindBar", moveTopAsNeeded);
	
	deinitFindBar('movetotop');
	deinitFindBar('fixCloseButtonTop');
	
	Prefs.unlisten('movetoRight', moveTop);
	
	Styles.unload('personaFindBar_'+_UUID);
	Styles.unload('topFindBar_'+_UUID);
	Styles.unload('topFindBarCorners_'+_UUID);
	Styles.unload('tempRedrawCorners_'+_UUID);
	Styles.unload('placeCornersFindBar_'+_UUID);
};
