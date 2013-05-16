moduleAid.VERSION = '1.0.0';

/* This is easier than adding a whole stylesheet just for the button */
moduleAid.LOADMODULE = function() {
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("chrome://global/content/customizeToolbar.xul") {\n';
	sscode += '	#findbartweak-button { list-style-image: url("chrome://findbartweak/skin/button.png") !important; }\n';
	sscode += '}';
	
	styleAid.load('customizeButton', sscode, true);
};

moduleAid.UNLOADMODULE = function() {
	styleAid.unload('customizeButton');
};
