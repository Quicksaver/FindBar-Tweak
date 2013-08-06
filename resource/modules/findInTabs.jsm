moduleAid.VERSION = '1.5.6';

this.__defineGetter__('FITresizer', function() { return gFindBar._FITresizer; });
this.__defineGetter__('FITbox', function() { return $(objName+'-findInTabs-box'); });
this.__defineGetter__('FITtabs', function() { return $(objName+'-findInTabs-tabs'); });
this.__defineGetter__('FITtabsList', function() { return FITtabs.firstChild; });
this.__defineGetter__('FITtabsHeader', function() { return FITtabsList.firstChild; });
this.__defineGetter__('FIThits', function() { return $(objName+'-findInTabs-hits'); });
this.__defineGetter__('FITbroadcaster', function() { return $(objName+'-findInTabs-broadcaster'); });
this.__defineGetter__('FITbutton', function() { return gFindBar._FITtoggle; });
this.__defineGetter__('FITupdate', function() { return gFindBar._FITupdate; });

this.HITS_LENGTH = 150; // Length of preview text from preview items in find in tabs box

this.processingFITTab = false; // true means we are processing a tab currently, to ensure we only do one at a time to boost performance

this.toggleFIT = function() {
	var toggle = FITbox.hidden;
	
	FITbox.hidden = !toggle;
	toggleAttribute(FITbroadcaster, 'checked', toggle);
	updateFITElements();
	
	/* Open the findbar if it isn't already when opening FIT */
	if(toggle && (gFindBar.hidden || gFindBar._findMode == gFindBar.FIND_TYPEAHEAD)) {
		gFindBar.onFindCommand();
		if(gFindBar._findField.value) {
			gFindBar._setHighlightTimeout();
		}
	}
	else if(!toggle && linkedPanel._findWord) {
		gFindBar.value = linkedPanel._findWord;
	}
	
	initFindBar('toggleFIT',
		function(bar) { bar._keepCurrentValue = toggle; },
		function(bar) { delete bar._keepCurrentValue; },
		true
	);
	
	if(perTabFB) {
		timerAid.init('toggleFIT', function() {
			if(toggle) {
				moduleAid.load('globalFB');
			} else {
				togglePerTab();
			}
		}, 0);
	}
	
	shouldFindAll();
};

this.commandUpdateFIT = function() {
	if(FITbox.hidden) {
		toggleFIT();
		return;
	}
	shouldFindAll();
};

this.addFITElements = function(bar) {
	var container = bar.getElement("findbar-container");
	
	var toggleButton = document.createElement('toolbarbutton');
	setAttribute(toggleButton, 'anonid', objName+'-find-tabs');
	setAttribute(toggleButton, 'class', 'findbar-highlight findbar-tabs tabbable findbar-no-find-fast');
	setAttribute(toggleButton, 'observes', objName+'-findInTabs-broadcaster');
	bar._FITtoggle = container.insertBefore(toggleButton, bar.getElement('highlight'));
	
	var updateButton = document.createElement('toolbarbutton');
	setAttribute(updateButton, 'anonid', objName+'-find-tabs-update');
	setAttribute(updateButton, 'class', 'findbar-tabs-update findbar-no-find-fast findbar-no-auto-show tabbable');
	setAttribute(updateButton, 'label', stringsAid.get('findInTabs', 'updateButtonLabel'));
	setAttribute(updateButton, 'tooltiptext', stringsAid.get('findInTabs', 'updateButtonTooltip'+(Services.appinfo.OS == 'Darwin' ? 'Mac' : 'Win')));
	setAttribute(updateButton, 'oncommand', objName+'.shouldFindAll();');
	updateButton.hidden = true;
	bar._FITupdate = container.insertBefore(updateButton, bar.getElement((!perTabFB) ? 'find-label' : 'findbar-textbox-wrapper'));
	
	var resizer = document.createElement('resizer');
	setAttribute(resizer, 'anonid', objName+'-findInTabs-resizer');
	setAttribute(resizer, 'dir', 'top');
	setAttribute(resizer, 'element', objName+'-findInTabs-box');
	resizer.hidden = true;
	var sibling = (!perTabFB) ? bar : bar.nextSibling;
	bar._FITresizer = bar.parentNode.insertBefore(resizer, sibling);
	
	if((!perTabFB || gFindBarInitialized) && bar == gFindBar) {
		updateFITElements();
	}
};

this.removeFITElements = function(bar) {
	bar._FITtoggle.parentNode.removeChild(bar._FITtoggle);
	bar._FITupdate.parentNode.removeChild(bar._FITupdate);
	bar._FITresizer.parentNode.removeChild(bar._FITresizer);
	delete bar._FITtoggle;
	delete bar._FITupdate;
	delete bar._FITresizer;
};

this.updateFITElements = function() {
	if(perTabFB && !gFindBarInitialized) { return; }
	
	FITresizer.hidden = FITbox.hidden;
	FITupdate.hidden = FITbox.hidden;
	
	if(!perTabFB) {
		if(trueAttribute(FITbox, 'movetotop')) {
			if(FITresizer.getAttribute('position') != 'top') {
				gFindBar._FITresizer = browserPanel.insertBefore(FITresizer, FITbox.nextSibling);
			}
			setAttribute(FITresizer, 'position', 'top');
		} else {
			if(FITresizer.getAttribute('position') != 'bottom') {
				gFindBar._FITresizer = gFindBar.parentNode.insertBefore(FITresizer, gFindBar);
			}
			setAttribute(FITresizer, 'position', 'bottom');
		}
	} else {
		toggleAttribute(FITresizer, 'position', trueAttribute(FITbox, 'movetotop'), 'top', 'bottom');
	}
	
	noToolboxBorder('FIT', (!FITbox.hidden && trueAttribute(FITbox, 'movetotop')));
	
	toggleAttribute(FITresizer, 'movetotop', trueAttribute(FITbox, 'movetotop'));
	toggleAttribute(FITresizer, 'dir', trueAttribute(FITbox, 'movetotop'), 'bottom', 'top');
};

this.closeFITWithFindBar = function() {
	if(FITbroadcaster.getAttribute('checked')) { toggleFIT(); }
};

this.docUnloaded = function(aDoc) {
	if(aDoc.readyState == 'uninitialized'
	|| (aDoc.baseURI == 'chrome://browser/content/browser.xul' && aDoc.URL == 'about:blank')) {
		return true;
	}
	return false;
};

this.getWindowForContent = function(aDoc) {
	var exists = null;
	windowMediator.callOnAll(function(aWindow) {
		if(!exists && aWindow.gBrowser.getBrowserForDocument(aDoc)) {
			exists = aWindow;
		}
	}, 'navigator:browser');
	
	if(!exists) {
		windowMediator.callOnAll(function(aWindow) {
			if(!exists && aWindow.document.getElementById('content').contentDocument == aDoc) {
				exists = aWindow;
			}
		}, 'navigator:view-source');
	}
	
	return exists;
};

this.getTabForContent = function(aDoc) {
	var exists = null;
	windowMediator.callOnAll(function(aWindow) {
		if(!exists) {
			exists = aWindow.gBrowser._getTabForContentWindow(aDoc.defaultView);
		}
	}, 'navigator:browser');
	
	if(!exists) {
		windowMediator.callOnAll(function(aWindow) {
			if(!exists && aWindow.document.getElementById('content').contentDocument == aDoc) {
				exists = 'viewSource';
			}
		}, 'navigator:view-source');
	}
	
	return exists;
};

this.getPanelForContent = function(aDoc) {
	var tab = getTabForContent(aDoc);
	if(!tab || tab == 'viewSource') { return tab; }
	
	return tab.linkedPanel;
};

this.verifyFITselection = function() {
	// Re-Do the list if something is invalid
	if(!FITtabsList.currentItem) { return null; }
	if(!FITtabsList.currentItem.linkedDocument) {
		shouldFindAll();
		return null;
	}
	
	var exists = getWindowForContent(FITtabsList.currentItem.linkedDocument);
	
	// Should Re-Do the lists when the tab is closed for example
	if(!exists) {
		shouldFindAll();
		return null;
	}
	
	return exists;
};

// When the user selects an item in the tabs list
this.selectFITtab = function() {
	var shouldHide = !verifyFITselection();
	
	for(var i=0; i<FIThits.childNodes.length; i++) {
		FIThits.childNodes[i].hidden = shouldHide || (FIThits.childNodes[i] != FITtabsList.currentItem.linkedHits);
	}
};

