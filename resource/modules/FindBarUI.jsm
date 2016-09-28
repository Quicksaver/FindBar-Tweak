/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.8.4

this.findbarUI = {
	get button() {
		let node = $('find-button');

		// If the node is in the menu-panel for instance, it won't be found on startup, until the panel is opened once so it is built
		if(!node && !viewSource && !FITFull) {
			let widget = CustomizableUI.getWidget('find-button');
			if(widget.areaType) {
				node = widget.forWindow(window).node;
			}
		}

		return node;
	},

	handleEvent: function(e) {
		switch(e.type) {
			case 'WillOpenFindBar':
				if(!gFindBar.hidden) {
					// If opening normal Find bar when quick find is already opened, make sure we trigger the change
					if(e.detail == gFindBar.FIND_NORMAL && gFindBar._findMode != gFindBar.FIND_NORMAL && Prefs.FAYTmode != 'alwaysquick') {
						e.preventDefault();
						e.stopPropagation();
						gFindBar._findMode = gFindBar.FIND_NORMAL;
						gFindBar.open(gFindBar.FIND_NORMAL);
						break;
					}

					// If typing when Find bar is already opened in normal mode, use that instead of "reopening" as quick find mode
					if(gFindBar._findMode == gFindBar.FIND_NORMAL && e.detail == gFindBar.FIND_TYPEAHEAD) {
						e.preventDefault();
						e.stopPropagation();
						break;
					}

					// If opening findbar when QuickFind bar is already opened and we're supposed to keep QuickFind, make sure we do
					if(Prefs.FAYTmode == 'alwaysquick' && (!e.detail || e.detail == gFindBar.FIND_NORMAL)) {
						e.preventDefault();
						e.stopPropagation();
						gFindBar.open(gFindBar.FIND_TYPEAHEAD);
						gFindBar._setFindCloseTimeout();
						break;
					}

					// If the FindBar is already open do nothing and keep opening,
					// this prevents the hangup when triggering the QuickFind bar when Find bar is open
					break;
				}

				// FAYT: option to force normal mode over quick find mode
				if(e.detail == gFindBar.FIND_TYPEAHEAD && Prefs.FAYTmode == 'normal') {
					e.preventDefault();
					e.stopPropagation();
					gFindBar.open(gFindBar.FIND_NORMAL);
					break;
				}

				// Option to force quick find mode over normal mode
				if((!e.detail || e.detail == gFindBar.FIND_NORMAL) && Prefs.FAYTmode == 'alwaysquick') {
					e.preventDefault();
					e.stopPropagation();
					gFindBar.open(gFindBar.FIND_TYPEAHEAD);
					gFindBar._setFindCloseTimeout();
					break;
				}

				// proceed with opening the findbar as commanded
				break;

			case 'TabSelect':
				this.hideOnChrome();
				this.stylePDFJS();
				// no break; continue to OpenedFindBar

			case 'OpenedFindBar':
			case 'ClosedFindBar':
				this.buttonState();
				break;

			case 'command':
				if(e.originalTarget && e.originalTarget.id == 'find-button' && !e.defaultPrevented) {
					e.preventDefault(); // Don't do the default command
					e.stopPropagation();
					this.toggle();
				}
				break;

			case 'beforecustomization':
				this.unsetButton();
				break;

			case 'aftercustomization':
				this.setButton();
				break;
		}
	},

	attrWatcher: function(obj, attr, oldVal, newVal) {
		if(oldVal != newVal) {
			this.hideOnChrome();
		}
	},

	onPDFJS: function(aBrowser) {
		if(aBrowser != gBrowser.mCurrentBrowser) { return; }

		this.stylePDFJS();
	},

	onIsValid: function(aBrowser) {
		if(aBrowser != gBrowser.mCurrentBrowser) { return; }

		this.hideOnChrome();
	},

	// These is in case the button is added when a toolbar is created for example
	onWidgetAdded: function(aId) {
		if(!customizing && aId == 'find-button') { this.setButton(); }
	},

	onAreaNodeRegistered: function() {
		if(!customizing) { this.setButton(); }
	},

	init: function() {
		Listeners.add(window, 'WillOpenFindBar', this, true);
		Listeners.add(window, 'OpenedFindBar', this);
		Listeners.add(window, 'ClosedFindBar', this);

		if(!viewSource) {
			Listeners.add(window, 'beforecustomization', this);
			Listeners.add(window, 'aftercustomization', this);
			Listeners.add(gBrowser.tabContainer, "TabSelect", this);
			Watchers.addAttributeWatcher($('cmd_find'), 'disabled', this);
			CustomizableUI.addListener(this);

			// we just init this so we can easily remove the collapsed state and others later when disabling the module if necessary
			findbar.init('resetTopState',
				function(bar) {},
				function(bar) {
					if(bar._destroying) { return; }
					bar.collapsed = false;
				}
			);

			if(!customizing) {
				this.setButton();

				// on first use, move the find button to the main toolbar, for users unfamiliar with the feature
				if(!Prefs.findButtonMoved) {
					Prefs.findButtonMoved = true;

					// current users updating shouldn't be affected, they know what they're doing otherwise they wouldn't have kept the add-on
					if(STARTED == ADDON_ENABLE || STARTED == ADDON_INSTALL) {
						let placement = CustomizableUI.getPlacementOfWidget('find-button');
						// default placement is in the menu panel, that's very hidden away for users unfamiliar with the find toolbar
						if(placement && placement.area == CustomizableUI.AREA_PANEL) {
							// try to reuse a previous position if the user had disabled the add-on before,
							// so the button shows up at (roughly) the same place as where it was last time
							let position;
							if(Prefs.findButtonOriginalPos != -1) {
								position = Prefs.findButtonOriginalPos;
							}
							Prefs.findButtonOriginalPos = placement.position;
							CustomizableUI.addWidgetToArea('find-button', CustomizableUI.AREA_NAVBAR, position);
						}
					}
				}
			}

			this.stylePDFJS();
			this.hideOnChrome();
		}
	},

	deinit: function() {
		Listeners.remove(window, 'WillOpenFindBar', this, true);
		Listeners.remove(window, 'OpenedFindBar', this);
		Listeners.remove(window, 'ClosedFindBar', this);

		if(!viewSource) {
			Listeners.remove(window, 'beforecustomization', this);
			Listeners.remove(window, 'aftercustomization', this);
			Listeners.remove(gBrowser.tabContainer, "TabSelect", this);
			Watchers.removeAttributeWatcher($('cmd_find'), 'disabled', this);
			CustomizableUI.removeListener(this);

			findbar.deinit('resetTopState');

			this.unsetButton();

			// the user has explicitely disabled the add-on, so move back the find button to its default place if necessary
			if(UNLOADED && (UNLOADED == ADDON_DISABLE || UNLOADED == ADDON_UNINSTALL)
			&& Prefs.findButtonMoved && Prefs.findButtonOriginalPos != -1) {
				let placement = CustomizableUI.getPlacementOfWidget('find-button');
				if(placement && placement.area == CustomizableUI.AREA_NAVBAR) {
					CustomizableUI.addWidgetToArea('find-button', CustomizableUI.AREA_PANEL, Prefs.findButtonOriginalPos);
					Prefs.findButtonOriginalPos = placement.position;
					Prefs.findButtonMoved = false;
				}
			}
		}
	},

	stylePDFJS: function() {
		if(!gFindBarInitialized) { return; }

		// style for PDF.JS
		if(isPDFJS) {
			setAttribute(gFindBar, 'inPDFJS', 'true');
			toggleAttribute(gFindBar, 'loadingBar', isPDFJS.loadingBar);
			toggleAttribute(gFindBar, 'sidebarOpen', isPDFJS.sidebarOpen);
		} else {
			removeAttribute(gFindBar, 'inPDFJS');
			removeAttribute(gFindBar, 'loadingBar');
			removeAttribute(gFindBar, 'sidebarOpen');
		}
	},

	// Handler for Ctrl+F, it closes the findbar if it is already opened
	toggle: function() {
		if(gFindBar.hidden) {
			this.open();
		} else {
			gFindBar.close();
		}
	},

	open: function() {
		let promise = gFindBar.onFindCommand();

		// when the findbar is finished opening, we need to make sure that any prefilled value is immediately searched for, and that all matches are highlighted if needed
		promise.then(function() {
			let query = findQuery;

			// nothing to do if the findbar is empty
			if(!query) { return; }

			// Finder.searchString should always reflect a valid findQuery
			if(query != Finder.searchString) {
				Finder.workAroundFind = true;
				gFindBar._find(query, true);
				Finder.workAroundFind = false;
				return;
			}

			// at this point we just want to make sure all the matches are highlighted if necessary
			if(!documentHighlighted || highlightedWord != query) {
				gFindBar._setHighlightTimeout();
			}
		});
	},

	change: function(bar) {
		// there's no need to send this for every single findbar element in the window
		Timers.init('UIChange', () => {
			dispatch(bar, { type: 'FindBarUIChanged', cancelable: false });
		}, 0);
	},

	buttonState: function() {
		toggleAttribute(this.button, 'checked', (gFindBarInitialized && !gFindBar.hidden));
	},

	setButton: function() {
		if(this.button) {
			// I really don't like setting this listener on window, but setting it on the button the event will be at phase AT_TARGET, and can't be cancelled there.
			Listeners.add(window, 'command', this, true);
			this.buttonState();
		}
	},

	unsetButton: function() {
		if(this.button) {
			Listeners.remove(window, 'command', this, true);
			removeAttribute(this.button, 'checked');
		}
	},

	// Prevent the FindBar from being visible in chrome pages like the add-ons manager
	hideOnChrome: function() {
		// Bugfix for Tree Style Tab (and possibly others): findbar is on the background after uncollapsing
		// So we do all this stuff aSync, should allow the window to repaint
		Timers.init('hideOnChrome', function() {
			if(!gFindBarInitialized) { return; }

			// in case the global findbar is being used, the findbar should always be visible, even if it can't be used
			let isValid = !!self.globalFB || Finder.isValid;
			if(isValid == gFindBar.collapsed) {
				gFindBar.collapsed = !isValid;
			}
		}, 0);
	}
};

