// VERSION 1.2.4

this.FIT = {
	// this keeps a list of all hits in a page, mapped to an id that can be used to keep things sync'ed up with the chrome process
	hits: {
		wins: new Map(),
		all: new Map(),
		items: new Map() // hit items sent to chrome for this tab
	},

	// if the page's text hasn't changed, we probably don't need to update the hits (certain AJAX ops could trigger a useless re-process for instance)
	_lastText: '',
	_lastQuery: '',
	_lastCaseSensitive: false,
	_lastMatch: -1,

	_holdingHit: null,

	kCountIterationMax: 100,
	kHitsLength: 150, // Length of preview text from preview items in find in tabs box

	// handlers and listeners

	MESSAGES: [
		'FIT:SelectHit',
		'FIT:HoverInGrid',
		'FIT:ClearHoverGrid',
		'FIT:FollowCurrentHit',
		'FIT:ProcessText',
		'FIT:ResetHits'
	],

	receiveMessage: function(m) {
		let name = messageName(m);

		switch(name) {
			case 'FIT:SelectHit':
				this.selectHit(m.data);
				break;

			case 'FIT:HoverInGrid':
				this.hoverGrid(m.data);
				break;

			case 'FIT:ClearHoverGrid':
				this.clearHoverGrid(m.data);
				break;

			case 'FIT:FollowCurrentHit':
				this.followCurrentHit();
				break;

			case 'FIT:ProcessText':
				// we need to tell the main script when the process finishes
				new Promise((resolve, reject) => {
					this.processText(m.data, resolve);
				}).then(() => {
					message('FIT:FinishedProcessText');
				});
				break;

			case 'FIT:ResetHits':
				this.resetHits(true);
				break;
		}
	},

	onPDFResult: function(aAction) {
		if(aAction == 'find' && this._holdingHit) {
			PDFJS.forceMatch(this._holdingHit);
			this._holdingHit = null;
		}
	},

	handleEvent: function(e) {
		if(e.target == content) {
			message('FIT:Update');
		}
	},

	onDOMContentLoaded: function(e) {
		// this is the content document of the loaded page.
		var doc = e.originalTarget;
		if(doc instanceof content.HTMLDocument) {
			this.resetHits();
			message('FIT:Update');
		}
	},

	onLocationChange: function(aWebProgress, aRequest, aLocation) {
		// Frames don't need to trigger this
		if(aWebProgress.isTopLevel) {
			this.resetHits();
			message('FIT:Update');
		}
	},

	onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
		if(!aWebProgress.isLoadingDocument && aWebProgress.isTopLevel) {
			this.resetHits();
			message('FIT:Update');
		}
	},

	// implementation

	docUnloaded: function() {
		if(document.readyState == 'uninitialized'
		|| (document.baseURI == 'chrome://browser/content/browser.xul' && document.URL == 'about:blank')) {
			return true;
		}
		return false;
	},

	reNotify: function() {
		Finder._notify(Finder.searchString, Finder._lastFindResult, false, Finder._previousLink);
	},

	selectHit: function(data) {
		// not sure if this could happen, but there's a lot of async going on so...
		if(!this.hits || this.hits.all.size == 0) { return; }

		var item = this.hits.items.get(data.item);
		var hit = this.hits.all.get(data.hit);

		// at this point we're sure we will show a hit somewhere, even if it's just to show the current hit, so we can start focusing the browser
		message('FIT:FocusMe');

		if(isPDFJS) {
			// Don't do anything when the current selection is contained within the ranges of this item.
			// We don't want to keep re-selecting it.
			if(PDFJS.findController.selected.pageIdx > -1 && PDFJS.findController.selected.matchIdx > -1) {
				if(hit.pIdx == PDFJS.findController.selected.pageIdx && hit.mIdx == PDFJS.findController.selected.matchIdx) {
					PDFJS.callOnPDFResults('find');
					return;
				}
			}

			// Make sure we trigger a find event, so the pdf document renders our matches
			if(!PDFJS.findController.state
			|| PDFJS.findController.state.query != data.query
			|| PDFJS.findController.state.caseSensitive != data.caseSensitive) {
				this._holdingHit = hit;

				// selecting a hit from the FIT lists should highlight all the matches
				documentHighlighted = true;

				// Since we have to redo the search, might as well do it from the top
				message('FIT:Find', data);
			}
			else {
				PDFJS.forceMatch(hit);
				PDFJS.callOnPDFResults('find');
				this.followCurrentHit();
			}

			return;
		}

		var sel = Finder.currentTextSelection;
		if(sel.rangeCount == 1) {
			var selRange = sel.getRangeAt(0);
			// Don't do anything when the current selection is contained within the ranges of this item.
			// We don't want to keep re-selecting it.
			if(Finder.compareRanges(hit, selRange)) {
				this.reNotify();
				return;
			}
		}

		if(Finder.searchString != data.query
		|| Finder._fastFind.caseSensitive != data.caseSensitive) {
			// selecting a hit from the FIT lists should highlight all the matches
			documentHighlighted = true;

			// Since we have to redo the search, might as well do it from the top
			message('FIT:Find', data);
		}

		// Which will be faster, search forward or backwards? We do an approximation based on the last selected match
		var lastI = this._lastMatch;
		var curI = data.hit;
		var allI = this.hits.all.size;
		if(lastI < curI) {
			var aFindPrevious = ((allI -curI +lastI) < (curI -lastI));
		} else {
			var aFindPrevious = ((lastI -curI) < (allI -lastI +curI));
		}
		this._lastMatch = data.hit;

		// Then, we use fastFind until it finds our range.
		// This is the only way I found to also update the browser._fastFind object, manually setting the range in the controllers doesn't do this,
		// because of that, we often ended up with multiple selections on screen, and the cursor position wouldn't seem to update.
		Finder.findRange(data.query, hit, data.caseSensitive, aFindPrevious, this.hits.all.size);
	},

	// when mousing over a hit, we can show which hit it is in the highlights grid

	shouldHoverGrid: function(query) {
		return (Prefs.useGrid && documentHighlighted && !documentReHighlight && highlightedWord == query);
	},

	_hovered: null,
	hoverGrid: function(data) {
		// We can't do this unless we're highlighting the same word in this tab
		if(!this.shouldHoverGrid(data.query)) { return; }

		// no point if it's already hovered
		if(Timers.cancel('clearHoverGrid') && this._hovered == this.hits.all.get(data.hit)) { return; }

		Timers.init('hoverGrid', () => {
			grids.clearHoverRows();
			this._hovered = this.hits.all.get(data.hit);
			grids.hoverHit(this._hovered);
		}, 50);
	},

	clearHoverGrid: function(data) {
		// We can't do this unless we're highlighting the same word in this tab
		if(!this.shouldHoverGrid(data.query)) { return; }

		// no point if it's already not hovered
		if(Timers.cancel('hoverGrid') && !this._hovered) { return; }

		Timers.init('clearHoverGrid', () => {
			this._hovered = null;
			grids.clearHoverRows();
		}, 50);
	},

	resetHits: function(fromChrome) {
		this.hits = {
			wins: new Map(),
			all: new Map(),
			items: new Map()
		};
		this._lastText = '';
		this._lastMatch = -1;

		if(!fromChrome) {
			message('FIT:ResetTabHits');
		}
	},

	// When the user finds for text or uses the find again button, select the corresponding item in the hits list
	followCurrentHit: function() {
		if(isPDFJS) {
			if(!PDFJS.findController || PDFJS.findController.selected.matchIdx == -1 || PDFJS.findController.selected.pageIdx == -1) { return; }

			for(let [ idx, hit ] of this.hits.all) {
				if(hit.pIdx == PDFJS.findController.selected.pageIdx
				&& hit.mIdx == PDFJS.findController.selected.matchIdx) {
					this._lastMatch = idx;
					message('FIT:CurrentHit', idx);
					break;
				}
			}

			return;
		}

		let sel = Finder.currentTextSelection;
		if(sel.rangeCount > 0) {
			let selRange = sel.getRangeAt(0);
			let win = Finder._fastFind.currentWindow;
			let hits = (win) ? this.hits.wins.get(win) : this.hits.all;
			if(!hits) { return; }

			for(let [ idx, hit ] of hits) {
				if(Finder.compareRanges(selRange, hit)) {
					this._lastMatch = idx;
					message('FIT:CurrentHit', idx);
					break;
				}
			}
		}
	},

	_abortProcess: null,
	_processSleep: function(delay, data) {
		return new Promise((resolve, reject) => {
			this._abortProcess = () => {
				this._abortProcess = null;
				reject();
			};

			aSync(() => {
				if(data.query == this._lastQuery && data.caseSensitive == this._lastCaseSensitive) {
					resolve();
				} else {
					reject();
				}
			}, delay);
		});
	},

	processText: Task.async(function* (data, resolve) {
		if(this._abortProcess) {
			this._abortProcess();
		}

		// make sure we cancel any ongoing (waiting) operation
		Timers.cancel('FITprocessText');

		if(isPDFJS) {
			// If the document has just loaded, this might take a while to populate, it would throw an error and stop working altogether
			if(!PDFJS.viewerApplication
			|| !PDFJS.viewerApplication.pdfDocument
			|| (PDFJS.viewerApplication.loadingBar.percent > 0 && PDFJS.viewerApplication.loadingBar.percent < 100)) {
				this.resetHits();
				Timers.init('FITprocessText', () => { this.processText(data, resolve); }, 250);
				return;
			}

			PDFJS.findController.extractText();
			// only continue when all pages' text is extracted
			if(PDFJS.findController.pageContents.length != PDFJS.viewerApplication.pagesCount) {
				this.resetHits();

				var label = Strings.get('findInTabs', 'loadingPDFJS', [
					['$partial$', PDFJS.findController.pageContents.length],
					['$total$', PDFJS.viewerApplication.pdfViewer.pagesCount]
				]);
				message('FIT:UnloadedTab', { label: label, doNothing: true });

				Promise.all(PDFJS.findController.extractTextPromises).then(() => {
					this.processText(data, resolve);
				});

				// still call this once in a while, even if it's not finished, so that we can see the extraction status
				Timers.init('FITprocessText', () => { this.processText(data, resolve); }, 250);
				return;
			}
		}

		// If it's not completely loaded yet, don't search it, the other handlers should call it when it finishes loading
		// Some PDF.JS instances use readyState interactive instead of complete. For example: http://www.selab.isti.cnr.it/ws-mate/example.pdf (this is a very buggy example btw)
		if(document.readyState != 'complete'
		&& !this.docUnloaded()
		&& (!isPDFJS || document.readyState != 'interactive')) {
			this.resetHits();
			resolve();
			return;
		}

		// If the new content isn't possible to be searched through, remove this entry from the lists
		if(!isPDFJS
		&& (!document || !(document instanceof content.HTMLDocument) || !document.body)) {
			this.resetHits();
			message('FIT:RemoveTab');
			resolve();
			return;
		}

		// If tab is not loaded, add an item telling that to user with the choice to load it
		if(this.docUnloaded()) {
			this.resetHits();
			message('FIT:UnloadedTab', { isUnloadedTab: true });
			resolve();
			return;
		}

		// we need to wait until we have the document's text contents
		let textContent = '';
		yield new Promise((resolve, reject) => {
			this._abortProcess = () => {
				this._abortProcess = null;
				reject();
			};
			Finder.innerTextDeep.then((text) => {
				resolve();
				textContent = text;
			});
		});

		// no point in reprocessing if the document remains with the same text
		if(this._lastText
		&& this._lastText == textContent
		&& this._lastQuery == data.query
		&& this._lastCaseSensitive == data.caseSensitive) {
			resolve();
			return;
		}

		this._lastQuery = data.query;
		this._lastCaseSensitive = data.caseSensitive;
		this.resetHits();

		yield this._getAllHits(data.query, data.caseSensitive);

		message('FIT:CountResult', {
			hits: this.hits.all.size,
			query: data.query
		});

		yield this._segment(data.query, data.caseSensitive);

		this._lastText = textContent;
		resolve();
	}),

	_getAllHits: Task.async(function* (aWord, aCaseSensitive, aWindow) {
		let win = aWindow || Finder.getWindow;

		// for both pdfjs and html pages, the distinction is made inside
		yield this._hitIterator(aWord, aCaseSensitive, win);

		if(!isPDFJS) {
			// frames
			for(let i = 0; win.frames && i < win.frames.length; i++) {
				yield this._hitIterator(aWord, aCaseSensitive, win.frames[i]);
			}
		}
	}),

	_hitIterator: Task.async(function* (aWord, aCaseSensitive, aWindow) {
		let iterator = (isPDFJS) ? 'pdf' : 'find';
		let hits = new Map();
		let first = null;
		let count = 0;

		for(let hit of this['_'+iterator+'Iterator'](aWord, aCaseSensitive, aWindow)) {
			if(first === null) {
				first = this.hits.all.size;
			}

			var mIdx = this.hits.all.size;
			hits.set(mIdx, hit);
			this.hits.all.set(mIdx, hit);

			// sleep for a little bit, so the UI doesn't lock up in the pages with tons of matches
			if(++count >= this.kCountIterationMax) {
				count = 0;
				yield this._processSleep(0, {
					query: aWord,
					caseSensitive: aCaseSensitive
				});
			}
		}

		if(hits.size > 0) {
			this.hits.wins.set(aWindow, hits);
		}
	}),

	_pdfIterator: function* (aWord, aCaseSensitive) {
		let pages = PDFJS.findController.pageContents;
		let query = (!aCaseSensitive) ? aWord.toLowerCase() : aWord;

		for(let pIdx = 0; pIdx < pages.length; pIdx++) {
			let mIdx = 0;
			let offset = -query.length;
			let textContent = (!aCaseSensitive) ? pages[pIdx].toLowerCase() : pages[pIdx];
			while(true) {
				offset = textContent.indexOf(query, offset +query.length);
				if(offset === -1) {
					break;
				}
				yield { pIdx: pIdx, mIdx: mIdx, offset: offset };
				mIdx++;
			}
		}
	},

	_findIterator: function* (aWord, aCaseSensitive, aWindow) {
		let doc = aWindow.document;
		let body = (doc instanceof Ci.nsIDOMHTMLDocument && doc.body) ? doc.body : doc.documentElement;
		if(!body) { return; }

		let searchRange = doc.createRange();
		searchRange.selectNodeContents(body);

		let startPt = searchRange.cloneRange();
		startPt.collapse(true);

		let endPt = searchRange.cloneRange();
		endPt.collapse(false);

		let retRange = null;
		let finder = new rangeFinder(aWord, aCaseSensitive);

		while((retRange = finder.Find(searchRange, startPt, endPt))) {
			yield retRange;
			startPt = retRange.cloneRange();
			startPt.collapse(false);
		}
	},

	// This segments the text around the matches to construct the richlistitems for the hits list (in chrome)
	_segment: Task.async(function* (aWord, aCaseSensitive) {
		let count = 0;

		let isPDF = isPDFJS;
		let lastLine = null;
		let lastLineText = null;
		let lastDone = -1;

		for(let [ h, range ] of this.hits.all) {
			// this hit has probably been merged to a previous one
			if(h <= lastDone) { continue; }
			lastDone = h;

			let hits = new Map();
			hits.set(h, range);

			let rangeText;
			let startLine;
			let startLineText;
			let endLine;
			let endLineText;
			let directionRTL;
			if(isPDF) {
				if(lastLine != range.pIdx) {
					lastLine = range.pIdx;
					lastLineText = PDFJS.findController.pageContents[lastLine];
				}

				rangeText = this._replaceLineBreaks(lastLineText.substr(range.offset, aWord.length));

				startLine = range.offset;
				startLineText = this._replaceLineBreaks(lastLineText.substring(0, startLine));

				endLine = range.offset +aWord.length;
				endLineText = this._replaceLineBreaks(lastLineText.substring(endLine));

				directionRTL = (document.documentElement.dir == 'rtl');
			} else {
				if(!this._withinRange(range, lastLine)) {
					lastLine = this._buildLineRange(range);
					lastLineText = this._replaceLineBreaks(lastLine.toString());
				}

				rangeText = this._replaceLineBreaks(range.toString());

				startLine = lastLine.cloneRange();
				startLine.setEnd(range.startContainer, range.startOffset);
				startLineText = this._replaceLineBreaks(startLine.toString());

				endLine = lastLine.cloneRange();
				endLine.setStart(range.endContainer, range.endOffset);
				endLineText = this._replaceLineBreaks(endLine.toString());

				try {
					let styleElement = lastLine.commonAncestorContainer;
					while(!styleElement.style && styleElement.parentNode) { styleElement = styleElement.parentNode; }
					directionRTL = (getComputedStyle(styleElement).direction == 'rtl');
				}
				catch(ex) {
					directionRTL = false;
				}
			}

			let item = new FITitem(aWord, directionRTL, h);
			item.append(rangeText, h);

			// Let's try to add whole words whenever possible, for now let's only do the beginning of the word,
			// the rest (end) of the word will be unnecessary if we merge more matches into this item.
			if(startLineText.length > 0 && startLineText[startLineText.length -1] != ' ') {
				let spaceI = Math.max(0, startLineText.lastIndexOf(' ', startLineText.length -2));
				let fillString = startLineText.substring(spaceI);

				item.append(fillString, true);
				startLineText = startLineText.substring(0, spaceI);
			}

			// We attempt to merge very close occurences into the same item whenever possible
			let lastRange = range;
			if(item.str.length < this.kHitsLength) {
				let hh = h+1;
				let nextRange = this.hits.all.get(hh);

				while(nextRange && ((isPDF) ? nextRange.pIdx == lastLine : this._withinRange(nextRange, lastLine))) {
					let nextStartLine;
					let nextStartLineText;
					if(isPDF) {
						nextStartLine = nextRange.offset
						nextStartLineText = this._replaceLineBreaks(lastLineText.substring(lastRange.offset +aWord.length, nextStartLine));
					} else {
						nextStartLine = lastLine.cloneRange();
						nextStartLine.setStart(lastRange.endContainer, lastRange.endOffset);
						nextStartLine.setEnd(nextRange.startContainer, nextRange.startOffset);
						nextStartLineText = this._replaceLineBreaks(nextStartLine.toString());
					}

					// we estimate the size of the next match to be the same of the previous match
					if(item.str.length +rangeText.length +nextStartLineText.length <= this.kHitsLength) {
						let nextRangeText;
						if(isPDF) {
							nextRangeText = this._replaceLineBreaks(lastLineText.substr(nextRange.offset, aWord.length));

							endLine = nextRange.offset +aWord.length;
							endLineText = this._replaceLineBreaks(lastLineText.substring(endLine));
						} else {
							nextRangeText = this._replaceLineBreaks(nextRange.toString());

							endLine.setStart(nextRange.endContainer, nextRange.endOffset);
							endLineText = this._replaceLineBreaks(endLine.toString());
						}

						item.append(nextStartLineText);
						item.append(nextRangeText, hh);

						hits.set(hh, nextRange);
						lastRange = nextRange;
						lastDone = hh;
						endNumber = hh +1;

						h = hh;
						hh++;
						nextRange = this.hits.all.get(hh);

						continue;
					}
					break;
				}
			}

			// Now we complete with some before and after text strings,
			// make sure we complete the rest of the last word, since we haven't yet, even if it goes beyond the char limit.
			let forceWordEnd = endLineText.length && endLineText[0] != ' ';
			let doBefore = true;
			let didOne = true;
			while(item.str.length < this.kHitsLength || forceWordEnd) {
				doBefore = !doBefore;

				let fillString = '';
				if(!doBefore) {
					if(!endLineText.length) {
						if(!didOne) { break; }
						didOne = false;
						continue;
					}

					let spaceI = endLineText.indexOf(' ', 1);
					if(spaceI < 0) {
						spaceI = endLineText.length;
					}

					fillString = endLineText.substring(0, spaceI);
					endLineText = endLineText.substring(spaceI);
				} else {
					if(!startLineText.length) {
						if(!didOne) { break; }
						didOne = false;
						continue;
					}

					let spaceI = Math.max(0, startLineText.lastIndexOf(' ', startLineText.length -2));

					fillString = startLineText.substring(spaceI);
					startLineText = startLineText.substring(0, spaceI);
				}

				if(fillString.length && (item.str.length +fillString.length < this.kHitsLength || forceWordEnd)) {
					// Trimming those extra white spaces
					if(trim(fillString)) {
						item.append(fillString, doBefore);
					}

					didOne = true;
				}
				else {
					if(!didOne) { break; }
					didOne = false;
				}

				forceWordEnd = false;
			}

			if(startLineText.length) {
				item.append('... ', true);
			}
			if(endLineText.length) {
				item.append(' ...');
			}

			item.finish();

			this.hits.items.set(this.hits.items.size, {
				hits: hits,
				firstHit: h
			});

			// sleep for a little bit, so the UI doesn't lock up in the pages with tons of matches
			if(++count >= this.kCountIterationMax) {
				count = 0;
				yield this._processSleep(0, {
					query: aWord,
					caseSensitive: aCaseSensitive
				});
			}
		}
	}),

	// Replace all linebreaks with white spaces
	_replaceLineBreaks: function(str) {
		return str.replace(/(\r\n|\n|\r)/gm, " ");
	},

	// list of inline nodes that don't create their own content blocks or new lines
	_inlineNodes: /^(a|abbr|acronym|b|bdi|bdo|big|cite|code|del|dfn|em|font|i|ins|kbd|mark|q|rt|ruby|s|samp|small|span|strike|strong|sub|sup|time|tt|u|var|wbr)$/,

	_isNodeInline: function(aNode) {
		return aNode && (aNode.nodeType == aNode.TEXT_NODE || (aNode.localName && this._inlineNodes.test(aNode.localName)));
	},

	// returns the farthest sibling and position in the DOM tree that belongs to the whitelisted nodes list above
	_findEdge: function(aNode, aBackward) {
		if(!this._isNodeInline(aNode)) {
			return this._getEdgeOffset(aNode, aBackward);
		}

		if(!aBackward) {
			var next = 'nextSibling';
			var edge = 'firstChild';
		} else {
			var next = 'previousSibling';
			var edge = 'lastChild';
		}

		let sibling = aNode;
		do {
			while(!sibling[next]) {
				let parent = sibling.parentNode;
				if(!parent || parent == document.body || parent == document.documentElement) {
					return this._getEdgeOffset(sibling, aBackward);
				}

				sibling = parent;
				if(!this._isNodeInline(sibling)) {
					return this._getEdgeOffset(sibling, aBackward);
				}
			}

			if(!this._isNodeInline(sibling[next])) {
				return this._getEdgeOffset(sibling, aBackward);
			}

			sibling = sibling[next];
			while(sibling.nodeType == sibling.ELEMENT_NODE) {
				if(!this._isNodeInline(sibling[edge])) {
					return this._getEdgeOffset(sibling, !aBackward);
				}
				sibling = sibling[edge];
			}
		}
		while(this._isNodeInline(sibling));

		return this._getEdgeOffset(sibling, aBackward);
	},

	_getEdgeOffset: function(aNode, aBackward) {
		if(aBackward) {
			return {
				node: aNode,
				offset: 0
			};
		}

		return {
			node: aNode,
			offset: (aNode.nodeType == aNode.TEXT_NODE) ? aNode.textContent.length : aNode.childNodes.length
		};
	},

	// walks the adjacent nodes of aRange to get a bounding range containing all the nodes and their contents that won't create content blocks,
	// that is, text that should be on the same line
	_buildLineRange: function(aRange) {
		let line = aRange.cloneRange();

		let start = this._findEdge(line.startContainer, true);
		line.setStart(start.node, start.offset);

		let end = this._findEdge(line.endContainer, false);
		line.setEnd(end.node, end.offset);

		return line;
	},

	// returns whether a range can be found within another range
	_withinRange: function(aRange, bRange) {
		if(!(aRange instanceof content.Range) || !(bRange instanceof content.Range)) {
			return false;
		}

		// obviously if the ranges don't belong to the same document, they can't be the same range
		try {
			let aDoc = aRange.commonAncestorContainer;
			let bDoc = bRange.commonAncestorContainer;
			if(aDoc.ownerDocument) {
				aDoc = aDoc.ownerDocument;
			}
			if(bDoc.ownerDocument) {
				bDoc = bDoc.ownerDocument;
			}
			if(aDoc != bDoc) { return false; }
		}
		catch(ex) {
			// if something goes wrong here, we assume the ranges aren't comparable,
			// but still report it to the console, this should be rare though
			Cu.reportError(ex);
			return false;
		}

		return aRange.compareBoundaryPoints(aRange.START_TO_START, bRange) > -1 && aRange.compareBoundaryPoints(aRange.END_TO_END, bRange) < 1;
	},

	QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
};

