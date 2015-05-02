Modules.VERSION = '1.1.0';

this.sights = {
	allSights: new Set(),
	allGroups: new Map(),
	nextGroup: 0,
	
	onFindResult: function(data) {
		if(Prefs.sightsCurrent && data.storeResult) {
			this.current();
		}
	},
	
	onHighlightFinished: function(aHighlight) {
		if(Prefs.sightsHighlights && aHighlight) {
			this.highlights();
		}
	},
	
	onPDFResult: function(aAction) {
		if(Prefs.sightsCurrent && aAction != 'findhighlightallchange') {
			Timers.init('sightsOnPDFState', () => { this.current(); }, 50);
		}
		
		// don't do this immediately, let onPDFMatches take over if it can, as there's no need to repeat
		if(Prefs.sightsHighlights
		&& (documentHighlighted != PDFJS.findController.state.highlightAll || Finder.highlightedWord != PDFJS.findController.state.query)) {
			this._pdfMatches = new Map();
			Timers.init('sightsOnHighlightsOnPDFState', () => { this.highlights(); }, 250);
		}
	},
	
	onPDFMatches: function(newMatches) {
		if(Prefs.sightsHighlights && newMatches) {
			Timers.cancel('sightsOnHighlightsOnPDFState');
			this._pdfMatches = new Map();
			this.highlights();
		}
	},
	
	onCleanUpHighlights: function() {
		Timers.cancel('sightsOnScroll');
		Listeners.remove(Scope, 'scroll', this, true);
		for(let group of this.allGroups.values()) {
			if(!group.current) {
				group.remove();
			}
		}
	},
	
	handleEvent: function(e) {
		if(Prefs.sightsHighlights) {
			Timers.init('sightsOnScroll', () => { this.highlights(); }, 10);
		}
	},
	
	// We pass it clientHeight and clientWidth because it's much lighter than by getting them every position cycle
	build: function(node, group, clientHeight, clientWidth, offsetY) {
		// If these aren't set, we just assume the range is visible and should be always sighted, such as in FindAgain (F3) which scrolls to the search hit
		var current = clientHeight === undefined && clientWidth === undefined;
		
		// Keep our limit
		if(!current && this.allSights.size >= Prefs.sightsLimit) { return group; }
		
		var dimensions = node.getClientRects()[0];
		if(!dimensions) { return group; } // Something's wrong here, maybe the range has changed in the meantime
		
		offsetY = offsetY || 0;
		var query = (!isPDFJS) ? findQuery : PDFJS.findController.state.query;
		var editableNode = !isPDFJS && Finder._getEditableNode(node.startContainer);
		var editableRect = editableNode && editableNode.getClientRects()[0];
		var toOwn = (!isPDFJS) ? document : PDFJS.unWrap.document;
		var doc = (!isPDFJS) ? node.startContainer.ownerDocument : node.ownerDocument;
		var sameDoc = (doc == toOwn);
		
		// We need to account for frames positions as well, as the ranges values are relative to them
		var xMod = 0;
		var yMod = 0;
		
		var ownDoc = doc;
		while(ownDoc != toOwn) {
			try {
				// We need to check for this inside each frame because the xMod and yMod values change with each
				if(editableNode && editableNode.ownerDocument == ownDoc) {
					if(dimensions.bottom +yMod < editableRect.top
					|| dimensions.top +yMod > editableRect.bottom
					|| dimensions.right +xMod < editableRect.left
					|| dimensions.left +xMod > editableRect.right) {
						delete node.sights;
						return group;
					}
				}
				
				var frame = ownDoc.defaultView.frameElement;
				if(clientHeight && clientWidth) {
					if(dimensions.bottom +yMod < 0
					|| dimensions.top +yMod > frame.clientHeight
					|| dimensions.right +xMod < 0
					|| dimensions.left +xMod > frame.clientWidth) {
						delete node.sights;
						return group;
					}
				}
				
				var frameElementRect = frame.getClientRects()[0];
				xMod += frameElementRect.left;
				yMod += frameElementRect.top;
				
				ownDoc = ownDoc.defaultView.parent.document;
			}
			// failsafe
			catch(ex) {
				delete node.sights;
				return group;
			}
		}
		
		if(editableNode && editableNode.ownerDocument == toOwn) {
			if(dimensions.bottom +yMod < editableRect.top
			|| dimensions.top +yMod > editableRect.bottom
			|| dimensions.right +xMod < editableRect.left
			|| dimensions.left +xMod > editableRect.right) {
				delete node.sights;
				return group;
			}
		}
		
		var limitTop = dimensions.top +yMod;
		var limitLeft = dimensions.left +xMod;
		
		if(clientHeight && clientWidth) {
			var limitBottom = dimensions.bottom +yMod;
			var limitRight = dimensions.right +xMod;
			if(limitBottom < 0 +offsetY
			|| limitTop > clientHeight +offsetY
			|| limitRight < 0
			|| limitLeft > clientWidth) {
				delete node.sights;
				return group;
			}
		}
		
		// On scrolling, only show sights on those that haven't been shown already
		if(node.sights && node.sights == query) { return group; }
		node.sights = query;
		
		var range = {
			node: node,
			current: current,
			centerX: limitLeft +(dimensions.width /2),
			centerY: limitTop +(dimensions.height /2)
		};
		
		// Bugfix: sights would not be properly placed when using any kind of zoom factor
		var fullZoom = docShell.contentViewer.fullZoom;
		range.centerX *= fullZoom;
		range.centerY *= fullZoom;
		
		// Don't add a sight if there's already one with the same coords
		for(let sight of this.allSights) {
			if(sight.centerX == range.centerX && sight.centerY == range.centerY) {
				return group;
			}
		}
		
		var scrolls = this.getPageScroll(doc, toOwn);
		range.scrollTop = scrolls.scrollTop;
		range.scrollLeft = scrolls.scrollLeft;
		
		if(!group) {
			group = new SightGroup({
				toOwn: toOwn,
				ownDoc: doc,
				current: current
			});
		}
		range.group = group.i;
		group.sights.add(range);
		this.allSights.add(range);
		
		// it's the chrome process that creates and shows the sights, content just manages them. so we have to send all the data over so they're properly placed
		var detail = {};
		for(let x in range) {
			detail[x] = range[x];
		}
		delete detail.node;
		message('Sights:Add', detail);
		
		return group;
	},
	
	getPageScroll: function(ownDoc, toOwn) {
		var scrollTop = getDocProperty(document, 'scrollTop');
		var scrollLeft = getDocProperty(document, 'scrollLeft');
			
		while(ownDoc != toOwn) {
			// If the text is inside a frame, we take into account its scrollTop and scrollLeft values as well
			scrollTop += getDocProperty(ownDoc, 'scrollTop');
			scrollLeft += getDocProperty(ownDoc, 'scrollLeft');
			
			ownDoc = ownDoc.defaultView.parent.document;
		}
		
		return { scrollTop: scrollTop, scrollLeft: scrollLeft };
	},
	
	remove: function(data) {
		var group = this.allGroups.get(data);
		if(group) {
			group.remove();
		}
	},
	
	current: function(e) {
		this.cancelCurrent();
		
		// For pdf in PDF.JS
		if(isPDFJS) {
			if(document.readyState != 'complete' && document.readyState != 'interactive') { return; }
			
			// no current match
			if(!PDFJS.findController || PDFJS.findController.selected.matchIdx == -1 || PDFJS.findController.selected.pageIdx == -1) { return; }
			
			// Let's get the right one
			var page = PDFJS.viewerApplication.pdfViewer.pages[PDFJS.findController.selected.pageIdx];
			if(!page.textLayer
			|| !page.textLayer.matches
			|| !page.textLayer.matches[PDFJS.findController.selected.matchIdx]) {
				Timers.init('currentSights', () => { this.current(); }, 10);
				return;
			}
			
			var sel = page.textLayer.textDivs[page.textLayer.matches[PDFJS.findController.selected.matchIdx].begin.divIdx].querySelectorAll('.highlight.selected');
			if(sel.length == 0) { return; }
			
			// make sure we place a sight on it, even if's already been sighted for the highlight
			delete sel[0].sights;
			
			this.build(sel[0]);
			return;
		}
		
		// Normal HTML files
		
		// no point in doing anything if not searched for anything
		if(!Finder.searchString) { return; }
		
		var sel = Finder.currentTextSelection;
		if(sel.rangeCount == 1) {
			var range = sel.getRangeAt(0);
			
			// Don't sight emptiness
			if(range.startContainer == range.endContainer && range.startOffset == range.endOffset) { return; }
			
			this.build(range);
		}
	},
	
	// Hide the current sights
	cancelCurrent: function() {
		for(let group of this.allGroups.values()) {
			if(group.current) {
				group.remove();
			}
		}
	},
	
	_pdfMatches: new Map(),
	
	highlights: function() {
		if(isPDFJS) {
			if(Finder.matchesPDF == 0 || !PDFJS.findController.state.query || !documentHighlighted) { return; }
			
			// We should wait until the visible pages have finished rendering
			var visible = PDFJS.viewerApplication.pdfViewer._getVisiblePages();
			var pages = visible.views;
			for(let page of pages) {
				if(!page.view.textLayer
				|| !page.view.textLayer.renderingDone
				|| page.view.renderingState < 3) {
					Timers.init('sightsHighlights', () => { this.highlights(); }, 10);
					return;
				}
			}
			
			var clientHeight = getDocProperty(PDFJS.unWrap.document, 'clientHeight', true);
			var clientWidth = getDocProperty(PDFJS.unWrap.document, 'clientWidth', true);
			var toolbarHeight = PDFJS.unWrap.document.querySelectorAll('div.toolbar')[0].clientHeight;
			
			var query = PDFJS.findController.state.query;
			var matches = PDFJS.findController.pageMatches;
			var group = null;
			
			for(let page of pages) {
				for(let mIdx in page.view.textLayer.matches) {
					var match = page.view.textLayer.matches[mIdx];
					var divs = page.view.textLayer.textDivs;
					if(divs.length <= match.begin.divIdx) { continue; } // This shouldn't happen
					
					var div = divs[match.begin.divIdx];
					var maxOffset = match.begin.offset;
					var offset = 0;
					var child = 0;
					while(offset <= maxOffset) {
						if(div.childNodes[child].localName == 'span') {
							if(offset == maxOffset) { break; }
							offset += div.childNodes[child].childNodes[0].length;
						} else {
							offset += div.childNodes[child].length;
						}
						child++;
					}
					if(offset > maxOffset) { continue; } // This shouldn't happen either
					
					// we can't rely on the divs having the .sights property later because these nodes are rebuilt constantly
					// so we need to filter already sighted matches outside of sights.build()
					if(this._pdfMatches.has(page.id) && this._pdfMatches.get(page.id).has(mIdx)) {
						div.childNodes[child].sights = query;
					}
					
					group = this.build(div.childNodes[child], group, clientHeight, clientWidth, toolbarHeight);
					
					// if this match was sighted... won't happen if it's out of view
					if(div.childNodes[child].sights) {
						if(!this._pdfMatches.has(page.id)) {
							this._pdfMatches.set(page.id, new Set());
						}
						if(!this._pdfMatches.get(page.id).has(mIdx)) {
							this._pdfMatches.get(page.id).add(mIdx);
						}
					}
					
					// matches that were scrolled away need to be removed from this array, otherwise they would never be re-highlighted on scrolling
					else if(this._pdfMatches.has(page.id) && this._pdfMatches.get(page.id).has(mIdx)) {
						this._pdfMatches.get(page.id).delete(mIdx);
					}
				}
			}
			
			for(let pIdx of this._pdfMatches.keys()) {
				// obviously if the page isn't visible then its matches aren't either
				if(pIdx < visible.first.id || pIdx > visible.last.id) {
					this._pdfMatches.delete(pIdx);
				}
			}
			
			Listeners.add(Scope, 'scroll', this, true);
			return;
		}
		
		// The grid is empty, so invisible, we don't need to do anything
		if(Finder._lastFindResult == Ci.nsITypeAheadFind.FIND_NOTFOUND
		|| !documentHighlighted
		|| !Finder.searchString
		|| !Finder._highlights) {
			return;
		}
		
		var clientHeight = getDocProperty(document, 'clientHeight', true);
		var clientWidth = getDocProperty(document, 'clientWidth', true);
		
		// We use one sights group for each doc at least
		for(let [mWin, mHighlights] of Finder._highlights.wins) {
			let group = null;
			for(let highlight of mHighlights) {
				group = this.build(highlight.range, group, clientHeight, clientWidth);
			}
		}
		
		Listeners.add(Scope, 'scroll', this, true);
	}
};

