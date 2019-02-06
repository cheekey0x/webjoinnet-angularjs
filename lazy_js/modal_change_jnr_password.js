angular.module('hmtgs')
.controller('ChangeJnrPasswordModalCtrl', ['$scope', '$modalInstance', '$translate', 'hmtgHelper',
  function($scope, $modalInstance, $translate, hmtgHelper) {
    $scope.w = {};
    $scope.w.password1 = $scope.w.password2 = '';
    $scope.w.type = $scope.set_password_only ? 0 : 1;
    if($scope.w.type) {
      $scope.w.item = $scope.item;
      $scope.w.encrypted = !!($scope.item.flag & 0x40000000);
    }

    $scope.ok = function() {
      var password0 = '';
      if($scope.w.type) {
        if($scope.w.encrypted) {
          if(!$scope.w.password0) return;
          if($scope.w.password1 == $scope.w.password0) return;

          password0 = hmtg.util.encodeUtf8($scope.w.password0);
          if(password0.length >= hmtg.config.MAX_PASSWORD) {
            hmtgHelper.MessageBox($translate.instant('IDS_PASSWORD_TOO_LONG'), 0);
            return;
          }
        }
      }
      if($scope.w.password1 != $scope.w.password2) return;
      var password = hmtg.util.encodeUtf8($scope.w.password1);
      if(password.length >= hmtg.config.MAX_PASSWORD) {
        hmtgHelper.MessageBox($translate.instant('IDS_PASSWORD_TOO_LONG'), 0);
        return;
      }
      $modalInstance.close({
        password0: password0,
        password: password
      });
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
])

;