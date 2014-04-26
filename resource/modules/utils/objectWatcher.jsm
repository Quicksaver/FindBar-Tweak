moduleAid.VERSION = '2.2.0';
moduleAid.LAZY = true;

// objectWatcher - This acts as a replacement for the event DOM Attribute Modified, works for both attributes and object properties
//	addPropertyWatcher(obj, prop, handler, capture) - registers handler as a watcher for obj property prop changes
//		obj - (xul element or object) to watch for changes
//		prop - (string) property name in obj to watch
//		handler - (function) method to fire when prop is set or changed
//		(optional) capture - when (bool) true it cancels setting the property if handler returns (bool) false, defaults to (bool) false
//	removePropertyWatcher(obj, prop, handler, capture) - unregisters handler as a watcher for prop changes
//		see addPropertyWatcher()
//	addAttributeWatcher(obj, attr, handler, capture, iterateAll) - registers handler as a watcher for object attribute attr changes
//		obj - (xul element or object) to watch for changes
//		attr - (string) attribute name in obj to watch
//		handler - (function) method to fire when attr is set, removed or changed
//		(optional) capture - when (bool) true it cancels setting the attribute if handler returns (bool) false, defaults to (bool) false
//		(optional) iterateAll -	when (bool) false only triggers handler for the last change in the attribute, merging all the changes queued in between.
//					when (bool) true triggers handler for every attribute change in the queue. Defaults to (bool) true.
//					will always act as (bool) true if capture is (bool) true.
//	removeAttributeWatcher(obj, attr, handler, capture, iterateAll) - unregisters handler as a watcher for object attribute attr changes
//		see addAttributeWatcher()
// All handlers expect function(obj, prop, oldVal, newVal), where:
//	obj - (xul element or object) where the change occured
//	prop - (string) name of the property or attribute being set or changed
//	oldVal - the current value of prop
//	newVal - the new value of prop
// Note: deleting a watched property does not trigger the watchers, so don't do it! Set it to undefined instead if you wish to delete it after removing the watchers.
this.objectWatcher = {
	// Properties part, works by replacing the get and set accessor methods of a property with custom ones
	addPropertyWatcher: function(obj, prop, handler, capture) {
		if(!this.setWatchers(obj)) { return false; }
		capture = (capture) ? true : false;
		
		if(typeof(obj._propWatchers.properties[prop]) == 'undefined') {
			var tempVal = (typeof(obj[prop]) == 'undefined') ? undefined : obj[prop];
			// can't watch constants
			if(!(delete obj[prop])) {
				this.unsetWatchers(obj);
				return false;
			}
			
			obj._propWatchers.properties[prop] = {
				value: tempVal,
				handlers: [],
				handling: false
			};
			
			obj.__defineGetter__(prop, function () { return this._propWatchers.properties[prop].value; });
			obj.__defineSetter__(prop, function (newVal) {
				if(this._propWatchers.properties[prop].handling) {
					this._propWatchers.properties[prop].value = newVal;
					return this._propWatchers.properties[prop].value;
				}
				this._propWatchers.properties[prop].handling = true;
				
				var oldVal = this._propWatchers.properties[prop].value;
				for(var i = 0; i < this._propWatchers.properties[prop].handlers.length; i++) {
					if(this._propWatchers.properties[prop].handlers[i].capture) {
						var continueHandlers = true;
						try { continueHandlers = this._propWatchers.properties[prop].handlers[i].handler(this, prop, oldVal, newVal); }
						catch(ex) { Cu.reportError(ex); }
						if(continueHandlers === false) {
							this._propWatchers.properties[prop].handling = false;
							return this._propWatchers.properties[prop].value;
						}
					}
				}
				this._propWatchers.properties[prop].value = newVal;
				for(var i = 0; i < this._propWatchers.properties[prop].handlers.length; i++) {
					if(!this._propWatchers.properties[prop].handlers[i].capture) {
						try { this._propWatchers.properties[prop].handlers[i].handler(this, prop, oldVal, newVal); }
						catch(ex) { Cu.reportError(ex); }
					}
				}
				
				this._propWatchers.properties[prop].handling = false;
				return this._propWatchers.properties[prop].value;
			});
		}
		else {
			for(var i=0; i<obj._propWatchers.properties[prop].handlers.length; i++) {
				if(compareFunction(obj._propWatchers.properties[prop].handlers[i].handler, handler)
				&& capture == obj._propWatchers.properties[prop].handlers[i].capture) { return true; }
			}
		}
		
		obj._propWatchers.properties[prop].handlers.push({ handler: handler, capture: capture });
		obj._propWatchers.setters++;
		return true;
	},
	
	removePropertyWatcher: function(obj, prop, handler, capture) {
		if(!obj._propWatchers || typeof(obj._propWatchers.properties[prop]) == 'undefined') { return false; }
		capture = (capture) ? true : false;
		
		for(var i=0; i<obj._propWatchers.properties[prop].handlers.length; i++) {
			if(compareFunction(obj._propWatchers.properties[prop].handlers[i].handler, handler)
			&& capture == obj._propWatchers.properties[prop].handlers[i].capture) {
				obj._propWatchers.properties[prop].handlers.splice(i, 1);
				if(obj._propWatchers.properties[prop].handlers.length == 0) {
					delete obj[prop]; // remove accessors
					if(obj._propWatchers.properties[prop].value != undefined) {
						obj[prop] = obj._propWatchers.properties[prop].value;
					}
					delete obj._propWatchers.properties[prop];
				}
				
				obj._propWatchers.setters--;
				this.unsetWatchers(obj);
				return true;
			}
		}
		
		return false;
	},
	
	// Attributes part, works through delayed DOM Mutation Observers
	addAttributeWatcher: function(obj, attr, handler, capture, iterateAll) {
		if(!this.setWatchers(obj)) { return false; }
		capture = (capture) ? true : false;
		iterateAll = (capture || iterateAll) ? true : false;
		
		if(typeof(obj._propWatchers.attributes[attr]) == 'undefined') {
			obj._propWatchers.disconnect();
			obj._propWatchers.attributes[attr] = [];
			obj._propWatchers.reconnect();
		}
		else {
			for(var i=0; i<obj._propWatchers.attributes[attr].length; i++) {
				if(compareFunction(obj._propWatchers.attributes[attr][i].handler, handler)
				&& capture == obj._propWatchers.attributes[attr][i].capture
				&& iterateAll == obj._propWatchers.attributes[attr][i].iterateAll) { return true; }
			}
		}
		
		obj._propWatchers.attributes[attr].push({ handler: handler, capture: capture, iterateAll: iterateAll });
		obj._propWatchers.setters++;
		return true;
	},
	
	removeAttributeWatcher: function(obj, attr, handler, capture, iterateAll) {
		if(!obj || !obj._propWatchers || typeof(obj._propWatchers.attributes[attr]) == 'undefined') { return false; }
		capture = (capture) ? true : false;
		iterateAll = (capture || iterateAll) ? true : false;
		
		for(var i=0; i<obj._propWatchers.attributes[attr].length; i++) {
			if(compareFunction(obj._propWatchers.attributes[attr][i].handler, handler)
			&& capture == obj._propWatchers.attributes[attr][i].capture
			&& iterateAll == obj._propWatchers.attributes[attr][i].iterateAll) {
				obj._propWatchers.attributes[attr].splice(i, 1);
				if(obj._propWatchers.attributes[attr].length == 0) {
					obj._propWatchers.disconnect();
					delete obj._propWatchers.attributes[attr];
					obj._propWatchers.reconnect();
				}
				
				obj._propWatchers.setters--;
				this.unsetWatchers(obj);
				return true;
			}
		}
		
		return false;
	},
	
	setWatchers: function(obj) {
		if(!obj || typeof(obj) != 'object') { return false; }
		if(obj._propWatchers) { return true; }
		
		obj._propWatchers = {
			setters: 0,
			properties: {}
		};
		
		if(!obj.ownerDocument) { return true; }
		
		obj._propWatchers.attributes = {};
		obj._propWatchers.mutations = [];
		obj._propWatchers.scheduler = null;
		obj._propWatchers.reconnect = function() {
			var attrList = [];
			for(var a in this.attributes) {
				attrList.push(a);
			}
			if(attrList.length > 0) {
				var observerProperties = {
					attributes: true,
					attributeOldValue: true
				};
				observerProperties.attributeFilter = attrList;
				this.mutationObserver.observe(obj, observerProperties);
			}
		};
		obj._propWatchers.disconnect = function() {
			this.mutationObserver.disconnect();
		};
		obj._propWatchers.scheduleWatchers = function(mutations, observer) {
			if(obj._propWatchers.schedule) {
				obj._propWatchers.schedule.cancel();
				obj._propWatchers.schedule = null;
			}
			
			for(var m=0; m<mutations.length; m++) {
				obj._propWatchers.mutations.push(mutations[m]);
			}
			
			// the script could become really heavy if it called the main function everytime (width attribute on sidebar and dragging it for instance)
			// I'm simply following the changes asynchronously; any delays for heavily changed attributes should be handled properly by the actual handlers.
			obj._propWatchers.schedule = aSync(obj._propWatchers.callAttrWatchers);
		};
		obj._propWatchers.callAttrWatchers = function() {
			obj._propWatchers.disconnect();
			var muts = obj._propWatchers.mutations;
			obj._propWatchers.mutations = [];
			
			for(var attr in obj._propWatchers.attributes) {
				var changes = 0;
				var oldValue = false;
				var newValue = obj.hasAttribute(attr) ? obj.getAttribute(attr) : null;
				captureMutations_loop: for(var m=0; m<muts.length; m++) {
					if(muts[m].attributeName != attr) { continue; }
					
					oldValue = typeof(muts[m].realOldValue) != 'undefined' ? muts[m].realOldValue : muts[m].oldValue;
					newValue = false;
					for(var n=m+1; n<muts.length; n++) {
						if(muts[n].attributeName == attr) {
							newValue = typeof(muts[n].realOldValue) != 'undefined' ? muts[n].realOldValue : muts[n].oldValue;
							break;
						}
					}
					if(newValue === false) {
						newValue = obj.hasAttribute(attr) ? obj.getAttribute(attr) : null;
					}
					
					if(oldValue === newValue) {
						newValue = oldValue;
						muts.splice(m, 1);
						m--;
						continue captureMutations_loop;
					}
					
					for(var h=0; h<obj._propWatchers.attributes[attr].length; h++) {
						if(obj._propWatchers.attributes[attr][h].capture) {
							var continueHandlers = true;
							try { continueHandlers = obj._propWatchers.attributes[attr][h].handler(obj, attr, oldValue, newValue); }
							catch(ex) { Cu.reportError(ex); }
							
							if(continueHandlers === false) {
								for(var n=m+1; n<muts.length; n++) {
									if(muts[n].attributeName == attr) {
										muts[n].realOldValue = oldValue;
										break;
									}
								}
								newValue = oldValue;
								muts.splice(m, 1);
								m--;
								continue captureMutations_loop;
							}
						}
					}
					
					changes++;
				}
				
				toggleAttribute(obj, attr, newValue !== null, newValue);
				
				if(changes > 0) {
					var firstOldValue = typeof(muts[0].realOldValue) != 'undefined' ? muts[0].realOldValue : muts[0].oldValue;
					for(var m=0; m<muts.length; m++) {
						if(muts[m].attributeName != attr) { continue; }
						
						oldValue = typeof(muts[m].realOldValue) != 'undefined' ? muts[m].realOldValue : muts[m].oldValue;
						newValue = false;
						for(var n=m+1; n<muts.length; n++) {
							if(muts[n].attributeName == attr) {
								newValue = typeof(muts[n].realOldValue) != 'undefined' ? muts[n].realOldValue : muts[n].oldValue;
								break;
							}
						}
						if(newValue === false) {
							newValue = obj.hasAttribute(attr) ? obj.getAttribute(attr) : null;
						}
						
						for(var h=0; h<obj._propWatchers.attributes[attr].length; h++) {
							if(!obj._propWatchers.attributes[attr][h].capture) {
								if(obj._propWatchers.attributes[attr][h].iterateAll) {
									try { obj._propWatchers.attributes[attr][h].handler(obj, attr, oldValue, newValue); }
									catch(ex) { Cu.reportError(ex); }
								}
								else if(m == muts.length -1) {
									try { obj._propWatchers.attributes[attr][h].handler(obj, attr, firstOldValue, newValue); }
									catch(ex) { Cu.reportError(ex); }
								}
							}
						}
					}
				}
			}
			
			obj._propWatchers.reconnect();
		};
		obj._propWatchers.mutationObserver = new obj.ownerDocument.defaultView.MutationObserver(obj._propWatchers.scheduleWatchers);
		
		return true;
	},
	
	unsetWatchers: function(obj) {
		if(typeof(obj) != 'object' || obj === null || !obj._propWatchers || obj._propWatchers.setters > 0) { return false; }
		
		obj._propWatchers.disconnect();
		delete obj._propWatchers;
		return true;
	}
};
