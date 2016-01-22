// VERSION 1.3.0

this.highlightColor = {
	observe: function(aSubject, aTopic, aData) {
		switch(aSubject) {
			case 'highlightColor': {
				let m = Prefs.highlightColor.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
				if(m) {
					let rgb = this.getRGBfromString(m);

					Prefs.highlightColorContrast = (this.darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000';

					this.setHighlightColorStyleSheet(rgb);
					Observers.notify('ReHighlightAll');
				}
				break;
			}
			case 'selectColor':
			case 'keepSelectContrast': {
				let m = Prefs.selectColor.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
				if(!m) { break; }
				let rgb = this.getRGBfromString(m);

				if(!Prefs.keepSelectContrast) {
					Prefs.selectColorContrast = (this.darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000';
				} else {
					let originalValue = Prefs.natives.get('textSelectForeground').revertValue;
					if(originalValue) {
						Prefs.selectColorContrast = originalValue;
					} else {
						Prefs.reset('selectColorContrast');
					}
				}

				setSelectColorStyleSheet(rgb);
				Observers.notify('ReHighlightAll');
				break;
			}

		}
	},

	getRGBfromString: function(m) {
		// 6-char notation
		if(m[1].length === 6) {
			return {
				r: parseInt(m[1].substr(0,2),16),
				g: parseInt(m[1].substr(2,2),16),
				b: parseInt(m[1].substr(4,2),16)
			};
		}
		// 3-char notation
		return {
			r: parseInt(m[1].charAt(0)+m[1].charAt(0),16),
			g: parseInt(m[1].charAt(1)+m[1].charAt(1),16),
			b: parseInt(m[1].charAt(2)+m[1].charAt(2),16)
		};
	},

	darkBackgroundRGB: function(rgb) {
		return (0.213 *rgb.r /255 + 0.715 *rgb.g /255 + 0.072 *rgb.b /255 < 0.7);
	},

	setHighlightColorStyleSheet: function(rgb) {
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document\n\
				url("chrome://browser/content/browser.xul"),\n\
				url("chrome://global/content/viewSource.xul"),\n\
				url("chrome://global/content/viewPartialSource.xul") {\n\
					vbox[anonid="findGrid"] vbox[highlight]:not([current]):not([hover]) {\n\
						background-color: '+Prefs.highlightColor+';\n\
					}\n\
			}';

		Styles.load('highlightColorStyleSheet', sscode, true);

		sscode = '\
			@namespace url(http://www.w3.org/1999/xhtml);\n' +

			// For PDF.JS
			'body #outerContainer #mainContainer #viewerContainer .textLayer .highlight:not(.selected) { background-color: rgb('+rgb.r+','+rgb.g+','+rgb.b+'); }\n' +

			// For grids in frames
			'div[ownedbyfindbartweak][anonid="gridBox"] div[anonid="findGrid"] div[highlight]:not([current]):not([hover]) {\n\
				background-color: '+Prefs.highlightColor+';\n\
			}\n' +

			// color the matches in the FIT lists
			'@-moz-document url("chrome://'+objPathString+'/content/findInTabsFull.xul") {\n\
				.findInTabs-match:not([current]):not(:hover) {\n\
					background-color: '+Prefs.highlightColor+';\n\
					color: '+((this.darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000')+';\n\
				}\n\
			}';

		Styles.load('otherHighlightColorStyleSheet', sscode, true);
	},

	setSelectColorStyleSheet: function(rgb) {
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document\n\
				url("chrome://browser/content/browser.xul"),\n\
				url("chrome://global/content/viewSource.xul"),\n\
				url("chrome://global/content/viewPartialSource.xul"),\n\
				url("chrome://findbartweak/content/findInTabsFull.xul") {\n\
					.findInTabs-list richlistitem:not([selected]):hover {\n\
						background-color: rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.03);\n\
					}\n\
					.findInTabs-list richlistitem:hover {\n\
						box-shadow: inset 0 0 2px 1px rgba('+rgb.r+','+rgb.g+','+rgb.b+',0.2);\n\
					}\n\
					vbox[anonid="findGrid"] vbox[highlight][current],\n\
					vbox[anonid="findGrid"] vbox[highlight][hover] {\n\
						background-color: '+Prefs.selectColor+';\n\
					}\n\
			}';

		Styles.load('selectColorStyleSheet', sscode, true);

		sscode = '\
			@namespace url(http://www.w3.org/1999/xhtml);\n' +

			// For PDF.JS
			'body #outerContainer #mainContainer #viewerContainer .textLayer .highlight.selected { background-color: rgb('+rgb.r+','+rgb.g+','+rgb.b+'); }\n' +

			// For grids in frames
			'div[ownedbyfindbartweak][anonid="gridBox"] div[anonid="findGrid"] div[highlight][current],\n\
			div[ownedbyfindbartweak][anonid="gridBox"] div[anonid="findGrid"] div[highlight][hover] {\n\
				background-color: '+Prefs.selectColor+';\n\
			}\n' +

			// color the matches in the FIT lists
			'@-moz-document url("chrome://'+objPathString+'/content/findInTabsFull.xul") {\n\
				.findInTabs-match[current],\n\
				.findInTabs-match:hover {\n\
					background-color: '+Prefs.selectColor+';\n\
					color: '+((this.darkBackgroundRGB(rgb)) ? '#FFFFFF' : '#000000')+';\n\
				}\n\
			}';

		Styles.load('otherSelectColorStyleSheet', sscode, true);
	}
};

Modules.LOADMODULE = function() {
	Prefs.listen('highlightColor', highlightColor);
	Prefs.listen('selectColor', highlightColor);
	Prefs.listen('keepSelectContrast', highlightColor);
};

Modules.UNLOADMODULE = function() {
	Styles.unload('highlightColorStyleSheet');
	Styles.unload('otherHighlightColorStyleSheet');
	Styles.unload('selectColorStyleSheet');
	Styles.unload('otherSelectColorStyleSheet');

	Prefs.unlisten('highlightColor', highlightColor);
	Prefs.unlisten('selectColor', highlightColor);
	Prefs.unlisten('keepSelectContrast', highlightColor);
};
