// VERSION 2.1.5

this.highlightByDefault = {
	apply: function(bar) {
		bar.getElement("highlight").checked = true;
	},

	handleEvent: function(e) {
		switch(e.type) {
			case 'WillOpenFindBar':
			case 'WillOpenFindBarBackground':
				if(e.defaultPrevented || !e.originalTarget.hidden) { return; }

				this.apply(e.originalTarget);
				break;


			case 'WillFillSelectedText':
				this.apply(gFindBar);
				break;

			case 'WillFindFindBar':
				if((Prefs.highlightOnFindAgain || Finder.workAroundFind) && gFindBar.hidden && !Prefs.hideWhenFinderHidden) {
					this.apply(gFindBar);
				}
				break;
		}
	}
};

Modules.LOADMODULE = function() {
	findbar.init('highlightByDefault',
		function(bar) {
			bar.browser.finder.addMessage('HighlightByDefault', () => {
				highlightByDefault.apply(bar);
			});

			Messenger.loadInBrowser(bar.browser, 'highlightByDefault');

			if(!viewSource) {
				// We so don't want the tabbrowser's onLocationChange handler to unset the highlight button,
				// but it's so hard to override it correctly... This works great, so here's to hoping this use of
				// arguments.callee.caller is acceptable.
				var highlightBtn = bar.getElement('highlight');
				Object.defineProperty(highlightBtn, '_checked', Object.getOwnPropertyDescriptor(Object.getPrototypeOf(highlightBtn), 'checked'));
				Object.defineProperty(highlightBtn, 'checked', {
					configurable: true,
					enumerable: true,
					get: function() { return this._checked; },
					set: function(v) {
						if(arguments.callee.caller.toString().includes('bug 253793')) { return this._checked; }
						return this._checked = v;
					}
				});
			}

			if(!bar.hidden) {
				highlightByDefault.apply(bar);
			}
		},
		function(bar) {
			Messenger.unloadFromBrowser(bar.browser, 'highlightByDefault');

			if(bar._destroying) { return; }

			bar.browser.finder.removeMessage('HighlightByDefault');

			if(!viewSource) {
				var highlightBtn = bar.getElement('highlight');
				Object.defineProperty(highlightBtn, 'checked', Object.getOwnPropertyDescriptor(Object.getPrototypeOf(highlightBtn), 'checked'));
				delete highlightBtn._checked;
			}

			if(!bar.browser.finder.documentHighlighted) {
				bar.getElement("highlight").checked = false;
			}
		}
	);

	Listeners.add(window, 'WillOpenFindBar', highlightByDefault);
	Listeners.add(window, 'WillOpenFindBarBackground', highlightByDefault);

	// Always highlight all by default when selecting text and filling the findbar with it
	Listeners.add(window, 'WillFillSelectedText', highlightByDefault);

	// Opening a new tab and hitting F3 to search for the last globally used query would not trigger highlights,
	// see https://github.com/Quicksaver/FindBar-Tweak/issues/201
	Listeners.add(window, 'WillFindFindBar', highlightByDefault);
};

Modules.UNLOADMODULE = function() {
	findbar.deinit('highlightByDefault');

	Listeners.remove(window, 'WillOpenFindBar', highlightByDefault);
	Listeners.remove(window, 'WillOpenFindBarBackground', highlightByDefault);
	Listeners.remove(window, 'WillFillSelectedText', highlightByDefault);
	Listeners.remove(window, 'WillFindFindBar', highlightByDefault);
};
