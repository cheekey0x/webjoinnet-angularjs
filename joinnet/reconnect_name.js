/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('reconnectName', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope',
  function ($translate, appSetting, hmtgHelper, $rootScope) {
    var _reconnectName = this;
    this.check_permit_time_window = 60; // 1 hour
    this.permit_expiration_threshold = 3 * 60; // 3 hours
    this.reconnect_name_array = read_reconnect_name();

    function read_reconnect_name() {
      var array = [];
      try {
        array = typeof hmtg.util.localStorage['hmtg_reconnect_name_array'] === 'undefined' ? [] : JSON.parse(hmtg.util.localStorage['hmtg_reconnect_name_array']);
        if(!hmtg.util.isArray(array)) return [];
        var i;
        var now = Date.now();
        for(i = 0; i < array.length && i < 200; i++) {
          if(!array[i].tick || (now - array[i].tick) > _reconnectName.permit_expiration_threshold * 60 * 1000) {
            array = array.slice(0, i);
            break;
          }
        }
      } catch(e) {
        return [];
      }
      return array;
    }

    this.checkPermit = function () {
      var count = 0;
      var now = Date.now();
      var i;
      var idx = -1;
      var array = _reconnectName.reconnect_name_array;
      for(i = 0; i < array.length; i++) {
        if(array[i].tick && (now - array[i].tick) < this.permit_expiration_threshold * 60 * 1000) {
          count++;
          idx = i;
        }
      }

      if(count == 0) return;

      // relay to the controller
      this.to_check_permit = true;
      this.to_check_permit_tick = now;
      $rootScope.selectTabReconnectName();
    }

    function write_reconnect_name() {
      var array = _reconnectName.reconnect_name_array;
      var i;
      var now = Date.now();
      for(i = 0; i < array.length && i < 200; i++) {
        if(!array[i].tick || (now - array[i].tick) > _reconnectName.permit_expiration_threshold * 60 * 1000) {
          array = _reconnectName.reconnect_name_array = array.slice(0, i);
          break;
        }
      }
      hmtg.util.localStorage['hmtg_reconnect_name_array'] = JSON.stringify(array);
    }

    this.update_reconnect_name = function (reconnect_name, real_name, ssrc, jnj) {
      var now = Date.now();
      var item = { reconnect_name: reconnect_name, real_name: real_name, ssrc: ssrc, jnj: jnj, tick: now, time_str: (new Date()).toString().replace(/(GMT.*)/, "") };
      var array = _reconnectName.reconnect_name_array = read_reconnect_name();
      var i;
      for(i = 0; i < array.length; i++) {
        if(array[i].reconnect_name == reconnect_name) {
          array.splice(i, 1);
          break;
        }
      }
      array.unshift(item);
      write_reconnect_name();
      $rootScope.$apply();
    }

    this.remove_reconnect_name = function (reconnect_name) {
      var array = _reconnectName.reconnect_name_array = read_reconnect_name();
      var i;
      for(i = 0; i < array.length; i++) {
        if(array[i].reconnect_name == reconnect_name) {
          array.splice(i, 1);
          break;
        }
      }
      write_reconnect_name();
      $rootScope.$apply();
    }

    this.reset_reconnect_name = function () {
      this.reconnect_name_array = [];
      write_reconnect_name();
    }

    this.delete_reconnect_name = function (item) {
      var array = _reconnectName.reconnect_name_array = read_reconnect_name();
      var i;
      for(i = 0; i < array.length; i++) {
        if(array[i].reconnect_name == item.reconnect_name) {
          array.splice(i, 1);
          write_reconnect_name();
          break;
        }
      }
    }
  }
])

;
