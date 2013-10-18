moduleAid.VERSION = '1.4.5';

this.__defineGetter__('grid', function() {
	var grids = (!viewSource) ? linkedPanel.querySelectorAll('[anonid="findGrid"]') : $$('[anonid="findGrid"]');
	if(grids.length > 0) {
		return grids[0];
	}
	
	var boxNode = templateGrid.cloneNode(templateGrid, true);
	boxNode.firstChild._frames = new Array();
	boxNode.firstChild._lastUsedRow = -1;
	initGridArrays(boxNode.firstChild);
	
	// Insert the grid into the tab
	boxNode = (!viewSource) ? gBrowser.mCurrentBrowser.parentNode.appendChild(boxNode) : linkedPanel.appendChild(boxNode);
	
	return boxNode.firstChild;
});

this.templateGrid = null;

// Creates a new grid
this.createGrid = function(doc, html) {
	// First the grid itself
	var boxNode = doc.createElement((html) ? 'div' : 'hbox');
	boxNode.setAttribute('anonid', 'gridBox');
	
	// It shouldn't depend on the stylesheet being loaded, it could error and the browser would be unusable
	boxNode.style.pointerEvents = 'none';
	
	var gridNode = doc.createElement((html) ? 'div' : 'vbox');
	gridNode.setAttribute('anonid', 'findGrid');
	gridNode = boxNode.appendChild(gridNode);
	
	// Starting with the top spacer
	var topspacer = doc.createElement((html) ? 'div' : 'vbox');
	topspacer.setAttribute('flex', '0');
	topspacer.setAttribute('class', 'topSpacer');
	topspacer = gridNode.appendChild(topspacer);
	
	// Container for the highlight rows
	var container = doc.createElement((html) ? 'div' : 'vbox');
	container.setAttribute('flex', '1');
	container = gridNode.appendChild(container);
	
	// Row template, so I can just clone from this
	var row = doc.createElement((html) ? 'div' : 'vbox');
	row.style.minHeight = '2px';
	container.appendChild(row);
	adjustGridRows(gridNode);
	
	// append another spacer at the bottom
	var bottomspacer = topspacer.cloneNode(true);
	bottomspacer.setAttribute('class', 'bottomSpacer');
	gridNode.appendChild(bottomspacer);
	
	return boxNode;
};

this.adjustGridRows = function(aGrid) {
	var rows = aGrid.childNodes[1];
	if(rows.childNodes.length == prefAid.gridLimit) { return; }
	
	while(rows.childNodes.length < prefAid.gridLimit) {
		rows.appendChild(rows.firstChild.cloneNode(true));
	}
	while(rows.childNodes.length > prefAid.gridLimit) {
		rows.removeChild(rows.lastChild);
	}
};

// Positions the grid on the right or on the left, accordingly to where the scrollbar should go in different locale layouts
this.positionGrid = function(aGrid) {
	var dir = 'rtl'; // let's make this the default for the grid so it shows on the right
	
	switch(prefAid.side) {
		case 0: // Here's to hoping this one is actually correct as I have no way to test, I need to wait for some user input on this
			var rtlList = ['ar', 'he', 'fa', 'ps', 'ur'];
			var appLocale = Services.locale.getApplicationLocale().getCategory("NSILOCALE_MESSAGES");
			for(var i=0; i<rtlList.length; i++) {
				if(appLocale.indexOf(rtlList[i]) == 0) { dir = 'ltr'; break; }
			}
			break;
		
		case 1:
			var doc = (aGrid.linkedFrame) ? aGrid.linkedFrame.contentDocument : contentDocument;
			if(doc.documentElement.dir == 'rtl') { dir = 'ltr'; }
			break;
		
		case 3:
			dir = 'ltr';
			break;
		
		case 2:
		default:
			break;
	}
	
	aGrid.parentNode.style.direction = dir;
};

