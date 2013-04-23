moduleAid.VERSION = '1.1.0';
moduleAid.LAZY = true;

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
	
	changed: function(e) {
		if(e.target.localName != 'preference' || !e.target.id) { return; }
		
		var fields = $$("[preference='"+e.target.id+"']");
		var elements = dependsOn.getAll();
		var alreadyChanged = [];
		
		for(var f = 0; f < fields.length; f++) {
			if(!fields[f].id) { continue; }
			
			elementsInnerChangedLoop:
			for(var i = 0; i < elements.length; i++) {
				for(var a = 0; a < alreadyChanged.length; a++) {
					if(alreadyChanged[a] == i) {
						continue elementsInnerChangedLoop;
					}
				}
				
				if(elements[i].getAttribute('dependson').indexOf(fields[f].id) > -1) {
					dependsOn.updateElement(elements[i]);
					alreadyChanged.push(i);
				}
			}
		}
		
		elementsOuterChangedLoop:
		for(var i = 0; i < elements.length; i++) {
			for(var a = 0; a < alreadyChanged.length; a++) {
				if(alreadyChanged[a] == i) {
					continue elementsOuterChangedLoop;
				}
			}
			
			if(elements[i].getAttribute('dependson').indexOf(e.target.id) > -1) {
				dependsOn.updateElement(elements[i]);
				alreadyChanged.push(i);
			}
		}
	},
	
	updateAll: function() {
		var elements = this.getAll();
		for(var i = 0; i < elements.length; i++) {
			this.updateElement(elements[i]);
		}
	},
	
	updateElement: function(el) {
		var attr = el.getAttribute('dependson');
		if(!attr) { return; }
		
		var dependencies = attr.split(',');
		for(var i = 0; i < dependencies.length; i++) {
			var alternates = dependencies[i].split(';');
			var a = 0;
			while(a < alternates.length) {
				var inverse = false;
				var dependency = alternates[a].split(':');
				if(dependency[0].indexOf('!') > -1) {
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
	for(var x=0; x<scales.length; x++) {
		var scale = scales[x];
		if(!scale.getAttribute('onsyncfrompreference') && scale.getAttribute('preference')) {
			scale.value = $(scale.getAttribute('preference')).value;
		}
	}
};

moduleAid.LOADMODULE = function() {
	dependsOn.updateAll();
	listenerAid.add(window, "change", dependsOn.changed, false);
	
	initScales();
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, "change", dependsOn.changed, false);
	
	if(UNLOADED) {
		window.close();
	}
};
