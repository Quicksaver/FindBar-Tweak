moduleAid.VERSION = '1.2.1';

this.__defineGetter__('findBarOverflow', function() {
	return Math.max(0, gFindBar.scrollWidth -((prefAid.movetoTop && lastTopStyle) ? lastTopStyle.maxWidth : gFindBar.clientWidth));
});

this.textboxResizersRTL = false;
this.textboxResizing = false;
this.textboxOverflow = null;

this.saveTextboxWidth = function(obj, prop, oldVal, newVal) {
	if(textboxResizing || oldVal == newVal) { return; }
	textboxResizing = true;
	
	var width = parseInt(gFindBar._findField.getAttribute('width'));
	var max = 4000;
	
	if(width < minTextboxWidth || width > max) {
		prefAid.findFieldWidth = (width < minTextboxWidth) ? minTextboxWidth : max;
		setAttribute(gFindBar._findField, 'width', prefAid.findFieldWidth);
		
		textboxResizing = false;
		return;
	}
	
	if(textboxOverflow && width >= textboxOverflow) {
		prefAid.findFieldWidth = textboxOverflow;
		setAttribute(gFindBar._findField, 'width', prefAid.findFieldWidth);
		
		textboxResizing = false;
		return;
	}
	
	prefAid.findFieldWidth = parseInt(gFindBar._findField.getAttribute('width'));
	
	delayFindFieldMaxWidth();
	
	if(prefAid.movetoTop && typeof(moveTop) != 'undefined') {
		moveTop();
	}
	
	textboxResizing = false;
};

this.findFieldWidthChanged = function() {
	initFindBar('textboxWidth',
		function(bar) {
			setAttribute(bar._findField, 'width', prefAid.findFieldWidth);
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
	
	objectWatcher.addAttributeWatcher(bar._findField, 'width', saveTextboxWidth);
	
	var leftResizer = document.createElement('resizer');
	setAttribute(leftResizer, 'class', 'find-textbox-resizer');
	setAttribute(leftResizer, 'anonid', 'find-left-resizer');
	setAttribute(leftResizer, 'element', bar._findField.id);
	setAttribute(leftResizer, 'ondblclick', objName+'.dblClickTextboxResizer(event);');
	
	var rightResizer = leftResizer.cloneNode(true);
	setAttribute(rightResizer, 'anonid', 'find-right-resizer');
	
	// RTL layouts are completely reversed
	setAttribute(leftResizer, 'dir', (textboxResizersRTL ? 'right' : 'left'));
	setAttribute(rightResizer, 'dir', (textboxResizersRTL ? 'left' : 'right'));
	
	bar._findField.parentNode.insertBefore(leftResizer, bar._findField);
	bar._findField.parentNode.insertBefore(rightResizer, bar._findField.nextSibling);
};

this.unsetTextboxResizers = function(bar) {
	objectWatcher.removeAttributeWatcher(bar._findField, 'width', saveTextboxWidth);
	
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
	if(prefAid.movetoTop) { return; }
	timerAid.init('delayFindFieldMaxWidth', findFieldMaxWidth, 0);
};

this.findFieldNoMaxWidth = function() {
	styleAid.unload('findFieldMaxWidth_'+_UUID);
};

this.findFieldMaxWidth = function(e) {
	findFieldNoMaxWidth();
	
	if((!viewSource && !gFindBarInitialized) || gFindBar.hidden
	|| prefAid.findFieldWidth <= minTextboxWidth) { return; }
	
	textboxOverflow = null;
	var overflow = findBarOverflow;
	if(overflow > 0) {
		var maxWidth = Math.max(0, prefAid.findFieldWidth -overflow);
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] .findbar-textbox { max-width: '+maxWidth+'px !important; }\n';
		sscode += '}';
		
		styleAid.load('findFieldMaxWidth_'+_UUID, sscode, true);
		
		textboxOverflow = maxWidth;
	}
};

moduleAid.LOADMODULE = function() {
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
	
	textboxResizersRTL = (getComputedStyle(document.documentElement).getPropertyValue('direction') == 'rtl');
	
	findFieldWidthChanged();
	initFindBar('textboxResizers', setTextboxResizers, unsetTextboxResizers);
	
	listenerAid.add(browserPanel, 'resize', delayFindFieldMaxWidth);
	listenerAid.add(window, 'OpenedFindBar', findFieldMaxWidth);
	listenerAid.add(window, 'FindBarMaybeMoveTop', findFieldNoMaxWidth);
	listenerAid.add(window, 'FindBarMovedTop', findFieldMaxWidth);
	
	findFieldMaxWidth();
};

moduleAid.UNLOADMODULE = function() {
	if(FITFull) {
		deinitFindBar('textboxFITFull');
		return;
	}
	
	findFieldNoMaxWidth();
	
	listenerAid.remove(browserPanel, 'resize', delayFindFieldMaxWidth);
	listenerAid.remove(window, 'OpenedFindBar', findFieldMaxWidth);
	listenerAid.remove(window, 'FindBarMaybeMoveTop', findFieldNoMaxWidth);
	listenerAid.remove(window, 'FindBarMovedTop', findFieldMaxWidth);
	
	deinitFindBar('textboxResizers');
	deinitFindBar('textboxWidth');
};
