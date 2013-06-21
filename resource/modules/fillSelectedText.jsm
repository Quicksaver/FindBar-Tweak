moduleAid.VERSION = '1.0.1';

this.doFastFind = true;

this.workAroundFastFind = function(aWord, aWindow) {
	var win = aWindow || gFindBar.browser.contentWindow;
	for(var i = 0; win.frames && i < win.frames.length; i++) {
		if(workAroundFastFind(aWord, win.frames[i])) {
			return gFindBar.nsITypeAheadFind.FIND_FOUND;
		}
	}
	
	var doc = win.document;
	if(!doc || !(doc instanceof window.HTMLDocument) || !doc.body) {
		return gFindBar.nsITypeAheadFind.FIND_NOTFOUND;
	}
	
	var searchRange = doc.createRange();
	searchRange.selectNodeContents(doc.body);
	
	var startPt = searchRange.cloneRange();
	startPt.collapse(true);
	
	var endPt = searchRange.cloneRange();
	endPt.collapse(false);
	
	var retRange = null;
	var finder = Components.classes['@mozilla.org/embedcomp/rangefind;1'].createInstance().QueryInterface(Components.interfaces.nsIFind);
	finder.caseSensitive = gFindBar._shouldBeCaseSensitive(aWord);
	
	while((retRange = finder.Find(aWord, searchRange, startPt, endPt))) {
		return gFindBar.nsITypeAheadFind.FIND_FOUND;
	}
	
	return gFindBar.nsITypeAheadFind.FIND_NOTFOUND;
};

this.fillSelectedText = function() {
	var selText = gFindBar._getInitialSelection();
	if(selText && gFindBar._findField.value != selText && dispatch(gFindBar, { type: 'WillFillSelectedText' })) {
		gFindBar._findField.value = selText;
		doFastFind = false;
		timerAid.init('fillSelectedText', function() {
			try { gFindBar._find(); } catch(ex) { Cu.reportError(ex); } // ensure we reset doFastFind even if this errors for some reason, it shouldn't though
			doFastFind = true;
		}, 0);
		
		if(prefAid.fillTextShowFindBar && gFindBar.hidden) {
			gFindBar.open(gFindBar.FIND_TYPEAHEAD);
			if(gFindBar._quickFindTimeout) { window.clearTimeout(gFindBar._quickFindTimeout); }
			gFindBar._quickFindTimeout = window.setTimeout(function(aSelf) { if(aSelf._findMode != aSelf.FIND_NORMAL) aSelf.close(); }, gFindBar._quickFindTimeoutLength, gFindBar);
		}
	}
};

this.fillSelectedTextMouseUp = function(e) {
	if(e.button != 0 || e.target.nodeName == 'HTML') { return; }
	
	fillSelectedText();
};

this.fillSelectedTextKeyUp = function(e) {
	switch(e.keyCode) {
		case e.DOM_VK_PAGE_UP:
		case e.DOM_VK_PAGE_DOWN:
		case e.DOM_VK_END:
		case e.DOM_VK_HOME:
		case e.DOM_VK_LEFT:
		case e.DOM_VK_UP:
		case e.DOM_VK_RIGHT:
		case e.DOM_VK_DOWN:
			fillSelectedText();
			break;
		
		default: return;
        }
};

moduleAid.LOADMODULE = function() {
	// Selecting with the caret backwards would always reset the caret back to the end of the selection when calling _find(),
	// we need to work around that so the selection doesn't keep resetting
	if(!this.backups) {
		this.backups = {
			__find: gFindBar.__find
		};
		gFindBar.__find = function(aValue) {
			if(!this._dispatchFindEvent(""))
				return this.nsITypeAheadFind.FIND_PENDING;
			
			var val = aValue || this._findField.value;
			var res = this.nsITypeAheadFind.FIND_NOTFOUND;
			
			// Only search on input if we don't have a last-failed string,
			// or if the current search string doesn't start with it.
			if(this._findFailedString == null || val.indexOf(this._findFailedString) != 0) {
				this._enableFindButtons(val);
				if(this.getElement("highlight").checked)
					this._setHighlightTimeout();
				
				this._updateCaseSensitivity(val);
				
				if(doFastFind) {
					// This is what resets the caret
					var fastFind = this.browser.fastFind;
					res = fastFind.find(val, this._findMode == this.FIND_LINKS);
				} else {
					res = workAroundFastFind(val);
				}
				
				this._updateFoundLink(res);
				this._updateStatusUI(res, false);
				
				if (res == this.nsITypeAheadFind.FIND_NOTFOUND)
					this._findFailedString = val;
				else
					this._findFailedString = null;
			}
			
			if (this._findMode != this.FIND_NORMAL)
				this._setFindCloseTimeout();
			
			if (this._findResetTimeout != -1)
				window.clearTimeout(this._findResetTimeout);
			
			// allow a search to happen on input again after a second has
			// expired since the previous input, to allow for dynamic
			// content and/or page loading
			this._findResetTimeout = window.setTimeout(function(self) {
					self._findFailedString = null;
					self._findResetTimeout = -1; },
				1000, this);
			
			return res;
		};
	}
	
	listenerAid.add(gBrowser, 'mouseup', fillSelectedTextMouseUp);
	listenerAid.add(gBrowser, 'keyup', fillSelectedTextKeyUp);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gBrowser, 'mouseup', fillSelectedTextMouseUp);
	listenerAid.remove(gBrowser, 'keyup', fillSelectedTextKeyUp);
	
	if(this.backups) {
		gFindBar.__find = this.backups.__find;
		delete this.backups;
	}
};
