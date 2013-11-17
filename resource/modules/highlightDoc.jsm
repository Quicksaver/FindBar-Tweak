moduleAid.VERSION = '1.4.4';

this.getDocProperty = function(doc, prop, min) {
	try {
		if(inPDFJS(doc)) {
			var cWindow = (doc.defaultView.PDFView) ? doc.defaultView : XPCNativeWrapper.unwrap(doc.defaultView);
			return cWindow.PDFView.container[prop];
		}
		
		if(doc instanceof Ci.nsIDOMHTMLDocument && doc.body) {
			if(min) { return Math.min(doc.documentElement[prop], doc.body[prop]); }
			return doc.documentElement[prop] || doc.body[prop];
		}
		
		return doc.documentElement[prop];
	}
	catch(ex) { return 0; }
};

this.alwaysUpdateStatusUI = function(e) {
	// toggleHighlight() doesn't update the UI in these conditions, we need it to, to update the counter (basically hide it)
	if(e.detail && !gFindBar._findField.value) {
		gFindBar._updateStatusUI(gFindBar.nsITypeAheadFind.FIND_FOUND);
	}
};

this.alwaysToggleHighlight = function() {
	// _find() doesn't toggleHighlight if checkbox is unchecked, we need it to, to update the counter
	if(!gFindBar.getElement("highlight").checked) {
              gFindBar._setHighlightTimeout();
	}
};

// Updates our methods when there are new pdf matches (it's an aSync process)
this.trackPDFMatches = function(e) {
	if(e && e.detail && e.detail.res == gFindBar.nsITypeAheadFind.FIND_PENDING) { return; }
	
	if(!isPDFJS) { return; }
	
	// Cancel another possible timer if it was scheduled before
	timerAid.cancel('trackPDFMatches');
	
	// We need this to access protected properties, hidden from privileged code
	var unWrap = XPCNativeWrapper.unwrap(contentWindow);
	
	// This usually means the matches are still being retrieved, however if this isn't true it still doesn't mean it's fully finished.
	// So later we set a timer to update itself after a while.
	// Bugfix: https://github.com/Quicksaver/FindBar-Tweak/issues/65 : I used to also check for PDFFindController.active, but that caused high CPU sometimes,
	// as that would never be set if the find bar was empty on load, so it kept setting the timer here.
	if(!unWrap.PDFFindController || unWrap.PDFFindController.resumeCallback) {
		linkedPanel._matchesPDFtotal = 0;
		timerAid.init('trackPDFMatches', trackPDFMatches, 0);
		return;
	}
	
	documentHighlighted = (unWrap.PDFFindController.state && unWrap.PDFFindController.state.caseSensitive);
	
	// No matches
	var total = 0;
	
	if(unWrap.PDFFindController.hadMatch) {
		var matches = unWrap.PDFFindController.pageMatches;
		for(var p=0; p<matches.length; p++) {
			total += matches[p].length;
		}
	}
	
	var doAgain = false;
	if(linkedPanel._matchesPDFtotal !== total) {
		linkedPanel._matchesPDFtotal = total;
		dispatch(gFindBar, { type: 'UpdatedPDFMatches', cancelable: false });
		doAgain = true;
	}
	
	if(doAgain || unWrap.PDFFindController.pageContents.length != unWrap.PDFView.pages.length) {
		tempPendingStatus(true);
		// Because it might still not be finished, we should update later
		timerAid.init('trackPDFMatches', trackPDFMatches, 250);
	} else {
		tempPendingStatus();
	}
};

this.tempPendingStatus = function(isPending) {
	var icon = gFindBar.getElement('find-status-icon');
	if(isPending) {
		setAttribute(icon, 'status', 'pending');
		if(icon._tempPendingTimer) {
			icon._tempPendingTimer.cancel();
		}
		icon._tempPendingTimer = aSync(function() {
			try {
				delete icon._tempPendingTimer;
				removeAttribute(icon, 'status');
			}
			catch(ex) {}
		}, 500);
	} else {
		removeAttribute(icon, 'status');
		if(icon._tempPendingTimer) {
			icon._tempPendingTimer.cancel();
			delete icon._tempPendingTimer;
		}
	}
};

// Returns whether the amount of ranges in the array is below the set limit to show in the grid
this.shouldFillGrid = function(toAdd) {
	var count = toAdd.length;
	for(var i=0; i<toAdd.length; i++) {
		if(toAdd[i].ranges) {
			count--;
			count += toAdd[i].ranges.length;
		}
	}
	
	return count <= prefAid.gridLimit;
};

