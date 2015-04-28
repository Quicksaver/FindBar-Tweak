// Many times I can't use 'this' to refer to the owning var's context, so I'm setting 'this' as 'self', 
// I can use 'self' from within functions, timers and listeners easily and to bind those functions to it as well
this.self = this;

// Modules - Helper to load subscripts into the context of "this"
// load(aModule, delayed) - loads aModule onto the context of self
//	aModule - (string) can be either module name which loads resource://objPathString/modules/aModule.jsm or full module path
//	(optional) delayed -	true loads module 250ms later in an asychronous process, false loads immediatelly synchronously, defaults to false
//				if instead, a gBrowserInit object is provided, the module load will wait until the window's delayed load notification, or load immediately if that's
//				already happened.
// unload(aModule) - unloads aModule from the context of self
//	see load()
// loadIf(aModule, anIf, delayed) - conditionally load or unload aModule
//	anIf - true calls load(aModule, delayed), false calls unload(aModule)
//	see load()
// loaded(aModule) - returns (int) with corresponding module index in modules[] if aModule has been loaded, returns (bool) false otherwise
//	see load()
// subscript modules are run in the context of self, all objects should be set using this.whateverObject so they can be deleted on unload, Modules optionally expects these:
//	Modules.VERSION - (string) module version
//	Modules.VARSLIST - (array) list with all the objects the module inserts into the object when loaded, for easy unloading. If not set, it will be automatically compiled.
//	Modules.LOADMODULE - (function) to be executed on module loading
//	Modules.UNLOADMODULE - (function) to be executed on module unloading
//	Modules.UTILS - (bool) vital modules that should be the last ones to be unloaded (like the utils) should have this set to true; should only be used in backbone modules
//	Modules.BASEUTILS - 	(bool) some modules may depend on others even on unload, this should be set on modules that don't depend on any others,
//				so that they only unload on the very end; like above, should only be used in backbone modules
//	Modules.CLEAN - (bool) if false, this module won't be removed by clean(); defaults to true
this.Modules = {
	version: '2.5.0',
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
			utils: (this.UTILS) ? this.UTILS : false,
			baseutils: (this.BASEUTILS) ? this.BASEUTILS : false,
			clean: (this.CLEAN !== undefined) ? this.CLEAN : true,
			loaded: false,
			failed: false
		};
		var i = this.modules.push(module) -1;
		
		delete this.VARSLIST;
		delete this.LOADMODULE;
		delete this.UNLOADMODULE;
		delete this.VERSION;
		delete this.UTILS;
		delete this.BASEUTILS;
		delete this.CLEAN;
		
		if(!this.modules[i].vars) {
			if(!Globals.moduleCache[aModule]) {
				var tempScope = {
					Modules: {},
					$: function(a) { return null; },
					$$: function(a) { return null; }
				};
				try { Services.scriptloader.loadSubScript(path, tempScope); }
				catch(ex) {
					Cu.reportError(ex);
					return false;
				}
				delete tempScope.Modules;
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
			if(!delayed || delayed.delayedStartupFinished) {
				try { this.modules[i].load(); }
				catch(ex) {
					Cu.reportError(ex);
					this.unload(aModule, true);
					return false;
				}
				this.modules[i].loaded = true;
			} else {
				this.modules[i]._aSync = () => {
					if(typeof(Modules) == 'undefined') { return; } // when disabling the add-on before it's had time to perform the load call
					
					try { this.modules[i].load(); }
					catch(ex) {
						Cu.reportError(ex);
						this.unload(aModule, true);
						return;
					}
					delete this.modules[i]._aSync;
					delete this.modules[i].aSync;
					this.modules[i].loaded = true; 
				};
				
				// if we're delaying a load in a browser window, we should wait for it to finish the initial painting
				if(typeof(delayed) == 'object' && "delayedStartupFinished" in delayed) {
					this.modules[i].aSync = Observers.add((aSubject, aTopic) => {
						if(aSubject.gBrowserInit == delayed) {
							Observers.remove(this.modules[i].aSync, 'browser-delayed-startup-finished');
							this.modules[i]._aSync();
						}
					}, 'browser-delayed-startup-finished');
				} else {
					this.modules[i].aSync = aSync(this.modules[i]._aSync, 250);
				}
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
		// We also need to unload main modules before utils modules. Other dependencies should resolve themselves in the order the modules are (un)loaded.
		var utils = false;
		var baseutils = false;
		var done = false;
		
		while(!done) {
			var i = Modules.modules.length -1;
			
			while(i >= 0) {
				if(Modules.modules[i].clean
				&& Modules.modules[i].utils == utils
				&& Modules.modules[i].baseutils == baseutils) {
					Modules.unload(Modules.modules[i].name);
				}
				i--;
			}
			
			if(!utils) { utils = true; }
			else if(!baseutils) { baseutils = true; }
			else { done = true; }
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
