angular.module('hmtgs')
.controller('JnjSourceCtrl', ['$scope', 'jnjSource', 'jnjContent', 'JoinNet', '$rootScope', 'hmtgHelper', 'appSetting',
  'hmtgSound', '$sce', 'msgrHelper', 'joinnetHelper', '$translate',
  function($scope, jnjSource, jnjContent, JoinNet, $rootScope, hmtgHelper, appSetting, hmtgSound, $sce, msgrHelper,
    joinnetHelper, $translate) {
    $scope.jnj_source = '';
    function adjust_height() {
      $scope.style_height1 = { 'height': (hmtgHelper.view_port_height * 0.7) + 'px' };
      if(!hmtgHelper.inside_angular) $scope.$digest();
    }
    hmtgHelper.inside_angular++;
    adjust_height();
    hmtgHelper.inside_angular--;
    $scope.$on(hmtgHelper.WM_HEIGHT_CHANGED, adjust_height);

    $scope.$on(hmtgHelper.WM_OPEN_JNJ, function(event, jnj) {
      using_last_jnj = false;
      $scope.jnj_source = hmtg.util.decodeUtf8(jnj);
    });

    $scope.$watch('jnj_source', function() {
      $scope.is_valid_jnj = $scope.jnj_source && jnjContent.validateJnj($scope.jnj_source);
      $scope.jnj_can_connect = $scope.is_valid_jnj || $scope.jnj_source.match(/^https?:\/\/.+/i);
    });

    var using_last_jnj = false;
    $scope.connect = function() {
      if(!$scope.jnj_can_connect) return;
      
      hmtgSound.turnOnAudio();

      hmtgHelper.inside_angular++;
      if($scope.is_valid_jnj) {
        if(hmtg.jmkernel.jm_callback_LaunchJoinNet) hmtg.jmkernel.jm_callback_LaunchJoinNet(hmtg.util.encodeUtf8($scope.jnj_source));
      } else {
        joinnetHelper.connect_url($scope.jnj_source);
      }
      hmtgHelper.inside_angular--;
    }
    $scope.load_last_jnj = function() {
      if($scope.jnj_source) {
        hmtgHelper.OKCancelMessageBox($translate.instant('ID_LOAD_LAST_JNJ_PROMPT'), 0, ok);
      } else {
        ok();
      }
      function ok() {
        var lj = hmtg.util.localStorage['last_jnj'];
        if(typeof lj === 'string')
          $scope.jnj_source = hmtg.util.decodeUtf8(lj);
      }
    }
    $scope.can_load = function() {
      return hmtg.util.localStorage['last_jnj'] && typeof hmtg.util.localStorage['last_jnj'] === 'string';
    }

    $scope.clear_last_jnj = function() {
      if($scope.can_load()) {
        hmtgHelper.OKCancelMessageBox($translate.instant('ID_DELETE_LAST_JNJ_PROMPT'), 0, ok);
      }
      function ok() {
        hmtg.util.localStorage.removeItem('last_jnj');
      }
    }

    $scope.reset = function() {
      if($scope.jnj_source) {
        hmtgHelper.OKCancelMessageBox($translate.instant('ID_RESET_JNJ_PROMPT'), 0, ok);
      }
      function ok() {
        $scope.jnj_source = '';
      }
    }

    $scope.calc_url = function(jnj) {
      if(!jnj) return '';
      return location.href.split('?')[0].split('#')[0] + '?jnj=' + hmtg.util.encode64_url(hmtg.util.encodeUtf8(jnj));
    }

  }
])
;
