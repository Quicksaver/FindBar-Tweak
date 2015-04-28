Modules.VERSION = '2.2.0';
Modules.UTILS = true;
Modules.BASEUTILS = true;

// Timers - Object to aid in setting, initializing and cancelling timers
// init(aName, aFunc, aDelay, aType) - initializes a named timer to be kept in the timers object
//	aName - (string) to name the timer
//	aFunc - (function) to be fired by the timer, it will be bound to self
//	aDelay - (int) msec to set the timer
//	(optional) aType -
//		(string) 'slack' fires every aDelay msec and waits for the last aFunc call to finish before restarting the timer,
//		(string) 'precise' fires every aDelay msec,
//		(string) 'precise_skip' not really sure what this one does,
//		(string) 'once' fires only once,
//		defaults to once
// create(aFunc, aDelay, aType, toBind) - creates a timer object and returns it
//	toBind - (object) to bind aFunc to, if unset aFunc will be bound to self
//	see init()
this.Timers = {
	timers: {},
	
	init: function(aName, aFunc, aDelay, aType) {
		this.cancel(aName);
		
		var type = this._switchType(aType);
		this.timers[aName] = {
			timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
			handler: aFunc
		};
		this.timers[aName].timer.init(function(aSubject, aTopic, aData) {
			var handler = Timers.timers[aName].handler;
			if(typeof(Timers) != 'undefined' && aSubject.type == Ci.nsITimer.TYPE_ONE_SHOT) {
				Timers.cancel(aName);
			}
			handler.call(self, aSubject, aTopic, aData);
		}, aDelay, type);
		
		this.__defineGetter__(aName, function() { return this.timers[aName]; });
		return this.timers[aName];
	},
	
	cancel: function(name) {
		if(this.timers[name]) {
			this.timers[name].timer.cancel();
			delete this.timers[name];
			delete this[name];
			return true;
		}
		return false;
	},
	
	fire: function(name) {
		if(this.timers[name]) {
			aSync(this.timers[name].handler);
			if(this.timers[name].timer.type == Ci.nsITimer.TYPE_ONE_SHOT) {
				this.cancel(name);
			}
		}
	},
	
	clean: function() {
		for(var timerObj in this.timers) {
			this.cancel(timerObj);
		}
	},
	
	create: function(aFunc, aDelay, aType, toBind) {
		var type = this._switchType(aType);
		var newTimer = {
			timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
			handler: (toBind) ? aFunc.bind(toBind) : aFunc.bind(self),
			cancel: function() {
				this.timer.cancel();
			}
		};
		newTimer.timer.init(newTimer.handler, aDelay, type);
		return newTimer;
	},
			
	_switchType: function(type) {
		switch(type) {
			case 'slack':
			case Ci.nsITimer.TYPE_REPEATING_SLACK:
				return Ci.nsITimer.TYPE_REPEATING_SLACK;
				break;
			case 'precise':
			case Ci.nsITimer.TYPE_REPEATING_PRECISE:
				return Ci.nsITimer.TYPE_REPEATING_PRECISE;
				break;
			case 'precise_skip':
			case Ci.nsITimer.TYPE_REPEATING_PRECISE_CAN_SKIP:
				return Ci.nsITimer.TYPE_REPEATING_PRECISE_CAN_SKIP;
				break;
			case 'once':
			case Ci.nsITimer.TYPE_ONE_SHOT:
			default:
				return Ci.nsITimer.TYPE_ONE_SHOT;
				break;
		}
		
		return false;
	}
};

Modules.UNLOADMODULE = function() {
	Timers.clean();
};
