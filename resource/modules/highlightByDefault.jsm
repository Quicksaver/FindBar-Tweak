Modules.VERSION = '2.0.0';

this.highlightByDefault = function(bar) {
	bar.getElement("highlight").checked = true;
};
	
this.highlightByDefaultOnWillOpen = function(e) {
	if(e.defaultPrevented || !e.originalTarget.hidden) { return; }
	
	highlightByDefault(e.originalTarget);
};

this.highlightByDefaultOnFillSelectedText = function() {
	highlightByDefault(gFindBar);
};

Modules.LOADMODULE = function() {
	initFindBar('highlightByDefault',
		function(bar) {
			bar.browser.finder.addMessage('HighlightByDefault', () => {
				highlightByDefault(bar);
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
						if(arguments.callee.caller.toString().indexOf('bug 253793') > -1) { return this._checked; }
						return this._checked = v;
					}
				});
			}
			
			if(!bar.hidden) {
				highlightByDefault(bar);
			}
		},
		function(bar) {
			bar.browser.finder.removeMessage('HighlightByDefault');
			
			Messenger.unloadFromBrowser(bar.browser, 'highlightByDefault');
			
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
	
	Listeners.add(window, 'WillOpenFindBar', highlightByDefaultOnWillOpen);
	Listeners.add(window, 'WillOpenFindBarBackground', highlightByDefaultOnWillOpen);
	
	// Always highlight all by default when selecting text and filling the findbar with it
	Listeners.add(window, 'WillFillSelectedText', highlightByDefaultOnFillSelectedText);
};

Modules.UNLOADMODULE = function() {
	deinitFindBar('highlightByDefault');
	
	Listeners.remove(window, 'WillOpenFindBar', highlightByDefaultOnWillOpen);
	Listeners.remove(window, 'WillOpenFindBarBackground', highlightByDefaultOnWillOpen);
	Listeners.remove(window, 'WillFillSelectedText', highlightByDefaultOnFillSelectedText);
};
