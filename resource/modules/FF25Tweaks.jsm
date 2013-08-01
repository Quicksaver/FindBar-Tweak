moduleAid.VERSION = '1.0.0';

this.delayTopBorderInContent = function() {
	timerAid.init('delayTopBorderInContent', noTopBorderInContent, 10);
};

this.noTopBorderInContent = function() {
	if(gFindBarInitialized
	&& !gFindBar.hidden
	&& !gFindBar.collapsed
	&& (!gBrowser.getNotificationBox().currentNotification || gBrowser.getNotificationBox().notificationsHidden)) {
		setAttribute($('appcontent'), 'noTopBorder', 'true');
	} else {
		removeAttribute($('appcontent'), 'noTopBorder');
	}
};

this.personaTextColor = function() {
	styleAid.unload('personaTextColor_'+_UUID);
	
	var color = getComputedStyle($('main-window')).getPropertyValue('color');
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"][findbartweak-FF25Tweaks] findbar:-moz-lwtheme description, \n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"][findbartweak-FF25Tweaks] findbar:-moz-lwtheme label {\n';
	sscode += '		color: '+color+' !important;\n';
	sscode += '	}';
	sscode += '}';
	
	styleAid.load('personaTextColor_'+_UUID, sscode, true);
};
	
moduleAid.LOADMODULE = function() {
	setAttribute(document.documentElement, objName+'-FF25Tweaks', 'true');
	
	listenerAid.add(window, 'OpenedFindBar', noTopBorderInContent);
	listenerAid.add(window, 'ClosedFindBar', noTopBorderInContent);
	listenerAid.add(gBrowser.tabContainer, "TabSelect", delayTopBorderInContent);
	listenerAid.add(browserPanel, 'resize', delayTopBorderInContent);
	observerAid.add(personaTextColor, "lightweight-theme-changed");
	
	noTopBorderInContent();
	personaTextColor();
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, 'OpenedFindBar', noTopBorderInContent);
	listenerAid.remove(window, 'ClosedFindBar', noTopBorderInContent);
	listenerAid.remove(gBrowser.tabContainer, "TabSelect", delayTopBorderInContent);
	listenerAid.remove(browserPanel, 'resize', delayTopBorderInContent);
	observerAid.remove(personaTextColor, "lightweight-theme-changed");
	
	removeAttribute($('appcontent'), 'noTopBorder');
	removeAttribute(document.documentElement, objName+'-FF25Tweaks');
};
