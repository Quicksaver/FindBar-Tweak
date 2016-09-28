/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 2.0.8

this.selectedText = {
	handleEvent: function(e) {
		switch(e.type) {
			case 'mouseup':
				if(e.button == 0 && e.target.nodeName != 'HTML') {
					this.fill();
				}
				break;

			case 'keyup':
				switch(e.keyCode) {
					case e.DOM_VK_PAGE_UP:
					case e.DOM_VK_PAGE_DOWN:
					case e.DOM_VK_END:
					case e.DOM_VK_HOME:
					case e.DOM_VK_LEFT:
					case e.DOM_VK_UP:
					case e.DOM_VK_RIGHT:
					case e.DOM_VK_DOWN:
						this.fill();
						break;

					default: break;
			        }
			        break;
		}
	},

	receiveMessage: function(m) {
		let name = messageName(m);

		switch(name) {
			case 'FillSelectedTextFinished':
				this.noSights(false);
				break;
		}
	},

	noSights: function(v) {
		if(self.sights) {
			sights.doCurrent(v);
		}
	},

	fill: function() {
		// aSync because sometimes the events fire before the text selection actually changes, no idea why that is though...
		// see https://github.com/Quicksaver/FindBar-Tweak/issues/208
		Timers.init('FillSelectedText', () => {
			// we need this even if the findbar hasn't been created in this tab yet; the back and forth afterwards will initialize everything properly
			if(typeof(Finder) == 'undefined') {
				Modules.load('content/gFindBar');
				Modules.load('content/mFinder');
			}

			// there's no point in autofilling the find bar if it won't work in this page
			if(!Finder.isValid) { return; }

			let activeText = Finder.getActiveSelectionText();

			// don't autofill if we're selecitng text in an editable node and the user doesn't want that,
			// but we do want to erase the findbar when there's no text selection
			if(activeText.text && !Prefs.fillTextFromEditable && activeText.focusedElement) {
				// instances of any editable element (i.e. input,textarea) are of course editable
				if(activeText.focusedElement instanceof Ci.nsIDOMNSEditableElement) { return; }

				// in HTML5, elements with contenteditable="true" are freely editable
				if(trueAttribute(activeText.focusedElement, 'contenteditable')) { return; }

				// To fix a very specific case for gmail's new reply box, while trying to generalize for other possible similar cases.
				// see https://github.com/Quicksaver/FindBar-Tweak/issues/106#issuecomment-186307441
				if(activeText.selection && activeText.selection.rangeCount == 1) {
					let range = activeText.selection.getRangeAt(0);
					if(range.startContainer == range.endContainer && range.startContainer.childNodes.length) {
						// This string can differ from the above. For instance when quoting text, the above string will include the ">" characters,
						// while this will not as the text will be preformated into quote blocks.
						let rangeText = Finder.trimText(range.toString());

						let doc = range.startContainer.ownerDocument;
						let editable = $$('[contenteditable="true"]', range.startContainer);
						for(let child of editable) {
							try{
								let textContent = Finder.trimText(child.textContent);
								if(textContent == rangeText) { return; }
							}
							catch(ex) { /* ignore */ }
						}
					}
				}
			}

			this.noSights(true);

			message('FillSelectedText', activeText.text);
		}, 0);
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(Scope, 'mouseup', selectedText);
	Listeners.add(Scope, 'keyup', selectedText);

	listen('FillSelectedTextFinished', selectedText);
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(Scope, 'mouseup', selectedText);
	Listeners.remove(Scope, 'keyup', selectedText);

	unlisten('FillSelectedTextFinished', selectedText);
};
