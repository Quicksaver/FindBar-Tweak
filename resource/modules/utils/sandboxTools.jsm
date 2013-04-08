moduleAid.VERSION = '2.1.2';
moduleAid.LAZY = true;

// xmlHttpRequest(url, callback, method, async) - aid for quickly using the nsIXMLHttpRequest interface
//	url - (string) to send the request
//	callback - (function) to be called after request is completed; expects callback(xmlhttp, e) where xmlhttp = xmlhttprequest return object and e = event object
//	(optional) method - either (string) "POST" or (string) "GET"
//	(optional) async - (bool) defines whether to perform the operation asynchronously, defaults to true
this.xmlHttpRequest = function(url, callback, method, async) {
	if(!method) { method = "GET"; }
	if(async !== false) { async = true; }
	
	var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
	xmlhttp.open(method, url, async);
	if(async) {
		xmlhttp.onreadystatechange = function(e) { callback(xmlhttp, e); };
	}
	xmlhttp.send();
	if(!async) {
		callback(xmlhttp);
	}
	return xmlhttp;
};

// aSync(aFunc, aDelay) - lets me run aFunc asynchronously, basically it's a one shot timer with a delay of aDelay msec
//	aFunc - (function) to be called asynchronously
//	(optional) aDelay - (int) msec to set the timer, defaults to 0msec
this.aSync = function(aFunc, aDelay) {
	var newTimer = {
		timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
		handler: aFunc.bind(self),
		cancel: function() {
			this.timer.cancel();
		}
	};
	newTimer.timer.init(newTimer.handler, (!aDelay) ? 0 : aDelay, Ci.nsITimer.TYPE_ONE_SHOT);
	return newTimer;
};

// dispatch(obj, properties) - creates and dispatches an event and returns (bool) whether preventDefault was called on it
//	obj - (xul element) object to dispatch the event from, it will be e.target
//	properties - (obj) expecting the following sub properties defining the following event characteristics:
//		type - (str) the event type
//		(optional) bubbles - (bool) defaults to true
//		(optional) cancelable - (bool) defaults to true
//		(optional) detail - to be passed to the event
this.dispatch = function(obj, properties) {
	if(!obj || (!obj.ownerDocument && !obj.document) || !obj.dispatchEvent || !properties || !properties.type) { return false; }
	
	var bubbles = properties.bubbles || true;
	var cancelable = properties.cancelable || true;
	var detail = properties.detail || undefined;
	
	var event = (obj.ownerDocument) ? obj.ownerDocument.createEvent('CustomEvent') : obj.document.createEvent('CustomEvent');
	event.initCustomEvent(properties.type, bubbles, cancelable, detail);
	return obj.dispatchEvent(event);
};

// compareFunction(a, b, strict) - returns (bool) if a === b
//	a - (function) to compare
//	b - (function) to compare
//	(optional) strict - false compares function source as (string), true does not, defaults to false
this.compareFunction = function(a, b, strict) {
	if(a === b || (!strict && a.toSource() == b.toSource())) {
		return true;
	}
	return false;
};

// isAncestor(aNode, aParent) - Checks if aNode decends from aParent
//	aNode - (xul element) node to check for ancestry
//	aParent - (xul element) node to check if ancestor of aNode
//	(dont set) aWindow - to be used internally by isAncestor()
this.isAncestor = function(aNode, aParent, aWindow) {
	if(!aNode || !aParent) { return false; };
	
	if(aNode == aParent) { return true; }
	
	var ownDocument = aNode.ownerDocument || aNode.document;
	if(ownDocument && ownDocument == aParent) { return true; }
	if(aNode.compareDocumentPosition && (aNode.compareDocumentPosition(aParent) & aNode.DOCUMENT_POSITION_CONTAINS)) { return true; }
	
	var browsers = aParent.getElementsByTagName('browser');
	for(var i=0; i<browsers.length; i++) {
		if(isAncestor(aNode, browsers[i].contentDocument, browsers[i].contentWindow)) { return true; }
	}
	
	if(!aWindow) { return false; }
	for(var i=0; i<aWindow.frames.length; i++) {
		if(isAncestor(aNode, aWindow.frames[i].document, aWindow.frames[i])) { return true; }
	}
	return false;
};

// hideIt(aNode, show) - in theory this should collapse whatever I want
//	aNode - (xul element) node to collapse
//	(optional) show - false collapses aNode, true 'un'collapses it, defaults to false
this.hideIt = function(aNode, show) {
	toggleAttribute(aNode, 'collapsed', !show);
};

// trim(str) - trims whitespaces from a string (found in http://blog.stevenlevithan.com/archives/faster-trim-javascript -> trim3())
//	str - (string) to trim
this.trim = function(str) {
	if(typeof(str) != 'string') {
		return '';
	}
	
	return str.substring(Math.max(str.search(/\S/), 0), str.search(/\S\s*$/) + 1);
};

// closeCustomize() - useful for when you want to close the customize toolbar dialogs for whatever reason
this.closeCustomize = function() {
	windowMediator.callOnAll(function(aWindow) { try { aWindow.close(); } catch(ex) {} }, null, "chrome://global/content/customizeToolbar.xul");
	windowMediator.callOnAll(function(aWindow) {
		if(!aWindow.gBrowser) { return; }
		
		for(var b=0; b<aWindow.gBrowser.browsers.length; b++) {
			var aBrowser = aWindow.gBrowser.getBrowserAtIndex(b);
			if(aBrowser.contentDocument.documentURI == "chrome://global/content/customizeToolbar.xul") {
				for(var t=0; t<aWindow.gBrowser.mTabs.length; t++) {
					if(aWindow.gBrowser.mTabs[t].linkedBrowser == aBrowser) {
						try { aWindow.gBrowser.removeTab(aWindow.gBrowser.mTabs[t]); } catch(ex) { Cu.reportError(ex); }
					}
				}
			}
		}
	}, 'navigator:browser');
};

// replaceObjStrings(node) - replace all objName and objPathString references in the node attributes and its children with the proper names
//	node - (xul element) to replace the strings in
this.replaceObjStrings = function(node) {
	if(!node) { return; }
	
	if(node.attributes) {
		for(var a=0; a<node.attributes.length; a++) {
			// Replace objName with this objName in every attribute
			while(node.attributes[a].value.indexOf('objName') > -1) {
				node.attributes[a].value = node.attributes[a].value.replace('objName', objName);
			}
			while(node.attributes[a].value.indexOf('objPathString') > -1) {
				node.attributes[a].value = node.attributes[a].value.replace('objPathString', objPathString);
			}
		}
	}
	
	var curChild = node.firstChild;
	while(curChild) {
		replaceObjStrings(curChild);
		curChild = curChild.nextSibling;
	}
};
