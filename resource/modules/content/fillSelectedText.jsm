Modules.VERSION = '1.0.0';

this.fillSelectedText = function() {
	// we need this even if the findbar hasn't been created in this tab yet; the tab and forth afterwards will initialize everything properly
	if(typeof(Finder) == 'undefined') {
		Modules.load('gFindBar');
		Modules.load('mFinder');
	}
	
	if(!Finder.isValid) { return; }
	
	var selText = Finder.getActiveSelectionText();
	message('FillSelectedText', selText);
};

this.fillSelectedTextMouseUp = function(e) {
	if(e.button != 0 || e.target.nodeName == 'HTML') { return; }
	
	fillSelectedText();
};

this.fillSelectedTextKeyUp = function(e) {
	switch(e.keyCode) {
		case e.DOM_VK_PAGE_UP:
		case e.DOM_VK_PAGE_DOWN:
		case e.DOM_VK_END:
		case e.DOM_VK_HOME:
		case e.DOM_VK_LEFT:
		case e.DOM_VK_UP:
		case e.DOM_VK_RIGHT:
		case e.DOM_VK_DOWN:
			fillSelectedText();
			break;
		
		default: return;
        }
};

Modules.LOADMODULE = function() {
	Listeners.add(Scope, 'mouseup', fillSelectedTextMouseUp);
	Listeners.add(Scope, 'keyup', fillSelectedTextKeyUp);
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(Scope, 'mouseup', fillSelectedTextMouseUp);
	Listeners.remove(Scope, 'keyup', fillSelectedTextKeyUp);
};
