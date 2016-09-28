/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 2.0.6

XPCOMUtils.defineLazyServiceGetter(this, "gClipboardHelper", "@mozilla.org/widget/clipboardhelper;1", "nsIClipboardHelper");

this.fillSelectedText = function(m) {
	let selText = m.data;

	if((selText || Prefs.emptySelectedText)
	&& (findQuery != selText || (selText && Prefs.highlightByDefault && !documentHighlighted))
	&& dispatch(gFindBar, { type: 'WillFillSelectedText' })) {
		findQuery = selText;
		highlightedWord = selText; // Make sure we highlight it if needed

		Timers.init('fillSelectedText', function() {
			Finder.workAroundFind = true;
			try { gFindBar._find(); }
			catch(ex) { Cu.reportError(ex); }

			// ensure we reset workAroundFind even if this errors for some reason, it shouldn't though
			Finder.workAroundFind = false;
		}, 0);

		if(selText) {
			if(Prefs.fillTextShowFindBar && gFindBar.hidden) {
				gFindBar.open(gFindBar.FIND_TYPEAHEAD);
				gFindBar._setFindCloseTimeout();

				if(gFindBar._findMode == gFindBar.FIND_TYPEAHEAD) {
					if(gFindBar._keepOpen) {
						gFindBar._keepOpen.cancel();
					}

					(function() {
						let bar = gFindBar;
						bar._keepOpen = aSync(function() {
							delete bar._keepOpen;
						});
					})();
				}
			}

			// Copy to clipboard if user wants this.
			if(Prefs.fillTextIntoClipboard) {
				gClipboardHelper.copyString(selText);
			}
		}
	}
	else {
		Messenger.messageBrowser(m.target, 'FillSelectedTextFinished');
	}
};

Modules.LOADMODULE = function() {
	Messenger.listenWindow(window, 'FillSelectedText', fillSelectedText);
	Messenger.loadInWindow(window, 'fillSelectedText', false);
};

Modules.UNLOADMODULE = function() {
	Messenger.unloadFromWindow(window, 'fillSelectedText');
	Messenger.unlistenWindow(window, 'FillSelectedText', fillSelectedText);
};
