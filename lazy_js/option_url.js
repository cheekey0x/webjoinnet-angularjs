angular.module('hmtgs')
.controller('MyURLCtrl', ['$scope', 'hmtgHelper', '$translate', 'hmtgSound', 'hmtgAlert',
  'appSetting', '$ocLazyLoad', 'joinnetHelper', 'jnjContent',
  function($scope, hmtgHelper, $translate, hmtgSound, hmtgAlert, appSetting, $ocLazyLoad, joinnetHelper, jnjContent) {
    $scope.w = {};
    $scope.as = appSetting;

    $scope.w.edit_name = $scope.w.edit_link = '';
    $scope.w.url_array = read_url();

    function read_url() {
      var array = [];
      try {
        array = typeof hmtg.util.localStorage['hmtg_url_array'] === 'undefined' ? [] : JSON.parse(hmtg.util.localStorage['hmtg_url_array']);
        if(!hmtg.util.isArray(array)) return [];
        if(array.length > 200) array.length = 200;
      } catch(e) {
        return [];
      }
      return array;
    }

    $scope.add_url = function() {
      if($scope.w.url_array.length >= 200) {
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_TOO_MANY_URL') }, 20);
        return;
      }

      $scope.w.edit_type = 'url';
      $scope.w.edit_name = '';
      $scope.w.edit_link = '';

      var item = { type: 'url', name: '', link: '', edit: 1 };
      $scope.w.editing = true;
      $scope.w.url_array.unshift(item);
    }

    $scope.add_jnj = function() {
      if($scope.w.url_array.length >= 200) {
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_TOO_MANY_URL') }, 20);
        return;
      }

      $scope.w.edit_type = 'jnj';
      $scope.w.edit_name = '';
      $scope.w.edit_jnj = '';

      var item = { type: 'jnj', name: '', jnj: '', edit: 1 };
      $scope.w.editing = true;
      $scope.w.url_array.unshift(item);
    }

    $scope.$watch('w.edit_jnj', function() {
      $scope.w.is_valid_jnj = $scope.w.edit_jnj && jnjContent.validateJnj($scope.w.edit_jnj);
      $scope.w.edit_jnjlink = calc_url($scope.w.edit_jnj);
    });

    function calc_url(jnj) {
      if(!jnj) return '';
      return location.href.split('?')[0].split('#')[0] + '?jnj=' + hmtg.util.encode64_url(hmtg.util.encodeUtf8(jnj));
    }

    $scope.edit = function(item) {
      item.edit = 2;
      $scope.w.editing = true;
      $scope.w.edit_type = item.type;
      $scope.w.edit_name = item.name;
      $scope.w.edit_link = item.link;
      $scope.w.edit_jnj = item.jnj;
    }

    $scope.copy = function() {
      var target = document.getElementById("option_url_jnjlink");
      if(!target) {
        return;
      }
      hmtg.util.selectText(target);
      try {
        document.execCommand('copy');
      } catch(e) {
      }
    }

    $scope.ok = function(item) {
      if($scope.w.edit_type == 'jnj') {
        if(!$scope.w.is_valid_jnj) {
          hmtgHelper.MessageBox($translate.instant('ID_INVALID_JNJ'), 0);
          return;
        }
        if(!$scope.w.edit_name) $scope.w.edit_name = 'Jnj';
      } else {
        if(!$scope.w.edit_link) return;
      }
      item.name = $scope.w.edit_name;
      item.link = $scope.w.edit_link;
      item.jnj = $scope.w.edit_jnj;
      item.edit = 0;
      $scope.w.editing = false;

      hmtg.util.localStorage['hmtg_url_array'] = JSON.stringify($scope.w.url_array);
    }

    $scope.cancel = function(item) {
      if(item.edit == 1) {
        $scope.w.url_array.shift();
      } else {
        item.edit = 0;
      }
      $scope.w.editing = false;
    }

    $scope.remove = function(item) {
      var idx = $scope.w.url_array.indexOf(item);
      if(idx != -1) {
        hmtgHelper.OKCancelMessageBox($translate.instant(item.type == 'jnj' ? 'ID_DELETE_JNJ_PROMPT' : 'ID_DELETE_URL_PROMPT'), 0, ok);
      }
      function ok() {
        $scope.w.edit_name = item.name;
        $scope.w.edit_link = item.link;
        $scope.w.url_array.splice(idx, 1);
        hmtg.util.localStorage['hmtg_url_array'] = JSON.stringify($scope.w.url_array);
      }
    }

    $scope.move_up = function(item) {
      var idx = $scope.w.url_array.indexOf(item);
      if(idx == -1) return;
      if(idx == 0) return;

      $scope.w.url_array.splice(idx, 1)
      $scope.w.url_array.splice(idx - 1, 0, item);
      hmtg.util.localStorage['hmtg_url_array'] = JSON.stringify($scope.w.url_array);
    }

    $scope.move_down = function(item) {
      var idx = $scope.w.url_array.indexOf(item);
      if(idx == -1) return;
      if(idx == $scope.w.url_array.length - 1) return;

      $scope.w.url_array.splice(idx, 1)
      $scope.w.url_array.splice(idx + 1, 0, item);
      hmtg.util.localStorage['hmtg_url_array'] = JSON.stringify($scope.w.url_array);
    }

    $scope.click_url = function(item) {
      hmtgHelper.inside_angular++;
      if(item.type == 'jnj') {
        if(hmtg.jmkernel.jm_callback_LaunchJoinNet) hmtg.jmkernel.jm_callback_LaunchJoinNet(hmtg.util.encodeUtf8(item.jnj));
      } else {
        joinnetHelper.connect_url(item.link);
      }
      hmtgHelper.inside_angular--;
    }

  }
])
;
