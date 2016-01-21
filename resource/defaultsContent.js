// VERSION 2.0.0

// By using a JSM, we can initialize each individual tab (frame) with our scripts without having to instanciate the same objects with each one.
(function(frame) {
	Components.utils.import("resource://findbartweak/modules/content/utils/ModuleInSandbox.jsm");
	ModuleInSandbox.init('findbartweak', frame);
})(this);
