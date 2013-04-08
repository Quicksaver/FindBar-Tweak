moduleAid.VERSION = '2.0.2';
moduleAid.LAZY = true;

// styleAid - handle loading and unloading of stylesheets in a quick and easy way
// load(aName, aPath, isData) - loads aPath css stylesheet with type AGENT_SHEET
//	aName - (string) to name the stylesheet object in sheets[]
//	aPath -
//		(string) absolute chrome:// path to the stylesheet to be loaded
//		(string) name of the .css file to be loaded from chrome://objPathString/skin/aPath.css
//		(string) css declarations
//	(optional) isData - 
//		true treats aPath as css declarations and appends "data:text/css," if necessary
//		defaults to false
// unload(aName, aPath, isData) - unloads aPath css stylesheet
//	(optional) aPath
//	see load()
// loadIf(aName, aPath, isData, anIf) - conditionally load or unload a stylesheet
//	anIf - true calls load(), false calls unload()
//	see load()
// loaded(aName, aPath) - returns (int) with corresponding sheet index in sheets[] if aName or aPath has been loaded, returns (bool) false otherwise
//	see unload()
// Note: Firefox 16 implements a bunch of unprefixed declarations, in particular gradients which I use a lot
this.styleAid = {
	sheets: [],
	
	load: function(aName, aPath, isData) {
		var path = this.convert(aPath, isData);
		
		var alreadyLoaded = this.loaded(aName, path);
		if(alreadyLoaded !== false) {
			if(this.sheets[alreadyLoaded].name == aName) {
				if(this.sheets[alreadyLoaded].path == path) {
					return false;
				}
				this.unload(aName);
			}
		}
		
		var i = this.sheets.push({
			name: aName,
			path: path,
			uri: Services.io.newURI(path, null, null)
		}) -1;
		if(!Services.stylesheet.sheetRegistered(this.sheets[i].uri, Services.stylesheet.AGENT_SHEET)) {
			try { Services.stylesheet.loadAndRegisterSheet(this.sheets[i].uri, Services.stylesheet.AGENT_SHEET); }
			catch(ex) { Cu.reportError(ex); }
		}
		return true;
	},
	
	unload: function(aName, aPath, isData) {
		if(typeof(aName) != 'string') {
			for(var a = 0; a < aName.length; a++) {
				this.unload(aName[a]);
			}
			return true;
		};
		
		var path = this.convert(aPath, isData);
		var i = this.loaded(aName, path);
		if(i !== false) {
			var uri = this.sheets[i].uri;
			this.sheets.splice(i, 1);
			for(var s = 0; s < this.sheets.length; s++) {
				if(this.sheets[s].path == path) {
					return true;
				}
			}
			if(Services.stylesheet.sheetRegistered(uri, Services.stylesheet.AGENT_SHEET)) {
				try { Services.stylesheet.unregisterSheet(uri, Services.stylesheet.AGENT_SHEET); }
				catch(ex) { Cu.reportError(ex); }
			}
			return true;
		}
		return false;
	},
	
	loadIf: function(aName, aPath, isData, anIf) {
		if(anIf) {
			this.load(aName, aPath, isData);
		} else {
			this.unload(aName, aPath, isData);
		}
	},
	
	loaded: function(aName, aPath) {
		for(var i = 0; i < this.sheets.length; i++) {
			if(this.sheets[i].name == aName || (aPath && this.sheets[i].path == aPath)) {
				return i;
			}
		}
		return false;
	},
	
	convert: function(aPath, isData) {
		if(!aPath) {
			return aPath;
		}
		
		if(!isData && aPath.indexOf("chrome://") != 0) {
			return "chrome://"+objPathString+"/skin/"+aPath+".css";
		}
		
		if(isData && aPath.indexOf("data:text/css,") != 0) {
			return 'data:text/css,' + encodeURIComponent(aPath);
		}
		
		return aPath;
	}
};
