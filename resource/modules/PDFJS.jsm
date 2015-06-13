Modules.VERSION = '1.0.1';

Modules.LOADMODULE = function() {
	// define when we're in a PDF file
	RemoteFinder.prototype.isPDFJS = null;
	
	initFindBar('PDFJS',
		function(bar) {
			Messenger.loadInBrowser(bar.browser, 'PDFJS');
			
			bar.browser.finder.addMessage("PDFJS:Result", function(data) {
				// only update the data (and send a data updated event) if there is something to update
				var updateData = (data && !this.isPDFJS) || (!data && this.isPDFJS);
				if(!updateData && data) {
					for(var d in data) {
						if(data[d] != this.isPDFJS[d]) {
							updateData = true;
							break;
						}
					}
				}
				if(!updateData) { return null; }
				
				this.isPDFJS = data;
				return { callback: "onPDFJS", params: [ this._browser ] };
			}.bind(bar.browser.finder));
			
			bar.browser.finder.addMessage("PDFJS:State", function(data) {
				bar.updateControlState(data.state, data.previous);
				return { callback: "onPDFJSState", params: [ bar.browser ] };
			});
			
			Piggyback.add('PDFJS', bar, '_dispatchFindEvent', function(aType, aFindPrevious) {
				if(this.browser.finder.isPDFJS) {
					// don't trigger unnecessary multiple calls if we're selecting a hit from the FIT window,
					// especially because this would reset the selected hit to the first result in the page
					if(this.browser.finder.workAroundFind && aType) {
						return;
					}
					
					let delay = SHORT_DELAY;
					if(!this.browser.finder.workAroundFind
					&& this._findField.value
					&& Prefs.minNoDelay > 0 && this._findField.value.length < Prefs.minNoDelay) {
						delay = LONG_DELAY;
					}
					
					Messenger.messageBrowser(this.browser, 'PDFJS:Event', {
						type: 'find'+aType,
						query: this._findField.value,
						caseSensitive: !!this._typeAheadCaseSensitive,
						highlightAll: this.getElement("highlight").checked,
						findPrevious: aFindPrevious,
						delay: delay,
						workAroundFind: this.browser.finder.workAroundFind
					});
					return false;
				}
				return true;
			});
			
			// ensure we get the current PDFJS state
		},
		function(bar) {
			if(!bar._destroying) {
				Piggyback.revert('PDFJS', bar, '_dispatchFindEvent');
				
				bar.browser.finder.removeMessage("PDFJS:Result");
				bar.browser.finder.removeMessage("PDFJS:State");
			}
			
			Messenger.unloadFromBrowser(bar.browser, 'PDFJS');
		}
	);
};

Modules.UNLOADMODULE = function() {
	deinitFindBar('PDFJS');
	
	delete RemoteFinder.prototype.isPDFJS;
};
