/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('msgr')

.service('missedCall', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope',
  function($translate, appSetting, hmtgHelper, $rootScope) {
    var _missedCall = this;
    this.missed_call_array = read_missed_call();

    function read_missed_call() {
      var array = [];
      try {
        array = typeof hmtg.util.localStorage['hmtg_missed_call_array'] === 'undefined' ? [] : JSON.parse(hmtg.util.localStorage['hmtg_missed_call_array']);
        if(!hmtg.util.isArray(array)) return [];
      } catch(e) {
        return [];
      }
      return array;
    }

    this.checkMissedCall = function() {
      var array = _missedCall.missed_call_array;

      if(array.length == 0) return;

      // relay to the controller
      this.to_check_missed_call = true;
      $rootScope.selectTabMissedCall();
    }

    function write_missed_call() {
      var array = _missedCall.missed_call_array;
      hmtg.util.localStorage['hmtg_missed_call_array'] = JSON.stringify(array);
    }

    this.update_missed_call = function(tid, name) {
      var now = Date.now();
      var item = { tid: tid, name: name, tick: now, time_str: (new Date()).toString().replace(/(GMT.*)/, "") };
      var array = _missedCall.missed_call_array = read_missed_call();
      array.unshift(item);
      if(array.length > 200) {
        array.shift();
      }
      write_missed_call();
      $rootScope.$apply();
    }

    this.remove_missed_call = function(missed_call) {
      var array = _missedCall.missed_call_array = read_missed_call();
      var i;
      for(i = 0; i < array.length; i++) {
        if(array[i].missed_call == missed_call) {
          array.splice(i, 1);
          break;
        }
      }
      write_missed_call();
      $rootScope.$apply();
    }

    this.reset_missed_call = function() {
      this.missed_call_array = [];
      write_missed_call();
    }

    this.delete_missed_call = function(item) {
      var array = _missedCall.missed_call_array = read_missed_call();
      var i;
      for(i = 0; i < array.length; i++) {
        if(array[i].missed_call == item.missed_call) {
          array.splice(i, 1);
          write_missed_call();
          break;
        }
      }
    }
  }
])

;
