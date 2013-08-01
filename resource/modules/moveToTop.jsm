moduleAid.VERSION = '1.5.5';

this.__defineGetter__('mainWindow', function() { return $('main-window'); });
this.__defineGetter__('gBrowser', function() { return window.gBrowser; });
this.__defineGetter__('browser', function() { return $('browser'); });
this.__defineGetter__('appcontent', function() { return $('appcontent'); });

this.moveTopStyle = {};
this.lwthemeImage = null;

this.__defineGetter__('MIN_LEFT', function() { return 20; });
this.__defineGetter__('MIN_RIGHT', function() { return 30; });
this.lastTopStyle = null;

this.shouldReMoveTop = function(newStyle) {
	if(!lastTopStyle) { return true; }
	
	if(!newStyle) {
		return (gFindBar.clientWidth != lastTopStyle.clientWidth);
	}
	else if(newStyle.top != lastTopStyle.top
		|| newStyle.right != lastTopStyle.right
		|| newStyle.left != lastTopStyle.left
		|| newStyle.maxWidth != lastTopStyle.maxWidth
		|| newStyle.clientWidth != lastTopStyle.clientWidth
		|| newStyle.movetoRight != lastTopStyle.movetoRight) {
			return true;
	}
	
	return false;
};

this.browserPanelResized = function() {
	timerAid.init('browserPanelResized', function() {
		dispatch(browserPanel, { type: 'browserPanelResized', cancelable: false });
	}, 0);
};

