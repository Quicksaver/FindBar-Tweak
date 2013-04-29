moduleAid.VERSION = '1.3.7';

this.__defineGetter__('mainWindow', function() { return $('main-window'); });
this.__defineGetter__('gBrowser', function() { return window.gBrowser; });
this.__defineGetter__('browser', function() { return $('browser'); });
this.__defineGetter__('appcontent', function() { return $('appcontent'); });
this.__defineGetter__('squareLookSpacer', function() { return $(objName+'-squareLook_spacer'); });
this.getComputedStyle = function(el) { return window.getComputedStyle(el); };

this.moveTopStyle = {};
this.lwthemeImage = null;

this._scrollBarWidth = null;
this.__defineGetter__('scrollBarWidth', function() {
	if(_scrollBarWidth === null) {
		var scrollDiv = document.createElement("div");
		scrollDiv.setAttribute('style', 'width: 100px; height: 100px; overflow: scroll; position: fixed; top: -9999px;');
		scrollDiv = browserPanel.appendChild(scrollDiv);
		
		_scrollBarWidth = 100 -scrollDiv.clientWidth;
		
		browserPanel.removeChild(scrollDiv);
	}
	
	return _scrollBarWidth;
});
this.__defineGetter__('MIN_LEFT', function() { return (!prefAid.squareLook) ? 20 : 0; });
this.__defineGetter__('MIN_RIGHT', function() { return (!prefAid.squareLook) ? 30 : (!prefAid.placeAbove) ? scrollBarWidth : 0; });
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
		|| newStyle.movetoRight != lastTopStyle.moveToRight
		|| (prefAid.squareLook && prefAid.placeAbove && newStyle.marginTop != lastTopStyle.marginTop)
		|| newStyle.squareLook != lastTopStyle.squareLook
		|| newStyle.placeAbove != lastTopStyle.placeAbove) {
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

// Handles the position of the findbar
this.moveTop = function() {
	// Bugfix: ensure these declarations only take effect when the stylesheet is loaded (from the overlay) as well.
	// Otherwise, at startup, the browser would jump for half a second with empty space on the right.
	if(!squareLookSpacer || gFindBar.getAttribute('context') != objPathString+'_findbarMenu') { return; }
	
	if(gFindBar.hidden) {
		if(prefAid.placeAbove) { squareLookSpacer.hidden = true; }
		return;
	}
	
	moveTopStyle = {
		marginTop: null,
		movetoRight: prefAid.movetoRight,
		squareLook: prefAid.squareLook,
		placeAbove: prefAid.placeAbove,
		maxWidth: -MIN_RIGHT -MIN_LEFT,
		left: MIN_LEFT,
		right: MIN_RIGHT,
		top: (!prefAid.squareLook || prefAid.placeAbove) ? -1 : 0 // Move the find bar one pixel up so it covers the toolbox borders, giving it a more seamless look
	};
	
	if(prefAid.squareLook && prefAid.placeAbove) {
		moveTopStyle.top -= gFindBar.clientHeight;
	}
	
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
	
	moveTopStyle.clientWidth = gFindBar.clientWidth;
	if(prefAid.squareLook && prefAid.placeAbove && !gFindBar.collapsed) {
		moveTopStyle.marginTop = gFindBar.clientHeight +1;
		squareLookSpacer.style.height = moveTopStyle.marginTop +'px';
		squareLookSpacer.hidden = false;
	} else {
		squareLookSpacer.hidden = true;
	}
	if(!shouldReMoveTop(moveTopStyle)) { return; }
	lastTopStyle = moveTopStyle;
	
	// Unload current stylesheet if it's been loaded
	styleAid.unload('topFindBar_'+_UUID);
	styleAid.unload('topFindBarCorners_'+_UUID);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] #FindToolbar[movetotop] {\n';
	sscode += '		max-width: ' + Math.max(moveTopStyle.maxWidth, 5) + 'px;\n';
	sscode += (prefAid.squareLook && prefAid.placeAbove || !prefAid.movetoRight) ? '		left: ' + moveTopStyle.left + 'px;\n' : '		right: ' + moveTopStyle.right + 'px;\n';
	sscode += '		top: ' + moveTopStyle.top + 'px;\n';
	if(prefAid.squareLook && prefAid.placeAbove) {
		sscode += '		width: '+ Math.max(moveTopStyle.maxWidth, 5) + 'px;\n';
	}
	sscode += '	}';
	sscode += '}';
	
	styleAid.load('topFindBar_'+_UUID, sscode, true);
	
	if(gFindBar.scrollLeftMax > 0) {
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		// !important tag necessary for OSX, CSS stylesheet sets this one
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] #FindToolbar[movetotop]:after { margin-left: -' + gFindBar.scrollLeftMax + 'px !important; }\n';
		if(prefAid.movetoRight && prefAid.squareLook) {
			sscode += '	#FindToolbar[movetotop][movetoright][squareLook] { border-left: none !important; }\n'
		}
		sscode += '}';
		styleAid.load('topFindBarCorners_'+_UUID, sscode, true);
	}
	
	forceCornerRedraw();
	if(!viewSource) { findPersonaPosition(); }
};

this.forceCornerRedraw = function() {
	// Bugfix (a bit ugly, I know) to force the corners to redraw on changing tabs or resizing windows
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] #FindToolbar[movetotop]:before, #FindToolbar[movetotop]:after { padding-bottom: 1px !important; }\n';
	sscode += '}';
	styleAid.load('tempRedrawCorners_'+_UUID, sscode, true);
	aSync(function() {
		styleAid.unload('tempRedrawCorners_'+_UUID);
	}, 10);
};

