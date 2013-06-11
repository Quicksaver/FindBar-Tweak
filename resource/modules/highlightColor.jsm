moduleAid.VERSION = '1.1.0';

this.uiBackup = {};

this.handleUIHighlightBackground = function(noUpdate) {
	uiBackup.textHighlightBackground = prefAid.textHighlightBackground;
	if(!noUpdate) { changeHighlightColor(); }
};

this.handleUIHighlightForeground = function(noUpdate) {
	uiBackup.textHighlightForeground = prefAid.textHighlightForeground;
	if(!noUpdate) { changeHighlightColor(); }
};

this.handleUISelectBackground = function(noUpdate) {
	uiBackup.textSelectBackgroundAttention = prefAid.textSelectBackgroundAttention;
	if(!noUpdate) { changeSelectColor(); }
};

this.handleUISelectForeground = function(noUpdate) {
	uiBackup.textSelectForeground = prefAid.textSelectForeground;
	if(!noUpdate) { changeSelectColor(); }
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
	sscode += '@-moz-document url("chrome://browser/content/browser.xul") {\n';
	sscode += '	.findInTabs-list label[highlight]:not([current]):not(:hover) {\n';
	sscode += '		background-color: '+prefAid.highlightColor+';\n';
	sscode += '		color: '+((darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000')+';\n';
	sscode += '	}\n';
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
	prefAid.textSelectForeground = (darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000';
	
	prefAid.listen('textSelectBackgroundAttention', handleUISelectBackground);
	prefAid.listen('textSelectForeground', handleUISelectForeground);
	
	setSelectColorStyleSheet(rgb);
	
	observerAid.notify('ReHighlightAll');
};

this.setSelectColorStyleSheet = function(rgb) {
	styleAid.unload('selectColorStyleSheet');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("chrome://browser/content/browser.xul") {\n';
	sscode += '	.findInTabs-list label[highlight][current],\n';
	sscode += '	.findInTabs-list label[highlight]:hover {\n';
	sscode += '		background-color: '+prefAid.selectColor+';\n';
	sscode += '		color: '+((darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000')+';\n';
	sscode += '	}\n';
	sscode += '}';
	
	styleAid.load('selectColorStyleSheet', sscode, true);
	
	// For PDF.JS
	styleAid.unload('otherSelectColorStyleSheet');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.w3.org/1999/xhtml);\n';
	sscode += 'body #outerContainer #mainContainer #viewerContainer .textLayer .highlight.selected { background-color: rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.3) !important; }\n';
	
	styleAid.load('otherSelectColorStyleSheet', sscode, true);
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({
		textHighlightBackground: '',
		textHighlightForeground: '',
		textSelectBackgroundAttention: '',
		textSelectForeground: '',
	}, 'ui', '');
	
	prefAid.listen('highlightColor', changeHighlightColor);
	prefAid.listen('selectColor', changeSelectColor);
	
	handleUIHighlightBackground(true);
	handleUIHighlightForeground(true);
	handleUISelectBackground(true);
	handleUISelectForeground(true);
	
	changeHighlightColor();
	changeSelectColor();
};

moduleAid.UNLOADMODULE = function() {
	styleAid.unload('highlightColorStyleSheet');
	styleAid.unload('otherHighlightColorStyleSheet');
	
	prefAid.unlisten('highlightColor', changeHighlightColor);
	prefAid.unlisten('selectColor', changeSelectColor);
	
	prefAid.unlisten('textHighlightBackground', handleUIHighlightBackground);
	prefAid.unlisten('textHighlightForeground', handleUIHighlightForeground);
	prefAid.unlisten('textSelectBackgroundAttention', handleUISelectBackground);
	prefAid.unlisten('textSelectForeground', handleUISelectForeground);
	
	if(uiBackup.textHighlightBackground) { prefAid.textHighlightBackground = uiBackup.textHighlightBackground; }
	else { prefAid.reset('textHighlightBackground'); }
	if(uiBackup.textHighlightForeground) { prefAid.textHighlightForeground = uiBackup.textHighlightForeground; }
	else { prefAid.reset('textHighlightForeground'); }
	
	if(uiBackup.textSelectBackgroundAttention) { prefAid.textSelectBackgroundAttention = uiBackup.textSelectBackgroundAttention; }
	else { prefAid.reset('textSelectBackgroundAttention'); }
	if(uiBackup.textSelectForeground) { prefAid.textSelectForeground = uiBackup.textSelectForeground; }
	else { prefAid.reset('textSelectForeground'); }
};
