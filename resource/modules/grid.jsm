moduleAid.VERSION = '1.3.1';

this.ROWS_MINIMUM = 150; // number of rows in the highlight grid - kind of the "highlight granularity"
this.ROWS_MULTIPLIER = 2; // Add extra rows if their height exceeds this value

this.__defineGetter__('grid', function() {
	var grids = (!viewSource) ? linkedPanel.querySelectorAll('[anonid="findGrid"]') : $$('[anonid="findGrid"]');
	if(grids.length > 0) {
		return grids[0];
	}
	
	var boxNode = createGrid(document);
	boxNode.firstChild._frames = new Array();
	
	// Insert the grid into the tab
	boxNode = (!viewSource) ? gBrowser.mCurrentBrowser.parentNode.appendChild(boxNode) : linkedPanel.appendChild(boxNode);
	
	return boxNode.firstChild;
});

// Creates a new grid
this.createGrid = function(doc, html) {
	// First the grid itself
	var boxNode = doc.createElement((html) ? 'div' : 'hbox');
	boxNode.setAttribute('anonid', 'gridBox');
	
	// It shouldn't depend on the stylesheet being loaded, it could error and the browser would be unusable
	boxNode.style.pointerEvents = 'none';
	
	var gridNode = doc.createElement((html) ? 'div' : 'grid');
	gridNode.setAttribute('anonid', 'findGrid');
	gridNode._allHits = new Array();
	gridNode._currentRows = new Array();
	gridNode._hoverRows = new Array();
	gridNode = boxNode.appendChild(gridNode);
	
	// Then columns
	if(!html) {
		var columns = doc.createElement('columns');
		columns = gridNode.appendChild(columns);
		var column = doc.createElement('column');
		column = columns.appendChild(column);
	}
	
	// Then start adding the rows
	var rows = doc.createElement((html) ? 'div' : 'rows');
	rows = gridNode.appendChild(rows);
	
	// Starting with the top spacer
	var topspacer = doc.createElement((html) ? 'div' : 'row');
	topspacer.setAttribute('flex', '0');
	topspacer.setAttribute('class', 'topSpacer');
	topspacer = rows.appendChild(topspacer);
	
	// Actual highlight rows
	var row = doc.createElement((html) ? 'div' : 'row');
	row.setAttribute('flex', '1');
	row = rows.appendChild(row);
	
	// append another spacer at the bottom
	var bottomspacer = topspacer.cloneNode(true);
	bottomspacer.setAttribute('class', 'bottomSpacer');
	rows.appendChild(bottomspacer);
	
	return boxNode;
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
	if(!aGrid || !aGrid.childNodes) {
		aGrid = grid;
		cleanHighlightGrid(aGrid);
		for(var f=0; f<aGrid._frames.length; f++) {
			cleanHighlightGrid(aGrid._frames[f]);
		}
		return;
	}
	
	var rows = aGrid.childNodes[1] || aGrid.childNodes[0];
	
	// Reset (clean) all grid rows
	for(var i=1; i<rows.childNodes.length-1; i++) {
		removeAttribute(rows.childNodes[i], 'highlight');
		removeAttribute(rows.childNodes[i], 'pattern');
		removeAttribute(rows.childNodes[i], 'current');
		removeAttribute(rows.childNodes[i], 'hover');
		delete rows.childNodes[i]._pdfPages;
		delete rows.childNodes[i]._hasMatches;
	}
	
	aGrid._allHits = new Array();
	aGrid._currentRows = new Array();
	aGrid._hoverRows = new Array();
};