// This places the grid over the linked frame element
this.placeGridOnFrame = function(aGrid) {
	timerAid.cancel('tabSelectRePositionFrameGrid');
	timerAid.cancel('resizeSelectRePositionFrameGrid');
	
	var placement = aGrid.linkedFrame.getClientRects()[0];
	if(!placement) { return; } // If for example the frame is invisible
	
	var frameStyle = getComputedStyle(aGrid.linkedFrame);
	
	// Get the current height of the frame
	aGrid._fullHTMLHeight =
		aGrid.linkedFrame.contentDocument.getElementsByTagName('html')[0].scrollHeight
		|| aGrid.linkedFrame.contentDocument.getElementsByTagName('body')[0].scrollHeight;
	
	var top = placement.top +parseInt(frameStyle.getPropertyValue('border-top-width')) +parseInt(frameStyle.getPropertyValue('padding-top'));
	var left = placement.left +parseInt(frameStyle.getPropertyValue('border-left-width')) +parseInt(frameStyle.getPropertyValue('padding-left'));
	var width = placement.right
		-placement.left
		-parseInt(frameStyle.getPropertyValue('border-left-width'))
		-parseInt(frameStyle.getPropertyValue('padding-left'))
		-parseInt(frameStyle.getPropertyValue('border-right-width'))
		-parseInt(frameStyle.getPropertyValue('padding-right'));
	var height = placement.bottom
		-placement.top
		-parseInt(frameStyle.getPropertyValue('border-top-width'))
		-parseInt(frameStyle.getPropertyValue('padding-top'))
		-parseInt(frameStyle.getPropertyValue('border-bottom-width'))
		-parseInt(frameStyle.getPropertyValue('padding-bottom'));
	
	try {
		top += (aGrid.linkedFrame.ownerDocument.getElementsByTagName('html')[0].scrollTop || aGrid.linkedFrame.ownerDocument.getElementsByTagName('body')[0].scrollTop);
		left += (aGrid.linkedFrame.ownerDocument.getElementsByTagName('html')[0].scrollLeft || aGrid.linkedFrame.ownerDocument.getElementsByTagName('body')[0].scrollLeft);
	}
	catch(ex) {}
	
	// Frame content can be smaller than actual frame size
	height = Math.min(height, aGrid._fullHTMLHeight);
	
	aGrid.parentNode.style.top = top+'px';
	aGrid.parentNode.style.left = left+'px';
	aGrid.parentNode.style.width = width+'px';
	aGrid.parentNode.style.height = height+'px';
	
	removeAttribute(aGrid.parentNode, 'beingPositioned');
};

// Removes all highlights from the grid
this.cleanHighlightGrid = function(aGrid) {
	if(!aGrid || !aGrid.childNodes) { aGrid = grid; }
	var rows = aGrid.childNodes[1];
	
	// Reset (clean) all grid rows
	for(var r=0; r<aGrid._currentRows.length; r++) {
		removeAttribute(aGrid._currentRows[r], 'current');
	}
	for(var r=0; r<aGrid._hoverRows.length; r++) {
		removeAttribute(aGrid._hoverRows[r], 'hover');
	}
	for(var r=0; r<aGrid._pdfPageRows.length; r++) {
		removeAttribute(aGrid._pdfPageRows[r], 'highlight');
		removeAttribute(aGrid._pdfPageRows[r], 'pattern');
		aGrid._pdfPageRows[r].highlight = null;
		delete aGrid._pdfPageRows[r]._pdfPage;
	}
	for(var i=0; i<aGrid._allHits.length; i++) {
		for(var r=0; r<aGrid._allHits[i].rows.length; r++) {
			removeAttribute(aGrid._allHits[i].rows[r], 'highlight');
			removeAttribute(aGrid._allHits[i].rows[r], 'pattern');
			aGrid._allHits[i].rows[r].highlight = null;
		}
	}
	
	initGridArrays(aGrid);
};

this.initGridArrays = function(aGrid) {
	aGrid._allHits = new Array();
	aGrid._currentRows = new Array();
	aGrid._hoverRows = new Array();
	aGrid._pdfPageRows = new Array();
};

this.testFrameGrid = function(aGrid, f) {
	// In case the frame element doesn't exist anymore for some reason, we remove it from the array.
	try {
		aGrid._frames[f].linkedFrame.contentDocument.documentElement;
		return true;
	}
	catch(ex) {
		try {
			if(aGrid._frames[f].parentNode && aGrid._frames[f].parentNode.parentNode) {
				aGrid._frames[f].parentNode.parentNode.removeChild(aGrid._frames[f].parentNode);
			}
		}
		catch(exx) {}
		aGrid._frames.splice(f, 1);
		return false;
	}
};

