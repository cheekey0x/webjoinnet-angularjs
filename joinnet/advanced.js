/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.controller('JoinNetAdvancedCtrl', ['$scope', '$translate', 'hmtgHelper', '$modal',
          '$rootScope', 'appSetting', 'hmtgSound',
  function ($scope, $translate, hmtgHelper, $modal, $rootScope, appSetting, hmtgSound) {
    $scope.w = appSetting;

    $scope.simulate_disconnect = function () {
      hmtg.jnkernel.jn_command_simulate_disconnect();
    }

    $scope.simulate_reconnect_overwrite = function () {
      hmtg.util.log('simulate to disconnect and reconnect immediately');
      hmtgHelper.inside_angular++;
      hmtgSound.ShowInfoPrompt(function () { return $translate.instant('ID_LEAVE_AND_RECONNECT') }, 10);
      hmtg.jnkernel.jn_command_QuitConnection();
      hmtg.jnkernel.jn_command_initconnectmedia(true);
      hmtgHelper.inside_angular--;
    }

  }
])

;
