moduleAid.VERSION = '1.1.2';

this.ROWS_MINIMUM = 150; // number of rows in the highlight grid - kind of the "highlight granularity"
this.ROWS_MULTIPLIER = 2; // Add extra rows if their height exceeds this value

this.__defineGetter__('grid', function() {
	var grids = (!viewSource) ? linkedPanel.querySelectorAll('[anonid="findGrid"]') : $$('[anonid="findGrid"]');
	if(grids.length > 0) {
		return grids[0];
	}
	
	// First the grid itself
	var boxNode = document.createElement('hbox');
	boxNode.setAttribute('anonid', 'gridBox');
	
	// It shouldn't depend on the stylesheet being loaded, it could error and the browser would be unusable
	boxNode.setAttribute('style', 'pointer-events: none;');
	
	var gridNode = document.createElement('grid');
	gridNode.setAttribute('anonid', 'findGrid');
	
	// Then columns
	var columns = document.createElement('columns');
	columns = gridNode.appendChild(columns);
	var column = document.createElement('column');
	column = columns.appendChild(column);
	
	// Then start adding the rows
	var rows = document.createElement('rows');
	rows = gridNode.appendChild(rows);
	
	// Starting with the top spacer
	var topspacer = document.createElement('row');
	topspacer.setAttribute('flex', '0');
	topspacer.setAttribute('class', 'topSpacer');
	topspacer = rows.appendChild(topspacer);
	
	// Actual highlight rows
	var row = document.createElement('row');
	row.setAttribute('flex', '1');
	row = rows.appendChild(row);
	
	// we need to append all the rows
	var row_i = null;
	for(var i=1; i<ROWS_MINIMUM; i++) {
		row_i = row.cloneNode(true);
		rows.appendChild(row_i);
	}
	
	// append another spacer at the bottom
	var bottomspacer = topspacer.cloneNode(true);
	bottomspacer.setAttribute('class', 'bottomSpacer');
	rows.appendChild(bottomspacer);
	
	// Insert the grid into the tab
	boxNode = (!viewSource) ? gBrowser.mCurrentBrowser.parentNode.appendChild(boxNode) : linkedPanel.appendChild(boxNode);
	gridNode = boxNode.appendChild(gridNode);
	
	return gridNode;
});

// Positions the grid on the right or on the left, accordingly to where the scrollbar should go in different locale layouts
this.positionGrid = function() {
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
			if(contentDocument.documentElement.dir == 'rtl') { dir = 'ltr'; }
			break;
		
		case 3:
			dir = 'ltr';
			break;
		
		case 2:
		default:
			break;
	}
	
	grid.parentNode.style.direction = dir;
};

// Prepares the grid to be filled with the highlights
this.resetHighlightGrid = function() {
	var rows = grid.childNodes[1];
	
	// Reset (clean) all grid rows
	for(var i=1; i<rows.childNodes.length-1; i++) {
		rows.childNodes[i].style.backgroundColor = null;
		removeAttribute(rows.childNodes[i], 'pattern');
		delete rows.childNodes[i]._pdfPages;
		delete rows.childNodes[i]._hasMatches;
	}
	
	// Adjust number of rows
	var gridHeight = Math.max(grid.clientHeight - (rows.childNodes[0].clientHeight *2), 0);
	grid._gridHeight = gridHeight;
	
	var num_rows = Math.max(Math.ceil(gridHeight / ROWS_MULTIPLIER), ROWS_MINIMUM);
	while(rows.childNodes.length -2 > num_rows) {
		rows.removeChild(rows.childNodes[1]);
	}
	while(rows.childNodes.length -2 < num_rows) {
		var newNode = rows.childNodes[1].cloneNode(true);
		rows.insertBefore(newNode, rows.lastChild);
	}
	
	// Somm grid appearance updates
	positionGrid();
	
	removeAttribute(grid, 'gridSpacers');
	listenerAid.remove(browserPanel, 'resize', delayResizeGridSpacers);
	
	if(viewSource) {
		removeAttribute($$('[anonid="gridBox"]')[0], 'style');
		listenerAid.remove(viewSource, 'resize', delayGridResizeViewSource);
	}
	
	if(!contentDocument) { return false; } // Don't remember if this ever happened but better be safe
	
	if(!isPDFJS) {
		// Fix for non-html files (e.g. xml files)
		// I don't remember why I put !gBrowser.mCurrentBrowser in here... it may have happened sometime
		if(!contentDocument.getElementsByTagName('html')[0]
		|| !contentDocument.getElementsByTagName('body')[0]
		|| (!viewSource && !gBrowser.mCurrentBrowser)) {
			return false;
		}
		
		var fullHTMLHeight = contentDocument.getElementsByTagName('html')[0].scrollHeight || contentDocument.getElementsByTagName('body')[0].scrollHeight;
	} else {
		var offsetY = contentDocument.querySelectorAll('div.toolbar')[0].clientHeight;
		var gridBox = linkedPanel.querySelectorAll('[anonid="gridBox"]')[0];
		gridBox.style.paddingTop = offsetY +'px';
		
		var fullHTMLHeight = contentDocument.getElementById('viewer').clientHeight;
	}
	
	// Don't think this can happen but I better make sure
	if(fullHTMLHeight == 0) { return false; }
	
	gridResizeViewSource();
	return true;
};

