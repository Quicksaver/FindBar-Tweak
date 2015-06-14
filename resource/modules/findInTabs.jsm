Modules.VERSION = '2.1.6';

this.FIT = {
	get box() { return $(objName+'-findInTabs-box'); },
	get tabs() { return $(objName+'-findInTabs-tabs'); },
	get tabsList() { return this.tabs.firstChild; },
	get tabsGroups() { return this.tabsList.nextSibling; },
	get tabsHeader() { return this.tabsList.firstChild; },
	get hits() { return $(objName+'-findInTabs-hits'); },
	get filter() { return $(objName+'-findInTabs-filter'); },
	
	// tab menu items mapped to their browsers
	tabItems: new Map(),
	
	lastBrowser: null,
	working: false,
	
	// Ctrl+Shift+J should be usable within the FIT window
	console: function() {
		let devtools = Cu.import("resource://gre/modules/devtools/Loader.jsm", {}).devtools;
		let hud = devtools.require("devtools/webconsole/hudservice");
		hud.toggleBrowserConsole();
	},

	// All the different filters we can use for the FIT lists
	filterList: [
		Strings.get('findInTabs', 'groupsEverything'),
		Strings.get('findInTabs', 'groupsSource'),
		Strings.get('findInTabs', 'groupsAllTabs'),
		Strings.get('findInTabs', 'groupsPinnedTabs')
	],
	
	MESSAGES: [
		'FIT:FocusMe',
		'FIT:ResetTabHits',
		'FIT:UnloadedTab',
		'FIT:RemoveTab',
		'FIT:CountResult',
		'FIT:CurrentHit',
		'FIT:AddHit',
		'FIT:Update'
	],
	
	receiveMessage: function(m) {
		// +1 is for the ':' after objName
		let name = m.name.substr(objName.length +1);
		let item = this.tabItems.get(m.target);
		
		switch(name) {
			case 'FIT:FocusMe':
				this.focusMe(m.target);
				break;
			
			case 'FIT:ResetTabHits':
				if(item) {
					this.resetTabHits(item);
				}
				break;
			
			case 'FIT:UnloadedTab':
				this.unloadedTab(item, m.data);
				break;
			
			case 'FIT:RemoveTab':
				this.removeTabItem(item);
				break;
			
			case 'FIT:CountResult':
				this.tabCounted(item, m.data);
				break;
			
			case 'FIT:CurrentHit':
				this.currentHit(item, m.data);
				break;
			
			case 'FIT:AddHit':
				this.buildHitItem(item, m.data);
				break;
			
			case 'FIT:Update':
				// 1 child means it's still processing (only has the listheader element); it should never be 0 children but better safe than sorry
				if(this.tabsList.childNodes.length < 2) { break; }
				
				if(item) {
					if(item.delayProcess) {
						item.delayProcess.cancel();
					}
					item.delayProcess = aSync(() => {
						this.aSyncSetTab(item.linkedBrowser, item, findQuery);
					}, 500);
					break;
				}
				
				// If the item doesn't exist yet, create it, we need to obey our filters here as well.
				
				// Don't bother yet, we'll get to it when there is something to search for
				if(!findQuery) { break; }
				
				if(this.tabs._selectedGroupI) {
					var win = this.getWindowForBrowser(m.target);
					if(win.document.documentElement.getAttribute('windowtype') == 'navigator:view-source') {
						if(this.tabs._selectedGroupI > 1) { break; } // Only tabs
					}
					else if(this.tabs._selectedGroupI > 2) {
						var tab = this.getTabForBrowser(m.target);
						
						if(this.tabs._selectedGroupI == 3) { // Pinned
							if(!tab.pinned) { break; }
						}
						
						// Does it belong to our filtered group
						else if(!tab._tabViewTabItem || !tab._tabViewTabItem.parent || tab._tabViewTabItem.parent != this.tabs._selectedGroup) { break; }
					}
				}
				
				item = this.createTabItem(m.target);
				this.aSyncSetTab(m.target, item, findQuery);
				
				break;
		}
	},
	
	observe: function(aSubject, aTopic, aData) {
		switch(aTopic) {
			case 'FIT:Update':
				// Don't do anything if it's not needed
				if(!findQuery) { return; }
				
				let item = this.tabItems.get(aSubject);
				
				switch(aData) {
					case 'updateBrowser':
						if(this.working) { return; } // No redundant multiple calls are necessary
						if(!item) { return; } // the browser isn't a part of our lists, nothing to do
						this.lastBrowser = aSubject;
						this.autoSelectBrowser(item);
						return;
						
					case 'removeBrowser':
						if(item) {
							this.removeTabItem(item);
						}
						return;
				}
				
				break;
		}
	},
	
	handleEvent: function(e) {
		e.preventDefault();
		e.stopPropagation();
		this.shouldFindAll();
	},
	
	toggleGroups: function() {
		let toggle = this.tabsGroups.hidden;
		
		this.tabsGroups.hidden = !toggle;
		this.tabsList.hidden = toggle;
		
		if(toggle) {
			aSync(() => { this.autoSelectGroup(); });
		} else {
			if(this.selectGroup()) {
				this.shouldFindAll();
			}
		}
	},
	
	autoSelectGroup: function() {
		// This is just weird...
		if(!this.tabsGroups.itemCount) {
			aSync(() => { this.autoSelectGroup(); }, 10);
			return;
		}
		
		this.tabsGroups.selectedIndex = this.tabs._selectedGroupI;
		this.tabsGroups.ensureSelectedElementIsVisible();
		
		this.updateGroupNames();
	},
	
	updateFilterTooltip: function() {
		setAttribute(this.filter, 'tooltiptext', Strings.get('findInTabs', 'filterTooltip', [ ['$group$', this.tabs._selectedGroupTitle] ]));
		toggleAttribute(this.filter, 'active', this.tabs._selectedGroupI);
		
		var title = Strings.get('findInTabs', 'findPlaceholder', [ ['$group$', this.tabs._selectedGroupTitle] ]);
		gFindBar._findField.placeholder = title;
		setAttribute(document.documentElement, 'title', title);
	},
	
	isPending: function(node) {
		return trueAttribute(node, 'pending');
	},
	
	getWindowForBrowser: function(aBrowser) {
		if(FITSandbox.navigators.has(aBrowser.ownerGlobal)) {
			return aBrowser.ownerGlobal;
		}
		
		if(FITSandbox.viewSources.has(aBrowser.ownerGlobal)) {
			return aBrowser.ownerGlobal;
		}
		
		return null;
	},
	
	getTabForBrowser: function(aBrowser) {
		if(FITSandbox.navigators.has(aBrowser.ownerGlobal)) {
			return aBrowser.ownerGlobal.gBrowser.getTabForBrowser(aBrowser);
		}
		
		if(FITSandbox.viewSources.has(aBrowser.ownerGlobal)) {
			return { linkedBrowser: aBrowser };
		}
		
		return null;
	},
	
	verifySelection: function() {
		// Re-Do the list if something is invalid
		if(!this.tabsList.currentItem) { return null; }
		if(!this.tabsList.currentItem.linkedBrowser) {
			this.shouldFindAll();
			return null;
		}
		
		var exists = this.getWindowForBrowser(this.tabsList.currentItem.linkedBrowser);
		
		// Should Re-Do the lists when the tab is closed for example
		if(!exists) {
			this.shouldFindAll();
			return null;
		}
		
		return exists;
	},
	
	// When the user selects an item in the tabs list
	selectTab: function() {
		var shouldHide = !this.verifySelection();
		
		for(let hit of this.hits.childNodes) {
			hit.hidden = shouldHide || (hit != this.tabsList.currentItem.linkedHits);
		}
	},
	
	// When the user selects an item in the hits list
	selectHit: function() {
		var item = this.tabsList.currentItem;
		
		// Adding these checks prevents various error messages from showing in the console (even though they actually made no difference)
		if(!item || !item.linkedHits.currentItem || item.linkedHits.currentItem.doNothing) { return; }
		
		// If tab is already loading, don't bother reloading, multiple clicks on the same item shouldn't re-trigger tab load
		if(item.linkedHits.currentItem.loadingTab) {
			item.linkedHits.onselect = null;
			item.linkedHits.selectedIndex = -1;
			item.linkedHits.onselect = () => { this.selectHit(); };
			return;
		}
		
		if(!this.verifySelection()) { return; }
		
		var browser = item.linkedBrowser;
		var tab = this.getTabForBrowser(browser);
		var hits = item.linkedHits;
		
		// Load the tab if it's unloaded
		if(hits.currentItem.isUnloadedTab) {
			// Something went wrong, this should never happen.
			if(!tab) {
				this.removeTabItem(item);
				return;
			}
			
			hits.currentItem.loadingTab = true;
			if(this.isPending(tab)) {
				let win = this.getWindowForBrowser(browser);
				win.gBrowser.reloadTab(tab);
			}
			
			setAttribute(hits.currentItem.childNodes[0], 'value', Strings.get('findInTabs', 'loadingTab'));
			removeAttribute(item.linkedTitle, 'unloaded');
			hits.onselect = null;
			hits.selectedIndex = -1;
			hits.onselect = () => { this.selectHit(); };
			return;
		}
		
		// Which is faster, search forward or backwards? We do an approximation based on the last selected row
		var lastI = hits._lastSelected;
		var curI = hits.selectedIndex;
		var allI = hits.itemCount;
		if(lastI < curI) {
			var aFindPrevious = ((allI -curI +lastI) < (curI -lastI));
		} else {
			var aFindPrevious = ((lastI -curI) < (allI -lastI +curI));
		}
		
		Messenger.messageBrowser(browser, 'FIT:SelectHit', {
			item: hits.selectedIndex,
			hit: hits.currentItem.hitIdx,
			query: findQuery,
			caseSensitive: gFindBar.getElement("find-case-sensitive").checked,
			findPrevious: aFindPrevious
		});
		
		// onmousedown is called after onselect, but there's no need to run selectHit() twice
		hits.onmousedown = null;
		aSync(() => {
			hits.onmousedown = (e) => { if(e.target != hits) { this.selectHit(); } }
		});
	},
	
	focusMe: function(aBrowser) {
		this.working = true;
		
		let win = aBrowser.ownerGlobal;
		win.focus();
		if(win.gBrowser && win.gBrowser.selectedTab) {
			win.gBrowser.selectedTab = win.gBrowser.getTabForBrowser(aBrowser);
		}
		
		this.working = false;
	},
	
	onHoverHit: function(label) {
		var item = label.parentNode.parentNode;
		item.hitIdx = label.hitIdx;
		this.delayHoverGrid(item);
	},
	
	delayHoverGrid: function(item) {
		Timers.init('FITdelayHoverGrid', function() {
			Messenger.messageBrowser(item.linkedBrowser, 'FIT:HoverInGrid', { hit: item.hitIdx, query: findQuery });
		}, 25);
	},
	
	clearHoverGrid: function(item) {
		Timers.cancel('FITdelayHoverGrid');
		Messenger.messageBrowser(item.linkedBrowser, 'FIT:ClearHoverGrid', { query: findQuery });
	},
	
	updateGroupNames: function() {
		// We only show these entries if there are any ViewSource Windows open
		if(FITSandbox.viewSources.size == 0) {
			setAttribute(this.tabsGroups.children[0].childNodes[0], 'value', this.filterList[2]);
			if(this.tabs._selectedGroupI == 1 || this.tabs._selectedGroupI == 2) {
				this.tabs._selectedGroupI = 0;
				this.tabs._selectedGroupTitle = this.tabsGroups.children[0].childNodes[0].getAttribute('value');
				this.tabsGroups.selectedIndex = 0;
			}
			this.tabsGroups.children[1].hidden = true;
			this.tabsGroups.children[2].hidden = true;
		} else {
			setAttribute(this.tabsGroups.children[0].childNodes[0], 'value', this.filterList[0]);
			this.tabsGroups.children[1].hidden = false;
			this.tabsGroups.children[2].hidden = false;
		}
		
		for(let item of this.tabsGroups.children) {
			if(item.linkedGroup) {
				setAttribute(item.childNodes[0], 'value', this.getTabGroupName(item.linkedGroup));
			}
		}
		
		this.updateFilterTooltip();
	},
	
	selectGroup: function() {
		// No point in doing anything if selection isn't changed
		if(this.tabsGroups.selectedIndex == this.tabs._selectedGroupI || this.tabsGroups.selectedIndex == -1) {
			return false;
		}
		
		var group = this.tabsGroups.selectedItem;
		if(this.tabsGroups.selectedIndex > this.filterList.length -1) {
			try {
				if(!group || !group.linkedGroup) {
					this.shouldFindAll();
					return true;
				}
			} catch(ex) {
				this.shouldFindAll();
				return true;
			}
		}
		
		if(group) {
			this.tabs._selectedGroup = group.linkedGroup;
			this.tabs._selectedGroupI = this.tabsGroups.selectedIndex;
			this.tabs._selectedGroupTitle = group.childNodes[0].getAttribute('value');
			return true;
		}
		
		return false;
	},
	
	// the queue is a way to "sequentially" load the info in all tabs with a degree of asynchronicity and ensuring the UI doesn't lock up while it happens
	orders: {
		queue: [],
		active: null,
		timer: null,
		
		clear: function() {
			this.active = null;
			if(this.timer) {
				this.timer.cancel();
				this.timer = null;
			}
			this.queue = [];
		},
		
		add: function(order) {
			this.queue.push(order);
			
			if(!this.active) {
				this.step();
			}
		},
		
		step: function() {
			if(this.timer) {
				this.timer.cancel();
				this.timer = null;
			}
			
			if(this.queue.length == 0) { return; }
			
			let order = this.queue.shift()();
			this.active = order;
			
			let proceed = () => {
				// in case another order stepped up, it will take care of proceeding in the queue
				if(this.active != order) { return; }
				
				this.timer.cancel();
				this.active = null;
				this.timer = null;
				this.step();
			};
			
			// once an order finishes, we can move immediately to the next one
			order.then(proceed);
			
			// if this order takes too long to finish, move on to the next one,
			// there's no need to wait for completion on every single one, it will eventually catch up
			this.timer = aSync(proceed);
		}
	},
	
	// The main commander of the FIT function, cleans up results and schedules new ones if the box is opened	
	shouldFindAll: function() {
		if(this.tabsList) {
			// Update in case we are filtering only source windows and we close the last one
			if((this.tabs._selectedGroupI == 1 || this.tabs._selectedGroupI == 2) && FITSandbox.viewSources.size == 0) {
				this.tabs._selectedGroupI = 0;
			}
			this.selectGroup();
		}
		
		// We need all tab groups initialized in all windows, wait until all's ok
		for(let win of FITSandbox.navigators) {
			if(!win.TabView._window) {
				win.TabView._initFrame(function() { FIT.shouldFindAll(); });
				return;
			}
		}
		
		// previous queued orders are irrelevant
		this.orders.clear();
		
		// Remove previous results if they exist
		while(this.tabs.firstChild) { this.tabs.firstChild.remove(); }
		while(this.hits.firstChild) { this.hits.firstChild.remove(); }
		this.tabItems = new Map();
		
		// Make sure arrays in content script are also cleared
		Messenger.messageAll('FIT:ResetHits');
		
		// Tabs list
		var newTabs = document.createElement('richlistbox');
		newTabs.setAttribute('flex', '1');
		newTabs.onselect = () => { this.selectTab(); };
		
		var newHeader = document.createElement('listheader');
		var firstCol = document.createElement('treecol');
		firstCol.setAttribute('label', Strings.get('findInTabs', 'tabsHeader'));
		firstCol.setAttribute('colspan', '2');
		firstCol.setAttribute('flex', '1');
		var secondCol = document.createElement('treecol');
		secondCol.setAttribute('class', 'hitsHeader');
		secondCol.setAttribute('label', Strings.get('findInTabs', 'hitsHeader'));
		
		newHeader.appendChild(firstCol);
		newHeader.appendChild(secondCol);
		newTabs.appendChild(newHeader);
		
		this.tabs.appendChild(newTabs);
		
		// Tab Groups List
		if(!this.tabs._selectedGroupI || this.tabs._selectedGroupI == -1) {
			this.tabs._selectedGroup = null;
			this.tabs._selectedGroupI = 0;
		}
		
		if(this.tabs._selectedGroupI > this.filterList.length -1) {
			try {
				if(!this.tabs._selectedGroup) {
					this.tabs._selectedGroup = null;
				}
			}
			catch(ex) {
				this.tabs._selectedGroup = null;
			}
			this.tabs._selectedGroupI = 0;
		}
		
		var groupTabs = document.createElement('richlistbox');
		groupTabs.setAttribute('flex', '1');
		groupTabs.ondblclick = (e) => {
			if(e.button == 0) {
				this.toggleGroups();
			}
		};
		groupTabs.onkeyup = (e) => {
			if(e.keyCode == e.DOM_VK_RETURN) {
				this.toggleGroups();
			}
		};
		
		var newHeader = document.createElement('listheader');
		var firstCol = document.createElement('treecol');
		firstCol.setAttribute('label', Strings.get('findInTabs', 'groupsHeader'));
		firstCol.setAttribute('flex', '1');
		newHeader.appendChild(firstCol);
		groupTabs.appendChild(newHeader);
		
		for(let filter of this.filterList) {
			this.createGroupItem(null, groupTabs, filter);
		}
		var itemCount = this.filterList.length -1;
		
		for(let win of FITSandbox.navigators) {
			for(let groupItem of win.TabView._window.GroupItems.groupItems) {
				if(groupItem.hidden) { continue; }
				
				this.createGroupItem(groupItem, groupTabs);
				itemCount++;
				if(this.tabs._selectedGroup == groupItem) {
					this.tabs._selectedGroupI = itemCount;
				}
			}
		}
		
		if(this.tabs._selectedGroupI <= this.filterList.length -1) {
			this.tabs._selectedGroup = null;
			if(!this.tabs._selectedGroupI) {
				this.tabs._selectedGroupTitle = this.filterList[(FITSandbox.viewSources.size > 0) ? 0 : 2];
			} else {
				this.tabs._selectedGroupTitle = this.filterList[this.tabs._selectedGroupI];
			}
		}
		groupTabs.hidden = true;
		this.tabs.appendChild(groupTabs);
		
		this.updateFilterTooltip();
		
		Timers.init('shouldFindAll', () => { this.beginFind(); }, 250);
	},
	
	beginFind: function() {
		if(!findQuery) { return; }
		
		if(this.tabs._selectedGroupI != 1) { // Only Source Windows
			for(let win of FITSandbox.navigators) {
				for(let tab of win.gBrowser.tabs) {
					if(this.tabs._selectedGroupI > 2) { // Pinned or Specific Group
						if(this.tabs._selectedGroupI == 3) { // Pinned
							if(!tab.pinned) { continue; }
						}
						
						// Does it belong to our filtered group
						else if(!tab._tabViewTabItem || !tab._tabViewTabItem.parent || tab._tabViewTabItem.parent != this.tabs._selectedGroup) { continue; }
					}
					
					this.setTabEntry(tab.linkedBrowser);
				}
			}
		}
		
		if(this.tabs._selectedGroupI < 2) { // All Tabs and Source Windows or Only Source Windows
			for(let win of FITSandbox.viewSources) {
				this.setTabEntry(win.gFindBar.browser);
			}
		}
	},
	
	removeTabItem: function(item) {
		if(!item) { return; }
		
		if(item.linkedHits) {
			item.linkedHits.remove();
		}
		if(item.linkedBrowser) {
			this.tabItems.delete(item.linkedBrowser);
		}
		item.remove();
	},
	
	createTabItem: function(aBrowser) {
		var newItem = document.createElement('richlistitem');
		newItem.setAttribute('align', 'center');
		newItem.linkedBrowser = aBrowser;
		
		var itemFavicon = document.createElement('image');
		var itemCount = document.createElement('label');
		itemCount.hits = 0;
		
		var itemLabel = document.createElement('label');
		itemLabel.setAttribute('flex', '1');
		itemLabel.setAttribute('crop', 'end');
		
		newItem.appendChild(itemFavicon);
		newItem.appendChild(itemLabel);
		newItem.appendChild(itemCount);
		
		newItem.linkedFavicon = itemFavicon;
		newItem.linkedTitle = itemLabel;
		newItem.linkedCount = itemCount;
		
		this.tabsList.appendChild(newItem);
		
		this.resetTabHits(newItem);
		this.tabItems.set(aBrowser, newItem);
		
		return newItem;
	},
	
	createGroupItem: function(aGroup, groupTabs, aName) {
		var newItem = document.createElement('richlistitem');
		newItem.setAttribute('align', 'center');
		newItem.linkedGroup = aGroup;
		
		var itemLabel = document.createElement('label');
		itemLabel.setAttribute('flex', '1');
		itemLabel.setAttribute('crop', 'end');
		newItem.appendChild(itemLabel);
		
		if(aGroup && !aName) {
			aName = this.getTabGroupName(aGroup);
		}
		
		itemLabel.setAttribute('value', aName);
		groupTabs.appendChild(newItem);
		
		return newItem;
	},
	
	getTabGroupName: function(aGroup) {
		// This is a copy of what happens in TabView._createGroupMenuItem()
		var aName = aGroup.getTitle();
		if(!aName.trim()) {
			var topChildLabel = aGroup.getTopChild().tab.label;
			var childNum = aGroup.getChildren().length;
			
			if(childNum > 1) {
				var mostRecent = Services.wm.getMostRecentWindow('navigator:browser');
				var num = childNum -1;
				aName = mostRecent.gNavigatorBundle.getString("tabview.moveToUnnamedGroup.label");
				aName = mostRecent.PluralForm.get(num, aName).replace("#1", topChildLabel).replace("#2", num);
			} else {
				aName = topChildLabel;
			}
		}
		
		return aName;
	},
	
	resetTabHits: function(item) {
		if(item.linkedHits) {
			try { item.linkedHits.remove(); }
			catch(ex) { return; } // error means it's a mix up between aSync's
		}
		
		var newHits = document.createElement('richlistbox');
		newHits.setAttribute('flex', '1');
		newHits.onselect = () => { this.selectHit(); };
		newHits.onmousedown = (e) => { if(e.target != newHits) { this.selectHit(); } };
		newHits.hidden = (item != this.tabsList.currentItem); // Keep the hits list visible
		newHits._currentLabel = null;
		newHits._lastSelected = -1;
		newHits.hits = new Map();
		this.hits.appendChild(newHits);
		item.linkedHits = newHits;
	},
	
	updateTabItem: Task.async(function* (item) {
		var newTitle = item.linkedBrowser.contentTitle || item.linkedBrowser.currentURI.spec;
		
		// I want the value on the title of the window, not just the URI of where the view source is pointing at
		var win = this.getWindowForBrowser(item.linkedBrowser);
		var tab = this.getTabForBrowser(item.linkedBrowser);
		var isSource = (win.document.documentElement.getAttribute('windowtype') == 'navigator:view-source');
		if(isSource) {
			newTitle = win.document.documentElement.getAttribute('titlepreface') +newTitle;
		}
		
		// In case of unloaded tabs, the title value hasn't been filled in yet, so we grab from the session value
		// viewSource docs should never make it in this loop
		if(this.isPending(item.linkedBrowser)) {
			if(tab && tab.getAttribute && tab.getAttribute('label')) {
				newTitle = tab.getAttribute('label');
			}
		}
		
		item.linkedTitle.setAttribute('value', newTitle);
		
		// Let's make it pretty with the favicons
		yield new Promise(function(resolve, reject) {
			PlacesUtils.favicons.getFaviconDataForPage(item.linkedBrowser.currentURI, function(aURI) {
				if(aURI) { item.linkedFavicon.setAttribute('src', aURI.spec); }
				
				// Since the API didn't return an URI, lets try to use the favicon image displayed in the tabs
				else {
					if(isSource) {
						// I'm actually not adding a favicon if it's the view source window, I don't think it makes much sense to do it,
						// and it's easier to distinguish these windows in the list this way.
						//item.linkedFavicon.setAttribute('src', 'chrome://branding/content/icon16.png');
					} else {
						var inBox = tab.boxObject.firstChild;
						if(!inBox) { return; }
						while(!inBox.className.contains('tab-stack')) {
							inBox = inBox.nextSibling;
							if(!inBox) { return; }
						}
						
						var icon = inBox.getElementsByClassName('tab-icon-image');
						if(icon.length < 1) { return; }
						
						item.linkedFavicon.setAttribute('src', icon[0].getAttribute('src'));
					}
				}
				
				resolve();
			});
		});
	}),
	
	// This sets up a tab item in the list, corresponding to the provided window
	setTabEntry: function(aBrowser) {
		// about:blank tabs don't need to be listed, they're, by definition, blank
		if(aBrowser.currentURI.spec == 'about:blank' && !this.isPending(aBrowser)) { return; }
		
		var newItem = this.createTabItem(aBrowser);
		this.aSyncSetTab(aBrowser, newItem, findQuery);
	},
	
	aSyncSetTab: function(aBrowser, item, word) {
		this.updateTabItem(item);
		this.orders.add(() => { return this.processTab(aBrowser, item, word); });
	},
	
	processTab: Task.async(function* (aBrowser, item, word) {
		// Because this method can be called with a delay, we should make sure the findword still exists
		if(!findQuery || findQuery != word) { return; }
		
		Messenger.messageBrowser(aBrowser, 'FIT:ProcessText', {
			query: findQuery,
			caseSensitive: gFindBar.getElement("find-case-sensitive").checked
		});
		
		// this task doesn't finish until we hear back from the browser
		yield new Promise(function(resolve, reject) {
			var listener = function() {
				Messenger.unlistenBrowser(aBrowser, 'FIT:FinishedProcessText', listener);
				resolve();
			}
			Messenger.listenBrowser(aBrowser, 'FIT:FinishedProcessText', listener);
		});
	}),
	
	// creates an 'unloaded' entry for the corresponding tab
	unloadedTab: function(item, data) {
		if(!item) { return; }
		
		var label = data.label;
		var loadingTab = (item.linkedHits && item.linkedHits.childNodes.length > 0 && item.linkedHits.childNodes[0].loadingTab);
		
		if(!label) {
			label = Strings.get('findInTabs', (!loadingTab) ? 'unloadedTab' : 'loadingTab');
		
			// If the tab has already been reloaded through our item, don't reset the entry again (it sends a load or location change event
			// that would trigger a new "unloaded" state, and we want to keep the "loading" state.
			if(!loadingTab) {
				setAttribute(item.linkedTitle, 'unloaded', 'true');
				setAttribute(item.linkedCount, 'value', '');
				item.linkedCount.hits = -1;
			}
		}
		
		if(!item.linkedHits || item.linkedHits.childNodes.length !== 1) {
			if(item.linkedHits.childNodes.length != 0) {
				this.resetTabHits(item);
			}
			
			var hit = document.createElement('richlistitem');
			var hitLabel = document.createElement('label');
			hitLabel.setAttribute('flex', '1');
			hitLabel.setAttribute('unloaded', 'true');
			hitLabel.setAttribute('value', label);
			hit.appendChild(hitLabel);
			item.linkedHits.appendChild(hit);
			
			if(data.doNothing) {
				hit.doNothing = true;
				if(this.lastBrowser == item.linkedBrowser) {
					this.tabsList.selectItem(item);
					this.tabsList.ensureSelectedElementIsVisible();
				}
			}
		}
		item.linkedHits.childNodes[0].doNothing = data.doNothing;
		item.linkedHits.childNodes[0].isUnloadedTab = data.isUnloadedTab;
		setAttribute(item.linkedHits.childNodes[0].childNodes[0], 'value', label);
		
		if(data.isUnloadedTab) {
			this.orderByHits(item);
		}
	},
	
	tabCounted: function(item, data) {
		if(data.query != findQuery) { return; }
		
		setAttribute(item.linkedCount, 'value', data.hits);
		item.linkedCount.hits = data.hits;
		
		removeAttribute(item.linkedTitle, 'unloaded');
		this.orderByHits(item);
		
		// Resize the header so it fits nicely into the results
		// +8 comes from padding
		if(item.linkedCount.clientWidth +8 > this.tabsHeader.childNodes[1].clientWidth) {
			this.tabsHeader.childNodes[1].style.minWidth = (item.linkedCount.clientWidth +8)+'px';
		}
		
		if(this.lastBrowser == item.linkedBrowser) {
			this.tabsList.selectItem(item);
			this.tabsList.ensureSelectedElementIsVisible();
			
			Messenger.messageBrowser(item.linkedBrowser, 'FIT:FollowCurrentHit');
		}
	},
	
	// Re-arrange the items by amount of hits, with the tabs with most hits on top.
	// Remember that the listheader element is also a part of tabsList's children.
	orderByHits: function(item) {
		while(item.previousSibling && item.previousSibling.linkedCount && item.linkedCount.hits > item.previousSibling.linkedCount.hits) {
			item.parentNode.insertBefore(item, item.previousSibling);
		}
		while(item.nextSibling && item.previousSibling.linkedCount && item.linkedCount.hits < item.nextSibling.linkedCount.hits) {
			item.parentNode.insertBefore(item, item.nextSibling.nextSibling);
		}
	},
	
	// When the user selects a tab, select the corresponding item in the tabs list if it exists
	autoSelectBrowser: function(item) {
		if(this.tabsList.selectedItem != item) {
			this.tabsList.selectItem(item);
			this.tabsList.ensureSelectedElementIsVisible();
		}
		
		Messenger.messageBrowser(item.linkedBrowser, 'FIT:FollowCurrentHit');
	},
	
	// When the user finds for text or uses the find again button, select the corresponding item in the hits list
	currentHit: function(item, hitIdx) {
		let hit = item.linkedHits.hits.get(hitIdx);
		
		if(hit.item != item.linkedHits.selectedItem) {
			item.linkedHits.selectItem(hit.item);
			item.linkedHits.ensureSelectedElementIsVisible();
			item.linkedHits._lastSelected = item.linkedHits.selectedIndex;
		}
		
		if(item.linkedHits._currentLabel != hit.label) {
			removeAttribute(item.linkedHits._currentLabel, 'current');
			
			item.linkedHits._currentLabel = hit.label;
			setAttribute(item.linkedHits._currentLabel, 'current', 'true');
		}
	},
	
	// build the hits list with items calculated in content
	buildHitItem: function(item, data) {
		if(data.query != findQuery) { return; }
		
		var hitItem = document.createElement('richlistitem');
		hitItem.linkedBrowser = item.linkedBrowser;
		hitItem.hitIdx = data.firstHit;
		
		// Show the position of this search hit in the grid
		setAttribute(hitItem, 'onmouseover', objName+'.FIT.delayHoverGrid(this);');
		setAttribute(hitItem, 'onmouseout', objName+'.FIT.clearHoverGrid(this);');
		
		// Place the text inside a hbox so we can change it's direction without affecting the rest of the layout
		var labelBox = document.createElement('hbox');
		labelBox.style.direction = (data.directionRTL) ? 'rtl' : 'ltr';
		for(let str of data.itemStrings) {
			var label = document.createElement('label');
			if(str.opposite) {
				label.style.direction = (data.directionRTL) ? 'ltr' : 'rtl';
			}
			setAttribute(label, 'value', str.text);
			labelBox.appendChild(label);
			
			if(str.highlight !== null) {
				setAttribute(label, 'highlight', 'true');
				setAttribute(label, 'onmouseover', objName+'.FIT.onHoverHit(this);');
				setAttribute(label, 'onclick', objName+'.FIT.selectHit();');
				label.hitIdx = str.highlight;
				
				item.linkedHits.hits.set(str.highlight, {
					item: hitItem,
					label: label
				});
			}
		}
		hitItem.appendChild(labelBox);
		
		var spacer = document.createElement('label');
		spacer.setAttribute('flex', '1');
		spacer.setAttribute('value', ' ');
		hitItem.appendChild(spacer);
		
		var hitNumber = document.createElement('label');
		var hitNumberValue = data.initNumber;
		if(data.initNumber != data.endNumber) {
			hitNumberValue += '-'+data.endNumber;
		}
		hitNumber.setAttribute('value', hitNumberValue);
		hitItem.appendChild(hitNumber);
		
		item.linkedHits.appendChild(hitItem);
	}
};

