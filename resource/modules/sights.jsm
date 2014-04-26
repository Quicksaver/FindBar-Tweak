moduleAid.VERSION = '1.6.1';

this.__defineGetter__('preferencesDialog', function() { return (typeof(inPreferences) != 'undefined' && inPreferences); });

this.__defineGetter__('sights', function() {
	var sights = linkedPanel.querySelectorAll('[anonid="findSights"]');
	if(sights.length > 0) {
		return sights[0];
	}
	
	// First the grid itself
	var boxNode = document.createElement('hbox');
	boxNode.setAttribute('anonid', 'findSights');
	boxNode._groups = new Array();
	
	// It shouldn't depend on the stylesheet being loaded, it could error and the browser would be unusable
	boxNode.style.pointerEvents = 'none';
	
	// Insert the box into the tab
	boxNode = (!viewSource) ? gBrowser.mCurrentBrowser.parentNode.appendChild(boxNode) : linkedPanel.appendChild(boxNode);
	
	// We need to make sure the box is resized to the proper window size
	sightsResizeViewSource();
	
	return boxNode;
});

// We pass it scrollLeft and scrollTop because it's much lighter when just getting them once and passing them along instead of getting them every position cycle
this.positionSights = function(sGroup, range, clientHeight, clientWidth, toOwn, PDFtoolbarHeight) {
	// If these aren't set, we just assume the range is visible and should be always sighted, such as in FindAgain (F3) which scrolls to the search hit
	var current = (!clientHeight && !clientWidth);
	var dimensions = range.node.getClientRects()[0];
	if(!dimensions) { return sGroup; } // Something's wrong here, maybe the range has changed in the meantime
	
	var editableNode = (!isPDFJS) ? tweakGetEditableNode(gFindBar, range.node.startContainer) : null;
	var editableRect = (editableNode) ? editableNode.getClientRects()[0] : null;
	
	// We need to account for frames positions as well, as the ranges values are relative to them
	var xMod = 0;
	var yMod = 0;
	
	if(!toOwn) { toOwn = contentDocument; }
	var sameDoc = true;
	var ownDoc = (!isPDFJS) ? range.node.startContainer.ownerDocument : range.node.ownerDocument;
	while(ownDoc != toOwn) {
		sameDoc = false;
		try {
			// We need to check for this inside each frame because the xMod and yMod values change with each
			if(editableNode && editableNode.ownerDocument == ownDoc) {
				if(dimensions.bottom +yMod < editableRect.top
				|| dimensions.top +yMod > editableRect.bottom
				|| dimensions.right +xMod < editableRect.left
				|| dimensions.left +xMod > editableRect.right) {
					range.sights = false;
					return sGroup;
				}
			}
			
			var frame = ownDoc.defaultView.frameElement;
			if(clientHeight && clientWidth) {
				if(dimensions.bottom +yMod < 0
				|| dimensions.top +yMod > frame.clientHeight
				|| dimensions.right +xMod < 0
				|| dimensions.left +xMod > frame.clientWidth) {
					range.sights = false;
					return sGroup;
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
			return sGroup;
		}
	}
	
	if(editableNode && editableNode.ownerDocument == toOwn) {
		if(dimensions.bottom +yMod < editableRect.top
		|| dimensions.top +yMod > editableRect.bottom
		|| dimensions.right +xMod < editableRect.left
		|| dimensions.left +xMod > editableRect.right) {
			range.sights = false;
			return sGroup;
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
			return sGroup;
		}
	}
	
	// On scrolling, only show sights on those that haven't been shown already
	if(range.sights) { return sGroup; }
	range.sights = true;
	
	// Keep our limit
	if(!current && sights.childNodes.length >= prefAid.sightsLimit) { return sGroup; }
	
	var centerX = limitLeft +(dimensions.width /2);
	var centerY = limitTop +(dimensions.height /2);
	
	// Bugfix: sights would not be properly placed when using any kind of zoom factor
	var fullZoom = (viewSource) ? $('content').markupDocumentViewer.fullZoom : gBrowser.mCurrentBrowser.markupDocumentViewer.fullZoom;
	centerX *= fullZoom;
	centerY *= fullZoom;
	
	// Don't add a sight if there's already one with the same coords
	for(var i=0; i<sights.childNodes.length; i++) {
		if(sights.childNodes[i]._sights.top == centerY && sights.childNodes[i]._sights.left == centerY) {
			return sGroup;
		}
	}
	
	var detail = {
		current: current
	};
	if(!sameDoc) {
		detail.ownDoc = (!isPDFJS) ? range.node.startContainer.ownerDocument : range.node.ownerDocument;
		detail.toOwn = toOwn;
	}
	
	return buildSights(sGroup, centerX, centerY, detail);
};

// x and y are the center of the box
this.buildSights = function(sGroup, x, y, detail) {
	if(!detail.style) { detail.style = prefAid.sightsStyle; }
	var style = detail.style;
	
	if(!sGroup) {
		var scrollTop = 0;
		var scrollLeft = 0;
		if(!preferencesDialog) {
			scrollTop = getDocProperty(contentDocument, 'scrollTop');
			scrollLeft = getDocProperty(contentDocument, 'scrollLeft');
			
			if(detail.ownDoc) {
				var ownDoc = detail.ownDoc;
				while(ownDoc != detail.toOwn) {
					// If the text is inside a frame, we take into account its scrollTop and scrollLeft values as well
					scrollTop += getDocProperty(ownDoc, 'scrollTop');
					scrollLeft += getDocProperty(ownDoc, 'scrollLeft');
					
					ownDoc = ownDoc.defaultView.parent.document;
				}
			}
		}
		
		sGroup = {
			allSights: new Array(),
			timer: null,
			style: style,
			current: detail.current || false,
			fullCycles: 0,
			phase: 0,
			maxRepeat: prefAid.sightsRepeat,
			hold: 0,
			ownDoc: (detail.ownDoc) ? detail.ownDoc : null,
			toOwn: (detail.toOwn) ? detail.toOwn : null,
			scrollTop: scrollTop,
			scrollLeft: scrollLeft,
			
			selfRemove: function() {
				if(typeof(sights) == 'undefined') { return; } // Fail-safe for when closing the window while sights are being placed
				
				var allGroups = sights._groups;
				for(var g=0; g<allGroups.length; g++) {
					if(allGroups[g] == this) {
						this.timer.cancel();
						this.removeSights();
						allGroups.splice(g, 1);
						return;
					}
				}
			},
			
			removeSights: function() {
				for(var s=0; s<this.allSights.length; s++) {
					this.allSights[s].remove();
				}
			},
			
			// Method for the sight to auto-update themselves
			updateSights: function() {
				// A few failsafes
				if(typeof(linkedPanel) == 'undefined' || typeof(timerAid) == 'undefined' || UNLOADED) {
					this.selfRemove();
					return;
				}
				
				// Remove hidden sights
				for(var s=0; s<this.allSights.length; s++) {
					if(this.allSights[s].hidden) {
						this.allSights[s].remove();
						this.allSights.splice(s, 1);
						s--;
					}
				}
				if(this.allSights.length == 0) {
					this.selfRemove();
					return;
				}
				
				// We update all sights in the group at the same time, they are all equal (they were created at the same time) so we can use the same values
				var newSize = this.allSights[0].clientWidth +(this.allSights[0].clientLeft *2); // element width plus borders
				if(this.style == 'focus') {
					var newSize = this.allSights[0].clientWidth /1.125;
					
					// Remove the sight when it gets too small
					if(newSize < 40) {
						this.fullCycles++;
						if(this.fullCycles >= this.maxRepeat) {
							this.selfRemove();
							return;
						}
						else {
							newSize = 400 /1.125;
						}
					}
				}
				else if(this.style == 'circle') {
					// Let's hold for a bit
					if(this.phase == 360) {
						if(!this.hold) { this.hold = 5; }
						this.hold--;
					}
					
					if(!this.hold) {
						this.phase += 45;
						
						// Remove when we finish animating
						if(this.phase > 720) {
							this.fullCycles++;
							if(this.fullCycles >= this.maxRepeat) {
								this.selfRemove();
								return;
							}
							else {
								this.phase = 45;
							}
						}
						
						for(var s=0; s<this.allSights.length; s++) {
							var sight = this.allSights[s];
							toggleAttribute(sight, 'gt0', (this.phase <= 180));
							toggleAttribute(sight, 'gt180', (this.phase > 180 && this.phase <= 360));
							toggleAttribute(sight, 'gt360', (this.phase > 360 && this.phase <= 540));
							toggleAttribute(sight, 'gt540', (this.phase > 540));
							sight.childNodes[0].childNodes[0].setAttribute('style', '-moz-transform: rotate('+this.phase+'deg); transform: rotate('+this.phase+'deg);');
						}
					}
				}
				
				// Let's make sure the document actually exists
				try {
					if(preferencesDialog) {
						var scrollTop = this.scrollTop;
						var scrollLeft = this.scrollLeft;
					} else {
						var scrollTop = getDocProperty(contentDocument, 'scrollTop');
						var scrollLeft = getDocProperty(contentDocument, 'scrollLeft');
						
						if(this.ownDoc) {
							var ownDoc = this.ownDoc;
							while(ownDoc != this.toOwn) {
								// If the text is inside a frame, we take into account its scrollTop and scrollLeft values as well
								scrollTop += getDocProperty(ownDoc, 'scrollTop');
								scrollLeft += getDocProperty(ownDoc, 'scrollLeft');;
								
								ownDoc = ownDoc.defaultView.parent.document;
							}
						}
					}
				}
				catch(ex) {
					this.selfRemove();
					return;
				}
				
				var yDelta = 0;
				var xDelta = 0;
				if(scrollTop != this.scrollTop) {
					yDelta = scrollTop -this.scrollTop;
					this.scrollTop = scrollTop;
				}
				if(scrollLeft != this.scrollLeft) {
					var xDelta = scrollLeft -this.scrollLeft;
					this.scrollLeft = scrollLeft;
				}
				
				for(var s=0; s<this.allSights.length; s++) {
					var sight = this.allSights[s];
					
					var newTop = (sight._sights.top -(newSize /2));
					var newLeft = (sight._sights.left -(newSize /2));
					
					newTop -= yDelta;
					newLeft -= xDelta;
					sight._sights.top -= yDelta;
					sight._sights.left -= xDelta;
					
					sight.style.top = newTop+'px';
					sight.style.left = newLeft+'px';
					sight.style.height = newSize+'px';
					sight.style.width = newSize+'px';
				}
			}
		};
		
		sights._groups.push(sGroup);
		sGroup.timer = timerAid.create(sGroup.updateSights, (style == 'focus') ? 25 : 20, 'slack', sGroup);
	};
		
	var box = document.createElement('box');
	box.setAttribute('anonid', 'highlightSights');
	box.setAttribute('sightsStyle', style);
	
	var size = (style == 'focus') ? 400 : 100;
	box.style.height = size+'px';
	box.style.width = size+'px';
	box.style.top = y -(size /2)+'px';
	box.style.left = x -(size /2)+'px';
	
	box._sights = {
		top: y,
		left: x
	};
	toggleAttribute(box, 'current', sGroup.current);
	
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
		
		setAttribute(box, 'gt0', 'true');
	}
	
	sGroup.allSights.push(sights.appendChild(box));
	return sGroup;
};

this.cancelCurrentSights = function() {
	// Hide the current sights
	for(var g=0; g<sights._groups.length; g++) {
		if(sights._groups[g].current) {
			for(var s=0; s<sights._groups[g].allSights.length; s++) {
				sights._groups[g].allSights[s].hidden = true;
			}
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
		
		positionSights(null, { node: sel[0] }, null, null, unWrap.document);
		return;
	}
	
	// Normal HTML files
	var editableNode = tweakFoundEditable(gFindBar);
	var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
	if(controller) {
		var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	} else {
		var sel = tweakGetSelectionController(gFindBar, contentWindow).getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	}
	
	if(sel.rangeCount == 1) {
		// Don't sight emptiness
		var range = sel.getRangeAt(0);
		if(range.startContainer == range.endContainer && range.startOffset == range.endOffset) { return; }
		
		positionSights(null, { node: range });
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
	
	var toOwn = (isPDFJS) ? unWrap.document : contentDocument;
	var clientHeight = getDocProperty(toOwn, 'clientHeight', true);
	var clientWidth = getDocProperty(toOwn, 'clientWidth', true);
	var toolbarHeight = (isPDFJS) ? contentDocument.querySelectorAll('div.toolbar')[0].clientHeight : null;
	
	// We use one sights group for each doc at least
	var previousDoc = null;
	var toGroup = null;
	for(var i=0; i<sights._highlights.length; i++) {
		var doc = (!isPDFJS) ? sights._highlights[i].node.startContainer.ownerDocument : sights._highlights[i].node.ownerDocument;
		if(previousDoc != doc) {
			toGroup = null;
			previousDoc = doc;
		}
		
		toGroup = positionSights(toGroup, sights._highlights[i], clientHeight, clientWidth, toOwn, toolbarHeight);
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

this.cleanHighlightSights = function() {
	delete sights._highlights;
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
		listenerAid.add(window, 'CleanUpHighlights', cleanHighlightSights);
	} else {
		listenerAid.remove(browserPanel, 'scroll', sightsOnScroll, true);
		listenerAid.remove(window, 'UpdatedStatusFindBar', allSightsOnUpdateStatus);
		listenerAid.remove(window, 'UpdatedPDFMatches', allSightsOnUpdateStatus);
		listenerAid.remove(window, 'CleanUpHighlights', cleanHighlightSights);
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
				innerSights[0].remove();
			}
		}
	}
	else {
		var innerSights = $$('[anonid="findSights"]');
		if(innerSights.length > 0) {
			innerSights[0].remove();
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