// When the user selects an item in the hits list
this.selectFIThit = function() {
	// Adding these checks prevents various error messages from showing in the console (even though they actually made no difference)
	if(!FITtabsList.currentItem || !FITtabsList.currentItem.linkedHits.currentItem) { return; }
	
	// Multiple clicks on the same item shouldn't re-trigger tab load
	if(FITtabsList.currentItem.linkedHits.currentItem.loadingTab) {
		FITtabsList.currentItem.linkedHits.onselect = null;
		FITtabsList.currentItem.linkedHits.selectedIndex = -1;
		FITtabsList.currentItem.linkedHits.onselect = selectFIThit;
		return;
	}
	
	var inWindow = verifyFITselection();
	if(!inWindow || !FITtabsList.currentItem.linkedHits.currentItem) { return; }
	
	// Load the tab if it's unloaded
	if(FITtabsList.currentItem.linkedHits.currentItem.isUnloadedTab) {
		var tab = getTabForContent(FITtabsList.currentItem.linkedDocument);
		// Something went wrong, this should never happen.
		if(!tab) {
			FIThits.removeChild(FITtabsList.currentItem.linkedHits);
			FITtabsList.removeChild(FITtabsList.currentItem);
			return;
		}
		
		// If tab is already loading, don't bother reloading
		if(docUnloaded(tab.linkedBrowser.contentDocument) && tab.linkedBrowser.contentDocument.readyState != 'loading') {
			inWindow.gBrowser.reloadTab(tab);
		}
		
		FITtabsList.currentItem.linkedHits.currentItem.loadingTab = true;
		setAttribute(FITtabsList.currentItem.linkedHits.currentItem.childNodes[0], 'value', stringsAid.get('findInTabs', 'loadingTab'));
		removeAttribute(FITtabsList.currentItem.linkedTitle, 'unloaded');
		FITtabsList.currentItem.linkedHits.onselect = null;
		FITtabsList.currentItem.linkedHits.selectedIndex = -1;
		FITtabsList.currentItem.linkedHits.onselect = selectFIThit;
		return;
	}
	
	var inFindBar = inWindow.document.getElementById('FindToolbar') || inWindow.gFindBar;
	var ranges = FITtabsList.currentItem.linkedHits.currentItem.linkedRanges;
	var rangeIdx = FITtabsList.currentItem.linkedHits.currentItem.rangeIdx;
	if(rangeIdx > -1) {
		var selectRange = ranges[FITtabsList.currentItem.linkedHits.currentItem.rangeIdx].range;
		FITtabsList.currentItem.linkedHits.currentItem.rangeIdx = -1;
	} else {
		var selectRange = ranges[0].range;
	}
	
	if(inPDFJS(FITtabsList.currentItem.linkedDocument)) {
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(FITtabsList.currentItem.linkedDocument.defaultView);
		if(!unWrap.PDFFindController) { return; } // Don't know if this is possible but I need this so better make sure
		
		// Don't do anything when the current selection is contained within the ranges of this item.
		// We don't want to keep re-selecting it.
		if(rangeIdx > -1) {
			if(selectRange.p == unWrap.PDFFindController.selected.pageIdx && selectRange.m == unWrap.PDFFindController.selected.matchIdx) { return; }
		} else {
			for(var r=0; r<ranges.length; r++) {
				if(unWrap.PDFFindController.selected.pageIdx == ranges[r].range.p && unWrap.PDFFindController.selected.matchIdx == ranges[r].range.m) { return; }
			}
		}
		
		inWindow.focus();
		inWindow.gBrowser.selectedTab = inWindow.gBrowser._getTabForContentWindow(FITtabsList.currentItem.linkedDocument.defaultView);
		
		// Make sure we trigger a find event, so the pdf document renders our matches
		if(!unWrap.PDFFindController.state
		|| unWrap.PDFFindController.state.query != gFindBar._findField.value
		|| unWrap.PDFFindController.state.caseSensitive != !!gFindBar._typeAheadCaseSensitive) {
			var caseSensitive = !!gFindBar._typeAheadCaseSensitive;
			inFindBar._findField.value = gFindBar._findField.value;
			inFindBar.getElement('find-case-sensitive').checked = caseSensitive;
			inFindBar._setCaseSensitivity(caseSensitive); // This should be enough to trigger the find
			
			aSync(function() {
				finishSelectingPDFhit(unWrap, inFindBar, selectRange);
			});
		}
		
		finishSelectingPDFhit(unWrap, inFindBar, selectRange);
		return;
	}
	
	var editableNode = inFindBar.browser._fastFind.foundEditable;
	var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
	if(!controller) {
		controller = inFindBar._getSelectionController(FITtabsList.currentItem.linkedDocument.defaultView);
	}
	var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	
	if(sel.rangeCount == 1) {
		var selRange = sel.getRangeAt(0);
		// Don't do anything when the current selection is contained within the ranges of this item.
		// We don't want to keep re-selecting it.
		if(rangeIdx > -1) {
			if(compareRanges(selectRange, selRange)) { return; }
		} else {
			for(var r=0; r<ranges.length; r++) {
				if(compareRanges(ranges[r].range, selRange)) { return; }
			}
		}
	}
	
	// This next double-controller hack, although ugly, is the only way I managed to get both the active selected element and the "green" background for the selected hit
	// to go into the same place, when alternating between editable nodes and normal nodes.
	// This method is still not perfect, a sometimes a green selection will linger when alternating between these types of nodes.
	// However, this only happens sometimes and should be fine for most uses, it is also better than the alternative, which is how it was before where you wouldn't get
	// a green background anywhere when alternating between these types of nodes.
	
	sel.removeAllRanges();
	sel.addRange(selectRange);
	controller.scrollSelectionIntoView(gFindBar.nsISelectionController.SELECTION_NORMAL, gFindBar.nsISelectionController.SELECTION_WHOLE_SELECTION, gFindBar.nsISelectionController.SCROLL_CENTER_VERTICALLY);
	
	if(editableNode) {
		try { inFindBar.browser._fastFind.foundEditable = null; } catch(ex) {}
		try { inFindBar._foundEditable = null; } catch(ex) {}
	}
	
	editableNode = inFindBar._getEditableNode(selectRange.startContainer);
	if(editableNode) {
		inFindBar.browser._fastFind.foundEditable = editableNode;
		inFindBar._foundEditable = editableNode;
		var controller = editableNode.editor.selectionController;
	} else {
		var controller = inFindBar._getSelectionController(selectRange.startContainer.ownerDocument.defaultView);
	}
	sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	
	sel.removeAllRanges();
	sel.addRange(selectRange);
	controller.scrollSelectionIntoView(gFindBar.nsISelectionController.SELECTION_NORMAL, gFindBar.nsISelectionController.SELECTION_WHOLE_SELECTION, gFindBar.nsISelectionController.SCROLL_CENTER_VERTICALLY);
	controller.setDisplaySelection(controller.SELECTION_ATTENTION);
	
	inWindow.focus();
	if(inWindow.gBrowser.selectedTab) { // view-source doesn't have or need this
		inWindow.gBrowser.selectedTab = inWindow.gBrowser._getTabForContentWindow(FITtabsList.currentItem.linkedDocument.defaultView);
	}
	
	dispatch(inFindBar, { type: 'SelectedFIThit', cancelable: false });
};

this.selectHighlightInItem = function(label) {
	var item = label.parentNode.parentNode;
	item.rangeIdx = label.rangeIdx;
	delayHighlightFITinGrid(item);
};

this.delayHighlightFITinGrid = function(item) {
	timerAid.init('delayHighlightFITinGrid', function() { highlightFITinGrid(item); }, 25);
};

this.highlightFITinGrid = function(item) {
	// We can't do this unless we're in the same tab using the grid highlighting the same word
	if(!shouldUseFITWithGrid()) { return; }
	
	clearHoverRows();
	
	if(item.rangeIdx > -1) {
		var selectRange = item.linkedRanges[item.rangeIdx].range;
	} else {
		var selectRange = item.linkedRanges[0].range;
	}
	
	var hoverRows = grid._hoverRows;
	var ranges = grid._allHits;
	
	if(isPDFJS) {
		// Try the rendered matches first
		for(var i=0; i<ranges.length; i++) {
			if(selectRange.p == ranges[i].p && selectRange.m == ranges[i].m) {
				for(var r=0; r<ranges[i].rows.length; r++) {
					setAttribute(ranges[i].rows[r], 'hover', 'true');
					hoverRows.push(ranges[i].rows[r]);
				}
				return;
			}
		}
		
		// If it gets here it's probably a page that hasn't been rendered yet
		var patternRows = grid.querySelectorAll('[pattern]');
		for(var i=0; i<patternRows.length; i++) {
			if(!patternRows[i]._pdfPages) { continue; }
			for(var p=0; p<patternRows[i]._pdfPages.length; p++) {
				if(patternRows[i]._pdfPages[p] == selectRange.p) {
					setAttribute(patternRows[i], 'hover', 'true');
					hoverRows.push(patternRows[i]);
				}
			}
		}
	}
	else {
		// This is actually very direct
		for(var i=0; i<ranges.length; i++) {
			if(compareRanges(selectRange, ranges[i].range)) {
				for(var r=0; r<ranges[i].rows.length; r++) {
					setAttribute(ranges[i].rows[r], 'hover', 'true');
					hoverRows.push(ranges[i].rows[r]);
				}
				return;
			}
		}
	}
};