this.FITitem = function(aWord, directionRTL, firstHit) {
	this.word = aWord;
	this.directionRTL = directionRTL;
	this.firstHit = firstHit;

	this.list = [];
	this.str = '';
	this.initNumber = firstHit +1;
	this.endNumber = firstHit +1;
};
this.FITitem.prototype = {
	// text -	(str) to append to the item
	// param -	(bool) true: text will be appended to the beginning of the string;
	// 		(int) text will be applied as a match referencing to the index provided, always appended at the end of the item;
	//		any other value will append the text at the end of the item, not highlighted.
	append: function(text, param) {
		let before = false;
		let highlight = null;

		if(typeof(param) == 'number') {
			highlight = param;
			this.endNumber = highlight +1;
		}
		else if(param === true) {
			before = true;
		}

		let toAdd = {
			text: text,
			highlight: highlight
		};

		if(before) {
			this.str = text +this.str;

			if(this.list.length && this.list[0].highlight === highlight) {
				this.list[0].text = text +this.list[0].text;
			} else {
				this.list.unshift(toAdd);
			}
		}
		else {
			this.str += text;

			if(this.list.length && this.list[this.list.length-1].highlight === highlight) {
				this.list[this.list.length-1].text += text;
			} else {
				this.list.push(toAdd);
			}
		}
	},

	finish: function() {
		message('FIT:AddHit', {
			query: this.word,
			itemStrings: this.list,
			initNumber: this.initNumber,
			endNumber: this.endNumber,
			directionRTL: this.directionRTL,
			firstHit: this.firstHit
		});
	}
};

Modules.LOADMODULE = function() {
	// nothing here will work without these, they will work even without an initialized findbar
	Modules.load('content/gFindBar');
	Modules.load('content/mFinder');
	Modules.load('content/PDFJS');
	Modules.load('content/highlights');

	Listeners.add(Scope, 'focus', FIT, true);
	WebProgress.add(FIT, Ci.nsIWebProgress.NOTIFY_ALL);
	DOMContentLoaded.add(FIT);
	Finder.addResultListener(FIT);

	for(let msg of FIT.MESSAGES) {
		listen(msg, FIT);
	}
};

Modules.UNLOADMODULE = function() {
	for(let msg of FIT.MESSAGES) {
		unlisten(msg, FIT);
	}

	Listeners.remove(Scope, 'focus', FIT, true);
	WebProgress.remove(FIT, Ci.nsIWebProgress.NOTIFY_ALL);
	DOMContentLoaded.remove(FIT);

	// we could have loaded mFinder while initializing this module, in which case it will be disabled first
	if(self.Finder) {
		Finder.removeResultListener(FIT);
	}
};
