// VERSION 3.1.3

this.__defineGetter__('DevEdition', function() { return window.DevEdition; });
this.__defineGetter__('SidebarUI', function() { return window.SidebarUI; });

this.moveToTop = {
	kSheetId: 'onTop_'+this._UUID,
	
	// these margins should reflect the values in the stylesheets!
	kMinLeft: 22,
	kMinRight: 22,
	kPDFJSSidebarWidth: 200,
	
	onTopSheets: new Set(),
	maxHeight: 0,
	lwtheme: {
		bgImage: '',
		color: '',
		bgColor: ''
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'OpenedFindBar':
			case 'endToggleSidebar':
				this.update();
				break;
			
			case 'WillOpenFindBar':
				this.apply(e);
				break;
			
			case 'resize':
			case 'TabSelect':
				this.delay();
				break;
			
			case 'TabClose':
				if(gBrowser.isFindBarInitialized(e.target)) {
					let sheetId = this.kSheetId+'-'+gBrowser.getFindBar(e.target).id;
					if(this.onTopSheets.has(sheetId)) {
						Styles.unload(sheetId);
						this.onTopSheets.delete(sheetId);
					}
				}
				break;
		}
	},
	
	observe: function(aSubject, aTopic, aData) {
		switch(aTopic) {
			case 'nsPref:changed':
				this.update();
				break;
			
			case 'lightweight-theme-styling-update':
				Timers.init('personaChanged', () => {
					this.stylePersona();
					this.placePersona();
				}, 0);
				break;
		}
	},
	
	onOSBToggled: function() {
		if(osb.enabled) {
			Watchers.removeAttributeWatcher(SidebarUI._box, 'hidden', this);
			Listeners.add(window, 'endToggleSidebar', this);
		} else {
			Watchers.addAttributeWatcher(SidebarUI._box, 'hidden', this);
			Listeners.remove(window, 'endToggleSidebar', this);
		}
	},
	
	attrWatcher: function(obj, attr, oldVal, newVal) {
		this.delay();
	},
	
	init: function() {
		Prefs.listen('movetoRight', this);
		
		Listeners.add(window, 'WillOpenFindBar', this);
		Listeners.add(window, 'OpenedFindBar', this);
		
		// Reposition the persona background and recalc maxWidths when the window resizes
		Listeners.add(window, "resize", this);
		
		if(!viewSource) {
			Listeners.add(gBrowser.tabContainer, 'TabSelect', this);
			
			// with Tile Tabs enabled, we won't want to keep onTop sheets loaded for tabs that don't exist anymore
			if(window.tileTabs) {
				Listeners.add(gBrowser.tabContainer, 'TabClose', this);
			}
			
			Observers.add(this, "lightweight-theme-styling-update");
			
			osb.add(this);
			this.onOSBToggled();
		}
		
		// apply basic persona background if one exists
		this.stylePersona();
		
		// Doing it aSync prevents the window elements from jumping at startup (stylesheet not loaded yet)
		aSync(() => {
			if(!this.update()) {
				this.apply();
			}
		});
	},
	
	deinit: function() {
		if(!viewSource) {
			osb.remove(this);
			Listeners.remove(window, 'endToggleSidebar', this);
			Watchers.removeAttributeWatcher(SidebarUI._box, 'hidden', this);
			
			Listeners.remove(gBrowser.tabContainer, 'TabSelect', this);
			Listeners.remove(gBrowser.tabContainer, 'TabClose', this);
			Observers.remove(this, "lightweight-theme-styling-update");
			
			findbar.deinit('DevEdition');
		}
		
		Listeners.remove(window, 'WillOpenFindBar', this);
		Listeners.remove(window, 'OpenedFindBar', this);
		Listeners.remove(window, "resize", this);
		
		Prefs.unlisten('movetoRight', this);
		
		Timers.cancel('personaChanged');
		Styles.unload('stylePersona_'+_UUID);
		Styles.unload('placePersona_'+_UUID);
		for(let sheetId of this.onTopSheets) {
			Styles.unload(sheetId);
		}
		this.onTopSheets.clear();
		
		findbar.deinit('movetotop');
	},
	
	delay: function() {
		Timers.init('delayApply', () => {
			this.update();
		}, 0);
	},
	
	update: function() {
		Timers.cancel('delayApply');
		
		if(!gFindBarInitialized || gFindBar.hidden) { return false; }
		
		if(!viewSource) {
			this.placePersona();
		}
		this.calc();
		this.apply();
		
		return true;
	},
	
	stylePersona: function() {
		// although technically it is a lightweight theme like the others, none of this process is necessary for the DevEdition theme
		if(DevEdition && DevEdition.isThemeCurrentlyApplied) {
			findbar.init('DevEdition',
				function(bar) {
					setAttribute(bar, 'DevEdition', 'true');
				},
				function(bar) {
					removeAttribute(bar, 'DevEdition');
				}
			);
			Styles.unload('stylePersona_'+_UUID);
			Styles.unload('placePersona_'+_UUID);
			return;
		}
		findbar.deinit('DevEdition');
		
		if(!trueAttribute(document.documentElement, 'lwtheme')) {
			this.lwtheme.bgImage = '';
			this.lwtheme.color = '';
			this.lwtheme.bgColor = '';
		}
		else {
			let windowStyle = getComputedStyle(document.documentElement);
			if(this.lwtheme.bgImage != windowStyle.backgroundImage && windowStyle.backgroundImage != 'none') {
				this.lwtheme.bgImage = windowStyle.backgroundImage;
				this.lwtheme.color = windowStyle.color;
				this.lwtheme.bgColor = windowStyle.backgroundColor;
			}
		}
		
		// Unload current stylesheet if it's been loaded
		if(!this.lwtheme.bgImage) {
			Styles.unload('stylePersona_'+_UUID);
			Styles.unload('placePersona_'+_UUID);
			return;
		}
		
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document url("'+document.baseURI+'") {\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS]):-moz-lwtheme {\n\
					background-image: ' + this.lwtheme.bgImage + ';\n\
					background-color: ' + this.lwtheme.bgColor + ';\n\
					color: ' + this.lwtheme.color + ';\n\
				}\n\
			}';
		
		Styles.load('stylePersona_'+_UUID, sscode, true);
	},
	
	placePersona: function() {
		if(!this.lwtheme.bgImage) { return; }
		
		let barStyle = getComputedStyle(gFindBar);
		let boxObject = gBrowser.getNotificationBox(gFindBar.browser).boxObject;
		
		let fullWidth = browserPanel.clientWidth;
		let borderStart = (barStyle.direction == 'ltr') ? parseInt(barStyle.borderLeftWidth) : parseInt(barStyle.borderRightWidth);
		
		let offsetY = -boxObject.y +1;
		// don't overlap if Tile Tabs is enabled, we can't show the findbar above the navigator toolbox anyway
		if(!window.tileTabs) {
			offsetY += 1;
		}
		
		let offsetX;
		let offsetSide;
		if(!Prefs.movetoRight) {
			offsetSide = 'left';
			offsetX = -this.kMinLeft +fullWidth -boxObject.x -borderStart;
		} else {
			offsetSide = 'right';
			offsetX = -this.kMinRight -fullWidth +boxObject.x +boxObject.width -borderStart;
		}
		
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document url("'+document.baseURI+'") {\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS]):-moz-lwtheme {\n\
					background-position: '+offsetSide+' '+offsetX+'px top '+offsetY+'px;\n\
				}\n\
			}';
		
		Styles.load('placePersona_'+_UUID, sscode, true);
	},
	
	// The stylesheet(s) won't be re-applied if the contents are the same (if the widths haven't changed), so no need to check for that here.
	// We can't use positions relative/absolute to move to the right, it would cause the tabbrowser to be shown above other position:fixed nodes
	// (udocked sidebar from OmniSidebar, corner puzzle bar from Puzzle Bars, etc),
	// the only way around that would be a complete set of "layer" attributes all around, but they can be very unpredictable, so I find it best to avoid them.
	// It's also better not to use the direction property on the findbar's parent node, as it will cause its siblings to move as well (issue #229).
	calc: function() {
		let maxWidth = gFindBar.parentNode.clientWidth -this.kMinLeft -this.kMinRight;
		let pdfMaxWidth = maxWidth -this.kPDFJSSidebarWidth;
		
		let sheetId = this.kSheetId;
		let selector = '';
		
		// Tile Tabs requires maxWidths for individual findbars, as not all tabs will have the same width
		if(window.tileTabs) {
			selector += "#"+gFindBar.id;
			sheetId += '-'+gFindBar.id;
		}
		
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document url("'+document.baseURI+'") {\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar'+selector+'[movetotop] {\n\
					max-width: '+maxWidth+'px;\n\
				}\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar'+selector+'[movetotop][extend] {\n\
					min-width: '+maxWidth+'px;\n\
				}\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar'+selector+'[movetotop][inPDFJS][sidebarOpen] {\n\
					max-width: '+pdfMaxWidth+'px;\n\
				}\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar'+selector+'[movetotop][inPDFJS][sidebarOpen][extend] {\n\
					min-width: '+pdfMaxWidth+'px;\n\
				}\n\
				\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar'+selector+'[movetotop][movetoright]:-moz-locale-dir(ltr) {\n\
					transform: translateX(calc('+maxWidth+'px - 100%));\n\
				}\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar'+selector+'[movetotop]:not([movetoright]):-moz-locale-dir(rtl) {\n\
					transform: translateX(calc(100% - '+maxWidth+'px));\n\
				}\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar'+selector+'[movetotop][movetoright][inPDFJS][sidebarOpen]:-moz-locale-dir(ltr) {\n\
					transform: translateX(calc('+pdfMaxWidth+'px - 100%));\n\
				}\n\
				window['+objName+'_UUID="'+_UUID+'"] findbar'+selector+'[movetotop]:not([movetoright])[inPDFJS][sidebarOpen]:-moz-locale-dir(rtl) {\n\
					transform: translateX(calc(100% - '+pdfMaxWidth+'px));\n\
				}\n\
			}';
		
		Styles.load(sheetId, sscode, true);
		this.onTopSheets.add(sheetId);
	},
	
	apply: function(e) { 
		if(e && e.defaultPrevented) { return; }
		
		// if the findbar isn't visible, there's no point in doing any of this, as we wouldn't have its real dimensions anyway
		if(!gFindBarInitialized || gFindBar.hidden) { return; }
		
		// Bugfix: in windows 8 the findbar's bottom border will jump clicking a button if we are showing the icons instead of the labels.
		// I have no idea why this happens as none of its children elements increase heights or margins.
		// But at least the findbar itself increases its height by 1px.
		// We only need to do this once, the findbar's height doesn't (or shouldn't) change
		let container = gFindBar.getElement('findbar-container');
		let height = container.clientHeight || gFindBar.clientHeight;
		
		// if !container.clientHeight means findbar is hidden, we can use bar.clientHeight because it takes the desired value in this case.
		// Sometimes, with the the bar closed, the height value is lower than it should be, so we check for that.
		if(this.maxHeight >= height) { return; }
		this.maxHeight = height;
		
		let containerStyle = getComputedStyle(container);
		let barStyle = getComputedStyle(gFindBar);
		
		height += parseInt(containerStyle.marginBottom) + parseInt(containerStyle.marginTop);
		height += parseInt(barStyle.paddingBottom) + parseInt(barStyle.paddingTop);
		height += parseInt(barStyle.borderBottomWidth) + parseInt(barStyle.borderTopWidth);
		
		findbar.init('movetotop',
			function(bar) {
				// necessary for the Tile Tabs compatibility fix in .calc() above
				if(window.tileTabs) {
					bar.id = 'FindToolbar-'+gBrowser.getNotificationBox(bar.browser).id;
				}
				setAttribute(bar, 'movetotop', 'true');
				bar.style.maxHeight = height+'px';
			},
			function(bar) {
				if(bar._destroying) { return; }
				
				removeAttribute(bar, 'movetotop');
				bar.style.maxHeight = '';
				
				if(window.tileTabs) {
					bar.id = '';
				}
			},
			true
		);
	}
};

Modules.LOADMODULE = function() {
	// To fix the findbar's close button being outside the container of the rest of its buttons.
	// This will probably need to be changed/remove once https://bugzilla.mozilla.org/show_bug.cgi?id=939523 is addressed
	findbar.init('fixCloseButtonTop',
		function(bar) {
			bar._mainCloseButton = bar.getElement('find-closebutton');
			bar._topCloseButton = bar._mainCloseButton.cloneNode(true);
			bar.getElement('findbar-container').appendChild(bar._topCloseButton);
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
	
	moveToTop.init();
};

Modules.UNLOADMODULE = function() {
	moveToTop.deinit();
	
	findbar.deinit('fixCloseButtonTop');
};