this.removeFITHighlightFromGrid = function() {
	// We can't do this unless we're in the same tab using the grid highlighting the same word
	if(!shouldUseFITWithGrid()) { return; }
	
	timerAid.cancel('delayHighlightFITinGrid');
	clearHoverRows();
};

this.shouldUseFITWithGrid = function() {
	// We can't do this unless we're in the same tab using the grid highlighting the same word
	if(!prefAid.useGrid || FITtabsList.currentItem.linkedDocument != contentDocument) { return false; }
	
	if(!isPDFJS) {
		if(!documentHighlighted || documentReHighlight || linkedPanel._findWord != gFindBar._findField.value) { return false; }
	} else {
		var unWrap = XPCNativeWrapper.unwrap(contentWindow);
		if(unWrap.PDFFindController.state.query != gFindBar._findField.value) { return false; }
	}
	
	return true;
};

this.finishSelectingPDFhit = function(unWrap, inFindBar, range) {
	unWrap.PDFFindController.selected.pageIdx = range.p;
	unWrap.PDFFindController.selected.matchIdx = range.m;
	unWrap.PDFFindController.offset.pageIdx = range.p;
	unWrap.PDFFindController.offset.matchIdx = range.m;
	unWrap.PDFFindController.offset.wrapped = false;
	unWrap.PDFFindController.updatePage(range.p);
	
	timerAid.init('finishSelectingPDFhit', function() {
		inFindBar._updateStatusUI(gFindBar.nsITypeAheadFind.FIND_FOUND);
	}, 50);
};

// The main commander of the FIT function, cleans up results and schedules new ones if the box is opened	
this.shouldFindAll = function() {
	// Remove previous results if they exist
	if(FITtabs.firstChild) { FITtabs.removeChild(FITtabs.firstChild); }
	while(FIThits.firstChild) { FIThits.removeChild(FIThits.firstChild); }
	
	var newTabs = document.createElement('richlistbox');
	newTabs.setAttribute('flex', '1');
	newTabs.onselect = selectFITtab;
	
	var newHeader = document.createElement('listheader');
	var firstCol = document.createElement('treecol');
	firstCol.setAttribute('label', stringsAid.get('findInTabs', 'tabsHeader'));
	firstCol.setAttribute('colspan', '2');
	firstCol.setAttribute('flex', '1');
	var secondCol = document.createElement('treecol');
	secondCol.setAttribute('class', 'hitsHeader');
	secondCol.setAttribute('label', stringsAid.get('findInTabs', 'hitsHeader'));
	
	newHeader.appendChild(firstCol);
	newHeader.appendChild(secondCol);
	newTabs.appendChild(newHeader);
	
	FITtabs.appendChild(newTabs);
	
	timerAid.init('shouldFindAll', function() {
		if(FITbroadcaster.getAttribute('checked')) { beginFITFind(); }
	}, 250);
};

this.beginFITFind = function() {
	if(!gFindBar._findField.value) { return; }
	
	browserMediator.callOnAll(getFITTabs, null, true, true);
	windowMediator.callOnAll(function(aWindow) {
		getFITTabs(aWindow.document.getElementById('content').contentDocument.defaultView);
	}, 'navigator:view-source');
};

this.removeTabItem = function(item) {
	if(!item) { return; }
	
	if(item.linkedHits) {
		FIThits.removeChild(item.linkedHits);
	}
	FITtabsList.removeChild(item);
};

this.createTabItem = function(aWindow) {
	var newItem = document.createElement('richlistitem');
	newItem.setAttribute('align', 'center');
	newItem.linkedDocument = aWindow.document;
	newItem.linkedPanel = getPanelForContent(aWindow.document);
	
	var itemFavicon = document.createElement('image');
	var itemCount = document.createElement('label');
	itemCount.hits = 0;
	
	var itemLabel = document.createElement('label');
	itemLabel.setAttribute('flex', '1');
	itemLabel.setAttribute('crop', 'end');
	
	itemFavicon = newItem.appendChild(itemFavicon);
	itemLabel = newItem.appendChild(itemLabel);
	itemCount = newItem.appendChild(itemCount);
	
	newItem.linkedFavicon = itemFavicon;
	newItem.linkedTitle = itemLabel;
	newItem.linkedCount = itemCount;
	
	resetTabHits(newItem);
	
	return FITtabsList.appendChild(newItem);
};

this.resetTabHits = function(item) {
	if(item.linkedHits) {
		try { FIThits.removeChild(item.linkedHits); } catch(ex) { return; } // error means it's a mix up between aSync's
	}
	
	var newHits = document.createElement('richlistbox');
	newHits.setAttribute('flex', '1');
	newHits.onselect = selectFIThit;
	newHits.hidden = (item != FITtabsList.currentItem); // Keep the hits list visible
	newHits._currentLabel = null;
	item.linkedHits = FIThits.appendChild(newHits);
};

this.updateTabItem = function(item) {
	// Prevent showing the url before it has loaded (and consequently before having a title)
	// This method will be called again when the document has been fully loaded
	if(item.linkedDocument.readyState == 'loading') { return; }
	
	var newTitle = item.linkedDocument.title || item.linkedDocument.baseURI;
	// I want the value on the title of the window, not just the URI of where the view source is pointing at
	if(item.linkedPanel == 'viewSource') {
		var sourceWindow = getWindowForContent(item.linkedDocument);
		newTitle = sourceWindow.document.documentElement.getAttribute('titlepreface') +newTitle;
	}
	// In case of unloaded tabs, the title value hasn't been filled in yet, so we grab from the session value
	// viewSource docs should never make it in this loop
	if(docUnloaded(item.linkedDocument)) {
		var inTab = getTabForContent(item.linkedDocument);
		if(inTab && inTab.getAttribute('label')) {
			newTitle = inTab.getAttribute('label');
		}
	}
	
	item.linkedTitle.setAttribute('value', newTitle);
	
	// Let's make it pretty with the favicons
	var newURI = Services.io.newURI(item.linkedDocument.baseURI, item.linkedDocument.characterSet, null);
	PlacesUtils.favicons.getFaviconDataForPage(newURI, function(aURI) {
		if(aURI) { item.linkedFavicon.setAttribute('src', aURI.spec); }
		
		// Since the API didn't return an URI, lets try to use the favicon image displayed in the tabs
		else if(item.linkedPanel) {
			if(item.linkedPanel == 'viewSource') {
				// I'm actually not adding a favicon if it's the view source window, I don't think it makes much sense to do it,
				// and it's easier to distinguish these windows in the list this way.
				//item.linkedFavicon.setAttribute('src', 'chrome://branding/content/icon16.png');
			} else {
				var inWindow = getWindowForContent(item.linkedDocument);
				if(!inWindow) { return; }
				
				var inTab = inWindow.gBrowser._getTabForContentWindow(item.linkedDocument.defaultView);
				if(!inTab) { return; }
				
				var inBox = inTab.boxObject.firstChild;
				while(inBox.className.indexOf('tab-stack') < 0) {
					inBox = inBox.nextSibling;
					if(!inBox) { return; }
				}
				
				var icon = inBox.getElementsByClassName('tab-icon-image');
				if(icon.length < 1) { return; }
				
				item.linkedFavicon.setAttribute('src', icon[0].getAttribute('src'));
			}
		}
	});
};

// This returns the list of tabs in this window along with their data
this.getFITTabs = function(aWindow) {
	if(!(aWindow.document instanceof window.HTMLDocument)) { return; }
	
	// about:blank tabs don't need to be listed, they're, by definition, blank
	if(aWindow.document.baseURI == 'about:blank' && aWindow.document.readyState != "uninitialized") { return; }
	
	var newItem = createTabItem(aWindow);
	
	aSyncSetTab(aWindow, newItem, gFindBar._findField.value);
};