this.delayMoveTop = function() {
	timerAid.init('delayMoveTop', moveTop, 0);
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

this.containerPDFResize = function(e) {
	if(!inPDFJS(e.target.document)) { return; }
	delayMoveTop();
};

// Handles the position of the findbar
this.moveTop = function() {
	// always move it at least once to prevent the initial hangup
	if(lastTopStyle) {
		if((!viewSource && perTabFB && !gFindBarInitialized) || gFindBar.hidden) { return; } // no need to move it again if it's hidden, the stylesheet should remain valid
	} else if(!viewSource && perTabFB) {
		gFindBar; // make sure the find bar is initialized past this point
	}
	
	// Bugfix: ensure these declarations only take effect when the stylesheet is loaded (from the overlay) as well.
	// Otherwise, at startup, the browser would jump for half a second with empty space on the right.
	if((!viewSource && perTabFB && !gFindBarInitialized) || gFindBar.getAttribute('context') != objPathString+'_findbarMenu') { return; }
	
	moveTopStyle = {
		marginTop: null,
		movetoRight: prefAid.movetoRight,
		maxWidth: -MIN_RIGHT -MIN_LEFT,
		clientWidth: gFindBar.clientWidth,
		left: MIN_LEFT,
		right: MIN_RIGHT,
		top: -1 // Move the find bar one pixel up so it covers the toolbox borders, giving it a more seamless look
	};
	
	var appContentPos = $('content').getBoundingClientRect();
	moveTopStyle.maxWidth += appContentPos.width;
	moveTopStyle.top += appContentPos.top;
	moveTopStyle.left += appContentPos.left;
	moveTopStyle.right += document.documentElement.clientWidth -appContentPos.right;
	
	// Compatibility with TreeStyleTab
	if($('TabsToolbar') && !$('TabsToolbar').collapsed) {
		// This is also needed when the tabs are on the left, the width of the findbar doesn't follow with the rest of the window for some reason
		if($('TabsToolbar').getAttribute('treestyletab-tabbar-position') == 'left' || $('TabsToolbar').getAttribute('treestyletab-tabbar-position') == 'right') {
			var TabsToolbar = $('TabsToolbar');
			var TabsSplitter = document.getAnonymousElementByAttribute($('content'), 'class', 'treestyletab-splitter');
			moveTopStyle.maxWidth -= TabsToolbar.clientWidth;
			moveTopStyle.maxWidth -= TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			if(!prefAid.movetoRight && TabsToolbar.getAttribute('treestyletab-tabbar-position') == 'left') {
				moveTopStyle.left += TabsToolbar.clientWidth;
				moveTopStyle.left += TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			}
			if(prefAid.movetoRight && TabsToolbar.getAttribute('treestyletab-tabbar-position') == 'right') {
				moveTopStyle.right += TabsToolbar.clientWidth;
				moveTopStyle.right += TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			}
		}
	}
	
	// Compatibility with PDF.JS
	if(isPDFJS) {
		var toolbar = contentDocument.getElementById('toolbarViewer');
		if(toolbar) {
			moveTopStyle.top += toolbar.clientHeight;
			var outerContainer = contentDocument.getElementById('outerContainer');
			var sidebarContainer = contentDocument.getElementById('sidebarContainer');
			if(outerContainer.classList.contains('sidebarOpen')) {
				moveTopStyle.left += sidebarContainer.clientWidth;
			}
			listenerAid.add(contentDocument.defaultView, 'resize', containerPDFResize, true);
		}
	}
	
	toggleAttribute(gFindBar, 'inPDFJS', (isPDFJS && toolbar));
	toggleNotificationState();
	
	if(!shouldReMoveTop(moveTopStyle)) { return; }
	lastTopStyle = moveTopStyle;
	
	// Unload current stylesheet if it's been loaded
	styleAid.unload('topFindBar_'+_UUID);
	styleAid.unload('topFindBarCorners_'+_UUID);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop] {\n';
	sscode += '		max-width: ' + Math.max(moveTopStyle.maxWidth, 5) + 'px;\n';
	sscode += (!prefAid.movetoRight) ? '		left: ' + moveTopStyle.left + 'px;\n' : '		right: ' + moveTopStyle.right + 'px;\n';
	sscode += '		top: ' + moveTopStyle.top + 'px;\n';
	sscode += '	}';
	sscode += '}';
	
	styleAid.load('topFindBar_'+_UUID, sscode, true);
	
	if(gFindBar.scrollLeftMax > 0) {
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		// !important tag necessary for OSX, CSS stylesheet sets this one
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:after { margin-left: -' + gFindBar.scrollLeftMax + 'px !important; }\n';
		sscode += '}';
		styleAid.load('topFindBarCorners_'+_UUID, sscode, true);
	}
	
	forceCornerRedraw();
	if(!viewSource) { findPersonaPosition(); }
	
	// Doing it aSync prevents the window elements from jumping at startup (stylesheet not loaded yet)
	aSync(function() { setOnTop(); });
};

this.forceCornerRedraw = function() {
	// Bugfix (a bit ugly, I know) to force the corners to redraw on changing tabs or resizing windows
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:before, findbar[movetotop]:after { padding-bottom: 1px !important; }\n';
	sscode += '}';
	styleAid.load('tempRedrawCorners_'+_UUID, sscode, true);
	aSync(function() {
		styleAid.unload('tempRedrawCorners_'+_UUID);
	}, 10);
};

this.findPersonaPosition = function() {
	if(!trueAttribute(mainWindow, 'lwtheme')) {
		prefAid.lwthemebgImage = '';
		prefAid.lwthemebgWidth = 0;
		prefAid.lwthemecolor = '';
		prefAid.lwthemebgColor = '';
		stylePersonaFindBar();
		return;
	}
	
	var windowStyle = getComputedStyle(mainWindow);
	if(prefAid.lwthemebgImage != windowStyle.getPropertyValue('background-image') && windowStyle.getPropertyValue('background-image') != 'none') {
		prefAid.lwthemebgImage = windowStyle.getPropertyValue('background-image');
		prefAid.lwthemecolor = windowStyle.getPropertyValue('color');
		prefAid.lwthemebgColor = windowStyle.getPropertyValue('background-color');
		prefAid.lwthemebgWidth = 0;
		
		lwthemeImage = new window.Image();
		lwthemeImage.onload = function() { findPersonaWidth(); };
		lwthemeImage.src = prefAid.lwthemebgImage.substr(5, prefAid.lwthemebgImage.length - 8);
		return;
	}
	
	stylePersonaFindBar();
};

this.findPersonaWidth = function() {
	if(prefAid.lwthemebgWidth == 0 && lwthemeImage.naturalWidth != 0) {
		prefAid.lwthemebgWidth = lwthemeImage.naturalWidth;
	}
	
	if(prefAid.lwthemebgWidth != 0) {
		stylePersonaFindBar();
	}
};

this.stylePersonaFindBar = function() {
	// Unload current stylesheet if it's been loaded
	styleAid.unload('personaFindBar_'+_UUID);
	
	if(prefAid.lwthemebgImage != '') {
		var computedStyle = {
			window: getComputedStyle(mainWindow)
		};
		
		// Another personas in OSX tweak
		var offsetPersonaY = -moveTopStyle.top;
		var offsetWindowPadding = computedStyle.window.getPropertyValue('background-position');
		if(offsetWindowPadding.indexOf(' ') > -1 && offsetWindowPadding.indexOf('px', offsetWindowPadding.indexOf(' ') +1) > -1) {
			offsetPersonaY += parseInt(offsetWindowPadding.substr(offsetWindowPadding.indexOf(' ') +1, offsetWindowPadding.indexOf('px', offsetWindowPadding.indexOf(' ') +1)));
		}
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS])  {\n';
		sscode += '	  background-image: ' + prefAid.lwthemebgImage + ' !important;\n';
		sscode += '	  background-color: ' + prefAid.lwthemecolor + ' !important;\n';
		sscode += '	  color: ' + prefAid.lwthemecolor + ' !important;\n';
		// I have no idea where does the -1 come from, it's not the findbars own border
		sscode += '	  background-position: ' + (-moveTopStyle.left - (prefAid.lwthemebgWidth - mainWindow.clientWidth) -1) + 'px ' +offsetPersonaY+ 'px !important;\n';
		sscode += '	  background-repeat: repeat !important;\n';
		sscode += '	  background-size: auto auto !important;\n';
		sscode += '	}\n';
		
		// There's just no way I can have rounded corners with personas
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS]):before, findbar[movetotop]:not([inPDFJS]):after { display: none !important; }\n';
		
		sscode += '}';
		
		styleAid.load('personaFindBar_'+_UUID, sscode, true);
	}
};