this.toggleCounter = function() {
	moduleAid.loadIf('counter', prefAid.useCounter);
};

this.toggleGrid = function() {
	moduleAid.loadIf('grid', prefAid.useGrid);
};

this.toggleSights = function() {
	moduleAid.loadIf('sights', prefAid.sightsCurrent || prefAid.sightsHighlights);
};

moduleAid.LOADMODULE = function() {
	initFindBar('highlightDoc',
		function(bar) {
			// Add found words to counter and grid arrays if needed,
			// Modified to more accurately handle frames
			if(!mFinder) { bar.__highlightDoc = bar._highlightDoc; }
			bar._highlightDoc = function _highlightDoc(aHighlight, aWord, aWindow, aLevel, aSights, innerRanges) {
				if(!aWindow) {
					// Using the counter?
					linkedPanel._counterHighlights = null;
					if(prefAid.useCounter) {
						var counterLevels = [];
						aLevel = counterLevels;
					}
					
					// Using the grid?
					var fillGrid = false;
					innerRanges = null;
					if(prefAid.useGrid) {
						var toAddtoGrid = [];
						resetHighlightGrid();
						fillGrid = true;
					}
					
					// Using the sights?
					if(prefAid.sightsHighlights) {
						aSights = [];
					}
				}
				
				// Prepare counter levels for every frame, later we add them in order (frames last)
				if(aLevel) {
					aLevel.push({ highlights: [], levels: [] });
					var thisLevel = aLevel.length -1;
				}
				
				var win = aWindow || tweakGetWindow(this);
				
				var textFound = false;
				for(var i = 0; win.frames && i < win.frames.length; i++) {
					var nextLevel = null;
					if(aLevel) { nextLevel = aLevel[thisLevel].levels; }
					if(!aWindow && fillGrid) { innerRanges = new Array(); }
					
					if(this._highlightDoc(aHighlight, aWord, win.frames[i], nextLevel, aSights, innerRanges)) {
						textFound = true;
						
						// Frames get a pattern in the grid, with the whole extesion of the frame instead of just the highlight,
						// frames can be scrolled so the highlights position may not reflect their actual page position, they may not even be visible at the moment.
						if(aHighlight && !aWindow && fillGrid) {
							// Arrays are always live objects
							var frameRanges = new Array();
							for(var r=0; r<innerRanges.length; r++) {
								frameRanges.push(innerRanges[r]);
							}
							toAddtoGrid.push({ node: win.frames[i].frameElement, pattern: true, ranges: frameRanges });
							fillGrid = shouldFillGrid(toAddtoGrid);
						}
					}
					
					if(aLevel) { aLevel[thisLevel].levels = nextLevel; }
				}
				
				var controller = tweakGetSelectionController(this, win);
				var doc = win.document;
				if(!controller || !doc || !doc.documentElement) {
					// Without the selection controller,
					// we are unable to (un)highlight any matches
					return textFound;
				}
				
				var body = (doc instanceof Ci.nsIDOMHTMLDocument && doc.body) ? doc.body : doc.documentElement;
				
				// Bugfix: when using neither the highlights nor the counter, toggling the highlights off would trigger the "Phrase not found" status
				// because textFound would never have had the chance to be verified. This doesn't need to happen if a frame already triggered the found status.
				if(aHighlight || aLevel || !textFound) {
					var searchRange = doc.createRange();
					searchRange.selectNodeContents(body);
					
					var startPt = searchRange.cloneRange();
					startPt.collapse(true);
					
					var endPt = searchRange.cloneRange();
					endPt.collapse(false);
					
					var retRange = null;
					var finder = new tweakFindRange(this, aWord);
					
					while((retRange = finder.Find(searchRange, startPt, endPt))) {
						startPt = retRange.cloneRange();
						startPt.collapse(false);
						
						// Links Only search should update at least the counter accordingly
						if(this._findMode == this.FIND_LINKS
						&& (retRange.startContainer != retRange.endContainer || !getLinkElement(retRange.startContainer))) {
							continue;
						}
						
						textFound = true;
						
						// We can stop now if all we're looking for is the found status
						if(!aHighlight && !aLevel) { break; }
						
						if(aHighlight) {
							tweakHighlightRange(this, retRange, controller);
							
							if(!aWindow && fillGrid) {
								var editableNode = tweakGetEditableNode(this, retRange.startContainer);
								if(editableNode) {
									toAddtoGrid.push({ node: editableNode, pattern: true, rangeEdit: retRange });
								} else {
									toAddtoGrid.push({ node: retRange, pattern: false });
								}
								fillGrid = shouldFillGrid(toAddtoGrid);
							}
							else if(innerRanges) {
								innerRanges.push(retRange);
							}
							
							if(aSights) {
								aSights.push({ node: retRange, sights: false });
							}
						}
						
						// Always add to counter, whether we are highlighting or not
						if(aLevel) {
							aLevel[thisLevel].highlights.push(retRange);
						}
					}
				}
				
				if(!aWindow) {
					if(aLevel && aLevel == counterLevels) {
						var counterHighlights = [];
						moveHighlightsArray(counterLevels, counterHighlights);
						linkedPanel._counterHighlights = counterHighlights;
					}
					
					if(aHighlight && fillGrid) {
						fillHighlightGrid(toAddtoGrid);
					}
					
					if(aHighlight && aSights) {
						sightsOnVisibleHighlights(aSights);
					}
					
					if(textFound) {
						// Never take attention from current hit
						var curSel = controller.getSelection(Ci.nsISelectionController.SELECTION_NORMAL);
						if(curSel.rangeCount == 1) {
							controller.setDisplaySelection(Ci.nsISelectionController.SELECTION_ATTENTION);
						}
					}
				}
				
				if(!aHighlight) {
					// First, attempt to remove highlighting from main document
					var sel = controller.getSelection(Ci.nsISelectionController.SELECTION_FIND);
					sel.removeAllRanges();
					
					// Next, check our editor cache, for editors belonging to this
					// document
					var editors = tweakGetEditors(this);
					if(editors) {
						for(var x = editors.length - 1; x >= 0; --x) {
							if(editors[x].document == doc) {
								sel = editors[x].selectionController.getSelection(Ci.nsISelectionController.SELECTION_FIND);
								sel.removeAllRanges();
								// We don't need to listen to this editor any more
								tweakUnhookListenersAtIndex(this, x);
							}
						}
					}
				}
				
				return textFound;
			};
		},
		function(bar) {
			if(!mFinder) {
				bar._highlightDoc = bar.__highlightDoc;
				delete bar.__highlightDoc;
			} else {
				delete bar._highlightDoc;
			}
			
			var icon = bar.getElement('find-status-icon');
			if(icon._tempPendingTimer) {
				removeAttribute(icon, 'status');
				icon._tempPendingTimer.cancel();
				delete icon._tempPendingTimer;
			}
		}
	);
	
	listenerAid.add(window, 'ToggledHighlight', alwaysUpdateStatusUI);
	listenerAid.add(window, 'FoundFindBar', alwaysToggleHighlight);
	listenerAid.add(window, 'UpdatedStatusFindBar', trackPDFMatches);
	
	prefAid.listen('useCounter', toggleCounter);
	prefAid.listen('useGrid', toggleGrid);
	prefAid.listen('sightsCurrent', toggleSights);
	prefAid.listen('sightsHighlights', toggleSights);
	
	toggleCounter();
	toggleGrid();
	toggleSights();
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('useCounter', toggleCounter);
	prefAid.unlisten('useGrid', toggleGrid);
	prefAid.unlisten('sightsCurrent', toggleSights);
	prefAid.unlisten('sightsHighlights', toggleSights);
	
	moduleAid.unload('sights');
	moduleAid.unload('grid');
	moduleAid.unload('counter');
	
	listenerAid.remove(window, 'ToggledHighlight', alwaysUpdateStatusUI);
	listenerAid.remove(window, 'FoundFindBar', alwaysToggleHighlight);
	listenerAid.remove(window, 'UpdatedStatusFindBar', trackPDFMatches);
	
	if(!viewSource) {
		// Clean up everything this module may have added to tabs and panels and documents
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var panel = $(gBrowser.mTabs[t].linkedPanel);
			delete panel._counterHighlights;
			delete panel._currentHighlight;
			delete panel._matchesPDFtotal;
		}
	} else {
		delete linkedPanel._counterHighlights;
		delete linkedPanel._currentHighlight;
	}
	
	deinitFindBar('highlightDoc');
};