this.aSyncSetTab = function(aWindow, item, word) {
	aSync(function() { updateTabItem(item); });
	aSync(function() { processFITTab(aWindow, item, word); });
};

this.processFITTab = function(aWindow, item, word) {
	// Let's not process the same item multiple times
	if(item.reScheduled) {
		item.reScheduled.cancel();
		delete item.reScheduled;
	}
	
	// Because this method can be called with a delay, we should make sure the findword still exists
	if(!gFindBar._findField.value || gFindBar._findField.value != word) { return; }
	
	// We try to process one tab at a time, to boost performance when searching with multiple tabs open
	if(processingFITTab) {
		aSync(function() { processFITTab(aWindow, item, word); }, 10);
		return;
	}
	
	processingFITTab = true;
	try { countFITinTab(aWindow, item, word); }
	catch(ex) {
		Cu.reportError(ex);
		processingFITTab = false;
	}
	processingFITTab = false;
};
	
this.countFITinTab = function(aWindow, item, word) {
	if(inPDFJS(aWindow.document)) {
		// We need this to access protected properties, hidden from privileged code
		if(!aWindow.PDFFindController) { aWindow = XPCNativeWrapper.unwrap(aWindow); }
		
		// If the document has just loaded, this might take a while to populate, it would throw an error and stop working altogether
		if(!aWindow.PDFView || !aWindow.PDFView.pdfDocument) {
			item.reScheduled = timerAid.create(function() { processFITTab(aWindow, item, word); }, 250);
			return;
		}
		
		aWindow.PDFFindController.extractText();
		// This takes time to build apparently
		if(aWindow.PDFFindController.pageContents.length != aWindow.PDFView.pages.length) {
			item.reScheduled = timerAid.create(function() { processFITTab(aWindow, item, word); }, 100);
			return;
		}
	}
	
	// If it's not completely loaded yet, don't search it, the other handlers should call it when it finishes loading
	if(aWindow.document.readyState != 'complete' && !docUnloaded(aWindow.document)) { return; }
	
	// If the new content isn't possible to be searched through, remove this entry from the lists
	if(!inPDFJS(aWindow.document)
	&& (!aWindow.document || !(aWindow.document instanceof window.HTMLDocument) || !aWindow.document.body)) {
		removeTabItem(item);
		return;
	}
	
	// If the tab has already been reloaded through our item, don't reset the entry again (it sends a load or location change event that would trigger a new "unloaded" state,
	// and we want to keep the "loading" state.
	var loadingTab = (item.linkedHits && item.linkedHits.childNodes.length > 0 && item.linkedHits.childNodes[0].loadingTab);
	
	resetTabHits(item);
	
	// If tab is not loaded, add an item telling that to user with the choice to load it
	if(docUnloaded(aWindow.document)) {
		if(!loadingTab) {
			setAttribute(item.linkedTitle, 'unloaded', 'true');
			setAttribute(item.linkedCount, 'value', '');
			item.linkedCount.hits = -1;
		}
		
		var hit = document.createElement('richlistitem');
		hit.isUnloadedTab = true;
		
		var hitLabel = document.createElement('label');
		hitLabel.setAttribute('flex', '1');
		hitLabel.setAttribute('unloaded', 'true');
		hitLabel.setAttribute('value', stringsAid.get('findInTabs', (!loadingTab) ? 'unloadedTab' : 'loadingTab'));
		hit.appendChild(hitLabel);
		
		item.linkedHits.appendChild(hit);
		orderByHits(item);
		return;
	}
	
	removeAttribute(item.linkedTitle, 'unloaded');
		
	var levels = countFITinDoc(gFindBar._findField.value, aWindow);
	
	// This means there are too many results, which could slow down the browser
	if(levels === null) {
		setAttribute(item.linkedCount, 'value', prefAid.maxFIT+'+');
		item.linkedCount.hits = prefAid.maxFIT +1;
	} else {
		var list = [];
		orderHits(levels, list);
		// The browser gets useless past a point
		if(list.length > prefAid.maxFIT) {
			setAttribute(item.linkedCount, 'value', prefAid.maxFIT+'+');
			item.linkedCount.hits = prefAid.maxFIT +1;
			levels = null;
		} else {
			var hits = countFITinLevels(list, item.linkedHits, aWindow);
			setAttribute(item.linkedCount, 'value', hits);
			item.linkedCount.hits = hits;
		}
	}
	
	item = orderByHits(item);
	
	// Resize the header so it fits nicely into the results
	// +8 comes from padding
	if(item.linkedCount.clientWidth +8 > FITtabsHeader.childNodes[1].clientWidth) {
		FITtabsHeader.childNodes[1].minWidth = (item.linkedCount.clientWidth +8)+'px';
	}
	
	if(!contentWindow || levels === null) { return; } // Usually triggered when a selection is on a frame and the frame closes
	
	if(contentWindow.document == item.linkedDocument) {
		FITtabsList.selectItem(item);
		FITtabsList.ensureSelectedElementIsVisible();
		
		autoSelectFIThit(item.linkedHits);
	}
};

// Re-arrange the items by amount of hits, with the tabs with most hits on top
this.orderByHits = function(item) {
	while(item.previousSibling && item.previousSibling.linkedCount && item.linkedCount.hits > item.previousSibling.linkedCount.hits) {
		item = item.parentNode.insertBefore(item, item.previousSibling);
	}
	while(item.nextSibling && item.nextSibling.linkedCount && item.linkedCount.hits < item.nextSibling.linkedCount.hits) {
		item = item.parentNode.insertBefore(item, item.nextSibling.nextSibling);
	}
	
	return item;
};

// When the user selects a tab in the browser, select the corresponding item in the tabs list if it exists
this.autoSelectFITtab = function() {
	if(perTabFB && !gFindBarInitialized) { return; } // On TabSelect
	if(!contentWindow || !FITtabsList) { return; } // Usually triggered when a selection is on a frame and the frame closes
	
	for(var i=1; i<FITtabsList.childNodes.length; i++) {
		if(contentDocument == FITtabsList.childNodes[i].linkedDocument) {
			FITtabsList.selectItem(FITtabsList.childNodes[i]);
			FITtabsList.ensureSelectedElementIsVisible();
			
			autoSelectFIThit(FITtabsList.childNodes[i].linkedHits);
			return;
		}
	}
};

// When the user finds for text or uses the find again button, select the corresponding item in the hits list
this.autoSelectFIThit = function(aList) {
	removeAttribute(aList._currentLabel, 'current');
	aList._currentLabel = null;
	
	if(isPDFJS) {
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(contentWindow);
		if(!unWrap.PDFFindController || unWrap.PDFFindController.selected.matchIdx == -1 || unWrap.PDFFindController.selected.pageIdx == -1) { return; }
		
		for(var i=0; i<aList.childNodes.length; i++) {
			for(var r=0; r<aList.childNodes[i].linkedRanges.length; r++) {
				if(aList.childNodes[i].linkedRanges[r].range.p == unWrap.PDFFindController.selected.pageIdx
				&& aList.childNodes[i].linkedRanges[r].range.m == unWrap.PDFFindController.selected.matchIdx) {
					aList.selectItem(aList.childNodes[i]);
					aList.ensureSelectedElementIsVisible();
					
					aList._currentLabel = aList.childNodes[i].linkedRanges[r].label;
					setAttribute(aList._currentLabel, 'current', 'true');
					return;
				}
			}
		}
	} else {
		var editableNode = gFindBar.browser._fastFind.foundEditable;
		var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
		if(controller) {
			var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
		} else {
			var sel = gFindBar._getSelectionController(contentWindow).getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
		}
		if(sel.rangeCount != 1) { return; }
		var selRange = sel.getRangeAt(0);
		
		for(var i=0; i<aList.childNodes.length; i++) {
			for(var r=0; r<aList.childNodes[i].linkedRanges.length; r++) {
				if(compareRanges(selRange, aList.childNodes[i].linkedRanges[r].range)) {
					aList.selectItem(aList.childNodes[i]);
					aList.ensureSelectedElementIsVisible();
					
					aList._currentLabel = aList.childNodes[i].linkedRanges[r].label;
					setAttribute(aList._currentLabel, 'current', 'true');
					return;
				}
			}
		}
	}
};
	
