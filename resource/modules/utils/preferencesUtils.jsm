Modules.VERSION = '2.0.1';
Modules.UTILS = true;

// dependsOn - object that adds a dependson attribute functionality to xul preference elements.
// Just add the attribute to the desired xul element and let the script do its thing. dependson accepts comma-separated or semicolon-separated strings in the following format:
//	[!]element[:value] where:
//		element - id of an element associated with a preference or the id of the preference element
//		(optional) ! - before element, checks for the opposite condition
//		(optional) :value - value is some specific value that element must have in order for the condition to return true
//	To condition for several dependencies: ',' is equivalent to AND and ';' to OR
//	examples:
//		element1 - checks if element1 is true
//		element2:someValue - checks if element2 has value of 'someValue'
//		element3:5 - checks if element3 has value 5
//		!element4 - checks if element4 is false
//		!element5:someOtherValue - checks if element5 has any value other than 'someOtherValue'
//		element6,element7:someValue - check if element6 is true and element7 has value of 'someValue'
//		element8:someValue;element9:someOtherValue - checks if element8 has value of 'someValue' or element9 has value of 'someOtherValue'
this.dependsOn = {
	getAll: function() {
		return $$("[dependson]");
	},
	
	handleEvent: function(e) {
		if(e.target.localName != 'preference' || !e.target.id) { return; }
		
		var fields = $$("[preference='"+e.target.id+"']");
		var elements = this.getAll();
		var alreadyChanged = new Set();
		
		for(let field of fields) {
			if(!field.id) { continue; }
			
			for(let node of elements) {
				if(alreadyChanged.has(node)) { continue; }
				
				if(node.getAttribute('dependson').contains(field.id)) {
					this.updateElement(node);
					alreadyChanged.add(node);
				}
			}
		}
		
		for(let node of elements) {
			if(alreadyChanged.has(node)) { continue; }
			
			if(node.getAttribute('dependson').contains(e.target.id)) {
				this.updateElement(node);
				alreadyChanged.add(node);
			}
		}
	},
	
	updateAll: function() {
		let elements = this.getAll();
		for(let node of elements) {
			this.updateElement(node);
		}
	},
	
	updateElement: function(el) {
		let attr = el.getAttribute('dependson');
		if(!attr) { return; }
		
		let dependencies = attr.split(',');
		for(let d of dependencies) {
			let alternates = d.split(';');
			let a = 0;
			while(a < alternates.length) {
				let inverse = false;
				let dependency = alternates[a].split(':');
				if(dependency[0].contains('!')) {
					inverse = true;
					dependency[0] = dependency[0].replace('!', '');
				}
				
				dependency[0] = trim(dependency[0]);
				if(dependency[0] == '') { continue; }
				
				if(dependency.length == 2) {
					dependency[1] = trim(dependency[1]);
				}
				
				let pref = $(dependency[0]);
				if(!pref) {
					Cu.reportError("Element of ID '"+dependency[0]+"' could not be found!");
					return;
				}
				
				if(pref.localName != 'preference') {
					pref = $(pref.getAttribute('preference'));
				}
				switch(pref.type) {
					case 'int':
						var value = (dependency.length == 2) ? parseInt(dependency[1]) : 0;
						break;
					case 'bool':
						var value = (dependency.length == 1) ? true : (dependency[1] == 'true') ? true : false;
						break;
					case 'string':
					default:
						var value = (dependency.length == 2) ? dependency[1] : '';
						break;
				}
				
				a++;
				if( (!inverse && pref.value !== value) || (inverse && pref.value === value) ) {
					if(a < alternates.length) { continue; }
					
					el.setAttribute('disabled', 'true');
					return;
				}
				else if(a < alternates.length) {
					el.removeAttribute('disabled');
					return;
				}
			}
		}
		el.removeAttribute('disabled');
	}
};


// initScales - every <scale> node should be properly initialized if it has a preference attribute; should work in most cases.
// If you want to bypass this you can set onsyncfrompreference attribute on the scale.
this.initScales = function() {
	var scales = $$('scale');
	for(let scale of scales) {
		if(!scale.getAttribute('onsyncfrompreference') && scale.getAttribute('preference')) {
			scale.value = $(scale.getAttribute('preference')).value;
		}
	}
};