// creates a proper handler for communicating with the chrome process to manage a group of sights, even though each sight is created individually
this.SightGroup = function(group) {
	this.i = sights.nextGroup;
	this.sights = new Set();
	this.timer = null;
	
	for(let x in group) {
		this[x] = group[x];
	}
	
	sights.allGroups.set(this.i, this);
	sights.nextGroup++;
	
	Listeners.add(Scope, 'scroll', this, true);
};

this.SightGroup.prototype = {
	handleEvent: function(e) {
		if(this.timer) { return; }
		
		this.timer = aSync(() => {
			this.timer = null;
			
			var scrolls = sights.getPageScroll(this.ownDoc, this.toOwn);
			for(let sight of this.sights) {
				let xDelta = scrolls.scrollLeft -sight.scrollLeft;
				let yDelta = scrolls.scrollTop -sight.scrollTop;
				
				sight.scrollLeft = scrolls.scrollLeft;
				sight.scrollTop = scrolls.scrollTop;
				sight.centerX -= xDelta;
				sight.centerY -= yDelta;
			}
			
			message('Sights:Scroll', {
				group: this.i,
				scrollLeft: scrolls.scrollLeft,
				scrollTop: scrolls.scrollTop
			});
		}, 20);
	},
	
	remove: function() {
		Listeners.remove(Scope, 'scroll', this, true);
		if(this.timer) {
			this.timer.cancel();
		}
		
		var query = (!isPDFJS) ? findQuery : PDFJS.findController.state.query;
		
		for(let sight of this.sights) {
			if(sight.node.sights != query) {
				delete sight.node.sights;
			}
			sights.allSights.delete(sight);
		}
		
		sights.allGroups.delete(this.i);
		message('Sights:Remove', this.i);
	}
};

Modules.LOADMODULE = function() {
	Finder.buildHighlights.add('sights');
	Finder.addResultListener(sights);
	
	RemoteFinderListener.addMessage('Sights:Remove', data => {
		sights.remove(data);
	});
}

Modules.UNLOADMODULE = function() {
	Timers.cancel('sightsOnPDFState');
	Timers.cancel('sightsOnHighlightsOnPDFState');
	
	Listeners.remove(Scope, 'scroll', sights, true);
	
	RemoteFinderListener.removeMessage('Sights:Remove');
	
	Finder.buildHighlights.delete('sights');
	Finder.removeResultListener(sights);
};
