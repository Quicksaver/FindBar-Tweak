Modules.VERSION = '2.3.0';
Modules.UTILS = true;
Modules.BASEUTILS = true;

// Listeners - Object to aid in setting and removing all kinds of event listeners to an object;
// add(obj, type, listener, capture, maxTriggers) - attaches listener to obj
//	obj - (object) to attach the listener to
//	type - (string) event type to listen for
//	listener - (function) method to be called when event is dispatched, by default this will be bound to self
//	(optional) capture - (bool) true or false, defaults to false
//	(optional) maxTriggers -
//		(int) maximum number of times to fire listener,
//		(bool) true is equivalent to (int) 1,
//		defaults to undefined
// remove(obj, type, listener, capture, maxTriggers) - removes listener from obj
//	see add()
this.Listeners = {
	handlers: [],
	inContent: typeof(Scope) != 'undefined',
	
	// Used to be if maxTriggers is set to the boolean false, it acted as a switch to not bind the function to our object,
	// However this is no longer true, not only did I not use it, due to recent modifications to the method, it would be a very complex system to achieve.
	add: function(obj, type, listener, capture, maxTriggers) {
		if(!obj || !obj.addEventListener) { return false; }
		
		if(this.listening(obj, type, capture, listener) !== false) {
			return true;
		}
		
		if(maxTriggers === true) { maxTriggers = 1; }
		
		var newHandler = {
			_obj: obj,
			_objID: obj.id,
			get obj () {
				// failsafe, never happened before but can't hurt
				if(!this._obj && this._objID) {
					this._obj = $(this._objID);
				}
				return this._obj;
			},
			type: type,
			listener: listener,
			capture: capture,
			maxTriggers: (maxTriggers) ? maxTriggers : null,
			triggerCount: 0
		};
		
		this.handlers.push(newHandler);
		var i = this.handlers.length -1;
		
		var handlerMethod = function() {
			if(this.maxTriggers) {
				this.triggerCount++;
				if(this.triggerCount == this.maxTriggers) {
					Listeners.remove(this.obj, this.type, this.listener, this.capture);
				}
			}
			
			this.listener.apply(self, arguments);
		};
		this.handlers[i].handler = handlerMethod.bind(this.handlers[i]);
		
		this.handlers[i].obj.addEventListener(this.handlers[i].type, this.handlers[i].handler, this.handlers[i].capture);
		return true;
	},
	
	remove: function(obj, type, listener, capture, maxTriggers) {
		try {
			if(!obj || !obj.removeEventListener) { return false; }
		}
		catch(ex) {
			handleDeadObject(ex); /* prevents some can't access dead objects */
			return false;
		}
		
		var i = this.listening(obj, type, capture, listener);
		if(i !== false) {
			this.handlers[i].obj.removeEventListener(this.handlers[i].type, this.handlers[i].handler, this.handlers[i].capture);
			this.handlers.splice(i, 1);
			return true;
		}
		return false;
	},
	
	listening: function(obj, type, capture, listener) {
		for(var i=0; i<this.handlers.length; i++) {
			if(this.handlers[i].obj == obj
			&& this.handlers[i].type == type
			&& this.handlers[i].capture == capture
			// we shouldn't use compareFunction in content, as we may have already unloaded and the resource is invalid now to load that module back
			&& ((!this.inContent && compareFunction(this.handlers[i].listener, listener)) || (this.inContent && this.handlers[i].listener == listener))) {
				return i;
			}
		}
		return false;
	},
	
	/* I'm not sure if clean is currently working...
	OmniSidebar - Started browser and opened new window then closed it, it would not remove the switchers listeners, I don't know in which window,
	or it would but it would still leave a ZC somehow. Removing them manually in UNLOADMODULE fixed the ZC but they should have been taken care of here */
	clean: function() {
		while(this.handlers[0]) {
			try {
				if(this.handlers[0].obj && this.handlers[0].obj.removeEventListener) {
					this.handlers[0].obj.removeEventListener(this.handlers[0].type, this.handlers[0].handler, this.handlers[0].capture);
				}
			}
			catch(ex) { handleDeadObject(ex); /* Prevents can't access dead object sometimes */ }
			this.handlers.splice(0, 1);
		}
	}
};

Modules.UNLOADMODULE = function() {
	Listeners.clean();
};
