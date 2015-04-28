Modules.VERSION = '2.3.0';
Modules.UTILS = true;
Modules.BASEUTILS = true;

// Styles - handle loading and unloading of stylesheets in a quick and easy way
// load(aName, aPath, isData, aType) - loads aPath css stylesheet with type AGENT_SHEET; if re-loading a stylesheet with the same name, it will only be re-loaded if aPath has changed
//	aName - (string) to name the stylesheet object in sheets[]
//	aPath -
//		(string) absolute chrome:// path to the stylesheet to be loaded
//		(string) name of the .css file to be loaded from chrome://objPathString/skin/aPath.css
//		(string) css declarations
//	(optional) isData - 
//		true treats aPath as css declarations and appends "data:text/css," if necessary
//		defaults to false
//	(optional) aType -
//		(string) one of 'agent', 'user', or 'author'; or (int) one of Services.stylesheet.***_SHEET constants;
//		for details see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIStyleSheetService
//		defaults to Services.stylesheet.AUTHOR_SHEET, which is takes effect after the others in the CSS cascade
// unload(aName, aPath, isData, aType) - unloads aPath css stylesheet
//	(optional) aPath
//	see load()
// loadIf(aName, aPath, isData, anIf, aType) - conditionally load or unload a stylesheet
//	anIf - true calls load(), false calls unload()
//	see load()
// loaded(aName, aPath) - returns (int) with corresponding sheet index in sheets[] if aName or aPath has been loaded, returns (bool) false otherwise
//	see unload()
this.Styles = {
	sheets: [],
	
	load: function(aName, aPath, isData, aType) {
		var path = this.convert(aPath, isData);
		var type = this._switchType(aType);
		
		var alreadyLoaded = this.loaded(aName, path);
		if(alreadyLoaded !== false) {
			if(this.sheets[alreadyLoaded].name == aName) {
				if(this.sheets[alreadyLoaded].path == path && this.sheets[alreadyLoaded].type == type) {
					return false;
				}
				this.unload(aName);
			}
		}
		
		var i = this.sheets.push({
			name: aName,
			path: path,
			type: type,
			uri: Services.io.newURI(path, null, null)
		}) -1;
		if(!Services.stylesheet.sheetRegistered(this.sheets[i].uri, type)) {
			try { Services.stylesheet.loadAndRegisterSheet(this.sheets[i].uri, type); }
			catch(ex) { Cu.reportError(ex); }
		}
		return true;
	},
	
	unload: function(aName, aPath, isData, aType) {
		if(typeof(aName) != 'string') {
			for(var a = 0; a < aName.length; a++) {
				this.unload(aName[a]);
			}
			return true;
		};
		
		var path = this.convert(aPath, isData);
		var type = this._switchType(aType);
		var i = this.loaded(aName, path);
		if(i !== false) {
			var uri = this.sheets[i].uri;
			this.sheets.splice(i, 1);
			for(var s = 0; s < this.sheets.length; s++) {
				if(this.sheets[s].path == path && this.sheets[s].type == type) {
					return true;
				}
			}
			if(Services.stylesheet.sheetRegistered(uri, type)) {
				try { Services.stylesheet.unregisterSheet(uri, type); }
				catch(ex) { Cu.reportError(ex); }
			}
			return true;
		}
		return false;
	},
	
	loadIf: function(aName, aPath, isData, anIf, aType) {
		if(anIf) {
			this.load(aName, aPath, isData, aType);
		} else {
			this.unload(aName, aPath, isData, aType);
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
	},
			
	_switchType: function(type) {
		switch(type) {
			case 'agent':
			case Services.stylesheet.AGENT_SHEET:
				return Services.stylesheet.AGENT_SHEET;
				break;
			case 'user':
			case Services.stylesheet.USER_SHEET:
				return Services.stylesheet.USER_SHEET;
				break;
			case 'author':
			case Services.stylesheet.AUTHOR_SHEET:
			default:
				return Services.stylesheet.AUTHOR_SHEET;
				break;
		}
		
		return false;
	}
};
