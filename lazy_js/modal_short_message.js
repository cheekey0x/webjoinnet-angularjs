angular.module('msgr')
.controller('ShortMessageModalCtrl', ['$scope', '$modalInstance',
  function ($scope, $modalInstance) {
    $scope.w = {};

    setTimeout(function () {
      var elem = document.getElementById("message_text");
      if(elem) elem.focus();
    }, 100);

    $scope.ok = function () {
      if(!$scope.w.text) return;
      var text = hmtg.util.encodeUtf8($scope.w.text);
      if(text.length >= 500) return;
      $modalInstance.close({
        text: text
      });
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
])

;