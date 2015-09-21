Modules.VERSION = '1.2.1';

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
		// +1 is for the ':' after objName
		let name = m.name.substr(objName.length +1);
		
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
		var hit = (data.hit > -1) ? this.hits.all.get(data.hit) : item.hits.get(item.firstHit);
		
		// at this point we're sure we will show a hit somewhere, even if it's just to show the current hit, so we can start focusing the browser
		message('FIT:FocusMe');
					
		if(isPDFJS) {
			// Don't do anything when the current selection is contained within the ranges of this item.
			// We don't want to keep re-selecting it.
			if(PDFJS.findController.selected.pageIdx > -1 && PDFJS.findController.selected.matchIdx > -1) {
				if(data.hit > -1) {
					if(hit.pIdx == PDFJS.findController.selected.pageIdx && hit.mIdx == PDFJS.findController.selected.matchIdx) {
						PDFJS.callOnPDFResults('find');
						return;
					}
				} else {
					for(let [ iI, iHit ] of item.hits) {
						if(iHit.pIdx == PDFJS.findController.selected.pageIdx && iHit.mIdx == PDFJS.findController.selected.matchIdx) {
							PDFJS.callOnPDFResults('find');
							return;
						}
					}
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
			if(data.hit > -1) {
				if(Finder.compareRanges(hit, selRange)) {
					this.reNotify();
					return;
				}
			} else {
				for(let [ iI, iHit ] of item.hits) {
					if(Finder.compareRanges(iHit, selRange)) {
						this.reNotify();
						return;
					}
				}
			}
		}
		
		if(Finder.searchString != data.query
		|| Finder._fastFind.caseSensitive != data.caseSensitive) {
			// selecting a hit from the FIT lists should highlight all the matches
			documentHighlighted = true;
			
			// Since we have to redo the search, might as well do it from the top
			message('FIT:Find', data);
		}
		
		// Then, we use fastFind until it finds our range.
		// This is the only way I found to also update the browser._fastFind object, manually setting the range in the controllers doesn't do this,
		// because of that, we often ended up with multiple selections on screen, and the cursor position wouldn't seem to update.
		Finder.findRange(data.query, hit, data.caseSensitive, data.findPrevious, this.hits.all.size);
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
		let lastEndContainer = null;
		let lastEndOffset = null;
		let lastDone = -1;
		
		for(let [ h, range ] of this.hits.all) {
			// this hit has probably been merged to a previous one
			if(h <= lastDone) { continue; }
			lastDone = h;
			
			let hits = new Map();
			hits.set(h, range);
			
			if(isPDF) {
				var partialString = this._replaceLineBreaks(PDFJS.findController.pageContents[range.pIdx].substr(range.offset, aWord.length));
				
				var doLastStart = range.offset +aWord.length;
				var doFirstLength = range.offset;
				
				var startContainer = range.pIdx;
				var startContainerText = PDFJS.findController.pageContents[range.pIdx];
				var endContainer = range.pIdx;
				var endContainerText = PDFJS.findController.pageContents[range.pIdx];
				
				var directionRTL = (document.documentElement.dir == 'rtl');
			} else {
				var partialString = this._replaceLineBreaks(range.toString());
				
				var doLastStart = range.endOffset;
				var doFirstLength = range.startOffset;
				
				var startContainer = range.startContainer;
				var startContainerText = startContainer.textContent;
				var endContainer = range.endContainer;
				var endContainerText = endContainer.textContent;
				
				let styleElement = range.startContainer;
				while(!styleElement.style && styleElement.parentNode) { styleElement = styleElement.parentNode; }
				var directionRTL = (getComputedStyle(styleElement).direction == 'rtl');
			}
			
			let item = new FITitem(aWord, directionRTL, h);
			item.append(partialString, h);
			
			var initialPoints = (doFirstLength != 0);
			var finalPoints = (doLastStart != endContainer.length);
			
			// Let's try to add whole words whenever possible
			if(doFirstLength > 0 && startContainerText[doFirstLength -1] != ' ') {
				var doFirstStart = startContainerText.lastIndexOf(' ', doFirstLength) +1;
				
				var fillString = this._replaceLineBreaks(startContainerText.substr(doFirstStart, doFirstLength -doFirstStart));
				
				doFirstLength = doFirstStart;
				if(doFirstStart == 0) {
					initialPoints = false;
				}
				
				item.append(fillString, true);
			}
			if(doLastStart +1 < endContainerText.length && endContainerText[doLastStart] != ' ') {
				if(!this.hits.all.has(h +1)
				|| ((!isPDF) ? this.hits.all.get(h +1).startContainer != endContainer : this.hits.all.get(h +1).pIdx != range.pIdx)
				|| 	(endContainerText.includes(' ', doLastStart)
					&& this.hits.all.get(h +1)[(!isPDF) ? 'startOffset' : 'offset'] > endContainerText.indexOf(' ', doLastStart))) {
						var doLastLength = endContainerText.indexOf(' ', doLastStart);
						if(doLastLength == -1) { doLastLength = endContainerText.length; }
						doLastLength -= doLastStart;
						
						var fillString = this._replaceLineBreaks(endContainerText.substr(doLastStart, doLastLength));
						
						doLastStart += doLastLength;
						if(doLastStart == endContainerText.length) {
							finalPoints = false;
						}
						
						item.append(fillString);
				}
			}
			
			// We attempt to merge very close occurences into the same item whenever possible
			var lastRange = range;
			var hh = h+1;
			if(item.str.length < this.kHitsLength) {
				while(this.hits.all.has(hh) && this.hits.all.get(hh)[(isPDF) ? 'pIdx' : 'startContainer'] == endContainer) {
					var nextRange = this.hits.all.get(hh);
					if(isPDF) {
						var nextString = this._replaceLineBreaks(PDFJS.findController.pageContents[nextRange.pIdx].substr(nextRange.offset, aWord.length));
						var nextLastStart = nextRange.offset +aWord.length;
						var nextFirstLength = nextRange.offset;
						var nextStartContainer = nextRange.pIdx;
						var nextStartContainerText = PDFJS.findController.pageContents[nextRange.pIdx];
						var nextEndContainer = nextRange.pIdx;
						var nextEndContainerText = PDFJS.findController.pageContents[nextRange.pIdx];
					} else {
						var nextString = this._replaceLineBreaks(nextRange.toString());
						var nextLastStart = nextRange.endOffset;
						var nextFirstLength = nextRange.startOffset;
						var nextStartContainer = nextRange.startContainer;
						var nextStartContainerText = nextStartContainer.textContent;
						var nextEndContainer = nextRange.endContainer;
						var nextEndContainerText = nextEndContainer.textContent;
					}
					
					var fillNext = '';
					if(nextLastStart < nextEndContainerText.length
					&& nextEndContainerText[nextLastStart] != ' ') {
						if(!this.hits.all.has(hh +1)
						|| ((!isPDF) ? this.hits.all.get(hh +1).startContainer != nextRange.endContainer : this.hits.all.get(hh +1).pIdx != nextRange.pIdx)
						|| 	(nextEndContainerText.includes(' ', nextLastStart)
							&& this.hits.all.get(hh +1)[(!isPDF) ? 'startOffset' : 'offset'] > nextEndContainerText.indexOf(' ', nextLastStart))) {
								var fillNextLength = nextEndContainerText.indexOf(' ', nextLastStart);
								if(fillNextLength == -1) { fillNextLength = nextEndContainerText.length; }
								fillNextLength -= nextLastStart;
								
								fillNext = this._replaceLineBreaks(nextEndContainerText.substr(nextLastStart, fillNextLength));
						}
					}
					
					var inBetweenStart = doLastStart;
					var inBetweenLength = nextFirstLength -inBetweenStart;
					var inBetween = this._replaceLineBreaks(nextStartContainerText.substr(inBetweenStart, inBetweenLength));
					if(item.str.length +nextString.length +fillNext.length +inBetween.length <= this.kHitsLength) {
						doLastStart = nextLastStart +fillNext.length;
						if(doLastStart == nextEndContainerText.length) {
							finalPoints = false;
						}
						
						item.append(inBetween);
						item.append(nextString, hh);
						item.append(fillNext);
						
						hits.set(hh, nextRange);
						lastRange = nextRange;
						lastDone = hh;
						endNumber = hh +1;
						h = hh;
						hh++;
						continue;
					}
					break;
				}
			}
			
			var doLast = false;
			var didOne = true;
			
			var lastEndContainerText = (isPDF) ? PDFJS.findController.pageContents[lastRange.pIdx] : lastRange.endContainer.textContent;
			
			// Now we complete with some before and after text strings
			while(item.str.length < this.kHitsLength) {
				doLast = !doLast;
				
				if(doLast) {
					if(!finalPoints) {
						if(!didOne) { break; }
						didOne = false;
						continue;
					}
					
					var doLastLength = lastEndContainerText.indexOf(' ', doLastStart +1);
					if(doLastLength == -1) { doLastLength = lastEndContainerText.length; }
					doLastLength -= doLastStart;
					var fillString = this._replaceLineBreaks(lastEndContainerText.substr(doLastStart, doLastLength));
				} else {
					if(!initialPoints) {
						if(!didOne) { break; }
						didOne = false;
						continue;
					}
					
					var doFirstStart = (doFirstLength < 2) ? 0 : startContainerText.lastIndexOf(' ', Math.max(doFirstLength -2, 0)) +1;
					doFirstLength -= doFirstStart;
					
					// Don't use text that has been used before
					if(startContainer == lastEndContainer && doFirstStart < lastEndOffset) {
						if(!didOne) { break; }
						didOne = false;
						continue;
					}
					
					var fillString = this._replaceLineBreaks(startContainerText.substr(doFirstStart, doFirstLength));
				}
				
				if(fillString.length > 0 && item.str.length +fillString.length < this.kHitsLength) {
					if(doLast) {
						doLastStart += doLastLength;
						if(doLastStart == lastEndContainerText.length) {
							finalPoints = false;
						}
						
						// Trimming those extra white spaces
						if(trim(fillString)) {
							item.append(fillString);
						}
					} else {
						doFirstLength = doFirstStart;
						if(doFirstStart == 0) {
							initialPoints = false;
						}
						
						// Trimming those extra white spaces
						if(trim(fillString)) {
							item.append(fillString, true);
						}
					}
					
					didOne = true;
				}
				else {
					if(!didOne) { break; }
					didOne = false;
				}
			}
			
			lastEndContainer = (isPDF) ? lastRange.pIdx : lastRange.endContainer;
			lastEndOffset = doLastStart;
			
			if(initialPoints) {
				item.append('... ', true);
			}
			if(finalPoints) {
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