// keys - should automatically take care of all the labels, entries and actions of any keysets to be registered through the Keysets object.
// It looks for and expects each keyset to be layouted (is this even a word?) in the XUL options page as such:
// 	<checkbox keysetAccel="keyName" preference="pref-to-accel"/>
//	<checkbox keysetAlt="keyName" preference="pref-to-alt"/>
//	<checkbox keysetShift="keyName" preference="pref-to-shift"/>
//	<menulist keyset="keyName" preference="pref-to-keycode"/>
this.keys = {
	all: [],
	
	handleEvent: function(e) {
		this.fillKeyCodes();
	},
	
	init: function() {
		let done = new Set();
		let all = $$('[keyset]');
		for(let node of all) {
			let id = node.getAttribute('keyset');
			if(done.has(id)) { continue; }
			done.add(id);
			
			if(!node.firstChild) {
				node.appendChild(document.createElement('menupopup'));
			}
			
			let key = {
				id: id,
				node: node,
				accelBox: $$('[keysetAccel="'+id+'"]')[0],
				shiftBox: $$('[keysetShift="'+id+'"]')[0],
				altBox: $$('[keysetAlt="'+id+'"]')[0],
				get disabled () { return trueAttribute(this.node, 'disabled'); },
				get keycode () { return this.node.value; },
				get accel () { return this.accelBox.checked; },
				get shift () { return this.shiftBox.checked; },
				get alt () { return this.altBox.checked; },
				get menu () { return this.node.firstChild; }
			};
			
			this.all.push(key);
			Keysets.fillKeyStrings(key);
			
			Listeners.add(key.node, 'command', this);
			Listeners.add(key.accelBox, 'command', this);
			Listeners.add(key.shiftBox, 'command', this);
			Listeners.add(key.altBox, 'command', this);
		}
	},
	
	uninit: function() {
		for(let key of this.all) {
			Listeners.remove(key.node, 'command', this);
			Listeners.remove(key.accelBox, 'command', this);
			Listeners.remove(key.shiftBox, 'command', this);
			Listeners.remove(key.altBox, 'command', this);
		}
	},
	
	fillKeycodes: function() {
		for(let key of this.all) {
			let available = Keysets.getAvailable(key, this.all);
			if(!available[key.keycode]) {
				key.keycode = 'none';
			}
			
			var item = key.menu.firstChild.nextSibling;
			while(item) {
				item.setAttribute('hidden', 'true');
				item.setAttribute('disabled', 'true');
				item = item.nextSibling;
			}
			if(key.keycode == 'none') {
				key.menu.parentNode.selectedItem = key.menu.firstChild;
				$(key.menu.parentNode.getAttribute('preference')).value = 'none';
			}
			
			for(let item of key.menu.childNodes) {
				let keycode = item.getAttribute('value');
				if(!available[keycode]) { continue; }
				
				item.removeAttribute('hidden');
				item.removeAttribute('disabled');
				if(keycode == key.keycode) {
					key.menu.parentNode.selectedItem = item;
					// It has the annoying habit of re-selecting the first (none) entry when selecting a menuitem with '*' as value
					if(keycode == '*') {
						var itemIndex = key.menu.parentNode.selectedIndex;
						aSync(function() { key.menu.parentNode.selectedIndex = itemIndex; });
					}
				}
			}
		}
	}
};

// In case I need subdialogs:
//   http://mxr.mozilla.org/mozilla-central/source/browser/components/preferences/in-content/subdialogs.js
//   http://mxr.mozilla.org/mozilla-central/source/browser/components/preferences/in-content/preferences.xul#197

