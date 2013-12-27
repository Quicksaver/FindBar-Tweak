moduleAid.VERSION = '1.0.1';

// This will probably need to be changed/remove once https://bugzilla.mozilla.org/show_bug.cgi?id=939523 is addressed

this.fixCloseButton = function() {
	if(prefAid.movetoTop) {
		initFindBar('fixCloseButton',
			function(bar) {
				setAttribute(bar, 'fixCloseButton', 'true');
				
				bar._mainCloseButton = bar.getElement('find-closebutton');
				bar._topCloseButton = bar.getElement('findbar-container').appendChild(bar._mainCloseButton.cloneNode(true));
				setAttribute(bar._topCloseButton, 'oncommand', 'gFindBar.close();');
				
				removeAttribute(bar._mainCloseButton, 'anonid');
			},
			function(bar) {
				bar._topCloseButton.parentNode.removeChild(bar._topCloseButton);
				setAttribute(bar._mainCloseButton, 'anonid', 'find-closebutton');
				
				delete bar._mainCloseButton;
				delete bar._topCloseButton;
				
				removeAttribute(bar, 'fixCloseButton');
			}
		);
	} else {
		deinitFindBar('fixCloseButton');
	}
};

moduleAid.LOADMODULE = function() {
	prefAid.listen('movetoTop', fixCloseButton);
	
	fixCloseButton();
};

moduleAid.UNLOADMODULE = function() {
	prefAid.unlisten('movetoTop', fixCloseButton);
	
	deinitFindBar('fixCloseButton');
};
