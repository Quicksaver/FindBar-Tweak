Modules.VERSION = '1.2.2';

this.__defineGetter__('findBarOverflow', function() {
	return Math.max(0, gFindBar.scrollWidth -((Prefs.movetoTop && typeof(moveTopStyle) != 'undefined' && moveTopStyle) ? moveTopStyle.maxWidth : gFindBar.clientWidth));
});

this.textboxResizing = false;
this.textboxOverflow = null;

this.saveTextboxWidth = function(obj, prop, oldVal, newVal) {
	if(textboxResizing || oldVal == newVal) { return; }
	textboxResizing = true;
	
	var width = parseInt(gFindBar._findField.getAttribute('width'));
	var max = 4000;
	
	if(width < minTextboxWidth || width > max) {
		Prefs.findFieldWidth = (width < minTextboxWidth) ? minTextboxWidth : max;
		setAttribute(gFindBar._findField, 'width', Prefs.findFieldWidth);
		
		textboxResizing = false;
		return;
	}
	
	if(textboxOverflow && width >= textboxOverflow) {
		Prefs.findFieldWidth = textboxOverflow;
		setAttribute(gFindBar._findField, 'width', Prefs.findFieldWidth);
		
		textboxResizing = false;
		return;
	}
	
	Prefs.findFieldWidth = parseInt(gFindBar._findField.getAttribute('width'));
	
	delayFindFieldMaxWidth();
	
	if(Prefs.movetoTop && typeof(moveTop) != 'undefined') {
		moveTop();
	}
	
	textboxResizing = false;
};

this.findFieldWidthChanged = function() {
	initFindBar('textboxWidth',
		function(bar) {
			setAttribute(bar._findField, 'width', Prefs.findFieldWidth);
		},
		function(bar) {
			removeAttribute(bar._findField, 'width');
		},
		true
	);
};

this.setTextboxResizers = function(bar) {
	bar._findField.id = objName+'-find-textbox';
	if(!viewSource) {
		bar._findField.id += '-'+gBrowser.getNotificationBox(bar.browser).id;
	}
	
	Watchers.addAttributeWatcher(bar._findField, 'width', saveTextboxWidth);
	
	var leftResizer = document.createElement('resizer');
	setAttribute(leftResizer, 'class', 'find-textbox-resizer');
	setAttribute(leftResizer, 'anonid', 'find-left-resizer');
	setAttribute(leftResizer, 'element', bar._findField.id);
	setAttribute(leftResizer, 'ondblclick', objName+'.dblClickTextboxResizer(event);');
	
	var rightResizer = leftResizer.cloneNode(true);
	setAttribute(rightResizer, 'anonid', 'find-right-resizer');
	
	// RTL layouts are completely reversed
	setAttribute(leftResizer, 'dir', (RTL ? 'right' : 'left'));
	setAttribute(rightResizer, 'dir', (RTL ? 'left' : 'right'));
	
	bar._findField.parentNode.insertBefore(leftResizer, bar._findField);
	bar._findField.parentNode.insertBefore(rightResizer, bar._findField.nextSibling);
};

this.unsetTextboxResizers = function(bar) {
	Watchers.removeAttributeWatcher(bar._findField, 'width', saveTextboxWidth);
	
	var leftResizer = bar.getElement("find-left-resizer");
	var rightResizer = bar.getElement("find-right-resizer");
	
	leftResizer.remove();
	rightResizer.remove();
	
	bar._findField.id = '';
};

this.dblClickTextboxResizer = function(e) {
	e.preventDefault();
	var width = parseInt(gFindBar._findField.getAttribute('width'));
	var maxCompare = browserPanel.clientWidth *0.5;
	var max = 4000;
	if(width >= maxCompare) {
		setAttribute(gFindBar._findField, 'width', minTextboxWidth);
	} else {
		setAttribute(gFindBar._findField, 'width', max);
	}
	return false;
};

this.delayFindFieldMaxWidth = function() {
	if(Prefs.movetoTop) { return; }
	Timers.init('delayFindFieldMaxWidth', findFieldMaxWidth, 0);
};

this.findFieldNoMaxWidth = function() {
	Styles.unload('findFieldMaxWidth_'+_UUID);
};

this.findFieldMaxWidth = function(e) {
	findFieldNoMaxWidth();
	
	if((!viewSource && !gFindBarInitialized) || gFindBar.hidden
	|| Prefs.findFieldWidth <= minTextboxWidth) { return; }
	
	textboxOverflow = null;
	var overflow = findBarOverflow;
	if(overflow > 0) {
		var maxWidth = Math.max(0, Prefs.findFieldWidth -overflow);
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] .findbar-textbox { max-width: '+maxWidth+'px; }\n';
		sscode += '}';
		
		Styles.load('findFieldMaxWidth_'+_UUID, sscode, true);
		
		textboxOverflow = maxWidth;
	}
};

Modules.LOADMODULE = function() {
	// in FITFull we use flex to always extend the findField, so none of the rest is needed
	if(FITFull) {
		initFindBar('textboxFITFull',
			function(bar) {
				setAttribute(bar._findField, 'flex', '1');
				setAttribute(bar._findField.parentNode, 'flex', '1');
			},
			function(bar) {
				removeAttribute(bar._findField, 'flex');
				removeAttribute(bar._findField.parentNode, 'flex');
			}
		);
		return;
	}
	
	findFieldWidthChanged();
	initFindBar('textboxResizers', setTextboxResizers, unsetTextboxResizers);
	
	Listeners.add(window, 'resize', delayFindFieldMaxWidth);
	Listeners.add(window, 'OpenedFindBar', findFieldMaxWidth);
	Listeners.add(window, 'FindBarMaybeMoveTop', findFieldNoMaxWidth);
	Listeners.add(window, 'FindBarMovedTop', findFieldMaxWidth);
	
	findFieldMaxWidth();
};

Modules.UNLOADMODULE = function() {
	if(FITFull) {
		deinitFindBar('textboxFITFull');
		return;
	}
	
	findFieldNoMaxWidth();
	
	Listeners.remove(window, 'resize', delayFindFieldMaxWidth);
	Listeners.remove(window, 'OpenedFindBar', findFieldMaxWidth);
	Listeners.remove(window, 'FindBarMaybeMoveTop', findFieldNoMaxWidth);
	Listeners.remove(window, 'FindBarMovedTop', findFieldMaxWidth);
	
	deinitFindBar('textboxResizers');
	deinitFindBar('textboxWidth');
};
