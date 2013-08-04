moduleAid.VERSION = '1.0.0';

this.overrideFindlistWidth = function() {
	prefAid.fieldWidth = prefAid.findFieldWidth;
	initFindBar('findlistFix',
		function(bar) {
			bar.getElement('findbar-textbox').style.width = prefAid.fieldWidth+'px';
		},
		function(bar) {
			bar.getElement('findbar-textbox').style.width = '';
		},
		true
	);
};

moduleAid.LOADMODULE = function() {
	prefAid.setDefaults({ fieldWidth: 150 }, 'findlist');
	
	prefAid.listen('findFieldWidth', overrideFindlistWidth);
	overrideFindlistWidth();
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('findFieldWidth', overrideFindlistWidth);
	
	deinitFindbar('findlistFix');
};