// Prepares the grid to be filled with the highlights
this.resetHighlightGrid = function() {
	var aGrid = grid;
	
	cleanHighlightGrid(aGrid);
	positionGrid(aGrid);
	
	removeAttribute(aGrid, 'gridSpacers');
	listenerAid.remove(browserPanel, 'resize', delayResizeGridSpacers);
	aGrid.parentNode.style.paddingTop = '';
	
	if(viewSource) {
		aGrid.parentNode.style.top = '';
		aGrid.parentNode.style.height = '';
		listenerAid.remove(viewSource, 'resize', delayGridResizeViewSource);
	}
	else if(isPDFJS) {
		var offsetY = contentDocument.querySelectorAll('div.toolbar')[0].clientHeight;
		aGrid.parentNode.style.paddingTop = offsetY +'px';
	}
	// Special case for GMail
	else if(contentDocument.baseURI.indexOf('https://mail.google.com/mail/') === 0) {
		var offsetY = contentDocument.querySelectorAll('div.AO')[0].offsetTop;
		aGrid.parentNode.style.paddingTop = offsetY +'px';
	}
	else {
		var f=0;
		while(f<aGrid._frames.length) {
			// In case the frame element doesn't exist anymore for some reason, we remove it from the array.
			if(!testFrameGrid(aGrid, f)) { continue; }
			
			positionGrid(aGrid._frames[f]);
			placeGridOnFrame(aGrid._frames[f]);
			removeAttribute(aGrid._frames[f], 'gridSpacers');
			removeAttribute(aGrid.parentNode, 'unHide');
			
			f++;
		}
	}
	
	gridResizeViewSource();
	return;
};

