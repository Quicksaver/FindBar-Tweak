moduleAid.VERSION = '1.1.0';

// This will probably need to be changed/remove once https://bugzilla.mozilla.org/show_bug.cgi?id=939523 is addressed

this.fixCloseButtonTop = function() {
	if(prefAid.movetoTop) {
		initFindBar('fixCloseButtonTop',
			function(bar) {
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
			}
		);
	} else {
		deinitFindBar('fixCloseButtonTop');
	}
};

moduleAid.LOADMODULE = function() {
	initFindBar('fixCloseButton',
		function(bar) {
			setAttribute(bar, 'fixCloseButton', 'true');
		},
		function(bar) {
			removeAttribute(bar, 'fixCloseButton');
		}
	);
	
	if(!FITFull) {
		prefAid.listen('movetoTop', fixCloseButtonTop);
		
		fixCloseButtonTop();
	}
};

moduleAid.UNLOADMODULE = function() {
	if(!FITFull) {
		prefAid.unlisten('movetoTop', fixCloseButtonTop);
		
		deinitFindBar('fixCloseButtonTop');
	}
	
	deinitFindBar('fixCloseButton');
};