// categories - aid to properly display preferences in a tab, just like the current native options tab
// adapted from http://mxr.mozilla.org/mozilla-central/source/browser/components/preferences/in-content/preferences.js
// unlike in the original, we don't use hidden, instead we use collapsed to switch between panels, so that all the bindings remain applied throughout the page.
this.categories = {
	lastHash: "",
	
	get categories () { return $('categories'); },
	get prefPane () { return $('mainPrefPane'); },
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'select':
				this.gotoPref(e.target.value)
				break;
			
			case 'keydown':
				if(e.keyCode == e.DOM_VK_TAB) {
					setAttribute(this.categories, "keyboard-navigation", "true");
				}
				break;
			
			case 'mousedown':
				removeAttribute(this.categories, "keyboard-navigation");
				break;
			
			case 'hashchange':
				this.gotoPref();
				break;
		}
	},
	
	init: function() {
		document.documentElement.instantApply = true;
		
		// sometimes it may happen that the overlays aren't loaded in the correct order, which means the categories might not be ordered correctly,
		// it's definitely better UX if the categories are always in the same order, so we try to ensure this
		let categories = $('categories');
		let node = categories.firstChild;
		while(node) {
			let position = node.getAttribute('position');
			if(position) {
				position = parseInt(position);
				let sibling = null;
				let previous = node.previousSibling;
				while(previous) {
					let related = previous.getAttribute('position');
					if(related) {
						related = parseInt(related);
						if(position < related) {
							sibling = previous;
						} else {
							break;
						}
					}
					previous = previous.previousSibling;
				}
				
				if(sibling) {
					categories.insertBefore(node, sibling);
				}
			}
			
			node = node.nextSibling;
		}
		
		Listeners.add(this.categories, "select", this);
		Listeners.add(document.documentElement, "keydown", this);
		Listeners.add(this.categories, "mousedown", this);
		Listeners.add(window, "hashchange", this);
		
		this.gotoPref();
		this.dynamicPadding();
	},
	
	uninit: function() {
		Listeners.remove(this.categories, "select", this);
		Listeners.remove(document.documentElement, "keydown", this);
		Listeners.remove(this.categories, "mousedown", this);
		Listeners.remove(window, "hashchange", this);
	},
	
	// Make the space above the categories list shrink on low window heights
	dynamicPadding: function() {
		let catPadding = parseInt(getComputedStyle(this.categories).paddingTop);
		let fullHeight = this.categories.lastElementChild.getBoundingClientRect().bottom;
		let mediaRule = `
			@media (max-height: ${fullHeight}px) {
				#categories {
					padding-top: calc(100vh - ${fullHeight - catPadding}px);
				}
			}
		`;
		let mediaStyle = document.createElementNS('http://www.w3.org/1999/xhtml', 'html:style');
		mediaStyle.setAttribute('type', 'text/css');
		mediaStyle.appendChild(document.createCDATASection(mediaRule));
		document.documentElement.appendChild(mediaStyle);
	},
	
	gotoPref: function(aCategory) {
		const kDefaultCategoryInternalName = this.categories.lastElementChild.value;
		let hash = document.location.hash;
		let category = aCategory || hash.substr(1) || Prefs.lastPrefPane || kDefaultCategoryInternalName;
		category = this.friendlyPrefCategoryNameToInternalName(category);
		
		// Updating the hash (below) or changing the selected category will re-enter gotoPref.
		if(this.lastHash == category) { return; }
		
		let item = this.categories.querySelector(".category[value="+category+"]");
		if(!item) {
			category = kDefaultCategoryInternalName;
			item = this.categories.querySelector(".category[value="+category+"]");
		}
		
		let newHash = this.internalPrefCategoryNameToFriendlyName(category);
		if(this.lastHash || category != kDefaultCategoryInternalName) {
			document.location.hash = newHash;
		}
		
		// Need to set the lastHash before setting categories.selectedItem since the categories 'select' event will re-enter the gotoPref codepath.
		this.lastHash = category;
		this.categories.selectedItem = item;
		setAttribute(document.documentElement, 'currentcategory', category);
		Prefs.lastPrefPane = category; // I can't save the last category in a persisted attribute because it persists to the hashed url
		
		window.history.replaceState(category, document.title);
		this.search(category, "data-category");
		document.querySelector(".main-content").scrollTop = 0;
	},
	
	search: function(aQuery, aAttribute) {
		let elements = this.prefPane.children;
		for(let element of elements) {
			if(element.nodeName == 'preferences') { continue; }
			
			let attributeValue = element.getAttribute(aAttribute);
			element.collapsed = (attributeValue != aQuery);
		}
	},
	
	friendlyPrefCategoryNameToInternalName: function(aName) {
		if(aName.startsWith("pane")) {
			return aName;
		}
		
		return "pane" + aName.substring(0,1).toUpperCase() + aName.substr(1);
	},
	
	// This function is duplicated inside of utilityOverlay.js's openPreferences.
	internalPrefCategoryNameToFriendlyName: function(aName) {
		return (aName || "").replace(/^pane./, function(toReplace) { return toReplace[4].toLowerCase(); });
	}
};

Modules.LOADMODULE = function() {
	callOnLoad(window, function() {
		dependsOn.updateAll();
		Listeners.add(window, "change", dependsOn);
		Listeners.add($('selectColor'), 'select', function(e) { console.log(e); }, true);
		Listeners.add($('selectColor'), 'change', function(e) { console.log(e); }, true);
		
		initScales();
		keys.init();
		categories.init();
	});
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(window, "change", dependsOn);
	keys.uninit();
	categories.uninit();
	
	if(UNLOADED) {
		window.close();
	}
};
