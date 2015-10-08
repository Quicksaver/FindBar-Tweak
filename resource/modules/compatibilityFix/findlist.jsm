// VERSION 1.0.3

this.overrideFindlistWidth = function() {
	Prefs.fieldWidth = Prefs.findFieldWidth;
	findbar.init('findlistFix',
		function(bar) {
			bar.getElement('findbar-textbox').style.width = Prefs.fieldWidth+'px';
		},
		function(bar) {
			if(bar._destroying) { return; }
			
			bar.getElement('findbar-textbox').style.width = '';
		},
		true
	);
};

Modules.LOADMODULE = function() {
	Prefs.setDefaults({ fieldWidth: 150 }, 'findlist');
	
	Prefs.listen('findFieldWidth', overrideFindlistWidth);
	overrideFindlistWidth();
};

Modules.UNLOADMODULE = function() {
	Prefs.unlisten('findFieldWidth', overrideFindlistWidth);
	
	findbar.deinit('findlistFix');
};
