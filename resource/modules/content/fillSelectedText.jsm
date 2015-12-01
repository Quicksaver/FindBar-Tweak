// VERSION 2.0.7

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
			
			let selText = Finder.getActiveSelectionText();
			
			// don't autofill if we're selecitng text in an editable node and the user doesn't want that,
			// but we do want to erase the findbar when there's no text selection
			if(selText && !Prefs.fillTextFromEditable) {
				let focused = Finder.getFocused();
				if(focused.element) {
					// instances of any editable element (i.e. input,textarea) are of course editable
					if(focused.element instanceof Ci.nsIDOMNSEditableElement) { return; }
					
					// in HTML5, elements with contenteditable="true" are freely editable
					if(trueAttribute(focused.element, 'contenteditable')) { return; }
				}
			}
			
			this.noSights(true);
			
			message('FillSelectedText', selText);
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
