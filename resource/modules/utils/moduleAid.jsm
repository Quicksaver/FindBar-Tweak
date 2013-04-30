// Many times I can't use 'this' to refer to the owning var's context, so I'm setting 'this' as 'self', 
// I can use 'self' from within functions, timers and listeners easily and to bind those functions to it as well
this.self = this;

// moduleAid - Helper to load subscripts into the context of "this"
// load(aModule, delayed) - loads aModule onto the context of self
//	aModule - (string) can be either module name which loads resource://objPathString/modules/aModule.jsm or full module path
//	(optional) delayed - true loads module 500ms later in an asychronous process, false loads immediatelly synchronously, defaults to false
// unload(aModule) - unloads aModule from the context of self
//	see load()
// loadIf(aModule, anIf, delayed) - conditionally load or unload aModule
//	anIf - true calls load(aModule, delayed), false calls unload(aModule)
//	see load()
// loaded(aModule) - returns (int) with corresponding module index in modules[] if aModule has been loaded, returns (bool) false otherwise
//	see load()
// subscript modules are run in the context of self, all objects should be set using this.whateverObject so they can be deleted on unload, moduleAid optionally expects these:
//	moduleAid.VERSION - (string) module version
//	moduleAid.VARSLIST - (array) list with all the objects the module inserts into the object when loaded, for easy unloading. If not set, it will be automatically compiled.
//	moduleAid.LOADMODULE - (function) to be executed on module loading
//	moduleAid.UNLOADMODULE - (function) to be executed on module unloading
//	moduleAid.LAZY - (bool) vital modules that should be the last ones to be unloaded (like the utils) should have this set to true
this.moduleAid = {
	version: '2.2.2',
	modules: [],
	moduleVars: {},
	
	loadIf: function(aModule, anIf, delayed) {
		if(anIf) {
			return this.load(aModule, delayed);
		} else {
			return !this.unload(aModule);
		}
	},
	
	load: function(aModule, delayed) {
		var path = this.preparePath(aModule);
		if(!path) {
			return false;
		}
		
		if(this.loaded(path) !== false) {
			return true;
		}
		
		try { Services.scriptloader.loadSubScript(path, self); }
		catch(ex) {
			Cu.reportError(ex);
			return false;
		}
		
		var module = {
			name: aModule,
			path: path,
			load: (this.LOADMODULE) ? this.LOADMODULE : null,
			unload: (this.UNLOADMODULE) ? this.UNLOADMODULE : null,
			vars: (this.VARSLIST) ? this.VARSLIST : null,
			version: (this.VERSION) ? this.VERSION : null,
			lazy: (this.LAZY) ? this.LAZY : null,
			loaded: false,
			failed: false
		};
		var i = this.modules.push(module) -1;
		
		delete this.VARSLIST;
		delete this.LOADMODULE;
		delete this.UNLOADMODULE;
		delete this.VERSION;
		delete this.LAZY;
		
		if(!this.modules[i].vars) {
			if(!Globals.moduleCache[aModule]) {
				var tempScope = {
					moduleAid: {},
					$: function(a) { return null; },
					$$: function(a) { return null; }
				};
				try { Services.scriptloader.loadSubScript(path, tempScope); }
				catch(ex) {
					Cu.reportError(ex);
					return false;
				}
				delete tempScope.moduleAid;
				delete tempScope.$;
				delete tempScope.$$;
				
				var scopeVars = [];
				for(var v in tempScope) {
					scopeVars.push(v);
				}
				Globals.moduleCache[aModule] = { vars: scopeVars };
			}
			this.modules[i].vars = Globals.moduleCache[aModule].vars;
		}
		
		try { this.createVars(this.modules[i].vars); }
		catch(ex) {
			Cu.reportError(ex);
			this.unload(aModule, true, true);
			return false;
		}
		
		if(this.modules[i].load) {
			if(!delayed) {
				try { this.modules[i].load(); }
				catch(ex) {
					Cu.reportError(ex);
					this.unload(aModule, true);
					return false;
				}
				this.modules[i].loaded = true;
			} else {
				this.modules[i].aSync = aSync(function() {
					if(typeof(moduleAid) == 'undefined') { return; } // when disabling the add-on before it's had time to perform the load call
					
					try {
						moduleAid.modules[i].load();
					}
					catch(ex) {
						Cu.reportError(ex);
						moduleAid.unload(aModule, true);
						return;
					}
					delete moduleAid.modules[i].aSync;
					moduleAid.modules[i].loaded = true; 
				}, 250);
			}
		}
		else {
			this.modules[i].loaded = true;
		}
		
		return true;
	},
	
	unload: function(aModule, force, justVars) {
		var path = this.preparePath(aModule);
		if(!path) { return true; }
		
		var i = this.loaded(aModule);
		if(i === false) { return true; }
		
		if(!justVars && this.modules[i].unload && (this.modules[i].loaded || force)) {
			try { this.modules[i].unload(); }
			catch(ex) {
				if(!force) { Cu.reportError(ex); }
				Cu.reportError('Failed to load module '+aModule);
				this.modules[i].failed = true;
				return false;
			}
		}
		
		try { this.deleteVars(this.modules[i].vars); }
		catch(ex) {
			if(!force) { Cu.reportError(ex); }
			Cu.reportError('Failed to load module '+aModule);
			this.modules[i].failed = true;
			return false;
		}
		
		this.modules.splice(i, 1);
		return true;
	},
	
	clean: function() {
		// We can't unload modules in i++ mode for two reasons:
		// One: dependencies, some modules require others to run, so by unloading in the inverse order they were loaded we are assuring dependencies are maintained
		// Two: creates endless loops when unloading a module failed, it would just keep trying to unload that module
		// We also need to unload main modules before lazy (utils) modules.
		var i = moduleAid.modules.length -1;
		while(i > 0) {
			if(!moduleAid.modules[i].lazy) {
				moduleAid.unload(moduleAid.modules[i].name);
			}
			i--;
		}
		
		var i = moduleAid.modules.length -1;
		while(i > 0) {
			moduleAid.unload(moduleAid.modules[i].name);
			i--;
		}
	},
	
	loaded: function(aModule) {
		for(var i = 0; i < this.modules.length; i++) {
			if(this.modules[i].path == aModule || this.modules[i].name == aModule) {
				return i;
			}
		}
		return false;
	},
	
	createVars: function(aList) {
		if(!Array.isArray(aList)) { return; }
		
		for(var i=0; i<aList.length; i++) {
			if(this.moduleVars[aList[i]]) {
				this.moduleVars[aList[i]]++;
			} else {
				this.moduleVars[aList[i]] = 1;
			}
		}
	},
	
	deleteVars: function(aList) {
		if(!Array.isArray(aList)) { return; }
		
		for(var o = 0; o < aList.length; o++) {
			if(this.moduleVars[aList[o]]) {
				this.moduleVars[aList[o]]--;
				if(this.moduleVars[aList[o]] == 0) {
					delete self[aList[o]];
					delete this.moduleVars[aList[o]];
				}
			}
		}
	},
	
	preparePath: function(aModule) {
		if(typeof(aModule) != 'string') { return null; }
		if(aModule.indexOf("resource://") === 0) { return aModule; }
		return "resource://"+objPathString+"/modules/"+aModule+".jsm";
	}
};

Globals.moduleCache = {};
