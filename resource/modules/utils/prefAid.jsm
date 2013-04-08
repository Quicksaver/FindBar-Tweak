moduleAid.VERSION = '2.0.1';
moduleAid.LAZY = true;

// prefAid - Object to contain and manage all preferences related to the add-on (and others if necessary)
// setDefaults(prefList, branch, trunk) - sets the add-on's preferences default values
//	prefList - (object) { prefName: defaultValue }, looks for 'trunk.branch.prefName'
//	(optional) branch - (string) defaults to objPathString
//	(optional) trunk - (string) defaults to 'extensions'
// listen(pref, handler) - add handler as a change event listener to pref
//	pref - (string) name of preference to append handler to
//	handler - (function) to be fired on change event
// unlisten(pref, handler) - remove handler as a change event listener of pref
//	see listen()
// listening(pref, handler) - returns (int) with corresponding listener index in _onChange[] if handler is registered as pref listener, returns (bool) false otherwise
//	see listen()
// reset(pref) - resets pref to default value
//	see listen()
this.prefAid = {
	_prefObjects: {},
	_onChange: {},
	length: 0,
	
	setDefaults: function(prefList, branch, trunk) {
		if(!branch) {
			branch = objPathString;
		}
		if(!trunk) {
			trunk = 'extensions';
		}
		
		var readyList = [];
		
		var defaultBranch = Services.prefs.getDefaultBranch(trunk+'.'+branch+'.');
		for(var pref in prefList) {
			if(typeof(prefList[pref]) == 'string') {
				defaultBranch.setCharPref(pref, prefList[pref]);
			} else if(typeof(prefList[pref]) == 'boolean') {
				defaultBranch.setBoolPref(pref, prefList[pref]);
			} else if(typeof(prefList[pref]) == 'number') {
				defaultBranch.setIntPref(pref, prefList[pref]);
			}
			
			readyList.push(pref);
		}
		
		this.ready(readyList, branch, trunk);
	},
	
	ready: function(prefList, branch, trunk) {
		if(!branch) {
			branch = objPathString;
		}
		
		if(typeof(prefList) == 'string') {
			prefList = [prefList];
		}
		
		for(var i=0; i<prefList.length; i++) {
			if(!this._prefObjects[prefList[i]]) {
				this._setPref(prefList[i], branch, trunk);
			}
		}
	},
	
	_setPref: function(pref, branch, trunk) {
		this._prefObjects[pref] = Services.fuel.prefs.get(trunk+'.'+branch+'.'+pref);
		this._onChange[pref] = [];
		this.__defineGetter__(pref, function() { return this._prefObjects[pref].value; });
		this.__defineSetter__(pref, function(v) { return this._prefObjects[pref].value = v; });
		this.length++;
		
		this._prefObjects[pref].events.addListener("change", this.prefChanged);
	},
	
	listen: function(pref, handler) {
		if(this.listening(pref, handler) === false) {
			this._onChange[pref].push(handler);
			return true;
		}
		return false;
	},
	
	unlisten: function(pref, handler) {
		var i = this.listening(pref, handler)
		if(i !== false) {
			this._onChange[pref].splice(i, 1);
			return true;
		}
		return false;
	},
	
	listening: function(pref, handler) {
		for(var i = 0; i < this._onChange[pref].length; i++) {
			if(compareFunction(this._onChange[pref][i], handler, true)) {
				return i;
			}
		}
		return false;
	},
	
	reset: function(pref) {
		this._prefObjects[pref].reset();
	},
	
	prefChanged: function(e) {
		var pref = e.data.substr(e.data.indexOf('.', e.data.indexOf('.')+1) +1);
		for(var i = 0; i < prefAid._onChange[pref].length; i++) {
			prefAid._onChange[pref][i]();
		}
	},
	
	clean: function() {
		for(var pref in this._prefObjects) {
			this._prefObjects[pref].events.removeListener("change", this.prefChanged);
		}
	}
};

moduleAid.UNLOADMODULE = function() {
	prefAid.clean();
};
