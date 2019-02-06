angular.module('msgr')
.controller('DownloadCompleteModalCtrl', ['$scope', '$modalInstance', '$translate', 'hmtgHelper',
 'msgrHelper', 'jnagentDlg', 'appSetting', 'hmtgAlert',
  function($scope, $modalInstance, $translate, hmtgHelper, msgrHelper, jnagentDlg, appSetting,
    hmtgAlert) {
    $scope.w = {};
    $scope.w.item = $scope.downloadC_item;

    $scope.ok = function() {
      try {
        if(hmtgHelper.isiOS) {
          hmtgHelper.inside_angular++;
          hmtgAlert.add_blob_download_item(new Blob([$scope.downloadC_data]), hmtg.util.decodeUtf8($scope.w.item.tick_str + ' ' + $scope.w.item.title + '.jnr'));
          hmtgHelper.inside_angular--;
        } else {
          hmtgHelper.save_file(new Blob([$scope.downloadC_data]), hmtg.util.decodeUtf8($scope.w.item.tick_str + ' ' + $scope.w.item.title + '.jnr'));
        }
      } catch(e) {
      }
      $scope.downloadC_data = null;
      $modalInstance.close();
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };

  }
])

;