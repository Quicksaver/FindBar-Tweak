Modules.VERSION = '2.0.0';

this.highlights = {
	clean: function() {
		Messenger.messageBrowser(gFindBar.browser, 'Highlights:Clean');
		gFindBar._updateStatusUI(gFindBar.nsITypeAheadFind.FIND_FOUND);
	},
	
	// This always calls toggleHighlight() at least once with a false argument, then with a true argument if reDo is true.
	// This way we ensure the old highlights are removed before adding new ones.
	apply: function(reDo, toUpdate) {
		// If there's no need to even call toggleHighlight(false) if we shouldn't, this can save a few ms when selecting tabs or loading documents
		if(!documentHighlighted && (!gFindBarInitialized || gFindBar.hidden || !findQuery)) {
			documentReHighlight = false;
			
			// Clean-up any leftover highlights stuff
			if(gFindBarInitialized) {
				this.clean();
			}
			
			return;
		}
		
		var bar = gFindBar;
		Finder.innerTextDeep.then(textContent => {
			try {
				// first of all, if we've changed tabs in the meantime we shouldn't follow through with this
				if(!gFindBarInitialized || gFindBar != bar) { return; }
				
				// When the page is changed (mostly AJAX stuff), don't update the highlights if it's not needed
				if(toUpdate && highlightedText == textContent) { return; }
				
				if(reDo && dispatch(gFindBar, { type: 'WillReHighlight' })) {
					gFindBar.toggleHighlight(false);
					gFindBar.toggleHighlight(true);
				} else {
					this.off();
					if(isPDFJS) {
						this.clean();
					}
				}
			}
			catch(ex) { Cu.reportError(ex); } // catch unhandled exceptions in the promise
		});
	},
	
	off: function() {
		highlightedWord = '';
		gFindBar._highlightAnyway = false;
		gFindBar.toggleHighlight(false);
	},
	
	// Add the reHighlight attribute to all tabs
	reHighlightAll: function() {
		// Timer prevents unnecessary multiple rehighlights
		Timers.init('reHighlightAll', function() {
			// This happens sometimes when opening new windows, I can't find out how this is getting called before viewSource is defined but it makes no functional difference
			if(typeof(viewSource) == 'undefined') { return; }
			
			if(!viewSource) {
				for(var tab of gBrowser.tabs) {
					if(gBrowser.isFindBarInitialized(tab)) {
						gBrowser.getFindBar(tab).browser.finder.documentReHighlight = true;
					}
				}
			}
			
			highlights.apply(documentHighlighted);
		}, 100);
	},
	
	tempPendingStatus: function(bar, data) {
		var icon = bar.getElement('find-status-icon');
		if(data) {
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
	},
	
	observe: function(aSubject, aTopic) {
		if(aTopic == 'ReHighlightAll') {
			this.reHighlightAll();
		}
	},
	
	// make sure we don't apply NOTFOUND status to the findbar if it's empty
	onWillUpdateStatusFindBar: function(e) {
		if(e.detail.res == gFindBar.nsITypeAheadFind.FIND_NOTFOUND && !findQuery) {
			e.preventDefault();
			e.stopPropagation();
			gFindBar._updateStatusUI(gFindBar.nsITypeAheadFind.FIND_FOUND);
		}
	},
	
	onClose: function(e) {
		// If the quickfind bar is auto-closing, it should still highlight the results
		if(e.type == 'ClosedFindBar' && gFindBar._findMode != gFindBar.FIND_NORMAL && Timers.delayHighlight) { return; }
		
		// Cancel a delayed highlight when closing the find bar
		Timers.cancel('delayHighlight');
		
		// If we're closing another findbar, do nothing else
		if(e.type == 'ClosedFindBarBackground') { return; }
		
		// To remove the grid and the esc key listener if there are no highlights
		if(documentHighlighted && !findQuery) {
			highlights.off();
		}
	},
	
	onWillToggleHighlight: function(e) {
		var aHighlight = e.detail;
		
		// Bugfix: sometimes when hitting F3 on a new value (i.e. globalFB, input one value in one tab, switch tab, hit F3 to use the same value)
		// it would highlight all, we should make sure it doesn't.
		if(!aHighlight && documentHighlighted && highlightedWord && highlightedWord == findQuery) {
			gFindBar._highlightAnyway = true;
		}
		if(aHighlight) {
			if(!Prefs.highlightOnFindAgain && gFindBar.hidden && !documentHighlighted && !gFindBar._highlightAnyway) {
				aHighlight = false;
				e.preventDefault();
			}
			gFindBar._highlightAnyway = false;
		}
		
		documentHighlighted = aHighlight;
		documentReHighlight = false;
		highlightedWord = (aHighlight) ? findQuery : '';
		
		// Make sure we cancel any highlight timer that might be running
		Timers.cancel('delayHighlight');
	},
	
	// Handler for when switching tabs
	onTabSelect: function() {
		Timers.init('highlightsTabSelected', function() {
			if(documentReHighlight) {
				if(gFindBar.hidden) {
					documentReHighlight = false;
				} else {
					highlights.apply(documentHighlighted);
				}
			}
		}, 0);
	},
	
	// ReDo highlights when hitting FindAgain if necessary (should rarely be triggered actually)
	onWillFindAgain: function() {
		if(documentReHighlight) {
			highlights.apply(documentHighlighted);
		}
	},
	
	onReHighlight: function(bar, data) {
		if(viewSource || bar == gFindBar) {
			if(data !== undefined) {
				this.apply(data);
			} else {
				this.apply(documentHighlighted, true);
			}
		}
		else {
			bar.browser.finder.documentReHighlight = true;
			if(data !== undefined) {
				bar.browser.finder.documentHighlighted = data;
			}
		}
	},
	
	// Trigger highlights when hitting Find Again
	onFoundAgain: function(e) {
		if(!Prefs.highlightOnFindAgain || isPDFJS || (documentHighlighted && findWord && findWord == findQuery)) { return; }
		if(gFindBar.hidden && Prefs.hideWhenFinderHidden) { return; } // Don't highlight if it's not supposed to when the findbar is hidden
		
		gFindBar._setHighlightTimeout();
	},
	
	onHighlights: function(aBrowser, aHighlight) {
		if(!gFindBarInitialized || gFindBar.browser != aBrowser) { return; }
		
		// the highlights commander needs to be updated in case we're surfing between pages that have or don't have highlights on
		if(aHighlight) {
			gFindBar.getElement("highlight").checked = true;
		}
		
		if(!documentHighlighted && (!findQuery || gFindBar.hidden)) {
			highlightedText = '';
		}
		else {
			var bar = gFindBar;
			Finder.innerTextDeep.then(function(textContent) {
				try {
					bar.browser.finder.highlightedText = textContent;
				}
				catch(ex) { Cu.reportError(ex); } // catch unhandled exceptions in the promise
			});
		}
		
		// toggleHighlight() doesn't update the UI in these conditions, we need it to, to update the counter (basically hide it)
		if(aHighlight && !findQuery) {
			gFindBar._updateStatusUI(gFindBar.nsITypeAheadFind.FIND_FOUND);
		}
	}
};

this.toggleCounter = function() {
	Modules.loadIf('counter', Prefs.useCounter);
};

this.toggleGrid = function() {
	Modules.loadIf('grid', Prefs.useGrid);
};

this.toggleSights = function() {
	Modules.loadIf('sights', Prefs.sightsCurrent || Prefs.sightsHighlights);
};

this.toggleHighlightByDefault = function() {
	Modules.loadIf('highlightByDefault', Prefs.highlightByDefault);
};

this.toggleHideOnClose = function() {
	Modules.loadIf('hideOnClose', Prefs.hideWhenFinderHidden);
};

this.toggleFillSelectedText = function() {
	Modules.loadIf('fillSelectedText', Prefs.fillSelectedText);
};

Modules.LOADMODULE = function() {
	initFindBar('highlights',
		function(bar) {
			Piggyback.add('highlights', bar, '_setHighlightTimeout', function() {
				// We want this to be updated regardless of what happens
				findWord = this._findField.value;
				
				// don't trigger re-highlights when selecting hits from the FIT window
				if(this.browser.finder.isPDFJS && this.browser.finder.workAroundFind) {
					return;
				}
				
				// Just reset any highlights and the counter if it's not supposed to highlight
				if(!this.getElement("highlight").checked || !this._findField.value) {
					highlights.off();
					return;
				}
				
				// Delay highlights if search term is too short
				var delay = SHORT_DELAY;
				if(this._findField.value && Prefs.minNoDelay > 0 && this._findField.value.length < Prefs.minNoDelay) {
					delay = LONG_DELAY;
				}
				
				// Make sure it triggers the highlight if we switch tabs meanwhile
				this.browser.finder.documentHighlighted = true;
				this.browser.finder.documentReHighlight = true;
				
				var bar = this;
				Timers.init('delayHighlight', function() {
					// We don't want to highlight pages that aren't supposed to be highlighted (happens when switching tabs when delaying highlights)
					if(gFindBarInitialized && gFindBar == bar) {
						highlights.apply(gFindBar.getElement("highlight").checked);
					}
				}, delay);
			});
			
			Piggyback.add('highlights', bar, 'toggleHighlight', function(aHighlight) {
				// Bugfix: with PDF.JS find would not work because it would hang when checking for PDFView.pdfDocument.numPages when PDFView.pdfDocument was still null.
				if(isPDFJS && isPDFJS.readyState != 'complete') { return; }
				
				var suffix = (!viewSource && this.browser != gBrowser.mCurrentBrowser) ? 'Background' : '';
				
				if(dispatch(this, { type: 'WillToggleHighlight'+suffix, detail: aHighlight })) {
					var word = this._findField.value;
					
					if((!this._dispatchFindEvent("highlightallchange"))
					// Bug 429723. Don't attempt to highlight ""
					|| (aHighlight && !word)) {
						highlights.onHighlights(this.browser, aHighlight);
						return;
					}
					
					this.browser._lastSearchHighlight = aHighlight;
					this.browser.finder.highlight(aHighlight, word);
				}
			});
			
			bar.browser.finder.addResultListener(highlights);
			
			bar.browser.finder.addMessage('ReHighlight', data => {
				highlights.onReHighlight(bar, data);
			});
			
			bar.browser.finder.addMessage('HighlightsOff', () => {
				if(!gFindBarInitialized || bar != gFindBar) { return; }
				highlights.off();
			});
			
			bar.browser.finder.addMessage('TempPending', data => {
				highlights.tempPendingStatus(bar, data);
			});
			
			Messenger.loadInBrowser(bar.browser, 'highlights');
		}, 
		function(bar) {
			Messenger.unloadFromBrowser(bar.browser, 'highlights');
			
			bar.browser.finder.removeResultListener(highlights);
			bar.browser.finder.removeMessage('ReHighlight');
			bar.browser.finder.removeMessage('HighlightsOff');
			bar.browser.finder.removeMessage('TempPending');
			
			highlights.tempPendingStatus(bar, false);
			
			Piggyback.revert('highlights', bar, '_setHighlightTimeout');
			Piggyback.revert('highlights', bar, 'toggleHighlight');
			delete bar._highlightAnyway;
		}
	);
	
	Listeners.add(window, 'WillUpdateStatusFindBar', highlights.onWillUpdateStatusFindBar, true);
	Listeners.add(window, 'ClosedFindBar', highlights.onClose);
	Listeners.add(window, 'ClosedFindBarBackground', highlights.onClose);
	Listeners.add(window, 'WillToggleHighlight', highlights.onWillToggleHighlight);
	Listeners.add(window, 'WillFindAgain', highlights.onWillFindAgain);
	Listeners.add(window, 'FoundAgain', highlights.onFoundAgain);
	Observers.add(highlights, 'ReHighlightAll');
	
	if(!viewSource) {
		Listeners.add(gBrowser.tabContainer, "TabSelect", highlights.onTabSelect);
	}
	
	Prefs.listen('useCounter', toggleCounter);
	Prefs.listen('useGrid', toggleGrid);
	Prefs.listen('sightsCurrent', toggleSights);
	Prefs.listen('sightsHighlights', toggleSights);
	Prefs.listen('highlightByDefault', toggleHighlightByDefault);
	Prefs.listen('hideWhenFinderHidden', toggleHideOnClose);
	Prefs.listen('fillSelectedText', toggleFillSelectedText);
	
	toggleCounter();
	toggleGrid();
	toggleSights();
	toggleHighlightByDefault();
	toggleHideOnClose();
	toggleFillSelectedText();
};

Modules.UNLOADMODULE = function() {
	Modules.unload('fillSelectedText');
	Modules.unload('toggleHideOnClose');
	Modules.unload('highlightByDefault');
	Modules.unload('sights');
	Modules.unload('grid');
	Modules.unload('counter');
	
	Prefs.unlisten('useCounter', toggleCounter);
	Prefs.unlisten('useGrid', toggleGrid);
	Prefs.unlisten('sightsCurrent', toggleSights);
	Prefs.unlisten('sightsHighlights', toggleSights);
	Prefs.unlisten('highlightByDefault', toggleHighlightByDefault);
	Prefs.unlisten('hideWhenFinderHidden', toggleHideOnClose);
	Prefs.unlisten('fillSelectedText', toggleFillSelectedText);
	
	if(!viewSource) {
		Listeners.remove(gBrowser.tabContainer, "TabSelect", highlights.onTabSelect);
	}
	
	Observers.remove(highlights, 'ReHighlightAll');
	Listeners.remove(window, 'WillUpdateStatusFindBar', highlights.onWillUpdateStatusFindBar, true);
	Listeners.remove(window, 'ClosedFindBar', highlights.onClose);
	Listeners.remove(window, 'ClosedFindBarBackground', highlights.onClose);
	Listeners.remove(window, 'WillToggleHighlight', highlights.onWillToggleHighlight);
	Listeners.remove(window, 'WillFindAgain', highlights.onWillFindAgain);
	Listeners.remove(window, 'FoundAgain', highlights.onFoundAgain);
	
	deinitFindBar('highlights');
};
