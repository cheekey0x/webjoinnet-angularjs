angular.module('msgr')
.controller('MsgrSigninModalCtrl', ['$rootScope', '$scope', '$modalInstance', '$modal', '$translate', 'Msgr', 'msgrHelper', 'appSetting', 'hmtgSound', 'hmtgHelper',
  function ($rootScope, $scope, $modalInstance, $modal, $translate, Msgr, msgrHelper, appSetting, hmtgSound, hmtgHelper) {
    $scope.w = {};
    $scope.w.remember_passwd = false;
    $scope.w.password = '';
    $scope.w.bad_https = false;
    $scope.w.is_reconnect = $scope.reconnect_flag ? true : false;
    $scope.w.is_password_error = $scope.password_error ? true : false;
    if($scope.reconnect_flag) {
      $scope.w.remember_passwd = $scope.to_remember_passwd;
      $scope.w.password = hmtg.util.decodeUtf8($scope.reconnect_password);
      $scope.title = $translate.instant('IDS_CONNECTION_STATUS_PREPARE_RECONNECT');
    } else {
      $scope.title = $translate.instant('IDD_DIALOG_SIGNIN');
    }

    var LS_list = hmtg.util.localStorage['hmtg_msgr_homepage_list'];
    var list = [];
    if(typeof LS_list == 'string') {
      var a_list = hmtg.util.parseJSON(LS_list);
      if(a_list === 'undefined') a_list = [];
      if(hmtg.util.isArray(a_list)) {
        list = a_list.slice(0, 10);
      }
    }
    $scope.hmlist = [];
    var i;
    for(i = 0; i < list.length; i++) {
      if(typeof list[i] == 'string') $scope.hmlist.push({ name: list[i] });
    }

    var homepage_value = list[0] ? list[0] : "";

    var LS_list = hmtg.util.localStorage['hmtg_msgr_userid_list'];
    var list = [];
    if(typeof LS_list == 'string') {
      var a_list = hmtg.util.parseJSON(LS_list);
      if(a_list === 'undefined') a_list = [];
      if(hmtg.util.isArray(a_list)) {
        list = a_list.slice(0, 10);
      }
    }
    $scope.idlist = [];
    var i;
    for(i = 0; i < list.length; i++) {
      if(typeof list[i] == 'string') $scope.idlist.push({ name: list[i] });
    }

    var userid_value = list[0] ? list[0] : "";
    if($scope.m_homepage && $scope.m_userid) {
      homepage_value = $scope.m_homepage;
      userid_value = $scope.m_userid;
    }
    $scope.homepage_placeholder = homepage_value ? '' : $translate.instant('IDC_STATIC_1_HOMEPAGE');
    $scope.userid_placeholder = userid_value ? '' : $translate.instant('IDS_COL_USERID');

    $scope.w.initial_status = $scope.initial_status || hmtg.config.ONLINE_STATUS_ONLINE;
    $scope.w.guest = false;
    $scope.w.homepage = homepage_value;
    $scope.w.userid = userid_value;

    $scope.$watch('w.homepage', function () {
      $scope.w.bad_https = false;
      if($scope.w.homepage) {
        var h = $scope.w.homepage.toLowerCase();
        if(h.length >= 8) {
          if(h.indexOf('https://') != 0)
            $scope.w.bad_https = true;
        } else {
          if('https://'.indexOf(h) != 0)
            $scope.w.bad_https = true;
        }
      }
    });

    $scope.userstatus2string = function (status) {
      return $translate.instant(msgrHelper.userstatus2id(status, 0, 1));
    }

    $scope.ok = function () {
      if(!$scope.w.homepage) return;
      if(!$scope.w.userid && !$scope.w.guest) return;
      var hp = $scope.w.homepage;
      var scheme = hmtg.util.schemeURL(hp);
      if(!scheme) {
        hp = ($rootScope.is_secure ? 'https://' : 'http://') + hp;
      }
      if($rootScope.is_secure && appSetting.auto_https && hp.toLowerCase().indexOf('http://') == 0) {
        var old = hp;
        hp = 'https://' + hp.slice(7);
        hmtgHelper.inside_angular++;
        hmtgSound.ShowInfoPrompt(function () {
          return $translate.instant('ID_HTTP_TO_HTTPS').replace('#http#', old).replace('#https#', hp);
        }, 10, false);
        hmtgHelper.inside_angular--;
      }
      $modalInstance.close({
        homepage: hmtg.util.encodeUtf8Ex(hp, 100),
        guest: $scope.w.guest,
        userid: hmtg.util.encodeUtf8Ex($scope.w.userid, hmtg.config.MAX_USERID),
        password: hmtg.util.encodeUtf8Ex($scope.w.password, hmtg.config.MAX_PASSWORD),
        initial_status: $scope.w.initial_status,
        remember_passwd: $scope.w.remember_passwd
      });
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
])

;
