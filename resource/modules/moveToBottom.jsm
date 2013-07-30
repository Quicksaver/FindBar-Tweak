moduleAid.VERSION = '1.0.0';

// Note: the findbar seems to "reset" each time it is appended to the dom.
// This gets very hard to manage, so I simply use CSS trickery for this.

moduleAid.LOADMODULE = function() {
	initFindBar('movetobottom',
		function(bar) {
			removeAttribute(bar, 'position');
		},
		function(bar) {
			setAttribute(bar, 'position', 'top');
		}
	);
};

moduleAid.UNLOADMODULE = function() {
	deinitFindBar('movetobottom');
};