this.fillHighlightGrid = function(toAdd) {
	var aGrid = grid; // Let's not overuse the querySelectorAll queries, could seriously slow down the process...
	
	// Special case for GMail
	var ao = null;
	if(!viewSource && !isPDFJS && contentDocument.baseURI.indexOf('https://mail.google.com/mail/') === 0) {
		ao = contentDocument.querySelectorAll('div.AO')[0];
		if(ao) {
			for(var i=0; i<toAdd.length; i++) {
				if(!isAncestor(toAdd[i].node.startContainer, ao)) {
					toAdd.splice(i, 1);
					i--;
				}
			}
		}
	}
	
	// For PDF files
	if(isPDFJS) {
		if(linkedPanel._matchesPDFtotal > prefAid.gridLimit) { return; }
		
		try {
			var scrollTop = contentDocument.getElementById('viewerContainer').scrollTop;
			var fullHTMLHeight = contentDocument.getElementById('viewer').clientHeight;
		}
		catch(ex) { return; }
		
		// Don't think this can happen but I better make sure
		if(fullHTMLHeight == 0) { return; }
		
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(contentWindow);
		var matches = unWrap.PDFFindController.pageMatches;
		
		// The grid is empty, so invisible, we don't need to do anything
		if(matches.length == 0) { return; }
		
		for(var p=0; p<matches.length; p++) {
			if(matches[p].length == 0) { continue; }
			
			// If the page is rendered, place the actual highlights positions
			if(unWrap.PDFView.pages[p].textLayer
			&& unWrap.PDFView.pages[p].textLayer.renderingDone
			&& unWrap.PDFView.pages[p].renderingState == 3) {
				fillGridWithPDFPage(aGrid, p, unWrap, scrollTop, fullHTMLHeight);
			}
			
			// If the page isn't rendered yet, use a placeholder for the page with a pattern
			else {
				var row = placeHighlight(aGrid, contentDocument.getElementById('pageContainer'+unWrap.PDFView.pages[p].id), scrollTop, fullHTMLHeight, true);
				row._pdfPage = p;
				aGrid._pdfPageRows.push(row);
			}
		}
		
		listenerAid.add(contentDocument.getElementById('viewerContainer'), 'scroll', delayUpdatePDFGrid);
	}
	
	// For normal HTML pages
	else {
		try {
			if(ao) {
				var scrollTop = ao.firstChild.scrollTop;
				var fullHTMLHeight = ao.firstChild.scrollHeight;
			} else {
				var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
				var fullHTMLHeight = contentDocument.getElementsByTagName('html')[0].scrollHeight || contentDocument.getElementsByTagName('body')[0].scrollHeight;
			}
		}
		catch(ex) {
			if(contentDocument.getElementsByTagName('frameset').length == 0) { return; }
		}
		
		for(var i=0; i<toAdd.length; i++) {
			var rowList = new Array();
			
			if(fullHTMLHeight > 0) {
				var aRange = toAdd[i].node;
				rowList.push(placeHighlight(aGrid, aRange, scrollTop, fullHTMLHeight, toAdd[i].pattern, ao));
			}
			
			// This is an editable node, add it directly
			if(toAdd[i].rangeEdit) {
				aGrid._allHits.push({ range: toAdd[i].rangeEdit, rows: rowList });
			}
			// This range comes from the doc.body, we add it directly
			else if(!toAdd[i].ranges) {
				aGrid._allHits.push({ range: aRange, rows: rowList });
			}
			// This is a frame element, add necessary grid
			else {
				for(var r=0; r<toAdd[i].ranges.length; r++) {
					try {
						// We kinda need this, I'm not sure if this is possible or not, but in the event that it is...
						var frame = toAdd[i].ranges[r].startContainer.ownerDocument.defaultView.frameElement;
						if(!frame) { continue; }
						
						var frameGrid = null;
						for(var f=0; f<aGrid._frames.length; f++) {
							if(aGrid._frames[f].linkedFrame.contentDocument == toAdd[i].ranges[r].startContainer.ownerDocument) {
								frameGrid = aGrid._frames[f];
								break;
							}
						}
						
						if(!frameGrid) {
							// If we don't have a grid, first we try to clone an already existing grid present in this document, it's faster this way
							for(var f=0; f<aGrid._frames.length; f++) {
								if(aGrid._frames[f].ownerDocument == frame.ownerDocument) {
									// for safety, since afterwards we assume as much
									if(aGrid._frames[f].childNodes[1].childNodes.length != prefAid.gridLimit) {
										aGrid._frames[f].parentNode.removeChild(aGrid._frames[f]);
										aGrid._frames.splice(f, 1);
										f--;
										continue;
									}
									
									var boxNode = aGrid._frames[f].parentNode.cloneNode(true);
									
									// ok we should be able to safely add it to the document now
									boxNode = frame.ownerDocument.documentElement.appendChild(boxNode);
									
									var bGrid = boxNode.firstChild;
									bGrid.linkedFrame = frame;
									aGrid._frames.push(bGrid);
									
									// Initialize it
									var rows = bGrid.childNodes[1];
									for(var c=0; c<rows.childNodes.length; c++) {
										removeHighlight(rows.childNodes[c]);
									}
									bGrid._lastUsedRow = -1;
									positionGrid(bGrid);
									placeGridOnFrame(bGrid);
									
									// We're ready to add the highlights now
									frameGrid = bGrid;
									
									break;
								}
							}
						}
						
						if(!frameGrid) {
							// Still no grid for this frame, so we create a new one
							var boxNode = createGrid(frame.ownerDocument, true);
							
							// We need to ensure specificity
							// and that if the grid remains when the add-on is disabled, it doesn't affect the webpage it is placed into.
							setAttribute(boxNode, 'hidden', 'true');
							setAttribute(boxNode, 'ownedByFindBarTweak', _UUID);
							boxNode.style.position = 'absolute';
							
							// ok we should be able to safely add it to the document now
							boxNode = frame.ownerDocument.documentElement.appendChild(boxNode);
							var bGrid = boxNode.firstChild;
							bGrid.linkedFrame = frame;
							aGrid._frames.push(bGrid);
							
							// Initialize it
							bGrid._lastUsedRow = -1;
							positionGrid(bGrid);
							placeGridOnFrame(bGrid);
							
							// We're ready to add the highlights now
							frameGrid = bGrid;
						}
						
						if(frameGrid._scrollTop === undefined) {
							frameGrid._scrollTop =
								frameGrid.linkedFrame.contentDocument.getElementsByTagName('html')[0].scrollTop
								|| frameGrid.linkedFrame.contentDocument.getElementsByTagName('body')[0].scrollTop;
						}
						
						var bRange = toAdd[i].ranges[r];
						var frameRowList = new Array(placeHighlight(frameGrid, bRange, frameGrid._scrollTop, frameGrid._fullHTMLHeight));
						aGrid._allHits.push({ range: bRange, rows: rowList.concat(frameRowList) });
						
						setAttribute(frameGrid.parentNode, 'unHide', 'true');
					}
					
					// Something went wrong, but we should still be able to continue the script
					catch(ex) { Cu.reportError(ex); }
				}
			}
		}
	}
	
	// Reset this value after we've added all ranges
	for(var f=0; f<aGrid._frames.length; f++) {
		delete aGrid._frames[f]._scrollTop;
	}
	
	gridFollowCurrentHit();
	gridResizeSpacers();
	listenerAid.add(browserPanel, 'resize', delayResizeGridSpacers);
};

