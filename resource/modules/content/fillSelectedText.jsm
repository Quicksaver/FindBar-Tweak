Modules.VERSION = '2.0.2';

this.selectedText = {
	noSights: false,
	
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
	
	receiveMessage: function(m) {
		// +1 is for the ':' after objName
		let name = m.name.substr(objName.length +1);
		
		switch(name) {
			case 'FillSelectedTextFinished':
				this.noSights = false;
				break;
		}
	},
	
	fill: function() {
		// we need this even if the findbar hasn't been created in this tab yet; the tab and forth afterwards will initialize everything properly
		if(typeof(Finder) == 'undefined') {
			Modules.load('content/gFindBar');
			Modules.load('content/mFinder');
		}
		
		if(!Finder.isValid) { return; }
		this.noSights = true;
		
		var selText = Finder.getActiveSelectionText();
		message('FillSelectedText', selText);
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(Scope, 'mouseup', selectedText);
	Listeners.add(Scope, 'keyup', selectedText);
	
	listen('FillSelectedTextFinished', selectedText);
};

Modules.UNLOADMODULE = function() {
	Listeners.remove(Scope, 'mouseup', selectedText);
	Listeners.remove(Scope, 'keyup', selectedText);
	
	unlisten('FillSelectedTextFinished', selectedText);
};
