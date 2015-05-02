Modules.VERSION = '2.0.0';

this.selectedText = {
	handleEvent: function(e) {
		switch(e.type) {
			case 'mouseup':
				if(e.button == 0 && e.target.nodeName != 'HTML') {
					this.fill();
				}
				break;
			
			case 'keyup':
				switch(e.keyCode) {
					case e.DOM_VK_PAGE_UP:
					case e.DOM_VK_PAGE_DOWN:
					case e.DOM_VK_END:
					case e.DOM_VK_HOME:
					case e.DOM_VK_LEFT:
					case e.DOM_VK_UP:
					case e.DOM_VK_RIGHT:
					case e.DOM_VK_DOWN:
						this.fill();
						break;
					
					default: break;
			        }
			        break;
		}
	},
	
	fill: function() {
		// we need this even if the findbar hasn't been created in this tab yet; the tab and forth afterwards will initialize everything properly
		if(typeof(Finder) == 'undefined') {
			Modules.load('gFindBar');
			Modules.load('mFinder');
		}
		
		if(!Finder.isValid) { return; }
		
		var selText = Finder.getActiveSelectionText();
		message('FillSelectedText', selText);
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(Scope, 'mouseup', selectedText);
	Listeners.add(Scope, 'keyup', selectedText);
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(Scope, 'mouseup', selectedText);
	Listeners.remove(Scope, 'keyup', selectedText);
};
