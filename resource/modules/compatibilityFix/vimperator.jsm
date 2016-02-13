// VERSION 1.0.0

this.vimperator = {
	proxying: function(bar) {
		try { return bar.vimperated && bar.ownerDocument.activeElement == bar.ownerGlobal.liberator.plugins.commandline._commandWidget.inputField; }
		catch(ex) { return false; }
	}
};
