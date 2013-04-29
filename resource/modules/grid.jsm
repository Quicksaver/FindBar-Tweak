moduleAid.VERSION = '1.0.3';

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

// Prepares the grid to be filled with the highlights
this.resetHighlightGrid = function() {
	var rows = grid.childNodes[1];
	
	// Reset (clean) all grid rows
	for(var i=1; i<rows.childNodes.length-1; i++) {
		rows.childNodes[i].style.backgroundColor = null;
		rows.childNodes[i].style.backgroundImage = null;
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
	
	removeAttribute(grid, 'gridSpacers');
	listenerAid.remove(browserPanel, 'resize', delayResizeGridSpacers);
	
	if(viewSource) {
		removeAttribute($$('[anonid="gridBox"]')[0], 'style');
		listenerAid.remove(viewSource, 'resize', delayGridResizeViewSource);
	}
	
	// Fix for non-html files (e.g. xml files)
	// I don't remember why I put !gBrowser.mCurrentBrowser in here... it may have happened sometime
	if(!contentDocument
	|| !contentDocument.getElementsByTagName('html')[0]
	|| !contentDocument.getElementsByTagName('body')[0]
	|| (!viewSource && !gBrowser.mCurrentBrowser)) {
		return false;
	}
	
	var fullHTMLHeight = contentDocument.getElementsByTagName('html')[0].scrollHeight || contentDocument.getElementsByTagName('body')[0].scrollHeight;
	
	// Don't think this can happen but I better make sure
	if(fullHTMLHeight == 0) { return false; }
	
	gridResizeViewSource();
	return true;
};

this.fillHighlightGrid = function(toAdd) {
	// I had checks for this before, if it reaches this point this shouldn't error but I'm preventing it anyway
	try {
		var scrollTop = contentDocument.getElementsByTagName('html')[0].scrollTop || contentDocument.getElementsByTagName('body')[0].scrollTop;
		var fullHTMLHeight = contentDocument.getElementsByTagName('html')[0].scrollHeight || contentDocument.getElementsByTagName('body')[0].scrollHeight;
		var gridHeight = grid._gridHeight;
	}
	catch(ex) { return; }
	
	for(var i=0; i<toAdd.length; i++) {
		var aRange = toAdd[i].node;
		var rect = aRange.getBoundingClientRect();
		var absTop = (rect.top + scrollTop) / fullHTMLHeight;
		var absBot = (rect.bottom + scrollTop) / fullHTMLHeight;
		
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
				if(toAdd[i].pattern) {
					row.style.backgroundImage = 'url("chrome://findbartweak/skin/pattern.gif")';
				}
				highlighted = true;
			}
			
			// Don't cycle through the whole grid unnecessarily
			else if(highlighted) {
				break;
			}
		}
	}
	
	gridResizeSpacers();
	listenerAid.add(browserPanel, 'resize', delayResizeGridSpacers);
};

this.delayResizeGridSpacers = function() {
	timerAid.init('resizeGridSpacers', gridResizeSpacers);
};

this.gridResizeSpacers = function() {
	// Lets make sure contentDocument and it's elements exist before trying to access them
	try {
		var scrollTopMax = contentDocument.getElementsByTagName('html')[0].scrollTopMax || contentDocument.getElementsByTagName('body')[0].scrollTopMax;
		var scrollLeftMax = contentDocument.getElementsByTagName('html')[0].scrollLeftMax || contentDocument.getElementsByTagName('body')[0].scrollLeftMax;
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

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(browserPanel, 'resize', delayResizeGridSpacers);
	
	if(!viewSource) {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
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
