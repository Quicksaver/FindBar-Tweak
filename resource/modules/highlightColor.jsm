moduleAid.VERSION = '1.2.2';

this.uiBackup = {};

this.handleUIHighlightBackground = function() {
	uiBackup.textHighlightBackground = prefAid.textHighlightBackground;
	
	// This triggers a re-color
	var original = prefAid.highlightColor;
	if(prefAid.textHighlightBackground) {
		prefAid.highlightColor = prefAid.textHighlightBackground;
	} else {
		prefAid.reset('highlightColor');
	}
	// Make sure we trigger a re-color when it's not actually been changed
	if(original == prefAid.highlightColor) {
		changeHighlightColor();
	}
};

// This won't trigger a re-color
this.handleUIHighlightForeground = function() {
	uiBackup.textHighlightForeground = prefAid.textHighlightForeground;
};

this.handleUISelectBackground = function() {
	uiBackup.textSelectBackgroundAttention = prefAid.textSelectBackgroundAttention;
	
	// This triggers a re-color
	var original = prefAid.selectColor;
	if(prefAid.textSelectBackgroundAttention) {
		prefAid.selectColor = prefAid.textSelectBackgroundAttention;
	} else {
		prefAid.reset('selectColor');
	}
	// Make sure we trigger a re-color when it's not actually been changed
	if(original == prefAid.selectColor) {
		changeSelectColor();
	}
};

