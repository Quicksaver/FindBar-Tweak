var EXPORTED_SYMBOLS = ["setWatchers", "hasAncestor", "hideIt", "listenerAid", "timerAid", "prefAid"];

// Checks if aNode decends from aParent
hasAncestor = function(aNode, aParent, aWindow) {
	if(!aNode || !aParent) { return false; };
	
	if(aNode == aParent) { return true; }
	
	var ownDocument = aNode.ownerDocument || aNode.document;
	if(ownDocument && ownDocument == aParent) { return true; }
	if(aNode.compareDocumentPosition && (aNode.compareDocumentPosition(aParent) & aNode.DOCUMENT_POSITION_CONTAINS)) { return true; }
	
	var browsers = aParent.getElementsByTagName('browser');
	for(var i=0; i<browsers.length; i++) {
		if(hasAncestor(aNode, browsers[i].contentDocument, browsers[i].contentWindow)) { return true; }
	}
	
	if(!aWindow) { return false; }
	for(var i=0; i<aWindow.frames.length; i++) {
		if(hasAncestor(aNode, aWindow.frames[i].document, aWindow.frames[i])) { return true; }
	}
	return false;
};

// in theory this should collapse whatever I want
hideIt = function(aNode, show) {
	if(!show) {
		aNode.setAttribute('collapsed', 'true');
	} else {
		aNode.removeAttribute('collapsed');
	}
};

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
		
			this.propertiesWatched[prop].value = this[prop];
			
			if (delete this[prop]) { // can't watch constants
				this.__defineGetter__(prop, function () { return this.propertiesWatched[prop].value; });
				this.__defineSetter__(prop, function (newval) {	
					for(var i=0; i<this.propertiesWatched[prop].handlers.length; i++) {
						try { this.propertiesWatched[prop].handlers[i].call(this, prop, this.propertiesWatched[prop].value, newval); }
						catch(ex) {
							var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
							consoleService.logStringMessage(ex);
						}
					}
					return this.propertiesWatched[prop].value = newval;
				});
			};
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
};

// Object to aid in setting and removing all kind of listeners
listenerAid = {
	handlers: new Array(),
	
	add: function(obj, type, listener, capture) {
		if(obj.addEventListener) {
			for(var i=0; i<this.handlers.length; i++) {
				if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.handlers[i].capture == capture && this.compareListener(this.handlers[i].listener, listener)) {
					return false;
				}
			}
			
			var newHandler = {
				obj: obj,
				type: type,
				listener: listener,
				capture: capture
			};
			this.handlers.push(newHandler);
			var i = this.handlers.length -1;
			this.handlers[i].obj.addEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
		}
		else if(obj.events && obj.events.addListener) {
			for(var i=0; i<this.handlers.length; i++) {
				if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.compareListener(this.handlers[i].listener, listener)) {
					return false;
				}
			}
			
			var newHandler = {
				obj: obj,
				type: type,
				listener: listener
			};
			this.handlers.push(newHandler);
			var i = this.handlers.length -1;
			this.handlers[i].obj.events.addListener(this.handlers[i].type, this.handlers[i].listener);
		}
		
		return true;
	},
	
	remove: function(obj, type, listener, capture) {
		if(obj.removeEventListener) {
			var newHandler = {
				obj: obj,
				type: type,
				listener: listener,
				capture: capture
			};
			for(var i=0; i<this.handlers.length; i++) {
				if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.handlers[i].capture == capture && this.compareListener(this.handlers[i].listener, listener)) {
					this.handlers[i].obj.removeEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
					this.handlers.splice(i, 1);
					return true;
				}
			}
		}
		else if(obj.events && obj.events.removeListener) {
			var newHandler = {
				obj: obj,
				type: type,
				listener: listener
			};
			for(var i=0; i<this.handlers.length; i++) {
				if(this.handlers[i].obj == obj && this.handlers[i].type == type && this.compareListener(this.handlers[i].listener, listener)) {
					this.handlers[i].obj.events.removeListener(this.handlers[i].type, this.handlers[i].listener);
					this.handlers.splice(i, 1);
					return true;
				}
			}
		}
		
		return false;
	},
	
	clean: function() {
		for(var i=0; i<this.handlers.length; i++) {
			if(this.handlers[i].obj) {
				if(this.handlers[i].obj.removeEventListener) {
					this.handlers[i].obj.removeEventListener(this.handlers[i].type, this.handlers[i].listener, this.handlers[i].capture);
				}
				else if(this.handlers[i].obj.events && this.handlers[i].obj.events.removeListener) {
					this.handlers[i].obj.events.removeListener(this.handlers[i].type, this.handlers[i].listener);
				}
			}
		}
		return true;
	},
	
	compareListener: function(a, b) {
		if(a == b || a.toSource() == b.toSource()) {
			return true;
		}
		return false;
	}
};

// Object to aid in setting, initializing and cancelling timers
timerAid = {
	timers: {},
	
	init: function(name, func, delay, type) {
		this.cancel(name);
		
		var type = this.switchType(type);
		var self = this;
		this.timers[name] = {
			object: Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer),
			handler: func
		};
		if(type == Components.interfaces.nsITimer.TYPE_ONE_SHOT) {
			this.timers[name].object.init(function(aSubject, aTopic, aData) {
				self.timers[name].handler(aSubject, aTopic, aData);
				self.cancel(name);
			}, delay, type);
		}
		else {
			this.timers[name].object.init(this.timers[name].handler, delay, type);
		}
	},
	
	cancel: function(name) {
		if(this.timers[name]) {
			this.timers[name].object.cancel();
			this.timers[name] = null;
			return true;
		}
		return false;
	},
	
	getTimer: function(name) {
		if(this.timers[name]) {
			return this.timers[name].object;
		}
		return null;
	},
	
	newTimer: function() {
		var newTimer = {};
		newTimer.timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		newTimer.switchType = this.switchType;
		newTimer.init = function(func, delay, type) {
			var type = this.switchType(type);
			this.timer.init(func, delay, type);
		}
		newTimer.cancel = function() {
			this.timer.cancel();
		}
		return newTimer;
	},
			
	switchType: function(type) {
		switch(type) {
			case 'slack':
				return Components.interfaces.nsITimer.TYPE_REPEATING_SLACK;
				break;
			case 'precise':
				return Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE;
				break;
			case 'precise_skip':
				return Components.interfaces.nsITimer.TYPE_REPEATING_PRECISE_CAN_SKIP;
				break;
			case 'once':
			default:
				return Components.interfaces.nsITimer.TYPE_ONE_SHOT;
				break;
		}
	}
};

prefAid = {
	_prefObjects: {},
	init: function(obj, branch, prefList) {
		var Application = Components.classes["@mozilla.org/fuel/application;1"].getService(Components.interfaces.fuelIApplication);
		this._listenerAid = obj.listenerAid;
		
		for(var i=0; i<prefList.length; i++) {
			this._prefObjects[prefList[i]] = Application.prefs.get('extensions.'+branch+'.' + prefList[i]);
			this._setPref(prefList[i]);
		}
	},
	
	_setPref: function(pref) {
		this.__defineGetter__(pref, function() { return this._prefObjects[pref].value; });
		this.__defineSetter__(pref, function(v) { return this._prefObjects[pref].value = v; });
	},
	
	listen: function(pref, handler) {
		this._listenerAid.add(this._prefObjects[pref], "change", handler);
	},
	
	unlisten: function(pref, handler) {
		this._listenerAid.remove(this._prefObjects[pref], "change", handler);
	},
	
	reset: function(pref) {
		this._prefObjects[pref].reset();
	}
};