this.toggleNotificationState = function() {
	toggleAttribute(gFindBar, 'inNotification', !viewSource && gBrowser.getNotificationBox().currentNotification && !gBrowser.getNotificationBox().notificationsHidden);
};

this.changeLook = function() {
	// Apply the special style for the findbar in pdf documents
	if((isPDFJS && !trueAttribute(gFindBar, 'inPDFJS'))
	|| (!isPDFJS && trueAttribute(gFindBar, 'inPDFJS'))) {
		delayMoveTop();
	}
};

// Prevent the FindBar from being visible in chrome pages like the add-ons manager
this.hideOnChrome = function() {
	// Bugfix for Tree Style Tab (and possibly others): findbar is on the background after uncollapsing
	// So we do all this stuff aSync, should allow the window to repaint
	timerAid.init('hideOnChrome', function() {
		if(perTabFB && !gFindBarInitialized) { return; }
		
		var beforeState = gFindBar.collapsed;
		hideIt(gFindBar, 
			!trueAttribute($('cmd_find'), 'disabled')
			// Need to set this separately apparently, the find bar would only hide when switching to this tab after having been loaded, not upon loading the tab
			&& gBrowser.mCurrentBrowser.currentURI.spec != 'about:config'
			// No need to show the findbar in Speed Dial's window, it already had a display bug at startup which I already fixed, I'm preventing more bugs this way
			&& gBrowser.mCurrentBrowser.currentURI.spec != 'chrome://speeddial/content/speeddial.xul'
		);
		
		// Sometimes switching to the add-ons manager and then back to another tab, the find bar would be poorly positioned
		if(gFindBar.collapsed != beforeState) {
			moveTop();
		}
		
		changeLook();
		toggleNotificationState();
	}, 0);
};

this.hideOnChromeContentLoaded = function(e) {
	// this is the content document of the loaded page.
	var doc = e.originalTarget;
	if(doc instanceof window.HTMLDocument) {
		// is this an inner frame?
		// Find the root document:
		while(doc.defaultView.frameElement) {
			doc = doc.defaultView.frameElement.ownerDocument;
		}
		
		if(doc == contentDocument) {
			hideOnChrome();
		}
	}
};

