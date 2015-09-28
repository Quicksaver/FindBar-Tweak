Modules.VERSION = '2.0.3';

this.textboxResizers = {
	resizing: false,
	overflow: null,
	
	get findBarOverflow() {
		return Math.max(0, gFindBar.scrollWidth -((Prefs.movetoTop && typeof(moveTopStyle) != 'undefined' && moveTopStyle) ? moveTopStyle.maxWidth : gFindBar.clientWidth));
	},
	
	handleEvent: function(e) {
		switch(e.type) {
			case 'resize':
				this.delayMaxWidth();
				break;
			
			case 'OpenedFindBar':
			case 'FindBarMovedTop':
				this.maxWidth();
				break;
			
			case 'FindBarMaybeMoveTop':
				this.noMaxWidth();
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
		
		if(Prefs.movetoTop && typeof(moveTop) != 'undefined') {
			moveTop();
		}
		
		this.resizing = false;
	},
	
	widthChanged: function() {
		initFindBar('textboxWidth',
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
			
			let sscode =
				'@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n' +
				'@-moz-document url("'+document.baseURI+'") {\n' +
				'	window['+objName+'_UUID="'+_UUID+'"] .findbar-textbox { max-width: '+this.overflow+'px; }\n' +
				'}';
			
			Styles.load('findFieldMaxWidth_'+_UUID, sscode, true);
		}
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
				if(bar._destroying) { return; }
				
				removeAttribute(bar._findField, 'flex');
				removeAttribute(bar._findField.parentNode, 'flex');
			}
		);
		return;
	}
	
	textboxResizers.widthChanged();
	
	initFindBar('textboxResizers',
		function(bar) {
			bar._findField.id = objName+'-find-textbox';
			if(!viewSource) {
				bar._findField.id += '-'+gBrowser.getNotificationBox(bar.browser).id;
			}
			
			Watchers.addAttributeWatcher(bar._findField, 'width', textboxResizers);
			
			var leftResizer = document.createElement('resizer');
			setAttribute(leftResizer, 'class', 'find-textbox-resizer');
			setAttribute(leftResizer, 'anonid', 'find-left-resizer');
			setAttribute(leftResizer, 'element', bar._findField.id);
			setAttribute(leftResizer, 'ondblclick', objName+'.textboxResizers.dblClick(event);');
			
			var rightResizer = leftResizer.cloneNode(true);
			setAttribute(rightResizer, 'anonid', 'find-right-resizer');
			
			// RTL layouts are completely reversed
			setAttribute(leftResizer, 'dir', (RTL ? 'right' : 'left'));
			setAttribute(rightResizer, 'dir', (RTL ? 'left' : 'right'));
			
			bar._findField.parentNode.insertBefore(leftResizer, bar._findField);
			bar._findField.parentNode.insertBefore(rightResizer, bar._findField.nextSibling);
		},
		function(bar) {
			if(bar._destroying) { return; }
			
			Watchers.removeAttributeWatcher(bar._findField, 'width', textboxResizers);
			
			bar.getElement("find-left-resizer").remove();
			bar.getElement("find-right-resizer").remove();
			
			bar._findField.id = '';
		}
	);
	
	Listeners.add(window, 'resize', textboxResizers);
	Listeners.add(window, 'OpenedFindBar', textboxResizers);
	Listeners.add(window, 'FindBarMaybeMoveTop', textboxResizers);
	Listeners.add(window, 'FindBarMovedTop', textboxResizers);
	
	textboxResizers.maxWidth();
};

Modules.UNLOADMODULE = function() {
	if(FITFull) {
		deinitFindBar('textboxFITFull');
		return;
	}
	
	textboxResizers.noMaxWidth();
	
	Listeners.remove(window, 'resize', textboxResizers);
	Listeners.remove(window, 'OpenedFindBar', textboxResizers);
	Listeners.remove(window, 'FindBarMaybeMoveTop', textboxResizers);
	Listeners.remove(window, 'FindBarMovedTop', textboxResizers);
	
	deinitFindBar('textboxResizers');
	deinitFindBar('textboxWidth');
};
