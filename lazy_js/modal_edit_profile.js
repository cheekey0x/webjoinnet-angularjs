angular.module('msgr')
.controller('EditProfileModalCtrl', ['$scope', '$modalInstance', '$translate', 'hmtgHelper', '$sce', 'msgrHelper',
  function($scope, $modalInstance, $translate, hmtgHelper, $sce, msgrHelper) {
    $scope.w = {};
    var param = $scope.editp_param;
    $scope.w.is_mmc = param._mmc_messenger();
    $scope.subtitle = msgrHelper.CalcOfficeText1($translate.instant, param);
    if($scope.w.is_mmc) {
      $scope.w.url2 = $sce.trustAsResourceUrl($scope.editp_url);
    } else {
      $scope.w.visit_url = 'https://' + param._jnj_ip();
      if(param._port() != 443) {
        $scope.w.visit_url += ':' + param._port()
      }
      $scope.w.visit_url += '/weboffice_' + hmtg.util.decodeUtf8(param._userid()) + '.jnj?web=1';
      $scope.w.username = hmtg.util.decodeUtf8(param._username());
      $scope.w.email = hmtg.util.decodeUtf8(param._email());
      $scope.w.password0 = '';
      $scope.w.password1 = $scope.w.password2 = hmtg.util.decodeUtf8(param._password());
      $scope.w.deny_msg = !!param._deny_message();
    }

    $scope.style_height2 = { 'height': Math.max(200, (hmtgHelper.view_port_height - 195)) + 'px' };
    $scope.style_height3 = { 'max-height': Math.max(240, (hmtgHelper.view_port_height - 185)) + 'px' };

    $scope.copy = function() {
      var target = document.getElementById("edit_profile_url");
      if(!target) {
        return;
      }
      hmtg.util.selectText(target);
      try {
        document.execCommand('copy');
      } catch(e) {
      }
    }

    $scope.open_url = function() {
      window.open($scope.w.url2, hmtg.util.app_id + 'edit_profile').focus();
    }

    $scope.ok = function() {
      if($scope.w.password1 != $scope.w.password2) {
        hmtgHelper.MessageBox($translate.instant('IDS_PASSWORD_NOT_MATCH'), 0);
        return;
      }

      var username = hmtg.util.encodeUtf8($scope.w.username);
      if(username.length >= hmtg.config.MAX_USERNAME) {
        hmtgHelper.MessageBox($translate.instant('IDS_USERNAME_TOO_LONG'), 0);
        return;
      }
      if(!username.length) {
        hmtgHelper.MessageBox($translate.instant('IDS_EMPTY_USERNAME'), 0);
        return;
      }

      var email = hmtg.util.encodeUtf8($scope.w.email);
      if(email.length >= hmtg.config.MAX_EMAIL) {
        hmtgHelper.MessageBox($translate.instant('IDS_EMAIL_TOO_LONG'), 0);
        return;
      }

      var password = hmtg.util.encodeUtf8($scope.w.password1);
      if(password.length >= hmtg.config.MAX_PASSWORD) {
        hmtgHelper.MessageBox($translate.instant('IDS_PASSWORD_TOO_LONG'), 0);
        return;
      }

      var password0 = hmtg.util.encodeUtf8($scope.w.password0);
      if(password0 != param._password()) {
        hmtgHelper.MessageBox($translate.instant('IDS_INVALID_OLD_PASSWORD'), 0);
        return;
      }

      var name_changed = 0;
      if(username != param._username()) {
        name_changed = 1;
      }

      if(username != param._username()
        || email != param._email()
        || password != param._password()
        || $scope.w.deny_msg != !!param._deny_message()
      ) {
        param._username(username);
        param._email(email);
        param._password(password);
        param._deny_message($scope.w.deny_msg);
        hmtg.jmkernel.jm_command_WriteUserProfile(param);
      }

      if(name_changed) {
        hmtg.jmkernel.jm_command_PgcUsernameChange(param, param._userid());
      }
      if(password != param._password()) {
        hmtg.jmkernel.jm_command_UpdateWebOfficeProfile(param);
        hmtg.jmkernel.jm_command_WriteWBL();
      }

      $modalInstance.close();
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
])

;