angular.module('hmtgs')
.controller('RenameModalCtrl', ['$scope', '$modalInstance', 'hmtgHelper', '$translate',
  function($scope, $modalInstance, hmtgHelper, $translate) {
    $scope.w = {};
    var old = $scope.w.new_name = $scope.new_name;

    setTimeout(function() {
      var elem = document.getElementById("new_name");
      if(elem) elem.focus();
    }, 100);


    $scope.onkeypress = function(e) {
      if(e.keyCode == 13) {
        e.stopPropagation();
        e.preventDefault();
        $scope.ok();
        return;
      }
    }

    $scope.ok = function() {
      if(old == $scope.w.new_name) return;
      var new_name = hmtg.util.encodeUtf8($scope.w.new_name);
      var error_id;
      if($scope.func) {
        if(typeof $scope.func === 'function') {
          error_id = $scope.func(new_name);
        } else if($scope.func === 'pm' 
          || $scope.func === 'rename_pgc'
          || $scope.func === 'rename_office'
          || $scope.func === 'set_group'
          || $scope.func === 'change_title'
          ) {
          if(new_name.length >= hmtg.config.MAX_USERNAME) error_id = 'IDS_PGC_NAME_TOO_LONG';
        } else if($scope.func === 'new_contact_group') {
          if(!new_name) return;
          if(new_name.length >= hmtg.config.MAX_USERNAME) {
            error_id = 'IDS_PGC_NAME_TOO_LONG';
          } else {
            var param = $scope.context[0];
            var a = param._m_pContactGroupArray();
            if(a && a.length) {
              var i;
              for(i = 0; i < a.length; i++) {
                var group = a[i];
                if(group.m_szGroupName == new_name) {
                  error_id = 'IDS_GROUP_NAME_EXIST';
                  break;
                }
              }
            }
          }
        } else if($scope.func === 'rename_contact_group') {
          if(!new_name) return;
          if(new_name.length >= hmtg.config.MAX_USERNAME) {
            error_id = 'IDS_PGC_NAME_TOO_LONG';
          } else {
            var param = $scope.context[0];
            var group0 = $scope.context[1];
            var a = param._m_pContactGroupArray();
            if(a && a.length) {
              var i;
              for(i = 0; i < a.length; i++) {
                var group = a[i];
                if(group == group0) continue;
                if(group.m_szGroupName == new_name) {
                  error_id = 'IDS_GROUP_NAME_EXIST';
                  break;
                }
              }
            }
          }
        }
      }
      if(error_id) {
        hmtgHelper.MessageBox($translate.instant(error_id), 0);
        return;
      }
      $modalInstance.close({
        new_name: new_name
      });
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
])

;