this.buttonLabels = {
	btns: [
		'highlight',
		'find-case-sensitive',
		objName+'-find-tabs',
		objName+'-find-tabs-tabs',
		objName+'-find-tabs-goto'
	],

	observe: function(aSubject, aTopic, aData) {
		this.toggle();
	},

	toggle: function() {
		findbar.init('toggleLabels',
			(bar) => {
				toggleAttribute(bar, 'hideLabels', Prefs.hideLabels);
				this.iconsAsText(bar, Prefs.hideLabels);
				findbarUI.change(bar);
			},
			(bar) => {
				if(bar._destroying) { return; }

				this.iconsAsText(bar);
				removeAttribute(bar, 'hideLabels');
			},
			true
		);
	},

	iconsAsText: function(bar, enable) {
		// apply the australis styling to the findbar buttons' icons as well; Mac OS X doesn't need this
		if(DARWIN) { return; }

		for(let btnID of this.btns) {
			let btn = bar.getElement(btnID);
			if(btn) {
				let icon = $ª(btn, (enable) ? 'toolbarbutton-icon' : 'toolbarbutton-icon toolbarbutton-text', 'class');
				if(icon) {
					if(enable) {
						icon.classList.add('toolbarbutton-text');
					} else {
						icon.classList.remove('toolbarbutton-text');
					}
				}
			}
		}
	}
};

