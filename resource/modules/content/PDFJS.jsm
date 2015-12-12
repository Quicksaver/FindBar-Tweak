// VERSION 1.1.2

this.PDFJS = {
	// We need this to access protected properties, hidden from privileged code
	_unWrapped: null,
	get unWrap() {
		if(this._unWrapped && !isPDFJS) {
			this._unWrapped = null;
		}
		if(!this._unWrapped && isPDFJS) {
			this._unWrapped = XPCNativeWrapper.unwrap(content);
		}
		return this._unWrapped;
	},

	get viewerApplication() { return this.unWrap && this.unWrap.PDFViewerApplication; },
	get findController() { return this.viewerApplication && this.viewerApplication.findController; },
	get pdfViewer() { return this.viewerApplication && this.viewerApplication.pdfViewer; },

	getPageView: function(pIdx) {
		return this.pdfViewer.getPageView(pIdx);
	},

	// make sure we don't keep old references to previous documents
	reset: function() {
		this._unWrapped = null;
		Finder.syncPDFJS();
		this.hijack();
		this.callOnPDFReset();
	},

	forceMatch: function(match) {
		this.findController.showCurrentMatch = true;
		this.findController.selected.pageIdx = match.pIdx;
		this.findController.selected.matchIdx = match.mIdx;
		this.findController.offset.pageIdx = match.pIdx;
		this.findController.offset.matchIdx = match.mIdx;
		this.findController.offset.wrapped = false;
		this.findController.updatePage(match.pIdx);
	},

	receiver: function(data) {
		if(!this.findController) { return; }

		// this is needed so objects created in a privileged scope (the message data) can be used in unpriviliged scope (webpage/pdf reader)
		var fakeEvent = Cu.cloneInto(data, content);

		// We can't pass fakeEvent below and let the native method handle it because of a lot of limitations with its binds and stuff,
		// especially because we also replace PDFJS.findController.nextMatch. So we have to reproduce the whole thing here.
		// This turns out to be good because we can also apply our delay settings here as well.

		if(this.findController.state === null || fakeEvent.type !== 'findagain') {
			this.findController.dirtyMatch = true;
		}
		this.findController.state = fakeEvent;
		this.findController.updateUIState(this.unWrap.FindStates.FIND_PENDING);

		Timers.cancel('PDFFindTimeout');

		this.findController.firstPagePromise.then(() => {
			this.findController.extractText();

			if(this.findController.state.type === 'find') {
				Timers.init('PDFFindTimeout', () => {
					this.findController.nextMatch(this.findController.state.type);
				}, this.findController.state.delay);
			} else {
				this.findController.nextMatch(this.findController.state.type);
			}
		});
	},

	callOnPDFReset: function() {
		for(let l of Finder._listeners) {
			if(l.onPDFReset) {
				try { l.onPDFReset(); }
				catch(ex) { Cu.reportError(ex); }
			}
		}
	},

	callOnPDFResults: function(aAction, pIdx) {
		for(let l of Finder._listeners) {
			if(l.onPDFResult) {
				try { l.onPDFResult(aAction, pIdx); }
				catch(ex) { Cu.reportError(ex); }
			}
		}
	},

	isElementInView: function(element, soft) {
		let parent = element.offsetParent;

		// discriminating in the same way PDF.JS does
		if(!parent) {
			// Original treats this as if it was an error, but I'm coming across a lot of instances where this happens,
			// and this information doesn't seem useful at all.
			//Cu.reportError("offsetParent is not set -- cannot scroll");
			return false;
		}

		let offsetTop = element.offsetTop +element.clientTop;
		let offsetLeft = element.offsetLeft +element.clientLeft;
		while(parent.clientHeight === parent.scrollHeight || getComputedStyle(parent).overflow === 'hidden') {
			if(parent.dataset && parent.dataset._scaleY) {
				offsetTop /= parent.dataset._scaleY;
				offsetLeft /= parent.dataset._scaleX;
			}
			offsetTop += parent.offsetTop +parent.clientTop;
			offsetLeft += parent.offsetLeft +parent.clientLeft;
			parent = parent.offsetParent;
			if(!parent) {
				return; // no need to scroll
			}
		}
		let offsetBottom = offsetTop +element.clientHeight;
		let offsetRight = offsetLeft +element.clientWidth;

		let scrollTop = parent.scrollTop;
		let scrollLeft = parent.scrollLeft;
		let scrollBottom = scrollTop +parent.clientHeight;
		let scrollRight = scrollLeft +parent.clientWidth;

		if(!soft) {
			return offsetTop >= scrollTop && offsetLeft >= scrollLeft && offsetBottom <= scrollBottom && offsetRight <= scrollRight;
		} else {
			let visibleY = (offsetTop >= scrollTop && offsetTop <= scrollBottom) || (offsetBottom >= scrollTop && offsetBottom <= scrollBottom);
			let visibleX = (offsetLeft >= scrollLeft && offsetLeft <= scrollRight) || (offsetRight >= scrollLeft && offsetRight <= scrollRight);
			return visibleY && visibleX;
		}
	},

	// We're hijacking PDFJS's findbar, as it is completely embedded in its DOM for remote browsers, so we can't use it with our methods.
	// Instead, we go around it, so the native (chrome) findbar can be used instead all the time.
	hijack: function() {
		if(!this.viewerApplication || this.viewerApplication[objName]) { return; }
		this.viewerApplication[objName] = true;

		// PDFViewerApplication keeps its own initialization promise closed to itself, so we have to improvize our own.
		var initViewer = new Promise.defer();
		this.viewerApplication.afterInitialized = initViewer.promise;
		if(this.viewerApplication.initialized) {
			initViewer.resolve();
		} else {
			delete this.viewerApplication.initialized;
			this.viewerApplication._initialized = false;
			this.viewerApplication.__defineGetter__('initialized', function() { return this._initialized; });
			this.viewerApplication.__defineSetter__('initialized', function(v) {
				if(v) { initViewer.resolve(); }
				return this._initialized = v;
			});
		}

		this.viewerApplication.afterInitialized.then(() => {
			// hide the viewer's own findbar, we use the native one
			setAttribute($('findbar'), 'hidden', 'true');
			setAttribute($('viewFind'), 'hidden', 'true');

			// we also need to use messages to update the integrated findbar, and not the viewer's own
			Piggyback.add('PDFJS', this.findController, 'updateUIState', function(state, previous) {
				message('PDFJS:State', { state: state, previous: previous });

				for(let l of Finder._listeners) {
					if(l.onPDFState) {
						try { l.onPDFState(state); }
						catch(ex) { Cu.reportError(ex); }
					}
				}
			});

			Piggyback.add('PDFJS', this.findController, 'updateMatchPosition', function(pageIndex, index, elements, beginIdx, endIdx) {
				// Only scroll matches into view when a find actually runs, and not when the document is scrolled (rendering pages triggers this as well)
				if(!this.showCurrentMatch) { return; }

				if(this.selected.matchIdx === index && this.selected.pageIdx === pageIndex) {
					this.showCurrentMatch = false;

					// Check if the match is already in view, no need to scroll if it is.
					let element = elements[beginIdx];
					if(PDFJS.isElementInView(element)) { return; }

					let spot = Cu.cloneInto({
						top: PDFJS.unWrap.FIND_SCROLL_OFFSET_TOP,
						left: PDFJS.unWrap.FIND_SCROLL_OFFSET_LEFT
					}, PDFJS.unWrap);
					PDFJS.unWrap.scrollIntoView(element, spot, true);
				}
			});

			Piggyback.add('PDFJS', this.findController, 'updatePage', function(index) {
				let page = PDFJS.getPageView(index);

				if(this.selected.pageIdx === index && this.showCurrentMatch) {
					// Only scroll to the page if it isn't already in view.
					if(!page || !page.div || !PDFJS.isElementInView(page.div, true)) {
						// If the page is selected, scroll the page into view, which triggers rendering the page, which adds the textLayer.
						// Once the textLayer is build, it will scroll onto the selected match.
						PDFJS.pdfViewer.scrollPageIntoView(index +1);

						if(!page || !page.div) {
							page = PDFJS.getPageView(index);
						}
					}
				}

				if(page.textLayer) {
					page.textLayer.updateMatches();
				}
			});

			// The best place to report a "finished" PDF.JS find operation, so we can properly react to the found matches,
			// seems to be after each page's extractTextPromise(s) finishes, and also after the method reacting to it set by PDFFindController.nextMatch itself.
			// Don't use Piggyback, we can't send privileged JS objects (arguments) into untrusted methods
			// (even though it's PDFJS but it's still a technnicality I can't get around in Piggyback..)
			this.findController._nextMatch = this.findController.nextMatch;
			this.findController.nextMatch = function(aAction) {
				let selected = null;
				if(this.state.workAroundFind) {
					this.state.workAroundFind = false;
					if(this.selected.pageIdx > -1 && this.selected.matchIdx > -1) {
						selected = {
							pIdx: this.selected.pageIdx,
							mIdx: this.selected.matchIdx
						};
					}
				}

				if(this.state.type != 'findagain') {
					PDFJS.callOnPDFReset();
				}
				if(this.state.type != 'findhighlightallchange') {
					this.showCurrentMatch = true;
				}
				this._nextMatch();

				// in case FIT wants a specific match found, make sure the new find operation run doesn't override it
				if(selected) {
					this.extractTextPromises[selected.pIdx].then(() => {
						if(selected.pIdx != this.selected.pageIdx || selected.mIdx != this.selected.matchIdx) {
							PDFJS.forceMatch(selected);
						}
					});
				}

				for(let pageIdx = 0; pageIdx < this.extractTextPromises.length; pageIdx++) {
					let extractPromise = this.extractTextPromises[pageIdx];
					extractPromise.then(() => {
						PDFJS.callOnPDFResults(aAction, pageIdx);
					});
				}
			};

			// ensure the viewer also knows it's using the integrated findbar, so the keypresses are properly handled
			this.viewerApplication._supportsIntegratedFind = this.viewerApplication.supportsIntegratedFind;
			delete this.viewerApplication.supportsIntegratedFind;
			this.viewerApplication.supportsIntegratedFind = true;
		});
	},

	unhijack: function() {
		Timers.cancel('PDFFindTimeout');

		if(!this.viewerApplication || !this.viewerApplication[objName]) { return; }
		delete this.viewerApplication[objName];

		delete this.viewerApplication.supportsIntegratedFind;
		this.viewerApplication.supportsIntegratedFind = this.viewerApplication._supportsIntegratedFind;
		delete this.viewerApplication._supportsIntegratedFind;

		Piggyback.revert('PDFJS', this.findController, 'updateUIState');
		Piggyback.revert('PDFJS', this.findController, 'updateMatchPosition');
		Piggyback.revert('PDFJS', this.findController, 'updatePage');
		delete this.findController.showCurrentMatch;

		this.findController.nextMatch = this.findController._nextMatch;
		delete this.findController._nextMatch;

		toggleAttribute($('findbar'), 'hidden', this.viewerApplication.supportsIntegratedFind);
		toggleAttribute($('viewFind'), 'hidden', this.viewerApplication.supportsIntegratedFind);

		var inited = this.viewerApplication.initialized;
		delete this.viewerApplication.afterInitialized;
		delete this.viewerApplication._initialized;
		delete this.viewerApplication.initialized;
		this.viewerApplication.initialized = inited;
	},

	onDOMContentLoaded: function(e) {
		// this is the content document of the loaded page.
		var doc = e.originalTarget;
		if(doc instanceof content.HTMLDocument) {
			// is this an inner frame?
			// Find the root document:
			while(doc.defaultView.frameElement) {
				doc = doc.defaultView.frameElement.ownerDocument;
			}

			if(doc == document) {
				this.reset();
			}
		}
	},

	onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) {
		if(aWebProgress.isTopLevel) {
			this.reset();
		}
	},

	QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference])
};

