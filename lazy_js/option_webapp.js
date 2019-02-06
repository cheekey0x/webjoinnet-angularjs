angular.module('hmtgs')
.controller('WebAppSettingCtrl', ['$scope', 'appSetting', 'hmtgHelper', '$rootScope', '$translate',
  function ($scope, appSetting, hmtgHelper, $rootScope, $translate) {
    var log_level = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_log_level']);
    if(log_level === 'undefined') log_level = hmtg.config.DEFAULT_LOG_LEVEL;
    if(log_level < 0) log_level = 0;
    $scope.data = { loglevel: log_level };
    $scope.as = $scope.w = appSetting;

    $scope.$watch('w.max_display_item', function () {
      hmtg.util.localStorage['hmtg_max_display_item'] = JSON.stringify($scope.w.max_display_item);
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_MAX_DISPLAY_ITEM_CHANGED);
      hmtgHelper.inside_angular--;
    });

    $scope.$watch('w.snapshot_delay', function () {
      hmtg.util.localStorage['hmtg_snapshot_delay'] = JSON.stringify($scope.w.snapshot_delay);
      $rootScope.snapshot_title = $translate.instant('ID_SNAPSHOT') + ($scope.w.snapshot_delay ? '(' : '') + ($scope.w.snapshot_delay ? $scope.w.snapshot_delay : '') + ($scope.w.snapshot_delay ? ')' : '') + '...';
      $rootScope.$broadcast(hmtgHelper.WM_SNAPSHOT_DELAY_CHANGED);
    });

    $scope.$watch('w.show_snapshot', function () {
      hmtg.util.localStorage['hmtg_show_snapshot'] = JSON.stringify($scope.w.show_snapshot);
      $rootScope.show_snapshot = $scope.w.show_snapshot;
    });

    $scope.$watch('w.show_text', function () {
      hmtg.util.localStorage['hmtg_show_text'] = JSON.stringify($scope.w.show_text);
    });
    $scope.$watch('w.no_tip', function() {
      hmtg.util.localStorage['hmtg_no_tip'] = JSON.stringify($scope.w.no_tip);
    });

    $scope.$watch('w.auto_https', function() {
      hmtg.util.localStorage['hmtg_auto_https'] = JSON.stringify($scope.w.auto_https);
    });

    $scope.$watch('data.loglevel', function() {
      var old_value = hmtg.util.localStorage['hmtg_log_level'];
      hmtg.util.localStorage['hmtg_log_level'] = JSON.stringify($scope.data.loglevel);
      var new_value = hmtg.util.localStorage['hmtg_log_level'];
      if(old_value != new_value) {
        hmtg.util.log("log level is changed from " + old_value + " to " + new_value);
      }  
    });

    $scope.$watch(function () {
      var log_level = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_log_level']);
      if(log_level === 'undefined') log_level = hmtg.config.DEFAULT_LOG_LEVEL;
      return log_level;
    }, function () {
      var log_level = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_log_level']);
      if(log_level === 'undefined') log_level = hmtg.config.DEFAULT_LOG_LEVEL;
      if(log_level < 0) log_level = 0;
      $scope.data.loglevel = log_level;
    });

    $scope.limits = [
      { value: 10, text: '10M' },
      { value: 20, text: '20M' },
      { value: 50, text: '50M' },
      { value: 100, text: '100M' },
      { value: 200, text: '200M' },
      { value: 500, text: '500M' },
      { value: 1000, text: '1G' },
      { value: 2000, text: '2G' },
      { value: 4000, text: '4G' }
    ];
    var parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_blob_testing_value']);
    if(parsed !== 'undefined') {
      var idx = $scope.limits.length - 1;
      var i;
      for(i = 0; i < $scope.limits.length; i++) {
        if(parsed <= $scope.limits[i].value) {
          idx = i;
          break;
        }
      }
      var idx2 = idx - 1;
      if(idx2 < 0) idx2 = 0;

      $scope.probe_result = $translate.instant('ID_PROBING_RESULT')
            .replace('#target#', $scope.limits[idx].text)
            .replace('#suggestion#', $scope.limits[idx2].text);
    }
    $scope.$watch('w.max_blob', function () {
      hmtg.util.localStorage['hmtg_max_blob'] = JSON.stringify($scope.w.max_blob);
    });

    $scope.test_blob_limit = function () {
      if($scope.in_probe) return;
      $scope.in_probe = true;
      if($scope.probe_intervalID) {
        clearInterval($scope.probe_intervalID);
      }

      $scope.probe_result = '';
      $scope.idx = 0;

      $scope.probe_intervalID = setInterval(function () {
        hmtg.util.localStorage['hmtg_blob_testing_value'] = JSON.stringify($scope.limits[$scope.idx].value);
        $scope.progress = $translate.instant('ID_PROBING_STATUS').replace('#target#', $scope.limits[$scope.idx].text);
        $scope.$digest();
        try {
          var data = new Uint8Array($scope.limits[$scope.idx].value * 1000000);
          var blob = new Blob([data]);
          var url = window.URL.createObjectURL(blob);
        } catch(e) {
          clearInterval($scope.probe_intervalID);
          $scope.probe_intervalID = null;
          $scope.in_probe = 0;
          var idx2 = $scope.idx - 1;
          if(idx2 < 0) idx = 0;
          $scope.probe_result = $translate.instant('ID_PROBING_RESULT')
            .replace('#target#', $scope.limits[$scope.idx].text)
            .replace('#suggestion#', $scope.limits[idx2].text);
          $scope.$digest();
        }
        $scope.idx++;
        if($scope.idx >= 12) {
          clearInterval($scope.probe_intervalID);
          $scope.probe_intervalID = null;
          $scope.in_probe = 0;
          $scope.probe_result = $translate.instant('ID_PROBING_RESULT')
            .replace('#suggestion#', $scope.limits[$scope.limits.length - 1].text);
          $scope.$digest();
        }
      }, 500);
    }

    $scope.zip_limits = [
      { value: 2, text: '2M' },
      { value: 5, text: '5M' },
      { value: 10, text: '10M' },
      { value: 20, text: '20M' },
      { value: 50, text: '50M' },
      { value: 100, text: '100M' },
      { value: 200, text: '200M' },
      { value: 500, text: '500M' },
      { value: 1000, text: '1G' },
      { value: 2000, text: '2G' },
      { value: 4000, text: '4G' }
    ];
    $scope.$watch('w.max_zip_size', function () {
      hmtg.util.localStorage['hmtg_max_zip_size'] = JSON.stringify($scope.w.max_zip_size);
    });

  }
])
;