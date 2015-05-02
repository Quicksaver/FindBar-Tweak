Modules.VERSION = '1.4.1';
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
		var alreadyChanged = [];
		
		for(var field of fields) {
			if(!field.id) { continue; }
			
			for(var node of elements) {
				if(alreadyChanged.indexOf(node) > -1) { continue; }
				
				if(node.getAttribute('dependson').contains(field.id)) {
					this.updateElement(node);
					alreadyChanged.push(node);
				}
			}
		}
		
		for(var node of elements) {
			if(alreadyChanged.indexOf(node) > -1) { continue; }
			
			if(node.getAttribute('dependson').contains(e.target.id)) {
				this.updateElement(node);
				alreadyChanged.push(node);
			}
		}
	},
	
	updateAll: function() {
		var elements = this.getAll();
		for(var node of elements) {
			this.updateElement(node);
		}
	},
	
	updateElement: function(el) {
		var attr = el.getAttribute('dependson');
		if(!attr) { return; }
		
		var dependencies = attr.split(',');
		for(var d of dependencies) {
			var alternates = d.split(';');
			var a = 0;
			while(a < alternates.length) {
				var inverse = false;
				var dependency = alternates[a].split(':');
				if(dependency[0].contains('!')) {
					inverse = true;
					dependency[0] = dependency[0].replace('!', '');
				}
				
				dependency[0] = trim(dependency[0]);
				if(dependency[0] == '') { continue; }
				
				if(dependency.length == 2) {
					dependency[1] = trim(dependency[1]);
				}
				
				var pref = $(dependency[0]);
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


// This is so scales are properly initialized if they have a preference attribute, should work in most cases.
// If you want to bypass this you can set onsyncfrompreference attribute on scale
this.initScales = function() {
	var scales = $$('scale');
	for(var scale of scales) {
		if(!scale.getAttribute('onsyncfrompreference') && scale.getAttribute('preference')) {
			scale.value = $(scale.getAttribute('preference')).value;
		}
	}
};

this.sizeProperly = function() {
	// If there's only one pane, this shouldn't be needed
	if(document.documentElement.preferencePanes.length <= 1) { return; }
	
	if(document.documentElement._shouldAnimate) {
		// Bugfix: opening preferences with lastSelected as any other than the first would incorrectly set the height of the window to the height of the first pane (general),
		// leaving extra empty space in the bottom.
		// Bugfix: if the first pane isn't the biggest, it will incorrectly set its height to be larger than it should as well (for some reason...)
		var paneDeckContainer = document.getAnonymousElementByAttribute(document.documentElement, 'class', 'paneDeckContainer');
		var contentBox = document.getAnonymousElementByAttribute(document.documentElement.currentPane, 'class', 'content-box');
		var paneStyle = getComputedStyle(document.documentElement.currentPane);
		var paneHeight = contentBox.clientHeight + parseInt(paneStyle.paddingTop) + parseInt(paneStyle.paddingBottom);
		if(paneDeckContainer.clientHeight != paneHeight) {
			window.resizeBy(0, paneHeight - paneDeckContainer.clientHeight);
		}
	}
	else {
		// Bugfix: I really hate panes sometimes... I think this is because the first pane isn't the biggest as well...
		// When opening the dialog with a pane other than the first, it would be shorter than it should, taking the height of the first pane.
		var largestPane = document.documentElement.preferencePanes[0];
		var contentBox = document.getAnonymousElementByAttribute(document.documentElement.preferencePanes[0], 'class', 'content-box');
		for(var i=1; i<document.documentElement.preferencePanes.length; i++) {
			var nextBox = document.getAnonymousElementByAttribute(document.documentElement.preferencePanes[i], 'class', 'content-box');
			if(nextBox.clientHeight > contentBox.clientHeight) {
				largestPane = document.documentElement.preferencePanes[i];
				contentBox = nextBox;
			}
		}
		
		var paneDeckContainer = document.getAnonymousElementByAttribute(document.documentElement, 'class', 'paneDeckContainer');
		var paneStyle = getComputedStyle(largestPane);
		var paneHeight = contentBox.clientHeight + parseInt(paneStyle.paddingTop) + parseInt(paneStyle.paddingBottom);
		if(paneDeckContainer.clientHeight != paneHeight) {
			window.resizeBy(0, paneHeight - paneDeckContainer.clientHeight);
		}
	}
};

Modules.LOADMODULE = function() {
	dependsOn.updateAll();
	Listeners.add(window, "change", dependsOn, false);
	
	initScales();
	
	window._sizeToContent = window.sizeToContent;
	window.sizeToContent = function() {
		window._sizeToContent();
		sizeProperly();
	};
	
	sizeProperly();
};

Modules.UNLOADMODULE = function() {
	window.sizeToContent = window._sizeToContent;
	delete window._sizeToContent;
	
	Listeners.remove(window, "change", dependsOn, false);
	
	if(UNLOADED) {
		window.close();
	}
};
