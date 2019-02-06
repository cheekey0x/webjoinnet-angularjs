angular.module('joinnet')
.controller('JNRCtrl', ['$scope', 'playback', 'hmtgHelper', 'jnjContent', '$rootScope', '$modal', '$translate', 'hmtgAlert', 'JoinNet',
  function ($scope, playback, hmtgHelper, jnjContent, $rootScope, $modal, $translate, hmtgAlert, JoinNet) {
    $scope.jn = JoinNet;

    $scope.start_str = function () {
      return playback.start_str;
    }
    $scope.is_ready = function () {
      return playback.ready;
    }

    hmtgHelper.inside_angular++;
    if(playback.ready) init_stat();
    hmtgHelper.inside_angular--;

    function init_stat() {
      var t = (((playback.end_tick - playback.start_tick) + 60000 - 1) / 60000) >> 0;
      $scope.duration = '' + t + $translate.instant('IDS_TIME_UNIT_MINUTE');

      $scope.bandwidth = '' + playback.bandwidth + 'Kbps';
      $scope.bandwidth = '' + hmtgHelper.number2gmk(playback.bandwidth * 1000) + 'bps';
      if(!hmtgHelper.inside_angular) $scope.$digest();
    }
    $scope.$on(hmtgHelper.WM_PLAYBACK_INIT_STAT, init_stat);

    $scope.$on(hmtgHelper.WM_UPDATE_PLAYBACK, function () {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
  }
])
;