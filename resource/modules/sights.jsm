Modules.VERSION = '2.2.4';

this.SIGHTS_SIZE_FOCUS = 400;
this.SIGHTS_SIZE_CIRCLE = 100;

this.__defineGetter__('preferencesDialog', function() { return self.inPreferences; });

this.sights = {
	handleEvent: function(e) {
		switch(e.type) {
			case 'resize':
				Timers.init('resizeViewSource', () => { this.resizeViewSource(); }, 0);
				break;
		}
	},
	
	observe: function(aSubject, aTopic, aData) {
		switch(aSubject) {
			case 'selectColor':
			case 'highlightColor':
			case 'sightsColor':
			case 'sightsSameColor':
			case 'sightsSameColorAll':
			case 'sightsAllColor':
			case 'sightsAllSameColor':
				this.color();
				break;
			
			case 'sightsCurrent':
			case 'sightsHighlights':
				Observers.notify('ReHighlightAll');
				break;
		}
	},
	
	get: function(bar, toRemove) {
		if(preferencesDialog) {
			return $$('[anonid="findSights"]')[0];
		}
		
		for(let child of bar.browser.parentNode.childNodes) {
			if(child.getAttribute('anonid') == 'findSights') { return child; }
		}
		
		if(toRemove) { return; }
		
		// First the grid itself
		var boxNode = document.createElement('hbox');
		boxNode.setAttribute('anonid', 'findSights');
		boxNode.groups = new Map();
		
		// It shouldn't depend on the stylesheet being loaded, it could error and the browser would be unusable
		boxNode.style.pointerEvents = 'none';
		
		// Insert the box into the tab
		bar.browser.parentNode.appendChild(boxNode);
		
		// We need to make sure the box is resized to the proper window size
		
		this.resizeViewSource();
		
		return boxNode;
	},
	
	build: function(bar, data) {
		var bSights = bar.sights;
		var style = data.style || Prefs.sightsStyle;
		
		var group = bSights.groups.get(data.group);
		if(!group) {
			group = {
				i: data.group,
				allSights: new Set(),
				timer: null,
				style: style,
				size: (style == 'focus') ? SIGHTS_SIZE_FOCUS : (style == 'circle') ? SIGHTS_SIZE_CIRCLE : 0,
				current: data.current || false,
				fullCycles: 0,
				phase: 0,
				maxRepeat: Prefs.sightsRepeat,
				hold: 0,
				scrollTop: data.scrollTop || 0,
				scrollLeft: data.scrollLeft || 0,
				
				selfRemove: function() {
					if(!bSights || !this.timer) { return; } // Fail-safe for when closing the window while sights are being placed
					
					this.timer.cancel();
					this.removeSights();
					bSights.groups.delete(this.i);
					
					if(!preferencesDialog) {
						Messenger.messageBrowser(bar.browser, 'Sights:Remove', data.group);
					}
				},
				
				removeSights: function() {
					for(let sight of this.allSights) {
						sight.remove();
						this.allSights.delete(sight);
					}
				},
				
				// Method for the sight to auto-update themselves
				updateSights: function() {
					// A few failsafes
					if(!bSights || typeof(Timers) == 'undefined' || UNLOADED) {
						this.selfRemove();
						return;
					}
					
					// We update all sights in the group at the same time, they are all equal (they were created at the same time) so we can use the same values
					if(this.style == 'focus') {
						this.size /= 1.225;
						
						// Remove the sight when it gets too small
						if(this.size < 40) {
							this.fullCycles++;
							if(this.fullCycles >= this.maxRepeat) {
								this.selfRemove();
								return;
							}
							else {
								this.size = SIGHTS_SIZE_FOCUS /1.125;
							}
						}
					}
					else if(this.style == 'circle') {
						// Let's hold for a bit
						if(this.phase == 360) {
							if(!this.hold) { this.hold = 5; }
							this.hold--;
						}
						
						if(!this.hold) {
							this.phase += 45;
							
							// Remove when we finish animating
							if(this.phase > 720) {
								this.fullCycles++;
								if(this.fullCycles >= this.maxRepeat) {
									this.selfRemove();
									return;
								}
								else {
									this.phase = 45;
								}
							}
							
							for(let sight of this.allSights) {
								toggleAttribute(sight, 'gt0', (this.phase <= 180));
								toggleAttribute(sight, 'gt180', (this.phase > 180 && this.phase <= 360));
								toggleAttribute(sight, 'gt360', (this.phase > 360 && this.phase <= 540));
								toggleAttribute(sight, 'gt540', (this.phase > 540));
								sight.childNodes[0].childNodes[0].setAttribute('style', '-moz-transform: rotate('+this.phase+'deg); transform: rotate('+this.phase+'deg);');
							}
						}
					}
					
					var yDelta = 0;
					var xDelta = 0;
					if(this.newScrollTop !== undefined) {
						yDelta = this.newScrollTop -this.scrollTop;
						this.scrollTop = this.newScrollTop;
						delete this.newScrollTop;
					}
					if(this.newScrollLeft !== undefined) {
						xDelta = this.newScrollLeft -this.scrollLeft;
						this.scrollLeft = this.newScrollLeft;
						delete this.newScrollLeft;
					}
					
					for(let sight of this.allSights) {
						var newTop = (sight.centerY -(this.size /2));
						var newLeft = (sight.centerX -(this.size /2));
						
						newTop -= yDelta;
						newLeft -= xDelta;
						sight.centerY -= yDelta;
						sight.centerX -= xDelta;
						
						sight.style.top = newTop+'px';
						sight.style.left = newLeft+'px';
						sight.style.height = this.size+'px';
						sight.style.width = this.size+'px';
					}
				}
			};
			
			bSights.groups.set(data.group, group);
			group.timer = Timers.create(() => { group.updateSights(); }, (style == 'focus') ? 25 : 20, 'slack');
		}
			
		var box = document.createElement('box');
		box.setAttribute('anonid', 'highlightSights');
		box.setAttribute('sightsStyle', style);
		
		// x and y are the center of the box
		box.style.height = group.size+'px';
		box.style.width = group.size+'px';
		box.style.top = data.centerY -(group.size /2)+'px';
		box.style.left = data.centerX -(group.size /2)+'px';
		
		box.centerY = data.centerY;
		box.centerX = data.centerX;
		toggleAttribute(box, 'current', group.current);
		
		if(style == 'circle') {
			var innerContainer = document.createElement('box');
			var otherInnerContainer = innerContainer.cloneNode();
			var innerBox = innerContainer.cloneNode();
			var otherInnerBox = innerContainer.cloneNode();
			innerContainer.setAttribute('innerContainer', 'true');
			otherInnerContainer.setAttribute('innerContainer', 'true');
			otherInnerContainer.setAttribute('class', 'otherHalf');
			innerContainer.appendChild(innerBox);
			otherInnerContainer.appendChild(otherInnerBox);
			box.appendChild(innerContainer);
			box.appendChild(otherInnerContainer);
			
			setAttribute(box, 'gt0', 'true');
		}
		
		bSights.appendChild(box);
		group.allSights.add(box);
	},
	
	scroll: function(bSights, data) {
		var group = bSights.groups.get(data.group);
		if(group) {
			group.newScrollTop = data.scrollTop;
			group.newScrollLeft = data.scrollLeft;
		}
	},
	
	remove: function(bSights, data) {
		var group = bSights.groups.get(data);
		if(group) {
			group.selfRemove();
		}
	},
	
	resizeViewSource: function() {
		var contentPos = gFindBar.browser.getBoundingClientRect();
		gFindBar.sights.style.top = contentPos.top+'px';
		gFindBar.sights.style.height = contentPos.height+'px';
	},
	
	color: function() {
		if(!preferencesDialog && !Prefs.sightsCurrent && !Prefs.sightsHighlights) { return; }
		
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document\n\
				url("chrome://browser/content/browser.xul"),\n\
				url("chrome://global/content/viewSource.xul"),\n\
				url("chrome://global/content/viewPartialSource.xul"),\n\
				url-prefix("chrome://'+objPathString+'/content/utils/preferences.xul"),\n\
				url-prefix("about:'+objPathString+'") {\n';
		
		var color = Prefs.sightsSameColor ? Prefs.selectColor : Prefs.sightsSameColorAll ? Prefs.highlightColor : Prefs.sightsColor;
		var m = color.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
		if(!m) { return; }
		var rgb = getRGBfromString(m);
		
		var c = rgb.r+','+rgb.g+','+rgb.b;
		var o = (darkBackgroundRGB(rgb)) ? '255,255,255' : '0,0,0';
		var p = 'rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+',0.85) rgba('+o+',0.5) rgba('+c+',0.4) rgba('+c+',0.15)';
		
		sscode += '\
				:root['+objName+'_UUID="'+_UUID+'"] box[anonid="highlightSights"][sightsStyle="focus"][current],\n\
				:root['+objName+'_UUID="'+_UUID+'"] box[anonid="highlightSights"][sightsStyle="circle"][current] box[innerContainer] box {\n\
					-moz-border-top-colors: '+p+' !important;\n\
					-moz-border-bottom-colors: '+p+' !important;\n\
					-moz-border-left-colors: '+p+' !important;\n\
					-moz-border-right-colors: '+p+' !important;\n\
				}\n';
		
		var color = Prefs.sightsAllSameColor ? Prefs.highlightColor : Prefs.sightsAllColor;
		var m = color.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
		if(!m) { return; }
		var rgb = getRGBfromString(m);
		
		var c = rgb.r+','+rgb.g+','+rgb.b;
		var o = (darkBackgroundRGB(rgb)) ? '255,255,255' : '0,0,0';
		var p = 'rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+',0.85) rgba('+o+',0.5) rgba('+c+',0.4) rgba('+c+',0.15)';
		
		sscode += '\
				window['+objName+'_UUID="'+_UUID+'"] box[anonid="highlightSights"][sightsStyle="focus"]:not([current]),\n\
				window['+objName+'_UUID="'+_UUID+'"] box[anonid="highlightSights"][sightsStyle="circle"]:not([current]) box[innerContainer] box {\n\
					-moz-border-top-colors: '+p+' !important;\n\
					-moz-border-bottom-colors: '+p+' !important;\n\
					-moz-border-left-colors: '+p+' !important;\n\
					-moz-border-right-colors: '+p+' !important;\n\
				}\n\
			}';
		
		Styles.load('sightsColor_'+_UUID, sscode, true);
	}
};

