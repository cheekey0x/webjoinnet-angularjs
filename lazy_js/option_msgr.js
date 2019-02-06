angular.module('hmtgs')
.controller('MsgrSettingCtrl', ['$scope', 'Msgr', 'appSetting', 'jnagentDlg', '$rootScope', 'hmtgHelper',
  function ($scope, Msgr, appSetting, jnagentDlg, $rootScope, hmtgHelper) {
    $scope.w = appSetting;

    $scope.$watch('w.show_text', function () {
      hmtg.util.localStorage['hmtg_show_text'] = JSON.stringify($scope.w.show_text);
    });
    $scope.$watch('w.no_tip', function() {
      hmtg.util.localStorage['hmtg_no_tip'] = JSON.stringify($scope.w.no_tip);
    });

    $scope.$watch('w.auto_https', function() {
      hmtg.util.localStorage['hmtg_auto_https'] = JSON.stringify($scope.w.auto_https);
    });

    $scope.$watch('w.alert_online', function () {
      hmtg.util.localStorage['hmtg_alert_online'] = JSON.stringify($scope.w.alert_online);
    });
    $scope.$watch('w.alert_newmessage', function () {
      hmtg.util.localStorage['hmtg_alert_newmessage'] = JSON.stringify($scope.w.alert_newmessage);
    });
    $scope.$watch('w.play_sound', function () {
      hmtg.util.localStorage['hmtg_play_sound'] = JSON.stringify($scope.w.play_sound);
    });
    $scope.$watch('w.vibrate', function() {
      hmtg.util.localStorage['hmtg_vibrate'] = JSON.stringify($scope.w.vibrate);
    });
    $scope.$watch('w.show_other_user', function() {
      hmtg.util.localStorage['hmtg_show_other_user'] = JSON.stringify($scope.w.show_other_user);
      hmtgHelper.inside_angular++;
      jnagentDlg.update_show_user();
      hmtgHelper.inside_angular--;
    });
    $scope.$watch('w.show_offline_user', function () {
      hmtg.util.localStorage['hmtg_show_offline_user'] = JSON.stringify($scope.w.show_offline_user);
      hmtgHelper.inside_angular++;
      jnagentDlg.update_show_user();
      hmtgHelper.inside_angular--;
    });
    $scope.$watch('w.max_win', function () {
      hmtg.util.localStorage['hmtg_max_win'] = JSON.stringify($scope.w.max_win);
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_MAX_WIN_CHANGED);
      hmtgHelper.inside_angular--;
    });

  }
])
;