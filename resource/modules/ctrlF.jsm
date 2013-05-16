moduleAid.VERSION = '1.2.0';

moduleAid.LOADMODULE = function() {
	this.backups = {
		oncommand: $('cmd_find').getAttribute('oncommand')
	};
	setAttribute($('cmd_find'), 'oncommand', objName+'.ctrlF(event);');
};

moduleAid.UNLOADMODULE = function() {
	if(this.backups) {
		setAttribute($('cmd_find'), 'oncommand', this.backups.oncommand);
		delete this.backups;
	}
};