this.fillHighlightGrid = function(toAdd) {
	// For PDF files
	if(isPDFJS) {
		if(linkedPanel._matchesPDFtotal > prefAid.gridLimit) { return; }
		
		try {
			var scrollTop = contentDocument.getElementById('viewerContainer').scrollTop;
			var fullHTMLHeight = contentDocument.getElementById('viewer').clientHeight;
			var gridHeight = grid._gridHeight; // Let's not overuse the querySelectorAll queries, could seriously slow down the process...
		}
		catch(ex) { return; }
		
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
				var highlights = contentDocument.getElementById('pageContainer'+(p+1)).querySelectorAll('.highlight');
				for(var h=0; h<highlights.length; h++) {
					var rect = highlights[h].getBoundingClientRect();
					var absTop = (rect.top + scrollTop) / fullHTMLHeight;
					var absBot = (rect.bottom + scrollTop) / fullHTMLHeight;
					
					var rowList = placeHighlight(absTop, absBot, false, gridHeight);
					for(var r=0; r<rowList.length; r++) {
						if(!rowList[r]._hasMatches) {
							rowList[r]._hasMatches = 0;
						}
						rowList[r]._hasMatches++;
					}
				}
			}
			
			// If the page isn't rendered yet, use a placeholder for the page with a pattern
			else {
				var rect = contentDocument.getElementById('pageContainer'+unWrap.PDFView.pages[p].id).getBoundingClientRect();
				var absTop = (rect.top + scrollTop) / fullHTMLHeight;
				var absBot = (rect.bottom + scrollTop) / fullHTMLHeight;
				
				var rowList = placeHighlight(absTop, absBot, true, gridHeight);
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
		// I had checks for this before, if it reaches this point this shouldn't error but I'm preventing it anyway
		try {
			var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
			var fullHTMLHeight = contentDocument.getElementsByTagName('html')[0].scrollHeight || contentDocument.getElementsByTagName('body')[0].scrollHeight;
			var gridHeight = grid._gridHeight; // Let's not overuse the querySelectorAll queries, could seriously slow down the process...
		}
		catch(ex) { return; }
		
		for(var i=0; i<toAdd.length; i++) {
			var aRange = toAdd[i].node;
			var rect = aRange.getBoundingClientRect();
			var absTop = (rect.top + scrollTop) / fullHTMLHeight;
			var absBot = (rect.bottom + scrollTop) / fullHTMLHeight;
			
			placeHighlight(absTop, absBot, toAdd[i].pattern, gridHeight);
		}
	}
	
	gridResizeSpacers();
	listenerAid.add(browserPanel, 'resize', delayResizeGridSpacers);
};

