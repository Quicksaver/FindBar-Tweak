Modules.VERSION = '1.0.1';

this.about = {
	kNS: 'http://www.w3.org/1999/xhtml',
	
	changelog: null,
	
	handleEvent: function(e) {
		// only do this for links and checkboxes
		if(e.target.nodeName != 'a' && e.target.nodeName != 'html:a' && e.target.nodeName != 'checkbox') { return; }
		
		if(e.target == document.activeElement) {
			document.activeElement.blur();
		}
	},
	
	paneShown: function() {
		this.api();
	},
	
	init: function() {
		// place the current version in the page
		$('currentVersion').textContent = $('currentVersion').textContent.replace('{v}', AddonData.version);
		removeAttribute($('version'), 'invisible');
		
		// fill in the links with data from the add-on; these come directly from defaults.js (overriden from the declared vars in bootstrap.js)
		setAttribute($('paneAbout-homepage'), 'href', addonUris.homepage);
		setAttribute($('paneAbout-support'), 'href', addonUris.support);
		setAttribute($('paneAbout-fullchangelog'), 'href', addonUris.fullchangelog);
		setAttribute($('paneAbout-email'), 'href', addonUris.email);
		setAttribute($('paneAbout-profile'), 'href', addonUris.profile);
		setAttribute($('paneAbout-development'), 'href', addonUris.development);
		
		// check to see if there is a more recent version available
		this.checkUpdates();
		
		// need to get the changelog in order to populate the list of changes
		xmlHttpRequest('resource://'+objPathString+'/changelog.json', (xmlhttp) => {
			if(xmlhttp.readyState == 4 && xmlhttp.response) {
				this.changelog = xmlhttp.response;
				
				this.fillChangeLog(PrefPanes.previousVersion);
				PrefPanes.previousVersion = null;
			}
		}, 'JSON');
		
		// init AddToAny stuff (share buttons)
		this.A2A();
		
		// schedule the API check for only when the About pane is actually shown
		categories.watchPane('paneAbout', this);
		
		// these are so we can click html links in a xul window without their outline becoming permanent (until clicking another link)
		Listeners.add(window, 'mouseup', this);
		Listeners.add(window, 'mouseover', this, true);
	},
	
	uninit: function() {
		Listeners.remove(window, 'mouseup', this);
		Listeners.remove(window, 'mouseover', this, true);
		
		categories.unwatchPane('paneAbout', this);
	},
	
	checkUpdates: function() {
		Addon.findUpdates({
			onUpdateAvailable: function() {
				$('needsupdate').hidden = false;
			},
			onNoUpdateAvailable: function() {
				$('uptodate').hidden = false;
			}
		}, AddonManager.UPDATE_WHEN_PERIODIC_UPDATE);
	},
	
	// this fills the notes section of the page
	fillChangeLog: function(version) {
		if(!this.changelog.current) { return; }
		
		// show the all versions link by default
		$('allVersions').hidden = false;
		
		if(!version) {
			version = this.changelog.current;
		}
		
		var notes = $('notes');
		
		// clean up that section before we add everything to it
		while(notes.firstChild) {
			notes.firstChild.remove();
		}
			
		for(let release in this.changelog.releases) {
			if(Services.vc.compare(release, version) > 0 || (!PrefPanes.previousVersion && Services.vc.compare(release, version) == 0)) {
				var section = document.createElementNS(this.kNS, 'section');
				section.id = release;
				section.classList.add('notes');
				
				var h3 = document.createElementNS(this.kNS, 'h3');
				h3.textContent = 'Version '+release+' - Release Notes';
				section.appendChild(h3);
				
				var h4 = document.createElementNS(this.kNS, 'h4');
				h4.textContent = 'Released '+this.changelog.releases[release].date;
				section.appendChild(h4);
				
				var ul = document.createElementNS(this.kNS, 'ul');
				ul.classList.add('notes-items');
				section.appendChild(ul);
				
				for(let note of this.changelog.releases[release].notes) {
					var li = document.createElementNS(this.kNS, 'li');
					
					if(note[0] != "") {
						var b = document.createElementNS(this.kNS, 'b');
						b.classList.add(note[0]);
						b.textContent = note[0];
						li.appendChild(b);
						li.classList.add('tagged');
					}
					
					var p = document.createElementNS(this.kNS, 'p');
					p.innerHTML = note[1]; // just string text, with some <a> tags on occasion; all these can be found in the resource/changelog.json file
					li.appendChild(p);
					
					ul.appendChild(li);
				}
				
				var sibling = notes.firstChild;
				while(sibling && (sibling.id == 'knownissues' || Services.vc.compare(release, sibling.id) < 0)) {
					sibling = sibling.nextSibling;
				}
				notes.insertBefore(section, sibling);
				
				// if we're printing the current release, also print the known issues if there are any
				if(release == this.changelog.current && this.changelog.knownissues) {
					var section = document.createElementNS(this.kNS, 'section');
					section.id = 'knownissues';
					section.classList.add('notes');
					
					var h3 = document.createElementNS(this.kNS, 'h3');
					h3.textContent = 'Known Issues';
					section.appendChild(h3);
					
					var ul = document.createElementNS(this.kNS, 'ul');
					ul.classList.add('notes-items');
					section.appendChild(ul);
					
					for(let issue of this.changelog.knownissues) {
						var li = document.createElementNS(this.kNS, 'li');
						li.classList.add('tagged');
						
						var b = document.createElementNS(this.kNS, 'b');
						b.classList.add('unresolved');
						b.textContent = 'unresolved';
						li.appendChild(b);
						
						var p = document.createElementNS(this.kNS, 'p');
						p.innerHTML = issue[0]; // just string text, with some <a> tags on occasion; all these can be found in the resource/changelog.json file
						li.appendChild(p);
						
						ul.appendChild(li);
					}
								
					notes.insertBefore(section, sibling);
				}
			}
		}
		
		// if we're printing all the releases, hide the button to show them as it won't be needed anymore
		if(Services.vc.compare(version, '0') == 0) {
			$('allVersions').hidden = true;
		}
	},
	
	// Since I can't use a local iframe to load remote content, I have to include and build the buttons myself.
	// Build the buttons href's with the link to the add-on and the phrase to be used as default when sharing.
	// These values are defined in defaults.js (overriding the empty originals in bootstrap.js)
	A2A: function() {
		if(!addonUris.homepage) { return; }
		$('share').hidden = false;
		
		let linkurl = encodeURIComponent(addonUris.homepage);
		let linkname = encodeURIComponent($('a2a_div').getAttribute('linkname'));
		
		let as = $$('.a2a_link');
		for(let a of as) {
			var href = a.getAttribute('href')+'?linkurl='+linkurl+'&linkname='+linkname;
			setAttribute(a, 'href', href);
		}
	},
	
	// fetch the development hours data and show it; this will only happen when the about pane is actually shown
	api: function() {
		if(!addonUris.api) { return; }
		
		xmlHttpRequest(addonUris.api, function(xmlhttp) {
			if(xmlhttp.readyState != 4 || xmlhttp.status != 200 || !xmlhttp.response || !xmlhttp.response.id) { return; }
			
			var bank = $('bank');
			removeAttribute(bank, 'invisible');
			
			var hours = xmlhttp.response.hours;
			if(hours < 0) {
				bank.classList.add('negative');
				bank.classList.add('owed');
				bank.classList.remove('positive');
				bank.classList.remove('banked');
				hours = Math.abs(hours);
			}
			else {
				bank.classList.add('banked');
				bank.classList.remove('owed');
				
				if(hours > 0) {
					bank.classList.add('positive');
					bank.classList.remove('negative');
				} else {
					bank.classList.add('negative');
					bank.classList.remove('positive');
				}
			}
			
			$('balance').textContent = hours;
			
			if(xmlhttp.response.working) {
				bank.classList.add('working');
			} else {
				bank.classList.remove('working');
			}
			
			if(xmlhttp.response.owed > 0) {
				if(xmlhttp.response.owed == 1) {
					$('owed').style.backgroundColor = 'rgb(227,12,12)';
				} else {
					$('owed').style.backgroundImage = 'linear-gradient(to top, rgb(227,12,12) 0, rgb(227,12,12) '+(xmlhttp.response.owed *100)+'%, transparent calc('+(xmlhttp.response.owed *100)+'% + 4px))';
				}
			}
			
			if(xmlhttp.response.banked > 0) {
				if(xmlhttp.response.banked == 1) {
					$('banked').style.backgroundColor = 'rgb(11,216,11)';
				} else {
					$('banked').style.backgroundImage = 'linear-gradient(to top, rgb(11,216,11) 0, rgb(11,216,11) '+(xmlhttp.response.banked *100)+'%, transparent calc('+(xmlhttp.response.banked *100)+'% + 4px))';
				}
			}
		}, 'JSON');
	},
	
	openAddonsMgr: function() {
		this._getChrome().BrowserOpenAddonsMgr();
	},
	
	_getChrome: function() {
		return window
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIWebNavigation)
			.QueryInterface(Ci.nsIDocShellTreeItem)
			.rootTreeItem
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIDOMWindow);
	}
};

Modules.LOADMODULE = function() {
	about.init();
};

Modules.UNLOADMODULE = function() {
	about.uninit();
};
