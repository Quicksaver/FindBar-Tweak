moduleAid.VERSION = '1.1.0';

this.__defineGetter__('sights', function() {
	var sights = linkedPanel.querySelectorAll('[anonid="findSights"]');
	if(sights.length > 0) {
		return sights[0];
	}
	
	// First the grid itself
	var boxNode = document.createElement('hbox');
	boxNode.setAttribute('anonid', 'findSights');
	
	// It shouldn't depend on the stylesheet being loaded, it could error and the browser would be unusable
	boxNode.setAttribute('style', 'pointer-events: none;');
	
	// Insert the box into the tab
	boxNode = (!viewSource) ? gBrowser.mCurrentBrowser.parentNode.appendChild(boxNode) : linkedPanel.appendChild(boxNode);
	
	// We need to make sure the box is resized to the proper window size
	sightsResizeViewSource();
	
	return boxNode;
});

// We pass it scrollLeft and scrollTop because it's much lighter when just getting them once and passing them along instead of getting them every position cycle
this.positionSights = function(range, scrollTop, scrollLeft, clientHeight, clientWidth) {
	// If these aren't set, we just assume the range is visible and should be always sighted, such as in FindAgain (F3) which scrolls to the search hit
	var current = (!clientHeight && !clientWidth);
	var dimensions = range.node.getClientRects()[0];
	
	// We need to account for frames positions as well, as the ranges values are relative to them
	var xMod = 0;
	var yMod = 0;
	
	var ownDoc = range.node.startContainer.ownerDocument;
	while(ownDoc != contentDocument) {
		try {
			var frame = ownDoc.defaultView.frameElement;
			if(clientHeight && clientWidth) {
				if(dimensions.bottom +yMod < 0 || dimensions.top +yMod > frame.clientHeight || dimensions.right +xMod < 0 || dimensions.left +xMod > frame.clientWidth) {
					range.sights = false;
					return;
				}
			}
			
			var frameElementRect = frame.getClientRects()[0];
			xMod += frameElementRect.left;
			yMod += frameElementRect.top;
			
			ownDoc = ownDoc.defaultView.parent.document;
		}
		// failsafe
		catch(ex) {
			range.sights = false;
			return;
		}
	}
	
	var limitTop = dimensions.top +yMod;
	var limitLeft = dimensions.left +xMod;
	
	if(clientHeight && clientWidth) {
		var limitBottom = dimensions.bottom +yMod;
		var limitRight = dimensions.right +xMod;
		if(limitBottom < 0 || limitTop > clientHeight || limitRight < 0 || limitLeft > clientWidth) {
			range.sights = false;
			return;
		}
	}
	
	// On scrolling, only show sights on those that haven't been shown already
	if(range.sights) { return; }
	range.sights = true;
	
	var centerX = limitLeft +(dimensions.width /2);
	var centerY = limitTop +(dimensions.height /2);
	
	// Don't add a sight if there's already one with the same coords
	for(var i=0; i<sights.childNodes.length; i++) {
		if(sights.childNodes[i]._sights.top == centerY && sights.childNodes[i]._sights.left == centerY) {
			return;
		}
	}
	
	buildSights(centerX, centerY, scrollLeft, scrollTop, current);
};

