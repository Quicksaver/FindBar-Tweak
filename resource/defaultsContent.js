// VERSION 1.0.0

Services.scriptloader.loadSubScript("resource://findbartweak/modules/utils/content.js", this);

this.findbartweak = this.__contentEnvironment;
delete this.__contentEnvironment;

this.findbartweak.objName = 'findbartweak';
this.findbartweak.objPathString = 'findbartweak';
this.findbartweak.init();
