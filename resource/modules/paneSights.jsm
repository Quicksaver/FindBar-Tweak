// VERSION 1.0.0

this.inPreferences = true;

this.previewSights = function(box, style) {
	var bSights = sights.get();
	if(!bSights.groups) { bSights.groups = new Map(); }
	
	// Hide the current sights
	sights.remove(bSights, 0);
	
	var dimensions = box.getBoundingClientRect();
	sights.build(
		{ sights: bSights },
		{
			group: 0,
			centerX: dimensions.left +(dimensions.width /2),
			centerY: dimensions.top +(dimensions.height /2),
			current: true,
			style: style
		}
	);
};

Modules.LOADMODULE = function() {
	Modules.load('sights');
};

Modules.UNLOADMODULE = function() {
	Modules.unload('sights');
};
