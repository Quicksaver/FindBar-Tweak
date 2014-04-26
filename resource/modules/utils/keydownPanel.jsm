moduleAid.VERSION = '1.2.1';
moduleAid.LAZY = true;

// keydownPanel - 	Panel elements don't support keyboard navigation by default; this object fixes that.
// 			This aid does NOT self-clean, so make sure to remove every call and set object on it.
//			However, the methods are kept in the panel object, and listenerAid self-cleans, so it should be ok though, as long as that doesn't fail and the objects
//			are fully removed.
//			To also enable a keyset that toggles (closes) the panel, supply it to the panel object as its ._toggleKeyset property, in the form of:
//				key - (obj):
//					keycode - (string) either a key to press (e.g. 'A') or a keycode to watch for (e.g. 'VK_F8')
//					accel: (bool) true if control key (command key on mac) should be pressed
//					shift: (bool) true if shift key should be pressed
//					alt: (bool) true if alt key (option key on mac) should be pressed
//	setupPanel(panel) - sets up a panel element to be able to use keyboard navigation
//		panel - (xul element): panel element to be set
//	unsetPanel(panel) - removes keyboard navigation from a panel
//		see setupPanel()
//	menuItemAccesskeyCode(str, e) - this returns the keycode of str; will return null for non-letters
//		str - (str) string value of a letter to get the keycode
//		e - (event obj) from which to return the keycodes
this.keydownPanel = {
	setupPanel: function(panel) {
		// already set
		if(!panel || panel._keydownPanel) { return; }
		
		panel._keydownPanel = function(e) {
			// Let's make sure
			if(panel.state != 'open' && !trueAttribute(panel, 'current')) {
				listenerAid.remove(window, 'keydown', panel._keydownPanel, true);
				return;
			}
			
			// if this var exists, it means this keyset should be used to toggle the panel as well
			if(panel._toggleKeyset) {
				var keycode = keysetAid.translateToConstantCode(panel._toggleKeyset.keycode);
				
				if(e[keycode] && e[keycode] == e.which
				&& panel._toggleKeyset.shift == e.shiftKey
				&& panel._toggleKeyset.alt == e.altKey
				&& panel._toggleKeyset.accel == ((Services.appinfo.OS == 'Darwin') ? e.metaKey : e.ctrlKey)) {
					e.preventDefault();
					e.stopPropagation();
					
					if(panel.hidePopup) {
						panel.hidePopup();
					} else {
						keydownPanel.closeSubView();
					}
					return;
				}
			}
			
			switch(e.which) {
				case e.DOM_VK_A: case e.DOM_VK_B: case e.DOM_VK_C: case e.DOM_VK_D: case e.DOM_VK_E: case e.DOM_VK_F: case e.DOM_VK_G: case e.DOM_VK_H: case e.DOM_VK_I: case e.DOM_VK_J: case e.DOM_VK_K: case e.DOM_VK_L: case e.DOM_VK_M: case e.DOM_VK_N: case e.DOM_VK_O: case e.DOM_VK_P: case e.DOM_VK_Q: case e.DOM_VK_R: case e.DOM_VK_S: case e.DOM_VK_T: case e.DOM_VK_U: case e.DOM_VK_V: case e.DOM_VK_W: case e.DOM_VK_X: case e.DOM_VK_Y: case e.DOM_VK_Z:
					var items = panel.querySelectorAll('menuitem,toolbarbutton.subviewbutton');
					for(var i=0; i<items.length; i++) {
						if(keydownPanel.menuItemAccesskeyCode(items[i].getAttribute('accesskey'), e) == e.which) {
							e.preventDefault();
							e.stopPropagation();
							items[i].doCommand();
							keydownPanel.closeSubView();
							break;
						}
					}
					break;
				
				case e.DOM_VK_UP:
				case e.DOM_VK_DOWN:
				case e.DOM_VK_HOME:
				case e.DOM_VK_END:
					e.preventDefault();
					e.stopPropagation();
					listenerAid.add(panel, 'mouseover', panel._mouseOverPanel);
					listenerAid.add(panel, 'mousemove', panel._mouseOverPanel);
					
					var items = panel.querySelectorAll('menuitem,toolbarbutton.subviewbutton');
					var active = -1;
					for(var i=0; i<items.length; i++) {
						var attr = (items[i].localName == 'menuitem') ? '_moz-menuactive' : 'focused';
						if(trueAttribute(items[i], attr)) {
							active = i;
							break;
						}
					}
					
					if(items[active]) {
						var attr = (items[active].localName == 'menuitem') ? '_moz-menuactive' : 'focused';
						if(attr == 'focused') {
							items[active].blur();
							items[active].style.MozUserFocus = '';
						}
						removeAttribute(items[active], attr);
					}
					
					switch(e.which) {
						case e.DOM_VK_UP:
							active--;
							if(active < 0) { active = items.length -1; }
							break;
						case e.DOM_VK_DOWN:
							active++;
							if(active >= items.length) { active = 0; }
							break;
						case e.DOM_VK_HOME:
							active = 0;
							break;
						case e.DOM_VK_END:
							active = items.length -1;
							break;
					}
					
					var attr = (items[active].localName == 'menuitem') ? '_moz-menuactive' : 'focused';
					setAttribute(items[active], attr, 'true');
					if(attr == 'focused') {
						items[active].style.MozUserFocus = 'normal';
						items[active].focus();
					}
					
					break;
				
				case e.DOM_VK_RETURN:
					var items = panel.querySelectorAll('menuitem,toolbarbutton.subviewbutton');
					for(var i=0; i<items.length; i++) {
						var attr = (items[i].localName == 'menuitem') ? '_moz-menuactive' : 'focused';
						if(trueAttribute(items[i], attr)) {
							e.preventDefault();
							e.stopPropagation();
							if(attr == 'focused') {
								items[i].blur();
								items[i].style.MozUserFocus = '';
							}
							
							items[i].doCommand();
							keydownPanel.closeSubView();
							break;
						}
					}
					break;
				
				default: break;
			}
		};
		
		panel._mouseOverPanel = function() {
			listenerAid.remove(panel, 'mouseover', panel._mouseOverPanel);
			listenerAid.remove(panel, 'mousemove', panel._mouseOverPanel);
			var items = panel.querySelectorAll('menuitem,toolbarbutton.subviewbutton');
			for(var i=0; i<items.length; i++) {
				var attr = (items[i].localName == 'menuitem') ? '_moz-menuactive' : 'focused';
				if(attr == 'focused') {
					items[i].blur();
					items[i].style.MozUserFocus = '';
				}
				removeAttribute(items[i], attr);
			}
		};
		
		panel._panelShown = function(e) {
			if(e.target != panel) { return; }
			
			listenerAid.add(window, 'keydown', panel._keydownPanel, true);
		};
		
		panel._panelHidden = function(e) {;
			if(e.target != panel) { return; }
			
			listenerAid.remove(panel, 'mouseover', panel._mouseOverPanel);
			listenerAid.remove(panel, 'mousemove', panel._mouseOverPanel);
			listenerAid.remove(window, 'keydown', panel._keydownPanel, true);
		};	
		
		if(panel.nodeName == 'panelview' && isAncestor(panel, window.PanelUI.multiView)) {
			listenerAid.add(panel, 'ViewShowing', panel._panelShown);
			listenerAid.add(panel, 'ViewHiding', panel._panelHidden);
		} else {
			listenerAid.add(panel, 'popupshown', panel._panelShown);
			listenerAid.add(panel, 'popuphidden', panel._panelHidden);
		}
	},
	
	unsetPanel: function(panel) {
		// not set
		if(!panel || !panel._keydownPanel) { return; }
		
		listenerAid.remove(panel, 'mouseover', panel._mouseOverPanel);
		listenerAid.remove(panel, 'mousemove', panel._mouseOverPanel);
		listenerAid.remove(window, 'keydown', panel._keydownPanel, true);
		
		if(panel.nodeName == 'panelview' && isAncestor(panel, window.PanelUI.multiView)) {
			listenerAid.remove(panel, 'ViewShowing', panel._panelShown);
			listenerAid.remove(panel, 'ViewHiding', panel._panelHidden);
		} else {
			listenerAid.remove(panel, 'popupshown', panel._panelShown);
			listenerAid.remove(panel, 'popuphidden', panel._panelHidden);
		}
		
		delete panel._keydownPanel;
		delete panel._mouseOverPanel;
		delete panel._panelShown;
		delete panel._panelHidden;
	},
	
	closeSubView: function() {
		window.PanelUI.multiView.showMainView();
	},
	
	menuItemAccesskeyCode: function(str, e) {
		if(!str) return null;
		str = str.toLowerCase();
		if(str == 'a') return e.DOM_VK_A; if(str == 'b') return e.DOM_VK_B; if(str == 'c') return e.DOM_VK_C; if(str == 'd') return e.DOM_VK_D; if(str == 'e') return e.DOM_VK_E; if(str == 'f') return e.DOM_VK_F; if(str == 'g') return e.DOM_VK_G; if(str == 'h') return e.DOM_VK_H; if(str == 'i') return e.DOM_VK_I; if(str == 'j') return e.DOM_VK_J; if(str == 'k') return e.DOM_VK_K; if(str == 'l') return e.DOM_VK_L; if(str == 'm') return e.DOM_VK_M; if(str == 'n') return e.DOM_VK_N; if(str == 'o') return e.DOM_VK_O; if(str == 'p') return e.DOM_VK_P; if(str == 'q') return e.DOM_VK_Q; if(str == 'r') return e.DOM_VK_R; if(str == 's') return e.DOM_VK_S; if(str == 't') return e.DOM_VK_T; if(str == 'u') return e.DOM_VK_U; if(str == 'v') return e.DOM_VK_V; if(str == 'w') return e.DOM_VK_W; if(str == 'x') return e.DOM_VK_X; if(str == 'y') return e.DOM_VK_Y; if(str == 'z') return e.DOM_VK_Z;
		return null;
	}
};