this.countFITinDoc = function(aWord, aWindow) {
	var aLevel = { hits: [], levels: [] };
	
	// For pdfs
	if(inPDFJS(aWindow.document)) {
		var pages = aWindow.PDFFindController.pageContents;
		var caseSensitive = gFindBar._shouldBeCaseSensitive(aWord);
		var query = (!caseSensitive) ? aWord.toLowerCase() : aWord;
		
		for(var p=0; p<pages.length; p++) {
			var m = 0;
			var o = -query.length;
			var textContent = (!caseSensitive) ? pages[p].toLowerCase() : pages[p];
			while(true) {
				o = textContent.indexOf(query, o +query.length);
				if(o === -1) {
					break;
				}
				aLevel.hits.push({ p: p, m: m, o: o });
				m++;
				if(aLevel.hits.length > prefAid.maxFIT) { return null; } // The browser gets useless past a point
			}
		}
		
		return aLevel;
	};
	
	// Normal HTML files
	var win = aWindow;
	for(var i = 0; win.frames && i < win.frames.length; i++) {
		aLevel.levels.push(countFITinDoc(aWord, win.frames[i]));
	}
	
	var doc = win.document;
	if(!doc || !(doc instanceof window.HTMLDocument) || !doc.body) {
		return aLevel;
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
		startPt = retRange.cloneRange();
		startPt.collapse(false);
		
		var newLen = aLevel.hits.push(retRange);
		if(newLen > prefAid.maxFIT) { return null; }
	}
	
	return aLevel;
};

// Frames last to coincide with the counter
this.orderHits = function(level, ordered) {
	if(typeof(level.hits) != 'undefined') {
		for(var h=0; h<level.hits.length; h++) {
			ordered.push(level.hits[h]);
		}
	}
	
	if(typeof(level.levels) != 'undefined') {
		for(var l=0; l<level.levels.length; l++) {
			orderHits(level.levels[l], ordered);
		}
	}
};

// This constructs the richlistitems for the hits list
this.countFITinLevels = function(list, hitsList, aWindow) {
	var isPDF = (inPDFJS(aWindow.document));
	var aWord = gFindBar._findField.value;
	
	var lastEndContainer = null;
	var lastEndOffset = null;
	
	for(var h=0; h<list.length; h++) {
		var range = list[h];
		var ranges = [];
		ranges.push(range);
		
		var initNumber = h +1;
		var endNumber = h +1;
		
		var itemStrings = new Array();
		
		if(isPDF) {
			var partialString = replaceLineBreaks(aWindow.PDFFindController.pageContents[range.p].substr(range.o, aWord.length));
			
			var doLastStart = range.o +aWord.length;
			var doFirstLength = range.o;
			
			var startContainer = range.p;
			var startContainerText = aWindow.PDFFindController.pageContents[range.p];
			var endContainer = range.p;
			var endContainerText = aWindow.PDFFindController.pageContents[range.p];
			
			var directionRTL = (aWindow.document.documentElement.dir == 'rtl');
		} else {
			var partialString = replaceLineBreaks(range.toString());
			
			var doLastStart = range.endOffset;
			var doFirstLength = range.startOffset;
			
			var startContainer = range.startContainer;
			var startContainerText = startContainer.textContent;
			var endContainer = range.endContainer;
			var endContainerText = endContainer.textContent;
			
			var styleElement = range.startContainer;
			while(!styleElement.style && styleElement.parentNode) { styleElement = styleElement.parentNode; }
			var directionRTL = (getComputedStyle(styleElement).getPropertyValue('direction') == 'rtl');
		}
		
		var completeString = appendStringToList(
			itemStrings,
			partialString,
			range,
			'',
			false,
			startContainerText.substr(0, doFirstLength),
			endContainerText.substr(doLastStart),
			directionRTL
		);
		
		var initialPoints = (doFirstLength != 0);
		var finalPoints = (doLastStart != endContainer.length);
		
		// Let's try to add whole words whenever possible
		if(doFirstLength > 0 && startContainerText[doFirstLength -1] != ' ') {
			var doFirstStart = startContainerText.lastIndexOf(' ', doFirstLength) +1;
			
			var fillString = replaceLineBreaks(startContainerText.substr(doFirstStart, doFirstLength -doFirstStart));
			
			doFirstLength = doFirstStart;
			if(doFirstStart == 0) {
				initialPoints = false;
			}
			
			completeString = appendStringToList(
				itemStrings,
				fillString,
				false,
				completeString,
				true,
				startContainerText.substr(0, doFirstLength),
				endContainerText.substr(doLastStart),
				directionRTL
			);
		}
		if(doLastStart +1 < endContainerText.length && endContainerText[doLastStart] != ' ') {
			if(h +1 == list.length
			|| ((!isPDF) ? list[h +1].startContainer != endContainer : list[h +1].p != list[h].p)
			|| 	(endContainerText.indexOf(' ', doLastStart) > -1
				&& ((!isPDF) ? list[h +1].startOffset : list[h +1].o) > endContainerText.indexOf(' ', doLastStart))) {
					var doLastLength = endContainerText.indexOf(' ', doLastStart);
					if(doLastLength == -1) { doLastLength = endContainerText.length; }
					doLastLength -= doLastStart;
					
					var fillString = replaceLineBreaks(endContainerText.substr(doLastStart, doLastLength));
					
					doLastStart += doLastLength;
					if(doLastStart == endContainerText.length) {
						finalPoints = false;
					}
					
					completeString = appendStringToList(
						itemStrings,
						fillString,
						false,
						completeString,
						false,
						startContainerText.substr(0, doFirstLength),
						endContainerText.substr(doLastStart),
						directionRTL
					);
			}
		}
		
		// We attempt to merge very close occurences into the same item whenever possible
		var lastRange = range;
		var hh = h+1;
		if(completeString.length < HITS_LENGTH) {
			while(hh < list.length && ((isPDF) ? list[hh].p : list[hh].startContainer) == endContainer) {
				if(isPDF) {
					var nextString = replaceLineBreaks(aWindow.PDFFindController.pageContents[list[hh].p].substr(list[hh].o, aWord.length));
					var nextLastStart = list[hh].o +aWord.length;
					var nextFirstLength = list[hh].o;
					var nextStartContainer = list[hh].p;
					var nextStartContainerText = aWindow.PDFFindController.pageContents[list[hh].p];
					var nextEndContainer = list[hh].p;
					var nextEndContainerText = aWindow.PDFFindController.pageContents[list[hh].p];
				} else {
					var nextString = replaceLineBreaks(list[hh].toString());
					var nextLastStart = list[hh].endOffset;
					var nextFirstLength = list[hh].startOffset;
					var nextStartContainer = list[hh].startContainer;
					var nextStartContainerText = nextStartContainer.textContent;
					var nextEndContainer = list[hh].endContainer;
					var nextEndContainerText = nextEndContainer.textContent;
				}
				
				var fillNext = '';
				if(nextLastStart < nextEndContainerText.length
				&& nextEndContainerText[nextLastStart] != ' ') {
					if(hh +1 == list.length
					|| ((!isPDF) ? list[hh +1].startContainer != list[hh].endContainer : list[hh +1].p != list[hh].p)
					|| 	(nextEndContainerText.indexOf(' ', nextLastStart) > -1
						&& ((!isPDF) ? list[hh +1].startOffset : list[hh +1].o) > nextEndContainerText.indexOf(' ', nextLastStart))) {
							var fillNextLength = nextEndContainerText.indexOf(' ', nextLastStart);
							if(fillNextLength == -1) { fillNextLength = nextEndContainerText.length; }
							fillNextLength -= nextLastStart;
							
							fillNext = replaceLineBreaks(nextEndContainerText.substr(nextLastStart, fillNextLength));
					}
				}
				
				var inBetweenStart = doLastStart;
				var inBetweenLength = nextFirstLength -inBetweenStart;
				var inBetween = replaceLineBreaks(nextStartContainerText.substr(inBetweenStart, inBetweenLength));
				if(completeString.length +nextString.length +fillNext.length +inBetween.length <= HITS_LENGTH) {
					lastRange = list[hh];
					doLastStart = nextLastStart +fillNext.length;
					if(doLastStart == nextEndContainerText.length) {
						finalPoints = false;
					}
					
					var lastEndContainerText = (isPDF) ? aWindow.PDFFindController.pageContents[lastRange.p] : lastRange.endContainer.textContent;
					
					completeString = appendStringToList(
						itemStrings,
						inBetween,
						null,
						completeString,
						false,
						startContainerText.substr(0, doFirstLength),
						nextString +fillNext +lastEndContainerText.substr(doLastStart),
						directionRTL
					);
					completeString = appendStringToList(
						itemStrings,
						nextString,
						lastRange,
						completeString,
						false,
						startContainerText.substr(0, doFirstLength),
						fillNext +lastEndContainerText.substr(doLastStart),
						directionRTL
					);
					completeString = appendStringToList(
						itemStrings,
						fillNext,
						null,
						completeString,
						false,
						startContainerText.substr(0, doFirstLength),
						lastEndContainerText.substr(doLastStart),
						directionRTL
					);
					
					ranges.push(lastRange);
					endNumber = hh +1;
					h = hh;
					hh++;
					continue;
				}
				break;
			}
		}
		
		var doLast = false;
		var didOne = true;
		
		var lastEndContainerText = (isPDF) ? aWindow.PDFFindController.pageContents[lastRange.p] : lastRange.endContainer.textContent;
		
		// Now we complete with some before and after text strings
		while(completeString.length < HITS_LENGTH) {
			doLast = !doLast;
			
			if(doLast) {
				if(!finalPoints) {
					if(!didOne) { break; }
					didOne = false;
					continue;
				}
				
				var doLastLength = lastEndContainerText.indexOf(' ', doLastStart +1);
				if(doLastLength == -1) { doLastLength = lastEndContainerText.length; }
				doLastLength -= doLastStart;
				var fillString = replaceLineBreaks(lastEndContainerText.substr(doLastStart, doLastLength));
			} else {
				if(!initialPoints) {
					if(!didOne) { break; }
					didOne = false;
					continue;
				}
				
				var doFirstStart = (doFirstLength < 2) ? 0 : startContainerText.lastIndexOf(' ', Math.max(doFirstLength -2, 0)) +1;
				doFirstLength -= doFirstStart;
				
				// Don't use text that has been used before
				if(startContainer == lastEndContainer && doFirstStart < lastEndOffset) {
					if(!didOne) { break; }
					didOne = false;
					continue;
				}
				
				var fillString = replaceLineBreaks(startContainerText.substr(doFirstStart, doFirstLength));
			}
			
			if(fillString.length > 0 && completeString.length +fillString.length < HITS_LENGTH) {
				if(doLast) {
					doLastStart += doLastLength;
					if(doLastStart == lastEndContainerText.length) {
						finalPoints = false;
					}
					
					// Trimming those extra white spaces
					if(trim(fillString)) {
						completeString = appendStringToList(
							itemStrings,
							fillString,
							null,
							completeString,
							false,
							startContainerText.substr(0, doFirstLength),
							lastEndContainerText.substr(doLastStart),
							directionRTL
						);
					}
				} else {
					doFirstLength = doFirstStart;
					if(doFirstStart == 0) {
						initialPoints = false;
					}
					
					// Trimming those extra white spaces
					if(trim(fillString)) {
						completeString = appendStringToList(
							itemStrings,
							fillString,
							null,
							completeString,
							true,
							startContainerText.substr(0, doFirstLength),
							lastEndContainerText.substr(doLastStart),
							directionRTL
						);
					}
				}
				
				didOne = true;
			}
			else {
				if(!didOne) { break; }
				didOne = false;
			}
		}
		
		lastEndContainer = (isPDF) ? lastRange.p : lastRange.endContainer;
		lastEndOffset = doLastStart;
		
		if(initialPoints) {
			appendStringToList(
				itemStrings,
				'... ',
				null,
				completeString,
				true,
				startContainerText.substr(0, doFirstLength),
				lastEndContainerText.substr(doLastStart),
				directionRTL
			);
		}
		if(finalPoints) {
			appendStringToList(
				itemStrings,
				' ...',
				null,
				completeString,
				false,
				startContainerText.substr(0, doFirstLength),
				lastEndContainerText.substr(doLastStart),
				directionRTL
			);
		}
		
		var hit = document.createElement('richlistitem');
		hit.linkedRanges = [];
		hit.rangeIdx = -1;
		
		// Show the position of this seach hit in the grid
		setAttribute(hit, 'onmouseover', objName+'.delayHighlightFITinGrid(this);');
		setAttribute(hit, 'onmouseout', objName+'.removeFITHighlightFromGrid();');
		
		// Place the text inside a hbox so we can change it's direction without affecting the rest of the layout
		var labelBox = document.createElement('hbox');
		labelBox.style.direction = (directionRTL) ? 'rtl' : 'ltr';
		for(var s=0; s<itemStrings.length; s++) {
			var label = document.createElement('label');
			if(itemStrings[s].opposite) {
				label.style.direction = (directionRTL) ? 'ltr' : 'rtl';
			}
			setAttribute(label, 'value', itemStrings[s].text);
			label = labelBox.appendChild(label);
			
			if(itemStrings[s].highlight) {
				setAttribute(label, 'highlight', 'true');
				setAttribute(label, 'onmouseover', objName+'.selectHighlightInItem(this);');
				setAttribute(label, 'onclick', objName+'.selectFIThit();');
				label.rangeIdx = hit.linkedRanges.length;
				hit.linkedRanges.push({ range: itemStrings[s].highlight, label: label });
			}
		}
		hit.appendChild(labelBox);
		
		var spacer = document.createElement('label');
		spacer.setAttribute('flex', '1');
		spacer.setAttribute('value', ' ');
		hit.appendChild(spacer);
		
		var hitNumber = document.createElement('label');
		var hitNumberValue = initNumber;
		if(initNumber != endNumber) {
			hitNumberValue += '-'+endNumber;
		}
		hitNumber.setAttribute('value', hitNumberValue);
		hit.appendChild(hitNumber);
		
		hitsList.appendChild(hit);
	}
		
	return list.length;
};

