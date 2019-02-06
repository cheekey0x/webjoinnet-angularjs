/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('joinnetHelper', ['hmtgAlert', 'hmtgHelper', '$modal', '$rootScope', '$translate', 'jnjContent', '$http',
  function(hmtgAlert, hmtgHelper, $modal, $rootScope, $translate, jnjContent, $http) {
    this.errorcode2id = function(code) {
      switch(code) {
        // general error                      
        case hmtg.config.JN_RESOLVE_PROXY:
          return 'IDS_RESOLVE_PROXY';

        case hmtg.config.JN_FAIL_CONNECT_GC:
          return 'IDS_FAIL_CONNECT_GC';

        case hmtg.config.JN_CONNECT_GC_BROKEN:
          return 'IDS_CONNECT_GC_BROKEN';

        case hmtg.config.JN_CONNECTING_MCU:
          return 'IDS_CONNECTING_MCU';

        case hmtg.config.JN_FAIL_CONNECT_MCU:
          return 'IDS_FAIL_CONNECT_MCU';

        case hmtg.config.JN_NO_SCHEDULE:
          return 'IDS_NO_SCHEDULE';

        case hmtg.config.JN_WRONG_IP_PASSWD:
          return 'IDS_WRONG_IP_PASSWD';

        case hmtg.config.JN_WRONG_AUTH_PASSWD:
          return 'IDS_WRONG_AUTH_PASSWD';

        case hmtg.config.JN_MEETING_NOT_EXIST2:
          return 'IDS_MEETING_NOT_EXIST2';

        case hmtg.config.JN_TOOMANY_USER_2:
          return 'IDS_TOOMANY_USER_2';

        case hmtg.config.JN_CONNECTION_ESTABLISHED:
          return 'IDS_CONNECTION_ESTABLISHED';

        case hmtg.config.JN_QUESTION_CANCEL_DUE_TRANSFER:
          return 'IDS_QUESTION_CANCEL_DUE_TRANSFER';

        case hmtg.config.JN_YOU_HAVENOT_TOKEN:
          return 'IDS_YOU_HAVENOT_TOKEN';

        case hmtg.config.JN_NEW_USER:
          return 'IDS_NEW_USER';

        case hmtg.config.JN_USER_LEAVE:
          return 'IDS_USER_LEAVE';

        case hmtg.config.JN_QUESTION_FINISH:
          return 'IDS_QUESTION_FINISH';

        case hmtg.config.JN_QUESTION_ACCEPTED:
          return 'IDS_QUESTION_ACCEPTED';

        case hmtg.config.JN_QUESTION_IN_QUEUE:
          return 'IDS_QUESTION_IN_QUEUE';

        case hmtg.config.JN_QUESTION_SKIPPED:
          return 'IDS_QUESTION_SKIPPED';

        case hmtg.config.JN_DISCONNECT_BY_OWNER:
          return 'IDS_DISCONNECT_BY_OWNER';

        case hmtg.config.JN_MEETING_OVER:
          return 'IDS_MEETING_OVER';

        case hmtg.config.JN_QUESTION_CANCELED:
          return 'IDS_QUESTION_CANCELED';

        case hmtg.config.JN_USER_OVERWRITE:
          return 'IDS_USER_OVERWRITE';

        case hmtg.config.JN_YOU_HAVE_TOKEN:
          return 'IDS_YOU_HAVE_TOKEN';

        case hmtg.config.JN_FILE_READ_ERROR:
          return 'IDS_FILE_READ_ERROR';

        case hmtg.config.JN_FILE_PAGE_ERROR:
          return 'IDS_FILE_PAGE_ERROR';

        case hmtg.config.JN_NO_MCU:
          return 'IDS_NO_MCU';

        case hmtg.config.JN_CONNECT_PROXY_NO_CONNECT_MCU:
          return 'IDS_CONNECT_PROXY_NO_CONNECT_MCU';

        case hmtg.config.JN_MCU_TALK_MISMATCH:
          return 'IDS_MCU_TALK_MISMATCH';

        case hmtg.config.JN_TESTING_AV:
          return 'IDS_TESTING_AV';

        case hmtg.config.JN_FAIL_UDP:
          return 'IDS_FAIL_UDP';

        case hmtg.config.JN_CORRUPT_SERVER_PARAMETER:
          return 'IDS_JN_CORRUPT_SERVER_PARAMETER';

        case hmtg.config.JN_DELETE_FILE_OK:
          return 'IDS_JN_DELETE_FILE_OK';

        case hmtg.config.JN_DELETE_FILE_FAIL:
          return 'IDS_JN_DELETE_FILE_FAIL';


        case hmtg.config.JN_JNJ_FILE_READ_ERROR:
          return 'IDS_CAN_NOT_READ_JNJ';


        case hmtg.config.JN_JNJ_UNKNOWN_CODE_TYPE:
          return 'IDS_UNKNOWN_CODETYPE';


        case hmtg.config.JN_JNR_FILE_ERROR:
          return 'IDS_RECORDING_FILE_ERROR';


        case hmtg.config.JN_MEETING_TERMINATED:
          return 'IDS_WARNING_MEETING_TERMINATED';


        case hmtg.config.JN_PREPARATION_MODE:
          return 'IDS_PREPARATION_MODE';


        case hmtg.config.JN_PREPARATION_SWITCH_TO_NORMAL:
          return 'IDS_PREPARATION_SWITCH_TO_NORMAL';


          // mcu error
        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_WRONG_USERID:
          return 'IDS_NO_USERID';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_WRONG_PASSWD:
          return 'IDS_WRONG_PASSWD';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_ALREADY_LOGGED:
          return 'IDS_ALREADY_LOGGED';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_PARAMETER:
          return 'IDS_ILLEGAL_PARAM';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_SESSIONID:
          return 'IDS_WRONG_SESSIONID';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_MEETING_NOT_EXIST:
          return 'IDS_MEETING_NOT_EXIST';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_INTERNAL:
          return 'IDS_INTERNAL_ERROR';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_FILE_ERROR:
          return 'IDS_FILE_ERROR';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_TOOMANY_PLAYBACK:
          return 'IDS_TOOMANY_PLAYBACK';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_ILLEGAL_FILE:
          return 'IDS_ILLEGAL_FILE';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_WRONG_PASSWD2:
          return 'IDS_WRONG_PASSWD2';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_TOOMANY_DOWNLOAD:
          return 'IDS_TOOMANY_DOWNLOAD';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_TOOMANY_USER:
          return 'IDS_TOOMANY_USER';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_CALL_REJECTED:
          return 'IDS_CALL_REJECTED';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_CALL_NOT_ACCEPTED:
          return 'IDS_CALL_NOT_ACCEPTED';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_JOINNETMODE:
          return 'IDS_WRONG_JOINNET_MODE';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_SESSION_CLOSED:
          return 'IDS_SESSION_CLOSED';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_TOO_MANY_SESSION:
          return 'IDS_SERVER_BUSY';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_CAN_NOT_RECORD:
          return 'IDS_CAN_NOT_RECORD';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_MESSAGE_NOT_EXIST:
          return 'IDS_MESSAGE_NOT_EXIST';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_LINE_BUSY:
          return 'IDS_LINE_BUSY';


          // added by liuq for jnkernel 1.8.0
        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_EXCEED_DISK_QUOTA:
          return 'IDS_ERROR_EXCEED_DISK_QUOTA';


          // added by liuq for jnkernel 1.9.0
        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_WRONG_USERINFO2:
          return 'IDS_ERROR_WRONG_USERINFO2';


          // added by liuq for jnkernel 1.11.0
        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_OWNER_IN_PREPARATION_MODE:
          return 'IDS_ERROR_OWNER_IN_PREPARATION_MODE';


        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_PREPARATION_MODE_TOO_LATE:
          return 'IDS_ERROR_PREPARATION_MODE_TOO_LATE';


        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_ILLEGAL_REQUEST:
          return 'IDS_ERROR_ILLEGAL_REQUEST';


        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_OUT_OF_MEMORY:
          return 'IDS_ERROR_MCU_OUT_OF_MEMORY';


        case hmtg.config.JN_MCU_RELAY_BASE + hmtg.config.MRP_ERROR_CONTINUE:
          return 'IDS_MCU_RELAY_ERROR_CONTINUE';


        case hmtg.config.JN_MCU_RELAY_BASE + hmtg.config.MRP_ERROR_SLIDENOTREADY:
          return 'IDS_MCU_RELAY_ERROR_SLIDENOTREADY';


        case hmtg.config.JN_EARLY_DISCONNECTION_1:
          return 'IDS_PROXY_FAIL_CONNECT_MCU';


        case hmtg.config.JN_EARLY_DISCONNECTION_2:
          return 'IDS_CONNECTION_REFUSED';


        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_INVALID_LICENSE:
          return 'IDS_ERROR_INVALID_LICENSE';


        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_REQUEST_REJECTED:
          return 'IDS_ERROR_REQUEST_REJECTED';

        case hmtg.config.JN_ERROR_BASE - 256 + hmtg.config.ERROR_VERSION:
          return 'IDS_WRONG_VERSION';


        case hmtg.config.JN_UNKNOWN_ERROR:
          return 'IDS_UNKNOWN_ERROR';
        default:
          return 'IDS_UNKNOWN_ERROR' + '(' + code + ')';
      }
    }

    this.prompt_for_visitor_info = function(userid, force_type, type) {
      $rootScope.WebOfficeVisitor = {};
      $rootScope.WebOfficeVisitor.userid = userid;
      if(force_type) {
        $rootScope.WebOfficeVisitor.force_type = force_type;
        $rootScope.WebOfficeVisitor.type = type;
      }
      var modalInstance = $modal.open({
        templateUrl: 'template/WebOfficeVisitor.htm' + hmtgHelper.cache_param,
        scope: $rootScope,
        controller: 'WebOfficeVisitorModalCtrl',
        size: '',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(function(result) {
        hmtgHelper.inside_angular++;
        if(result.type == 0) {
          hmtg.util.localStorage['hmtg_visitor_name'] = hmtg.util.decodeUtf8(result.name);
          hmtg.jnkernel.jn_command_WebOfficeSetVisitorName(result.name);
        } else {
          hmtg.jnkernel.jn_command_WebOfficeSetOwnerPassword(result.password);
        }
        hmtg.jnkernel.jn_command_QuitConnection(); // to stop previous session if necessary
        hmtg.jnkernel.jn_command_initconnectmedia();
        hmtgHelper.snapshot_count = 1;
        hmtgHelper.inside_angular--;
      }, function() {
        jnjContent.valid_jnj = false;
      });
    }

    this.change_fullscreen_mode = function(mode, view) {
      if(hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        var sync_fullscreen_controller = hmtg.jnkernel._fullscreen_ssrc();
        var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
        if(sync_fullscreen_controller == my_ssrc) {
          hmtg.jnkernel.jn_command_SyncFullScreen(mode, view);
        }
      }
    }

    this.prompt_sync_fullscreen = function(click_callback) {
      // auto sync failed, try to prompt for manually sync
      var item = {};
      item['timeout'] = 20;
      item['update'] = function() { return $translate.instant('ID_SYNC_FULLSCREEN') };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['click'] = function(index) {
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;
        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);
        click_callback();
        hmtgHelper.inside_angular--;
      };

      hmtgAlert.add_link_item(item);
      return item;
    }

    this.connect_url = function(link) {
      var jnj;
      var pattern = new RegExp(':\\/\\/[^\\s]+\\?jnj=([a-zA-Z0-9\\-_\\/=\\+]+)', 'i');
      var m;
      m = pattern.exec(link);
      if(m && m[1]) {
        jnj = hmtg.util.decode64_url(m[1]);
        if(!jnjContent.validateJnj(jnj)) {
          jnj = '';
        }
      }
      if(jnj) {
        hmtgHelper.inside_angular++;
        hmtg.jmkernel.jm_callback_LaunchJoinNet(jnj);
        hmtgHelper.inside_angular--;
        return;
      }
      $http.get(link)
        .success(function(data, status) {
          hmtgHelper.inside_angular++;
          if(jnjContent.validateJnj(data)) {
            hmtg.jmkernel.jm_callback_LaunchJoinNet(data);
          } else {
            // document.write("<br><br><br><br><br><br><a target=\"webapp\" href=\"http://www.homemeeting.com/web/?jnj=IyBpZiB5b3Ugc2VlIHRoaXMgZmlsZSwgcGxlYXNlIGRvd25sb2FkIGFuZCByZWluc3RhbGwgSm9pbk5ldCBzb2Z0d2FyZSBmcm9tIGh0dHA6Ly93d3cuaG9tZW1lZXRpbmcuY29tDQpbZ2VuZXJhbF0NCmNvZGV0eXBlPTEzDQppcD0xOTIuMTY4LjE2OC4yNiANCmRvbWFpbj1Ib21lTWVldGluZw0KcG9ydG09MjMzNA0KYWN0aW9uPTENCmd1aV9yZWNfdmVyPQ0KZ3VpX21pbl92ZXI9DQp1c2VyaW5mbz1rZXlfd2ViX2xvY2FsaG9zdHxueUtLNzIySnZ3UmRIVk9iaW1zem5Cb042RlN2UWVTVHZQVk11QkVqUHowPXxmbmo5UVphcVZ1L2I0RkNJKzloR09aVjdHS004WmE0M01Cb3UxYXRIK05kVzRuclpYeUlGZzhXeVVBQkpGbEEzVXN4RTlldTNlbmJKWi92aWhNZXFKTlZsb3o0Kys1a2FnaXgvekV2N3oyUDBMQThmZHZXbW1NbWVhcXRGdjhtbjRQU0c1a2FjUDY5ekZyNis5VDcvTXNycmZYT3UzVHBxMkJhbDYyVlNheWNEMDBVV3ZMVVJpUWJKTE13cnV3Mjk3RzdCVExYSWNMVXJETWlKS21UNTQvczd4cExTU2xWYVBXYWN0cDVFcjBJWGhTUkRVTkV2Y250VDZ4V3IzYUc3VGdVeDlPYmhya1AxTDFLZHJDU1F2WHZLQ2tkV1Jpc05pSXJXcGw4T1lIVkJXNXFPbVp0WFJYK080Qks3S1NmNUVpcytzc0FlK2pQbW80ckxseThWRnZJejZMWT18TlIzOXNGa2FwSU84UGFIaWc5am10MjMvaDhzPQ0K\"><b>Web JoinNet</b></a>");				
            var pattern = new RegExp(':\\/\\/[^\\s]+\\?jnj=([a-zA-Z0-9\\-_\\/=\\+]+)', 'i');
            var m;
            m = pattern.exec(data);
            if(m && m[1]) {
              jnj = hmtg.util.decode64_url(m[1]);
              if(!jnjContent.validateJnj(jnj)) {
                jnj = '';
              }
            }
            if(jnj) {
              hmtg.jmkernel.jm_callback_LaunchJoinNet(jnj);
            } else {
              invalid_jnj(link);
            }
          }
          hmtgHelper.inside_angular--;
        })
        .error(function(data, status) {
          hmtgHelper.inside_angular++;
          invalid_jnj(link);
          hmtgHelper.inside_angular--;
        });

      function invalid_jnj(link) {
        var item = {};
        item['timeout'] = 20;
        item['update'] = function() { return $translate.instant('ID_NO_JNJ_IN_URL') };
        item['text'] = item['update']();
        item['type'] = 'info';
        item['click'] = function(index) {
          var w = window.open(link, 'url');
          if(w) w.focus();

          hmtgHelper.inside_angular++;
          hmtgAlert.click_link(index);
          hmtgHelper.inside_angular--;
        };

        hmtgAlert.add_link_item(item);
      }
    }

  }
])

.controller('WebOfficeVisitorModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', 'hmtgHelper',
  function($scope, $modalInstance, $modal, $translate, hmtgHelper) {
    $scope.w = {};
    $scope.w.password = '';
    $scope.w.name = typeof hmtg.util.localStorage['hmtg_visitor_name'] !== 'string' ? '' : hmtg.util.localStorage['hmtg_visitor_name'];
    $scope.w.force_type = $scope.WebOfficeVisitor.force_type;
    if($scope.w.force_type) {
      $scope.w.type = $scope.WebOfficeVisitor.type;
    } else {
      $scope.w.type = 0;
    }

    setTimeout(function() {
      var elem = document.getElementById($scope.w.type ? 'password' : 'name');
      if(elem) elem.focus();
    }, 100);


    if($scope.WebOfficeVisitor.title) {
      $scope.title = $scope.WebOfficeVisitor.title;
    } else {
      $scope.title = $translate.instant('ID_WEBOFFICE_VISITOR_TITLE').replace('%s', hmtg.util.decodeUtf8($scope.WebOfficeVisitor.userid));
    }

    $scope.ok = function() {
      var name = hmtg.util.encodeUtf8($scope.w.name);
      var password = hmtg.util.encodeUtf8($scope.w.password);
      if($scope.w.type == 0) {
        if(!name) return;
        if(name.length >= hmtg.config.MAX_USERNAME) {
          hmtgHelper.MessageBox($translate.instant('IDS_USERNAME_TOO_LONG'), 0);
          return;
        }
      } else {
        if(!password) return;
        if(password.length >= hmtg.config.MAX_PASSWORD) {
          hmtgHelper.MessageBox($translate.instant('IDS_PASSWORD_TOO_LONG'), 0);
          return;
        }
      }
      $modalInstance.close({
        type: $scope.w.type,
        name: name,
        password: password
      });
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
])

;
