Modules.VERSION = '2.1.1';

this.grids = {
	template: null,
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'MozScrolledAreaChanged':
				this.reposition(500);
				break;
				
			case 'TabSelect':
				this.reposition(25);
				break;
			
			case 'resize':
				Timers.init('resizeViewSource', () => { this.resizeViewSource(); }, 0);
				break;
		}
	},
	
	observe: function(aSubject, aTopic, aData) {
		switch(aSubject) {
			case 'gridAdjustPadding':
			case 'gridAdjustWidth':
				this.adjust();
				break;
			
			case 'gridLimit':
				this.removeAll();
				Observers.notify('ReHighlightAll');
				break;
		}
	},
	
	get: function(bar, toRemove) {
		for(let child of bar.browser.parentNode.childNodes) {
			if(child.getAttribute('anonid') == 'gridBox') { return child.firstChild; }
		}
		
		if(toRemove) { return null; }
		
		// "cache" a template grid, cloning it is faster than having to 
		if(!this.template) {
			this.template = this.create(document);
		}
		
		var boxNode = this.template.cloneNode(true);
		this.initArrays(boxNode.firstChild);
		
		// Insert the grid into the tab
		bar.browser.parentNode.appendChild(boxNode);
		
		return boxNode.firstChild;
	},
	
	// Creates a new grid
	create: function(doc, html) {
		// First the grid itself
		var boxNode = doc.createElement('hbox');
		boxNode.setAttribute('anonid', 'gridBox');
		
		// It shouldn't depend on the stylesheet being loaded, it could error and the browser would be unusable
		boxNode.style.pointerEvents = 'none';
		
		var gridNode = doc.createElement('vbox');
		gridNode.setAttribute('anonid', 'findGrid');
		gridNode = boxNode.appendChild(gridNode);
		
		// Starting with the top spacer
		var topspacer = doc.createElement('vbox');
		topspacer.setAttribute('flex', '0');
		topspacer.setAttribute('class', 'topSpacer');
		topspacer = gridNode.appendChild(topspacer);
		
		// Container for the highlight rows
		var container = doc.createElement('vbox');
		container.setAttribute('flex', '1');
		gridNode.appendChild(container);
		
		// append another spacer at the bottom
		var bottomspacer = topspacer.cloneNode(true);
		bottomspacer.setAttribute('class', 'bottomSpacer');
		gridNode.appendChild(bottomspacer);
		
		return boxNode;
	},
	
	initArrays: function(grid) {
		grid._container = grid.childNodes[1];
		grid.allHits = new Map();
	},
	
	// the following methods respond to messages from the content process; it's content that calculates which hits/row to display and how
	
	gridAttribute: function(grid, data) {
		toggleAttribute(grid, data.attr, !data.remove, data.val);
	},
	
	gridStyle: function(grid, data) {
		grid.style[data.prop] = data.val;
	},
	
	gridDirection: function(grid, data) {
		grid.parentNode.style.direction = data;
	},
	
	addHit: function(grid, data) {
		let hit = {
			rows: new Set()
		};
		
		for(let r of data.rows) {
			hit.rows.add(grid._container.childNodes[r]);
		}
		
		grid.allHits.set(data.i, hit);
	},
	
	setHover: function(grid, data) {
		if(!grid.allHits.has(data.i)) { return; }
		
		var rows = grid.allHits.get(data.i).rows;
		for(let row of rows) {
			try { toggleAttribute(row, 'hover', data.isHover); }
			catch(ex) {}
		}
	},
	
	setCurrent: function(grid, data) {
		if(!grid.allHits.has(data.i)) { return; }
		
		var rows = grid.allHits.get(data.i).rows;
		for(let row of rows) {
			try { toggleAttribute(row, 'current', data.isCurrent); }
			catch(ex) {}
		}
	},
	
	append: function(grid, data) {
		// appending the first row, we'll use it as a template for subsequent ones
		if(data == 0) {
			// Row template, so I can just clone from this
			var row = document.createElement('vbox');
			row.style.minHeight = '2px';
			grid._container.appendChild(row);
			return;
		}
		
		var row = grid._container.firstChild.cloneNode(true);
		grid._container.appendChild(row); // we're supposing we should always append to the end, since that's how content does it
	},
	
	remove: function(grid, data) {
		grid._container.childNodes[data].remove();
	},
	
	setAttribute: function(grid, data) {
		setAttribute(grid._container.childNodes[data.i], data.attr, data.val);
	},
	
	removeAttribute: function(grid, data) {
		removeAttribute(grid._container.childNodes[data.i], data.attr);
	},
	
	style: function(grid, data) {
		grid._container.childNodes[data.i].style[data.prop] = data.val;
	},
	
	// end of content messages handlers
	
	lastAdjust: '',
	adjust: function() {
		var defaultPadding = (WINNT) ? 2 : 0;
		var defaultWidth = (WINNT) ? 13 : (DARWIN) ? 14 : 12;
		
		this.lastAdjust = '	-moz-margin-start: '+(defaultPadding +Prefs.gridAdjustPadding)+'px;\n';
		this.lastAdjust += '	width: '+(defaultWidth +Prefs.gridAdjustWidth)+'px;\n';
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] vbox[anonid="findGrid"] {\n';
		sscode += 		this.lastAdjust;
		sscode += '	}\n';
		sscode += '}';
		
		Styles.load('adjustGrid_'+_UUID, sscode, true);
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.w3.org/1999/xhtml);\n';
		sscode += 'div[ownedByFindBarTweak][anonid="gridBox"] div[anonid="findGrid"] {\n';
		sscode += 	this.lastAdjust;
		sscode += '}\n';
		
		Styles.load('adjustFrameGrid_'+_UUID, sscode, true);
		
		// For hbox frame grids
		dispatch(window, { type: 'AdjustFrameGrid', cancelable: false });
	},
	
	resizeViewSource: function() {
		var contentPos = gFindBar.browser.getBoundingClientRect();
		gFindBar.grid.parentNode.style.top = contentPos.top+'px';
		gFindBar.grid.parentNode.style.height = contentPos.height+'px';
	},
	
	reposition: function(delay) {
		if(documentHighlighted) {
			var bar = gFindBar;
			Timers.init('repositionGrids', () => {
				if(!gFindBarInitialized || gFindBar != bar) { return; }
				
				Messenger.messageBrowser(bar.browser, 'Grid:Reposition');
			}, delay);
		}
	},
	
	removeAll: function() {
		if(!viewSource) {
			for(let tab of gBrowser.tabs) {
				if(!gBrowser.isFindBarInitialized(tab)) { continue; }
				
				Messenger.messageBrowser(tab.linkedBrowser, 'Grid:Remove');
				var aGrid = grids.get(gBrowser.getFindBar(tab), true);
				if(aGrid) {
					aGrid.parentNode.remove();
				}
			}
		}
		else {
			Messenger.messageBrowser(gFindBar.linkedBrowser, 'Grid:Remove');
			var aGrid = grids.get(gFindBar, true);
			if(aGrid) {
				aGrid.parentNode.remove();
			}
		}
	}
};