this.placeHighlight = function(aGrid, node, scrollTop, fullHTMLHeight, pattern, ao) {
	var rows = aGrid.childNodes[1];
	
	aGrid._lastUsedRow++;
	if(aGrid._lastUsedRow == aGrid.childNodes[1].childNodes.length) { aGrid._lastUsedRow = 0; }
	while(aGrid.childNodes[1].childNodes[aGrid._lastUsedRow].highlight) {
		aGrid._lastUsedRow++;
		if(aGrid._lastUsedRow == aGrid.childNodes[1].childNodes.length) { aGrid._lastUsedRow = 0; }
	}
	var row = aGrid.childNodes[1].childNodes[aGrid._lastUsedRow];
	
	// By separating this part of the process, we gain valuable speed when running searches with lots of highlights (no breaks when typing)
	row.highlight = {
		node: node,
		timer: aSync(function() {
			if(!row.highlight || row.highlight.node != node) { return; }
			
			var rect = node.getBoundingClientRect();
			var absTop = rect.top;
			var absBot = rect.bottom;
			
			if(ao) {
				absTop -= ao.offsetTop;
				absBot -= ao.offsetTop;
			}
			
			absTop = (absTop + scrollTop) / fullHTMLHeight;
			absBot = (absBot + scrollTop) / fullHTMLHeight;
			
			// I have no idea why this happens sometimes, but we have to redo every row.
			// Its rect.top and rect.bottom that are wrong sometimes.
			if(!isPDFJS && (absTop < 0 || absBot > 1)) {
				reHighlight(documentHighlighted);
				return;
			}
			
			setAttribute(row, 'highlight', 'true');
			toggleAttribute(row, 'pattern', pattern);
			row.style.top = (absTop *100)+'%';
			row.style.height = ((absBot -absTop) *100)+'%';
		}, 250)
	};
	
	return row;
};

this.removeHighlight = function(row) {
	removeAttribute(row, 'hover');
	removeAttribute(row, 'current');
	removeAttribute(row, 'pattern');
	removeAttribute(row, 'highlight');
	delete row._pdfPage;
	row.highlight = null;
};

this.fillGridWithPDFPage = function(aGrid, p, unWrap, scrollTop, fullHTMLHeight) {
	var matches = unWrap.PDFFindController.pageMatches[p];
	
	// We need to associate the highlighted nodes with the matches, since PDF.JS doesn't actually do that
	for(var m=0; m<matches.length; m++) {
		var highlights = new Array();
		var offset = 0;
		for(var dIdx=unWrap.PDFView.pages[p].textLayer.matches[m].begin.divIdx; dIdx<=unWrap.PDFView.pages[p].textLayer.matches[m].end.divIdx; dIdx++) {
			var beginOffset = unWrap.PDFView.pages[p].textLayer.matches[m].begin.offset;
			var endOffset = unWrap.PDFView.pages[p].textLayer.matches[m].end.offset;
			var childIdx = 0;
			while(childIdx < unWrap.PDFView.pages[p].textLayer.textDivs[dIdx].childNodes.length) {
				var curChild = unWrap.PDFView.pages[p].textLayer.textDivs[dIdx].childNodes[childIdx];
				if(curChild.nodeType == 1) {
					if(curChild.classList.contains('highlight') && offset >= beginOffset) {
						highlights.push(curChild);
					}
					offset += curChild.textContent.length;
				}
				else {
					offset += curChild.length;
				}
				
				if(offset >= endOffset) { break; }
				childIdx++;
			}
		}
		
		var allRows = new Array();
		var rowList = new Array();
		// Use these highlighted nodes to fill the grid
		for(var h=0; h<highlights.length; h++) {
			rowList.push(placeHighlight(aGrid, highlights[h], scrollTop, fullHTMLHeight, false));
		}
		
		aGrid._allHits.push({ p: p, m: m, rows: rowList });
	}
};

this.matchesPDFGrid = function() {
	resetHighlightGrid();
	if(gFindBar.getElement('highlight').checked) {
		fillHighlightGrid();
	}
};

