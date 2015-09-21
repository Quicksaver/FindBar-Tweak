Modules.VERSION = '1.0.0';

this.getOSB = {
	get getBox() { return $('paneFindAll-getOSB'); },
	get hasBox() { return $('paneFindAll-hasOSB'); },
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'click':
				if(e.button != 0 && e.button != 1) { break; }
				
				if(isAncestor(e.target, this.getBox)) {
					let win = this._getChrome();
					if(win && win.openUILink) {
						win.openUILink('https://addons.mozilla.org/firefox/addon/omnisidebar/', {
							target: this.getBox,
							ctrlKey: true
						});
					}
				}
				break;
		}
	},
	
	onOSBToggled: function() {
		this.getBox.hidden = osb.enabled;
		this.hasBox.hidden = !osb.enabled;
	},
	
	_getChrome: function() {
		return window
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIWebNavigation)
			.QueryInterface(Ci.nsIDocShellTreeItem)
			.rootTreeItem
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIDOMWindow);
	}
};

Modules.LOADMODULE = function() {
	Listeners.add(getOSB.getBox, 'click', getOSB);
	
	osb.add(getOSB);
	getOSB.onOSBToggled();
};

Modules.UNLOADMODULE = function() {
	alwaysRunOnClose.push(function() {
		osb.remove(getOSB);
	});
	
	if(typeof(osb) != 'undefined') {
		osb.remove(getOSB);
	}
	
	Listeners.remove(getOSB.getBox, 'click', getOSB);
};
