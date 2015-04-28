Modules.VERSION = '2.5.0';
Modules.UTILS = true;
Modules.BASEUTILS = true;

// Watchers - This acts as a replacement for the event DOM Attribute Modified, works for both attributes and object properties
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
this.Watchers = {
	_obj: '_WATCHERS_'+objName,
	
	// Properties part, works by replacing the get and set accessor methods of a property with custom ones
	addPropertyWatcher: function(obj, prop, handler, capture) {
		if(!this.setWatchers(obj)) { return false; }
		capture = (capture) ? true : false;
		
		if(!obj[this._obj].properties[prop]) {
			var tempVal = obj[prop];
			// can't watch constants
			if(!(delete obj[prop])) {
				this.unsetWatchers(obj);
				return false;
			}
			
			obj[this._obj].properties[prop] = {
				value: tempVal,
				handlers: [],
				handling: false
			};
			
			obj.__defineGetter__(prop, function () { return this[Watchers._obj].properties[prop].value; });
			obj.__defineSetter__(prop, function (newVal) {
				if(this[Watchers._obj].properties[prop].handling) {
					this[Watchers._obj].properties[prop].value = newVal;
					return this[Watchers._obj].properties[prop].value;
				}
				this[Watchers._obj].properties[prop].handling = true;
				
				var oldVal = this[Watchers._obj].properties[prop].value;
				for(var h of this[Watchers._obj].properties[prop].handlers) {
					if(h.capture) {
						var continueHandlers = true;
						try { continueHandlers = h.handler(this, prop, oldVal, newVal); }
						catch(ex) { Cu.reportError(ex); }
						if(continueHandlers === false) {
							this[Watchers._obj].properties[prop].handling = false;
							return this[Watchers._obj].properties[prop].value;
						}
					}
				}
				this[Watchers._obj].properties[prop].value = newVal;
				for(var h of this[Watchers._obj].properties[prop].handlers) {
					if(!h.capture) {
						try { h.handler(this, prop, oldVal, newVal); }
						catch(ex) { Cu.reportError(ex); }
					}
				}
				
				this[Watchers._obj].properties[prop].handling = false;
				return this[Watchers._obj].properties[prop].value;
			});
		}
		else {
			for(var h of obj[this._obj].properties[prop].handlers) {
				if(compareFunction(h.handler, handler) && capture == h.capture) { return true; }
			}
		}
		
		obj[this._obj].properties[prop].handlers.push({ handler: handler, capture: capture });
		obj[this._obj].setters++;
		return true;
	},
	
	removePropertyWatcher: function(obj, prop, handler, capture) {
		if(!obj[this._obj] || !obj[this._obj].properties[prop]) { return false; }
		capture = (capture) ? true : false;
		
		for(var i=0; i<obj[this._obj].properties[prop].handlers.length; i++) {
			if(compareFunction(obj[this._obj].properties[prop].handlers[i].handler, handler)
			&& capture == obj[this._obj].properties[prop].handlers[i].capture) {
				obj[this._obj].properties[prop].handlers.splice(i, 1);
				if(obj[this._obj].properties[prop].handlers.length == 0) {
					delete obj[prop]; // remove accessors
					if(obj[this._obj].properties[prop].value != undefined) {
						obj[prop] = obj[this._obj].properties[prop].value;
					}
					delete obj[this._obj].properties[prop];
				}
				
				obj[this._obj].setters--;
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
		
		if(!obj[this._obj].attributes[attr]) {
			obj[this._obj].disconnect();
			obj[this._obj].attributes[attr] = [];
			obj[this._obj].reconnect();
		}
		else {
			for(var a of obj[this._obj].attributes[attr]) {
				if(compareFunction(a.handler, handler) && capture == a.capture && iterateAll == a.iterateAll) { return true; }
			}
		}
		
		obj[this._obj].attributes[attr].push({ handler: handler, capture: capture, iterateAll: iterateAll });
		obj[this._obj].setters++;
		return true;
	},
	
	removeAttributeWatcher: function(obj, attr, handler, capture, iterateAll) {
		if(!obj || !obj[this._obj] || !obj[this._obj].attributes[attr]) { return false; }
		capture = (capture) ? true : false;
		iterateAll = (capture || iterateAll) ? true : false;
		
		for(var i=0; i<obj[this._obj].attributes[attr].length; i++) {
			if(compareFunction(obj[this._obj].attributes[attr][i].handler, handler)
			&& capture == obj[this._obj].attributes[attr][i].capture
			&& iterateAll == obj[this._obj].attributes[attr][i].iterateAll) {
				obj[this._obj].attributes[attr].splice(i, 1);
				if(obj[this._obj].attributes[attr].length == 0) {
					obj[this._obj].disconnect();
					delete obj[this._obj].attributes[attr];
					obj[this._obj].reconnect();
				}
				
				obj[this._obj].setters--;
				this.unsetWatchers(obj);
				return true;
			}
		}
		
		return false;
	},
	
	setWatchers: function(obj) {
		if(!obj || typeof(obj) != 'object') { return false; }
		if(obj[this._obj]) { return true; }
		
		obj[this._obj] = {
			setters: 0,
			properties: {}
		};
		
		if(!obj.ownerDocument) { return true; }
		
		obj[this._obj].attributes = {};
		obj[this._obj].mutations = [];
		obj[this._obj].scheduler = null;
		obj[this._obj].reconnect = function() {
			var attrList = [];
			for(var a in this.attributes) {
				attrList.push(a);
			}
			if(attrList.length > 0) {
				var observerProperties = {
					attributes: true,
					attributeOldValue: true,
					attributeFilter: attrList
				};
				this.mutationObserver.observe(obj, observerProperties);
			}
		};
		obj[this._obj].disconnect = function() {
			this.mutationObserver.disconnect();
		};
		obj[this._obj].scheduleWatchers = function(mutations, observer) {
			if(obj[Watchers._obj].schedule) {
				obj[Watchers._obj].schedule.cancel();
				obj[Watchers._obj].schedule = null;
			}
			
			for(var m of mutations) {
				obj[Watchers._obj].mutations.push(m);
			}
			
			// the script could become really heavy if it called the main function everytime (width attribute on sidebar and dragging it for instance)
			// I'm simply following the changes asynchronously; any delays for heavily changed attributes should be handled properly by the actual handlers.
			obj[Watchers._obj].schedule = aSync(obj[Watchers._obj].callAttrWatchers);
		};
		obj[this._obj].callAttrWatchers = function() {
			obj[Watchers._obj].disconnect();
			var muts = obj[Watchers._obj].mutations;
			obj[Watchers._obj].mutations = [];
			
			for(var attr in obj[Watchers._obj].attributes) {
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
					
					for(var a of obj[Watchers._obj].attributes[attr]) {
						if(a.capture) {
							var continueHandlers = true;
							try { continueHandlers = a.handler(obj, attr, oldValue, newValue); }
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
						
						for(var a of obj[Watchers._obj].attributes[attr]) {
							if(!a.capture) {
								if(a.iterateAll) {
									try { a.handler(obj, attr, oldValue, newValue); }
									catch(ex) { Cu.reportError(ex); }
								}
								else if(m == muts.length -1) {
									try { a.handler(obj, attr, firstOldValue, newValue); }
									catch(ex) { Cu.reportError(ex); }
								}
							}
						}
					}
				}
			}
			
			obj[Watchers._obj].reconnect();
		};
		obj[this._obj].mutationObserver = new obj.ownerDocument.defaultView.MutationObserver(obj[this._obj].scheduleWatchers);
		
		return true;
	},
	
	unsetWatchers: function(obj) {
		if(typeof(obj) != 'object' || !obj || !obj[this._obj] || obj[this._obj].setters > 0) { return false; }
		
		obj[this._obj].disconnect();
		delete obj[this._obj];
		return true;
	}
};