Modules.LOADMODULE = function() {
	Finder.PDFJS = null;
	Finder.__defineGetter__('isPDFJS',
		function() { return (!viewSource && document && document.contentType == 'application/pdf' && document.baseURI == 'resource://pdf.js/web/'); });

	// append getters into this object for all the info that should be passed onto chrome
	Finder._syncPDFJS = {};
	Finder.syncPDFJS = function() {
		// do aSync so we don't fire more than necessary
		Timers.init('syncPDFJS', () => {
			this.PDFJS = null;

			if(this.isPDFJS) {
				this.PDFJS = {};
				for(var s in this._syncPDFJS) {
					this.PDFJS[s] = this._syncPDFJS[s];
				}
			}

			message('PDFJS:Result', this.PDFJS);

			for(let l of this._listeners) {
				if(l.onPDFJS) {
					try { l.onPDFJS(); }
					catch(ex) { Cu.reportError(ex); }
				}
			}
		}, 0);
	};

	RemoteFinderListener.addMessage('PDFJS:Event', data => {
		PDFJS.receiver(data);
	});

	RemoteFinderListener.addMessage('PDFJS:Sync', () => {
		Finder.syncPDFJS();
	});

	WebProgress.add(PDFJS, Ci.nsIWebProgress.NOTIFY_LOCATION);
	DOMContentLoaded.add(PDFJS);

	PDFJS.reset();
};

Modules.UNLOADMODULE = function() {
	WebProgress.remove(PDFJS, Ci.nsIWebProgress.NOTIFY_LOCATION);
	DOMContentLoaded.remove(PDFJS);

	RemoteFinderListener.removeMessage('PDFJS:Event');
	RemoteFinderListener.removeMessage('PDFJS:Sync');

	delete Finder.PDFJS;
	delete Finder.isPDFJS;
	delete Finder._syncPDFJS;
	delete Finder.syncPDFJS;

	PDFJS.unhijack();
};