this.delayUpdatePDFGrid = function() {
	timerAid.init('delayUpdatePDFGrid', updatePDFGrid, 50);
};

this.updatePDFGrid = function() {
	if(!isPDFJS) { return; }
	var aGrid = grid; // Let's not overuse the querySelectorAll queries, could seriously slow down the process...
	
	try {
		var scrollTop = contentDocument.getElementById('viewerContainer').scrollTop;
		var fullHTMLHeight = contentDocument.getElementById('viewer').clientHeight;
	}
	catch(ex) { return; } // if we return let's return before we do anything
	
	// We need this to access protected properties, hidden from privileged code
	var unWrap = XPCNativeWrapper.unwrap(contentWindow);
	
	var updatePages = [];
	for(var j=0; j<aGrid._pdfPageRows.length; j++) {
		if(unWrap.PDFView.pages[aGrid._pdfPageRows[j]._pdfPage].textLayer
		&& unWrap.PDFView.pages[aGrid._pdfPageRows[j]._pdfPage].textLayer.renderingDone
		&& unWrap.PDFView.pages[aGrid._pdfPageRows[j]._pdfPage].renderingState == 3) {
			updatePages.push(aGrid._pdfPageRows[j]._pdfPage);
			
			removeHighlight(aGrid._pdfPageRows[j]);
			aGrid._pdfPageRows.splice(j, 1);
			j--;
		}
	}
	
	if(updatePages.length == 0) { return; }
	
	clearHoverRows();
	
	var updatedPages = {};
	for(var p=0; p<updatePages.length; p++) {
		if(!updatedPages[p]) {
			fillGridWithPDFPage(aGrid, updatePages[p], unWrap, scrollTop, fullHTMLHeight);	
			updatedPages[p] = true;
		}
	}
	
	gridFollowCurrentHit();
};

this.delayResizeGridSpacers = function() {
	timerAid.init('resizeGridSpacers', gridResizeSpacers);
};

this.gridResizeSpacers = function(aGrid) {
	if(!aGrid) {
		aGrid = grid;
		gridResizeSpacers(aGrid);
		for(var f=0; f<aGrid._frames.length; f++) {
			gridResizeSpacers(aGrid._frames[f]);
		}
		return;
	}
	
	// Lets make sure contentDocument and its elements exist before trying to access them
	var doc = (aGrid.linkedFrame) ? aGrid.linkedFrame.contentDocument: contentDocument;
	try {
		if(!isPDFJS) {
			var scrollTopMax = doc.getElementsByTagName('html')[0].scrollTopMax || doc.getElementsByTagName('body')[0].scrollTopMax;
			var scrollLeftMax = doc.getElementsByTagName('html')[0].scrollLeftMax || doc.getElementsByTagName('body')[0].scrollLeftMax;
		} else {
			var scrollTopMax = doc.getElementById('viewerContainer').scrollTopMax;
			var scrollLeftMax = doc.getElementById('viewerContainer').scrollLeftMax;
		}
	}
	catch(ex) { return; }
	
	if(scrollTopMax == 0 && scrollLeftMax == 0) {
		setAttribute(aGrid, 'gridSpacers', 'none');
	} else if(scrollTopMax > 0 && scrollLeftMax > 0) {
		setAttribute(aGrid, 'gridSpacers', 'double');
	} else {
		setAttribute(aGrid, 'gridSpacers', 'single');
	}
};

this.delayGridResizeViewSource = function() {
	timerAid.init('resizeViewSource', gridResizeViewSource, 0);
};

this.gridResizeViewSource = function() {
	if(!viewSource) { return; }
	
	var contentPos = $('content').getBoundingClientRect();
	grid.parentNode.style.top = contentPos.top+'px';
	grid.parentNode.style.height = contentPos.height+'px';
	listenerAid.add(viewSource, 'resize', delayGridResizeViewSource);
};

