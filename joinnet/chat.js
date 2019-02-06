/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('chat', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope',
  function($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope) {
    var _chat = this;
    this.data = [];
    this.sendto_list = [];

    this.add_chat = function(source_ssrc, target_ssrc, settopflag, text, codepage, ts, date, is_chat_area_visible) {
      var data = _chat.data;
      var target = {};
      target.text = hmtg.util.decodeUtf8(text);
      target.class_text = text.indexOf('>[To:') != -1 ? 'text-danger' : '';
      target.src = source_ssrc;
      target.dst = target_ssrc;
      target.ts = ts;
      target.date = date;
      data.push(target);

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_CHAT, true);

      if(source_ssrc != hmtg.jnkernel._jn_ssrc_index()) {
        if($rootScope.nav_item != 'joinnet' || !is_chat_area_visible) {
          var item = {};
          item['timeout'] = 30;
          item['text'] = hmtg.util.decodeUtf8(text);
          item['type'] = 'info';
          item['click'] = function(index) {
            hmtgHelper.inside_angular++;
            $rootScope.$broadcast(hmtgHelper.WM_SHOW_CHAT_AREA);
            clearTimeout(hmtgAlert.chat_alert_array[index].timeout_id);
            hmtgAlert.chat_alert_array.splice(index, 1);
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
            hmtgHelper.inside_angular--;
          };

          hmtgAlert.update_chat_alert_item(item);
        }
      } else {
        hmtgAlert.clear_chat_alert_item();
      }
    }

    this.reset = function() {
      _chat.data = [];
      _chat.sendto_list = [];
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_CHAT);
    }

    this.event_quit_session = function() {
      _chat.sendto_list = [];
      hmtgAlert.clear_chat_alert_item();
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_CHAT);
    }

  }
])

;
