Modules.VERSION = '1.0.5';

this.counter = {
	redoing: false,
	current: 0,
	
	onPDFMatches: function() {
		this.fill();
	},
	
	onCleanUpHighlights: function() {
		this.clear();
	},
	
	onWillHighlight: function() {
		this.clear();
	},
	
	onHighlightFinished: function() {
		this.fill();
	},
	
	onFindResult: function() {
		if(document instanceof Ci.nsIDOMXMLDocument) {
			this.fill();
		}
	},
	
	onFindAgain: function() {
		this.fill();
	},
	
	clear: function() {
		this.current = 0;
	},
	
	result: function(v, held) {
		message('Counter:Result', {
			searchString: (isPDFJS) ? findQuery : Finder.searchString,
			result: v || '',
			heldStatus: held || false
		});
	},
	
	fill: function() {
		// Special routine for PDF.JS
		if(isPDFJS) {
			this.redoing = false;
			
			// I hope adding this doesn't break anything else.
			if(document.readyState != 'complete' && document.readyState != 'interactive') {
				this.result();
				return;
			}
			
			let selected = 0;
			if(PDFJS.findController.selected.pageIdx > -1 && PDFJS.findController.selected.matchIdx > -1) {
				let total = 0;
				for(let pIdx in PDFJS.findController.pageMatches) {
					if(PDFJS.findController.selected.pageIdx == pIdx) {
						selected = total +PDFJS.findController.selected.matchIdx +1;
						break;
					}
					total += PDFJS.findController.pageMatches[pIdx].length;
				}
			}
			
			let str = '';
			if(Finder.matchesPDF > 0) {
				if(selected > 0) {
					str = Strings.get('counter', 'counterFormat', [ ["$hit$", selected], ["$total$", Finder.matchesPDF] ], Finder.matchesPDF);
				} else {
					str = Strings.get('counter', 'counterSimple', [ ["$total$", Finder.matchesPDF] ], Finder.matchesPDF);
				}
			}
			
			this.result(str);
			return;
		}
		
		if(document instanceof Ci.nsIDOMXMLDocument) {
			this.result(null, true);
			return;
		}
		
		// Normal HTML files
		if(Finder._lastFindResult == Ci.nsITypeAheadFind.FIND_NOTFOUND
		|| !Finder.searchString
		|| !Finder._highlights) {
			this.result();
			return;
		}
		
		let hit = 0;
		let length = Finder._highlights.all.length;
		
		let sel = length && Finder.currentTextSelection;
		if(sel && sel.rangeCount == 1) {
			let cRange = sel.getRangeAt(0);
			let i = 0;
			
			// Most times we don't need to start from the beginning of the array, it's faster to resume from a previous point
			let c = this.current || 0;
			if(c >= length) {
				c = 0;
			}
			this.current = 0;
			
			// loop forward (increment) when finding ahead; loop backward (decrement) when finding behind
			// conditionally setting a method like this is probably more efficient (especially on large pages with tons of highlights) than checking on each loop for this
			let looper;
			if(!Finder._lastFindPrevious) {
				looper = function loopCurrent() {
					c++;
					if(c == length) { c = 0; }
				};
			} else {
				looper = function loopCurrent() {
					c--;
					if(c < 0) { c = length -1; }
				};
			}
			
			while(i < length) {
				if(Finder.compareRanges(cRange, Finder._highlights.all[c].range)) {
					hit = c +1;
					this.current = c;
					break;
				}
				
				looper();
				i++;
			}
			
			if(!this.redoing && !hit) {
				let rangeText = cRange.toString();
				let word = findQuery;
				if(!Finder.caseSensitive) {
					rangeText = rangeText.toLowerCase();
					word = word.toLowerCase();
				}
				// if the find query is the same as the selected text then something must be wrong with the current highlights,
				// reapply them and try again
				if(rangeText == word) {
					this.redoing = true;
					highlights.apply(documentHighlighted);
					return;
				}
			}
		}
		
		if(hit) {
			this.redoing = false;
			this.result(Strings.get('counter', 'counterFormat', [ ["$hit$", hit], ["$total$", length] ], length));
		} else {
			this.result(Strings.get('counter', 'counterSimple', [ ["$total$", length] ], length));
		}
	}
};

Modules.LOADMODULE = function() {
	Finder.buildHighlights.add('counter');
	Finder.addResultListener(counter);
};

Modules.UNLOADMODULE = function() {
	Finder.removeResultListener(counter);
	Finder.buildHighlights.delete('counter');
};
