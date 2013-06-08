moduleAid.VERSION = '1.2.2';

this.__defineGetter__('FITresizer', function() { return $(objName+'-findInTabs-resizer'); });
this.__defineGetter__('FITbox', function() { return $(objName+'-findInTabs-box'); });
this.__defineGetter__('FITtabs', function() { return $(objName+'-findInTabs-tabs'); });
this.__defineGetter__('FITtabsList', function() { return FITtabs.firstChild; });
this.__defineGetter__('FITtabsHeader', function() { return FITtabsList.firstChild; });
this.__defineGetter__('FIThits', function() { return $(objName+'-findInTabs-hits'); });
this.__defineGetter__('FITbroadcaster', function() { return $(objName+'-findInTabs-broadcaster'); });
this.__defineGetter__('FITbutton', function() { return gFindBar.getElement(objName+'-find-tabs'); });
this.__defineGetter__('FITupdate', function() { return gFindBar.getElement(objName+'-find-tabs-update'); });

this.HITS_LENGTH = 150; // Length of preview text from preview items in find in tabs box

this.toggleFIT = function() {
	var toggle = FITbox.hidden;
	
	/* Open the findbar if it isn't already when opening FIT */
	if(toggle && gFindBar.hidden) {
		ctrlF();
	}
	
	FITbox.hidden = !toggle;
	FITresizer.hidden = !toggle;
	FITupdate.hidden = !toggle;
	toggleAttribute(FITbroadcaster, 'checked', toggle);
	
	gFindBar._keepCurrentValue = toggle;
	
	shouldFindAll();
};

this.commandUpdateFIT = function() {
	if(FITbox.hidden) {
		toggleFIT();
		return;
	}
	shouldFindAll();
};

// I think it's better to add the button dynamically, since the findbar is a whole bunch of anonymous elements
this.addFITButton = function() {
	if(!FITbutton) {
		var button = document.createElement('toolbarbutton');
		button.setAttribute('anonid', objName+'-find-tabs');
		button.setAttribute('class', 'findbar-highlight findbar-tabs tabbable findbar-no-find-fast');
		button.setAttribute('observes', objName+'-findInTabs-broadcaster');
		gFindBar.getElement("findbar-container").insertBefore(button, gFindBar.getElement('highlight'));
	}
	
	if(!FITupdate) {
		var button = document.createElement('toolbarbutton');
		button.setAttribute('anonid', objName+'-find-tabs-update');
		button.setAttribute('class', 'findbar-tabs-update findbar-no-find-fast findbar-no-auto-show tabbable');
		button.setAttribute('label', stringsAid.get('findInTabs', 'updateButtonLabel'));
		button.setAttribute('tooltiptext', stringsAid.get('findInTabs', 'updateButtonTooltip'+(Services.appinfo.OS == 'Darwin' ? 'Mac' : 'Win')));
		button.hidden = true;
		gFindBar.getElement("findbar-container").insertBefore(button, gFindBar.getElement('find-label'));
		
		listenerAid.add(FITupdate, 'command', shouldFindAll);
	}
};

