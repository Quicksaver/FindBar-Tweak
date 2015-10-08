Modules.VERSION = '2.1.0';

this.textboxResizers = {
	resizing: false,
	overflow: null,
	
	get findBarOverflow() {
		let fullwidth = gFindBar.clientWidth;
		
		// if the findbar is at the top, we don't want its actual width, but the available space it can occupy
		if(Prefs.movetoTop) {
			let barStyle = getComputedStyle(gFindBar);
			fullwidth = gFindBar.parentNode.clientWidth -barStyle.marginLeft -barStyle.marginRight;
		}
		
		// we should make sure we leave enough space for the status description
		let statusText = gFindBar._findStatusDesc.textContent;
		let statusHidden = gFindBar._findStatusDesc.hidden;
		gFindBar._findStatusDesc.textContent = (Prefs.useCounter) ? gFindBar._notFoundStr : gFindBar._wrappedToBottomStr;
		gFindBar._findStatusDesc.hidden = false;
		
		let scrollWidth = gFindBar.scrollWidth;
		
		gFindBar._findStatusDesc.textContent = statusText;
		gFindBar._findStatusDesc.hidden = statusHidden;
		
		return Math.max(0, scrollWidth -fullwidth);
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'resize':
				this.delayMaxWidth();
				break;
			
			case 'OpenedFindBar':
			case 'mousedown':
				this.maxWidth();
				break;
			
			case 'dblclick':
				this.dblClick(e);
				break;
		}
	},
	
	attrWatcher: function(obj, prop, oldVal, newVal) {
		if(this.resizing || oldVal == newVal) { return; }
		this.resizing = true;
		
		var width = parseInt(gFindBar._findField.getAttribute('width'));
		var max = 4000;
		
		if(width < minTextboxWidth || width > max) {
			Prefs.findFieldWidth = (width < minTextboxWidth) ? minTextboxWidth : max;
			this.widthChanged();
			this.resizing = false;
			return;
		}
		
		if(this.overflow && width >= this.overflow) {
			Prefs.findFieldWidth = this.overflow;
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
		this.noMaxWidth();
		
		if((!viewSource && !gFindBarInitialized) || gFindBar.hidden
		|| Prefs.findFieldWidth <= minTextboxWidth) { return; }
		
		this.overflow = null;
		var overflow = this.findBarOverflow;
		if(overflow > 0) {
			this.overflow = Math.max(0, Prefs.findFieldWidth -overflow);
			
			let sscode = '\
				@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n\
				@-moz-document url("'+document.baseURI+'") {\n\
					window['+objName+'_UUID="'+_UUID+'"] .findbar-textbox { max-width: '+this.overflow+'px; }\n\
				}';
			
			Styles.load('findFieldMaxWidth_'+_UUID, sscode, true);
		}
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
