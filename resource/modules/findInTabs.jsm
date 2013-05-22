moduleAid.VERSION = '1.0.2';

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

this.verifyFITselection = function() {
	// Re-Do the list if something is invalid
	if(!FITtabsList.currentItem) { return null; }
	if(!FITtabsList.currentItem.linkedDocument) {
		shouldFindAll();
		return null;
	}
	
	var exists = null;
	windowMediator.callOnAll(function(aWindow) {
		if(!exists && aWindow.gBrowser.getBrowserForDocument(FITtabsList.currentItem.linkedDocument)) {
			exists = aWindow;
		}
	}, 'navigator:browser');
	
	if(!exists) {
		windowMediator.callOnAll(function(aWindow) {
			if(!exists && aWindow.document.getElementById('content').contentDocument == FITtabsList.currentItem.linkedDocument) {
				exists = aWindow;
			}
		}, 'navigator:view-source');
	}
	
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
	var inWindow = verifyFITselection();
	if(!inWindow || !FITtabsList.currentItem.linkedHits.currentItem) { return; }
	
	var inFindBar = inWindow.document.getElementById('FindToolbar');
	
	var editableNode = inFindBar.browser._fastFind.foundEditable;
	var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
	if(!controller) {
		controller = inFindBar._getSelectionController(FITtabsList.currentItem.linkedDocument.defaultView);
	}
	var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	
	var ranges = FITtabsList.currentItem.linkedHits.currentItem.linkedRanges;
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
	
	browserMediator.callOnAll(getFITTabs);
	windowMediator.callOnAll(function(aWindow) {
		getFITTabs(aWindow.document.getElementById('content').contentDocument.defaultView);
	}, 'navigator:view-source');
};

// This returns the list of tabs in this window along with their data
this.getFITTabs = function(aWindow) {
	if(!aWindow.document.defaultView || !(aWindow.document instanceof aWindow.document.defaultView.HTMLDocument)) { return; }
	
	if(aWindow.document.baseURI != 'about:blank' && aWindow.document.baseURI != 'chrome://browser/content/browser.xul' && aWindow.document.readyState == "complete") {
		var newHits = document.createElement('richlistbox');
		newHits.setAttribute('flex', '1');
		newHits.onselect = selectFIThit;
		newHits.hidden = true;
		newHits = FIThits.appendChild(newHits);
		
		var newItem = document.createElement('richlistitem');
		newItem.linkedHits = newHits;
		newItem.linkedDocument = aWindow.document;
		
		var itemFavicon = document.createElement('image');
		var itemCount = document.createElement('label');
		
		var itemLabel = document.createElement('label');
		itemLabel.setAttribute('flex', '1');
		itemLabel.setAttribute('crop', 'end');
		itemLabel.setAttribute('value', aWindow.document.title || aWindow.document.baseURI);
		
		newItem.appendChild(itemFavicon);
		newItem.appendChild(itemLabel);
		itemCount = newItem.appendChild(itemCount);
		
		newItem = FITtabsList.appendChild(newItem);
		
		aSync(function() {
			countFITinTab(aWindow, itemCount, newHits);
		});
		
		// Let's make it pretty with the favicons
		var newURI = Services.io.newURI(aWindow.document.baseURI, aWindow.document.characterSet, null);
		PlacesUtils.favicons.getFaviconDataForPage(newURI, function(aURI) {
			if(aURI) { newItem.firstChild.setAttribute('src', aURI.spec); }
		});
	}
};

this.countFITinTab = function(aWindow, itemCount, hitsList) {
	var levels = countFITinDoc(gFindBar._findField.value, aWindow);
	var hits = countFITinLevels(levels, hitsList);
	
	setAttribute(itemCount, 'value', hits);
	
	// Resize the header so it fits nicely into the results
	// +8 comes from padding
	if(itemCount.clientWidth +8 > FITtabsHeader.childNodes[1].clientWidth) {
		FITtabsHeader.childNodes[1].minWidth = (itemCount.clientWidth +8)+'px';
	}
	
	if(!contentWindow) { return; } // Usually triggered when a selection is on a frame and the frame closes
	
	if(contentWindow.document == itemCount.parentNode.linkedDocument) {
		FITtabsList.selectItem(itemCount.parentNode);
		FITtabsList.ensureSelectedElementIsVisible();
		
		autoSelectFIThit(hitsList);
	}
};