this.adjustGrid = function() {
	var defaultPadding = (Services.appinfo.OS == 'WINNT') ? 2 : 0;
	var defaultWidth = (Services.appinfo.OS == 'WINNT') ? 13 : (Services.appinfo.OS == 'Darwin') ? 14 : 12;
	
	styleAid.unload('adjustGrid_'+_UUID);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] vbox[anonid="findGrid"] {\n';
	sscode += '		-moz-margin-start: '+(defaultPadding +prefAid.gridAdjustPadding)+'px;\n';
	sscode += '		width: '+(defaultWidth +prefAid.gridAdjustWidth)+'px;\n';
	sscode += '	}\n';
	sscode += '}';
	
	styleAid.load('adjustGrid_'+_UUID, sscode, true);
	
	// For grids in frames
	styleAid.unload('adjustFrameGrid_'+_UUID);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.w3.org/1999/xhtml);\n';
	sscode += 'div[ownedByFindBarTweak="'+_UUID+'"][anonid="gridBox"] div[anonid="findGrid"] {\n';
	sscode += '	-moz-margin-start: '+(defaultPadding +prefAid.gridAdjustPadding)+'px;\n';
	sscode += '	width: '+(defaultWidth +prefAid.gridAdjustWidth)+'px;\n';
	sscode += '}\n';
	
	styleAid.load('adjustFrameGrid_'+_UUID, sscode, true);
};

this.gridFollowCurrentHit = function(e) {
	if(e && e.detail && e.detail.res && e.detail.res == gFindBar.nsITypeAheadFind.FIND_NOTFOUND) {
		return;
	}
	
	if(!contentWindow) { return; } // Usually triggered when a selection is on a frame and the frame closes
	
	// don't keep calling grid, performance boost
	var allHits = grid._allHits;
	
	clearCurrentRows();
	var rows = grid._currentRows;
	
	// Special routine for PDF.JS
	if(isPDFJS) {
		if(contentDocument.readyState != 'complete' && contentDocument.readyState != 'interactive') { return; }
		
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(contentWindow);
		var selected = unWrap.PDFFindController.selected;
		if(selected.pageIdx == -1 || selected.matchIdx == -1) { return; }
		
		for(var i=0; i<allHits.length; i++) {
			if(allHits[i].p == selected.pageIdx && allHits[i].m == selected.matchIdx) {
				for(var r=0; r<allHits[i].rows.length; r++) {
					setAttribute(allHits[i].rows[r], 'current', 'true');
					rows.push(allHits[i].rows[r]);
				}
				return; // no need to process the rest
			}
		}
	}
	
	// Normal HTML
	else {
		var editableNode = tweakFoundEditable(gFindBar);
		var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
		if(controller) {
			var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
		} else {
			var sel = tweakGetSelectionController(gFindBar, contentWindow).getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
		}
		
		var h = 0;
		if(sel.rangeCount == 1) {
			var cRange = sel.getRangeAt(0);
			for(var i=0; i<allHits.length; i++) {
				if(compareRanges(cRange, allHits[i].range)) {
					for(var r=0; r<allHits[i].rows.length; r++) {
						try {
							setAttribute(allHits[i].rows[r], 'current', 'true');
							rows.push(allHits[i].rows[r]);
						}
						// Something could go wrong with frame grids, but it shouldn't stop the script because of that
						catch(ex) {}
					}
					return; // no need to process the rest
				}
			}
		}
	}
};

this.clearHoverRows = function() {
	// Remove "current" status from every row in the grid
	var rows = grid._hoverRows;
	for(var j=0; j<rows.length; j++) {
		try { removeAttribute(rows[j], 'hover'); }
		catch(ex) {}
	}
	grid._hoverRows = new Array();
};

this.clearCurrentRows = function() {
	// Remove "current" status from every row in the grid
	var rows = grid._currentRows;
	for(var j=0; j<rows.length; j++) {
		try { removeAttribute(rows[j], 'current'); }
		catch(ex) {}
	}
	grid._currentRows = new Array();
};

this.tabSelectRePositionFrameGrid = function() {
	if(setRePositionTagFrameGrid()) {
		timerAid.init('tabSelectRePositionFrameGrid', rePositionFrameGrid, 25);
	}
};

this.resizeRePositionFrameGrid = function() {
	if(setRePositionTagFrameGrid()) {
		timerAid.init('resizeRePositionFrameGrid', rePositionFrameGrid, 500);
	}
};

this.setRePositionTagFrameGrid = function() {
	if(!documentHighlighted) { return false; } // there's no point in wasting cpu if it's going to be invisible
	
	var aGrid = grid;
	var f = 0;
	while(f < aGrid._frames.length) {
		if(!testFrameGrid(aGrid, f)) { continue; }
		
		setAttribute(aGrid._frames[f].parentNode, 'beingPositioned', 'true');
		f++;
	}
	
	return (f > 0) ? true : false;
};

