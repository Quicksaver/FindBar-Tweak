Modules.VERSION = '1.2.6';

this.uiBackup = {};

this.handleUIHighlightBackground = function() {
	uiBackup.textHighlightBackground = Prefs.textHighlightBackground;
	
	// This triggers a re-color
	var original = Prefs.highlightColor;
	if(Prefs.textHighlightBackground) {
		Prefs.highlightColor = Prefs.textHighlightBackground;
	} else {
		Prefs.reset('highlightColor');
	}
	// Make sure we trigger a re-color when it's not actually been changed
	if(original == Prefs.highlightColor) {
		changeHighlightColor();
	}
};

// This won't trigger a re-color
this.handleUIHighlightForeground = function() {
	uiBackup.textHighlightForeground = Prefs.textHighlightForeground;
};

this.handleUISelectBackground = function() {
	uiBackup.textSelectBackgroundAttention = Prefs.textSelectBackgroundAttention;
	
	// This triggers a re-color
	var original = Prefs.selectColor;
	if(Prefs.textSelectBackgroundAttention) {
		Prefs.selectColor = Prefs.textSelectBackgroundAttention;
	} else {
		Prefs.reset('selectColor');
	}
	// Make sure we trigger a re-color when it's not actually been changed
	if(original == Prefs.selectColor) {
		changeSelectColor();
	}
};

// This won't trigger a re-color
this.handleUISelectForeground = function() {
	uiBackup.textSelectForeground = Prefs.textSelectForeground;
};

this.getRGBfromString = function(m) {
	if(m[1].length === 6) { // 6-char notation
		var rgb = {
			r: parseInt(m[1].substr(0,2),16),
			g: parseInt(m[1].substr(2,2),16),
			b: parseInt(m[1].substr(4,2),16)
		};
	} else { // 3-char notation
		var rgb = {
			r: parseInt(m[1].charAt(0)+m[1].charAt(0),16),
			g: parseInt(m[1].charAt(1)+m[1].charAt(1),16),
			b: parseInt(m[1].charAt(2)+m[1].charAt(2),16)
		};
	}
	return rgb;
};

this.darkBackgroundRGB = function(rgb) {
	return (0.213 *rgb.r /255 + 0.715 *rgb.g /255 + 0.072 *rgb.b /255 < 0.7);
};

