moduleAid.VERSION = '1.0.0';

this.canadianWeatherFix = function() {
	var els = $('browser-bottombox').getElementsByClassName('browserSidebarContainer');
	if(els.length > 0) {
		els[0].parentNode.id = '';
		var sightsBox = els[0].getElementsByAttribute('anonid', 'findSights');
		if(sightsBox.length > 0) {
			sightsBox[0].parentNode.removeChild(sightsBox[0]);
		}
		var gridBox = els[0].getElementsByAttribute('anonid', 'gridBox');
		if(gridBox.length > 0) {
			gridBox[0].parentNode.removeChild(gridBox[0]);
		}
	}
};

this.canadianWeatherListener = {
	onEnabled: function(addon) {
		if(addon.id == 'jid0-Kh82yFrlHoAdO2JdivLpb4Km7EA@jetpack') { aSync(canadianWeatherFix); }
	}
};

moduleAid.LOADMODULE = function() {
	AddonManager.addAddonListener(canadianWeatherListener);
	AddonManager.getAddonByID('jid0-Kh82yFrlHoAdO2JdivLpb4Km7EA@jetpack', function(addon) {
		if(addon && addon.isActive) { aSync(canadianWeatherFix); }
	});
};

moduleAid.UNLOADMODULE = function() {
	AddonManager.removeAddonListener(canadianWeatherListener);
};