this.toggleClose = function() {
	findbar.init('toggleClose',
		function(bar) {
			toggleAttribute(bar, 'noClose', Prefs.hideClose);
			findbarUI.change(bar);
		},
		function(bar) {
			if(bar._destroying) { return; }

			removeAttribute(bar, 'noClose');
		},
		true
	);
};

this.toggleMoveToTop = function() {
	Modules.loadIf('moveToTop', Prefs.movetoTop);
};

this.toggleMoveToRight = function(startup) {
	findbar.init('toggleMoveToRight',
		function(bar) {
			toggleAttribute(bar, 'movetoright', Prefs.movetoRight);
		},
		function(bar) {
			if(bar._destroying) { return; }

			removeAttribute(bar, 'movetoright');
		},
		true
	);
};

this.toggleKeepButtons = function(startup) {
	findbar.init('toggleKeepButtons',
		function(bar) {
			toggleAttribute(bar, 'keepButtons', Prefs.keepButtons);
		},
		function(bar) {
			if(bar._destroying) { return; }

			removeAttribute(bar, 'keepButtons');
		},
		true
	);
};

Modules.LOADMODULE = function() {
	// For the case-sensitive button
	Prefs.setDefaults({ casesensitive: 0 }, 'typeaheadfind', 'accessibility');

	Overlays.overlayURI('chrome://browser/content/browser.xul', 'findbar');
	Overlays.overlayURI('chrome://global/content/viewSource.xul', 'findbar');
	Overlays.overlayURI('chrome://global/content/viewPartialSource.xul', 'findbar');

	Prefs.listen('hideClose', toggleClose);
	Prefs.listen('hideLabels', buttonLabels);
	Prefs.listen('movetoRight', toggleMoveToRight);

	Modules.load('resizeTextbox');

	toggleClose();
	buttonLabels.toggle();
	toggleMoveToRight();

	if(!FITFull) {
		findbarUI.init();

		findbar.init('FindBarUI',
			function(bar) {
				setAttribute(bar, 'context', objPathString+'_findbarMenu');

				if(!viewSource) {
					Messenger.loadInBrowser(bar.browser, 'FindBarUI');
					bar.browser.finder.addResultListener(findbarUI);
				}

				// Ctrl+Enter in the findField should toggle Highlight All even if it's empty
				Piggyback.add('FindBarUI', bar._findField, '_handleEnter', function(e) {
					if(this.findbar._findMode == this.findbar.FIND_NORMAL
					|| (this.findbar._findMode == this.findbar.FIND_TYPEAHEAD && Prefs.keepButtons)) {
						let metaKey = DARWIN ? e.metaKey : e.ctrlKey;
						if(metaKey) {
							// or toggle Find All if Ctrl+Shift+Enter,
							// the quick find bar should never be able to access Find All!
							if(e.shiftKey && this.findbar._findMode == this.findbar.FIND_NORMAL && self.FITMini) {
								FITMini.toggle();
								return;
							}

							this.findbar.getElement("highlight").click();
							return;
						}
					}

					if(this.findbar._findMode == this.findbar.FIND_NORMAL) {
						if(this.findbar._findField.value) {
							this.findbar.onFindAgainCommand(e.shiftKey);
						}
					} else {
						this.findbar._finishFAYT(e);
					}
				});
			},
			function(bar) {
				if(!viewSource) {
					if(!bar._destroying) {
						bar.browser.finder.removeResultListener(findbarUI);
					}
					Messenger.unloadFromBrowser(bar.browser, 'FindBarUI');
				}

				if(bar._destroying) { return; }

				Piggyback.revert('FindBarUI', bar._findField, '_handleEnter');
				removeAttribute(bar, 'context');
				removeAttribute(bar, 'inPDFJS');
				removeAttribute(bar, 'loadingBar');
				removeAttribute(bar, 'sidebarOpen');
			}
		);

		Prefs.listen('movetoTop', toggleMoveToTop);
		Prefs.listen('keepButtons', toggleKeepButtons);

		Modules.load('ctrlF');
		toggleMoveToTop();
		toggleKeepButtons();
	}
};

Modules.UNLOADMODULE = function() {
	if(!FITFull) {
		Prefs.unlisten('movetoTop', toggleMoveToTop);
		Prefs.unlisten('keepButtons', toggleKeepButtons);

		Modules.unload('moveToTop');
		Modules.unload('ctrlF');

		findbarUI.deinit();

		findbar.deinit('toggleKeepButtons');
		findbar.deinit('FindBarUI');
	}

	Prefs.unlisten('hideClose', toggleClose);
	Prefs.unlisten('hideLabels', buttonLabels);
	Prefs.unlisten('movetoRight', toggleMoveToRight);

	Modules.unload('resizeTextbox');

	findbar.deinit('toggleClose');
	findbar.deinit('toggleLabels');
	findbar.deinit('toggleMoveToRight');

	if(UNLOADED) {
		Overlays.removeOverlayURI('chrome://browser/content/browser.xul', 'findbar');
		Overlays.removeOverlayURI('chrome://global/content/viewSource.xul', 'findbar');
		Overlays.removeOverlayURI('chrome://global/content/viewPartialSource.xul', 'findbar');
	}
};
