angular.module('joinnet')
.controller('ReconnectNameCtrl', ['$scope', 'hmtgHelper', '$rootScope', 'jnjContent', 'audio_codec', 'video_codec',
'video_playback', '$translate', '$modal', 'reconnectName', 'browser', 'JoinNet', 'hmtgAlert', 'appSetting', 'hmtgSound',
  function ($scope, hmtgHelper, $rootScope, jnjContent, audio_codec, video_codec, video_playback, $translate, $modal,
  reconnectName, browser, JoinNet, hmtgAlert, appSetting, hmtgSound) {
    $scope.w = reconnectName;
    $scope.as = appSetting;

    $scope.calc_real_name = function (item) {
      return hmtg.util.decodeUtf8(item.real_name);
    }

    $scope.connect = function(item) {
      hmtgSound.turnOnAudio();
      // var jnj = item.jnj;

      if(
        // jnjContent.valid_jnj ||
        hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting()) {
        var text;
        // if(hmtg.jnkernel._jn_bConnecting() || hmtg.jnkernel._jn_bConnected())
          text = $translate.instant('ID_JOINNET_ACTIVE_SESSION') + ' ' + $translate.instant('ID_CONTINUE_PROMPT');
        // else
        //   text = $translate.instant('ID_JOINNET_IDLE_SESSION') + ' ' + $translate.instant('ID_CONTINUE_PROMPT');
        hmtgHelper.OKCancelMessageBox(text, 20, action);
      } else {
        action();
      }
      function action() {
        hmtgHelper.inside_angular++;
        $scope.usePermit(item);
        hmtgHelper.inside_angular--;
      }
    }

    $scope.open_jnj = function(item) {
      hmtgSound.turnOnAudio();
      $rootScope.nav_item = 'jnj';
      $rootScope.$broadcast(hmtgHelper.WM_OPEN_JNJ, item.jnj);
    }

    $scope.remove = function (item) {
      reconnectName.delete_reconnect_name(item);
      if(!reconnectName.reconnect_name_array.length) {
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;
      }
    }

    $scope.usePermit = function (item) {
      var jnj = item.jnj;
      JoinNet.jnj = hmtg.util.localStorage['last_jnj'] = jnj;

      jnjContent.parseJnj(jnj);
      if(!jnjContent.valid_jnj) {
        return;
      }

      hmtg.util.log("jnj content:\n" + hmtg.util.decodeUtf8(jnj));
      if(!hmtg.jnkernel.jn_command_read_jnj(jnjContent)) return;

      JoinNet.resetAutoReconnect();
      $rootScope.$broadcast(hmtgHelper.WM_RESET_SESSION);
      hmtgAlert.update_status_item({});
      browser.reset();

      $rootScope.nav_item = 'joinnet';
      $rootScope.tabs[2].active = true;

      $rootScope.$broadcast(hmtgHelper.WM_WORKMODE_CHANGED);
      // reset vars for new meeting/jnj
      audio_codec.launch_from_jnj();
      video_codec.launch_from_jnj();
      video_playback.launch_from_jnj();

      hmtg.jnkernel.jn_command_UseReconnectName(item.reconnect_name);
      if(hmtg.jnkernel.jn_info_GetWebOfficeVisitorTargetID()) {
        if(item.ssrc != 0) {
          hmtg.util.localStorage['hmtg_visitor_name'] = hmtg.util.decodeUtf8(item.real_name);
          hmtg.jnkernel.jn_command_WebOfficeSetVisitorName(item.real_name);
        } else {
          hmtg.jnkernel.jn_command_WebOfficeSetOwnerPassword('');
        }
      }
      hmtg.jnkernel.jn_command_QuitConnection(); // to stop previous session if necessary
      hmtg.jnkernel.jn_command_initconnectmedia();
      hmtgHelper.snapshot_count = 1;
    }

    $scope.checkPermit = function () {
      var count = 0;
      var now = Date.now();
      var i;
      var idx = -1;
      var array = reconnectName.reconnect_name_array;
      for(i = 0; i < array.length; i++) {
        if(array[i].tick && (now - array[i].tick) < reconnectName.check_permit_time_window * 60 * 1000) {
          count++;
          idx = i;
        }
      }

      if(count == 0) return;

      if(count > 1) {
        var item = {};
        item['timeout'] = 30;
        item['update'] = function () { return $translate.instant('ID_MULTI_PERMIT_PROMPT') };
        item['text'] = item['update']();
        item['type'] = 'info';
        item['click'] = function(index) {
          hmtgSound.turnOnAudio();
          hmtgHelper.inside_angular++;
          hmtgAlert.click_link(index);
          $rootScope.nav_item = 'reconnect_name';
          $rootScope.tabs[3].active = true;
          $rootScope.selectTabReconnectName();
          hmtgHelper.inside_angular--;
        };

        hmtgAlert.add_link_item(item);
      } else {
        var item = {};
        item['timeout'] = 30;
        var myname = hmtg.util.decodeUtf8(array[idx].real_name);
        item['update'] = function () {
          return $translate.instant('ID_PERMIT_PROMPT').
          replace('#name#', myname)
        };
        item['text'] = item['update']();
        item['type'] = 'info';
        item['click'] = function(index) {
          hmtgSound.turnOnAudio();
          hmtgHelper.inside_angular++;
          hmtgAlert.click_link(index);
          $scope.usePermit(array[idx]);
          hmtgHelper.inside_angular--;
        };

        hmtgAlert.add_link_item(item);
      }
    }

    // relay from the reconnectName service
    var now = Date.now();
    if(reconnectName.to_check_permit && (now - reconnectName.to_check_permit_tick) < 10000) {
      hmtgHelper.inside_angular++;
      $scope.checkPermit();
      hmtgHelper.inside_angular--;
    }
  }
])
;