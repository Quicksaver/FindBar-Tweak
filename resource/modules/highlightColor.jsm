moduleAid.VERSION = '1.0.1';

this.uiBackup = {};

this.handleUIBackground = function(noUpdate) {
	uiBackup.textHighlightBackground = prefAid.textHighlightBackground;
	if(!noUpdate) { changeHighlightColor(); }
};

this.handleUIForeground = function(noUpdate) {
	uiBackup.textHighlightForeground = prefAid.textHighlightForeground;
	if(!noUpdate) { changeHighlightColor(); }
};

this.changeHighlightColor = function() {
	var m = prefAid.highlightColor.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
	if(!m) { return; }
	if(m[1].length === 6) { // 6-char notation
		var rgb = {
			r: parseInt(m[1].substr(0,2),16) / 255,
			g: parseInt(m[1].substr(2,2),16) / 255,
			b: parseInt(m[1].substr(4,2),16) / 255
		};
	} else { // 3-char notation
		var rgb = {
			r: parseInt(m[1].charAt(0)+m[1].charAt(0),16) / 255,
			g: parseInt(m[1].charAt(1)+m[1].charAt(1),16) / 255,
			b: parseInt(m[1].charAt(2)+m[1].charAt(2),16) / 255
		};
	}
	
	// Have to remove the listeners and add them back after, so the backups aren't overwritten with our values
	prefAid.unlisten('textHighlightBackground', handleUIBackground);
	prefAid.unlisten('textHighlightForeground', handleUIForeground);
	
	if(0.213 * rgb.r + 0.715 * rgb.g + 0.072 * rgb.b < 0.5) {
		prefAid.textHighlightBackground = '#FFFFFF';
		prefAid.textHighlightForeground = prefAid.highlightColor;
	}
	else {
		prefAid.textHighlightBackground = prefAid.highlightColor;
		prefAid.textHighlightForeground = '#000000';
	}
	
	prefAid.listen('textHighlightBackground', handleUIBackground);
	prefAid.listen('textHighlightForeground', handleUIForeground);
	
	setColorStyleSheet(rgb);
	
	observerAid.notify('ReHighlightAll');
};

this.setColorStyleSheet = function(rgb) {
	styleAid.unload('colorStyleSheet');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("chrome://browser/content/browser.xul") {\n';
	sscode += '	.findInTabs-list label[highlight] {\n';
	sscode += '		background-color: '+prefAid.highlightColor+';\n';
	sscode += '		color: '+((0.213 * rgb.r + 0.715 * rgb.g + 0.072 * rgb.b < 0.5) ? '#FFFFFF' : '#000000')+';\n';
	sscode += '	}\n';
	sscode += '}';
	
	styleAid.load('colorStyleSheet', sscode, true);
	
	// For PDF.JS
	var r = Math.round(rgb.r *255);
	var g = Math.round(rgb.g *255);
	var b = Math.round(rgb.b *255);
	
	styleAid.unload('otherColorStyleSheet');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.w3.org/1999/xhtml);\n';
	sscode += 'body #outerContainer #mainContainer #viewerContainer .textLayer .highlight:not(.selected) { background-color: rgba('+r+','+g+','+b+',0.3) !important; }\n';
	
	styleAid.load('otherColorStyleSheet', sscode, true);
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ textHighlightBackground: '', textHighlightForeground: '' }, 'ui', '');
	prefAid.listen('highlightColor', changeHighlightColor);
	
	handleUIBackground(true);
	handleUIForeground(true);
	changeHighlightColor();
};

moduleAid.UNLOADMODULE = function() {
	styleAid.unload('colorStyleSheet');
	styleAid.unload('otherColorStyleSheet');
	
	prefAid.unlisten('highlightColor', changeHighlightColor);
	prefAid.unlisten('textHighlightBackground', handleUIBackground);
	prefAid.unlisten('textHighlightForeground', handleUIForeground);
	
	if(uiBackup.textHighlightBackground) { prefAid.textHighlightBackground = uiBackup.textHighlightBackground; }
	else { prefAid.reset('textHighlightBackground'); }
	if(uiBackup.textHighlightForeground) { prefAid.textHighlightForeground = uiBackup.textHighlightForeground; }
	else { prefAid.reset('textHighlightForeground'); }
};