// Use this method to append to the beginning or the end of the item, taking into consideration ltr and rtl directions.
// If the directionality of the last character in the string that leads into the next is not the same as the overall directionality of the document,
// append the string to the opposite end of the list (if it should come first, place it last).
// In this case, switch whiteplaces if it has any.
this.appendStringToList = function(list, text, highlight, original, preceed, predecessor, followup, directionRTL) {
	var stringWeak = testDirection.isWeak(text);
	var originalWeak = testDirection.isWeak(original);
	
	var toAdd = {
		text: text,
		highlight: highlight,
		opposite: false
	};
	
	//var log = 't: "'+text+'" o: "'+original+'" d: '+directionRTL;
	if(preceed) { //log += ' preceed';
		// Full string text is easy to form
		var modified = text +original;
		
		// Get edge directionality of text, these will be the guides to how they will be added to the list
		if(!stringWeak) { // own string direction
			var lastStringRTL = testDirection.isLastRTL(text);
			var firstStringRTL = testDirection.isFirstRTL(text);
		} else {
			if(!testDirection.isWeak(predecessor)) { var lastStringRTL = testDirection.isLastRTL(predecessor); } // previous string direction
			else if(!testDirection.isWeak(original)) { var lastStringRTL = testDirection.isFirstRTL(original); } // next string direction
			else if(!testDirection.isWeak(followup)) { var lastStringRTL = testDirection.isFirstRTL(followup); } // end of string direction
			else { var lastStringRTL = directionRTL; } // default to document direction
			var firstStringRTL = lastStringRTL;
		}
		
		if(!originalWeak) {
			var firstOriginalRTL = testDirection.isFirstRTL(original);
			var lastOriginalRTL = testDirection.isLastRTL(original);
		} else {
			var firstOriginalRTL = lastStringRTL;
			var lastOriginalRTL = firstOriginalRTL;
		}
		
		//log += ' sF: '+firstStringRTL+' sL: '+lastStringRTL+' oF: '+firstOriginalRTL+' oL: '+lastOriginalRTL;
		// Current start position of the item string in the array list
		var sI = 0;
		for(var i=0; i<list.length; i++ ) {
			if(list[i].sI) { sI = i; list[i].sI = false; break; }
		} //log += ' sI: '+sI;
		
		if(!testDirection.isBiDi(text)) { //log += ' !BiDi';
			toAdd.sI = true;
			if(firstOriginalRTL == lastStringRTL) { //log += ' f==l';
				if(lastStringRTL == directionRTL) { //log += ' l==d';
					list.splice(sI, 0, toAdd);
				}
				else { //log += ' l!=d';
					toAdd.opposite = true;
					list.push(toAdd);
				}
			}
			else { //log += ' f!=l';
				if(lastStringRTL == directionRTL) { //log += ' l==d';
					toAdd.text = testSpaces.moveEdges(toAdd.text, true);
					list.unshift(toAdd);
				}
				else { //log += ' l!=d';
					toAdd.text = testSpaces.moveEdges(toAdd.text, true, true);
					toAdd.opposite = true;
					list.unshift(toAdd);
				}
			}	
		}
		else { //log += ' BiDi';
			var bits = testDirection.breakApart(toAdd.text);
			
			var lastBit = {
				text: bits.pop(),
				highlight: highlight,
				opposite: false
			};
			
			if(firstOriginalRTL == lastStringRTL) { //log += ' f==l';
				if(lastStringRTL == directionRTL) { //log += ' l==d';
					list.splice(sI, 0, lastBit);
				}
				else { //log += ' l!=d';
					lastBit.opposite = true;
					list.push(lastBit);
				}
			}
			else { //log += ' f!=l';
				if(lastStringRTL == directionRTL) { //log += ' l==d';
					list.unshift(lastBit);
				}
				else { //log += ' l!=d';
					lastBit.text = testSpaces.moveEdges(lastBit.text, true, true);
					lastBit.opposite = true;
					list.unshift(lastBit);
				}
			}
			
			var firstBit = {
				text: bits.shift(),
				highlight: highlight,
				opposite: false
			};
			
			if(bits.length > 0) { //log += ' m';
				var middleBit = {
					text: bits.join(""),
					highlight: highlight,
					opposite: false
				};
				list.unshift(middleBit);
			}
			
			firstBit.sI = true;
			if(firstStringRTL == directionRTL) { //log += ' f==d';
				list.unshift(firstBit);
			}
			else { //log += ' f!=d';
				firstBit.opposite = true;
				list.unshift(firstBit);
			}
		}
	}
	else { //log += ' succeed';
		// Full string text is easy to form
		var modified = original +text;
		
		// Get edge directionality of text, these will be the guides to how they will be added to the list
		if(!stringWeak) { // own string direction
			var firstStringRTL = testDirection.isFirstRTL(text);
			var lastStringRTL = testDirection.isLastRTL(text);
		} else {
			if(!testDirection.isWeak(original)) { var firstStringRTL = testDirection.isLastRTL(original); } // next string direction
			else if(!testDirection.isWeak(predecessor)) { var firstStringRTL = testDirection.isLastRTL(predecessor); } // previous string direction
			else if(!testDirection.isWeak(followup)) { var firstStringRTL = testDirection.isFirstRTL(followup); } // end of string direction
			else { var firstStringRTL = directionRTL; } // default to document direction
			var lastStringRTL = firstStringRTL;
		}
		
		if(!originalWeak) {
			var firstOriginalRTL = testDirection.isFirstRTL(original);
			var lastOriginalRTL = testDirection.isLastRTL(original);
		} else {
			var lastOriginalRTL = firstStringRTL;
			var firstOriginalRTL = lastOriginalRTL;
		}
		
		//log += ' sF: '+firstStringRTL+' sL: '+lastStringRTL+' oF: '+firstOriginalRTL+' oL: '+lastOriginalRTL;
		// Current end position of the item string in the array list
		var eI = list.length -1;
		for(var i=list.length -1; i>=0; i--) {
			if(list[i].eI) { eI = i; list[i].eI = false; break; }
		} //log += ' eI: '+eI;
		
		if(!testDirection.isBiDi(text)) { //log += ' !BiDi';
			toAdd.eI = true;
			if(firstStringRTL == lastOriginalRTL) { //log += ' f==l';
				if(firstStringRTL == directionRTL) { //log += ' f==d';
					list.push(toAdd);
				}
				else { //log += ' f!=d';
					toAdd.opposite = true;
					list.splice((eI > -1) ? eI : eI +1, 0, toAdd);
				}
			}
			else { //log += ' f!=l';
				if(firstStringRTL == directionRTL) { //log += ' f==d';
					toAdd.text = testSpaces.moveEdges(toAdd.text, false);
					list.push(toAdd);
				}
				else { //log += ' f!=d';
					toAdd.text = testSpaces.moveEdges(toAdd.text, false, true);
					toAdd.opposite = true;
					list.push(toAdd);
				}
			}	
		}
		else { //log += ' BiDi';
			var bits = testDirection.breakApart(toAdd.text);
			
			var firstBit = {
				text: bits.shift(),
				highlight: highlight,
				opposite: false
			};
			
			if(firstStringRTL == lastOriginalRTL) { //log += ' f==l';
				if(firstStringRTL == directionRTL) { //log += ' f==d';
					list.push(firstBit);
				}
				else { //log += ' f!=d';
					firstBit.opposite = true;
					list.splice((eI > -1) ? eI : eI +1, 0, firstBit);
				}
			}
			else { //log += ' f!=l';
				if(firstStringRTL == directionRTL) { //log += ' f==d';
					list.push(firstBit);
				}
				else { //log += ' f!=d';
					firstBit.text = testSpaces.moveEdges(firstBit.text, false, true);
					firstBit.opposite = true;
					list.push(firstBit);
				}
			}
			
			var lastBit = {
				text: bits.pop(),
				highlight: highlight,
				opposite: false
			};
			
			if(bits.length > 0) { //log += ' m';
				var middleBit = {
					text: bits.join(""),
					highlight: highlight,
					opposite: false
				};
				list.push(middleBit);
			}
			
			lastBit.eI = true;
			if(lastStringRTL == directionRTL) { //log += ' l==d';
				list.push(lastBit);
			}
			else { //log += ' l!=d';
				lastBit.opposite = true;
				list.push(lastBit);
			}
		}
	}
	//doLog(log);
	
	// Return the new complete string
	return modified;
};

