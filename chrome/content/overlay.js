var findbartweak = {
	preinit: function() {
		findbartweak.initialized = false;
		findbartweak.initTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		findbartweak.initTimer.init(findbartweak.init, 500, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		window.removeEventListener("load", findbartweak.preinit, false);
	},
	
	deinit: function() {
		// unregister all listeners
		gBrowser.tabContainer.removeEventListener("TabSelect", findbartweak.tabSelected, false);
		gBrowser.removeTabsProgressListener(findbartweak.progressListener);
		gBrowser.removeEventListener("DOMContentLoaded", findbartweak.contentLoaded, false);
		
		if(document.getElementById('ClearFields-in-find')) {
			document.getElementById('ClearFields-in-find').removeEventListener('click', function() { gFindBar._find(); }, false);
		}
		
		findbartweak.useGrid.events.removeListener("change", function() { 
			findbartweak.reHighlightAll(); 
			findbartweak.prepare(true); 
		});
		findbartweak.gridInScrollbar.events.removeListener("change", function() { 
			findbartweak.reHighlightAll(); 
			findbartweak.prepare(true); 
		});
		findbartweak.useCounter.events.removeListener("change", function() { 
			findbartweak.toggleCounter(); 
			findbartweak.reHighlightAll(); 
			findbartweak.prepare(true); 
		});
		findbartweak.highlightColor.events.removeListener("change", function() { 
			findbartweak.reHighlightAll(); 
			if(findbartweak.documentHighlighted && findbartweak.useGrid.value) { 
				findbartweak.prepare(true); 
			} 
		});
		findbartweak.hideClose.events.removeListener("change", findbartweak.toggleClose);
		findbartweak.movetoTop.events.removeListener("change", findbartweak.toggleTop);
		findbartweak.hideLabels.events.removeListener("change", findbartweak.toggleLabels);
		
		window.removeEventListener("resize", findbartweak.windowResize, false);
		if(findbartweak.movetoTop.value) {
			window.removeEventListener("resize", findbartweak.delayMoveTop, false);
			window.removeEventListener("LessChromeShown", findbartweak.moveTop, false);
			window.removeEventListener("LessChromeHidden", findbartweak.moveTop, false);
		}
		
		window.removeEventListener("AutoPagerAfterInsert", findbartweak.autoPagerInserted, false);
		
		window.removeEventListener("LessChromeShowing", function(e) { if(e.target.id == 'findbarMenu' || e.target.id == 'FindToolbar') { e.preventDefault(); } }, false);
		
		if(findbartweak.OBSERVINGPERSONAS) {
			var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
			observerService.removeObserver(findbartweak.findPersonaPosition, "lightweight-theme-changed");
		}
		
		// Reset UI preferences
		Application.prefs.get('ui.textHighlightBackground').reset();
		Application.prefs.get('ui.textHighlightForeground').reset();
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
		findbartweak.highlightColorOther = Application.prefs.get('extensions.findbartweak.highlightColorOther');
		findbartweak.gridWidth = Application.prefs.get('extensions.findbartweak.gridWidth');
		findbartweak.onStartup = Application.prefs.get('extensions.findbartweak.onStartup');
		findbartweak.findbarHidden = Application.prefs.get('extensions.findbartweak.findbarHidden');
		
		findbartweak.gridLimit = Application.prefs.get('extensions.findbartweak.gridLimit');
		findbartweak.minNoDelay = Application.prefs.get('extensions.findbartweak.minNoDelay');
		
		findbartweak.lwtheme = {
			bgImage: Application.prefs.get('extensions.findbartweak.lwtheme.bgImage'),
			bgWidth: Application.prefs.get('extensions.findbartweak.lwtheme.bgWidth'),
			color: Application.prefs.get('extensions.findbartweak.lwtheme.color'),
			bgColor: Application.prefs.get('extensions.findbartweak.lwtheme.bgColor')
		};
		
		// Do UI preferences
		if(findbartweak.highlightColorOther.value == '#FFFFFF') {
			Application.prefs.setValue('ui.textHighlightBackground', findbartweak.highlightColorOther.value);
			Application.prefs.setValue('ui.textHighlightForeground', findbartweak.highlightColor.value);
		}
		else {
			Application.prefs.setValue('ui.textHighlightBackground', findbartweak.highlightColor.value);
			Application.prefs.setValue('ui.textHighlightForeground', findbartweak.highlightColorOther.value);
		}
		
		// A few references
		findbartweak.findbar = gFindBar.getElement('findbar-container');
		findbartweak.mainWindow = document.getElementById('main-window');
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
		findbartweak.useGrid.events.addListener("change", function() { 
			findbartweak.reHighlightAll(); 
			findbartweak.prepare(true); 
		});
		findbartweak.gridInScrollbar.events.addListener("change", function() { 
			findbartweak.reHighlightAll(); 
			findbartweak.prepare(true); 
		});
		findbartweak.useCounter.events.addListener("change", function() { 
			findbartweak.toggleCounter(); 
			findbartweak.reHighlightAll(); 
			findbartweak.prepare(true); 
		});
		findbartweak.highlightColor.events.addListener("change", function() { 
			findbartweak.reHighlightAll(); 
			if(findbartweak.documentHighlighted && findbartweak.useGrid.value) { 
				findbartweak.prepare(true); 
			} 
		});
		findbartweak.hideClose.events.addListener("change", findbartweak.toggleClose);
		findbartweak.movetoTop.events.addListener("change", findbartweak.toggleTop);
		findbartweak.hideLabels.events.addListener("change", findbartweak.toggleLabels);
		
		// We register for tab switches because the "Highlight all" button is unclicked on those, 
		// and we have a bunch of stuff to do when that happens
		gBrowser.tabContainer.addEventListener("TabSelect", findbartweak.tabSelected, false);
		
		// Register all opened tabs with a listener
		gBrowser.addTabsProgressListener(findbartweak.progressListener);
		gBrowser.addEventListener("DOMContentLoaded", findbartweak.contentLoaded, false);
		
		// Autopager add-on compatibility: redo the highlights when new content is inserted in the page
		window.addEventListener("AutoPagerAfterInsert", findbartweak.autoPagerInserted, false);
		
		// Reposition the grid when it's being shown in the scrollbar itself
		window.addEventListener("resize", findbartweak.windowResize, false);
			
		// Right-clicking the findbar doesn't trigger LessChrome
		window.addEventListener("LessChromeShowing", function(e) { if(e.target.id == 'findbarMenu' || e.target.id == 'FindToolbar') { e.preventDefault(); } }, false);
		
		window.addEventListener("unload", findbartweak.deinit, false);
		findbartweak.initialized = true;
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
			
			var ret = gFindBar._open(aMode);
			if(aMode != undefined && aMode != 1) { findbartweak.findbarHidden.value = gFindBar.hidden; }
			
			findbartweak.moveTop();
			
			// Compatibility fix for Clear Fields add-on
			// This is put here because the clear field button isn't added at startup
			if(document.getElementById('ClearFields-in-find')) {
				// We don't want it to keep pilling event calls
				if(!document.getElementById('ClearFields-in-find').hasAttribute('findbartweakEd')) {
					// ClearFields doesn't distinguish types of clicks (left, middle, right) so I can't either
					document.getElementById('ClearFields-in-find').addEventListener('click', function() { gFindBar._find(); }, false);
				}
				document.getElementById('ClearFields-in-find').setAttribute('findbartweakEd', 'true');
			}
			
			return ret;
		};
		gFindBar.close = function() {
			gFindBar._close();
			findbartweak.findbarHidden.value = gFindBar.hidden;
			
			// Cancel a delayed highlight when closing the find bar
			findbartweak.panel._delayHighlight = null;
			
			// To remove the grid and the esc key listener if there are no highlights or when commanded by the hideWhenFinderHidden preference
			if(findbartweak.documentHighlighted
			&& (findbartweak.hideWhenFinderHidden.value || !gFindBar._findField.value || findbartweak.panel._notFoundHighlights) ) {
				gFindBar.toggleHighlight(false);
			}
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
					findbartweak.contentDocument.addEventListener('keyup', findbartweak.hitEsc, false);
				}
				
				// Make sure it triggers the highlight if we switch tabs meanwhile
				findbartweak.documentHighlighted = true;
				findbartweak.documentReHighlight = true;
			}
			
			findbartweak.panel._delayHighlight = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			findbartweak.panel._delayHighlight.init(function(timer) {
				// We don't want to highlight pages that aren't supposed to be highlighted (happens when switching tabs when delaying highlights)
				if(findbartweak.panel._delayHighlight == timer) {
					gFindBar.toggleHighlight(false);
					gFindBar.toggleHighlight(true); 
				}
			}, delay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		};
		
		// Handle the whole highlighting and counter process,
		// Even if highlights aren't on it still needs to be triggered
		gFindBar.toggleHighlight = function(aHighlight) {
			// Remove highlights when hitting Esc
			if(aHighlight) {
				if(!findbartweak.documentHighlighted) {
					findbartweak.contentDocument.addEventListener('keyup', findbartweak.hitEsc, false);
				}
			} else {
				findbartweak.contentDocument.removeEventListener('keyup', findbartweak.hitEsc, false);
			}
			
			findbartweak.documentHighlighted = aHighlight;
			findbartweak.documentReHighlight = false;
			
			// This is only used by gFindBar.close(), to remove the grid and the esc event if they're not needed
			findbartweak.panel._notFoundHighlights = false;
			
			// Make sure we cancel any highlight timer that might be running
			findbartweak.panel._delayHighlight = null;
			
			findbartweak.gridOnOff();
			findbartweak.toAddtoGrid = []; // Not really needed when no grid is used but I'm preventing any possible error associated with it not being set
			findbartweak.FILLGRID = false;
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
			findbartweak.marginTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			findbartweak.marginTimer.init(function() {
				findbartweak.grid.style.marginLeft = gBrowser.mCurrentBrowser.clientWidth - findbartweak.SCROLLBAR_WIDTH +'px';
			}, 500, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		}
		else {
			findbartweak.blocker.removeAttribute('hidden');
			findbartweak.marginTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
			findbartweak.marginTimer.init(function() {
				findbartweak.blocker.style.marginLeft = gBrowser.mCurrentBrowser.clientWidth - findbartweak.SCROLLBAR_WIDTH - (!findbartweak.grid.hidden ? findbartweak.gridWidth.value + (!findbartweak.splitter.hidden ? 4 : 0) : 0) +'px';
			}, 500, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
		}
	},
	
  	// Updates the grid width values when the window (and as such the grid) is resized
	windowResize: function() {
		findbartweak.resizeTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		findbartweak.resizeTimer.init(function() {
			if(findbartweak.useGrid.value && findbartweak.grid.getAttribute('width')) {
				findbartweak.gridWidth.value = findbartweak.grid.getAttribute('width');
			}
			findbartweak.prepare(findbartweak.documentHighlighted && findbartweak.useGrid.value);
		}, 250, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	},
	
	// Prepares the grid to be filled with the highlights
	resetHighlightGrid: function() {
		// Reset (clean) all grid rows
		for (var i=1; i<findbartweak.rows.childNodes.length-1; i++) {
			findbartweak.rows.childNodes[i].style.backgroundColor = null;
			findbartweak.rows.childNodes[i].style.backgroundImage = null;
			findbartweak.rows.childNodes[i].removeAttribute('scrollto');
			findbartweak.rows.childNodes[i].removeAttribute('scrollheight');
			findbartweak.rows.childNodes[i].removeEventListener('click', function() { findbartweak.scrollTo(this); }, false);
		}
		
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
				row.addEventListener('click', function() { findbartweak.scrollTo(this); }, false);
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
				findbartweak.contentTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
				findbartweak.contentTimer.init(findbartweak.aboutBlankCollapse, 25, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
				return;
			}
			
			if(findbartweak.contentDocument.documentElement.tagName.toLowerCase() == 'html'
			&& (	!findbartweak.contentDocument.documentElement.getElementsByTagName('body')[0]
				|| !findbartweak.contentDocument.documentElement.getElementsByTagName('body')[0].firstChild
				|| findbartweak.contentDocument.documentElement.getElementsByTagName('body')[0].clientHeight == 0
			)) {
				findbartweak.contentTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
				findbartweak.contentTimer.init(findbartweak.aboutBlankCollapse, 25, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
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
		findbartweak.hideOnChromeTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		findbartweak.hideOnChromeTimer.init(function() { 
			if(document.getElementById('cmd_find').getAttribute('disabled') == 'true') {
				gFindBar.setAttribute('collapsed', 'true');
			} else {
				gFindBar.removeAttribute('collapsed');
			}
		 }, 50, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
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
			grid.addEventListener('dblclick', findbartweak.togglesplitter, false);
			
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
			gBrowser.getNotificationBox().addEventListener('AlertActive', findbartweak.listenNotifications, false);
			gBrowser.getNotificationBox().addEventListener('AlertClose', findbartweak.listenNotifications, false);
			
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
		
		var scrollTo = parseInt(el.getAttribute('scrollto'));
		var scrollHeight = parseInt(el.getAttribute('scrollheight'));
		findbartweak._scrollTop = findbartweak.contentDocument.getElementsByTagName("html")[0].scrollTop;
		var clientHeight = gBrowser.mCurrentBrowser.clientHeight;
			
		if(scrollTo >= scrollTop && scrollTo + scrollHeight <= scrollTop + clientHeight) { return; }
		
		if(scrollTo < scrollTop) {
			findbartweak.contentDocument.getElementsByTagName("html")[0].scrollTop = scrollTo;
			return;
		}
		
		if(scrollTo + scrollHeight > scrollTop + clientHeight) {
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
			if(gFindBar.hidden) {
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
			window.addEventListener("resize", findbartweak.delayMoveTop, false);
			// Compatibility with LessChrome HD
			window.addEventListener("LessChromeShown", findbartweak.moveTop, false);
			window.addEventListener("LessChromeHidden", findbartweak.moveTop, false);
			
			if(!findbartweak.OBSERVINGPERSONAS) {
				var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
				observerService.addObserver(findbartweak.findPersonaPosition, "lightweight-theme-changed", false);
				findbartweak.OBSERVINGPERSONAS = true;
			}
			
			// Call it once to position it
			findbartweak.moveTop();
		}
		else {
			window.removeEventListener("resize", findbartweak.delayMoveTop, false);
			// Compatibility with LessChrome HD
			window.removeEventListener("LessChromeShown", findbartweak.moveTop, false);
			window.removeEventListener("LessChromeHidden", findbartweak.moveTop, false);
			
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
		findbartweak.topTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		findbartweak.topTimer.init(findbartweak.moveTop, 250, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	},
	
	// Handles the position of the findbar
	moveTop: function() {
		if(!findbartweak.movetoTop.value || gFindBar.hasAttribute('hidden')) { return; }
		
		// If the 'layer' attribute isn't removed the findbar will lockup constantly (I have no idea what this attribute does though...)
		document.getElementById('browser-bottombox').removeAttribute('layer');
		
		findbartweak.style = {};
		findbartweak.computedStyle = {
			findbar: document.defaultView.getComputedStyle(gFindBar),
			bottombox: document.defaultView.getComputedStyle(document.getElementById('browser-bottombox')),
			appcontent: document.defaultView.getComputedStyle(document.getElementById('appcontent')),
			borderend: document.defaultView.getComputedStyle(document.getElementById('browser-border-end')),
			navigatortoolbox: document.defaultView.getComputedStyle(document.getElementById('navigator-toolbox')),
		};
		
		// Determining the position of the Findbar is a pain...
		findbartweak.style.maxWidth = 0;
		findbartweak.style.left = 0;
		for(var i=0; i<document.getElementById('browser').childNodes.length; i++) {
			if(document.getElementById('browser').childNodes[i].id != 'appcontent') {
				if(document.getElementById('browser').childNodes[i].nodeName == 'splitter') { continue; }
				if((document.getElementById('browser').childNodes[i].id == 'sidebar-box' 
				 || document.getElementById('browser').childNodes[i].id == 'sidebar-box-twin') 
				&& document.getElementById('browser').childNodes[i].hasAttribute('renderabove')) { continue; }
				
				findbartweak.style.left += document.getElementById('browser').childNodes[i].clientWidth;
				findbartweak.style.left += parseFloat(document.defaultView.getComputedStyle(document.getElementById('browser').childNodes[i]).getPropertyValue('border-left-width'));
				findbartweak.style.left += parseFloat(document.defaultView.getComputedStyle(document.getElementById('browser').childNodes[i]).getPropertyValue('border-right-width'));
			
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
				
				break;
			}
		}
				
		findbartweak.style.top = 0;
		if(findbartweak.mainWindow.getAttribute('sizemode') != 'fullscreen') {
			if(document.getElementById('titlebar')) {				
				findbartweak.style.top += document.getElementById('titlebar').clientHeight;
				findbartweak.style.top += parseFloat(document.defaultView.getComputedStyle(document.getElementById('titlebar')).getPropertyValue('margin-bottom'));
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
		findbartweak.personaTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		findbartweak.personaTimer.init(findbartweak.findPersonaWidth, 10, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
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
	
	// This acts as a replacement for the event DOM Attribute Modified, works for both attributes and object properties
	setWatchers: function(obj) {
		// Properties part, works by replacing the get and set accessor methods of a property with custom ones
		if(	typeof(obj) != 'object' 
			|| typeof(obj.addPropertyWatcher) != 'undefined'
			|| typeof(obj.removePropertyWatcher) != 'undefined'
			|| typeof(obj.propertiesWatched) != 'undefined') 
		{ 
			return; 
		}
		
		// Monitors 'prop' property of object, calling a handler function 'handler' when it is changed
		obj.addPropertyWatcher = function (prop, handler) {
			if(typeof(this.propertiesWatched[prop]) == 'undefined') {
				this.propertiesWatched[prop] = {};
				this.propertiesWatched[prop].handlers = new Array();
				this.propertiesWatched[prop].handlers.push(handler);
			
				this.propertiesWatched[prop].value = this[prop],
				getter = function () {
					return this.propertiesWatched[prop].value;
				},
				setter = function (newval) {
					for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
						this.propertiesWatched[prop].handlers[i].call(this, prop, this.propertiesWatched[prop].value, newval);
					}
					return this.propertiesWatched[prop].value = newval;
				};
				if (delete this[prop]) { // can't watch constants
					Object.defineProperty(this, prop, { get: getter, set: setter, enumerable: true, configurable: true });
				}
			}
			else {
				var add = true;
				for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
					// Have to compare using toSource(), it won't work if I just compare handlers for some reason
					if(this.propertiesWatched[prop].handlers[i].toSource() == handler.toSource()) {
						add = false;
					}
				}
				if(add) {
					this.propertiesWatched[prop].handlers.push(handler);
				}
			}
		};
		
		// Removes handler 'handler' for property 'prop'
		obj.removePropertyWatcher = function (prop, handler) {
			if(typeof(this.propertiesWatched[prop]) == 'undefined') { return; }
			
			for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
				if(this.propertiesWatched[prop].handlers[i].toSource() == handler.toSource()) {
					this.propertiesWatched[prop].handlers.splice(i, 1);
				}
			}
			
			if(this.propertiesWatched[prop].handlers.length == 0) {
				this.propertiesWatched[prop].value = this[prop];
				delete this[prop]; // remove accessors
				this[prop] = this.propertiesWatched[prop].value;
				delete this.propertiesWatched[prop];
			}
		};
		
		// This will hold the current value of all properties being monitored, as well as a list of their handlers to be called
		obj.propertiesWatched = {};
		
		// Attributes part, works by replacing the actual attribute native functions with custom ones (while still using the native ones)
		if(	typeof(obj.callAttributeWatchers) != 'undefined'
			|| typeof(obj.addAttributeWatcher) != 'undefined'
			|| typeof(obj.removeAttributeWatcher) != 'undefined'
			|| typeof(obj.attributesWatched) != 'undefined'
			|| typeof(obj.setAttribute) != 'function'
			|| typeof(obj.setAttributeNS) != 'function'
			|| typeof(obj.setAttributeNode) != 'function'
			|| typeof(obj.setAttributeNodeNS) != 'function'
			|| typeof(obj.removeAttribute) != 'function'
			|| typeof(obj.removeAttributeNS) != 'function'
			|| typeof(obj.removeAttributeNode) != 'function'
			|| typeof(obj.attributes.setNamedItem) != 'function'
			|| typeof(obj.attributes.setNamedItemNS) != 'function'
			|| typeof(obj.attributes.removeNamedItem) != 'function'
			|| typeof(obj.attributes.removeNamedItemNS) != 'function')
		{
			return;
		}
		
		// Monitors 'attr' attribute of element, calling a handler function 'handler' when it is set or removed
		obj.addAttributeWatcher = function (attr, handler) {
			if(typeof(this.attributesWatched[attr]) == 'undefined') {
				this.attributesWatched[attr] = {};
				this.attributesWatched[attr].handlers = new Array();
				this.attributesWatched[attr].handlers.push(handler);
			
				this.attributesWatched[attr].value = this.getAttribute(attr);
			}
			else {
				var add = true;
				for(var i=0; i<this.attributesWatched[attr].handlers.length; i++) {
					if(this.attributesWatched[attr].handlers[i].toSource() == handler.toSource()) {
						add = false;
					}
				}
				if(add) {
					this.attributesWatched[attr].handlers.push(handler);
				}
			}
		};
		
		// Removes handler function 'handler' for attribute 'attr'
		obj.removeAttributeWatcher = function (attr, handler) {
			if(typeof(this.attributesWatched[attr]) == 'undefined') { return; }
			
			for(var i=0; i<this.attributesWatched[attr].handlers.length; i++) {
				if(this.attributesWatched[attr].handlers[i].toSource() == handler.toSource()) {
					this.attributesWatched[attr].handlers.splice(i, 1);
				}
			}
		};
		
		// This will hold the current value of all attributes being monitored, as well as a list of their handlers to be called
		obj.attributesWatched = {};
		
		// Calls handler functions for attribute 'attr'
		obj.callAttributeWatchers = function (el, attr, newval) {
			if(typeof(el.attributesWatched[attr]) == 'undefined') { return; }
			
			el.attributesWatched[attr].value = newval;
			
			if(el.attributesWatched[attr].handlers.length == 0) { return; }
			for(var i=0; i<el.attributesWatched[attr].handlers.length; i++) {
				el.attributesWatched[attr].handlers[i].call(el, attr, el.attributesWatched[attr].value, newval);
			}
		};
		
		// Store all native functions as '_function' and set custom ones to handle attribute changes
		obj._setAttribute = obj.setAttribute;
		obj._setAttributeNS = obj.setAttributeNS;
		obj._setAttributeNode = obj.setAttributeNode;
		obj._setAttributeNodeNS = obj.setAttributeNodeNS;
		obj._removeAttribute = obj.removeAttribute;
		obj._removeAttributeNS = obj.removeAttributeNS;
		obj._removeAttributeNode = obj.removeAttributeNode;
		obj.attributes._setNamedItem = obj.attributes.setNamedItem;
		obj.attributes._setNamedItemNS = obj.attributes.setNamedItemNS;
		obj.attributes._removeNamedItem = obj.attributes.removeNamedItem;
		obj.attributes._removeNamedItemNS = obj.attributes.removeNamedItemNS;
		
		obj.setAttribute = function(attr, value) {
			this._setAttribute(attr, value);
			this.callAttributeWatchers(this, attr, value);
		};
		obj.setAttributeNS = function(namespace, attr, value) {
			this._setAttributeNS(namespace, attr, value);
			this.callAttributeWatchers(this, attr, value);
		};
		obj.setAttributeNode = function(attr) {
			var ret = this._setAttributeNode(attr);
			this.callAttributeWatchers(this, attr.name, attr.value);
			return ret;
		};
		obj.setAttributeNodeNS = function(attr) {
			var ret = this._setAttributeNodeNS(attr);
			this.callAttributeWatchers(this, attr.name, attr.value);
			return ret;
		};
		obj.removeAttribute = function(attr) {
			var callWatchers = (this.hasAttribute(attr)) ? true : false;
			this._removeAttribute(attr);
			if(callWatchers) {
				this.callAttributeWatchers(this, attr, null);
			}
		};
		obj.removeAttributeNS = function(namespace, attr) {
			var callWatchers = (this.hasAttribute(attr)) ? true : false;
			this._removeAttributeNS(namespace, attr);
			if(callWatchers) {
				this.callAttributeWatchers(this, attr, null);
			}
		};
		obj.removeAttributeNode = function(attr) {
			var callWatchers = (this.hasAttribute(attr.name)) ? true : false;
			var ret = this._removeAttributeNode(attr);
			if(callWatchers) {
				this.callAttributeWatchers(this, attr.name, null);
			}
			return ret;
		};
		obj.attributes.setNamedItem = function(attr) {
			var ret = this.attributes._setNamedItem(attr);
			this.callAttributeWatchers(this, attr.name, attr.value);
			return ret;
		};
		obj.attributes.setNamedItemNS = function(namespace, attr) {
			var ret = this.attributes._setNamedItemNS(namespace, attr);
			this.callAttributeWatchers(this, attr.name, attr.value);
			return ret;
		};
		obj.attributes.removeNamedItem = function(attr) {
			var callWatchers = (this.hasAttribute(attr)) ? true : false;
			var ret = this.attributes._removeNamedItem(attr);
			this.callAttributeWatchers(this, attr, null);
			return ret;
		};
		obj.attributes.removeNamedItemNS = function(namespace, attr) {
			var callWatchers = (this.hasAttribute(attr)) ? true : false;
			var ret = this.attributes._removeNamedItemNS(namespace, attr);
			this.callAttributeWatchers(this, attr, null);
			return ret;
		};
	}
};

window.addEventListener("load", findbartweak.preinit, false);