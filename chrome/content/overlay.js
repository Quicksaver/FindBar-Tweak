var findbartweak = {
	preinit: function() {
		findbartweak.initialized = false;
		findbartweak.timerAid.init('init', findbartweak.init, 500);
		findbartweak.listenerAid.remove(window, "load", findbartweak.preinit, false);
		
		// This needs to be in preinit() because otherwise if the browser loads too fast it would load the first tab before the listener is implemented,
		// as such not rendering the window with the Horient attribute (grid screwing up layout)
		findbartweak.listenerAid.add(gBrowser, "DOMContentLoaded", findbartweak.contentLoaded, false);
	},
	
	deinit: function() {
		findbartweak.listenerAid.clean();
		
		// unregister all listeners
		gBrowser.removeTabsProgressListener(findbartweak.progressListener);
		
		if(findbartweak.OBSERVINGPERSONAS) {
			var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
			observerService.removeObserver(findbartweak.findPersonaPosition, "lightweight-theme-changed");
		}
		
		if(findbartweak.uiBackup.textHighlightBackground) {
			findbartweak.textHighlightBackground.value = findbartweak.uiBackup.textHighlightBackground;
		} else {
			findbartweak.textHighlightBackground.reset();
		}
		if(findbartweak.uiBackup.textHighlightForeground) {
			findbartweak.textHighlightForeground.value = findbartweak.uiBackup.textHighlightForeground;
		} else {
			findbartweak.textHighlightForeground.reset();
		}
	},
	
	init: function() {
		findbartweak.OBSERVINGPERSONAS = false;
		findbartweak.REDOINGHIGHLIGHTS = false;
		findbartweak.FILLGRID = false;
		findbartweak._currentPanel = null;
		
		findbartweak.ROWS_MINIMUM = 150; // number of rows in the highlight grid - kind of the "highlight granularity"
		findbartweak.ROWS_MULTIPLIER = 2; // Add extra rows if their height exceeds this value
		findbartweak.HIGHLIGHT_DELAY = 1500; // the delay before doing the highlights when find field isn't long enough yet
		
		// This will contain the tabs progress listeners, we need one for each otherwise it wouldn't keep correct references to them (var tempListener doesn't seem to work)
		findbartweak.listeners = [];
		
		// Get preferences
		findbartweak.highlightByDefault = Application.prefs.get('extensions.findbartweak.highlightByDefault');
		findbartweak.hideWhenFinderHidden = Application.prefs.get('extensions.findbartweak.hideWhenFinderHidden');
		findbartweak.useGrid = Application.prefs.get('extensions.findbartweak.useGrid');
		findbartweak.gridInScrollbar = Application.prefs.get('extensions.findbartweak.gridInScrollbar');
		findbartweak.useCounter = Application.prefs.get('extensions.findbartweak.useCounter');
		findbartweak.hideClose = Application.prefs.get('extensions.findbartweak.hideClose');
		findbartweak.movetoTop = Application.prefs.get('extensions.findbartweak.movetoTop');
		findbartweak.keepButtons = Application.prefs.get('extensions.findbartweak.keepButtons');
		findbartweak.hideLabels = Application.prefs.get('extensions.findbartweak.hideLabels');
		findbartweak.highlightColor = Application.prefs.get('extensions.findbartweak.highlightColor');
		findbartweak.gridWidth = Application.prefs.get('extensions.findbartweak.gridWidth');
		findbartweak.onStartup = Application.prefs.get('extensions.findbartweak.onStartup');
		findbartweak.findbarHidden = Application.prefs.get('extensions.findbartweak.findbarHidden');
		findbartweak.ctrlFCloses = Application.prefs.get('extensions.findbartweak.ctrlFCloses');
		findbartweak.FAYTmode = Application.prefs.get('extensions.findbartweak.FAYTmode');
		
		findbartweak.gridLimit = Application.prefs.get('extensions.findbartweak.gridLimit');
		findbartweak.minNoDelay = Application.prefs.get('extensions.findbartweak.minNoDelay');
		
		findbartweak.lwtheme = {
			bgImage: Application.prefs.get('extensions.findbartweak.lwtheme.bgImage'),
			bgWidth: Application.prefs.get('extensions.findbartweak.lwtheme.bgWidth'),
			color: Application.prefs.get('extensions.findbartweak.lwtheme.color'),
			bgColor: Application.prefs.get('extensions.findbartweak.lwtheme.bgColor')
		};
		
		// Do UI preferences
		findbartweak.uiBackup = {};
		findbartweak.handleUIBackground();
		findbartweak.handleUIForeground();
		
		// A few references
		findbartweak.findbar = gFindBar.getElement('findbar-container');
		findbartweak.mainWindow = document.getElementById('main-window');
		findbartweak.bottombox = document.getElementById('browser-bottombox');
		findbartweak.addonbar = document.getElementById('addon-bar');
		findbartweak.browser = document.getElementById('browser');
		findbartweak.strings = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://findbartweak/locale/overlay.properties");
		
		// We put this here so we only have to do it once
		findbartweak.OS = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULRuntime).OS;
		
		findbartweak.SPACER_HEIGHT = 20;
		if(findbartweak.OS == 'WINNT') {
			findbartweak.SCROLLBAR_WIDTH = 17;
			if(findbartweak.mainWindow.getAttribute('theme') == 'nasanightlaunch') {
				findbartweak.SCROLLBAR_WIDTH -= 1;
			}	
		} else {
			findbartweak.SCROLLBAR_WIDTH = 15;
			if(findbartweak.mainWindow.getAttribute('theme') == 'nasanightlaunch') {
				findbartweak.SCROLLBAR_WIDTH += 1;
			}
		}
		
		// Makes the html (tab) scrollbar semi-transparent so we can see the highlights through it
		// We always load the htmlGrid sheet, so it eliminates the need for a reload when toggling
		findbartweak.sss = Components.classes["@mozilla.org/content/style-sheet-service;1"].getService(Components.interfaces.nsIStyleSheetService);
		findbartweak.ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		findbartweak.ssuri = findbartweak.ios.newURI("chrome://findbartweak-os/skin/htmlGrid.css", null, null);
		findbartweak.sss.loadAndRegisterSheet(findbartweak.ssuri, findbartweak.sss.AGENT_SHEET);
		
		// Set up find bar accessory methods and properties
		findbartweak.initFindBar();
		
		// The counter needs to be toggled at least once before prepare
		findbartweak.toggleCounter();
		findbartweak.prepare(false);
		
		// Other tasks to do at startup
		findbartweak.toggleClose();
		findbartweak.toggleTop();
		findbartweak.toggleLabels();
		if(findbartweak.onStartup.value && !findbartweak.findbarHidden.value) {
			gFindBar.open();
		}
		
		// We need to observe these for changes
		findbartweak.listenerAid.add(findbartweak.useGrid, "change", function() {
			findbartweak.reHighlightAll();
			findbartweak.prepare(true);
		});
		findbartweak.listenerAid.add(findbartweak.gridInScrollbar, "change", function() {
			findbartweak.reHighlightAll();
			findbartweak.prepare(true);
		});
		findbartweak.listenerAid.add(findbartweak.useCounter, "change", function() {
			findbartweak.toggleCounter();
			findbartweak.reHighlightAll();
			findbartweak.prepare(true);
		});
		findbartweak.listenerAid.add(findbartweak.highlightColor, "change", function() {
			findbartweak.changeHighlightColor();
			findbartweak.reHighlightAll();
			if(findbartweak.documentHighlighted && findbartweak.useGrid.value) {
				findbartweak.prepare(true);
			}
		});
		findbartweak.listenerAid.add(findbartweak.hideClose, "change", findbartweak.toggleClose);
		findbartweak.listenerAid.add(findbartweak.movetoTop, "change", findbartweak.toggleTop);
		findbartweak.listenerAid.add(findbartweak.hideLabels, "change", findbartweak.toggleLabels);
		
		// We register for tab switches because the "Highlight all" button is unclicked on those,
		// and we have a bunch of stuff to do when that happens
		findbartweak.listenerAid.add(gBrowser.tabContainer, "TabSelect", findbartweak.tabSelected, false);
		
		// Register all opened tabs with a listener
		gBrowser.addTabsProgressListener(findbartweak.progressListener);
		
		// Autopager add-on compatibility: redo the highlights when new content is inserted in the page
		findbartweak.listenerAid.add(window, "AutoPagerAfterInsert", findbartweak.autoPagerInserted, false);
		
		// Reposition the grid when it's being shown in the scrollbar itself
		findbartweak.listenerAid.add(window, "resize", findbartweak.windowResize, false);
			
		// Right-clicking the findbar doesn't trigger LessChrome
		findbartweak.listenerAid.add(window, "LessChromeShowing", function(e) { if(e.target.id == 'findbarMenu' || e.target.id == 'FindToolbar') { e.preventDefault(); } }, false);
		
		findbartweak.listenerAid.add(window, "unload", findbartweak.deinit, false);
		findbartweak.initialized = true;
		
		// Bugfix for compatibility with the Speed Dial add-on: starting up with the Speed Dial page opened wouldn't trigger any 
		// of the other functions (contentLoaded(), progressListener.*() ) to correctly configure and display the grid
		if(gBrowser.mCurrentBrowser.currentURI.spec == 'chrome://speeddial/content/speeddial.xul') {
			findbartweak.hideOnChrome();
			gFindBar.toggleHighlight(findbartweak.documentHighlighted && (!gFindBar.hidden || !findbartweak.hideWhenFinderHidden.value) );
		}
	},
	
	initFindBar: function() {
		// Set context menu
		gFindBar.setAttribute('context', 'findbarMenu');
		
		gFindBar._onFindAgainCommand = gFindBar.onFindAgainCommand;
		gFindBar._fbtBackups = {
			_updateFindUI: gFindBar._updateFindUI,
			toggleHighlight: gFindBar.toggleHighlight,
			_highlightDoc: gFindBar._highlightDoc,
			DidInsertText: gFindBar.DidInsertText,
			WillDeleteSelection: gFindBar.WillDeleteSelection,
			WillDeleteText: gFindBar.WillDeleteText,
			_find: gFindBar._find,
			_setHighlightTimeout: gFindBar._setHighlightTimeout
		};
		
		// These are used for the remember state preference
		gFindBar._open = gFindBar.open;
		gFindBar._close = gFindBar.close;
		gFindBar.open = function(aMode) {
			// If the FindBar is already open do nothing, this prevents the hangup when triggering the QuickFind bar when Find bar is open
			if(!gFindBar.hidden) { return; }
			
			// FAYT: option to force normal mode over quick find mode
			if(aMode == 1 && findbartweak.FAYTmode.value != 'quick') {
				aMode = 0;
			}
			
			var ret = gFindBar._open(aMode);
			if(aMode != undefined && aMode != 1) { findbartweak.findbarHidden.value = gFindBar.hidden; }
			
			findbartweak.moveTop();
			
			// Compatibility fix for Clear Fields add-on
			// This is put here because the clear field button isn't added at startup
			if(document.getElementById('ClearFields-in-find')) {
				// We don't want it to keep pilling event calls
				if(!document.getElementById('ClearFields-in-find').hasAttribute('findbartweakEd')) {
					// ClearFields doesn't distinguish types of clicks (left, middle, right) so I can't either
					findbartweak.listenerAid.add(document.getElementById('ClearFields-in-find'), 'click', function() { gFindBar._find(); }, false);
				}
				document.getElementById('ClearFields-in-find').setAttribute('findbartweakEd', 'true');
			}
			
			findbartweak.barlesqueFix();
			
			return ret;
		};
		gFindBar.close = function() {
			gFindBar._close();
			findbartweak.findbarHidden.value = gFindBar.hidden;
			
			// Cancel a delayed highlight when closing the find bar
			if(findbartweak.panel._delayHighlight) {
				findbartweak.panel._delayHighlight.cancel();
			}
			
			// To remove the grid and the esc key listener if there are no highlights or when commanded by the hideWhenFinderHidden preference
			if(findbartweak.documentHighlighted
			&& (findbartweak.hideWhenFinderHidden.value || !gFindBar._findField.value || findbartweak.panel._notFoundHighlights) ) {
				gFindBar.toggleHighlight(false);
			}
			
			findbartweak.barlesqueFix();
		};
		
		gFindBar._updateFindUI = function _updateFindUI() {
			var showMinimalUI = this._findMode != this.FIND_NORMAL && !findbartweak.keepButtons.value;
			var nodes = this.getElement("findbar-container").childNodes;
			for (var i = 0; i < nodes.length; i++) {
				if (nodes[i].className.indexOf("findbar-find-fast") != -1) {
					continue;
				}
				nodes[i].hidden = showMinimalUI;
			}
			this._updateCaseSensitivity();
			// Instead of replacing another whole function just for this detail, I'm removing the hidden state of the CS button here
			this.getElement("find-case-sensitive").hidden = showMinimalUI || (this._typeAheadCaseSensitive != 0 && this._typeAheadCaseSensitive != 1);
			if (this._findMode == this.FIND_TYPEAHEAD) {
				this.getElement("find-label").value = this._fastFindStr;
			} else if (this._findMode == this.FIND_LINKS) {
				this.getElement("find-label").value = this._fastFindLinksStr;
			} else {
				this.getElement("find-label").value = this._normalFindStr;
			}
		};
		
		// The next ones are used for pretty much everything related with highlights
		// We need to call toggleHighlight() with the correct arguments at the right time
		gFindBar._find = function _find(aValue) {
			var val = aValue || this._findField.value;
			var res = this.nsITypeAheadFind.FIND_NOTFOUND;
			if (this._findFailedString == null ||
			val.indexOf(this._findFailedString) != 0) {
				this._enableFindButtons(val);
				this._updateCaseSensitivity(val);
				// Instead of replacing another whole function just for this detail, I'm removing the hidden state of the CS button here
				this.getElement("find-case-sensitive").hidden = (this._findMode != this.FIND_NORMAL && !findbartweak.keepButtons.value) || (this._typeAheadCaseSensitive != 0 && this._typeAheadCaseSensitive != 1);
				var fastFind = this.browser.fastFind;
				res = fastFind.find(val, this._findMode == this.FIND_LINKS);
				this._updateFoundLink(res);
				this._updateStatusUI(res, false);
				if (res == this.nsITypeAheadFind.FIND_NOTFOUND) {
					this._findFailedString = val;
				} else {
					this._findFailedString = null;
				}
			}
			this._setHighlightTimeout();
			if (this._findMode != this.FIND_NORMAL) {
				this._setFindCloseTimeout();
			}
			if (this._findResetTimeout != -1) {
				clearTimeout(this._findResetTimeout);
			}
			this._findResetTimeout = setTimeout(function (self) {self._findFailedString = null;self._findResetTimeout = -1;}, 1000, this);
			return res;
		};
		
		gFindBar._setHighlightTimeout = function _setHighlightTimeout() {
			// Check the highlight button accordingly if highlightByDefault is true
			if(findbartweak.highlightByDefault.value) {
				gFindBar.getElement("highlight").checked = true;
			}
			
			// Just reset any highlights and the counter if it's not supposed to highlight
			if(!this.getElement("highlight").checked) {
				gFindBar.toggleHighlight(false);
				return;
			}
			
			var delay = 25;
			
			// Delay highlights if search term is too short
			if(findbartweak.minNoDelay.value > 0
			&& this._findField.value.length > 0
			&& this._findField.value.length < findbartweak.minNoDelay.value) {
				delay = findbartweak.HIGHLIGHT_DELAY;
				
				// Remove highlights when hitting Esc
				// Needs to be both in here and in toggleHighlight() because the delay would prevent it from being set
				if(!findbartweak.documentHighlighted) {
					findbartweak.listenerAid.add(findbartweak.contentDocument, 'keyup', findbartweak.hitEsc, false);
				}
				
				// Make sure it triggers the highlight if we switch tabs meanwhile
				findbartweak.documentHighlighted = true;
				findbartweak.documentReHighlight = true;
			}
			
			findbartweak.panel._delayHighlight = findbartweak.timerAid.newTimer();
			findbartweak.panel._delayHighlight.init(function(timer) {
				// We don't want to highlight pages that aren't supposed to be highlighted (happens when switching tabs when delaying highlights)
				if(findbartweak.panel._delayHighlight.timer == timer) {
					gFindBar.toggleHighlight(false);
					gFindBar.toggleHighlight(true);
				}
			}, delay);
		};
		
		// Handle the whole highlighting and counter process,
		// Even if highlights aren't on it still needs to be triggered
		gFindBar.toggleHighlight = function(aHighlight) {
			// Remove highlights when hitting Esc
			if(aHighlight) {
				if(!findbartweak.documentHighlighted) {
					findbartweak.listenerAid.add(findbartweak.contentDocument, 'keyup', findbartweak.hitEsc, false);
				}
			} else {
				findbartweak.listenerAid.remove(findbartweak.contentDocument, 'keyup', findbartweak.hitEsc, false);
			}
			
			findbartweak.documentHighlighted = aHighlight;
			findbartweak.documentReHighlight = false;
			
			// This is only used by gFindBar.close(), to remove the grid and the esc event if they're not needed
			findbartweak.panel._notFoundHighlights = false;
			
			// Make sure we cancel any highlight timer that might be running
			if(findbartweak.panel._delayHighlight) {
				findbartweak.panel._delayHighlight.cancel();
			}
			
			findbartweak.gridOnOff();
			findbartweak.toAddtoGrid = []; // Not really needed when no grid is used but I'm preventing any possible error associated with it not being set
			findbartweak.FILLGRID = false;
			findbartweak.cleanHighlightGrid();
			// This part can't be in gridOnOff(), its called a lot outside of toggleHighlight()
			if(findbartweak.useGrid.value) {
				findbartweak.FILLGRID = findbartweak.resetHighlightGrid();
			}
			
			var levels = null;
			if(findbartweak.useCounter.value) {
				var levels = [];
				findbartweak.highlights = [];
			}
			
			var word = this._findField.value;
			findbartweak.panel._findWord = word;
			
			var textFound = this._highlightDoc(aHighlight, word, null, levels);
			
			// highlights are added to a temporary levels[] so we can move them to the highlights[] in the correct order (frames after content)
			findbartweak.moveHighlightsArray(levels);
			
			if(!word || textFound) {
				this._updateStatusUI(this.nsITypeAheadFind.FIND_FOUND);
				findbartweak.fillHighlightCounter();
			} else {
				this._updateStatusUI(this.nsITypeAheadFind.FIND_NOTFOUND);
				findbartweak.fillHighlightCounter(true);
				findbartweak.panel._notFoundHighlights = true;
			}
			
			if(findbartweak.FILLGRID) {
				findbartweak.fillHighlightGrid();
			}
		};
		
		// Add found words to counter and grid arrays if needed,
		// Modified to more accurately handle frames
		gFindBar._highlightDoc = function _highlightDoc(aHighlight, aWord, aWindow, aLevel) {
			if(aLevel) {
				aLevel.push( { highlights: [], levels: [] } );
				var thisLevel = aLevel.length -1;
			}
			var win = aWindow || this.browser.contentWindow;
			var textFound = false;
			for (var i = 0; win.frames && i < win.frames.length; i++) {
				var nextLevel = null;
				if(aLevel) {
					var nextLevel = aLevel[thisLevel].levels;
				}
				if(this._highlightDoc(aHighlight, aWord, win.frames[i], nextLevel)) {
					textFound = true;
					if(aHighlight && findbartweak.FILLGRID && win == this.browser.contentWindow) {
						findbartweak.FILLGRID = (findbartweak.toAddtoGrid.push( { node: win.frames[i].frameElement, pattern: true } ) > findbartweak.gridLimit.value) ? false : true;
					}
				}
				if(aLevel) {
					aLevel[thisLevel].levels = nextLevel;
				}
			}
			var controller = this._getSelectionController(win);
			if (!controller) {
				return textFound;
			}
			var doc = win.document;
			if (!doc || !(doc instanceof HTMLDocument) || !doc.body) {
				return textFound;
			}
			if (aHighlight || aLevel) {
				this._searchRange = doc.createRange();
				this._searchRange.selectNodeContents(doc.body);
				this._startPt = this._searchRange.cloneRange();
				this._startPt.collapse(true);
				this._endPt = this._searchRange.cloneRange();
				this._endPt.collapse(false);
				var retRange = null;
				var finder = Components.classes['@mozilla.org/embedcomp/rangefind;1'].createInstance().QueryInterface(Components.interfaces.nsIFind);
				finder.caseSensitive = this._shouldBeCaseSensitive(aWord);
				while ((retRange = finder.Find(aWord, this._searchRange, this._startPt, this._endPt))) {
					this._startPt = retRange.cloneRange();
					this._startPt.collapse(false);
					
					if(aHighlight) {
						this._highlight(retRange, controller);
						textFound = true;
					
						if(findbartweak.FILLGRID && win == this.browser.contentWindow) {
							var editableNode = this._getEditableNode(retRange.startContainer);
							if(editableNode) {
								findbartweak.FILLGRID = (findbartweak.toAddtoGrid.push( { node: editableNode, pattern: true } ) > findbartweak.gridLimit.value) ? false : true;
							} else {
								findbartweak.FILLGRID = (findbartweak.toAddtoGrid.push( { node: retRange, pattern: false } ) > findbartweak.gridLimit.value) ? false : true;
							}
						}
					}
					
					if(aLevel) {
						aLevel[thisLevel].highlights.push( {
							contentWindow: win,
							startContainer: retRange.startContainer,
							startOffset: retRange.startOffset,
							endContainer: retRange.endContainer,
							endOffset: retRange.endOffset
						} );
					}
				}
			}
			if(!aHighlight) {
				var sel = controller.getSelection(this._findSelection);
				sel.removeAllRanges();
				if (this._editors) {
					for (var x = this._editors.length - 1; x >= 0; --x) {
						if (this._editors[x].document == doc) {
							sel = this._editors[x].selectionController.getSelection(this._findSelection);
							sel.removeAllRanges();
							this._unhookListenersAtIndex(x);
						}
					}
				}
				return true;
			}
			return textFound;
		};
		
		// Editors listeners need to re-do the highlights when an highlight is deleted (only done if either the counter or the grid are used)
		gFindBar.DidInsertText = function DidInsertText(aTextNode, aOffset, aString) {
			var editor = this._getEditableNode(aTextNode).editor;
			var controller = editor.selectionController;
			var fSelection = controller.getSelection(this._findSelection);
			var range = this._findRange(fSelection, aTextNode, aOffset);
			if (range) {
				if (aTextNode == range.startContainer &&
				aOffset == range.startOffset) {
					range.setStart(range.startContainer, range.startOffset + aString.length);
				} else if (aTextNode != range.endContainer || aOffset != range.endOffset) {
					fSelection.removeRange(range);
					if(findbartweak.useGrid.value || findbartweak.useCounter.value) {
						findbartweak.documentReHighlight = true;
					}
					if (fSelection.rangeCount == 0) {
						this._removeEditorListeners(editor);
					}
				}
			}
		};
		gFindBar.WillDeleteSelection = function WillDeleteSelection(aSelection) {
			var editor = this._getEditableNode(aSelection.getRangeAt(0).startContainer).editor;
			var controller = editor.selectionController;
			var fSelection = controller.getSelection(this._findSelection);
			var selectionIndex = 0;
			var findSelectionIndex = 0;
			var shouldDelete = {};
			var numberOfDeletedSelections = 0;
			var numberOfMatches = fSelection.rangeCount;
			for (var fIndex = 0; fIndex < numberOfMatches; fIndex++) {
				shouldDelete[fIndex] = false;
				var fRange = fSelection.getRangeAt(fIndex);
				for (var index = 0; index < aSelection.rangeCount; index++) {
					if (!shouldDelete[fIndex]) {
						var selRange = aSelection.getRangeAt(index);
						var doesOverlap = this._checkOverlap(selRange, fRange);
						if (doesOverlap) {
							shouldDelete[fIndex] = true;
							numberOfDeletedSelections++;
						}
					}
				}
			}
			if (numberOfDeletedSelections == 0) {
				return;
			}
			for (var i = numberOfMatches - 1; i >= 0; i--) {
				if (shouldDelete[i]) {
					var r = fSelection.getRangeAt(i);
					fSelection.removeRange(r);
					if(findbartweak.useGrid.value || findbartweak.useCounter.value) {
						findbartweak.documentReHighlight = true;
					}
				}
			}
			if (fSelection.rangeCount == 0) {
				this._removeEditorListeners(editor);
			}
		};
		gFindBar.WillDeleteText = function WillDeleteText(aTextNode, aOffset, aLength) {
			var editor = this._getEditableNode(aTextNode).editor;
			var controller = editor.selectionController;
			var fSelection = controller.getSelection(this._findSelection);
			var range = this._findRange(fSelection, aTextNode, aOffset);
			if (range) {
				if (aTextNode != range.endContainer || aOffset != range.endOffset) {
					fSelection.removeRange(range);
					if(findbartweak.useGrid.value || findbartweak.useCounter.value) {
						findbartweak.documentReHighlight = true;
					}
					if (fSelection.rangeCount == 0) {
						this._removeEditorListeners(editor);
					}
				}
			}
		};
	},

	moveHighlightsArray: function(level) {
		if(!findbartweak.useCounter.value) { return; }
		
		for(var l=0; l<level.length; l++) {
			if(typeof(level[l].highlights) != 'undefined') {
				for(var i=0; i<level[l].highlights.length; i++) {
					findbartweak.highlights.push(level[l].highlights[i]);
				}
			}
			if(typeof(level[l].levels) != 'undefined') {
				findbartweak.moveHighlightsArray(level[l].levels);
			}
		}
	},
	
	openOptions: function() {
		window.openDialog('chrome://findbartweak/content/options.xul', '', 'chrome,resizable=false');
	},
	
	handleUIBackground: function() {
		findbartweak.uiBackup.textHighlightBackground = Application.prefs.getValue('ui.textHighlightBackground', null);
		if(!findbartweak.uiBackup.textHighlightBackground) {
			Application.prefs.setValue('ui.textHighlightBackground', '');
		}
		if(!findbartweak.textHighlightBackground) {
			findbartweak.textHighlightBackground = Application.prefs.get('ui.textHighlightBackground');
			findbartweak.listenerAid.add(findbartweak.textHighlightBackground, 'change', findbartweak.handleUIBackground);
		}
		findbartweak.changeHighlightColor('textHighlightBackground');
	},
	
	handleUIForeground: function() {
		findbartweak.uiBackup.textHighlightForeground = Application.prefs.getValue('ui.textHighlightForeground', null);
		if(!findbartweak.uiBackup.textHighlightForeground) {
			Application.prefs.setValue('ui.textHighlightForeground', '');
		}
		if(!findbartweak.textHighlightForeground) {
			findbartweak.textHighlightForeground = Application.prefs.get('ui.textHighlightForeground');
			findbartweak.listenerAid.add(findbartweak.textHighlightForeground, 'change', findbartweak.handleUIForeground);
		}
		findbartweak.changeHighlightColor('textHighlightForeground');
	},
	
	changeHighlightColor: function(which) {
		var m = findbartweak.highlightColor.value.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
		if(!m) { return false; }
		if(m[1].length === 6) { // 6-char notation
			var rgb = {
				r: parseInt(m[1].substr(0,2),16) / 255,
				g: parseInt(m[1].substr(2,2),16) / 255,
				b: parseInt(m[1].substr(4,2),16) / 255
			};
		} else { // 3-char notation
			var rgb = {
				r: parseInt(m[1].charAt(0)+m[1].charAt(0),16) / 255,
				g: parseInt(m[1].charAt(1)+m[1].charAt(1),16) / 255,
				b: parseInt(m[1].charAt(2)+m[1].charAt(2),16) / 255
			};
		}
		
		// Have to remove the listeners and add them back after, so the backups aren't overwritten with our values
		if(!which || which == 'textHighlightBackground') { findbartweak.listenerAid.remove(findbartweak.textHighlightBackground, 'change', findbartweak.handleUIBackground); }
		if(!which || which == 'textHighlightForeground') { findbartweak.listenerAid.remove(findbartweak.textHighlightForeground, 'change', findbartweak.handleUIForeground); }
		
		if(0.213 * rgb.r + 0.715 * rgb.g + 0.072 * rgb.b < 0.5) {
			if(!which || which == 'textHighlightBackground') { findbartweak.textHighlightBackground.value = '#FFFFFF'; }
			if(!which || which == 'textHighlightForeground') { findbartweak.textHighlightForeground.value = findbartweak.highlightColor.value; }
		}
		else {
			if(!which || which == 'textHighlightBackground') { findbartweak.textHighlightBackground.value = findbartweak.highlightColor.value; }
			if(!which || which == 'textHighlightForeground') { findbartweak.textHighlightForeground.value = '#000000'; }
		}
		
		if(!which || which == 'textHighlightBackground') { findbartweak.listenerAid.add(findbartweak.textHighlightBackground, 'change', findbartweak.handleUIBackground); }
		if(!which || which == 'textHighlightForeground') { findbartweak.listenerAid.add(findbartweak.textHighlightForeground, 'change', findbartweak.handleUIForeground); }
	},
	
	prepare: function(doHighlights) {
		findbartweak.moveGrid();
		findbartweak.marginGrid();
		
		if(doHighlights) {
			gFindBar.toggleHighlight(findbartweak.documentHighlighted);
		}
	},
	
	// Toggles the grid between in the scrollbar and by the scrollbar
	moveGrid: function() {
		if(findbartweak.gridInScrollbar.value && !findbartweak.grid.hasAttribute('inScrollbar')) {
			gBrowser.mCurrentBrowser.parentNode.insertBefore(findbartweak.grid, gBrowser.mCurrentBrowser);
			findbartweak.grid.setAttribute('inScrollbar', 'true');
			findbartweak.grid.removeAttribute('hidden');
			findbartweak.splitter.setAttribute('hidden', 'true');
			findbartweak.blocker.setAttribute('hidden', 'true');
		}
		else if(!findbartweak.gridInScrollbar.value && findbartweak.grid.hasAttribute('inScrollbar')) {
			findbartweak.panel.appendChild(findbartweak.grid);
			findbartweak.grid.removeAttribute('inScrollbar');
			findbartweak.blocker.removeAttribute('hidden');
		}
	},
	
	// Positions the grid when it is shown in the scrollbar itself or the blocker instead
	marginGrid: function() {
		// Reset this outside the timer so the window resizes faster (note to self: never remove these timers)
		findbartweak.blocker.style.marginLeft = '';
		findbartweak.grid.style.marginLeft = '';
				
		if(findbartweak.gridInScrollbar.value) {
			findbartweak.blocker.setAttribute('hidden', 'true');
			findbartweak.timerAid.init('margin', function() {
				findbartweak.grid.style.marginLeft = gBrowser.mCurrentBrowser.clientWidth - findbartweak.SCROLLBAR_WIDTH +'px';
			}, 500);
		}
		else {
			findbartweak.blocker.removeAttribute('hidden');
			findbartweak.timerAid.init('margin', function() {
				findbartweak.blocker.style.marginLeft = gBrowser.mCurrentBrowser.clientWidth - findbartweak.SCROLLBAR_WIDTH - (!findbartweak.grid.hidden ? findbartweak.gridWidth.value + (!findbartweak.splitter.hidden ? 4 : 0) : 0) +'px';
			}, 500);
		}
	},
	
  	// Updates the grid width values when the window (and as such the grid) is resized
	windowResize: function() {
		findbartweak.timerAid.init('resize', function() {
			if(findbartweak.useGrid.value && findbartweak.grid.getAttribute('width')) {
				findbartweak.gridWidth.value = findbartweak.grid.getAttribute('width');
			}
			findbartweak.prepare(findbartweak.documentHighlighted && findbartweak.useGrid.value);
		}, 250);
	},
	
	// Separate function from resetHighlightGrid() so we can clean the grid easily even when useGrid is false
	cleanHighlightGrid: function() {
		// Reset (clean) all grid rows
		for (var i=1; i<findbartweak.rows.childNodes.length-1; i++) {
			findbartweak.rows.childNodes[i].style.backgroundColor = null;
			findbartweak.rows.childNodes[i].style.backgroundImage = null;
			findbartweak.rows.childNodes[i].removeAttribute('scrollto');
			findbartweak.rows.childNodes[i].removeAttribute('scrollheight');
			findbartweak.listenerAid.remove(findbartweak.rows.childNodes[i], 'click', function() { findbartweak.scrollTo(this); }, false);
		}
	},
	
	// Prepares the grid to be filled with the highlights
	resetHighlightGrid: function() {
		// Adjust number of rows
		findbartweak._gridHeight = Math.max(findbartweak.grid.clientHeight - (findbartweak.SPACER_HEIGHT * 2), 0);
		var num_rows = Math.max(Math.ceil(findbartweak._gridHeight / findbartweak.ROWS_MULTIPLIER), findbartweak.ROWS_MINIMUM);
		while(findbartweak.rows.childNodes.length -2 > num_rows) {
			findbartweak.rows.removeChild(findbartweak.rows.childNodes[1]);
		}
		while(findbartweak.rows.childNodes.length -2 < num_rows) {
			var newNode = findbartweak.rows.childNodes[1].cloneNode(true);
			findbartweak.rows.insertBefore(newNode, findbartweak.rows.lastChild);
		}
		
		// Fix for non-html files (e.g. xml files)
		// I don't remember why I put !gBrowser.mCurrentBrowser in here... it may have happened sometime
		if(!findbartweak.contentDocument
		|| !findbartweak.contentDocument.getElementsByTagName('html')[0]
		|| !findbartweak.contentDocument.getElementsByTagName('body')[0]
		|| !gBrowser.mCurrentBrowser) {
			return false;
		}
		
		findbartweak._fullHTMLHeight = findbartweak.contentDocument.getElementsByTagName('html')[0].scrollHeight || findbartweak.contentDocument.getElementsByTagName('body')[0].scrollHeight;
		
		// Don't think this can happen but I better make sure
		if(findbartweak._fullHTMLHeight == 0) { return false; }
		
		findbartweak._scrollTop = findbartweak.contentDocument.getElementsByTagName('html')[0].scrollTop || findbartweak.contentDocument.getElementsByTagName('body')[0].scrollTop;
		
		return true;
	},
	
	fillHighlightGrid: function() {
		for(var i=0; i<findbartweak.toAddtoGrid.length; i++) {
			findbartweak.addToGrid(findbartweak.toAddtoGrid[i].node, findbartweak.toAddtoGrid[i].pattern);
		}
		findbartweak.FILLGRID = false;
		findbartweak.toAddtoGrid = [];
	},
	
	// Adds a range to the highlight grid
	addToGrid: function(aRange, pattern) {
		var rect = aRange.getBoundingClientRect();
		var absTop = (rect.top + findbartweak._scrollTop) / findbartweak._fullHTMLHeight;
		var absBot = (rect.bottom + findbartweak._scrollTop) / findbartweak._fullHTMLHeight;
		
		var highlighted = false;
		var row_bottom = 0;
		for (var j=1; j<findbartweak.rows.childNodes.length-1; j++) {
			var row = findbartweak.rows.childNodes[j];
			var row_top = row_bottom;
			var row_bottom = row_top + (row.clientHeight / findbartweak._gridHeight);
			
			// If any part of the row's range is within the match's range, highlight it
			if (( absTop >= row_top || absBot >= row_top ) && ( absTop <= row_bottom || absBot <= row_bottom )) {
				row.style.backgroundColor = findbartweak.highlightColor.value;
				row.setAttribute('scrollto', Math.floor(rect.top + findbartweak._scrollTop));
				row.setAttribute('scrollheight', Math.floor(rect.bottom - rect.top));
				findbartweak.listenerAid.add(row, 'click', function() { findbartweak.scrollTo(this); }, false);
				if(pattern) {
					row.style.backgroundImage = 'url("chrome://findbartweak/skin/pattern.gif")';
				}
				
				highlighted = true;
			}
			else if(highlighted) {
				break;
			}
		}
	},
	
	// Opens and closes the grid accordingly and positions it if !findbartweak.gridInScrollbar.value
	gridOnOff: function() {
		if(!findbartweak.useGrid.value
		|| !findbartweak.documentHighlighted
		|| gBrowser.getNotificationBox().currentNotification != null) {
			if(!findbartweak.gridInScrollbar.value) {
				findbartweak.grid.setAttribute('hidden', 'true');
				findbartweak.marginGrid();
			}
			findbartweak.panel.removeAttribute('Horient');
			findbartweak.splitter.setAttribute('hidden', 'true');
		}
		else {	
			findbartweak.grid.removeAttribute('hidden');
			if(!findbartweak.gridInScrollbar.value) {
				findbartweak.panel.setAttribute('Horient', 'true');
				findbartweak.marginGrid();
			}
		}
	},
	
	// Handles notifications, grid needs to be closed so we can re-set Horient back to default (vertical), otherwise the notification will be on the left rather than on top
	listenNotifications: function(e) {
		if(findbartweak.getPanelByChild(e.originalTarget) == findbartweak.panel) {
			findbartweak.gridOnOff();
		}
	},
	
	toggleCounter: function() {
		if(!findbartweak.counter) {
			if(!findbartweak.useCounter.value) { return; }
			
			findbartweak.counter = {
				node: document.createElement('label'),
				get value () { return findbartweak.counter.node.getAttribute('value'); },
				set value (v) { return findbartweak.counter.node.setAttribute('value', v); }
			};
				
			findbartweak.counter.node.id = 'highlight-counter';
			findbartweak.counter.value = findbartweak.strings.GetStringFromName('findbartweakCounter').replace("$hit$", 0).replace("$total$", 0);
			findbartweak.counter.node = findbartweak.findbar.insertBefore(findbartweak.counter.node, findbartweak.findbar.getElementsByClassName('findbar-textbox')[0].nextSibling);
		}
		
		if(!findbartweak.useCounter.value) {
			findbartweak.counter.node.setAttribute('collapsed', 'true');
			gFindBar.onFindAgainCommand = gFindBar._onFindAgainCommand;
		}
		else {
			findbartweak.counter.node.removeAttribute('collapsed');
			gFindBar.onFindAgainCommand = function(aFindPrevious) {
				this._onFindAgainCommand(aFindPrevious);
				if(findbartweak.documentReHighlight) {
					gFindBar.toggleHighlight(findbartweak.documentHighlighted);
				}
				findbartweak.fillHighlightCounter();
			};
		}
	},
	
	fillHighlightCounter: function(notFound) {
		if(!findbartweak.useCounter.value) { return; }
		
		if(notFound) {
			findbartweak.counter.value = '('+gFindBar._notFoundStr+')';
			return;
		}
		
		var contentWindow = gFindBar.browser._fastFind.currentWindow || gFindBar.browser.contentWindow;
		if(!contentWindow) { return; } // Usually triggered when a selection is on a frame and the frame closes
			
		var editableNode = gFindBar.browser._fastFind.foundEditable;
		var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
		if(controller) {
			var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
		} else {
			var sel = gFindBar._getSelectionController(contentWindow).getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
		}
		
		var h = 0;
		if(sel.rangeCount == 1) {
			// Most times we don't need to start from the beginning of the array, it's faster to resume from a previous point
			var start = findbartweak.panel._currentHighlight || 0;
			if(start >= findbartweak.highlights.length) {
				start = 0;
			}
			findbartweak.panel._currentHighlight = 0;
			
			for(var i=start; i<findbartweak.highlights.length; i++) {
				if(findbartweak.checkCurrentHighlight(contentWindow, sel.getRangeAt(0), findbartweak.highlights[i])) {
					h = i+1;
					findbartweak.panel._currentHighlight = i;
					break;
				}
			}
			
			if(h == 0 && start > 0) {
				for(var i=0; i<start; i++) {
					if(findbartweak.checkCurrentHighlight(contentWindow, sel.getRangeAt(0), findbartweak.highlights[i])) {
						h = i+1;
						findbartweak.panel._currentHighlight = i;
						break;
					}
				}
			}
			
			if(!findbartweak.REDOINGHIGHLIGHTS && h == 0 && findbartweak.highlights.length > 0) {
				findbartweak.REDOINGHIGHLIGHTS = true;
				gFindBar.toggleHighlight(findbartweak.documentHighlighted);
				findbartweak.REDOINGHIGHLIGHTS = false;
				return;
			}
		}
		
		findbartweak.counter.value = findbartweak.strings.GetStringFromName('findbartweakCounter').replace("$hit$", h).replace("$total$", findbartweak.highlights.length);
	},
	
	checkCurrentHighlight: function(contentWindow, current, highlight) {
		if(highlight.contentWindow == contentWindow
		&& highlight.startContainer == current.startContainer
		&& highlight.startOffset == current.startOffset
		&& highlight.endContainer == current.endContainer
		&& highlight.endOffset == current.endOffset) {
			return true;
		}
		return false;
	},
	
	// Add the reHighlight attribute to all tabs
	reHighlightAll: function() {
		for(var i=0; i<gBrowser.tabContainer.childNodes.length; i++) {
			gBrowser.tabContainer.childNodes[i]._reHighlight = true;
		}
	},
	
	// Handler for when switching tabs
	tabSelected: function() {
		findbartweak.prepare();
		findbartweak.aboutBlankCollapse();
		findbartweak.hideOnChrome();
		
		if(gFindBar.hidden && (findbartweak.documentHighlighted || findbartweak.documentReHighlight) && findbartweak.hideWhenFinderHidden.value) {
			gFindBar.toggleHighlight(false);
		}
		else if(findbartweak.documentReHighlight) {
			gFindBar.toggleHighlight(findbartweak.documentHighlighted);
		}
		else {
			// This needs to be here so it looks for possible notifications and handles the grid accordingly
			findbartweak.gridOnOff();
		
			// Just update the counter with the current tab values
			findbartweak.fillHighlightCounter();
		}
				
		if(findbartweak.documentHighlighted && findbartweak.panel._findWord) {
			gFindBar._findField.value = findbartweak.panel._findWord;
		}
	},
	
	// Commands a reHighlight if needed on any tab, triggered from frames as well
	contentLoaded: function(event) {
		// Prevent script from running untill it has initialized
		if(!findbartweak.initialized) {
			findbartweak.timerAid.init('contentLoaded', function() { findbartweak.contentLoaded(event); }, 100);
		}
		
		// this is the content document of the loaded page.
		var doc = event.originalTarget;
		if (doc instanceof HTMLDocument) {
			// is this an inner frame?
			// Find the root document:
			while (doc.defaultView.frameElement) {
				doc = doc.defaultView.frameElement.ownerDocument;
			}
			
			if(doc == findbartweak.contentDocument) {
				findbartweak.hideOnChrome();
				gFindBar.toggleHighlight(findbartweak.documentHighlighted && (!gFindBar.hidden || !findbartweak.hideWhenFinderHidden.value) );
			} else if(doc.documentElement) {
				doc.documentElement.setAttribute('reHighlight', 'true');
			}
		}
	},
	
	// Handler for when autoPage inserts something into the document
	autoPagerInserted: function(e) {
		if(findbartweak.contentDocument == e.originalTarget.ownerDocument) {
			findbartweak.hideOnChrome();
			gFindBar.toggleHighlight(findbartweak.documentHighlighted && (!gFindBar.hidden || !findbartweak.hideWhenFinderHidden.value) );
		} else {
			e.originalTarget.ownerDocument.documentElement.setAttribute('reHighlight', 'true');
		}
	},
	
	// Tab progress listeners, handles opening and closing of pages and location changes
	progressListener: {
		// Commands a reHighlight if needed, triggered from history navigation as well
		onLocationChange: function(browser, webProgress, request, location) {
			// Frames don't need to trigger this
			if(webProgress.DOMWindow == browser.contentWindow) {
				findbartweak.handleBrowser(browser, 100);
				
				// No need to call if there is nothing to find
				if(browser == gBrowser.mCurrentBrowser) {
					if(request && !request.isPending()) {
						gFindBar.toggleHighlight(findbartweak.documentHighlighted && (!gFindBar.hidden || !findbartweak.hideWhenFinderHidden.value) );
					}
				}
				else if(browser.contentDocument && browser.contentDocument.documentElement) {
					browser.contentDocument.documentElement.setAttribute('reHighlight', 'true');
				}
			}
		},
		
		// Mostly handles some necessary browser tags
		onProgressChange: function(browser, webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {
			findbartweak.handleBrowser(browser, curTotalProgress);
		}
	},
	
	handleBrowser: function(browser, curTotalProgress) {
		findbartweak.htmlClass(browser, 'gridInScrollbar', false);
		if(findbartweak.mainWindow.getAttribute('theme') == 'nasanightlaunch') {
			findbartweak.htmlClass(browser, 'gridNasanightlaunch', false);
		}
			
		if(browser == gBrowser.mCurrentBrowser) {
			findbartweak.prepare();
			
			// I found the > 3 to be the best value for comparison ( coming from onProgressChange() for aboutBlankCollapse() ), from a lot of trial and errors tests
			if(curTotalProgress > 3) {
				findbartweak.aboutBlankCollapse();
				findbartweak.hideOnChrome();
			}
			
			// Fix for a very stupid bug where the page would be rendered above the grid
			if(findbartweak.useGrid.value && !findbartweak.gridInScrollbar.value) {
				findbartweak.grid.setAttribute('hidden', 'true');
				findbartweak.splitter.setAttribute('hidden', 'true');
			}
		}
	},
	
	// Collapses the grid when about:blank (because it uses 'collapsed' instead of 'hidden' it doesn't affect gridOnOff() )
	aboutBlankCollapse: function() {
		if(gBrowser.mCurrentBrowser.currentURI.spec == 'about:blank') {
			findbartweak.grid.setAttribute('collapsed', 'true');
			findbartweak.blocker.setAttribute('collapsed', 'true');
		}
		else if(findbartweak.grid.hasAttribute('collapsed') || findbartweak.blocker.hasAttribute('collapsed')) {
			// Don't show the grid before there is content
			if(!findbartweak.contentDocument
			|| !findbartweak.contentDocument.documentElement) {
				findbartweak.timerAid.init('content', findbartweak.aboutBlankCollapse, 25);
				return;
			}
			
			if(findbartweak.contentDocument.documentElement.tagName.toLowerCase() == 'html'
			&& (	!findbartweak.contentDocument.documentElement.getElementsByTagName('body')[0]
				|| !findbartweak.contentDocument.documentElement.getElementsByTagName('body')[0].firstChild
				|| findbartweak.contentDocument.documentElement.getElementsByTagName('body')[0].clientHeight == 0
			)) {
				findbartweak.timerAid.init('content', findbartweak.aboutBlankCollapse, 25);
				return;
			}
		
			findbartweak.grid.removeAttribute('collapsed');
			findbartweak.blocker.removeAttribute('collapsed');
		}
	},
	
	// Prevent the FindBar from being visible in chrome pages like the add-ons manager
	hideOnChrome: function() {
		// Bugfix for Tree Style Tab (and possibly others): findbar is on the background after uncollapsing
		// So we do all this stuff with a delay to allow the window to repaint
		findbartweak.timerAid.init('hideOnChrome', function() {
			if(document.getElementById('cmd_find').getAttribute('disabled') == 'true'
			// Need to set this separately apparently, the find bar would only hide when switching to this tab after having been loaded, not upon loading the tab
			|| gBrowser.mCurrentBrowser.currentURI.spec == 'about:config'
			// No need to show the findbar in Speed Dial's window, it already had a display bug at startup which I already fixed, I'm preventing more bugs this way
			|| gBrowser.mCurrentBrowser.currentURI.spec == 'chrome://speeddial/content/speeddial.xul') {
				gFindBar.setAttribute('collapsed', 'true');
			} else {
				gFindBar.removeAttribute('collapsed');
			}
		}, 50);
	},
	
	htmlClass: function(browser, aClass, remove) {
		// I honestly can't figure out why or when either of these happen...
		if(!browser.contentDocument
		|| !browser.contentDocument.documentElement
		// Fix for non-html files (e.g. xml files)
		|| !browser.contentDocument.documentElement.classList) {
			return;
		}
		
		if(!remove && !browser.contentDocument.documentElement.classList.contains(aClass)) {
			browser.contentDocument.documentElement.classList.add(aClass);
			return;
		}
		else if(remove && browser.contentDocument.documentElement.classList.contains(aClass)) {
			browser.contentDocument.documentElement.classList.remove(aClass);
			return;
		}
	},
	
	// Some methods for retrieving dynamic references that change whenever we switch tabs
	get panel () { return document.getElementById(gBrowser.mCurrentTab.linkedPanel); },
	get contentDocument () { return (gBrowser.mCurrentBrowser.contentDocument) ? gBrowser.mCurrentBrowser.contentDocument : null; },
	get documentHighlighted () {
		return (findbartweak.contentDocument
			&& findbartweak.contentDocument.documentElement
			&& findbartweak.contentDocument.documentElement.getAttribute('highlighted') == 'true')
			? true : false;
	},
	set documentHighlighted (h) {
		if(findbartweak.contentDocument
		&& findbartweak.contentDocument.documentElement) {
			if(h) {
				findbartweak.contentDocument.documentElement.setAttribute('highlighted', 'true');
			} else {
				findbartweak.contentDocument.documentElement.removeAttribute('highlighted');
			}
		}
	},
	get documentReHighlight () {
		return findbartweak.panel._reHighlight
			|| (	findbartweak.contentDocument
				&& findbartweak.contentDocument.documentElement
				&& findbartweak.contentDocument.documentElement.hasAttribute('reHighlight')
			);
	},
	set documentReHighlight (r) {
		if(findbartweak.contentDocument
		&& findbartweak.contentDocument.documentElement) {
			if(r) {
				findbartweak.contentDocument.documentElement.setAttribute('reHighlight', 'true');
			} else {
				findbartweak.contentDocument.documentElement.removeAttribute('reHighlight');
				findbartweak.panel._reHighlight = false;
			}
		}
	},
	
	get grid () {
		findbartweak.getGrid();
		return findbartweak._grid;
	},
	get rows () {
		findbartweak.getGrid();
		return findbartweak._rows;
	},
	get splitter () {
		findbartweak.getGrid();
		return findbartweak._splitter;
	},
	get blocker () {
		findbartweak.getGrid();
		return findbartweak._blocker;
	},
				
	get highlights () {
		if(typeof(findbartweak.panel._highlights) == 'undefined') {
			findbartweak.highlights = [];
		}
		return findbartweak.panel._highlights;
	},
	set highlights (h) { return findbartweak.panel._highlights = h; },
	
	// Create a new highlight grid if needed
	getGrid: function() {
		if(!findbartweak.panel._hasHighlightGrid) {
			// First the grid itself
			var grid = document.createElement('grid');
			grid.setAttribute('class', 'fbt-highlight-grid');
			grid.setAttribute('width', findbartweak.gridWidth.value);
			grid.setAttribute('context', 'findbarMenu');
			if(gBrowser.mCurrentBrowser.currentURI.spec == 'about:blank') {
				grid.setAttribute('collapsed', 'true');
			}
			
			// preceeds gridOnOff(), works better on starting up with special tabs such as the Speed Dial add-on
			// (without this the grid would initialize as visible for some reason and screw up the layout, probably a question of timing in gridOnOff() )
			// I already fixed Speed Dial specifically but I'm leaving this here to prevent something similar with another possible add-on
			if(!findbartweak.gridInScrollbar.value && !findbartweak.documentHighlighted) {
				grid.setAttribute('hidden', 'true');
			}
			
			findbartweak.listenerAid.add(grid, 'dblclick', findbartweak.togglesplitter, false);
			
			// Then columns
			var columns = document.createElement('columns');
			columns = grid.appendChild(columns);
			
			var column = document.createElement('column');
			column = columns.appendChild(column);
			
			// Then start adding the rows
			var rows = document.createElement('rows');
			rows = grid.appendChild(rows);
			
			// Starting with the top spacer
			var topspacer = document.createElement('row');
			topspacer.setAttribute('flex', '0');
			topspacer.setAttribute('id', 'fbt-highlight-grid-top-spacer');
			topspacer.setAttribute('height', findbartweak.SPACER_HEIGHT +'px');
			topspacer = rows.appendChild(topspacer);
			
			// Actual highlight rows
			row = document.createElement('row');
			row.setAttribute('flex', '1');
			row = rows.appendChild(row);
			
			// we need to append all the rows
			for (var i=1; i<findbartweak.ROWS_MINIMUM; i++) {
				var row_i = row.cloneNode(true);
				rows.appendChild(row_i);
			}
			
			// append another spacer at the bottom
			var bottomspacer = topspacer.cloneNode(true);
			bottomspacer.id = "fbt-highlight-grid-bottom-spacer";
			rows.appendChild(bottomspacer);
			
			// Insert a splitter before the grid
			var splitter = document.createElement('splitter');
			splitter.setAttribute('class', 'fbt-grid-splitter');
			splitter.setAttribute('hidden', 'true');
			splitter.setAttribute('context', 'findbarMenu');
			splitter = findbartweak.panel.appendChild(splitter);
			
			// Insert the grid into the tab
			grid = findbartweak.panel.appendChild(grid);
			
			// Add the blocker for when the grid isn't in the scrollbar so it doesn't become transparent
			var blocker = document.createElement('grid');
			blocker.setAttribute('class', 'fbt-grid-blocker');
			blocker.setAttribute('hidden', 'true');
			if(gBrowser.mCurrentBrowser.currentURI.spec == 'about:blank') {
				blocker.setAttribute('collapsed', 'true');
			}
			blocker.setAttribute('collapsed', 'true');
			
			// Just blocker filler
			var columns = document.createElement('columns');
			var column = document.createElement('column');
			column = columns.appendChild(column);
			columns = blocker.appendChild(columns);
			var rows = document.createElement('rows');
			blocker.appendChild(rows);
			var row = document.createElement('row');
			row.setAttribute('flex', '1');
			row = rows.appendChild(row);
			
			blocker = gBrowser.mCurrentBrowser.parentNode.insertBefore(blocker, gBrowser.mCurrentBrowser);
			
			// handle appearance of notifications
			findbartweak.listenerAid.add(gBrowser.getNotificationBox(), 'AlertActive', findbartweak.listenNotifications, false);
			findbartweak.listenerAid.add(gBrowser.getNotificationBox(), 'AlertClose', findbartweak.listenNotifications, false);
			
			findbartweak.panel._hasHighlightGrid = true;
		}
		
		// Updates references to nodes
		// By not sending these references directly in the get()'s above we get a (huge) performance boost
		if(findbartweak._currentPanel != gBrowser.mCurrentTab.linkedPanel) {
			findbartweak._grid = findbartweak.panel.getElementsByClassName('fbt-highlight-grid')[0];
			findbartweak._rows = findbartweak._grid.getElementsByTagName("rows")[0];
			findbartweak._splitter = findbartweak.panel.getElementsByClassName('fbt-grid-splitter')[0];
			findbartweak._blocker = findbartweak.panel.getElementsByClassName('fbt-grid-blocker')[0];
			findbartweak._currentPanel = gBrowser.mCurrentTab.linkedPanel;
		}
	},
	
	getPanelByChild: function(aChild) {
		var node = aChild;
		if(node.localName != 'notificationbox') {
			while(node.parentNode) {
				node = node.parentNode;
				if(node.localName == 'notificationbox') {
					return node;
				}
			}
			return null;
		}
		return node;
	},
	
	// Event handler for escaping highlights when hitting esc
	hitEsc: function(e) {
		if(e.keyCode == e.DOM_VK_ESCAPE) {
			gFindBar.getElement("highlight").checked = false;
			gFindBar.toggleHighlight(false);
		}
	},
	
	// Shows or hides the grid splitter for resizing
	togglesplitter: function() {
		if(findbartweak.splitter.hasAttribute('hidden')) {
			findbartweak.splitter.removeAttribute('hidden');
		}
		else {
			findbartweak.splitter.setAttribute('hidden', 'true');
		}
	},
	
	// Scrolls the page down to attributed scroll position
	scrollTo: function(el) {
		if(!el.hasAttribute('scrollto')) { return; }
		
		findbartweak._scrollTop = findbartweak.contentDocument.getElementsByTagName('html')[0].scrollTop || findbartweak.contentDocument.getElementsByTagName('body')[0].scrollTop;
		
		var scrollTo = parseInt(el.getAttribute('scrollto'));
		var scrollHeight = parseInt(el.getAttribute('scrollheight'));
		var clientHeight = gBrowser.mCurrentBrowser.clientHeight;
			
		if(scrollTo >= findbartweak._scrollTop && scrollTo + scrollHeight <= findbartweak._scrollTop + clientHeight) { return; }
		
		if(scrollTo < findbartweak._scrollTop) {
			findbartweak.contentDocument.getElementsByTagName("html")[0].scrollTop = scrollTo;
			return;
		}
		
		if(scrollTo + scrollHeight > findbartweak._scrollTop + clientHeight) {
			findbartweak.contentDocument.getElementsByTagName("html")[0].scrollTop = scrollTo - clientHeight + scrollHeight;
			return;
		}
	},
	
	// Handler for Ctrl+F, it closes the findbar if it is already opened
	ctrlF: function(event) {
		if (TabView.isVisible()) {
			TabView.enableSearch(event);
		}
		else {
			if(gFindBar.hidden || !findbartweak.ctrlFCloses.value) {
				gFindBar.onFindCommand();
				gFindBar.open();
				if(gFindBar._findField.value) {
					gFindBar._setHighlightTimeout();
				}
			}
			else {
				gFindBar.close();
			}
		}
	},
	
	// A few toggle functions for simple features
	toggleClose: function() {
		if(findbartweak.hideClose.value) {
			gFindBar.setAttribute('noClose', 'true');
		} else {
			gFindBar.removeAttribute('noClose');
		}
	},
	
	toggleLabels: function() {
		if(findbartweak.hideLabels.value) {
			gFindBar.setAttribute('hideLabels', 'true');
		} else {
			gFindBar.removeAttribute('hideLabels');
		}
	},
	
	// Controls position of Findbar when it's sent to top
	toggleTop: function() {
		if(findbartweak.movetoTop.value) {
			// We need this to be first to "remove" the findbar from the bottombox so we can use correct values below
			gFindBar.setAttribute('movetotop', 'true');
			
			// Reposition the findbar when the window resizes
			findbartweak.listenerAid.add(window, "resize", findbartweak.delayMoveTop, false);
			// Compatibility with LessChrome HD
			findbartweak.listenerAid.add(window, "LessChromeShown", findbartweak.moveTop, false);
			findbartweak.listenerAid.add(window, "LessChromeHidden", findbartweak.moveTop, false);
			
			if(!findbartweak.OBSERVINGPERSONAS) {
				var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
				observerService.addObserver(findbartweak.findPersonaPosition, "lightweight-theme-changed", false);
				findbartweak.OBSERVINGPERSONAS = true;
			}
			
			// Call it once to position it
			findbartweak.moveTop();
		}
		else {
			findbartweak.listenerAid.remove(window, "resize", findbartweak.delayMoveTop, false);
			// Compatibility with LessChrome HD
			findbartweak.listenerAid.remove(window, "LessChromeShown", findbartweak.moveTop, false);
			findbartweak.listenerAid.remove(window, "LessChromeHidden", findbartweak.moveTop, false);
			
			if(findbartweak.OBSERVINGPERSONAS) {
				var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
				observerService.removeObserver(findbartweak.findPersonaPosition, "lightweight-theme-changed");
				findbartweak.OBSERVINGPERSONAS = false;
			}
			
			gFindBar.removeAttribute('movetotop');
			gFindBar.removeAttribute('style');
		}
	},
	
	delayMoveTop: function() {
		findbartweak.timerAid.init('top', findbartweak.moveTop, 250);
	},
	
	// Handles the position of the findbar
	moveTop: function() {
		if(!findbartweak.movetoTop.value || gFindBar.hasAttribute('hidden')) { return; }
		
		// If the 'layer' attribute isn't removed the findbar will lockup constantly (I have no idea what this attribute does though...)
		findbartweak.bottombox.removeAttribute('layer');
		
		findbartweak.style = {};
		findbartweak.computedStyle = {
			findbar: getComputedStyle(gFindBar),
			//bottombox: getComputedStyle(document.getElementById('browser-bottombox')),
			appcontent: getComputedStyle(document.getElementById('appcontent')),
			borderend: getComputedStyle(document.getElementById('browser-border-end')),
			navigatortoolbox: getComputedStyle(document.getElementById('navigator-toolbox')),
			browser: getComputedStyle(findbartweak.browser)
		};
		
		// Determining the position of the Findbar is a pain...
		var doneAppContent = false;
		findbartweak.style.maxWidth = 0;
		findbartweak.style.left = 0;
		for(var i=0; i<findbartweak.browser.childNodes.length; i++) {
			if(findbartweak.browser.childNodes[i].id != 'appcontent') {
				if(findbartweak.browser.childNodes[i].nodeName == 'splitter') { continue; }
				
				// Compatibility with OmniSidebar
				if((findbartweak.browser.childNodes[i].id == 'sidebar-box'
				 || findbartweak.browser.childNodes[i].id == 'sidebar-box-twin')
				&& findbartweak.browser.childNodes[i].hasAttribute('renderabove')) { continue; }
				
				// AiOS sets 'direction' property to 'rtl' when sidebar is on the right;
				// this accounts for that and for anything else that might do the same
				if(findbartweak.computedStyle.browser.getPropertyValue('direction') == 'ltr' || doneAppContent) {
					findbartweak.style.left += findbartweak.browser.childNodes[i].clientWidth;
					findbartweak.style.left += parseFloat(getComputedStyle(findbartweak.browser.childNodes[i]).getPropertyValue('border-left-width'));
					findbartweak.style.left += parseFloat(getComputedStyle(findbartweak.browser.childNodes[i]).getPropertyValue('border-right-width'));
				}
			} else {
				findbartweak.style.maxWidth += document.getElementById('appcontent').clientWidth;
				findbartweak.style.maxWidth += parseFloat(findbartweak.computedStyle.appcontent.getPropertyValue('border-left-width'));
				findbartweak.style.maxWidth += parseFloat(findbartweak.computedStyle.appcontent.getPropertyValue('border-right-width'));
				
				// Always account for the scrollbar wether it's visible or not
				findbartweak.style.maxWidth -= findbartweak.SCROLLBAR_WIDTH;	
				/*findbartweak.style.reachedBorder = true;
				if(gBrowser.mCurrentBrowser.contentDocument.documentElement.scrollHeight > gBrowser.mCurrentBrowser.contentDocument.documentElement.clientHeight) {
					findbartweak.style.maxWidth -= findbartweak.SCROLLBAR_WIDTH;
					findbartweak.style.reachedBorder = false;
				}*/
				
				if(findbartweak.panel._hasHighlightGrid
				&& !findbartweak.grid.hasAttribute('hidden')
				&& !findbartweak.gridInScrollbar.value) {
					findbartweak.style.maxWidth -= findbartweak.grid.getAttribute('width');
					if(!findbartweak.splitter.hasAttribute('hidden')) {
						findbartweak.style.maxWidth -= 4;
					}
					//findbartweak.style.reachedBorder = false;
				}
				
				// It never reaches the border because it always compensates for the scrollbar,
				// so I'm commenting this part, if I change my mind later I'll always have this here
				/*if(findbartweak.style.reachedBorder && document.getElementById('browser').childNodes[i+1].id == 'browser-border-end') {
					findbartweak.style.maxWidth += document.getElementById('browser-border-end').clientWidth;
					findbartweak.style.maxWidth += parseFloat(findbartweak.computedStyle.borderend.getPropertyValue('border-left-width'));
					findbartweak.style.maxWidth += parseFloat(findbartweak.computedStyle.borderend.getPropertyValue('border-right-width'));
					
					if(document.getElementById('main-window').getAttribute('sizemode') != 'normal') {
						findbartweak.style.maxWidth += parseFloat(findbartweak.computedStyle.findbar.getPropertyValue('border-right-width'));
					}
				}*/
				
				if(findbartweak.computedStyle.browser.getPropertyValue('direction') == 'ltr') {
					break;
				}
				
				doneAppContent = true;
			}
		}
				
		findbartweak.style.top = 0;
		if(findbartweak.mainWindow.getAttribute('sizemode') != 'fullscreen') {
			if(document.getElementById('titlebar')) {				
				findbartweak.style.top += document.getElementById('titlebar').clientHeight;
				findbartweak.style.top += parseFloat(getComputedStyle(document.getElementById('titlebar')).getPropertyValue('margin-bottom'));
			}	
		}
		else if(!document.getElementById('fullscr-toggler').hasAttribute('collapsed') || document.getElementById('fullscr-toggler').getAttribute('collapsed') != 'true') {
			findbartweak.style.top += document.getElementById('fullscr-toggler').clientHeight;
		}
		findbartweak.style.top += document.getElementById('navigator-toolbox').clientHeight;
		findbartweak.style.top += parseFloat(findbartweak.computedStyle.navigatortoolbox.getPropertyValue('border-top-width'));
		findbartweak.style.top += parseFloat(findbartweak.computedStyle.navigatortoolbox.getPropertyValue('border-bottom-width'));
		findbartweak.style.top += parseFloat(findbartweak.computedStyle.navigatortoolbox.getPropertyValue('margin-top'));
		
		findbartweak.style.string = 'max-width: ' + findbartweak.style.maxWidth + 'px;';
		findbartweak.style.string += ' left: ' + findbartweak.style.left + 'px;';
		findbartweak.style.string += ' top: ' + findbartweak.style.top + 'px;';
		
		gFindBar.setAttribute('style', findbartweak.style.string);
		
		if(findbartweak.mainWindow.getAttribute('lwtheme') == 'true') {
			findbartweak.findPersonaPosition();
		}
	},
	
	findPersonaPosition: function() {
		if(findbartweak.mainWindow.getAttribute('lwtheme') != 'true') {
			findbartweak.lwtheme.bgImage.value = '';
			findbartweak.lwtheme.bgWidth.value = 0;
			findbartweak.lwtheme.color.value = '';
			findbartweak.lwtheme.bgColor.value = '';
			findbartweak.stylePersonaFindBar();
			return;
		}
		
		var windowStyle = document.defaultView.getComputedStyle(findbartweak.mainWindow);
		if(findbartweak.lwtheme.bgImage.value != windowStyle.getPropertyValue('background-image') && windowStyle.getPropertyValue('background-image') != 'none') {
			findbartweak.lwtheme.bgImage.value = windowStyle.getPropertyValue('background-image');
			findbartweak.lwtheme.color.value = windowStyle.getPropertyValue('color');
			findbartweak.lwtheme.bgColor.value = windowStyle.getPropertyValue('background-color');
			findbartweak.lwtheme.bgWidth.value = 0;
			
			// We need to load the image so it populates so we can find out its width
			findbartweak.stylePersonaFindBar();
		
			findbartweak.lwtheme.image = new Image();
			findbartweak.lwtheme.image.src = findbartweak.lwtheme.bgImage.value.substr(5, findbartweak.lwtheme.bgImage.value.length - 8);
			findbartweak.findPersonaWidth();
			return;
		}
		
		findbartweak.stylePersonaFindBar();
	},
	
	findPersonaWidth: function() {
		if(findbartweak.lwtheme.bgWidth.value == 0 && findbartweak.lwtheme.image.naturalWidth != 0) {
			findbartweak.lwtheme.bgWidth.value = findbartweak.lwtheme.image.naturalWidth;
		}
		
		if(findbartweak.lwtheme.bgWidth.value != 0) {
			findbartweak.stylePersonaFindBar();
			return;
		}
		
		// We need to let the image load, otherwise its width will always be 0
		findbartweak.timerAid.init('persona', findbartweak.findPersonaWidth, 10);
	},
	
	stylePersonaFindBar: function() {
		findbartweak.lwtheme.string = findbartweak.style.string;
		
		if(findbartweak.lwtheme.bgImage.value != '') {
			findbartweak.lwtheme.string += ' background-image: ' + findbartweak.lwtheme.bgImage.value + ';';
			findbartweak.lwtheme.string += ' background-color: ' + findbartweak.lwtheme.color.value + ';';
			findbartweak.lwtheme.string += ' color: ' + findbartweak.lwtheme.color.value + ';';
			findbartweak.lwtheme.string += ' background-position: ' + (-findbartweak.style.left - (findbartweak.lwtheme.bgWidth.value - findbartweak.mainWindow.clientWidth)) + 'px ' + (-findbartweak.style.top) + 'px;';
		}
		
		gFindBar.setAttribute('style', findbartweak.lwtheme.string);
	},
	
	// Compatibility fixes for use with the Barlesque add-on
	barlesqueFix: function() {
		if(!findbartweak.bottombox.classList.contains('barlesque-bar')) { return; }
		
		findbartweak.bottombox.style.maxHeight = (findbartweak.movetoTop.value && findbartweak.bottombox.getAttribute('findmode')) ? '0px' : '';
	}	
};

Components.utils.import("chrome://findbartweak/content/utils.jsm", findbartweak);
findbartweak.listenerAid.add(window, "load", findbartweak.preinit, false);