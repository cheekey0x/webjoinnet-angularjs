angular.module('hmtgs')
.controller('JeditorModalCtrl', ['$scope', '$modalInstance', '$translate', 'hmtgHelper',
  function($scope, $modalInstance, $translate, hmtgHelper) {
    $scope.w = {};
    $scope.w.item = $scope.item;
    $scope.w.start = $scope.w.end = '00:00:00';
    var cmd0 = $scope.w.text = '#NTT=' + hmtg.util.decodeUtf8($scope.title)
    + '\n#CUT=00:00:00,00:00:00'
    + '\n#CTA=00:00:00,00:00:00'
    + '\n#CTA#=00:00:00,00:00:00'
    + '\n#CTV=00:00:00,00:00:00'
    + '\n#CTV#=00:00:00,00:00:00'
    + '\n#CTT=00:00:00,00:00:00'
    + '\n#CTP=00:00:00,00:00:00';

    $scope.ok = function() {
      var c = '';
      var w = $scope.w;
      if(w.cut_all) {
        c += 'CUT=' + w.start + ',' + w.end + '\n';
      }
      if(w.cut_video) {
        c += 'CVD\n';
      }
      if(w.keep_v) {
        c += 'TCV\n';
      }
      if(w.keep_av) {
        c += 'CAV\n';
      }
      if(w.cut_text) {
        c += 'CAT\n';
      }
      if(w.cut_url) {
        c += 'BAU\n';
      }
      if(w.text) {
        c += w.text;
      }
      if(c == cmd0) return;
      if(!c) return;
      if(c.length > 30000) return;
      $modalInstance.close(hmtg.util.encodeUtf8(c));
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
])

;