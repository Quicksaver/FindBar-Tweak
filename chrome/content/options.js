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