Modules.LOADMODULE = function() {
	initFindBar('findInTabs',
		function(bar) {
			var updateButton = document.createElement('toolbarbutton');
			setAttribute(updateButton, 'anonid', objName+'-find-tabs-update');
			setAttribute(updateButton, 'class', 'findbar-button findbar-tabs-update findbar-no-find-fast findbar-no-auto-show tabbable');
			setAttribute(updateButton, 'label', Strings.get('findInTabs', 'updateButtonLabel'));
			setAttribute(updateButton, 'tooltiptext', Strings.get('findInTabs', 'updateButtonTooltip'+(DARWIN ? 'Mac' : 'Win')));
			setAttribute(updateButton, 'oncommand', objName+'.FIT.shouldFindAll();');
			bar.getElement("findbar-container").insertBefore(updateButton, bar.getElement('findbar-textbox-wrapper'));
			
			// make sure the australis styling is also applied to the FIT update button
			buttonLabels.toggle();
			
			// Just a few special modifications to the findbar, to prevent some messages in the error console
			
			delete bar.browser;
			bar.__defineGetter__('browser', function() { return null; });
			bar.__defineSetter__('browser', function(v) { return null; });
			bar._updateCaseSensitivity = function() { return; };
			bar._setCaseSensitivity = function(val) {
				this._typeAheadCaseSensitive = (val) ? 1 : 0;
				FIT.shouldFindAll();
			};
			
			Piggyback.add('findInTabs', bar, 'startFind', function(aMode) {
				this.open(aMode);
				this._findField.focus();
			});
				
		},
		function(bar) {
			// No need to undo the modifications we do in the special case of FITFull, as the window will be closed anyway
		}
	);
	
	for(let msg of FIT.MESSAGES) {
		Messenger.listenAll(msg, FIT);
	}
	
	Listeners.add(window, 'WillFindFindBar', FIT, true);
	
	// Update FIT lists as needed
	Observers.add(FIT, 'FIT:Update');
	
	// Needs to be done once when opening the FIT window
	gFindBar.hidden = false;
	dispatch(window, { type: 'FITLoaded', cancelable: false });
	gFindBar.onFindCommand();
	FIT.shouldFindAll();
};

Modules.UNLOADMODULE = function() {
	deinitFindBar('findInTabs');
	
	Listeners.remove(window, 'WillFindFindBar', FIT, true);
	
	for(let msg of FIT.MESSAGES) {
		Messenger.unlistenAll(msg, FIT);
	}
	
	Observers.remove(FIT, 'FIT:Update');
};
