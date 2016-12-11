/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// VERSION 1.0.0

Modules.LOADMODULE = function() {
	Styles.load('FXChrome', 'FXChrome');
};

Modules.UNLOADMODULE = function() {
	Styles.unload('FXChrome');
};
