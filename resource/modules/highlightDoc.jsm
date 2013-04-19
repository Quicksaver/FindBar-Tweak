moduleAid.VERSION = '1.2.0';

this.toggleCounter = function() {
	moduleAid.loadIf('counter', prefAid.useCounter);
}

this.toggleGrid = function() {
	moduleAid.loadIf('grid', prefAid.useGrid);
};

moduleAid.LOADMODULE = function() {
	this.backups = {
		_highlightDoc: gFindBar._highlightDoc
	};
	
	// Add found words to counter and grid arrays if needed,
	// Modified to more accurately handle frames
	gFindBar._highlightDoc = function _highlightDoc(aHighlight, aWord, aWindow, aLevel) {
		if(!aWindow && !aLevel) {
			linkedPanel._counterHighlights = null;
			if(prefAid.useCounter) {
				var counterLevels = [];
				aLevel = counterLevels;
			}
			
			var fillGrid = false;
			if(prefAid.useGrid) {
				var toAddtoGrid = [];
				fillGrid = resetHighlightGrid();
			}
		}
			
		if(aLevel) {
			aLevel.push({ highlights: [], levels: [] });
			var thisLevel = aLevel.length -1;
		}
		
		var win = aWindow || this.browser.contentWindow;
		var textFound = false;
		for(var i = 0; win.frames && i < win.frames.length; i++) {
			var nextLevel = null;
			if(aLevel) { nextLevel = aLevel[thisLevel].levels; }
			
			if(this._highlightDoc(aHighlight, aWord, win.frames[i], nextLevel)) {
				textFound = true;
				if(aHighlight && fillGrid && !aWindow) {
					fillGrid = (toAddtoGrid.push({ node: win.frames[i].frameElement, pattern: true }) <= prefAid.gridLimit);
				}
			}
			
			if(aLevel) { aLevel[thisLevel].levels = nextLevel; }
		}
		
		var controller = this._getSelectionController(win);
		if(!controller) {
			// Without the selection controller,
			// we are unable to (un)highlight any matches
			return textFound;
		}
		
		var doc = win.document;
		if(!doc || !(doc instanceof window.HTMLDocument) || !doc.body) {
			return textFound;
		}
		
		if(aHighlight || aLevel) {
			var searchRange = doc.createRange();
			searchRange.selectNodeContents(doc.body);
			
			var startPt = searchRange.cloneRange();
			startPt.collapse(true);
			
			var endPt = searchRange.cloneRange();
			endPt.collapse(false);
			
			var retRange = null;
			var finder = Components.classes['@mozilla.org/embedcomp/rangefind;1'].createInstance().QueryInterface(Components.interfaces.nsIFind);
			finder.caseSensitive = this._shouldBeCaseSensitive(aWord);
			
			while((retRange = finder.Find(aWord, searchRange, startPt, endPt))) {
				startPt = retRange.cloneRange();
				startPt.collapse(false);
				textFound = true;
				
				if(aHighlight) {
					this._highlight(retRange, controller);
				
					if(fillGrid && !aWindow) {
						var editableNode = this._getEditableNode(retRange.startContainer);
						if(editableNode) {
							fillGrid = (toAddtoGrid.push({ node: editableNode, pattern: true }) <= prefAid.gridLimit);
						} else {
							fillGrid = (toAddtoGrid.push({ node: retRange }) <= prefAid.gridLimit);
						}
					}
				}
				
				if(aLevel) {
					aLevel[thisLevel].highlights.push({
						contentWindow: win,
						startContainer: retRange.startContainer,
						startOffset: retRange.startOffset,
						endContainer: retRange.endContainer,
						endOffset: retRange.endOffset
					});
				}
			}
		}
		
		if(!aWindow && aLevel && aLevel == counterLevels) {
			var counterHighlights = [];
			moveHighlightsArray(counterLevels, counterHighlights);
			linkedPanel._counterHighlights = counterHighlights;
		}
		
		if(!aWindow && fillGrid) {
			fillHighlightGrid(toAddtoGrid);
		}
		
		if(!aHighlight) {
			// First, attempt to remove highlighting from main document
			var sel = controller.getSelection(this._findSelection);
			sel.removeAllRanges();
			
			// Next, check our editor cache, for editors belonging to this
			// document
			if(this._editors) {
				for(var x = this._editors.length - 1; x >= 0; --x) {
					if(this._editors[x].document == doc) {
						sel = this._editors[x].selectionController.getSelection(this._findSelection);
						sel.removeAllRanges();
						// We don't need to listen to this editor any more
						this._unhookListenersAtIndex(x);
					}
				}
			}
		}
		return textFound;
	}
	
	prefAid.listen('useCounter', toggleCounter);
	prefAid.listen('useGrid', toggleGrid);
	
	toggleCounter();
	toggleGrid();
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('useCounter', toggleCounter);
	prefAid.unlisten('useGrid', toggleGrid);
	
	moduleAid.unload('grid');
	moduleAid.unload('counter');
	
	if(!viewSource) {
		// Clean up everything this module may have added to tabs and panels and documents
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var panel = $(gBrowser.mTabs[t].linkedPanel);
			delete panel._counterHighlights;
			delete panel._currentHighlight;
		}
	} else {
		delete linkedPanel._counterHighlights;
		delete linkedPanel._currentHighlight;
	}
	
	if(this.backups) {
		gFindBar._highlightDoc = this.backups._highlightDoc;
		delete this.backups;
	}
};