this.placeHighlight = function(absTop, absBot, pattern, gridHeight) {
	var rowList = [];
	
	var highlighted = false;
	var row_bottom = 0;
	var rows = grid.childNodes[1];
	for(var j=1; j<rows.childNodes.length-1; j++) {
		var row = rows.childNodes[j];
		var row_top = row_bottom;
		var row_bottom = row_top + (row.clientHeight / gridHeight);
		
		// If any part of the row's range is within the match's range, highlight it
		if( (absTop >= row_top || absBot >= row_top) && (absTop <= row_bottom || absBot <= row_bottom) ) {
			row.style.backgroundColor = prefAid.highlightColor;
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

this.matchesPDFGrid = function() {
	if(resetHighlightGrid() && gFindBar.getElement('highlight').checked) {
		fillHighlightGrid();
	}
};

this.delayUpdatePDFGrid = function() {
	timerAid.init('delayUpdatePDFGrid', updatePDFGrid, 50);
};

this.updatePDFGrid = function() {
	if(!isPDFJS) { return; }
	
	try {
		var scrollTop = contentDocument.getElementById('viewerContainer').scrollTop;
		var fullHTMLHeight = contentDocument.getElementById('viewer').clientHeight;
		var gridHeight = grid._gridHeight; // Let's not overuse the querySelectorAll queries, could seriously slow down the process...
	}
	catch(ex) { return; } // if we return let's return before we do anything
	
	// We need this to access protected properties, hidden from privileged code
	var unWrap = XPCNativeWrapper.unwrap(contentWindow);
	
	var updatePages = [];
	var rows = grid.childNodes[1];
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
				row.style.backgroundColor = '';
			}
		}
	}
	
	if(updatePages.length == 0) { return; }
	
	var updatedPages = {};
	for(var p=0; p<updatePages.length; p++) {
		if(updatedPages[p]) { continue; }
		
		var highlights = contentDocument.getElementById('pageContainer'+(updatePages[p]+1)).querySelectorAll('.highlight');
		for(var h=0; h<highlights.length; h++) {
			var rect = highlights[h].getBoundingClientRect();
			var absTop = (rect.top + scrollTop) / fullHTMLHeight;
			var absBot = (rect.bottom + scrollTop) / fullHTMLHeight;
			
			var rowList = placeHighlight(absTop, absBot, false, gridHeight);
			for(var r=0; r<rowList.length; r++) {
				if(!rowList[r]._hasMatches) {
					rowList[r]._hasMatches = 0;
				}
				rowList[r]._hasMatches++;
			}
		}
		
		updatedPages[p] = true;
	}
};

this.delayResizeGridSpacers = function() {
	timerAid.init('resizeGridSpacers', gridResizeSpacers);
};

this.gridResizeSpacers = function() {
	// Lets make sure contentDocument and it's elements exist before trying to access them
	try {
		if(!isPDFJS) {
			var scrollTopMax = contentDocument.getElementsByTagName('html')[0].scrollTopMax || contentDocument.getElementsByTagName('body')[0].scrollTopMax;
			var scrollLeftMax = contentDocument.getElementsByTagName('html')[0].scrollLeftMax || contentDocument.getElementsByTagName('body')[0].scrollLeftMax;
		} else {
			var scrollTopMax = contentDocument.getElementById('viewerContainer').scrollTopMax;
			var scrollLeftMax = contentDocument.getElementById('viewerContainer').scrollLeftMax;
		}
	}
	catch(ex) { return; }
	
	if(scrollTopMax == 0 && scrollLeftMax == 0) {
		setAttribute(grid, 'gridSpacers', 'none');
	} else if(scrollTopMax > 0 && scrollLeftMax > 0) {
		setAttribute(grid, 'gridSpacers', 'double');
	} else {
		setAttribute(grid, 'gridSpacers', 'single');
	}
};

this.delayGridResizeViewSource = function() {
	timerAid.init('resizeViewSource', gridResizeViewSource, 0);
};

this.gridResizeViewSource = function() {
	if(!viewSource) { return; }
	
	var contentPos = $('content').getBoundingClientRect();
	var styleString = 'top: '+contentPos.top+'px;';
	styleString += ' height: '+contentPos.height+'px;';
	setAttribute($$('[anonid="gridBox"]')[0], 'style', styleString);
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
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ side: 0 }, 'scrollbar', 'layout');
	
	listenerAid.add(gFindBar, 'UpdatedPDFMatches', matchesPDFGrid);
	
	prefAid.listen('gridAdjustPadding', adjustGrid);
	prefAid.listen('gridAdjustWidth', adjustGrid);
	adjustGrid();
	
	observerAid.notify('ReHighlightAll');
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('gridAdjustPadding', adjustGrid);
	prefAid.unlisten('gridAdjustWidth', adjustGrid);
	styleAid.unload('adjustGrid_'+_UUID);
	
	listenerAid.remove(gFindBar, 'UpdatedPDFMatches', matchesPDFGrid);
	listenerAid.remove(browserPanel, 'resize', delayResizeGridSpacers);
	
	if(!viewSource) {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			if(gBrowser.mTabs[t].linkedBrowser.contentDocument) {
				listenerAid.remove(gBrowser.mTabs[t].linkedBrowser.contentDocument.getElementById('viewerContainer'), 'scroll', delayUpdatePDFGrid);
			}
			var panel = $(gBrowser.mTabs[t].linkedPanel);
			var innerGrid = panel.querySelectorAll('[anonid="gridBox"]');
			if(innerGrid.length > 0) {
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