// Adjustes the number of rows in the grid.
// Grids in frames have no minimum rows, they are all 2 pixels high.
this.adjustGridRows = function(aGrid) {
	var rows = aGrid.childNodes[1] || aGrid.childNodes[0];
	var noMinimum = (aGrid.linkedFrame) ? true : false;
	
	// Adjust number of rows
	var height = aGrid.clientHeight;
	
	// When adding the grid in a frame for the first time, it may not have been drawn yet, so it doesn't have a height value yet
	if(!height) { height = parseInt(aGrid.parentNode.style.height); }
	
	var gridHeight = Math.max(height - (rows.childNodes[0].clientHeight *2), 0);
	aGrid._gridHeight = gridHeight;
	
	var optRows = Math.ceil(gridHeight / ROWS_MULTIPLIER);
	var num_rows = Math.max(optRows, (!noMinimum) ? ROWS_MINIMUM : 1);
	while(rows.childNodes.length -2 > num_rows) {
		rows.removeChild(rows.childNodes[1]);
	}
	while(rows.childNodes.length -2 < num_rows) {
		var newNode = rows.childNodes[1].cloneNode(true);
		rows.insertBefore(newNode, rows.lastChild);
	}
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
	adjustGridRows(aGrid);
	positionGrid(aGrid);
	
	removeAttribute(aGrid, 'gridSpacers');
	listenerAid.remove(browserPanel, 'resize', delayResizeGridSpacers);
	
	if(viewSource) {
		aGrid.parentNode.style.top = '';
		aGrid.parentNode.style.height = '';
		listenerAid.remove(viewSource, 'resize', delayGridResizeViewSource);
	}
	else if(isPDFJS) {
		var offsetY = contentDocument.querySelectorAll('div.toolbar')[0].clientHeight;
		var gridBox = aGrid.parentNode;
		gridBox.style.paddingTop = offsetY +'px';
	}
	else {
		var f=0;
		while(f<aGrid._frames.length) {
			// In case the frame element doesn't exist anymore for some reason, we remove it from the array.
			if(!testFrameGrid(aGrid, f)) { continue; }
			
			cleanHighlightGrid(aGrid._frames[f]);
			positionGrid(aGrid._frames[f]);
			placeGridOnFrame(aGrid._frames[f]);
			adjustGridRows(aGrid._frames[f]);
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
				var rect = contentDocument.getElementById('pageContainer'+unWrap.PDFView.pages[p].id).getBoundingClientRect();
				var absTop = (rect.top + scrollTop) / fullHTMLHeight;
				var absBot = (rect.bottom + scrollTop) / fullHTMLHeight;
				
				var rowList = placeHighlight(aGrid, absTop, absBot, true);
				for(var r=0; r<rowList.length; r++) {
					if(!rowList[r]._pdfPages) {
						rowList[r]._pdfPages = [];
					}
					rowList[r]._pdfPages.push(p);
				}
			}
		}
		
		listenerAid.add(contentDocument.getElementById('viewerContainer'), 'scroll', delayUpdatePDFGrid);
	}
	
	// For normal HTML pages
	else {
		try {
			var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
			var fullHTMLHeight = contentDocument.getElementsByTagName('html')[0].scrollHeight || contentDocument.getElementsByTagName('body')[0].scrollHeight;
		}
		catch(ex) {
			if(contentDocument.getElementsByTagName('frameset').length == 0) { return; }
		}
		
		for(var i=0; i<toAdd.length; i++) {
			var rowList = new Array();
			
			if(fullHTMLHeight > 0) {
				var aRange = toAdd[i].node;
				var rect = aRange.getBoundingClientRect();
				var absTop = (rect.top + scrollTop) / fullHTMLHeight;
				var absBot = (rect.bottom + scrollTop) / fullHTMLHeight;
				
				rowList = placeHighlight(aGrid, absTop, absBot, toAdd[i].pattern);
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
							cleanHighlightGrid(bGrid);
							positionGrid(bGrid);
							placeGridOnFrame(bGrid);
							adjustGridRows(bGrid);
							
							// We're ready to add the highlights now
							frameGrid = bGrid;
						}
						
						if(frameGrid._scrollTop === undefined) {
							frameGrid._scrollTop =
								frameGrid.linkedFrame.contentDocument.getElementsByTagName('html')[0].scrollTop
								|| frameGrid.linkedFrame.contentDocument.getElementsByTagName('body')[0].scrollTop;
						}
						
						var bRange = toAdd[i].ranges[r];
						var rect = bRange.getBoundingClientRect();
						var absTop = (rect.top + frameGrid._scrollTop) / frameGrid._fullHTMLHeight;
						var absBot = (rect.bottom + frameGrid._scrollTop) / frameGrid._fullHTMLHeight;
						
						var frameRowList = placeHighlight(frameGrid, absTop, absBot);
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

this.placeHighlight = function(aGrid, absTop, absBot, pattern) {
	var rowList = [];
	
	var highlighted = false;
	var row_bottom = 0;
	var rows = aGrid.childNodes[1] || aGrid.childNodes[0];
	for(var j=1; j<rows.childNodes.length-1; j++) {
		var row = rows.childNodes[j];
		var rowHeight = row.clientHeight || ROWS_MULTIPLIER; // frame grids don't paint quick enough after just being added
		
		var row_top = row_bottom;
		var row_bottom = row_top + (rowHeight / aGrid._gridHeight);
		
		// If any part of the row's range is within the match's range, highlight it
		if( (absTop >= row_top || absBot >= row_top) && (absTop <= row_bottom || absBot <= row_bottom) ) {
			setAttribute(row, 'highlight', 'true');
			toggleAttribute(row, 'pattern', pattern);
			highlighted = true;
			
			rowList.push(row);
		}
		
		// Don't cycle through the whole grid unnecessarily
		else if(highlighted) {
			return rowList;
		}
	}
	
	// returns an array with the highlighted rows for this range
	return rowList;
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
		// Use these highlighted nodes to fill the grid
		for(var h=0; h<highlights.length; h++) {
			var rect = highlights[h].getBoundingClientRect();
			var absTop = (rect.top + scrollTop) / fullHTMLHeight;
			var absBot = (rect.bottom + scrollTop) / fullHTMLHeight;
			
			var rowList = placeHighlight(aGrid, absTop, absBot, false);
			rowList_loop: for(var r=0; r<rowList.length; r++) {
				if(!rowList[r]._hasMatches) {
					rowList[r]._hasMatches = 0;
				}
				rowList[r]._hasMatches++;
				
				// We don't need duplicate rows
				for(var a=0; a<allRows.length; a++) {
					if(allRows[a] == rowList[r]) { continue rowList_loop; }
				}
				allRows.push(rowList[r]);
			}
		}
		
		aGrid._allHits.push({ p: p, m: m, rows: allRows });
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
	var rows = aGrid.childNodes[1];
	for(var j=1; j<rows.childNodes.length-1; j++) {
		var row = rows.childNodes[j];
		if(!row.getAttribute('pattern')) { continue; }
		
		for(var p=0; p<row._pdfPages.length; p++) {
			if(unWrap.PDFView.pages[row._pdfPages[p]].textLayer
			&& unWrap.PDFView.pages[row._pdfPages[p]].textLayer.renderingDone
			&& unWrap.PDFView.pages[row._pdfPages[p]].renderingState == 3) {
				updatePages.push(row._pdfPages[p]);
				row._pdfPages.splice(p, 1);
			}
		}
		
		if(row._pdfPages.length == 0) {
			removeAttribute(row, 'pattern');
			delete row._pdfPages;
			if(!row._hasMatches || row._hasMatches == 0) {
				removeAttribute(row, 'highlight');
			}
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
	
	// Lets make sure contentDocument and it's elements exist before trying to access them
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
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] hbox[anonid="gridBox"] { -moz-padding-start: '+(defaultPadding +prefAid.gridAdjustPadding)+'px; }\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] grid[anonid="findGrid"] { width: '+(defaultWidth +prefAid.gridAdjustWidth)+'px; }\n';
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
	var rows = grid._currentRows;
	
	// Remove "current" status from every row in the grid
	for(var j=0; j<rows.length; j++) {
		removeAttribute(rows[j], 'current');
	}
	grid._currentRows = new Array();
	var rows = grid._currentRows;
	
	// Special routine for PDF.JS
	if(isPDFJS) {
		if(contentDocument.readyState != 'complete') { return; }
		
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
		var editableNode = gFindBar.browser._fastFind.foundEditable;
		var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
		if(controller) {
			var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
		} else {
			var sel = gFindBar._getSelectionController(contentWindow).getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
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
	var rows = grid._hoverRows;
	while(rows.length > 0) {
		try { removeAttribute(rows.shift(), 'hover'); }
		catch(ex) {} // Frame grids could go wrong, but it's irrelevant
	}
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
}

this.rePositionFrameGrid = function() {
	if(!documentHighlighted) { return; } // there's no point in wasting cpu if it's going to be invisible
	
	var aGrid = grid;
	var f = 0;
	while(f < aGrid._frames.length) {
		if(!testFrameGrid(aGrid, f)) { continue; }
		
		placeGridOnFrame(aGrid._frames[f]);
		f++;
	}
}

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ side: 0 }, 'scrollbar', 'layout');
	
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
	adjustGrid();
	
	observerAid.notify('ReHighlightAll');
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('gridAdjustPadding', adjustGrid);
	prefAid.unlisten('gridAdjustWidth', adjustGrid);
	styleAid.unload('adjustGrid_'+_UUID);
	styleAid.unload('adjustFrameGrid_'+_UUID);
	
	listenerAid.remove(window, 'SelectedFIThit', gridFollowCurrentHit);
	listenerAid.remove(window, 'UpdatedStatusFindBar', gridFollowCurrentHit);
	listenerAid.remove(window, 'UpdatedPDFMatches', matchesPDFGrid);
	listenerAid.remove(window, 'CleanUpHighlights', cleanHighlightGrid);
	listenerAid.remove(browserPanel, 'resize', delayResizeGridSpacers);
	
	if(!viewSource) {
		listenerAid.remove(browserPanel, 'MozScrolledAreaChanged', resizeRePositionFrameGrid, true);
		listenerAid.remove(gBrowser.tabContainer, 'TabSelect', tabSelectRePositionFrameGrid);
		if(UNLOADED || !prefAid.useGrid) { styleAid.unload('frameGrid', 'frameGrid'); }
		
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			if(gBrowser.mTabs[t].linkedBrowser.contentDocument) {
				listenerAid.remove(gBrowser.mTabs[t].linkedBrowser.contentDocument.getElementById('viewerContainer'), 'scroll', delayUpdatePDFGrid);
			}
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
		listenerAid.remove(viewSource, 'resize', delayGridResizeViewSource);
	}
		
	if(!UNLOADED && !window.closed && !window.willClose) {
		observerAid.notify('ReHighlightAll');
	}
};
