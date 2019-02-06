angular.module('hmtgs')
.controller('PromptCtrl', ['$scope', 'jnjSource', 'jnjContent', 'JoinNet', '$rootScope', 'hmtgHelper', 'appSetting', 'hmtgSound', '$sce',
  function($scope, jnjSource, jnjContent, JoinNet, $rootScope, hmtgHelper, appSetting, hmtgSound, $sce) {
    $scope.as = appSetting;
    $scope.plain_jnj = $rootScope.jnj_source;
    $scope.blob = null;
    if(window.URL && $rootScope.jnj_source) {
      $scope.blob = new Blob([$rootScope.jnj_source], { type: hmtgHelper.isiOS ? 'text/plain' : 'application/joinnet' });
      $scope.jnj_href = window.URL.createObjectURL($scope.blob);
      //hmtg.util.log($scope.jnj_href);
    } else {
      $scope.jnj_href = 'data:application/joinnet;base64,' + $rootScope.jnj_base64;
    }
    $scope.switch_to_download = function() {
      appSetting.switch_to_download();
    }
    $scope.launch_native = function() {
      if(window.navigator.msSaveOrOpenBlob && $scope.blob) {
        window.navigator.msSaveOrOpenBlob($scope.blob, $scope.jnj_name);
      }
    }
    $scope.connect = function() {
      if(!$scope.jnj_source) return;

      hmtgHelper.inside_angular++;
      if(hmtg.jmkernel.jm_callback_LaunchJoinNet) hmtg.jmkernel.jm_callback_LaunchJoinNet(hmtg.util.encodeUtf8($scope.jnj_source));
      hmtgHelper.inside_angular--;
    }
  }
])
;