Modules.LOADMODULE = function() {
	Styles.load('sights', 'sights');
	
	Prefs.listen('selectColor', sights);
	Prefs.listen('highlightColor', sights);
	Prefs.listen('sightsColor', sights);
	Prefs.listen('sightsSameColor', sights);
	Prefs.listen('sightsSameColorAll', sights);
	Prefs.listen('sightsAllColor', sights);
	Prefs.listen('sightsAllSameColor', sights);
	
	sights.color();
	
	if(preferencesDialog) { return; }
	
	if(viewSource) {
		Listeners.add(viewSource, 'resize', sights);
	}
	
	findbar.init('sights',
		function(bar) {
			bar.__defineGetter__('sights', function() { return sights.get(bar); });
			
			bar.browser.finder.addMessage('Sights:Add', data => {
				sights.build(bar, data);
			});
			
			bar.browser.finder.addMessage('Sights:Scroll', data => {
				sights.scroll(bar.sights, data);
			});
			
			bar.browser.finder.addMessage('Sights:Remove', data => {
				sights.remove(bar.sights, data);
			});
			
			Messenger.loadInBrowser(bar.browser, 'sights');
			
			if(viewSource) {
				sights.resizeViewSource();
			}
		},
		function(bar) {
			if(!bar._destroying) {
				bar.browser.finder.removeMessage('Sights:Add');
				bar.browser.finder.removeMessage('Sights:Scroll');
				bar.browser.finder.removeMessage('Sights:Remove');
			}
			
			Messenger.unloadFromBrowser(bar.browser, 'sights');
			
			var bSights = sights.get(bar, true);
			if(bSights) {
				bSights.remove();
			}
			
			delete bar.sights;
		}
	);
	
	Prefs.listen('sightsCurrent', sights);
	Prefs.listen('sightsHighlights', sights);
	
	Observers.notify('ReHighlightAll');
}

Modules.UNLOADMODULE = function() {
	Prefs.unlisten('selectColor', sights);
	Prefs.unlisten('highlightColor', sights);
	Prefs.unlisten('sightsColor', sights);
	Prefs.unlisten('sightsSameColor', sights);
	Prefs.unlisten('sightsSameColorAll', sights);
	Prefs.unlisten('sightsAllColor', sights);
	Prefs.unlisten('sightsAllSameColor', sights);
	
	Styles.unload('sightsColor_'+_UUID);
	
	if(preferencesDialog) { return; }
	
	if(viewSource) {
		Listeners.remove(viewSource, 'resize', sights);
	}
	Prefs.unlisten('sightsCurrent', sights);
	Prefs.unlisten('sightsHighlights', sights);
	
	findbar.deinit('sights');
	
	if(UNLOADED || (!Prefs.sightsCurrent && !Prefs.sightsHighlights)) {
		Styles.unload('sights', 'sights');
	}
	
	if(!UNLOADED && !window.closed && !window.willClose) {
		Observers.notify('ReHighlightAll');
	}
};
