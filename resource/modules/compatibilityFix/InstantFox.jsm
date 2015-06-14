Modules.VERSION = '1.0.1';

this.__defineGetter__('InstantFox', function() { return window.InstantFox; });

this.instantFox = {
	id: 'searchy@searchy',
	
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
	
	query: null,
	
	enable: function() {
		Piggyback.add('findbartweak', InstantFox.pageLoader, 'beforeSwap', () => {
			if(gFindBarInitialized && !gFindBar.hidden) {
				this.query = findQuery;
				destroyFindBar(gBrowser.mCurrentTab);
			}
		}, Piggyback.MODE_AFTER);
		
		Piggyback.add('findbartweak', InstantFox.pageLoader, 'afterSwap', () => {
			if(this.query !== null) {
				findQuery = this.query;
				gFindBar.open();
				this.query = null;
			}
		}, Piggyback.MODE_AFTER);
	},
	
	disable: function() {
		if(InstantFox) {
			Piggyback.revert('findbartweak', InstantFox.pageLoader, 'beforeSwap');
			Piggyback.revert('findbartweak', InstantFox.pageLoader, 'afterSwap');
		}
	}
};

Modules.LOADMODULE = function() {
	instantFox.listen();
};

Modules.UNLOADMODULE = function() {
	instantFox.unlisten();
};
