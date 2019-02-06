angular.module('msgr')
.controller('MoveOfficeModalCtrl', ['$scope', '$modalInstance', '$translate', 'hmtgHelper', 'msgrHelper', 'jnagentDlg', 'appSetting',
  function($scope, $modalInstance, $translate, hmtgHelper, msgrHelper, jnagentDlg, appSetting) {
    $scope.as = appSetting;
    $scope.w = jnagentDlg;

    $scope.style_height = { 'max-height': Math.max(240, (hmtgHelper.view_port_height - 190)) + 'px' };

    $scope.move_up = function(item) {
      var idx = jnagentDlg.data.indexOf(item);
      if(idx == -1) return;
      if(idx == 0) return;

      jnagentDlg.data.splice(idx, 1)
      jnagentDlg.data.splice(idx - 1, 0, item);
    }

    $scope.move_down = function(item) {
      var idx = jnagentDlg.data.indexOf(item);
      if(idx == -1) return;
      if(idx == jnagentDlg.data.length - 1) return;

      jnagentDlg.data.splice(idx, 1)
      jnagentDlg.data.splice(idx + 1, 0, item);
    }

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };

  }
])

;