// x and y are the center of the box
this.buildSights = function(x, y, scrollLeft, scrollTop, current) {
	var box = document.createElement('box');
	box.setAttribute('anonid', 'highlightSights');
	box.style.height = '400px';
	box.style.width = '400px';
	
	box._sights = {
		top: y,
		left: x,
		scrollTop: scrollTop,
		scrollLeft: scrollLeft,
		current: current || false,
		timer: null
	};
	
	// Method for the sight to auto-update itself
	box.updateSights = function() {
		// A few failsafes
		if(typeof(linkedPanel) == 'undefined' || typeof(timerAid) == 'undefined' || UNLOADED || this.hidden) {
			this.parentNode.removeChild(this);
			return;
		}
		
		var newSize = this.clientWidth /1.5;
		
		// Remove the sight when it gets too small
		if(newSize < 40) {
			this.parentNode.removeChild(this);
			return;
		}
		
		// Let's make sure the document actually exists
		try {
			var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
			var scrollLeft = contentDocument.getElementsByTagName('html')[0].scrollLeft || contentDocument.getElementsByTagName('body')[0].scrollLeft;
		}
		catch(ex) {
			this.parentNode.removeChild(this);
			return;
		}
		
		var newTop = (this._sights.top -(newSize /2));
		var newLeft = (this._sights.left -(newSize /2));
		if(scrollTop != this._sights.scrollTop) { newTop -= (scrollTop -this._sights.scrollTop); }
		if(scrollLeft != this._sights.scrollLeft) { newLeft -= (scrollLeft -this._sights.scrollLeft); }
		
		this.style.top = newTop+'px';
		this.style.left = newLeft+'px';
		this.style.height = newSize+'px';
		this.style.width = newSize+'px';
		
		this._sights.timer = timerAid.create(this.updateSights, 100, 'once', this);
	}
	
	sights.appendChild(box);
	box.updateSights();
};

this.currentSights = function(e) {
	// Hide the current sights
	for(var i=0; i<sights.childNodes.length; i++) {
		if(sights.childNodes[i]._sights.current) {
			sights.childNodes[i].hidden = true;
		}
	}
	
	if(!gFindBar._findField.value || e.detail.retValue == gFindBar.nsITypeAheadFind.FIND_NOTFOUND) { return; }
	
	var contentWindow = gFindBar.browser._fastFind.currentWindow || gFindBar.browser.contentWindow;
	if(!contentWindow) { return; } // Usually triggered when a selection is on a frame and the frame closes
	
	// Let's make sure the document actually exists
	try {
		var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
		var scrollLeft = contentDocument.getElementsByTagName('html')[0].scrollLeft || contentDocument.getElementsByTagName('body')[0].scrollLeft;
	}
	catch(ex) { return; }
		
	var editableNode = gFindBar.browser._fastFind.foundEditable;
	var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
	if(controller) {
		var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	} else {
		var sel = gFindBar._getSelectionController(contentWindow).getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	}
	
	if(sel.rangeCount == 1) {
		positionSights({ node: sel.getRangeAt(0) }, scrollTop, scrollLeft);
	}
};

this.sightsOnVisibleHighlights = function(aHighlights) {
	if(aHighlights) {
		sights._highlights = aHighlights;
		sights._findWord = gFindBar._findField.value;
	}
	
	if(!prefAid.sightsHighlights || !sights._highlights || !documentHighlighted || gFindBar._findField.value != sights._findWord) { return; }
	
	// Let's make sure the document actually exists
	try {
		var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
		var scrollLeft = contentDocument.getElementsByTagName('html')[0].scrollLeft || contentDocument.getElementsByTagName('body')[0].scrollLeft;
		var clientHeight = Math.min(contentDocument.getElementsByTagName('html')[0].clientHeight, contentDocument.getElementsByTagName('body')[0].clientHeight);
		var clientWidth = Math.min(contentDocument.getElementsByTagName('html')[0].clientWidth, contentDocument.getElementsByTagName('body')[0].clientWidth);
	}
	catch(ex) { return; }
	
	for(var i=0; i<sights._highlights.length; i++) {
		positionSights(sights._highlights[i], scrollTop, scrollLeft, clientHeight, clientWidth);
	}
};

this.sightsOnScroll = function() {
	timerAid.init('sightsOnScroll', function() { sightsOnVisibleHighlights(); }, 10);
};

