// VERSION 2.2.1

this.textboxResizers = {
	resizing: false,
	
	get findFieldMaxWidth() {
		// we should make sure we leave enough space for the status description
		let statusText = gFindBar._findStatusDesc.textContent;
		let statusHidden = gFindBar._findStatusDesc.hidden;
		gFindBar._findStatusDesc.textContent = (Prefs.useCounter) ? gFindBar._notFoundStr : gFindBar._wrappedToBottomStr;
		gFindBar._findStatusDesc.hidden = false;
		
		// if the findbar is at the top, we don't want its actual width, but the available space it can occupy,
		// so we force it to extend to that width
		if(Prefs.movetoTop) {
			setAttribute(gFindBar, 'extend', 'true');
		}
		
		// trick to make the findField extend to all its available width, we then take its width at that point as its maximum width possible
		setAttribute(gFindBar._findField, 'flex', '1');
		setAttribute(gFindBar._findField.parentNode, 'flex', '1');
		
		let fullWidth = gFindBar._findField.clientWidth;
		
		removeAttribute(gFindBar._findField, 'flex');
		removeAttribute(gFindBar._findField.parentNode, 'flex');
		if(Prefs.movetoTop) {
			removeAttribute(gFindBar, 'extend');
		}
		gFindBar._findStatusDesc.textContent = statusText;
		gFindBar._findStatusDesc.hidden = statusHidden;
		
		return fullWidth;
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'resize':
				this.delayMaxWidth();
				break;
			
			case 'OpenedFindBar':
			case 'mousedown':
				this.maxWidth();
				gFindBar._findField._dragging = true;
				Listeners.add(e.target, 'mouseup', this);
				break;
			
			case 'mouseup':
				Listeners.remove(e.target, 'mouseup', this);
				gFindBar._findField._dragging = false;
				break;
			
			case 'dblclick':
				this.dblClick(e);
				break;
		}
	},
	
	attrWatcher: function(obj, prop, oldVal, newVal) {
		if(this.resizing || oldVal == newVal) { return; }
		this.resizing = true;
		
		let width = parseInt(gFindBar._findField.getAttribute('width'));
		let max = 4000;
		
		if(width < minTextboxWidth || width > max) {
			Prefs.findFieldWidth = (width < minTextboxWidth) ? minTextboxWidth : max;
			this.widthChanged();
			this.resizing = false;
			return;
		}
		
		Prefs.findFieldWidth = parseInt(gFindBar._findField.getAttribute('width'));
		this.delayMaxWidth();
		this.widthChanged();
		
		this.resizing = false;
	},
	
	widthChanged: function() {
		findbar.init('textboxWidth',
			function(bar) {
				setAttribute(bar._findField, 'width', Prefs.findFieldWidth);
			},
			function(bar) {
				if(bar._destroying) { return; }
				
				removeAttribute(bar._findField, 'width');
			},
			true
		);
	},
	
	dblClick: function(e) {
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
	},
	
	delayMaxWidth: function() {
		if(Prefs.movetoTop) { return; }
		Timers.init('textboxResizersDelayMaxWidth', () => { this.maxWidth(); }, 0);
	},
	
	noMaxWidth: function() {
		Styles.unload('findFieldMaxWidth_'+_UUID);
	},
	
	maxWidth: function() {
		if(!gFindBarInitialized || gFindBar.hidden || gFindBar._findField._dragging
		|| Prefs.findFieldWidth <= minTextboxWidth) { return; }
		
		// we can't have previous max-widths affecting this value
		this.noMaxWidth();
		
		let maxWidth = this.findFieldMaxWidth;
		
		let sscode = '\
			@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
			@-moz-document url("'+document.baseURI+'") {\n\
				window['+objName+'_UUID="'+_UUID+'"] .findbar-textbox { max-width: '+maxWidth+'px; }\n\
			}';
		
		Styles.load('findFieldMaxWidth_'+_UUID, sscode, true);
	}
};

Modules.LOADMODULE = function() {
	// in FITFull we use flex to always extend the findField, so none of the rest is needed
	if(FITFull) {
		findbar.init('textboxFITFull',
			function(bar) {
				setAttribute(bar._findField, 'flex', '1');
				setAttribute(bar._findField.parentNode, 'flex', '1');
			},
			function(bar) {
				if(bar._destroying) { return; }
				
				removeAttribute(bar._findField, 'flex');
				removeAttribute(bar._findField.parentNode, 'flex');
			}
		);
		return;
	}
	
	textboxResizers.widthChanged();
	
	findbar.init('textboxResizers',
		function(bar) {
			bar._findField._dragging = false;
			bar._findField.id = objName+'-find-textbox';
			if(!viewSource) {
				bar._findField.id += '-'+gBrowser.getNotificationBox(bar.browser).id;
			}
			
			Watchers.addAttributeWatcher(bar._findField, 'width', textboxResizers);
			
			let leftResizer = document.createElement('resizer');
			setAttribute(leftResizer, 'class', 'find-textbox-resizer');
			setAttribute(leftResizer, 'anonid', 'find-left-resizer');
			setAttribute(leftResizer, 'element', bar._findField.id);
			Listeners.add(leftResizer, 'dblclick', textboxResizers);
			Listeners.add(leftResizer, 'mousedown', textboxResizers);
			
			let rightResizer = leftResizer.cloneNode(true);
			setAttribute(rightResizer, 'anonid', 'find-right-resizer');
			Listeners.add(rightResizer, 'dblclick', textboxResizers);
			Listeners.add(rightResizer, 'mousedown', textboxResizers);
			
			// RTL layouts are completely reversed
			setAttribute(leftResizer, 'dir', (RTL ? 'right' : 'left'));
			setAttribute(rightResizer, 'dir', (RTL ? 'left' : 'right'));
			
			bar._findField.parentNode.insertBefore(leftResizer, bar._findField);
			bar._findField.parentNode.insertBefore(rightResizer, bar._findField.nextSibling);
		},
		function(bar) {
			let leftResizer = bar.getElement("find-left-resizer");
			let rightResizer = bar.getElement("find-right-resizer");
			
			Listeners.remove(leftResizer, 'dblclick', textboxResizers);
			Listeners.remove(leftResizer, 'mousedown', textboxResizers);
			Listeners.remove(rightResizer, 'dblclick', textboxResizers);
			Listeners.remove(rightResizer, 'mousedown', textboxResizers);
			
			if(bar._destroying) { return; }
			
			Watchers.removeAttributeWatcher(bar._findField, 'width', textboxResizers);
			
			bar.getElement("find-left-resizer").remove();
			bar.getElement("find-right-resizer").remove();
			
			bar._findField.id = '';
			delete bar._findField._dragging;
		}
	);
	
	Listeners.add(window, 'resize', textboxResizers);
	Listeners.add(window, 'OpenedFindBar', textboxResizers);
	
	textboxResizers.maxWidth();
};

Modules.UNLOADMODULE = function() {
	if(FITFull) {
		findbar.deinit('textboxFITFull');
		return;
	}
	
	textboxResizers.noMaxWidth();
	
	Listeners.remove(window, 'resize', textboxResizers);
	Listeners.remove(window, 'OpenedFindBar', textboxResizers);
	
	findbar.deinit('textboxResizers');
	findbar.deinit('textboxWidth');
};