this.testDirection = {
	// A practical pattern to identify strong LTR characters. This pattern is not theoretically correct according to the Unicode standard.
	// It is simplified for performance and small code size.
	ltrChars: 'A-Za-z0-9_\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u2C00-\uFB1C\uFE00-\uFE6F\uFEFD-\uFFFF',
	
	// A practical pattern to identify strong RTL character. This pattern is not theoretically correct according to the Unicode standard.
	// It is simplified for performance and small code size.
	rtlChars: '\u0591-\u07FF\uFB1D-\uFDFF\uFE70-\uFEFC',
	
	// Checks whether the first strongly-typed character in the string (if any) is of RTL directionality
	isFirstRTL: function(str) {
		var test = new RegExp('^[^' + this.ltrChars + ']*[' + this.rtlChars + ']');
		return test.test(str);
	},
	
	// Checks whether the last strongly-typed character in the string (if any) is of RTL directionality
	isLastRTL: function(str) {
		var test = new RegExp('[' + this.rtlChars + '][^' + this.ltrChars + ']*$');
		return test.test(str);
	},
	
	LTRexp: function() { return new RegExp('[' + this.ltrChars + ']'); },
	RTLexp: function() { return new RegExp('[' + this.rtlChars + ']'); },
	
	// Checks if the string has any LTR chars in it
	hasLTR: function(str) {
		return this.LTRexp().test(str);
	},
	
	// Checks if the string has any RTL chars in it
	hasRTL: function(str) {
		return this.RTLexp().test(str);
	},
	
	// Checks if the string has only weak characters (actually it just checks if it has either LTR or RTL strong chars)
	isWeak: function(str) {
		return (!this.hasLTR(str) && !this.hasRTL(str));
	},
	
	// Checks if the string has both LTR and RTL chars
	isBiDi: function(str) {
		return (this.hasLTR(str) && this.hasRTL(str)); 
	},
	
	// Breaks the string into an array of strings of different direction
	breakApart: function(str) {
		if(!this.isBiDi(str)) { return new Array(str); }
		
		var ret = new Array();
		var doRTL = !this.isFirstRTL(str);
		while(this.isBiDi(str)) {
			var exp = (doRTL) ? this.RTLexp() : this.LTRexp();
			var i = str.indexOf(exp.exec(str));
			ret.push(str.substr(0, i));
			str = str.substr(i);
			doRTL = !doRTL;
		}
		if(str) { ret.push(str); }
		
		return ret;
	}	
};

// This move all spaces in the beginning of the string to the end when the direction is inverted
this.testSpaces = {
	findFirst: function(str) { return str.search(/\s/); },
	findLast: function(str) { return str.search(/\s\S*$/); },
	
	moveEdges: function(str, moveFromEnd, force) {
		if(trim(str) && force || testDirection.isWeak(str)) {
			if(moveFromEnd) {
				var i = this.findLast(str);
				while(i == str.length -1) {
					str = ' '+str.substr(0, str.length -1);
					i = this.findLast(str);
				}
			} else {
				var i = this.findFirst(str);
				while(i == 0) {
					str = str.substr(1)+' ';
					i = this.findFirst(str);
				}
			}
		}
		return str;
	}
};

// Replace all linebreaks with white spaces
this.replaceLineBreaks = function(str) {
	return str.replace(/(\r\n|\n|\r)/gm, " ");
};

this.alwaysOpenFIT = function() {
	if(prefAid.alwaysOpenFIT && (!perTabFB || gFindBarInitialized) && !gFindBar.hidden && FITbox.hidden) {
		toggleFIT();
	}
};