// This won't trigger a re-color
this.handleUISelectForeground = function() {
	uiBackup.textSelectForeground = prefAid.textSelectForeground;
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
	var m = prefAid.highlightColor.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
	if(!m) { return; }
	var rgb = getRGBfromString(m);
	
	// Have to remove the listeners and add them back after, so the backups aren't overwritten with our values
	prefAid.unlisten('textHighlightBackground', handleUIHighlightBackground);
	prefAid.unlisten('textHighlightForeground', handleUIHighlightForeground);
	
	prefAid.textHighlightBackground = prefAid.highlightColor;
	prefAid.textHighlightForeground = (darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000';
	
	prefAid.listen('textHighlightBackground', handleUIHighlightBackground);
	prefAid.listen('textHighlightForeground', handleUIHighlightForeground);
	
	setHighlightColorStyleSheet(rgb);
	
	observerAid.notify('ReHighlightAll');
};

this.setHighlightColorStyleSheet = function(rgb) {
	styleAid.unload('highlightColorStyleSheet');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document\n';
	sscode += '	url("chrome://browser/content/browser.xul"),\n';
	sscode += '	url("chrome://global/content/viewSource.xul"),\n';
	sscode += '	url("chrome://global/content/viewPartialSource.xul") {\n';
	sscode += '		.findInTabs-list label[highlight]:not([current]):not(:hover) {\n';
	sscode += '			background-color: '+prefAid.highlightColor+';\n';
	sscode += '			color: '+((darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000')+';\n';
	sscode += '		}\n';
	sscode += '		grid[anonid="findGrid"] row[highlight]:not([current]):not([hover]) {\n';
	sscode += '			background-color: '+prefAid.highlightColor+';\n';
	sscode += '		}\n';
	sscode += '}';
	
	styleAid.load('highlightColorStyleSheet', sscode, true);
	
	// For PDF.JS
	styleAid.unload('otherHighlightColorStyleSheet');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.w3.org/1999/xhtml);\n';
	sscode += 'body #outerContainer #mainContainer #viewerContainer .textLayer .highlight:not(.selected) { background-color: rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.3) !important; }\n';
	
	styleAid.load('otherHighlightColorStyleSheet', sscode, true);
};

this.changeSelectColor = function() {
	var m = prefAid.selectColor.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
	if(!m) { return; }
	var rgb = getRGBfromString(m);
	
	// Have to remove the listeners and add them back after, so the backups aren't overwritten with our values
	prefAid.unlisten('textSelectBackgroundAttention', handleUISelectBackground);
	prefAid.unlisten('textSelectForeground', handleUISelectForeground);
	
	prefAid.textSelectBackgroundAttention = prefAid.selectColor;
	
	if(!prefAid.keepSelectContrast) { prefAid.textSelectForeground = (darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000'; }
	else if(uiBackup.textSelectForeground) { prefAid.textSelectForeground = uiBackup.textSelectForeground; }
	else { prefAid.reset('textSelectForeground'); }
	
	prefAid.listen('textSelectBackgroundAttention', handleUISelectBackground);
	prefAid.listen('textSelectForeground', handleUISelectForeground);
	
	setSelectColorStyleSheet(rgb);
	
	observerAid.notify('ReHighlightAll');
};

this.setSelectColorStyleSheet = function(rgb) {
	styleAid.unload('selectColorStyleSheet');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document\n';
	sscode += '	url("chrome://browser/content/browser.xul"),\n';
	sscode += '	url("chrome://global/content/viewSource.xul"),\n';
	sscode += '	url("chrome://global/content/viewPartialSource.xul") {\n';
	sscode += '		.findInTabs-list label[highlight][current],\n';
	sscode += '		.findInTabs-list label[highlight]:hover {\n';
	sscode += '			background-color: '+prefAid.selectColor+';\n';
	sscode += '			color: '+((darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000')+';\n';
	sscode += '		}\n';
	sscode += '		.findInTabs-list richlistitem:hover {\n';
	sscode += '			background-color: rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.03);\n';
	sscode += '			box-shadow: inset 0 0 2px 1px rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.2);\n';
	sscode += '		}\n';
	sscode += '		grid[anonid="findGrid"] row[highlight][current],\n';
	sscode += '		grid[anonid="findGrid"] row[highlight][hover] {\n';
	sscode += '			background-color: '+prefAid.selectColor+';\n';
	sscode += '		}\n';
	sscode += '}';
	
	styleAid.load('selectColorStyleSheet', sscode, true);
	
	// For PDF.JS
	styleAid.unload('otherSelectColorStyleSheet');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.w3.org/1999/xhtml);\n';
	sscode += 'body #outerContainer #mainContainer #viewerContainer .textLayer .highlight.selected { background-color: rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.3) !important; }\n';
	
	styleAid.load('otherSelectColorStyleSheet', sscode, true);
};

this.resetColorPrefs = function() {
	prefAid.unlisten('textHighlightBackground', handleUIHighlightBackground);
	prefAid.unlisten('textHighlightForeground', handleUIHighlightForeground);
	prefAid.unlisten('textSelectBackgroundAttention', handleUISelectBackground);
	prefAid.unlisten('textSelectForeground', handleUISelectForeground);
	
	if(!prefAid.resetNative && uiBackup.textHighlightBackground) { prefAid.textHighlightBackground = uiBackup.textHighlightBackground; }
	else { prefAid.reset('textHighlightBackground'); }
	if(!prefAid.resetNative && uiBackup.textHighlightForeground) { prefAid.textHighlightForeground = uiBackup.textHighlightForeground; }
	else { prefAid.reset('textHighlightForeground'); }
	
	if(!prefAid.resetNative && uiBackup.textSelectBackgroundAttention) { prefAid.textSelectBackgroundAttention = uiBackup.textSelectBackgroundAttention; }
	else { prefAid.reset('textSelectBackgroundAttention'); }
	if(!prefAid.resetNative && uiBackup.textSelectForeground) { prefAid.textSelectForeground = uiBackup.textSelectForeground; }
	else { prefAid.reset('textSelectForeground'); }
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({
		textHighlightBackground: '',
		textHighlightForeground: '',
		textSelectBackgroundAttention: '',
		textSelectForeground: '',
	}, 'ui', '');
	
	uiBackup = {
		textHighlightBackground: prefAid.textHighlightBackground,
		textHighlightForeground: prefAid.textHighlightForeground,
		textSelectBackgroundAttention: prefAid.textSelectBackgroundAttention,
		textSelectForeground: prefAid.textSelectForeground
	};
	
	prefAid.listen('highlightColor', changeHighlightColor);
	prefAid.listen('selectColor', changeSelectColor);
	prefAid.listen('keepSelectContrast', changeSelectColor);
	
	alwaysRunOnShutdown.push(resetColorPrefs);
	
	changeHighlightColor();
	changeSelectColor();
};

moduleAid.UNLOADMODULE = function() {
	styleAid.unload('highlightColorStyleSheet');
	styleAid.unload('otherHighlightColorStyleSheet');
	
	prefAid.unlisten('highlightColor', changeHighlightColor);
	prefAid.unlisten('selectColor', changeSelectColor);
	prefAid.unlisten('keepSelectContrast', changeSelectColor);
	
	resetColorPrefs();
};