this.findPersonaPosition = function() {
	if(mainWindow.getAttribute('lwtheme') != 'true') {
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
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] #FindToolbar[movetotop]  {\n';
		sscode += '	  background-image: ' + prefAid.lwthemebgImage + ' !important;\n';
		sscode += '	  background-color: ' + prefAid.lwthemecolor + ' !important;\n';
		sscode += '	  color: ' + prefAid.lwthemecolor + ' !important;\n';
		// I have no idea where does the -1 come from, it's not the findbars own border
		sscode += '	  background-position: ' + (-moveTopStyle.left - (prefAid.lwthemebgWidth - mainWindow.clientWidth) -1) + 'px ' +offsetPersonaY+ 'px !important;\n';
		sscode += '	  background-repeat: repeat !important;\n';
		sscode += '	  background-size: auto auto !important;\n';
		sscode += '	}\n';
		
		// There's just no way I can have rounded corners with personas
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] #FindToolbar[movetotop]:before, #FindToolbar[movetotop]:after { display: none !important; }\n';
		
		sscode += '}';
		
		styleAid.load('personaFindBar_'+_UUID, sscode, true);
	}
};

// Prevent the FindBar from being visible in chrome pages like the add-ons manager
this.hideOnChrome = function() {
	// Bugfix for Tree Style Tab (and possibly others): findbar is on the background after uncollapsing
	// So we do all this stuff aSync, should allow the window to repaint
	timerAid.init('hideOnChrome', function() {
		var beforeState = gFindBar.collapsed;
		hideIt(gFindBar, 
			$('cmd_find').getAttribute('disabled') != 'true'
			// Need to set this separately apparently, the find bar would only hide when switching to this tab after having been loaded, not upon loading the tab
			&& gBrowser.mCurrentBrowser.currentURI.spec != 'about:config'
			// No need to show the findbar in Speed Dial's window, it already had a display bug at startup which I already fixed, I'm preventing more bugs this way
			&& gBrowser.mCurrentBrowser.currentURI.spec != 'chrome://speeddial/content/speeddial.xul'
		);
		
		// Sometimes switching to the add-ons manager and then back to another tab, the find bar would be poorly positioned
		if(gFindBar.collapsed != beforeState) {
			moveTop();
		}
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

this.toggleMoveToRight = function(startup) {
	toggleAttribute(gFindBar, 'movetoright', prefAid.movetoRight);
	if(!startup) {
		moveTop();
	}
};

this.toggleSquareLook = function() {
	toggleAttribute(gFindBar, 'squareLook', prefAid.squareLook);
	toggleAttribute(gFindBar, 'placeAbove', prefAid.squareLook && prefAid.placeAbove);
	
	if(prefAid.squareLook && prefAid.placeAbove) {
		listenerAid.add(gFindBar, 'ClosedFindBar', moveTop);
	} else {
		listenerAid.remove(gFindBar, 'ClosedFindBar', moveTop);
	}
};

moduleAid.LOADMODULE = function() {
	prefAid.listen('movetoRight', toggleMoveToRight);
	prefAid.listen('squareLook', toggleSquareLook);
	prefAid.listen('placeAbove', toggleSquareLook);
	prefAid.listen('squareLook', moveTop);
	prefAid.listen('placeAbove', moveTop);
	
	toggleMoveToRight(true);
	toggleSquareLook();
	
	listenerAid.add(browserPanel, 'resize', browserPanelResized);
	listenerAid.add(gFindBar, 'OpenedFindBar', moveTop);
	listenerAid.add(gFindBar, "UpdatedStatusFindBar", moveTopAsNeeded);
	listenerAid.add(gFindBar, "HighlightCounterUpdated", moveTopAsNeeded);
	listenerAid.add(gFindBar, 'FindBarUIChanged', moveTopAsNeeded);
	
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
	
	// We need this to be first to "remove" the findbar from the bottombox so we can use correct values below
	// Not true anymore, but now it's irrelevant, so I'm leaving it this way in case I need it again.
	gFindBar.setAttribute('movetotop', 'true');
	
	moveTop();
	
	if(!viewSource) {
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
	}
	
	listenerAid.remove(browserPanel, "browserPanelResized", delayMoveTop, false);
	
	listenerAid.remove(gFindBar, 'FindBarUIChanged', moveTopAsNeeded);
	listenerAid.remove(gFindBar, 'OpenedFindBar', moveTop);
	listenerAid.remove(gFindBar, "UpdatedStatusFindBar", moveTopAsNeeded);
	listenerAid.remove(gFindBar, "HighlightCounterUpdated", moveTopAsNeeded);
	listenerAid.remove(browserPanel, 'resize', browserPanelResized);
	
	gFindBar.removeAttribute('movetotop');
	hideIt(gFindBar, true);
	
	removeAttribute(gFindBar, 'movetoright');
	removeAttribute(gFindBar, 'squareLook');
	removeAttribute(gFindBar, 'placeAbove');
	listenerAid.remove(gFindBar, 'ClosedFindBar', moveTop);
	
	prefAid.unlisten('movetoRight', toggleMoveToRight);
	prefAid.unlisten('squareLook', toggleSquareLook);
	prefAid.unlisten('placeAbove', toggleSquareLook);
	prefAid.unlisten('squareLook', moveTop);
	prefAid.unlisten('placeAbove', moveTop);
	
	styleAid.unload('personaFindBar_'+_UUID);
	styleAid.unload('topFindBar_'+_UUID);
	styleAid.unload('topFindBarCorners_'+_UUID);
	styleAid.unload('tempRedrawCorners_'+_UUID);
};
