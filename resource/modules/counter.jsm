Modules.VERSION = '2.0.0';

this.counter = {
	heldStatus: null,
	
	holdStatusForCounter: function(e) {
		// if we're in an empty find, no point in holding
		if((e.detail.res == Ci.nsITypeAheadFind.FIND_FOUND && !findQuery)
		// also no point in holding if no matches were found
		|| e.detail.res == Ci.nsITypeAheadFind.FIND_NOTFOUND) {
			counter.heldStatus = null;
			return;
		}
		
		// otherwise, let the counter finish before changing the status
		e.preventDefault();
		e.stopPropagation();
		
		counter.heldStatus = e.detail;
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(window, 'WillUpdateStatusFindBar', counter.holdStatusForCounter, true);
	
	initFindBar('counter',
		function(bar) {
			bar.browser.finder.addMessage('Counter:Result', data => {
				var res = (data || !findQuery || !Finder.searchString) ? Ci.nsITypeAheadFind.FIND_FOUND : Ci.nsITypeAheadFind.FIND_NOTFOUND;
				var aFindPrevious = null;
				if(counter.heldStatus) {
					res = counter.heldStatus.res;
					aFindPrevious = counter.heldStatus.aFindPrevious;
					counter.heldStatus = null;
				}
				
				// don't forget that this should bypass our checks to go straight to the actual method
				bar.__updateStatusUI(res, aFindPrevious);
				
				if(data) {
					bar._findStatusDesc.textContent = data;
					bar._findStatusDesc.hidden = false;
					bar._findStatusIcon.hidden = false;
				}
				
				if(gFindBarInitialized && bar == gFindBar) {
					dispatch(bar, { type: 'UpdatedStatusFindBar', cancelable: false, detail: { res: res, aFindPrevious: aFindPrevious } });
				}
			});
			
			Messenger.loadInBrowser(bar.browser, 'counter');
		},
		function(bar) {
			bar.browser.finder.removeMessage('Counter:Result');
			Messenger.unloadFromBrowser(bar.browser, 'counter');
			
			bar._findStatusDesc.textContent = '';
		}
	);
	
	Observers.notify('ReHighlightAll');
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, 'WillUpdateStatusFindBar', counter.holdStatusForCounter, true);
	
	deinitFindBar('counter');
	
	if(!UNLOADED && !window.closed && !window.willClose) {
		Observers.notify('ReHighlightAll');
	}
};