this.updateButtonKeepHidden = function() {
	FITupdate.hidden = FITbox.hidden;
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
	
	var inFindBar = inWindow.document.getElementById('FindToolbar');
	var ranges = FITtabsList.currentItem.linkedHits.currentItem.linkedRanges;
	
	if(inPDFJS(FITtabsList.currentItem.linkedDocument)) {
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(FITtabsList.currentItem.linkedDocument.defaultView);
		if(!unWrap.PDFFindController) { return; } // Don't know if this is possible but I need this so better make sure
		
		for(var r=0; r<ranges.length; r++) {
			// Don't do anything when the current selection is contained within the ranges of this item.
			// We don't want to keep re-selecting it.
			if(unWrap.PDFFindController.selected.pageIdx == ranges[r].p
			&& unWrap.PDFFindController.selected.matchIdx == ranges[r].m) {
				return;
			}
		}
		
		inWindow.focus();
		inWindow.gBrowser.selectedTab = inWindow.gBrowser._getTabForContentWindow(FITtabsList.currentItem.linkedDocument.defaultView);
		
		// Make sure we trigger a find event, so the pdf document renders our matches
		if(!unWrap.PDFFindController.state
		|| unWrap.PDFFindController.state.query != gFindBar._findField.value
		|| unWrap.PDFFindController.state.caseSensitive != !!gFindBar._typeAheadCaseSensitive) {
			var caseSensitive = !!gFindBar._typeAheadCaseSensitive;
			inWindow.gFindBar._findField.value = gFindBar._findField.value;
			inWindow.gFindBar.getElement('find-case-sensitive').checked = caseSensitive;
			inWindow.gFindBar._setCaseSensitivity(caseSensitive); // This should be enough to trigger the find
			
			aSync(function() {
				// Select the first one when the richlistitem contains more than one
				finishSelectingPDFhit(unWrap, inFindBar, ranges[0]);
			});
		}
		
		// Select the first one when the richlistitem contains more than one
		finishSelectingPDFhit(unWrap, inFindBar, ranges[0]);
		return;
	}
	
	var editableNode = inFindBar.browser._fastFind.foundEditable;
	var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
	if(!controller) {
		controller = inFindBar._getSelectionController(FITtabsList.currentItem.linkedDocument.defaultView);
	}
	var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	
	if(sel.rangeCount == 1) {
		for(var r=0; r<ranges.length; r++) {
			// Don't do anything when the current selection is contained within the ranges of this item.
			// We don't want to keep re-selecting it.
			if(sel.getRangeAt(0).startContainer == ranges[r].startContainer
			&& sel.getRangeAt(0).startOffset == ranges[r].startOffset
			&& sel.getRangeAt(0).endContainer == ranges[r].endContainer
			&& sel.getRangeAt(0).endOffset == ranges[r].endOffset) {
				return;
			}
		}
	}
	
	sel.removeAllRanges();
	sel.addRange(ranges[0]); // Select the first one when the richlistitem contains more than one
	inWindow.focus();
	if(inWindow.gBrowser.selectedTab) { // view-source doesn't have or need this
		inWindow.gBrowser.selectedTab = inWindow.gBrowser._getTabForContentWindow(FITtabsList.currentItem.linkedDocument.defaultView);
	}
	controller.scrollSelectionIntoView(gFindBar.nsISelectionController.SELECTION_NORMAL, gFindBar.nsISelectionController.SELECTION_WHOLE_SELECTION, gFindBar.nsISelectionController.SCROLL_CENTER_VERTICALLY);
	
	dispatch(inFindBar, { type: 'SelectedFIThit', cancelable: false });
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
		FIThits.removeChild(item.linkedHits);
	}
	
	var newHits = document.createElement('richlistbox');
	newHits.setAttribute('flex', '1');
	newHits.onselect = selectFIThit;
	newHits.hidden = (item != FITtabsList.currentItem); // Keep the hits list visible
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
	
	aSyncSetTab(aWindow, newItem);
};

this.aSyncSetTab = function(aWindow, item) {
	aSync(function() { updateTabItem(item); });
	aSync(function() { countFITinTab(aWindow, item); });
};

