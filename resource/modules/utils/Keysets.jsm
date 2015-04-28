Modules.VERSION = '1.5.0';
Modules.UTILS = true;

// Keysets - handles editable keysets for the add-on
//	register(key) - registers a keyset from object key
//		key - (obj):
//			id - (string) id for the key element
//			(either this or oncommand) command - (string) id of command element to trigger
//			(either this or command) oncommand - (string) action to perform
//			keycode - (string) either a key to press (e.g. 'A') or a keycode to watch for (e.g. 'VK_F8'); some keys/keycodes don't work, see below notes.
//			accel: (bool) true if control key (command key on mac) should be pressed
//			shift: (bool) true if shift key should be pressed
//			alt: (bool) true if alt key (option key on mac) should be pressed
//	unregister(key) - unregisters a keyset
//		see register()
//	compareKeys(a, b, justModifiers) - compares two keysets, returns true if they have the same specs (keycode and modifiers), returns false otherwise
//		a - (obj) keyset to compare, see register()
//		b - (obj) keyset to compare, see register()
//		(optional) justModifiers - if true only the modifiers will be compared and the keycode will be ignored, defaults to false
//	exists(key, ignore) -	returns (obj) of existing key if provided keycode and modifiers already exists,
//				returns (bool) false otherwise. Returns null if no browser window is opened.
//		(optional) ignore - if true, keysets registered by this object are ignored, defaults to false
//		see register()
//	translateToConstantCode(input) - returns equivalent DOM_VK_INPUT string name
this.Keysets = {
	registered: [],
	queued: [],
	
	// Numbers don't work, only managed to customize Ctrl+Alt+1 and Ctrl+Alt+6, probably because Ctrl+Alt -> AltGr and Shift+Number inserts an alternate char in most keyboards
	unusable: [
		// Ctrl+Page Up/Down toggles tabs.
		{
			id: 'native_togglesTabs',
			accel: true,
			shift: false,
			alt: false,
			keycode: 'VK_PAGE_UP'
		},
		{
			id: 'native_togglesTabs',
			accel: true,
			shift: false,
			alt: false,
			keycode: 'VK_PAGE_DOWN'
		},
		// Ctrl+F4 closes current tab
		// Alt+F4 closes current window
		{
			id: 'close_current_tab',
			accel: true,
			shift: false,
			alt: false,
			keycode: 'VK_F4'
		},
		{
			id: 'close_current_window',
			accel: false,
			shift: false,
			alt: true,
			keycode: 'VK_F4'
		},
		// F10 Toggles menu bar
		{
			id: 'toggle_menubar',
			accel: false,
			shift: false,
			alt: false,
			keycode: 'VK_F10'
		},
		// F7 toggle caret browsing
		{
			id: 'toggle_caret_browsing',
			accel: false,
			shift: false,
			alt: false,
			keycode: 'VK_F7'
		}
		
	],
	
	// Restricts available key combos, I'm setting all displaying keys and other common ones to at least need the Ctrl key
	allCodesAccel: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', ' ', 'VK_PAGE_UP', 'VK_PAGE_DOWN', 'VK_HOME', 'VK_END', 'VK_UP', 'VK_DOWN', 'VK_LEFT', 'VK_RIGHT', '.', ',', ';', '/', '\\', '=', '+', '-', '*', '<', '>' ],
	
	allCodes: ['VK_F1', 'VK_F2', 'VK_F3', 'VK_F4', 'VK_F5', 'VK_F6', 'VK_F7', 'VK_F8', 'VK_F9', 'VK_F10', 'VK_F11', 'VK_F12', 'VK_F13', 'VK_F14', 'VK_F15', 'VK_F16', 'VK_F17', 'VK_F18', 'VK_F19', 'VK_F20', 'VK_F21', 'VK_F22', 'VK_F23', 'VK_F24'],
	
	translateToConstantCode: function(input) {
		var keycode = input;
		if(!keycode.startsWith('DOM_')) {
			if(!keycode.startsWith('VK_')) {
				switch(keycode) {
					case ' ': keycode = 'SPACE'; break;
					case '.': keycode = 'PERIOD'; break;
					case ',': keycode = 'COMMA'; break;
					case ';': keycode = 'SEMICOLON'; break;
					case '/': keycode = 'SLASH'; break;
					case '\\': keycode = 'BACK_SLASH'; break;
					case '=': keycode = 'EQUALS'; break;
					case '+': keycode = 'PLUS'; break;
					case '-': keycode = 'HYPHEN_MINUS'; break;
					case '*': keycode = 'ASTERISK'; break;
					default: break;
				}
				keycode = 'VK_'+keycode;
			}
			keycode = 'DOM_'+keycode;
		}
		return keycode;
	},
	
	register: function(key, noSchedule) {
		if(!key.id) { return false; }
		key = this.prepareKey(key);
		if(this.isRegistered(key)) { return true; }
		
		this.unregister(key, true);
		
		if(!key.keycode || (!key.command && !key.oncommand)) {
			if(!noSchedule) {
				this.setAllWindows();
			}
			return false;
		}
		
		if(!Windows.callOnMostRecent(function(aWindow) { return true; }, 'navigator:browser')) {
			this.queued.push(key);
			return true;
		}
		
		if(this.isValid(key)) {
			var exists = this.exists(key, true);
			if(!exists) {
				this.registered.push(key);
			} else {
				for(let other of this.delayedOtherKeys) {
					if(other(exists)) {
						aSync(function() {
							if(typeof(Keysets) == 'undefined') { return; }
							Keysets.register(key);
						}, 500);
						return;
					}
				}
			}
		}
		
		if(!noSchedule) {
			this.setAllWindows();
		}
		
		return true;
	},
	
	unregister: function(key, noSchedule) {
		if(!key.id) { return; }
				
		for(var r=0; r<this.registered.length; r++) {
			if(this.registered[r].id == key.id) {
				this.registered.splice(r, 1);
				
				if(!noSchedule) {
					this.setAllWindows();
				}
				return;
			}
		}
	},
	
	compareKeys: function(a, b, justModifiers) {
		if((a.keycode == b.keycode || justModifiers)
		&& a.accel == b.accel
		&& a.shift == b.shift
		&& a.alt == b.alt) {
			return true;
		}
		return false;
	},
	
	// array of methods/occasions where a key could be reported as in/valid by mistake because it belongs to an add-on that hasn't been initialized yet
	delayedOtherKeys: [
		// Tile Tabs Function keys
		function(aKey) { return aKey.id.startsWith('tiletabs-fkey-') && !aKey.hasModifiers; }
	],
	
	prepareKey: function(key) {
		var newKey = {
			id: key.id || null,
			command: key.command || null,
			oncommand: key.oncommand || null,
			keycode: key.keycode || null,
			accel: key.accel || false,
			shift: key.shift || false,
			alt: key.alt || false
		};
		return newKey;
	},
	
	getAllSets: function(aWindow) {
		if(!aWindow) {
			return Windows.callOnMostRecent(this.getAllSets, 'navigator:browser');
		}
		
		var allSets = [];
		
		// Grab all key elements in the document
		var keys = aWindow.document.querySelectorAll('key');
		for(var k of keys) {
			if(!k.id || !k.parentNode || k.parentNode.nodeName != 'keyset' || trueAttribute(k, 'disabled')) { continue; }
			
			var key = {
				id: k.id,
				hasModifiers: k.hasAttribute('modifiers'),
				self: k.getAttribute('Keysets') == objName
			};
			
			var modifiers = k.getAttribute('modifiers').toLowerCase();
			key.accel = (modifiers.indexOf('accel') > -1 || modifiers.indexOf('control') > -1); // control or command key on mac
			key.alt = (modifiers.indexOf('alt') > -1); // option key on mac
			key.shift = (modifiers.indexOf('shift') > -1);
			
			key.keycode = k.getAttribute('keycode') || k.getAttribute('key');
			key.keycode = key.keycode.toUpperCase();
			
			allSets.push(key);
		}
		
		// Alt + % will open certain menus, we need to account for these as well, twice with shift as it also works
		var mainmenu = aWindow.document.getElementById('main-menubar');
		if(mainmenu) {
			for(var menu of mainmenu.childNodes) {
				var key = {
					id: menu.id,
					accel: false,
					alt: true,
					shift: false,
					keycode: menu.getAttribute('accesskey').toUpperCase()
				};
				allSets.push(key);
				
				var key = {
					id: menu.id,
					accel: false,
					alt: true,
					shift: true,
					keycode: menu.getAttribute('accesskey').toUpperCase()
				};
				allSets.push(key);
			}
		}
		
		for(var x of Keysets.unusable) {
			allSets.push(x);
		}
		
		return allSets;		
	},
	
	getAvailable: function(key, moreKeys) {
		key.accel = key.accel || false;
		key.shift = key.shift || false;
		key.alt = key.alt || false;
		
		var allSets = this.getAllSets();
		var available = {};
		
		if(key.accel) {
			codesLoop:
			for(var code of this.allCodesAccel) {
				var check = this.isCodeAvailable(code, key, allSets, moreKeys);
				if(check) {
					available[code] = check;
				}
			}
		}
		
		for(var code of this.allCodes) {
			var check = this.isCodeAvailable(code, key, allSets, moreKeys);
			if(check) {
				available[code] = check;
			}
		}
		
		return available;
	},
	
	isCodeAvailable: function(code, key, allSets, moreKeys) {
		var check = {
			id: null,
			keycode: code,
			accel: key.accel,
			shift: key.shift,
			alt: key.alt
		};
		
		if(moreKeys) {
			for(var more of moreKeys) {
				if(more.disabled) { continue; }
				
				if(this.compareKeys(more, check)) {
					if(more.id == key.id) {
						return check;
					}
					return null;
				}
			}
		}
		
		var exists = this.exists(check, false, allSets);
		if(exists) {
			if(moreKeys) {
				for(var more of moreKeys) {
					if(more.disabled) { continue; }
					
					if(more.id == exists.id) {
						if(!this.compareKeys(more, exists)) {
							return check;
						}
						break;
					}
				}
			}
			return null;
		}
		
		return check;
	},
	
	exists: function(key, ignore, allSets) {
		if(!allSets) { allSets = this.getAllSets(); }
		if(!allSets) { return null; }
		
		for(var k of allSets) {
			if(ignore && k.self) {
				continue;
			}
			
			if(this.compareKeys(k, key)) {
				return k;
			}
		}
		return false;
	},
	
	isValid: function(key) {
		for(var code of this.allCodes) {
			if(code == key.keycode) {
				return true;
			}
		}
		
		if(key.accel) {
			for(var code of this.allCodesAccel) {
				if(code == key.keycode) {
					return true;
				}
			}
		}
		
		return false;
	},
	
	isRegistered: function(key) {
		for(var k of this.registered) {
			if(key.id == k.id
			&& key.command == k.command
			&& key.oncommand == k.oncommand
			&& this.compareKeys(k, key)) {
				return true;
			}
		}
		return false;
	},
	
	setAllWindows: function() {
		Windows.callOnAll(this.setWindow, 'navigator:browser');
	},
	
	setWindow: function(aWindow) {
		if(Keysets.queued.length > 0) {
			while(Keysets.queued.length > 0) {
				var key = Keysets.queued.shift();
				Keysets.register(key, true);
			}
			Keysets.setAllWindows();
			return;
		}
			
		var keyset = aWindow.document.getElementById(objName+'-keyset');
		if(keyset) {
			keyset.remove();
		}
		
		if(UNLOADED) { return; }
		
		if(Keysets.registered.length > 0) {
			var keyset = aWindow.document.createElement('keyset');
			keyset.id = objName+'-keyset';
			
			for(var r of Keysets.registered) {
				var key = aWindow.document.createElement('key');
				key.id = r.id;
				key.setAttribute('Keysets', objName);
				key.setAttribute((r.keycode.startsWith('VK_') ? 'keycode' : 'key'), r.keycode);
				toggleAttribute(key, 'command', r.command, r.command);
				toggleAttribute(key, 'oncommand', r.oncommand, r.oncommand);
				
				if(r.accel || r.shift || r.alt) {
					var modifiers = [];
					if(r.accel) { modifiers.push('accel'); }
					if(r.shift) { modifiers.push('shift'); }
					if(r.alt) { modifiers.push('alt'); }
					key.setAttribute('modifiers', modifiers.join(','));
				}
				
				keyset.appendChild(key);
			}
			
			aWindow.document.getElementById('main-window').appendChild(keyset);
		}
	}
};

Modules.LOADMODULE = function() {
	Windows.register(Keysets.setWindow, 'domwindowopened', 'navigator:browser');
};

Modules.UNLOADMODULE = function() {
	Windows.unregister(Keysets.setWindow, 'domwindowopened', 'navigator:browser');
	Keysets.setAllWindows(); // removes the keyset object if the add-on has been unloaded
};
