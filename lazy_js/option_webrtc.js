angular.module('hmtgs')
  .controller('WebRTCSettingCtrl', ['$scope', 'appSetting', 'hmtgHelper', '$rootScope', '$translate', 'mediasoupWebRTC',
  function($scope, appSetting, hmtgHelper, $rootScope, $translate, mediasoupWebRTC) {
    $scope.w = {};
    $scope.as = appSetting;
    $scope.ms = mediasoupWebRTC;

    $scope.w.edit_server = $scope.w.edit_username = $scope.w.edit_password = '';

    $scope.add_turn_server = function() {
      if($scope.ms.turn_server_array.length >= 10) {
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_TOO_MANY_TURN_SERVER') }, 20);
        return;
      }

      $scope.w.edit_server = $scope.w.edit_username = $scope.w.edit_password = '';

      var item = { server: '', username: '', password: '', edit: 1 };
      $scope.w.editing = true;
      $scope.ms.turn_server_array.unshift(item);
    }

    $scope.edit = function(item) {
      item.edit = 2;
      $scope.w.editing = true;
      $scope.w.edit_server = item.server;
      $scope.w.edit_username = item.username;
      $scope.w.edit_password = item.password;
    }

    $scope.ok = function(item) {
      if(!$scope.w.edit_server) return;
      item.server = $scope.w.edit_server;
      item.username = $scope.w.edit_username;
      item.password = $scope.w.edit_password;
      item.edit = 0;
      $scope.w.editing = false;

      hmtg.util.localStorage['hmtg_turn_server_array'] = JSON.stringify($scope.ms.turn_server_array);
    }

    $scope.cancel = function(item) {
      if(item.edit == 1) {
        $scope.ms.turn_server_array.shift();
      } else {
        item.edit = 0;
      }
     $scope.w.editing = false;
    }

    $scope.remove = function(item) {
      var idx = $scope.ms.turn_server_array.indexOf(item);
      if(idx != -1) {
        hmtgHelper.OKCancelMessageBox($translate.instant('ID_DELETE_TURN_SERVER_PROMPT'), 0, ok);
      }
      function ok() {
        $scope.w.edit_server = item.server;
        $scope.w.edit_username = item.username;
        $scope.w.edit_password = item.password;
        $scope.ms.turn_server_array.splice(idx, 1);
        hmtg.util.localStorage['hmtg_turn_server_array'] = JSON.stringify($scope.ms.turn_server_array);
      }
    }

    $scope.move_up = function(item) {
      var idx = $scope.ms.turn_server_array.indexOf(item);
      if(idx == -1) return;
      if(idx == 0) return;

      $scope.ms.turn_server_array.splice(idx, 1)
      $scope.ms.turn_server_array.splice(idx - 1, 0, item);
      hmtg.util.localStorage['hmtg_url_array'] = JSON.stringify($scope.ms.turn_server_array);
    }

    $scope.move_down = function(item) {
      var idx = $scope.ms.turn_server_array.indexOf(item);
      if(idx == -1) return;
      if(idx == $scope.ms.turn_server_array.length - 1) return;

      $scope.ms.turn_server_array.splice(idx, 1)
      $scope.ms.turn_server_array.splice(idx + 1, 0, item);
      hmtg.util.localStorage['hmtg_url_array'] = JSON.stringify($scope.ms.turn_server_array);
    }

  }
])
;