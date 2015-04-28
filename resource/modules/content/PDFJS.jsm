Modules.VERSION = '1.0.0';

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
	
	// make sure we don't keep old references to previous documents
	reset: function() {
		this._unWrapped = null;
		Finder.syncPDFJS();
		this.hijack();
	},
	
	forceMatch: function(match) {
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
		//this.findController.handleEvent(fakeEvent);
		
		if(this.findController.state === null || fakeEvent.type !== 'findagain') {
			this.findController.dirtyMatch = true;
		}
		this.findController.state = fakeEvent;
		this.findController.updateUIState(this.unWrap.FindStates.FIND_PENDING);
		
		Timers.cancel('PDFFindTimeout');
		
		this.findController.firstPagePromise.then(() => {
			this.findController.extractText();
			
			if(this.findController.state.type === 'find') {
				Timers.init('PDFFindTimeout', function() {
					PDFJS.findController.nextMatch(PDFJS.findController.state.type);
				}, this.findController.state.delay);
			} else {
				this.findController.nextMatch(this.findController.state.type);
			}
		});
	},
	
	callOnPDFResults: function(aAction) {
		for(let l of Finder._listeners) {
			if(l.onPDFResult) {
				try { l.onPDFResult(aAction); }
				catch(ex) { Cu.reportError(ex); }
			}
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
			
			// we don't need to unlisten for these in FF39
			if(this.findController.handleEvent) {
				// these events aren't carried to content in e10s, so they're irrelevant, let's just get rid of them
				// instead, we use messages to carry out actions through PDFJSEventReceiver()
				var events = [ 'find', 'findagain', 'findhighlightallchange', 'findcasesensitivitychange' ];
				for (var i = 0, len = events.length; i < len; i++) {
					content.removeEventListener(events[i], this.findController.handleEvent);
				}
			}
			
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
				
				this._nextMatch();
				
				// in case FIT wants a specific match found, make sure the new find operation run doesn't override it
				if(selected) {
					this.extractTextPromises[selected.pIdx].then(() => {
						if(selected.pIdx != this.selected.pageIdx || selected.mIdx != this.selected.matchIdx) {
							PDFJS.forceMatch(selected);
						}
					});
				}
				
				for(let extractPromise of this.extractTextPromises) {
					extractPromise.then(() => {
						PDFJS.callOnPDFResults(aAction);
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
		
		this.findController.nextMatch = this.findController._nextMatch;
		delete this.findController._nextMatch;
		
		if(this.findController.handleEvent) {
			var events = [ 'find', 'findagain', 'findhighlightallchange', 'findcasesensitivitychange' ];
			for (var i = 0, len = events.length; i < len; i++) {
				content.addEventListener(events[i], this.findController.handleEvent);
			}
		}
		
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
	
	webProgress.addProgressListener(PDFJS, Ci.nsIWebProgress.NOTIFY_LOCATION);
	DOMContentLoaded.add(PDFJS);
	
	PDFJS.reset();
};

Modules.UNLOADMODULE = function() {
	webProgress.removeProgressListener(PDFJS, Ci.nsIWebProgress.NOTIFY_LOCATION);
	DOMContentLoaded.remove(PDFJS);
	
	RemoteFinderListener.removeMessage('PDFJS:Event');
	RemoteFinderListener.removeMessage('PDFJS:Sync');
	
	delete Finder.PDFJS;
	delete Finder.isPDFJS;
	delete Finder._syncPDFJS;
	delete Finder.syncPDFJS;
	
	PDFJS.unhijack();
};
