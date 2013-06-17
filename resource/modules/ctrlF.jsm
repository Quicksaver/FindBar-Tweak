moduleAid.VERSION = '1.3.1';

this.ctrlF = function(event) {
	// See if there is text selection and if it's the same as the findbar's value
	if(prefAid.ctrlFClosesOnValue && prefAid.FAYTprefill && !gFindBar.hidden) {
		var editableNode = gFindBar.browser._fastFind.foundEditable;
		var controller = (editableNode && editableNode.editor) ? editableNode.editor.selectionController : null;
		if(!controller) {
			controller = gFindBar._getSelectionController(contentWindow);
		}
		var sel = controller.getSelection(gFindBar.nsISelectionController.SELECTION_NORMAL);
		
		if(sel.rangeCount == 1) {
			var value = trim(sel.getRangeAt(0).toString());
			if(value && value != gFindBar._findField.value) {
				gFindBar.onFindCommand();
				gFindBar._setHighlightTimeout();
				return;
			}
		}
	}
	
	toggleFindBar(event);
};

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
