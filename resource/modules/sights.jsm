moduleAid.VERSION = '1.4.5';

this.__defineGetter__('preferencesDialog', function() { return (typeof(inPreferences) != 'undefined' && inPreferences); });

this.__defineGetter__('sights', function() {
	var sights = linkedPanel.querySelectorAll('[anonid="findSights"]');
	if(sights.length > 0) {
		return sights[0];
	}
	
	// First the grid itself
	var boxNode = document.createElement('hbox');
	boxNode.setAttribute('anonid', 'findSights');
	
	// It shouldn't depend on the stylesheet being loaded, it could error and the browser would be unusable
	boxNode.style.pointerEvents = 'none';
	
	// Insert the box into the tab
	boxNode = (!viewSource) ? gBrowser.mCurrentBrowser.parentNode.appendChild(boxNode) : linkedPanel.appendChild(boxNode);
	
	// We need to make sure the box is resized to the proper window size
	sightsResizeViewSource();
	
	return boxNode;
});

// We pass it scrollLeft and scrollTop because it's much lighter when just getting them once and passing them along instead of getting them every position cycle
this.positionSights = function(range, scrollTop, scrollLeft, clientHeight, clientWidth, toOwn, PDFtoolbarHeight) {
	// If these aren't set, we just assume the range is visible and should be always sighted, such as in FindAgain (F3) which scrolls to the search hit
	var current = (!clientHeight && !clientWidth);
	var dimensions = range.node.getClientRects()[0];
	if(!dimensions) { return; } // Something's wrong here, maybe the range has changed in the meantime
	
	var editableNode = (!isPDFJS) ? gFindBar._getEditableNode(range.node.startContainer) : null;
	var editableRect = (editableNode) ? editableNode.getClientRects()[0] : null;
	
	// We need to account for frames positions as well, as the ranges values are relative to them
	var xMod = 0;
	var yMod = 0;
	
	if(!toOwn) { toOwn = contentDocument; }
	var ownDoc = (!isPDFJS) ? range.node.startContainer.ownerDocument : range.node.ownerDocument;
	while(ownDoc != toOwn) {
		try {
			// We need to check for this inside each frame because the xMod and yMod values change with each
			if(editableNode && editableNode.ownerDocument == ownDoc) {
				if(dimensions.bottom +yMod < editableRect.top
				|| dimensions.top +yMod > editableRect.bottom
				|| dimensions.right +xMod < editableRect.left
				|| dimensions.left +xMod > editableRect.right) {
					range.sights = false;
					return;
				}
			}
			
			var frame = ownDoc.defaultView.frameElement;
			if(clientHeight && clientWidth) {
				if(dimensions.bottom +yMod < 0
				|| dimensions.top +yMod > frame.clientHeight
				|| dimensions.right +xMod < 0
				|| dimensions.left +xMod > frame.clientWidth) {
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
	
	if(editableNode && editableNode.ownerDocument == toOwn) {
		if(dimensions.bottom +yMod < editableRect.top
		|| dimensions.top +yMod > editableRect.bottom
		|| dimensions.right +xMod < editableRect.left
		|| dimensions.left +xMod > editableRect.right) {
			range.sights = false;
			return;
		}
	}
	
	var offsetCompare = 0;
	if(PDFtoolbarHeight) { offsetCompare += PDFtoolbarHeight; }
	
	var limitTop = dimensions.top +yMod;
	var limitLeft = dimensions.left +xMod;
	
	if(clientHeight && clientWidth) {
		var limitBottom = dimensions.bottom +yMod;
		var limitRight = dimensions.right +xMod;
		if(limitBottom < 0 +offsetCompare
		|| limitTop > clientHeight +offsetCompare
		|| limitRight < 0
		|| limitLeft > clientWidth) {
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
this.buildSights = function(x, y, scrollLeft, scrollTop, current, style) {
	if(!style) { style = prefAid.sightsStyle; }
	
	var box = document.createElement('box');
	box.setAttribute('anonid', 'highlightSights');
	box.setAttribute('sightsStyle', style);
	box.style.height = (style == 'focus') ? '400px' : '100px';
	box.style.width = (style == 'focus') ? '400px' : '100px';
	
	box._sights = {
		top: y,
		left: x,
		scrollTop: scrollTop,
		scrollLeft: scrollLeft,
		current: current || false,
		preferences: preferencesDialog,
		style: style,
		phase: 0,
		fullCycles: 0,
		maxRepeat: prefAid.sightsRepeat,
		timer: null
	};
	toggleAttribute(box, 'current', box._sights.current);
	
	if(style == 'circle') {
		var innerContainer = document.createElement('box');
		var otherInnerContainer = innerContainer.cloneNode();
		var innerBox = innerContainer.cloneNode();
		var otherInnerBox = innerContainer.cloneNode();
		innerContainer.setAttribute('innerContainer', 'true');
		otherInnerContainer.setAttribute('innerContainer', 'true');
		otherInnerContainer.setAttribute('class', 'otherHalf');
		innerContainer.appendChild(innerBox);
		otherInnerContainer.appendChild(otherInnerBox);
		box.appendChild(innerContainer);
		box.appendChild(otherInnerContainer);
	}
	
	// Method for the sight to auto-update itself
	box.updateSights = function() {
		// A few failsafes
		if(typeof(linkedPanel) == 'undefined' || typeof(timerAid) == 'undefined' || UNLOADED || this.hidden) {
			if(this._sights.timer) { this._sights.timer.cancel(); }
			this.parentNode.removeChild(this);
			return;
		}
		
		var newSize = this.clientWidth +(this.clientLeft *2); // element width plus borders
		if(this._sights.style == 'focus') {
			var newSize = this.clientWidth /1.5;
			
			// Remove the sight when it gets too small
			if(newSize < 40) {
				this._sights.fullCycles++;
				if(this._sights.fullCycles == this._sights.maxRepeat) {
					if(this._sights.timer) { this._sights.timer.cancel(); }
					this.parentNode.removeChild(this);
					return;
				}
				else {
					newSize = 400 /1.5;
				}
			}
		}
		else if(this._sights.style == 'circle') {
			// Let's hold for a bit
			if(this._sights.phase == 360) {
				if(!this._sights.hold) { this._sights.hold = 5; }
				this._sights.hold--;
			}
			
			if(!this._sights.hold) {
				this._sights.phase += 45;
				
				// Remove when we finish animating
				if(this._sights.phase > 720) {
					this._sights.fullCycles++;
					if(this._sights.fullCycles == this._sights.maxRepeat) {
						if(this._sights.timer) { this._sights.timer.cancel(); }
						this.parentNode.removeChild(this);
						return;
					}
					else {
						this._sights.phase = 45;
					}
				}
				
				toggleAttribute(this, 'gt0', (this._sights.phase <= 180));
				toggleAttribute(this, 'gt180', (this._sights.phase > 180 && this._sights.phase <= 360));
				toggleAttribute(this, 'gt360', (this._sights.phase > 360 && this._sights.phase <= 540));
				toggleAttribute(this, 'gt540', (this._sights.phase > 540));
				this.childNodes[0].childNodes[0].setAttribute('style', '-moz-transform: rotate('+this._sights.phase+'deg); transform: rotate('+this._sights.phase+'deg);');
			}
		}
		
		// Let's make sure the document actually exists
		try {
			if(this._sights.preferences) {
				var scrollTop = this.scrollTop;
				var scrollLeft = this.scrollLeft;
			} else if(isPDFJS) {
				var scrollTop = contentDocument.getElementById('viewerContainer').scrollTop;
				var scrollLeft = contentDocument.getElementById('viewerContainer').scrollLeft;
			} else {
				var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
				var scrollLeft = contentDocument.getElementsByTagName('html')[0].scrollLeft || contentDocument.getElementsByTagName('body')[0].scrollLeft;
			}
		}
		catch(ex) {
			if(this._sights.timer) { this._sights.timer.cancel(); }
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
		
		if(!this._sights.timer) {
			this._sights.timer = timerAid.create(this.updateSights, (this._sights.style == 'focus') ? 100 : 20, 'slack', this);
		}
	}
	
	sights.appendChild(box);
	box.updateSights();
};

this.cancelCurrentSights = function() {
	// Hide the current sights
	for(var i=0; i<sights.childNodes.length; i++) {
		if(sights.childNodes[i]._sights.current) {
			sights.childNodes[i].hidden = true;
		}
	}
};

this.delayCurrentSights = function(e) {
	timerAid.init('delayCurrentSights', function() { currentSights(e); }, 10);
};

this.currentSights = function(e) {
	cancelCurrentSights();
	
	// order could come from another window from FIT
	if(e && e.detail && typeof(e.detail.retValue) != 'undefined') {
		if(!gFindBar._findField.value || e.detail.retValue == gFindBar.nsITypeAheadFind.FIND_NOTFOUND) { return; }
	}
	
	if(!contentWindow) { return; } // Usually triggered when a selection is on a frame and the frame closes
	
	// For pdf in PDF.JS
	if(isPDFJS) {
		try {
			var scrollTop = contentDocument.getElementById('viewerContainer').scrollTop;
			var scrollLeft = contentDocument.getElementById('viewerContainer').scrollLeft;
		}
		catch(ex) { return; }
		
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(contentWindow);
		if(unWrap.PDFFindController.selected.matchIdx == -1 || unWrap.PDFFindController.selected.pageIdx == -1) { return; }
		
		// Let's get the right one
		var page = unWrap.PDFView.pages[unWrap.PDFFindController.selected.pageIdx];
		if(!page.textLayer
		|| !page.textLayer.matches
		|| !page.textLayer.matches[unWrap.PDFFindController.selected.matchIdx]) {
			timerAid.init('currentSights', currentSights, 10);
			return;
		}
		
		var sel = page.textLayer.textDivs[page.textLayer.matches[unWrap.PDFFindController.selected.matchIdx].begin.divIdx].querySelectorAll('.highlight.selected');
		if(sel.length == 0) { return; }
		
		// This is so it doesn't sight the previous selected element while the user is typing in the findbar
		if(sel[0]._findWord && gFindBar._findField.value != sel[0]._findWord) { return; }
		sel[0]._findWord = gFindBar._findField.value;
		
		positionSights({ node: sel[0] }, scrollTop, scrollLeft, null, null, unWrap.document);
		return;
	}
	
	// Normal HTML files
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
	if(!prefAid.sightsHighlights) { return; } // I don't know if this is possible, but I added it before so let's make sure
	
	if(aHighlights && !isPDFJS) {
		sights._highlights = aHighlights;
		sights._findWord = gFindBar._findField.value;
		if(!documentHighlighted) { return; } // I don't know if this is possible either but it's also in the checks below
	}
	else if(isPDFJS) {
		if(!gFindBar._findField.value || !gFindBar.getElement('highlight').checked) {
			delete sights._highlights;
			delete sights._findWord;
			return;
		}
		
		if(sights._findWord && sights._findWord != gFindBar._findField.value) {
			sights._highlights = [];
			sights._findWord = gFindBar._findField.value;
		}
		
		if(!sights._highlights) {
			sights._highlights = [];
		}
		
		var unWrap = aHighlights.unWrap;
		var pages = aHighlights.visible.views; // This is actually the visible pages array returned from allSightsOnPDFStatus()
		var matches = unWrap.PDFFindController.pageMatches;
		
		// To remove unnecessary extra looping through all arrays, this could become problematic with lots of matches
		var visibleMatches = [];
		for(var i=0; i<sights._highlights.length; i++) {
			if(!sights._highlights[i].sights) { continue; }
			for(var p=0; p<pages.length; p++) {
				if(sights._highlights[i].coords.p == pages[p].view.id) {
					visibleMatches.push(sights._highlights[i].coords);
				}
			}
		}
		sights._highlights = [];
		
		for(var p=0; p<pages.length; p++) {
			for(var m=0; m<pages[p].view.textLayer.matches.length; m++) {
				var match = pages[p].view.textLayer.matches[m];
				var divs = pages[p].view.textLayer.textDivs;
				if(divs.length <= match.begin.divIdx) { continue; } // This shouldn't happen
				
				var div = divs[match.begin.divIdx];
				var maxOffset = match.begin.offset;
				var offset = 0;
				var child = 0;
				while(offset <= maxOffset) {
					if(div.childNodes[child].localName == 'span') {
						if(offset == maxOffset) { break; }
						offset += div.childNodes[child].childNodes[0].length;
						child++;
					} else {
						offset += div.childNodes[child].length;
						child++;
					}
				}
				if(offset > maxOffset) { continue; } // This shouldn't happen either
				
				var newRange = {
					node: div.childNodes[child],
					sights: false,
					coords: { p: pages[p].id, m: m }
				};
				
				for(var v=0; v<visibleMatches.length; v++) {
					if(visibleMatches[v].p == pages[p].id && visibleMatches[v].m == m) {
						newRange.sights = true;
						break;
					}
				}
				
				sights._highlights.push(newRange);
			}
		}
		
		sights._findWord = gFindBar._findField.value;
	}
	else if(!sights._highlights || !documentHighlighted || gFindBar._findField.value != sights._findWord) { return; }
	
	// Let's make sure the document actually exists
	try {
		if(!isPDFJS) {
			var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
			var scrollLeft = contentDocument.getElementsByTagName('html')[0].scrollLeft || contentDocument.getElementsByTagName('body')[0].scrollLeft;
			var clientHeight = Math.min(contentDocument.getElementsByTagName('html')[0].clientHeight, contentDocument.getElementsByTagName('body')[0].clientHeight);
			var clientWidth = Math.min(contentDocument.getElementsByTagName('html')[0].clientWidth, contentDocument.getElementsByTagName('body')[0].clientWidth);
		} else {
			var scrollTop = contentDocument.getElementById('viewerContainer').scrollTop;
			var scrollLeft = contentDocument.getElementById('viewerContainer').scrollLeft;
			var clientHeight = contentDocument.getElementById('viewerContainer').clientHeight;
			var clientWidth = contentDocument.getElementById('viewerContainer').clientWidth;
			var toolbarHeight = contentDocument.querySelectorAll('div.toolbar')[0].clientHeight;
		}
	}
	catch(ex) { return; }
	
	for(var i=0; i<sights._highlights.length; i++) {
		positionSights(sights._highlights[i], scrollTop, scrollLeft, clientHeight, clientWidth, (isPDFJS) ? unWrap.document : contentDocument, (isPDFJS) ? toolbarHeight : null);
	}
};

this.sightsOnScroll = function() {
	if(!isPDFJS) {
		timerAid.init('sightsOnScroll', function() { sightsOnVisibleHighlights(); }, 10);
	} else {
		allSightsOnUpdateStatus();
	}
};

this.currentSightsOnUpdateStatus = function() {
	// We only need this in pdf documents, the 'FoundAgain' listener will handle the other documents.
	if(isPDFJS) { cancelCurrentSights(); }
	
	// We do with a delay to allow the page to render the selected element
	timerAid.init('currentSightsOnUpdateStatus', currentSightsOnPDFStatus, 10);
};

this.currentSightsOnPDFStatus = function() {
	if(isPDFJS) {
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(contentWindow);
		if(!unWrap.PDFFindController || unWrap.PDFFindController.selected.matchIdx == -1 || unWrap.PDFFindController.selected.pageIdx == -1) { return; }
		
		if(!unWrap.PDFView.pages[unWrap.PDFFindController.selected.pageIdx].textLayer
		|| !unWrap.PDFView.pages[unWrap.PDFFindController.selected.pageIdx].textLayer.renderingDone
		|| unWrap.PDFView.pages[unWrap.PDFFindController.selected.pageIdx].renderingState < 3) {
			timerAid.init('currentSightsOnUpdateStatus', currentSightsOnPDFStatus, 10);
			return;
		}
		
		currentSights();
	}
};

this.allSightsOnUpdateStatus = function(e) {
	// We only need this in pdf documents, the 'FoundAgain' listener will handle the other documents.
	// We do with a delay to allow the page to render the selected element
	// !e means it comes from scroll event, when it comes from UpdateStatusUI it should delay for longer to allow the document to render the new highlights
	timerAid.init('allSightsOnUpdateStatus', allSightsOnPDFStatus, (e) ? 350 : 10);
};

this.allSightsOnPDFStatus = function() {
	if(isPDFJS) {
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(contentWindow);
		if(!unWrap.PDFFindController || !unWrap.PDFView) { return; }
		
		// We should wait until the visible pages have finished rendering
		var visible = unWrap.PDFView.getVisiblePages();
		for(var p=0; p<visible.views.length; p++) {
			if(!visible.views[p].view.textLayer
			|| !visible.views[p].view.textLayer.renderingDone
			|| visible.views[p].view.renderingState < 3) {
				timerAid.init('allSightsOnUpdateStatus', allSightsOnPDFStatus, 10);
				return;
			}
		}
		
		sightsOnVisibleHighlights({ unWrap: unWrap, visible: visible });
	}
};

this.sightsColor = function(forceSheet) {
	if(!forceSheet && ((!prefAid.sightsCurrent && !prefAid.sightsHighlights) || preferencesDialog)) { return; }
	
	var sheetName = (forceSheet) ? 'sightsColorPref' : 'sightsColor';
	styleAid.unload(sheetName);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	if(forceSheet) {
		sscode += '@-moz-document url("chrome://findbartweak/content/options.xul") {\n';
	} else {
		sscode += '@-moz-document\n';
		sscode += '	url("chrome://browser/content/browser.xul"),\n';
		sscode += '	url("chrome://global/content/viewSource.xul"),\n';
		sscode += '	url("chrome://global/content/viewPartialSource.xul") {\n';
	}
	
	var color = forceSheet || (prefAid.sightsSameColor ? prefAid.selectColor : prefAid.sightsSameColorAll ? prefAid.highlightColor : prefAid.sightsColor);
	var m = color.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
	if(!m) { return; }
	var rgb = getRGBfromString(m);
	
	var c = rgb.r+','+rgb.g+','+rgb.b;
	var o = (darkBackgroundRGB(rgb)) ? '255,255,255' : '0,0,0';
	
	sscode += ' box[anonid="highlightSights"][sightsStyle="focus"][current],\n';
	sscode += ' box[anonid="highlightSights"][sightsStyle="circle"][current] box[innerContainer] box {\n';
	sscode += '  -moz-border-top-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-bottom-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-left-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-right-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += ' }\n';
	
	if(forceSheet) {
		styleAid.load(sheetName, sscode, true);
		return;
	}
	
	var color = prefAid.sightsAllSameColor ? prefAid.highlightColor : prefAid.sightsAllColor;
	var m = color.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
	if(!m) { return; }
	var rgb = getRGBfromString(m);
	
	var c = rgb.r+','+rgb.g+','+rgb.b;
	var o = (darkBackgroundRGB(rgb)) ? '255,255,255' : '0,0,0';
	
	sscode += ' box[anonid="highlightSights"][sightsStyle="focus"]:not([current]),\n';
	sscode += ' box[anonid="highlightSights"][sightsStyle="circle"]:not([current]) box[innerContainer] box {\n';
	sscode += '  -moz-border-top-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-bottom-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-left-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += '  -moz-border-right-colors: rgba('+c+',0.25) rgba('+c+',0.95) rgba('+o+',0.7) rgb('+c+') rgba('+c+', 0.85) rgba('+o+', 0.5) rgba('+c+', 0.4) rgba('+c+', 0.15) !important;\n';
	sscode += ' }\n';
	
	sscode += '}';
	
	styleAid.load(sheetName, sscode, true);
};

this.delaySightsResizeViewSource = function() {
	timerAid.init('resizeViewSource', sightsResizeViewSource, 0);
};

this.sightsResizeViewSource = function() {
	if(!viewSource) { return; }
	
	var contentPos = $('content').getBoundingClientRect();
	sights.style.top = contentPos.top+'px';
	sights.style.height = contentPos.height+'px';
	listenerAid.add(viewSource, 'resize', delaySightsResizeViewSource);
};

this.preferencesColorListener = function() {
	sightsColor($($('pref-sightsSameColor').value ? 'selectColor' : $('pref-sightsSameColorAll').value ? 'highlightsColor' : 'sightsColor').getAttribute('color'));
};

this.toggleSightsCurrent = function() {
	if(prefAid.sightsCurrent) {
		listenerAid.add(window, 'FoundFindBar', currentSights);
		listenerAid.add(window, 'FoundAgain', currentSights);
		listenerAid.add(window, 'UpdatedStatusFindBar', currentSightsOnUpdateStatus);
		listenerAid.add(window, 'SelectedFIThit', delayCurrentSights);
	} else {
		listenerAid.remove(window, 'FoundFindBar', currentSights);
		listenerAid.remove(window, 'FoundAgain', currentSights);
		listenerAid.remove(window, 'UpdatedStatusFindBar', currentSightsOnUpdateStatus);
		listenerAid.remove(window, 'SelectedFIThit', delayCurrentSights);
	}
	
	observerAid.notify('ReHighlightAll');
};

this.toggleSightsHighlights = function() {
	if(prefAid.sightsHighlights) {
		listenerAid.add(browserPanel, 'scroll', sightsOnScroll, true);
		listenerAid.add(window, 'UpdatedStatusFindBar', allSightsOnUpdateStatus);
		listenerAid.add(window, 'UpdatedPDFMatches', allSightsOnUpdateStatus);
	} else {
		listenerAid.remove(browserPanel, 'scroll', sightsOnScroll, true);
		listenerAid.remove(window, 'UpdatedStatusFindBar', allSightsOnUpdateStatus);
		listenerAid.remove(window, 'UpdatedPDFMatches', allSightsOnUpdateStatus);
	}
	
	observerAid.notify('ReHighlightAll');
};

moduleAid.LOADMODULE = function() {
	if(preferencesDialog) {
		listenerAid.add($('pref-sightsSameColor'), 'change', preferencesColorListener);
		listenerAid.add($('pref-sightsSameColorAll'), 'change', preferencesColorListener);
		objectWatcher.addAttributeWatcher($('selectColor'), 'color', preferencesColorListener);
		objectWatcher.addAttributeWatcher($('highlightsColor'), 'color', preferencesColorListener);
		objectWatcher.addAttributeWatcher($('sightsColor'), 'color', preferencesColorListener);
		preferencesColorListener();
		return;
	}
	
	prefAid.listen('selectColor', sightsColor);
	prefAid.listen('highlightColor', sightsColor);
	prefAid.listen('sightsColor', sightsColor);
	prefAid.listen('sightsSameColor', sightsColor);
	prefAid.listen('sightsSameColorAll', sightsColor);
	prefAid.listen('sightsAllColor', sightsColor);
	prefAid.listen('sightsAllSameColor', sightsColor);
	prefAid.listen('sightsCurrent', toggleSightsCurrent);
	prefAid.listen('sightsHighlights', toggleSightsHighlights);
	
	sightsColor();
	toggleSightsCurrent();
	toggleSightsHighlights();
}

moduleAid.UNLOADMODULE = function() {
	if(preferencesDialog) {
		styleAid.unload('sightsColorPref');
		listenerAid.remove($('pref-sightsSameColor'), 'change', preferencesColorListener);
		listenerAid.remove($('pref-sightsSameColorAll'), 'change', preferencesColorListener);
		objectWatcher.removeAttributeWatcher($('selectColor'), 'color', preferencesColorListener);
		objectWatcher.removeAttributeWatcher($('highlightsColor'), 'color', preferencesColorListener);
		objectWatcher.removeAttributeWatcher($('sightsColor'), 'color', preferencesColorListener);
		return;
	}
	
	listenerAid.remove(window, 'FoundFindBar', currentSights);
	listenerAid.remove(window, 'FoundAgain', currentSights);
	listenerAid.remove(window, 'UpdatedStatusFindBar', currentSightsOnUpdateStatus);
	listenerAid.remove(window, 'UpdatedStatusFindBar', allSightsOnUpdateStatus);
	listenerAid.remove(window, 'UpdatedPDFMatches', allSightsOnUpdateStatus);
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
	
	prefAid.unlisten('selectColor', sightsColor);
	prefAid.unlisten('highlightColor', sightsColor);
	prefAid.unlisten('sightsColor', sightsColor);
	prefAid.unlisten('sightsSameColor', sightsColor);
	prefAid.unlisten('sightsSameColorAll', sightsColor);
	prefAid.unlisten('sightsAllColor', sightsColor);
	prefAid.unlisten('sightsAllSameColor', sightsColor);
	prefAid.unlisten('sightsCurrent', toggleSightsCurrent);
	prefAid.unlisten('sightsHighlights', toggleSightsHighlights);
	
	if(UNLOADED || (!prefAid.sightsCurrent && !prefAid.sightsHighlights)) {
		styleAid.unload('sightsColor');
	}
	
	if(!UNLOADED && !window.closed && !window.willClose) {
		observerAid.notify('ReHighlightAll');
	}
};
