/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.2.1

this.getDocProperty = function(doc, prop, min) {
	try {
		if(isPDFJS && PDFJS.viewerApplication) {
			return PDFJS.pdfViewer.container[prop];
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
	pagesTextsExtracted: new Set(),

	onPDFResult: function(aAction, pIdx) {
		if(!this.pagesTextsExtracted.has(pIdx)) {
			PDFJS.matches += PDFJS.findController.pageMatches[pIdx].length;
			this.pagesTextsExtracted.add(pIdx);
			this.pageTextExtracted(pIdx);
		}
	},

	onPDFReset: function() {
		PDFJS.matches = 0;
		this.pagesTextsExtracted = new Set();
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

			// Commands a reHighlight if needed on any tab, triggered from frames as well
			// Mainly for back/forward actions
			case 'DOMContentLoaded':
				// this is the content document of the loaded page.
				if(e.originalTarget instanceof content.HTMLDocument) {
					documentReHighlight = true;

					// Bugfix: don't do immediately! Pages with lots of frames will trigger this each time a frame is loaded, can slowdown page load
					this.delay();
				}
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
		Timers.init('delayReHighlight', () => { this.apply(); }, delay);
	},

	// Updates our methods when there are new pdf matches (it's an aSync process)
	pageTextExtracted: function(pIdx) {
		// This usually means the matches are still being retrieved, however if this isn't true it still doesn't mean it's fully finished.
		// So later we set a timer to update itself after a while.
		// Bugfix: https://github.com/Quicksaver/FindBar-Tweak/issues/65 : I used to also check for PDFJS.findController.active, but that caused high CPU sometimes,
		// as that would never be set if the find bar was empty on load, so it kept setting the timer here.
		if(!PDFJS.findController || PDFJS.findController.resumeCallback) {
			aSync(() => { this.pageTextExtracted(pIdx); }, 0);
			return;
		}

		// no state means no find operation run yet, nothing to do here
		if(!PDFJS.findController.state) { return; }

		documentHighlighted = (PDFJS.findController.state && PDFJS.findController.state.highlightAll);

		if(Finder.highlightedWord != PDFJS.findController.state.query) {
			Finder.highlightedWord = PDFJS.findController.state.query;
		}

		for(let l of Finder._listeners) {
			if(l.onPDFPageTextExtracted) {
				try { l.onPDFPageTextExtracted(pIdx); }
				catch(ex) { Cu.reportError(ex); }
			}
		}

		message('TempPending', PDFJS.findController.pageContents.length != PDFJS.viewerApplication.pagesCount);
	},

	QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
};

Modules.LOADMODULE = function() {
	PDFJS.matches = 0;
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
	WebProgress.add(highlights, Ci.nsIWebProgress.NOTIFY_ALL);
	DOMContentLoaded.add(highlights);

	// set outside Finder, as it's a message that it already listens to
	for(let msg of highlights.MESSAGES) {
		listen(msg, highlights);
	}

	// make sure the info stays updated
	Finder.syncPDFJS();
};

Modules.UNLOADMODULE = function() {
	// these modules might not have loaded at all
	try {
		Listeners.remove(document, 'keyup', highlights);
	}
	catch(ex) {}

	for(let msg of highlights.MESSAGES) {
		unlisten(msg, highlights);
	}

	Finder.removeResultListener(highlights);
	WebProgress.remove(highlights);
	DOMContentLoaded.remove(highlights);

	RemoteFinderListener.removeMessage('Highlights:Clean');

	delete Finder._syncPDFJS.readyState;
	delete PDFJS.matches;
};
