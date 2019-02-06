angular.module('hmtgs')
.controller('LogCtrl', ['$scope', 'jnjSource', 'JoinNet', 'hmtgHelper', 'appSetting', '$translate',
  'hmtgAlert',
  function($scope, jnjSource, JoinNet, hmtgHelper, appSetting, $translate, hmtgAlert) {
    $scope.as = appSetting;
    function adjust_height() {
      $scope.style_height = { 'height': (hmtgHelper.view_port_height * 0.7) + 'px' };
      if(!hmtgHelper.inside_angular) $scope.$digest();
    }
    hmtgHelper.inside_angular++;
    adjust_height();
    hmtgHelper.inside_angular--;
    $scope.$on(hmtgHelper.WM_HEIGHT_CHANGED, adjust_height);

    $scope.w = {};
    $scope.row_fluid = '';
    $scope.col_main_log = '';
    $scope.col_stat_log = '';
    $scope.w.show_main_log = true;
    $scope.w.show_stat_log = appSetting.show_stat_log;
    if(appSetting.show_stat_log) {
      $scope.stat_log = hmtg.util.read_hmtg_log_stat();
      if(typeof $scope.stat_log !== 'string') $scope.stat_log = '';
      setTimeout(function() {
        hmtg.util.scroll_to_bottom('Textarea_stat_log');
      }, 0);
    }
    $scope.w.show_toggle1 = true;
    function adjust_width() {
      if($scope.w.show_stat_log) {
        if(hmtgHelper.view_port_width >= 768) {
          $scope.row_fluid = 'row-fluid';
          $scope.w.show_main_log = true;
          $scope.w.show_toggle1 = false;
          $scope.col_main_log = $scope.col_stat_log = 'col-xs-6';
        } else {
          $scope.row_fluid = '';
          $scope.w.show_main_log = false;
          $scope.w.show_toggle1 = false;
          $scope.col_main_log = $scope.col_stat_log = '';
        }
      } else {
        $scope.row_fluid = '';
        $scope.w.show_main_log = true;
        $scope.w.show_toggle1 = true;
        $scope.col_main_log = $scope.col_stat_log = '';
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    }
    $scope.$watch('w.show_stat_log', function() {
      hmtgHelper.inside_angular++;
      adjust_width();
      hmtgHelper.inside_angular--;
      appSetting.show_stat_log = $scope.w.show_stat_log;
    });
    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, adjust_width);

    $scope.$on(hmtgHelper.WM_SHOW_STAT_LOG, function() {
      $scope.w.show_stat_log = 1;
      $scope.stat_log = hmtg.util.read_hmtg_log_stat();
      if(typeof $scope.stat_log !== 'string') $scope.stat_log = '';
      setTimeout(function() {
        hmtg.util.scroll_to_bottom('Textarea_stat_log');
      }, 0);
    });

    $scope.log = hmtg.util.read_hmtg_log();
    if(typeof $scope.log !== 'string') $scope.log = '';
    $scope.refreshLog = function() {
      $scope.log = hmtg.util.read_hmtg_log();
      if(typeof $scope.log !== 'string') $scope.log = '';
    }
    $scope.clearLog = function() {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_CLEAR_LOG_PROMPT'), 0, ok);
      function ok() {
        $scope.log = '';
        hmtg.util.reset_hmtg_log();
      }
    }

    $scope.stat_log = hmtg.util.read_hmtg_log_stat();
    if(typeof $scope.stat_log !== 'string') $scope.stat_log = '';
    $scope.refreshStatLog = function() {
      $scope.stat_log = hmtg.util.read_hmtg_log_stat();
      if(typeof $scope.stat_log !== 'string') $scope.stat_log = '';
    }
    $scope.clearStatLog = function() {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_CLEAR_LOG_PROMPT'), 0, ok);
      function ok() {
        $scope.stat_log = '';
        hmtg.util.reset_hmtg_log_stat();
      }
    }

    $scope.save_log = function() {
      try {
        if(hmtgHelper.isiOS) {
          hmtgHelper.inside_angular++;
          hmtgAlert.add_blob_download_item(new Blob([$scope.log], { type: 'text/plain' }), 'webjoinnet-log.txt');
          hmtgHelper.inside_angular--;
        } else {
          hmtgHelper.save_file(new Blob([$scope.log], { type: 'text/plain' }), 'webjoinnet-log.txt');
        }
      } catch(e) {
      }
    }

    $scope.save_stat_log = function() {
      try {
        if(hmtgHelper.isiOS) {
          hmtgHelper.inside_angular++;
          hmtgAlert.add_blob_download_item(new Blob([$scope.stat_log], { type: 'text/plain' }), 'webjoinnet-stat-log.txt');
          hmtgHelper.inside_angular--;
        } else {
          hmtgHelper.save_file(new Blob([$scope.stat_log], { type: 'text/plain' }), 'webjoinnet-stat-log.txt');
        }
      } catch(e) {
      }
    }

    $scope.$watch(function() { return JoinNet.status; }, function() {
      $scope.status = JoinNet.status;
    });
  }
])
;