Modules.LOADMODULE = function() {
	var gridDefaults = {};
	gridDefaults['scrollbar.side'] = 0;
	Prefs.setDefaults(gridDefaults, 'layout', '');
	Prefs.listen('scrollbar.side', Messenger);
	Messenger.observe('scrollbar.side', 'nsPref:changed', Prefs['scrollbar.side']);
	
	Styles.load('grid', 'grid');
	Styles.load('frameGrid', 'frameGrid');
	
	if(!viewSource) {
		Listeners.add(window, 'MozScrolledAreaChanged', grids, true);
		Listeners.add(gBrowser.tabContainer, 'TabSelect', grids);
	} else {
		Listeners.add(viewSource, 'resize', grids);
	}
	
	initFindBar('grid',
		function(bar) {
			bar.__defineGetter__('grid', function() { return grids.get(bar); });
			
			bar.browser.finder.addMessage('Grid:Attribute', data => {
				grids.gridAttribute(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Style', data => {
				grids.gridStyle(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Direction', data => {
				grids.gridDirection(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Hit:Create', data => {
				grids.addHit(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Hit:Hover', data => {
				grids.setHover(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Hit:Current', data => {
				grids.setCurrent(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Row:Append', data => {
				grids.append(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Row:Remove', data => {
				grids.remove(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Row:SetAttribute', data => {
				grids.setAttribute(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Row:RemoveAttribute', data => {
				grids.removeAttribute(bar.grid, data);
			});
			
			bar.browser.finder.addMessage('Grid:Row:Style', data => {
				grids.style(bar.grid, data);
			});
			
			Messenger.loadInBrowser(bar.browser, 'grid');
			
			if(viewSource) {
				grids.resizeViewSource();
			}
		},
		function(bar) {
			if(!bar._destroying) {
				bar.browser.finder.removeMessage('Grid:Attribute');
				bar.browser.finder.removeMessage('Grid:Style');
				bar.browser.finder.removeMessage('Grid:Direction');
				bar.browser.finder.removeMessage('Grid:Hit:Create');
				bar.browser.finder.removeMessage('Grid:Hit:Hover');
				bar.browser.finder.removeMessage('Grid:Hit:Current');
				bar.browser.finder.removeMessage('Grid:Row:Append');
				bar.browser.finder.removeMessage('Grid:Row:Remove');
				bar.browser.finder.removeMessage('Grid:Row:SetAttribute');
				bar.browser.finder.removeMessage('Grid:Row:RemoveAttribute');
				bar.browser.finder.removeMessage('Grid:Row:Style');
			}
			
			Messenger.unloadFromBrowser(bar.browser, 'grid');
			
			var aGrid = grids.get(bar, true);
			if(aGrid) {
				aGrid.parentNode.remove();
			}
			delete bar.grid;
		}
	);
	
	Prefs.listen('gridAdjustPadding', grids);
	Prefs.listen('gridAdjustWidth', grids);
	Prefs.listen('gridLimit', grids);
	grids.adjust();
	
	Observers.notify('ReHighlightAll');
};

Modules.UNLOADMODULE = function() {
	Prefs.unlisten('gridAdjustPadding', grids);
	Prefs.unlisten('gridAdjustWidth', grids);
	Prefs.unlisten('gridLimit', grids);
	Prefs.unlisten('scrollbar.side', Messenger);
	
	Styles.unload('adjustGrid_'+_UUID);
	Styles.unload('adjustFrameGrid_'+_UUID);
	
	deinitFindBar('grid');
	
	grids.removeAll();
	if(!viewSource) {
		Timers.cancel('repositionGrids');
		Listeners.remove(window, 'MozScrolledAreaChanged', grids, true);
		Listeners.remove(gBrowser.tabContainer, 'TabSelect', grids);
	} else {
		Listeners.remove(viewSource, 'resize', grids);
	}
	
	if(UNLOADED || !Prefs.useGrid) {
		Styles.unload('grid', 'grid');
		Styles.unload('frameGrid', 'frameGrid');
	}
	
	if(!UNLOADED && !window.closed && !window.willClose) {
		Observers.notify('ReHighlightAll');
	}
};
