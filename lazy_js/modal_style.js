angular.module('msgr')
.controller('StyleModalCtrl', ['$scope', '$modalInstance', 'imDlg', '$translate', 'appSetting', 'board', 'imStyle',
  function($scope, $modalInstance, imDlg, $translate, appSetting, board, imStyle) {
    $scope.as = appSetting;
    $scope.bd = board;
    $scope.w = {};

    var im = $scope.im;
    var param = im.m_param;
    var old_style = param._im_style_flag();
    param._imstyle(imStyle.style2object(param._im_style_flag()));
    $scope.st = param._imstyle();

    var tmp = param._ngstyle();
    if(tmp.color) {
      $scope.w.color = tmp.color;
    } else {
      $scope.w.color = '#000000';
    }

    $scope.style_color = function(idx) {
      return { 'color': board.colors[idx], 'background-color': board.colors[idx] }
    }
    $scope.choose_color = function(idx) {
      update_color(board.colors[idx]);
    }

    $scope.$watch('w.color', function(newValue, oldValue) {
      if(typeof newValue !== 'string') return;
      update_color(newValue);
    });

    function update_color(color) {
      var value = parseInt(color.slice(1), 16);
      if(isNaN(value)) value = 0x000000;
      var r = (value >> 16) & 0xff;
      var g = (value >> 8) & 0xff;
      var b = value & 0xff;
      $scope.st.has_color = true;
      $scope.st.red = r;
      $scope.st.green = g;
      $scope.st.blue = b;
      update_style();
    }

    $scope.$watch('st.is_bold', update_style);
    $scope.$watch('st.is_italic', update_style);
    $scope.$watch('st.is_underline', update_style);
    $scope.$watch('st.is_strike', update_style);

    function update_style() {
      var style = imStyle.object2style($scope.st);
      param._im_style_flag(style);
      param._ngclass(imStyle.ngclass(style));
      param._ngstyle(imStyle.ngstyle(style));
    }

    $scope.ok = function() {
      var new_style = param._im_style_flag();
      if(new_style != old_style) {
        hmtg.jmkernel.jm_command_TouchClientInfo(param);
      }
      $modalInstance.close();
    };

    $scope.cancel = function() {
      param._im_style_flag(old_style);
      param._ngclass(imStyle.ngclass(old_style));
      param._ngstyle(imStyle.ngstyle(old_style));
      $modalInstance.dismiss('cancel');
    };
  }
])

;