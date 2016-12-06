/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 2.1.5

this.counter = {
	heldStatus: null,

	handleEvent: function(e) {
		// if we're in an empty find, no point in holding
		if((e.detail.res == Ci.nsITypeAheadFind.FIND_FOUND && !findQuery)
		// also no point in holding if no matches were found
		|| e.detail.res == Ci.nsITypeAheadFind.FIND_NOTFOUND) {
			this.heldStatus = null;
			return;
		}

		// otherwise, let the counter finish before changing the status
		e.preventDefault();
		e.stopPropagation();

		this.heldStatus = e.detail;
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(window, 'WillUpdateStatusFindBar', counter, true);

	findbar.init('counter',
		function(bar) {
			bar.browser.finder.addMessage('Counter:Result', data => {
				if(data.heldStatus) {
					if(counter.heldStatus) {
						let res = counter.heldStatus.res;
						let aFindPrevious = counter.heldStatus.aFindPrevious;
						bar.__updateStatusUI(res, aFindPrevious);

						if(gFindBarInitialized && bar == gFindBar) {
							dispatch(bar, { type: 'UpdatedStatusFindBar', cancelable: false, detail: { res: res, aFindPrevious: aFindPrevious } });
						}
					}
					return;
				}

				// we shouldn't update the status if it's relative to a previous query
				if(data.searchString != findQuery) { return; }

				let res = Ci.nsITypeAheadFind.FIND_NOTFOUND;
				let aFindPrevious = null;
				if(counter.heldStatus) {
					res = counter.heldStatus.res;
					aFindPrevious = counter.heldStatus.aFindPrevious;
					counter.heldStatus = null;
				}
				else if(data.result || !data.searchString) {
					res = Ci.nsITypeAheadFind.FIND_FOUND;
				}

				// don't forget that this should bypass our checks to go straight to the actual method
				bar.__updateStatusUI(res, aFindPrevious);

				if(data.result) {
					bar._findStatusDesc.textContent = data.result;
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
			Messenger.unloadFromBrowser(bar.browser, 'counter');

			if(bar._destroying) { return; }

			bar.browser.finder.removeMessage('Counter:Result');

			bar._findStatusDesc.textContent = '';
		}
	);

	Observers.notify('ReHighlightAll');
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, 'WillUpdateStatusFindBar', counter, true);

	findbar.deinit('counter');

	if(!UNLOADED && !window.closed && !window.willClose) {
		Observers.notify('ReHighlightAll');
	}
};