// When the user selects a tab in the browser, select the corresponding item in the tabs list if it exists
this.autoSelectFITtab = function() {
	if(!contentWindow) { return; } // Usually triggered when a selection is on a frame and the frame closes
	
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
	var editableNode = gFindBar.browser._fastFind.foundEditable;
	var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
	if(controller) {
		var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	} else {
		var sel = gFindBar._getSelectionController(contentWindow).getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
	}
	
	if(sel.rangeCount == 1) {
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
	
	var win = aWindow;
	for(var i = 0; win.frames && i < win.frames.length; i++) {
		aLevel.levels.push(countFITinDoc(aWord, win.frames[i]));
	}
	
	var doc = win.document;
	// should be !(doc instanceof window.HTMLDocument) but this doesn't work in FF23
	// see https://bugzilla.mozilla.org/show_bug.cgi?id=870423
	if(!doc || !doc.defaultView || !(doc instanceof doc.defaultView.HTMLDocument) || !doc.body) {
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
		
		aLevel.hits.push(retRange);
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
this.countFITinLevels = function(level, hitsList) {
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
		itemStrings.push({ text: range.toString(), highlight: true });
		
		var doLastStart = range.endOffset;
		var doFirstLength = range.startOffset;
		
		var initialPoints = (doFirstLength != 0);
		var finalPoints = (range.endOffset != range.endContainer.length);
		
		// Let's try to add whole words whenever possible
		if(doFirstLength > 0 && range.startContainer.textContent[doFirstLength -1] != ' ') {
			var doFirstStart = range.startContainer.textContent.lastIndexOf(' ', doFirstLength) +1;
			
			var fillString = range.startContainer.textContent.substr(doFirstStart, doFirstLength -doFirstStart);
			itemStrings.unshift({ text: fillString, highlight: false });
			
			doFirstLength = doFirstStart;
			if(doFirstStart == 0) {
				initialPoints = false;
			}
		}
		if(doLastStart +1 < range.endContainer.length && range.endContainer.textContent[doLastStart] != ' ') {
			if(h +1 == list.length
			|| list[h +1].startContainer != range.endContainer
			|| 	(range.endContainer.textContent.indexOf(' ', doLastStart) > -1
				&& list[h +1].startOffset > range.endContainer.textContent.indexOf(' ', doLastStart))) {
					var doLastLength = range.endContainer.textContent.indexOf(' ', doLastStart);
					if(doLastLength == -1) { doLastLength = range.endContainer.length; }
					doLastLength -= doLastStart;
					
					var fillString = range.endContainer.textContent.substr(doLastStart, doLastLength);
					itemStrings.push({ text: fillString, highlight: false });
					
					doLastStart += doLastLength;
					if(doLastStart == range.endContainer.length) {
						finalPoints = false;
					}
			}
		}
		
		var remaining = HITS_LENGTH -allStringsLength(itemStrings);
		
		// We attempt to merge very close occurences into the same item whenever possible
		var lastRange = range;
		var hh = h+1;
		if(remaining > 0) {
			while(hh < list.length && list[hh].startContainer == range.endContainer) {
				var nextString = list[hh].toString();
				var fillNext = '';
				if(list[hh].endOffset < list[hh].endContainer.length
				&& list[hh].endContainer.textContent[list[hh].endOffset] != ' ') {
					if(hh +1 == list.length
					|| list[hh +1].startContainer != list[hh].endContainer
					|| 	(list[hh].endContainer.textContent.indexOf(' ', list[hh].endOffset) > -1
						&& list[hh +1].startOffset > list[hh].endContainer.textContent.indexOf(' ', list[hh].endOffset))) {
							var fillNextLength = list[hh].endContainer.textContent.indexOf(' ', list[hh].endOffset);
							if(fillNextLength == -1) { fillNextLength = list[hh].endContainer.length; }
							fillNextLength -= list[hh].endOffset;
							
							fillNext = list[hh].endContainer.textContent.substr(list[hh].endOffset, fillNextLength);
					}
				}
				
				var inBetweenStart = doLastStart;
				var inBetweenLength = list[hh].startOffset -inBetweenStart;
				var inBetween = list[hh].startContainer.textContent.substr(inBetweenStart, inBetweenLength);
				if(allStringsLength(itemStrings) +nextString.length +fillNext.length +inBetween.length <= HITS_LENGTH) {
					itemStrings.push({ text: inBetween, highlight: false });
					itemStrings.push({ text: nextString, highlight: true });
					itemStrings.push({ text: fillNext, highlight: false });
					
					lastRange = list[hh];
					doLastStart = list[hh].endOffset +fillNext.length;
					if(doLastStart == list[hh].endContainer.length) {
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
		
		// Now we complete with some before and after text strings
		while(remaining > 0) {
			doLast = !doLast;
			
			if(doLast) {
				if(!finalPoints) {
					if(!didOne) { break; }
					didOne = false;
					continue;
				}
				
				var doLastLength = lastRange.endContainer.textContent.indexOf(' ', doLastStart +1);
				if(doLastLength == -1) { doLastLength = lastRange.endContainer.length; }
				doLastLength -= doLastStart;
				var fillString = lastRange.endContainer.textContent.substr(doLastStart, doLastLength);
			} else {
				if(!initialPoints) {
					if(!didOne) { break; }
					didOne = false;
					continue;
				}
				
				var doFirstStart = (doFirstLength < 2) ? 0 : range.startContainer.textContent.lastIndexOf(' ', Math.max(doFirstLength -2, 0)) +1;
				doFirstLength -= doFirstStart;
				
				// Don't use text that has been used before
				if(range.startContainer == lastEndContainer && doFirstStart < lastEndOffset) {
					if(!didOne) { break; }
					didOne = false;
					continue;
				}
				
				var fillString = range.startContainer.textContent.substr(doFirstStart, doFirstLength);
			}
			
			if(fillString.length > 0 && remaining -fillString.length >= 0) {
				if(doLast) {
					// Trimming those extra white spaces
					if(fillString != ' ') {
						itemStrings.push({ text: fillString, highlight: false });
						remaining -= fillString.length;
					}
					
					doLastStart += doLastLength;
					if(doLastStart == lastRange.endContainer.length) {
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
		
		lastEndContainer = lastRange.endContainer;
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

this.loadFindInTabs = function() {
	addFITButton();
	
	listenerAid.add(gFindBar, 'OpenedFindBar', alwaysOpenFIT);
	listenerAid.add(gFindBar, 'ClosedFindBar', closeFITWithFindBar);
	listenerAid.add(gFindBar, 'FoundFindBar', shouldFindAll);
	listenerAid.add(gFindBar, 'UpdatedUIFindBar', updateButtonKeepHidden, false);
	listenerAid.add(gFindBar, 'FoundAgain', autoSelectFITtab);
	listenerAid.add(gBrowser.tabContainer, 'TabSelect', autoSelectFITtab);
	
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
	
	listenerAid.remove(gFindBar, 'OpenedFindBar', alwaysOpenFIT);
	listenerAid.remove(gFindBar, 'ClosedFindBar', closeFITWithFindBar);
	listenerAid.remove(gFindBar, 'FoundFindBar', shouldFindAll);
	listenerAid.remove(gFindBar, 'UpdatedUIFindBar', updateButtonKeepHidden, false);
	listenerAid.remove(gFindBar, 'FoundAgain', autoSelectFITtab);
	listenerAid.remove(gBrowser.tabContainer, 'TabSelect', autoSelectFITtab);
	
	prefAid.unlisten('alwaysOpenFIT', alwaysOpenFIT);
	
	overlayAid.removeOverlayWindow(window, 'findInTabs');
};
