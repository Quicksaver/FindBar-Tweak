// VERSION 1.0.0

this.osb = {
	id: 'osb@quicksaver',
	
	enabled: false,
	listeners: new Set(),
	
	add: function(aListener) {
		this.listeners.add(aListener);
	},
	
	remove: function(aListener) {
		this.listeners.delete(aListener);
	},
	
	onToggle: function() {
		for(let listener of this.listeners) {
			if(listener.onOSBToggled) {
				try {
					listener.onOSBToggled(this.enabled);
				}
				catch(ex) { Cu.reportError(ex); }
			}
		}
	},
	
	onEnabled: function(addon) {
		if(addon.id == this.id) { this.enable(); }
	},
	
	onDisabled: function(addon) {
		if(addon.id == this.id) { this.disable(); }
	},
	
	listen: function() {
		AddonManager.addAddonListener(this);
		AddonManager.getAddonByID(this.id, (addon) => {
			if(addon && addon.isActive) { this.enable(); }
		});
	},
	
	unlisten: function() {
		AddonManager.removeAddonListener(this);
		this.disable();
	},
	
	enable: function() {
		this.enabled = true;
		this.onToggle();
	},
	
	disable: function() {
		this.enabled = false;
		this.onToggle();
	}
};

Modules.LOADMODULE = function() {
	osb.listen();
};

Modules.UNLOADMODULE = function() {
	osb.unlisten();
};