// Tab progress listeners, handles opening and closing of pages and location changes
this.hideOnChromeProgressListener = {
	onLocationChange: function(aBrowser, webProgress, request, location) {
		// Frames don't need to trigger this
		if(webProgress.DOMWindow == aBrowser.contentWindow) {
			hideOnChromeHandleBrowser(aBrowser, 100);
		}
	},
	
	// Mostly handles some necessary browser tags
	onProgressChange: function(aBrowser, webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {
		hideOnChromeHandleBrowser(aBrowser, curTotalProgress);
	}
};

this.hideOnChromeHandleBrowser = function(aBrowser, curTotalProgress) {
	// I found the > 3 to be the best value for comparison ( coming from onProgressChange() for aboutBlankCollapse() ), from a lot of trial and errors tests
	if(aBrowser == gBrowser.mCurrentBrowser && curTotalProgress > 3) {
		hideOnChrome();
	}
};

this.hideOnChromeAttrWatcher = function(obj, prop, oldVal, newVal) {
	if(oldVal != newVal) {
		hideOnChrome();
	}
};

this.setOnTop = function(e) {
	if(!e || !e.defaultPrevented) {
		initFindBar('movetotop',
			function(bar) { setAttribute(bar, 'movetotop', 'true'); },
			function(bar) { removeAttribute(bar, 'movetotop'); },
			true
		);
	}
};

moduleAid.LOADMODULE = function() {
	prefAid.listen('movetoRight', moveTop);
	
	listenerAid.add(browserPanel, 'resize', browserPanelResized);
	listenerAid.add(window, 'WillOpenFindBar', setOnTop);
	listenerAid.add(window, 'OpenedFindBar', moveTop);
	listenerAid.add(window, "UpdatedStatusFindBar", moveTopAsNeeded);
	listenerAid.add(window, "HighlightCounterUpdated", moveTopAsNeeded);
	listenerAid.add(window, 'FindBarUIChanged', moveTopAsNeeded);
	
	if(!viewSource) {
		// Register all opened tabs with a listener
		gBrowser.addTabsProgressListener(hideOnChromeProgressListener);
		listenerAid.add(gBrowser.tabContainer, "TabSelect", hideOnChrome, false);
		listenerAid.add(gBrowser, "DOMContentLoaded", hideOnChromeContentLoaded, false);
		objectWatcher.addAttributeWatcher($('cmd_find'), 'disabled', hideOnChromeAttrWatcher);
		
		// Compatibility with LessChrome HD
		listenerAid.add(window, "LessChromeShown", moveTop, false);
		listenerAid.add(window, "LessChromeHidden", moveTop, false);
		
		observerAid.add(findPersonaPosition, "lightweight-theme-changed");
	}
	
	// Reposition the findbar when the window resizes
	listenerAid.add(browserPanel, "browserPanelResized", delayMoveTop, false);
	
	moveTop();
	
	if(!viewSource) {
		// we just init this so we can easily remove the collapsed state and others later when disabling the module if necessary
		initFindBar('resetTopState',
			function(bar) { return; },
			function(bar) {
				hideIt(bar, true);
				removeAttribute(bar, 'inPDFJS');
				removeAttribute(bar, 'inNotification');
			}
		);
		
		hideOnChrome();
	}
};

moduleAid.UNLOADMODULE = function() {
	if(!viewSource) {
		observerAid.remove(findPersonaPosition, "lightweight-theme-changed");
		
		// Compatibility with LessChrome HD
		listenerAid.remove(window, "LessChromeShown", moveTop, false);
		listenerAid.remove(window, "LessChromeHidden", moveTop, false);
		
		objectWatcher.removeAttributeWatcher($('cmd_find'), 'disabled', hideOnChromeAttrWatcher);
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", hideOnChrome, false);
		listenerAid.remove(gBrowser, "DOMContentLoaded", hideOnChromeContentLoaded, false);
		gBrowser.removeTabsProgressListener(hideOnChromeProgressListener);
		
		for(var b=0; b<gBrowser.browsers.length; b++) {
			var inDoc = gBrowser.browsers[b].contentDocument;
			if(inPDFJS(inDoc)) {
				listenerAid.remove(contentDocument.defaultView, 'resize', containerPDFResize, true);
			}
		}
		
		deinitFindBar('resetTopState');
	}
	
	listenerAid.remove(browserPanel, "browserPanelResized", delayMoveTop, false);
	
	listenerAid.remove(window, 'FindBarUIChanged', moveTopAsNeeded);
	listenerAid.remove(window, 'WillOpenFindBar', setOnTop);
	listenerAid.remove(window, 'OpenedFindBar', moveTop);
	listenerAid.remove(window, "UpdatedStatusFindBar", moveTopAsNeeded);
	listenerAid.remove(window, "HighlightCounterUpdated", moveTopAsNeeded);
	listenerAid.remove(browserPanel, 'resize', browserPanelResized);
	
	deinitFindBar('movetotop');
	
	prefAid.unlisten('movetoRight', moveTop);
	
	styleAid.unload('personaFindBar_'+_UUID);
	styleAid.unload('topFindBar_'+_UUID);
	styleAid.unload('topFindBarCorners_'+_UUID);
	styleAid.unload('tempRedrawCorners_'+_UUID);
};
