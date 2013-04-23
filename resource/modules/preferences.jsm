moduleAid.VERSION = '1.1.0';

this.inPreferences = true;
this.__defineGetter__('linkedPanel', function() { return window.document; });

this.previewSights = function(box, style) {
	moduleAid.load('sights');
	
	// Hide the current sights
	for(var i=0; i<sights.childNodes.length; i++) {
		if(sights.childNodes[i]._sights.current) {
			sights.childNodes[i].hidden = true;
		}
	}
	
	var dimensions = box.getBoundingClientRect();
	buildSights(dimensions.left +(dimensions.width /2), dimensions.top +(dimensions.height /2), 0, 0, true, style);
};

moduleAid.UNLOADMODULE = function() {
	moduleAid.unload('sights');
};
