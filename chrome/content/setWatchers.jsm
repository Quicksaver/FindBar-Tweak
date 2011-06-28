var EXPORTED_SYMBOLS = ["setWatchers"];

// This acts as a replacement for the event DOM Attribute Modified, works for both attributes and object properties
setWatchers = function(obj) {
	// Properties part, works by replacing the get and set accessor methods of a property with custom ones
	if(	typeof(obj) != 'object' 
		|| typeof(obj.addPropertyWatcher) != 'undefined'
		|| typeof(obj.removePropertyWatcher) != 'undefined'
		|| typeof(obj.propertiesWatched) != 'undefined') 
	{ 
		return; 
	}
	
	// Monitors 'prop' property of object, calling a handler function 'handler' when it is changed
	obj.addPropertyWatcher = function (prop, handler) {
		if(typeof(this.propertiesWatched[prop]) == 'undefined') {
			this.propertiesWatched[prop] = {};
			this.propertiesWatched[prop].handlers = new Array();
			this.propertiesWatched[prop].handlers.push(handler);
		
			this.propertiesWatched[prop].value = this[prop],
			getter = function () {
				return this.propertiesWatched[prop].value;
			},
			setter = function (newval) {
				for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
					try { this.propertiesWatched[prop].handlers[i].call(this, prop, this.propertiesWatched[prop].value, newval); }
					catch(ex) {
						var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
						consoleService.logStringMessage(ex);
					}
				}
				return this.propertiesWatched[prop].value = newval;
			};
			if (delete this[prop]) { // can't watch constants
				Object.defineProperty(this, prop, { get: getter, set: setter, enumerable: true, configurable: true });
			}
		}
		else {
			var add = true;
			for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
				// Have to compare using toSource(), it won't work if I just compare handlers for some reason
				if(this.propertiesWatched[prop].handlers[i].toSource() == handler.toSource()) {
					add = false;
				}
			}
			if(add) {
				this.propertiesWatched[prop].handlers.push(handler);
			}
		}
	};
	
	// Removes handler 'handler' for property 'prop'
	obj.removePropertyWatcher = function (prop, handler) {
		if(typeof(this.propertiesWatched[prop]) == 'undefined') { return; }
		
		for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
			if(this.propertiesWatched[prop].handlers[i].toSource() == handler.toSource()) {
				this.propertiesWatched[prop].handlers.splice(i, 1);
			}
		}
		
		if(this.propertiesWatched[prop].handlers.length == 0) {
			this.propertiesWatched[prop].value = this[prop];
			delete this[prop]; // remove accessors
			this[prop] = this.propertiesWatched[prop].value;
			delete this.propertiesWatched[prop];
		}
	};
	
	// This will hold the current value of all properties being monitored, as well as a list of their handlers to be called
	obj.propertiesWatched = {};
	
	// Attributes part, works by replacing the actual attribute native functions with custom ones (while still using the native ones)
	if(	typeof(obj.callAttributeWatchers) != 'undefined'
		|| typeof(obj.addAttributeWatcher) != 'undefined'
		|| typeof(obj.removeAttributeWatcher) != 'undefined'
		|| typeof(obj.attributesWatched) != 'undefined'
		|| typeof(obj.setAttribute) != 'function'
		|| typeof(obj.setAttributeNS) != 'function'
		|| typeof(obj.setAttributeNode) != 'function'
		|| typeof(obj.setAttributeNodeNS) != 'function'
		|| typeof(obj.removeAttribute) != 'function'
		|| typeof(obj.removeAttributeNS) != 'function'
		|| typeof(obj.removeAttributeNode) != 'function'
		|| typeof(obj.attributes.setNamedItem) != 'function'
		|| typeof(obj.attributes.setNamedItemNS) != 'function'
		|| typeof(obj.attributes.removeNamedItem) != 'function'
		|| typeof(obj.attributes.removeNamedItemNS) != 'function')
	{
		return;
	}
	
	// Monitors 'attr' attribute of element, calling a handler function 'handler' when it is set or removed
	obj.addAttributeWatcher = function (attr, handler) {
		if(typeof(this.attributesWatched[attr]) == 'undefined') {
			this.attributesWatched[attr] = {};
			this.attributesWatched[attr].handlers = new Array();
			this.attributesWatched[attr].handlers.push(handler);
		
			this.attributesWatched[attr].value = this.getAttribute(attr);
		}
		else {
			var add = true;
			for(var i=0; i<this.attributesWatched[attr].handlers.length; i++) {
				if(this.attributesWatched[attr].handlers[i].toSource() == handler.toSource()) {
					add = false;
				}
			}
			if(add) {
				this.attributesWatched[attr].handlers.push(handler);
			}
		}
	};
	
	// Removes handler function 'handler' for attribute 'attr'
	obj.removeAttributeWatcher = function (attr, handler) {
		if(typeof(this.attributesWatched[attr]) == 'undefined') { return; }
		
		for(var i=0; i<this.attributesWatched[attr].handlers.length; i++) {
			if(this.attributesWatched[attr].handlers[i].toSource() == handler.toSource()) {
				this.attributesWatched[attr].handlers.splice(i, 1);
			}
		}
	};
	
	// This will hold the current value of all attributes being monitored, as well as a list of their handlers to be called
	obj.attributesWatched = {};
	
	// Calls handler functions for attribute 'attr'
	obj.callAttributeWatchers = function (el, attr, newval) {
		if(typeof(el.attributesWatched[attr]) == 'undefined') { return; }
		
		for(var i=0; i<el.attributesWatched[attr].handlers.length; i++) {
			try { el.attributesWatched[attr].handlers[i].call(el, attr, el.attributesWatched[attr].value, newval); }
			catch(ex) {
				var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
				consoleService.logStringMessage(ex);
			}
		}
		
		el.attributesWatched[attr].value = newval;
	};
	
	// Store all native functions as '_function' and set custom ones to handle attribute changes
	obj._setAttribute = obj.setAttribute;
	obj._setAttributeNS = obj.setAttributeNS;
	obj._setAttributeNode = obj.setAttributeNode;
	obj._setAttributeNodeNS = obj.setAttributeNodeNS;
	obj._removeAttribute = obj.removeAttribute;
	obj._removeAttributeNS = obj.removeAttributeNS;
	obj._removeAttributeNode = obj.removeAttributeNode;
	obj.attributes._setNamedItem = obj.attributes.setNamedItem;
	obj.attributes._setNamedItemNS = obj.attributes.setNamedItemNS;
	obj.attributes._removeNamedItem = obj.attributes.removeNamedItem;
	obj.attributes._removeNamedItemNS = obj.attributes.removeNamedItemNS;
	
	obj.setAttribute = function(attr, value) {
		this._setAttribute(attr, value);
		this.callAttributeWatchers(this, attr, value);
	};
	obj.setAttributeNS = function(namespace, attr, value) {
		this._setAttributeNS(namespace, attr, value);
		this.callAttributeWatchers(this, attr, value);
	};
	obj.setAttributeNode = function(attr) {
		var ret = this._setAttributeNode(attr);
		this.callAttributeWatchers(this, attr.name, attr.value);
		return ret;
	};
	obj.setAttributeNodeNS = function(attr) {
		var ret = this._setAttributeNodeNS(attr);
		this.callAttributeWatchers(this, attr.name, attr.value);
		return ret;
	};
	obj.removeAttribute = function(attr) {
		var callWatchers = (this.hasAttribute(attr)) ? true : false;
		this._removeAttribute(attr);
		if(callWatchers) {
			this.callAttributeWatchers(this, attr, null);
		}
	};
	obj.removeAttributeNS = function(namespace, attr) {
		var callWatchers = (this.hasAttribute(attr)) ? true : false;
		this._removeAttributeNS(namespace, attr);
		if(callWatchers) {
			this.callAttributeWatchers(this, attr, null);
		}
	};
	obj.removeAttributeNode = function(attr) {
		var callWatchers = (this.hasAttribute(attr.name)) ? true : false;
		var ret = this._removeAttributeNode(attr);
		if(callWatchers) {
			this.callAttributeWatchers(this, attr.name, null);
		}
		return ret;
	};
	obj.attributes.setNamedItem = function(attr) {
		var ret = this.attributes._setNamedItem(attr);
		this.callAttributeWatchers(this, attr.name, attr.value);
		return ret;
	};
	obj.attributes.setNamedItemNS = function(namespace, attr) {
		var ret = this.attributes._setNamedItemNS(namespace, attr);
		this.callAttributeWatchers(this, attr.name, attr.value);
		return ret;
	};
	obj.attributes.removeNamedItem = function(attr) {
		var callWatchers = (this.hasAttribute(attr)) ? true : false;
		var ret = this.attributes._removeNamedItem(attr);
		this.callAttributeWatchers(this, attr, null);
		return ret;
	};
	obj.attributes.removeNamedItemNS = function(namespace, attr) {
		var callWatchers = (this.hasAttribute(attr)) ? true : false;
		var ret = this.attributes._removeNamedItemNS(namespace, attr);
		this.callAttributeWatchers(this, attr, null);
		return ret;
	};
}