this.sightsColor = function() {
	if(!prefAid.sightsCurrent) { return; }
	
	var m = prefAid.highlightColor.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
	if(!m) { return; }
	if(m[1].length === 6) { // 6-char notation
		var rgb = {
			r: parseInt(m[1].substr(0,2),16),
			g: parseInt(m[1].substr(2,2),16),
			b: parseInt(m[1].substr(4,2),16)
		};
	} else { // 3-char notation
		var rgb = {
			r: parseInt(m[1].charAt(0)+m[1].charAt(0),16),
			g: parseInt(m[1].charAt(1)+m[1].charAt(1),16),
			b: parseInt(m[1].charAt(2)+m[1].charAt(2),16)
		};
	}
	
	var c = rgb.r+','+rgb.g+','+rgb.b;
	var o = (0.213 * (rgb.r /255) + 0.715 * (rgb.g /255) + 0.072 * (rgb.b /255) < 0.5) ? '255,255,255' : '0,0,0';
	
	styleAid.unload('sightsColor');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("chrome://browser/content/browser.xul"), url("chrome://global/content/viewSource.xul") {\n';
	sscode += ' box[anonid="highlightSights"] {\n';
	sscode += '  -moz-border-top-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-bottom-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-left-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-right-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += ' }\n';
	sscode += '}';
	
	styleAid.load('sightsColor', sscode, true);
};

this.delaySightsResizeViewSource = function() {
	timerAid.init('resizeViewSource', sightsResizeViewSource, 0);
};

this.sightsResizeViewSource = function() {
	if(!viewSource) { return; }
	
	var styleString = 'top: '+$('viewSource-toolbox').clientHeight+'px;';
	styleString += ' height: '+$('content').clientHeight+'px;';
	setAttribute($$('[anonid="findSights"]')[0], 'style', styleString);
	listenerAid.add(viewSource, 'resize', delaySightsResizeViewSource);
};

this.toggleSightsCurrent = function() {
	if(prefAid.sightsCurrent) {
		listenerAid.add(gFindBar, 'FoundFindBar', currentSights);
		listenerAid.add(gFindBar, 'FoundAgain', currentSights);
	} else {
		listenerAid.remove(gFindBar, 'FoundFindBar', currentSights);
		listenerAid.remove(gFindBar, 'FoundAgain', currentSights);
	}
	
	observerAid.notify('ReHighlightAll');
};

this.toggleSightsHighlights = function() {
	if(prefAid.sightsHighlights) {
		listenerAid.add(browserPanel, 'scroll', sightsOnScroll);
	} else {
		listenerAid.remove(browserPanel, 'scroll', sightsOnScroll);
	}
	
	observerAid.notify('ReHighlightAll');
};

moduleAid.LOADMODULE = function() {
	prefAid.listen('highlightColor', sightsColor);
	prefAid.listen('sightsCurrent', toggleSightsCurrent);
	prefAid.listen('sightsHighlights', toggleSightsHighlights);
	
	sightsColor();
	toggleSightsCurrent();
	toggleSightsHighlights();
}

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'FoundFindBar', currentSights);
	listenerAid.remove(gFindBar, 'FoundAgain', currentSights);
	listenerAid.remove(browserPanel, 'scroll', sightsOnScroll);
	
	if(!viewSource) {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var panel = $(gBrowser.mTabs[t].linkedPanel);
			var innerSights = panel.querySelectorAll('[anonid="findSights"]');
			if(innerSights.length > 0) {
				innerSights[0].parentNode.removeChild(innerSights[0]);
			}
		}
	}
	else {
		var innerSights = $$('[anonid="findSights"]');
		if(innerSights.length > 0) {
			innerSights[0].parentNode.removeChild(innerSights[0]);
		}
		listenerAid.remove(viewSource, 'resize', delaySightsResizeViewSource);
	}
	
	prefAid.unlisten('highlightColor', sightsColor);
	prefAid.unlisten('sightsCurrent', toggleSightsCurrent);
	prefAid.unlisten('sightsHighlights', toggleSightsHighlights);
	
	if(UNLOADED || !prefAid.sightsCurrent) {
		styleAid.unload('sightsColor');
	}
	
	if(!UNLOADED && !window.closed && !window.willClose) {
		observerAid.notify('ReHighlightAll');
	}
};