this.changeHighlightColor = function() {
	var m = Prefs.highlightColor.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
	if(!m) { return; }
	var rgb = getRGBfromString(m);
	
	// Have to remove the listeners and add them back after, so the backups aren't overwritten with our values
	Prefs.unlisten('textHighlightBackground', handleUIHighlightBackground);
	Prefs.unlisten('textHighlightForeground', handleUIHighlightForeground);
	
	Prefs.textHighlightBackground = Prefs.highlightColor;
	Prefs.textHighlightForeground = (darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000';
	
	Prefs.listen('textHighlightBackground', handleUIHighlightBackground);
	Prefs.listen('textHighlightForeground', handleUIHighlightForeground);
	
	setHighlightColorStyleSheet(rgb);
	
	Observers.notify('ReHighlightAll');
};

this.setHighlightColorStyleSheet = function(rgb) {
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document\n';
	sscode += '	url("chrome://browser/content/browser.xul"),\n';
	sscode += '	url("chrome://global/content/viewSource.xul"),\n';
	sscode += '	url("chrome://global/content/viewPartialSource.xul"),\n';
	sscode += '	url("chrome://findbartweak/content/findInTabsFull.xul") {\n';
	sscode += '		.findInTabs-list label[highlight]:not([current]):not(:hover) {\n';
	sscode += '			background-color: '+Prefs.highlightColor+';\n';
	sscode += '			color: '+((darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000')+';\n';
	sscode += '		}\n';
	sscode += '		vbox[anonid="findGrid"] vbox[highlight]:not([current]):not([hover]) {\n';
	sscode += '			background-color: '+Prefs.highlightColor+';\n';
	sscode += '		}\n';
	sscode += '}';
	
	Styles.load('highlightColorStyleSheet', sscode, true);
	
	// For PDF.JS
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.w3.org/1999/xhtml);\n';
	sscode += 'body #outerContainer #mainContainer #viewerContainer .textLayer .highlight:not(.selected) { background-color: rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.3) !important; }\n';
	
	// For grids in frames
	sscode += 'div[ownedByFindBarTweak][anonid="gridBox"] div[anonid="findGrid"] div[highlight]:not([current]):not([hover]) {\n';
	sscode += '	background-color: '+Prefs.highlightColor+';\n';
	sscode += '}\n';
	
	Styles.load('otherHighlightColorStyleSheet', sscode, true);
};

this.changeSelectColor = function() {
	var m = Prefs.selectColor.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
	if(!m) { return; }
	var rgb = getRGBfromString(m);
	
	// Have to remove the listeners and add them back after, so the backups aren't overwritten with our values
	Prefs.unlisten('textSelectBackgroundAttention', handleUISelectBackground);
	Prefs.unlisten('textSelectForeground', handleUISelectForeground);
	
	Prefs.textSelectBackgroundAttention = Prefs.selectColor;
	
	if(!Prefs.keepSelectContrast) { Prefs.textSelectForeground = (darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000'; }
	else if(uiBackup.textSelectForeground) { Prefs.textSelectForeground = uiBackup.textSelectForeground; }
	else { Prefs.reset('textSelectForeground'); }
	
	Prefs.listen('textSelectBackgroundAttention', handleUISelectBackground);
	Prefs.listen('textSelectForeground', handleUISelectForeground);
	
	setSelectColorStyleSheet(rgb);
	
	Observers.notify('ReHighlightAll');
};

this.setSelectColorStyleSheet = function(rgb) {
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document\n';
	sscode += '	url("chrome://browser/content/browser.xul"),\n';
	sscode += '	url("chrome://global/content/viewSource.xul"),\n';
	sscode += '	url("chrome://global/content/viewPartialSource.xul"),\n';
	sscode += '	url("chrome://findbartweak/content/findInTabsFull.xul") {\n';
	sscode += '		.findInTabs-list label[highlight][current],\n';
	sscode += '		.findInTabs-list label[highlight]:hover {\n';
	sscode += '			background-color: '+Prefs.selectColor+';\n';
	sscode += '			color: '+((darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000')+';\n';
	sscode += '		}\n';
	sscode += '		.findInTabs-list richlistitem:hover {\n';
	sscode += '			background-color: rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.03);\n';
	sscode += '			box-shadow: inset 0 0 2px 1px rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.2);\n';
	sscode += '		}\n';
	sscode += '		vbox[anonid="findGrid"] vbox[highlight][current],\n';
	sscode += '		vbox[anonid="findGrid"] vbox[highlight][hover] {\n';
	sscode += '			background-color: '+Prefs.selectColor+';\n';
	sscode += '		}\n';
	sscode += '}';
	
	Styles.load('selectColorStyleSheet', sscode, true);
	
	// For PDF.JS
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.w3.org/1999/xhtml);\n';
	sscode += 'body #outerContainer #mainContainer #viewerContainer .textLayer .highlight.selected { background-color: rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.3) !important; }\n';
	
	// For grids in frames
	sscode += 'div[ownedByFindBarTweak][anonid="gridBox"] div[anonid="findGrid"] div[highlight][current],\n';
	sscode += 'div[ownedByFindBarTweak][anonid="gridBox"] div[anonid="findGrid"] div[highlight][hover] {\n';
	sscode += '	background-color: '+Prefs.selectColor+';\n';
	sscode += '}\n';
	
	Styles.load('otherSelectColorStyleSheet', sscode, true);
};

this.resetColorPrefs = function() {
	Prefs.unlisten('textHighlightBackground', handleUIHighlightBackground);
	Prefs.unlisten('textHighlightForeground', handleUIHighlightForeground);
	Prefs.unlisten('textSelectBackgroundAttention', handleUISelectBackground);
	Prefs.unlisten('textSelectForeground', handleUISelectForeground);
	
	if(!Prefs.resetNative && uiBackup.textHighlightBackground) { Prefs.textHighlightBackground = uiBackup.textHighlightBackground; }
	else { Prefs.reset('textHighlightBackground'); }
	if(!Prefs.resetNative && uiBackup.textHighlightForeground) { Prefs.textHighlightForeground = uiBackup.textHighlightForeground; }
	else { Prefs.reset('textHighlightForeground'); }
	
	if(!Prefs.resetNative && uiBackup.textSelectBackgroundAttention) { Prefs.textSelectBackgroundAttention = uiBackup.textSelectBackgroundAttention; }
	else { Prefs.reset('textSelectBackgroundAttention'); }
	if(!Prefs.resetNative && uiBackup.textSelectForeground) { Prefs.textSelectForeground = uiBackup.textSelectForeground; }
	else { Prefs.reset('textSelectForeground'); }
};

Modules.LOADMODULE = function() {
	Prefs.setDefaults({
		textHighlightBackground: '',
		textHighlightForeground: '',
		textSelectBackgroundAttention: '',
		textSelectForeground: '',
	}, 'ui', '');
	
	uiBackup = {
		textHighlightBackground: Prefs.textHighlightBackground,
		textHighlightForeground: Prefs.textHighlightForeground,
		textSelectBackgroundAttention: Prefs.textSelectBackgroundAttention,
		textSelectForeground: Prefs.textSelectForeground
	};
	
	Prefs.listen('highlightColor', changeHighlightColor);
	Prefs.listen('selectColor', changeSelectColor);
	Prefs.listen('keepSelectContrast', changeSelectColor);
	
	alwaysRunOnShutdown.push(resetColorPrefs);
	
	changeHighlightColor();
	changeSelectColor();
};

Modules.UNLOADMODULE = function() {
	Styles.unload('highlightColorStyleSheet');
	Styles.unload('otherHighlightColorStyleSheet');
	Styles.unload('selectColorStyleSheet');
	Styles.unload('otherSelectColorStyleSheet');
	
	Prefs.unlisten('highlightColor', changeHighlightColor);
	Prefs.unlisten('selectColor', changeSelectColor);
	Prefs.unlisten('keepSelectContrast', changeSelectColor);
	
	resetColorPrefs();
};