this.autoSelectOnUpdateStatus = function() {
	// We only need this in pdf documents, the 'FoundAgain' listener will handle the other documents.
	// We do with a delay to allow the page to render the selected element
	if(isPDFJS) { timerAid.init('autoSelectOnUpdateStatus', autoSelectFITtab, 10); }
};

this.FITobserver = function(aSubject, aTopic, aData) {
	// Don't do anything if it's not needed
	if((perTabFB && !gFindBarInitialized) || !gFindBar || !gFindBar._findField.value || FITbox.hidden) { return; }
	
	var doc = null;
	var item = null;
	
	try {
		switch(aData) {
			case 'TabClose':
				for(var i=0; i<FITtabsList.childNodes.length; i++) {
					if(FITtabsList.childNodes[i].linkedPanel == aSubject.linkedPanel) {
						item = FITtabsList.childNodes[i];
						break;
					}
				}
				
				removeTabItem(item);
				return;
			
			case 'domwindowclosed':
				for(var i=0; i<FITtabsList.childNodes.length; i++) {
					if(FITtabsList.childNodes[i].linkedDocument == aSubject) {
						item = FITtabsList.childNodes[i];
						break;
					}
				}
				
				removeTabItem(item);
				return;
							
			case 'load':
			case 'location-change':
				doc = aSubject;
				var panel = getPanelForContent(aSubject);
				for(var i=0; i<FITtabsList.childNodes.length; i++) {
					if(FITtabsList.childNodes[i].linkedPanel == panel) {
						item = FITtabsList.childNodes[i];
						break;
					}
				}
				break;
			
			case 'domwindowopened':
				doc = aSubject;
				for(var i=0; i<FITtabsList.childNodes.length; i++) {
					if(FITtabsList.childNodes[i].linkedDocument == aSubject) {
						item = FITtabsList.childNodes[i];
						break;
					}
				}
				break;
			
			default: return;
		}
		
		if(!item) {
			item = createTabItem(doc.defaultView);
		} else {
			item.linkedDocument = doc;
		}
		
		aSyncSetTab(doc.defaultView, item, gFindBar._findField.value);
	}
	
	// Something went wrong and it shouldn't
	catch(ex) { Cu.reportError(ex); }
};

this.FITtabLoaded = function(e) {
	// this is the content document of the loaded page.
	var doc = e.originalTarget;
	if(doc instanceof window.HTMLDocument) {
		// is this an inner frame?
		// Find the root document:
		while(doc.defaultView.frameElement) {
			doc = doc.defaultView.frameElement.ownerDocument;
		}
		
		observerAid.notify('FIT-update-doc', doc, e.type);
	}
};

this.FITtabClosed = function(e) {
	observerAid.notify('FIT-update-doc', e.target, e.type);
};

this.FITProgressListener = {
	onLocationChange: function(aBrowser, webProgress, request, location) {
		// Frames don't need to trigger this
		if(webProgress.DOMWindow == aBrowser.contentWindow) {
			observerAid.notify('FIT-update-doc', aBrowser.contentDocument, 'location-change');
		}
	}
};

this.FITViewSourceOpened = function(aWindow) {
	// Wait for the window to load its content before processing it	
	if(aWindow.document.getElementById('content').contentDocument.baseURI.indexOf('view-source:') !== 0
	|| aWindow.document.getElementById('content').contentDocument.readyState != 'complete') {
		aSync(function() { FITViewSourceOpened(aWindow); }, 250);
		return;
	}
	
	// We call the observer directly, no need to pile on notifications from multiple windows
	FITobserver(aWindow.document.getElementById('content').contentDocument, 'FIT-update-doc', 'domwindowopened');
};

this.FITViewSourceClosed = function(aWindow) {
	FITobserver(aWindow.document.getElementById('content').contentDocument, 'FIT-update-doc', 'domwindowclosed');
};

this.FITTabSelect = function() {
	if(perTabFB) {
		updateFITElements();
	}
	
	autoSelectFITtab();
};

this.loadFindInTabs = function() {
	initFindBar('findInTabs', addFITElements, removeFITElements);
	
	listenerAid.add(window, 'OpenedFindBar', alwaysOpenFIT);
	listenerAid.add(window, 'ClosedFindBar', closeFITWithFindBar);
	listenerAid.add(window, 'FoundFindBar', shouldFindAll);
	listenerAid.add(window, 'UpdatedUIFindBar', updateFITElements, false);
	listenerAid.add(window, 'FoundAgain', autoSelectFITtab);
	listenerAid.add(window, 'SelectedFIThit', autoSelectFITtab);
	listenerAid.add(window, 'UpdatedStatusFindBar', autoSelectOnUpdateStatus);
	listenerAid.add(gBrowser.tabContainer, 'TabSelect', FITTabSelect);
	
	// Update FIT lists as needed
	observerAid.add(FITobserver, 'FIT-update-doc');
	listenerAid.add(gBrowser, 'load', FITtabLoaded, true);
	listenerAid.add(gBrowser.tabContainer, 'TabClose', FITtabClosed, false);
	gBrowser.addTabsProgressListener(FITProgressListener);
	windowMediator.register(FITViewSourceOpened, 'domwindowopened', 'navigator:view-source');
	windowMediator.register(FITViewSourceClosed, 'domwindowclosed', 'navigator:view-source');
	
	// Move the resizer when necessary
	objectWatcher.addAttributeWatcher(FITbox, 'movetotop', updateFITElements);
	
	prefAid.listen('alwaysOpenFIT', alwaysOpenFIT);
	
	alwaysOpenFIT();
};

this.toggleMoveFITtoTop = function() {
	if((perTabFB && !prefAid.movetoBottom) || prefAid.movetoTop) {
		overlayAid.overlayURI('chrome://'+objPathString+'/content/findInTabs.xul', 'movetoTop_FIT');
	} else {
		overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/findInTabs.xul', 'movetoTop_FIT');
	}
};

moduleAid.LOADMODULE = function() {
	prefAid.listen('movetoTop', toggleMoveFITtoTop);
	prefAid.listen('movetoBottom', toggleMoveFITtoTop);
	toggleMoveFITtoTop();
	
	overlayAid.overlayWindow(window, 'findInTabs', null, loadFindInTabs);
};

moduleAid.UNLOADMODULE = function() {
	deinitFindBar('toggleFIT');
	
	objectWatcher.removeAttributeWatcher(FITbox, 'movetotop', updateFITElements);
	
	listenerAid.remove(window, 'OpenedFindBar', alwaysOpenFIT);
	listenerAid.remove(window, 'ClosedFindBar', closeFITWithFindBar);
	listenerAid.remove(window, 'FoundFindBar', shouldFindAll);
	listenerAid.remove(window, 'UpdatedUIFindBar', updateFITElements, false);
	listenerAid.remove(window, 'FoundAgain', autoSelectFITtab);
	listenerAid.remove(window, 'SelectedFIThit', autoSelectFITtab);
	listenerAid.remove(window, 'UpdatedStatusFindBar', autoSelectOnUpdateStatus);
	listenerAid.remove(gBrowser.tabContainer, 'TabSelect', FITTabSelect);
	
	observerAid.remove(FITobserver, 'FIT-update-doc');
	listenerAid.remove(gBrowser, 'load', FITtabLoaded, true);
	listenerAid.remove(gBrowser.tabContainer, 'TabClose', FITtabClosed, false);
	gBrowser.removeTabsProgressListener(FITProgressListener);
	windowMediator.unregister(FITViewSourceOpened, 'domwindowopened', 'navigator:view-source');
	windowMediator.unregister(FITViewSourceClosed, 'domwindowclosed', 'navigator:view-source');
	
	prefAid.unlisten('alwaysOpenFIT', alwaysOpenFIT);
	
	deinitFindBar('findInTabs');
	
	overlayAid.removeOverlayWindow(window, 'findInTabs');
	
	// Ensure we remove tabs of closing windows from lists
	if((window.closed || window.willClose) && !UNLOADED && prefAid.findInTabs) {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			observerAid.notify('FIT-update-doc', gBrowser.mTabs[t], 'TabClose');
		}
	}
	
	prefAid.unlisten('movetoTop', toggleMoveFITtoTop);
	prefAid.unlisten('movetoBottom', toggleMoveFITtoTop);
	if(UNLOADED || !prefAid.findInTabs) {
		overlayAid.removeOverlayURI('chrome://'+objPathString+'/content/findInTabs.xul', 'movetoTop_FIT');
	}
};
