// VERSION 3.0.2

this.__defineGetter__('DevEdition', function() { return window.DevEdition; });

this.moveToTop = {
	// these margins should reflect the values in the stylesheets!
	kMinLeft: 22,
	kMinRight: 22,
	
	maxHeight: 0,
	lwtheme: {
		bgImage: '',
		color: '',
		bgColor: ''
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'FindBarUIChanged':
			case 'OpenedFindBar':
				this.update();
				break;
			
			case 'WillOpenFindBar':
				this.apply();
				break;
			
			case 'resize':
			case 'UpdatedStatusFindBar':
			case 'TabSelect':
				this.delay();
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
	
	init: function() {
		Prefs.listen('movetoRight', this);
		
		Listeners.add(window, 'WillOpenFindBar', this);
		Listeners.add(window, 'OpenedFindBar', this);
		Listeners.add(window, "UpdatedStatusFindBar", this);
		Listeners.add(window, 'FindBarUIChanged', this);
		Listeners.add(window, 'TabSelect', this);
		
		// Reposition the persona background when the window resizes
		Listeners.add(window, "resize", this);
		
		if(!viewSource) {
			Observers.add(this, "lightweight-theme-styling-update");
		}
		
		// apply basic persona background if one exists
		this.stylePersona();
		
		// Doing it aSync prevents the window elements from jumping at startup (stylesheet not loaded yet)
		aSync(() => {
			this.update();
		});
	},
	
	deinit: function() {
		if(!viewSource) {
			Observers.remove(this, "lightweight-theme-styling-update");
			
			findbar.deinit('DevEdition');
		}
		
		Listeners.remove(window, 'WillOpenFindBar', this);
		Listeners.remove(window, "resize", this);
		Listeners.remove(window, 'FindBarUIChanged', this);
		Listeners.remove(window, 'OpenedFindBar', this);
		Listeners.remove(window, "UpdatedStatusFindBar", this);
		Listeners.remove(window, 'TabSelect', this);
		
		Prefs.unlisten('movetoRight', this);
		
		Timers.cancel('personaChanged');
		Styles.unload('stylePersona_'+_UUID);
		Styles.unload('placePersona_'+_UUID);
		
		findbar.deinit('movetotop');
	},
	
	delay: function() {
		Timers.init('delayApply', () => {
			this.update();
		}, 0);
	},
	
	update: function() {
		if(!viewSource) {
			this.placePersona();
		}
		
		this.apply();
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
	
	apply: function(e) {
		if(e && e.defaultPrevented) { return; }
		
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
				setAttribute(bar.parentNode, 'findbarontop', 'true');
				setAttribute(bar, 'movetotop', 'true');
				bar.style.maxHeight = height+'px';
			},
			function(bar) {
				if(bar._destroying) { return; }
				
				removeAttribute(bar, 'movetotop');
				removeAttribute(bar.parentNode, 'findbarontop');
				bar.style.maxHeight = '';
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