this.countFITinTab = function(aWindow, item) {
	// Let's not process the same item multiple times
	if(item.reScheduled) {
		item.reScheduled.cancel();
		delete item.reScheduled;
	}
	
	// Because this method can be called with a delay, we should make sure the findword still exists
	if(!gFindBar._findField.value) { return; }
	
	if(inPDFJS(aWindow.document)) {
		// We need this to access protected properties, hidden from privileged code
		if(!aWindow.PDFFindController) { aWindow = XPCNativeWrapper.unwrap(aWindow); }
		
		// If the document has just loaded, this might take a while to populate, it would throw an error and stop working altogether
		if(!aWindow.PDFView || !aWindow.PDFView.pdfDocument) {
			item.reScheduled = timerAid.create(function() { countFITinTab(aWindow, item); }, 250);
			return;
		}
		
		aWindow.PDFFindController.extractText();
		// This takes time to build apparently
		if(aWindow.PDFFindController.pageContents.length != aWindow.PDFView.pages.length) {
			item.reScheduled = timerAid.create(function() { countFITinTab(aWindow, item); }, 100);
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
		}
		
		var hit = document.createElement('richlistitem');
		hit.isUnloadedTab = true;
		
		var hitLabel = document.createElement('label');
		hitLabel.setAttribute('flex', '1');
		hitLabel.setAttribute('unloaded', 'true');
		hitLabel.setAttribute('value', stringsAid.get('findInTabs', (!loadingTab) ? 'unloadedTab' : 'loadingTab'));
		hit.appendChild(hitLabel);
		
		item.linkedHits.appendChild(hit);
		return;
	}
	
	removeAttribute(item.linkedTitle, 'unloaded');
		
	var levels = countFITinDoc(gFindBar._findField.value, aWindow);
	
	// This means there are too many results, which could slow down the browser
	if(levels === null) {
		setAttribute(item.linkedCount, 'value', prefAid.maxFIT+'+');
	} else {
		var hits = countFITinLevels(levels, item.linkedHits, aWindow);
		setAttribute(item.linkedCount, 'value', hits);
	}
	
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

// When the user selects a tab in the browser, select the corresponding item in the tabs list if it exists
this.autoSelectFITtab = function() {
	if(!contentWindow || !FITtabsList) { return; } // Usually triggered when a selection is on a frame and the frame closes
	
	for(var i=1; i<FITtabsList.childNodes.length; i++) {
		if(contentWindow.document == FITtabsList.childNodes[i].linkedDocument) {
			FITtabsList.selectItem(FITtabsList.childNodes[i]);
			FITtabsList.ensureSelectedElementIsVisible();
			
			autoSelectFIThit(FITtabsList.childNodes[i].linkedHits);
			return;
		}
	}
};

// When the user finds for text or uses the find again button, select the corresponding item in the hits list
this.autoSelectFIThit = function(aList) {
	if(isPDFJS) {
		// We need this to access protected properties, hidden from privileged code
		var unWrap = XPCNativeWrapper.unwrap(contentWindow);
		if(!unWrap.PDFFindController || unWrap.PDFFindController.selected.matchIdx == -1 || unWrap.PDFFindController.selected.pageIdx == -1) { return; }
		
		for(var i=0; i<aList.childNodes.length; i++) {
			for(var r=0; r<aList.childNodes[i].linkedRanges.length; r++) {
				if(aList.childNodes[i].linkedRanges[r].p == unWrap.PDFFindController.selected.pageIdx
				&& aList.childNodes[i].linkedRanges[r].m == unWrap.PDFFindController.selected.matchIdx) {
					aList.selectItem(aList.childNodes[i]);
					aList.ensureSelectedElementIsVisible();
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
		
		for(var i=0; i<aList.childNodes.length; i++) {
			for(var r=0; r<aList.childNodes[i].linkedRanges.length; r++) {
				if(sel.getRangeAt(0).startContainer == aList.childNodes[i].linkedRanges[r].startContainer
				&& sel.getRangeAt(0).startOffset == aList.childNodes[i].linkedRanges[r].startOffset
				&& sel.getRangeAt(0).endContainer == aList.childNodes[i].linkedRanges[r].endContainer
				&& sel.getRangeAt(0).endOffset == aList.childNodes[i].linkedRanges[r].endOffset) {
					aList.selectItem(aList.childNodes[i]);
					aList.ensureSelectedElementIsVisible();
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
this.countFITinLevels = function(level, hitsList, aWindow) {
	var isPDF = (inPDFJS(aWindow.document));
	var aWord = gFindBar._findField.value;
	
	var list = [];
	orderHits(level, list);
	
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
			itemStrings.push({ text: aWindow.PDFFindController.pageContents[range.p].substr(range.o, aWord.length), highlight: true });
			
			var doLastStart = range.o +aWord.length;
			var doFirstLength = range.o;
			
			var startContainer = range.p;
			var startContainerText = aWindow.PDFFindController.pageContents[range.p];
			var endContainer = range.p;
			var endContainerText = aWindow.PDFFindController.pageContents[range.p];
		} else {
			itemStrings.push({ text: range.toString(), highlight: true });
			
			var doLastStart = range.endOffset;
			var doFirstLength = range.startOffset;
			
			var startContainer = range.startContainer;
			var startContainerText = startContainer.textContent;
			var endContainer = range.endContainer;
			var endContainerText = endContainer.textContent;
		}
		
		var initialPoints = (doFirstLength != 0);
		var finalPoints = (doLastStart != endContainer.length);
		
		// Let's try to add whole words whenever possible
		if(doFirstLength > 0 && startContainerText[doFirstLength -1] != ' ') {
			var doFirstStart = startContainerText.lastIndexOf(' ', doFirstLength) +1;
			
			var fillString = startContainerText.substr(doFirstStart, doFirstLength -doFirstStart);
			itemStrings.unshift({ text: fillString, highlight: false });
			
			doFirstLength = doFirstStart;
			if(doFirstStart == 0) {
				initialPoints = false;
			}
		}
		if(doLastStart +1 < endContainerText.length && endContainerText[doLastStart] != ' ') {
			if(h +1 == list.length
			|| ((!isPDF) ? list[h +1].startContainer != endContainer : list[h +1].p != list[h].p)
			|| 	(endContainerText.indexOf(' ', doLastStart) > -1
				&& ((!isPDF) ? list[h +1].startOffset : list[h +1].o) > endContainerText.indexOf(' ', doLastStart))) {
					var doLastLength = endContainerText.indexOf(' ', doLastStart);
					if(doLastLength == -1) { doLastLength = endContainerText.length; }
					doLastLength -= doLastStart;
					
					var fillString = endContainerText.substr(doLastStart, doLastLength);
					itemStrings.push({ text: fillString, highlight: false });
					
					doLastStart += doLastLength;
					if(doLastStart == endContainerText.length) {
						finalPoints = false;
					}
			}
		}
		
		var remaining = HITS_LENGTH -allStringsLength(itemStrings);
		
		// We attempt to merge very close occurences into the same item whenever possible
		var lastRange = range;
		var hh = h+1;
		if(remaining > 0) {
			while(hh < list.length && ((isPDF) ? list[hh].p : list[hh].startContainer) == endContainer) {
				if(isPDF) {
					var nextString = aWindow.PDFFindController.pageContents[list[hh].p].substr(list[hh].o, aWord.length);
					var nextLastStart = list[hh].o +aWord.length;
					var nextFirstLength = list[hh].o;
					var nextStartContainer = list[hh].p;
					var nextStartContainerText = aWindow.PDFFindController.pageContents[list[hh].p];
					var nextEndContainer = list[hh].p;
					var nextEndContainerText = aWindow.PDFFindController.pageContents[list[hh].p];
				} else {
					var nextString = list[hh].toString();
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
							
							fillNext = nextEndContainerText.substr(nextLastStart, fillNextLength);
					}
				}
				
				var inBetweenStart = doLastStart;
				var inBetweenLength = nextFirstLength -inBetweenStart;
				var inBetween = nextStartContainerText.substr(inBetweenStart, inBetweenLength);
				if(allStringsLength(itemStrings) +nextString.length +fillNext.length +inBetween.length <= HITS_LENGTH) {
					itemStrings.push({ text: inBetween, highlight: false });
					itemStrings.push({ text: nextString, highlight: true });
					itemStrings.push({ text: fillNext, highlight: false });
					
					lastRange = list[hh];
					doLastStart = nextLastStart +fillNext.length;
					if(doLastStart == nextEndContainerText.length) {
						finalPoints = false;
					}
					
					ranges.push(lastRange);
					endNumber = hh +1;
					h = hh;
					hh++;
					continue;
				}
				break;
			}
			
			remaining = HITS_LENGTH -allStringsLength(itemStrings);
		}
		
		var doLast = false;
		var didOne = true;
		
		if(isPDF) {
			var lastEndContainerText = aWindow.PDFFindController.pageContents[lastRange.p];
		} else {
			var lastEndContainerText = lastRange.endContainer.textContent;
		}
		
		// Now we complete with some before and after text strings
		while(remaining > 0) {
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
				var fillString = lastEndContainerText.substr(doLastStart, doLastLength);
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
				
				var fillString = startContainerText.substr(doFirstStart, doFirstLength);
			}
			
			if(fillString.length > 0 && remaining -fillString.length >= 0) {
				if(doLast) {
					// Trimming those extra white spaces
					if(fillString != ' ') {
						itemStrings.push({ text: fillString, highlight: false });
						remaining -= fillString.length;
					}
					
					doLastStart += doLastLength;
					if(doLastStart == lastEndContainerText.length) {
						finalPoints = false;
					}
				} else {
					// Trimming those extra white spaces
					if(fillString != ' ') {
						itemStrings.unshift({ text: fillString, highlight: false });
						remaining -= fillString.length;
					}
					
					doFirstLength = doFirstStart;
					if(doFirstStart == 0) {
						initialPoints = false;
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
		
		if(initialPoints) { itemStrings.unshift({ text: '... ', highlight: false }); }
		if(finalPoints) { itemStrings.push({ text: ' ...', highlight: false }); }
		
		var hit = document.createElement('richlistitem');
		hit.linkedRanges = [];
		// Don't just copy the array, they are live so we'd keep this scope open until the lists were deleted unnecessarily
		for(var r=0; r<ranges.length; r++) {
			hit.linkedRanges.push(ranges[r]);
		}
		
		for(var s=0; s<itemStrings.length; s++) {
			var label = document.createElement('label');
			toggleAttribute(label, 'highlight', itemStrings[s].highlight);
			label.setAttribute('value', itemStrings[s].text);
			hit.appendChild(label);
		}
		
		var hitNumberString = ' '+initNumber;
		if(initNumber != endNumber) { hitNumberString += '-'+endNumber; }
		var hitNumber = document.createElement('label');
		hitNumber.setAttribute('flex', '1');
		hitNumber.setAttribute('class', 'right');
		hitNumber.setAttribute('value', hitNumberString);
		hit.appendChild(hitNumber);
		
		hitsList.appendChild(hit);
	}
		
	return list.length;
};

this.allStringsLength = function(list) {
	var count = 0;
	for(var i=0; i<list.length; i++) {
		count += list[i].text.length;
	}
	return count;
};

this.alwaysOpenFIT = function() {
	if(prefAid.alwaysOpenFIT && !gFindBar.hidden && FITbox.hidden) {
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
	if(!gFindBar._findField.value || FITbox.hidden) { return; }
	
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
		
		aSyncSetTab(doc.defaultView, item);
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
	
	observerAid.notify('FIT-update-doc', aWindow.document.getElementById('content').contentDocument, 'domwindowopened');
};

this.FITViewSourceClosed = function(aWindow) {
	observerAid.notify('FIT-update-doc', aWindow.document.getElementById('content').contentDocument, 'domwindowclosed');
};

this.loadFindInTabs = function() {
	addFITButton();
	
	listenerAid.add(gFindBar, 'OpenedFindBar', alwaysOpenFIT);
	listenerAid.add(gFindBar, 'ClosedFindBar', closeFITWithFindBar);
	listenerAid.add(gFindBar, 'FoundFindBar', shouldFindAll);
	listenerAid.add(gFindBar, 'UpdatedUIFindBar', updateButtonKeepHidden, false);
	listenerAid.add(gFindBar, 'FoundAgain', autoSelectFITtab);
	listenerAid.add(gFindBar, 'UpdatedStatusFindBar', autoSelectOnUpdateStatus);
	listenerAid.add(gBrowser.tabContainer, 'TabSelect', autoSelectFITtab);
	
	// Update FIT lists as needed
	observerAid.add(FITobserver, 'FIT-update-doc');
	listenerAid.add(gBrowser, 'load', FITtabLoaded, true);
	listenerAid.add(gBrowser.tabContainer, 'TabClose', FITtabClosed, false);
	gBrowser.addTabsProgressListener(FITProgressListener);
	windowMediator.register(FITViewSourceOpened, 'domwindowopened', 'navigator:view-source');
	windowMediator.register(FITViewSourceClosed, 'domwindowclosed', 'navigator:view-source');
	
	prefAid.listen('alwaysOpenFIT', alwaysOpenFIT);
	
	alwaysOpenFIT();
};

moduleAid.LOADMODULE = function() {
	overlayAid.overlayWindow(window, 'findInTabs', null, loadFindInTabs);
};

moduleAid.UNLOADMODULE = function() {
	if(FITbutton) {
		gFindBar.getElement("findbar-container").removeChild(FITbutton);
	}
	
	if(FITupdate) {
		listenerAid.remove(FITupdate, 'command', shouldFindAll);
		gFindBar.getElement("findbar-container").removeChild(FITupdate);
	}
	
	delete gFindBar._keepCurrentValue;
	
	listenerAid.remove(gFindBar, 'OpenedFindBar', alwaysOpenFIT);
	listenerAid.remove(gFindBar, 'ClosedFindBar', closeFITWithFindBar);
	listenerAid.remove(gFindBar, 'FoundFindBar', shouldFindAll);
	listenerAid.remove(gFindBar, 'UpdatedUIFindBar', updateButtonKeepHidden, false);
	listenerAid.remove(gFindBar, 'FoundAgain', autoSelectFITtab);
	listenerAid.remove(gFindBar, 'UpdatedStatusFindBar', autoSelectOnUpdateStatus);
	listenerAid.remove(gBrowser.tabContainer, 'TabSelect', autoSelectFITtab);
	
	observerAid.remove(FITobserver, 'FIT-update-doc');
	listenerAid.remove(gBrowser, 'load', FITtabLoaded, true);
	listenerAid.remove(gBrowser.tabContainer, 'TabClose', FITtabClosed, false);
	gBrowser.removeTabsProgressListener(FITProgressListener);
	windowMediator.unregister(FITViewSourceOpened, 'domwindowopened', 'navigator:view-source');
	windowMediator.unregister(FITViewSourceClosed, 'domwindowclosed', 'navigator:view-source');
	
	prefAid.unlisten('alwaysOpenFIT', alwaysOpenFIT);
	
	overlayAid.removeOverlayWindow(window, 'findInTabs');
	
	// Ensure we remove tabs of closing windows from lists
	if((window.closed || window.willClose) && !UNLOADED && prefAid.findInTabs) {
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			observerAid.notify('FIT-update-doc', gBrowser.mTabs[t], 'TabClose');
		}
	}
};
