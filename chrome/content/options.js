var findbartweakOptions = {
	init: function() {
		window.removeEventListener('load', findbartweakOptions.init, false);
		
		findbartweakOptions.color = document.getElementById('color');
		
		findbartweakOptions.changeGridOptions();
		findbartweakOptions.changeQuickfindOptions();
	},
	
	changeGridOptions: function() {
		if(!document.getElementById('checkbox-useGrid').checked) {
			document.getElementById('checkbox-gridInScrollbar').setAttribute('disabled', 'true');
			document.getElementById('gridLimitLabela').setAttribute('disabled', 'true');
			document.getElementById('gridLimitLabelb').setAttribute('disabled', 'true');
			document.getElementById('gridLimitTextbox').setAttribute('disabled', 'true');
		}
		else {
			document.getElementById('checkbox-gridInScrollbar').removeAttribute('disabled');
			document.getElementById('gridLimitLabela').removeAttribute('disabled');
			document.getElementById('gridLimitLabelb').removeAttribute('disabled');
			document.getElementById('gridLimitTextbox').removeAttribute('disabled');
		}
	},
	
	changeQuickfindOptions: function() {
		var nodes = document.getElementsByClassName('FAYTmode');
		for(var i=0; i<nodes.length; i++) {
			if(!document.getElementById('checkboxTypeAheadFind').checked 
			|| (nodes[i].classList.contains('quickMode') && document.getElementById('FAYTmodeRadio').value != 'quick')) {
				nodes[i].setAttribute('disabled', 'true');
			} else {
				nodes[i].removeAttribute('disabled');
			}
		}
	},
	
	accept: function() {
		findbartweakOptions.rgb = findbartweakOptions.getRGB(findbartweakOptions.color.color);
		if(0.213 * findbartweakOptions.rgb.r + 0.715 * findbartweakOptions.rgb.g + 0.072 * findbartweakOptions.rgb.b < 0.5) {
			Application.prefs.get('extensions.findbartweak.highlightColorOther').value = '#FFFFFF';
			Application.prefs.get('ui.textHighlightBackground').value = '#FFFFFF';
			Application.prefs.get('ui.textHighlightForeground').value = findbartweakOptions.color.color;
		}
		else {
			Application.prefs.get('extensions.findbartweak.highlightColorOther').value = '#000000';
			Application.prefs.get('ui.textHighlightBackground').value = findbartweakOptions.color.color;
			Application.prefs.get('ui.textHighlightForeground').value = '#000000';
		}
		return true;
	},
	
	getRGB: function(hex) {
		var m = hex.match(/^\W*([0-9A-F]{3}([0-9A-F]{3})?)\W*$/i);
		if(!m) {
			return false;
		} else {
			if(m[1].length === 6) { // 6-char notation
				var r = {
					r: parseInt(m[1].substr(0,2),16) / 255,
					g: parseInt(m[1].substr(2,2),16) / 255,
					b: parseInt(m[1].substr(4,2),16) / 255
				};
			} else { // 3-char notation
				var r = {
					r: parseInt(m[1].charAt(0)+m[1].charAt(0),16) / 255,
					g: parseInt(m[1].charAt(1)+m[1].charAt(1),16) / 255,
					b: parseInt(m[1].charAt(2)+m[1].charAt(2),16) / 255
				};
			}
			return r;
		}
	},
	
	msecToSec: function() {
		return document.getElementById('pref-timeout').value / 1000;
	},
	
	secToMsec: function() {
		return parseInt(document.getElementById('timeoutTextbox').value || 0) * 1000;
	},
	
	onlyNumbers: function(v) {
		return parseInt(v || 0);
	}
}

window.addEventListener('load', findbartweakOptions.init, false);