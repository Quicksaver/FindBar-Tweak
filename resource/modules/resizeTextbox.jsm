moduleAid.VERSION = '1.0.0';

this.__defineGetter__('leftTextboxResizer', function() { return gFindBar.getElement('find-left-resizer'); });
this.__defineGetter__('rightTextboxResizer', function() { return gFindBar.getElement('find-right-resizer'); });

this.textboxResizersRTL = false;

this.saveTextboxWidth = function() {
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
		return;
	}
	
	prefAid.findFieldWidth = parseInt(gFindBar._findField.getAttribute('width'));
	
	delayTextboxResizersRedrawCorners();
};

this.setTextboxResizers = function() {
	if(leftTextboxResizer && rightTextboxResizer) { return; }
	
	gFindBar._findField.id = objName+'-find-textbox';
	setAttribute(gFindBar._findField, 'width', prefAid.findFieldWidth);
	
	objectWatcher.addAttributeWatcher(gFindBar._findField, 'width', saveTextboxWidth);
	
	var leftResizer = document.createElement('resizer');
	setAttribute(leftResizer, 'class', 'find-textbox-resizer');
	setAttribute(leftResizer, 'anonid', 'find-left-resizer');
	setAttribute(leftResizer, 'element', objName+'-find-textbox');
	
	var rightResizer = leftResizer.cloneNode(true);
	setAttribute(rightResizer, 'anonid', 'find-right-resizer');
	
	// RTL layouts are completely reversed
	setAttribute(leftResizer, 'dir', (textboxResizersRTL ? 'right' : 'left'));
	setAttribute(rightResizer, 'dir', (textboxResizersRTL ? 'left' : 'right'));
	
	gFindBar.getElement("findbar-container").insertBefore(leftResizer, gFindBar._findField);
	gFindBar.getElement("findbar-container").insertBefore(rightResizer, gFindBar._findField.nextSibling);
	
	listenerAid.add(leftTextboxResizer, 'dblclick', dblClickTextboxResizer, true);
	listenerAid.add(rightTextboxResizer, 'dblclick', dblClickTextboxResizer, true);
	
	chooseTextboxResizer();
	aSync(chooseTextboxResizer, 500); // Mac OSX wouldn't hide one of the resizers on startup for some reason
};

this.chooseTextboxResizer = function() {
	if(leftTextboxResizer) {
		leftTextboxResizer.hidden = (!textboxResizersRTL && !prefAid.movetoRight) || (textboxResizersRTL && prefAid.movetoRight);
	}
	if(rightTextboxResizer) {
		rightTextboxResizer.hidden = (!textboxResizersRTL && prefAid.movetoRight) || (textboxResizersRTL && !prefAid.movetoRight);
	}
};

this.delayTextboxResizersRedrawCorners = function() {
	if(!prefAid.movetoTop) { return; }
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
	
	listenerAid.add(gFindBar, 'OpenedFindBar', setTextboxResizers);
	prefAid.listen('movetoRight', chooseTextboxResizer);
	
	setTextboxResizers();
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(gFindBar, 'OpenedFindBar', setTextboxResizers);
	prefAid.listen('movetoRight', chooseTextboxResizer);
	objectWatcher.removeAttributeWatcher(gFindBar._findField, 'width', saveTextboxWidth);
	
	listenerAid.remove(leftTextboxResizer, 'dblclick', dblClickTextboxResizer, true);
	listenerAid.remove(rightTextboxResizer, 'dblclick', dblClickTextboxResizer, true);
	if(leftTextboxResizer) { leftTextboxResizer.parentNode.removeChild(leftTextboxResizer); }
	if(rightTextboxResizer) { rightTextboxResizer.parentNode.removeChild(rightTextboxResizer); }
	
	gFindBar._findField.id = '';
	removeAttribute(gFindBar._findField, 'width');
};
