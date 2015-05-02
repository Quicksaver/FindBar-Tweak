Modules.VERSION = '1.1.0';

this.getDocProperty = function(doc, prop, min) {
	try {
		if(isPDFJS && PDFJS.viewerApplication) {
			return PDFJS.viewerApplication.pdfViewer.container[prop];
		}
		
		if(doc instanceof Ci.nsIDOMHTMLDocument && doc.body) {
			if(min) { return Math.min(doc.documentElement[prop], doc.body[prop]); }
			return doc.documentElement[prop] || doc.body[prop];
		}
		
		return doc.documentElement[prop];
	}
	catch(ex) { return 0; }
};

this.highlights = {
	onPDFResult: function() {
		// there's no point in calling trackPDFMatches for every page, we can stack them up
		Timers.init('trackPDFMatches', () => { this.trackPDFMatches(); }, 50);
	},
	
	MESSAGES: [
		'Highlights:Info'
	],
	
	receiveMessage: function(m) {
		let name = messageName(m);
		
		switch(name) {
			case 'Highlights:Info':
				this.setEsc(m.data);
				break;
		}
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'keyup':
				this.esc(e);
				break;
		}
	},
	
	// Tab progress listeners, handles opening and closing of pages and location changes
	// Commands a reHighlight if needed, triggered from history navigation as well
	onLocationChange: function(aWebProgress, aRequest, aLocation) {
		// Frames don't need to trigger this
		if(aWebProgress.isTopLevel) {
			documentReHighlight = true;
			
			// Bugfix: This used to be (request && !request.isPending()),
			// I'm not sure why I made it that way before, maybe I saw it in an example somewhere?
			// But by also reHighlighting when !request, we successfully reHighlight when there is dynamic content loaded (e.g. AJAX)
			// e.g. "Show more" button in deviantart
			if(!aRequest || !aRequest.isPending()) {
				this.delay();
			}
			
			// Bugfix issue #42: when opening an image file, highlights from previous loaded document would remain
			else if(aRequest.contentType && aRequest.contentType.startsWith('image/')) {
				Timers.cancel('delayReHighlight');
				documentHighlighted = false;
				this.apply(false);
			}
		}
	},
	
	onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
		if(!aWebProgress.isLoadingDocument && aWebProgress.DOMWindow == content) {
			this.delay();
		}
	},

	// Commands a reHighlight if needed on any tab, triggered from frames as well
	// Mainly for back/forward actions
	onDOMContentLoaded: function(e) {
		// this is the content document of the loaded page.
		if(e.originalTarget instanceof content.HTMLDocument) {
			documentReHighlight = true;
			
			// Bugfix: don't do immediately! Pages with lots of frames will trigger this each time a frame is loaded, can slowdown page load
			this.delay();
		}
	},
	
	esc: function(e) {
		if(e.keyCode == e.DOM_VK_ESCAPE) {
			message('HighlightsOff');
		}
	},
	
	setEsc: function(data) {
		if('documentHighlighted' in data) {
			if(data.documentHighlighted) {
				Listeners.add(document, 'keyup', this);
			} else {
				Listeners.remove(document, 'keyup', this);
			}
		}
	},
	
	apply: function(aHighlight) {
		message('ReHighlight', aHighlight);
	},
	
	delay: function(delay = 500) {
		Timers.init('delayReHighlight', function() { highlights.apply(); }, delay);
	},
	
	// Updates our methods when there are new pdf matches (it's an aSync process)
	trackPDFMatches: function() {
		// if chrome messages this and it's already running, we don't need to start another timer
		if(Timers.trackPDFMatches) { return; }
		
		// duh
		if(!isPDFJS) { return; }
		
		// This usually means the matches are still being retrieved, however if this isn't true it still doesn't mean it's fully finished.
		// So later we set a timer to update itself after a while.
		// Bugfix: https://github.com/Quicksaver/FindBar-Tweak/issues/65 : I used to also check for PDFJS.findController.active, but that caused high CPU sometimes,
		// as that would never be set if the find bar was empty on load, so it kept setting the timer here.
		if(!PDFJS.findController || PDFJS.findController.resumeCallback) {
			Finder.matchesPDF = 0;
			Timers.init('trackPDFMatches', () => { this.trackPDFMatches(); }, 0);
			return;
		}
		
		// no state means no find operation run yet, nothing to do here
		if(!PDFJS.findController.state) { return; }
		
		documentHighlighted = (PDFJS.findController.state && PDFJS.findController.state.highlightAll);
		
		// No matches
		var matches = 0;
		if(PDFJS.findController.hadMatch) {
			for(let page of PDFJS.findController.pageMatches) {
				matches += page.length;
			}
		}
		
		var newMatches = false;
		if(Finder.highlightedWord != PDFJS.findController.state.query || Finder.matchesPDF !== matches) {
			Finder.matchesPDF = matches;
			Finder.highlightedWord = PDFJS.findController.state.query;
			newMatches = true;
		}
		
		for(let l of Finder._listeners) {
			if(l.onPDFMatches) {
				try { l.onPDFMatches(newMatches); }
				catch(ex) { Cu.reportError(ex); }
			}
		}
		
		if(newMatches || PDFJS.findController.pageContents.length != PDFJS.viewerApplication.pagesCount) {
			message('TempPending', true);
			
			// Because it might still not be finished, we should update later
			Timers.init('trackPDFMatches', () => { this.trackPDFMatches(); }, 250);
		} else {
			message('TempPending', false);
		}
	},

	QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
};

Modules.LOADMODULE = function() {
	Finder.matchesPDF = 0;
	Finder._syncPDFJS.__defineGetter__('readyState', function() { return document.readyState; });
	
	RemoteFinderListener.addMessage('Highlights:Clean', () => {
		for(let l of Finder._listeners) {
			if(l.onCleanUpHighlights) {
				try { l.onCleanUpHighlights(); }
				catch(ex) { Cu.reportError(ex); }
			}
		}
	});
	
	Finder.addResultListener(highlights);
	webProgress.addProgressListener(highlights, Ci.nsIWebProgress.NOTIFY_ALL);
	DOMContentLoaded.add(highlights);
	
	// set outside Finder, as it's a message that it already listens to
	for(let msg of highlights.MESSAGES) {
		listen(msg, highlights);
	}
	
	// make sure the info stays updated
	Finder.syncPDFJS();
};

Modules.UNLOADMODULE = function() {
	Timers.cancel('trackPDFMatches');
	
	for(let msg of highlights.MESSAGES) {
		unlisten(msg, highlights);
	}
	
	Finder.removeResultListener(highlights);
	webProgress.removeProgressListener(highlights);
	DOMContentLoaded.remove(highlights);
	Listeners.remove(document, 'keyup', highlights);
	
	RemoteFinderListener.removeMessage('Highlights:Clean');
	
	delete Finder._syncPDFJS.readyState;
	delete Finder.matchesPDF;
};
