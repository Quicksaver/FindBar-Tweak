Modules.VERSION = '2.2.1';
Modules.UTILS = true;
Modules.BASEUTILS = true;

// Observers - Helper for adding and removing observers
// add(anObserver, aTopic, ownsWeak) - Create the observer object from a function if that is what is provided and registers it
//	anObserver - (nsIObserver) to be registered, (function) creates a (nsIObserver){ observe: anObserver } and registers it
//	aTopic - (string) notification to be observed by anObserver
//	(optional) ownsWeak - defaults to false, recommended in MDN, have never seen any case where it is true anyway
// remove(anObserver, aTopic) - unregisters anObserver from watching aTopic
//	see add()
// observing(anObserver, aTopic) - returns (int) with corresponding observer index in observers[] if anObserver has been registered for aTopic, returns (bool) false otherwise
//	see add()
// notify(aTopic, aSubject, aData) - notifies observers of a particular topic
//	aTopic - (string) The notification topic
//	(optional) aSubject - (object) usually where the notification originated from, can be (bool) null; if undefined, it is set to self
//	(optional) aData - (object) varies with the notification topic as needed
this.Observers = {
	observers: [],
	hasQuit: false,
	
	createObject: function(anObserver) {
		var retObj = (typeof(anObserver) == 'function') ? { observe: anObserver } : anObserver;
		return retObj;
	},
	
	add: function(anObserver, aTopic, ownsWeak) {
		var observer = this.createObject(anObserver);
		
		if(this.observing(observer, aTopic) !== false) {
			return false;
		}
		
		var i = this.observers.push({ topic: aTopic, observer: observer }) -1;
		Services.obs.addObserver(this.observers[i].observer, aTopic, ownsWeak);
		return this.observers[i];
	},
	
	remove: function(anObserver, aTopic) {
		var observer = this.createObject(anObserver);
		
		var i = this.observing(observer, aTopic);
		if(i !== false) {
			Services.obs.removeObserver(this.observers[i].observer, this.observers[i].topic);
			var ret = this.observers[i];
			this.observers.splice(i, 1);
			return ret;
		}
		return false;
	},
	
	observing: function(anObserver, aTopic) {
		for(var i = 0; i < this.observers.length; i++) {
			if((this.observers[i].observer == anObserver || this.observers[i].observer.observe == anObserver.observe) && this.observers[i].topic == aTopic) {
				return i;
			}
		}
		return false;
	},
	
	// this forces the observers for quit-application to trigger before I remove them
	callQuits: function() {
		if(this.hasQuit) { return false; }
		for(var i = 0; i < this.observers.length; i++) {
			if(this.observers[i].topic == 'quit-application') {
				this.observers[i].observer.observe(null, 'quit-application', null);
			}
		}
		return true;
	},
	
	clean: function() {
		while(this.observers.length) {
			Services.obs.removeObserver(this.observers[0].observer, this.observers[0].topic);
			this.observers.shift();
		}
	},
	
	notify: function(aTopic, aSubject, aData) {
		if(aSubject == undefined) {
			aSubject = self;
		}
		Services.obs.notifyObservers(aSubject, aTopic, aData);
	}
};

Modules.LOADMODULE = function() {
	// This is so the observers aren't called twice on quitting sometimes
	Observers.add(function() { Observers.hasQuit = true; }, 'quit-application');
	
	observerLOADED = true;
};

Modules.UNLOADMODULE = function() {
	Observers.clean();
};
