moduleAid.VERSION = '1.1.0';

this.textboxResizersRTL = false;
this.textboxResizing = false;

this.saveTextboxWidth = function(obj, prop, oldVal, newVal) {
	if(textboxResizing || oldVal == newVal) { return; }
	textboxResizing = true;
	
	var width = parseInt(gFindBar._findField.getAttribute('width'));
	var max = (prefAid.hideLabels) ? 1000 : 680;
	if(width < minTextboxWidth || width > max) {
		if(width < minTextboxWidth) {
			setAttribute(gFindBar._findField, 'width', minTextboxWidth);
			prefAid.findFieldWidth = minTextboxWidth;
		}
		else {
			setAttribute(gFindBar._findField, 'width', max);
			prefAid.findFieldWidth = max;
		}
		
		textboxResizing = false;
		return;
	}
	
	prefAid.findFieldWidth = parseInt(gFindBar._findField.getAttribute('width'));
	
	delayTextboxResizersRedrawCorners();
	
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
	if(!viewSource && perTabFB) {
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
	
	leftResizer.parentNode.removeChild(leftResizer);
	rightResizer.parentNode.removeChild(rightResizer);
	
	bar._findField.id = '';
};

this.delayTextboxResizersRedrawCorners = function() {
	if(!prefAid.movetoTop || typeof(moveTop) == 'undefined') { return; }
	timerAid.init('delayTextboxResizersRedrawCorners', moveTop, 100);
};

this.dblClickTextboxResizer = function(e) {
	e.preventDefault();
	var width = parseInt(gFindBar._findField.getAttribute('width'));
	var maxCompare = (prefAid.hideLabels) ? 560 : 480;
	var max = (prefAid.hideLabels) ? '1000' : '680';
	if(width >= maxCompare) {
		setAttribute(gFindBar._findField, 'width', minTextboxWidth);
	} else {
		setAttribute(gFindBar._findField, 'width', max);
	}
	return false;
};

moduleAid.LOADMODULE = function() {
	textboxResizersRTL = (getComputedStyle((viewSource) ? viewSource : $('main-window')).getPropertyValue('direction') == 'rtl');
	
	findFieldWidthChanged();
	initFindBar('textboxResizers', setTextboxResizers, unsetTextboxResizers);
};

moduleAid.UNLOADMODULE = function() {
	deinitFindBar('textboxResizers');
	deinitFindBar('textboxWidth');
};
