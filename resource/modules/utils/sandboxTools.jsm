Modules.VERSION = '2.6.0';
Modules.UTILS = true;
Modules.BASEUTILS = true;

// xmlHttpRequest(url, callback, method) - aid for quickly using the nsIXMLHttpRequest interface
//	url - (string) to send the request
//	callback - (function) to be called after request is completed; expects callback(xmlhttp, e) where xmlhttp = xmlhttprequest return object and e = event object
//	(optional) method - either (string) "POST" or (string) "GET"
this.xmlHttpRequest = function(url, callback, method) {
	if(!method) { method = "GET"; }
	
	var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
	xmlhttp.open(method, url);
	if(url.endsWith('.json')) {
		xmlhttp.overrideMimeType("application/json");
	}
	xmlhttp.onreadystatechange = function(e) { callback(xmlhttp, e); };
	xmlhttp.send();
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

// dispatch(obj, properties) - creates and dispatches an event and returns (bool) whether preventDefault was not called on it
//	aNode - (xul element) object to dispatch the event from, it will be e.target
//	props - (obj) expecting the following sub properties defining the following event characteristics:
//		type - (str) the event type
//		(optional) bubbles - (bool) defaults to true
//		(optional) cancelable - (bool) defaults to true
//		(optional) detail - to be passed to the event
//		(optional) asking - (bool) if true, will return the .detail property of the event, which can be modified by listeners; defaults to false, .detail defaults to undefined
this.dispatch = function(aNode, props) {
	if(!aNode || !aNode.dispatchEvent
	|| (!aNode.ownerDocument && !aNode.document && (!aNode.content || !aNode.content.document))
	|| !props || !props.type) { return false; }
	
	var bubbles = props.bubbles || true;
	var cancelable = props.cancelable || !props.asking;
	var detail = props.detail || undefined;
	
	var doc = (aNode.ownerDocument) ? aNode.ownerDocument : (aNode.document) ? aNode.document : aNode.content.document; // last one's for content processes
	var event = doc.createEvent('CustomEvent');
	
	if(props.asking) {
		event.__defineGetter__('detail', function() { return detail; });
		event.__defineSetter__('detail', function(v) { return detail = v; });
	}
	
	event.initCustomEvent(props.type, bubbles, cancelable, detail);
	var ret = aNode.dispatchEvent(event);
	return (props.asking) ? detail : ret;
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
	
	var browserNodes = (aParent.tagName == 'browser') ? [aParent] : aParent.getElementsByTagName('browser');
	for(var browser of browserNodes) {
		try { if(isAncestor(aNode, browser.contentDocument, browser.contentWindow)) { return true; } }
		catch(ex) { /* this will fail in e10s */ }
	}
	
	if(!aWindow) { return false; }
	for(var frame of aWindow.frames) {
		if(isAncestor(aNode, frame.document, frame)) { return true; }
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

// replaceObjStrings(node, prop) - replace all objName and objPathString references in the node attributes and its children with the proper names
//	node - (xul element) to replace the strings in
//	(optional) prop - (string) if specified, instead of checking attributes, it will check for node.prop for occurences of what needs to be replaced. This will not check child nodes.
this.replaceObjStrings = function(node, prop) {
	if(!node) { return; }
	
	if(prop) {
		if(!node[prop]) { return; }
		
		while(node[prop].indexOf('objName') > -1) {
			node[prop] = node[prop].replace('objName', objName);
		}
		while(node[prop].indexOf('objPathString') > -1) {
			node[prop] = node[prop].replace('objPathString', objPathString);
		}
		
		return;
	}
	
	if(node.attributes) {
		for(var a=0; a<node.attributes.length; a++) {
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

// getComputedStyle(aNode, pseudo) - returns the resulting object from calling the equivalent window.getComputedStyle() on it
//	aNode - (element) of which to return the computed style object
//	(optional) pseudo -(string) specifying the pseudo-element to match, see https://developer.mozilla.org/en-US/docs/Web/API/Window.getComputedStyle
this.getComputedStyle = function(aNode, pseudo) {
	return aNode.ownerGlobal.getComputedStyle(aNode, pseudo);
};