this.rePositionFrameGrid = function() {
	if(!documentHighlighted) { return; } // there's no point in wasting cpu if it's going to be invisible
	
	var aGrid = grid;
	var f = 0;
	while(f < aGrid._frames.length) {
		if(!testFrameGrid(aGrid, f)) { continue; }
		
		placeGridOnFrame(aGrid._frames[f]);
		f++;
	}
};

this.listenGridLimit = function() {
	removeAllGrids();
	observerAid.notify('ReHighlightAll');
};

this.removeAllGrids = function() {
	if(!viewSource) {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var panel = $(gBrowser.mTabs[t].linkedPanel);
			var innerGrid = panel.querySelectorAll('[anonid="gridBox"]');
			if(innerGrid.length > 0) {
				for(var f=0; f<innerGrid[0].firstChild._frames.length; f++) {
					if(innerGrid[0].firstChild._frames[f].parentNode && innerGrid[0].firstChild._frames[f].parentNode.parentNode) {
						innerGrid[0].firstChild._frames[f].parentNode.parentNode.removeChild(innerGrid[0].firstChild._frames[f].parentNode);
					}
				}
				innerGrid[0].parentNode.removeChild(innerGrid[0]);
			}
		}
	}
	else {
		var innerGrid = $$('[anonid="gridBox"]');
		if(innerGrid.length > 0) {
			innerGrid[0].parentNode.removeChild(innerGrid[0]);
		}
	}
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ side: 0 }, 'scrollbar', 'layout');
	templateGrid = createGrid(document);
	
	listenerAid.add(window, 'SelectedFIThit', gridFollowCurrentHit);
	listenerAid.add(window, 'UpdatedStatusFindBar', gridFollowCurrentHit);
	listenerAid.add(window, 'UpdatedPDFMatches', matchesPDFGrid);
	listenerAid.add(window, 'CleanUpHighlights', cleanHighlightGrid);
	
	if(!viewSource) {
		listenerAid.add(browserPanel, 'MozScrolledAreaChanged', resizeRePositionFrameGrid, true);
		listenerAid.add(gBrowser.tabContainer, 'TabSelect', tabSelectRePositionFrameGrid);
		styleAid.load('frameGrid', 'frameGrid');
	}
	
	prefAid.listen('gridAdjustPadding', adjustGrid);
	prefAid.listen('gridAdjustWidth', adjustGrid);
	prefAid.listen('gridLimit', listenGridLimit);
	adjustGrid();
	
	observerAid.notify('ReHighlightAll');
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('gridAdjustPadding', adjustGrid);
	prefAid.unlisten('gridAdjustWidth', adjustGrid);
	prefAid.unlisten('gridLimit', listenGridLimit);
	styleAid.unload('adjustGrid_'+_UUID);
	styleAid.unload('adjustFrameGrid_'+_UUID);
	
	listenerAid.remove(window, 'SelectedFIThit', gridFollowCurrentHit);
	listenerAid.remove(window, 'UpdatedStatusFindBar', gridFollowCurrentHit);
	listenerAid.remove(window, 'UpdatedPDFMatches', matchesPDFGrid);
	listenerAid.remove(window, 'CleanUpHighlights', cleanHighlightGrid);
	listenerAid.remove(browserPanel, 'resize', delayResizeGridSpacers);
	
	removeAllGrids();
	if(!viewSource) {
		listenerAid.remove(browserPanel, 'MozScrolledAreaChanged', resizeRePositionFrameGrid, true);
		listenerAid.remove(gBrowser.tabContainer, 'TabSelect', tabSelectRePositionFrameGrid);
		if(UNLOADED || !prefAid.useGrid) { styleAid.unload('frameGrid', 'frameGrid'); }
		
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			if(gBrowser.mTabs[t].linkedBrowser.contentDocument) {
				listenerAid.remove(gBrowser.mTabs[t].linkedBrowser.contentDocument.getElementById('viewerContainer'), 'scroll', delayUpdatePDFGrid);
			}
		}
	}
	else {
		listenerAid.remove(viewSource, 'resize', delayGridResizeViewSource);
	}
		
	if(!UNLOADED && !window.closed && !window.willClose) {
		observerAid.notify('ReHighlightAll');
	}
};
