/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('hmtgs')

.service('hmtgAlert', ['hmtgHelper', '$rootScope', '$translate', 'appSetting',
  function(hmtgHelper, $rootScope, $translate, appSetting) {
    var _hmtgAlert = this;
    this.download_array = [];
    this.link_array = [];
    this.text_array = [];
    this.hidden_array = [];
    this.status_array = [];
    this.chat_alert_array = [];
    //this.link_array = [{ 'text': 'test link', 'type': 'info', 'click': function () { alert('this is a test') } }];
    //this.text_array = [{ 'text': '<a>awerawe</a>', 'type': 'danger' }];

    this.reg = null;
    this.client_id = null;
    // this.notification = null;

    if(window.Notification) {
      if(Notification.permission !== "granted") {
        Notification.requestPermission();
      }
    }

    // if(0 && navigator['serviceWorker']) {
    //   var sw = navigator.serviceWorker.register('sw.js').then(function(reg) {
    //     hmtg.util.log('service worker registration complete.');
    //     _hmtgAlert.reg = reg;
    //     var c = navigator.serviceWorker.controller;
    //     if(c) {
    //       c.postMessage({ cmd: 'client_id' });
    //     }
    //   }, function() {
    //     hmtg.util.log('service worker registration failed.');
    //   });

    //   navigator.serviceWorker.addEventListener('message', function(e) {
    //     if(e.data.cmd && e.data.cmd == 'client_id') {
    //       _hmtgAlert.client_id = e.data.data;
    //     }
    //     // if(e.data.cmd && e.data.cmd == 'notificationclick') {
    //     // window.focus();
    //     // }
    //   });
    // }

    var hidden;
    if(typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
      hidden = "hidden";
    } else if(typeof document.msHidden !== "undefined") {
      hidden = "msHidden";
    } else if(typeof document.webkitHidden !== "undefined") {
      hidden = "webkitHidden";
    }
    this.show_notification = function(title, text, forced, onclick_callback) {
      if(hmtg.noti) {
        if(hmtg.is_foreground) {
          if(!forced) return;
        }

        var option = {
          icon: 'img/jnagent_72x72.png',
          vibrate: true,
          title: title,
          text: text
        }
        if(!appSetting.vibrate) {
          option.vibrate = false;
        }
        hmtg.noti.schedule(option);
        return;
      }
      if(!window.Notification) return;
      if(!forced && !document[hidden] && document.hasFocus()) return;

      if(Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      } else {
        var option = {
          //actions: [{ action: "test", title: "Action"}],
          tag: hmtg.util.app_id,
          data: { client_id: this.client_id, url: window.location.href },
          icon: 'img/jnagent_72x72.png',
          body: text
        };
        if(appSetting.vibrate) {
          option.vibrate = [200, 100, 200];
        } else {
          option.vibrate = [0];
        }
        // if(0 && this.reg && this.reg.showNotification && this.client_id) {
        //   try {
        //     this.reg.showNotification(title, option);
        //   } catch(e) {
        //   }
        // } else {
          // if(this.notification) {
          //   this.notification.close();
          //   this.notification = null;
          // }
          var n;
          try {
            // this.notification =
            n = new Notification(title, option);
          } catch(e) {
            return;
          }

          n.onclick = function() {
            n.close();
            if(onclick_callback) {
              onclick_callback();
            } else {
              window.focus();
            }
          };
          return n;
        // }
      }
    }
    this.close_notification = function(item) {
      // if(this.reg && this.reg.getNotifications && this.client_id) {
      //   try {
      //     this.reg.getNotifications().then(function(list) {
      //       var i;
      //       for(i = 0; i < list.length; i++) {
      //         if(list[i].data && list[i].data.client_id && list[i].data.client_id == _hmtgAlert.client_id) {
      //           list[i].close();
      //         }
      //       }
      //     });
      //   } catch(e) {
      //   }
      // }
      if(item && item['notification']) {
        item['notification'].close();
        item['notification'] = null;
      }
      // if(this.notification) {
      //   this.notification.close();
      //   this.notification = null;
      // }
      // if(hmtg.noti) {
      //   hmtg.noti.clearAll();
      //   hmtg.noti.cancelAll();
      // }
    }

    this.need_ring = function() {
      var i;
      for(i = 0; i < this.status_array.length; i++) {
        if(this.status_array[i].need_ring) return true;
      }
      for(i = 0; i < this.link_array.length; i++) {
        if(this.link_array[i].need_ring) return true;
      }
      return false;
    }

    this.add_blob_download_item = function(blob, name) {
      var item = {};

      // should release the created url when the url is not being used any more
      var url = window.URL.createObjectURL(blob);
      item['url'] = url;
      item['name'] = name;
      var img = new Image;
      function img_onload() {
        item['is_image'] = true;
        _hmtgAlert.add_download_item(item);
      }
      function img_onerror() {
        item['is_image'] = false;
        _hmtgAlert.add_download_item(item);
      }
      img.addEventListener("load", img_onload, false);
      img.addEventListener("error", img_onerror, false);
      img.src = url;
    }

    this.add_download_item = function(item) {
      this.download_array.push(item);
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
      if(!appSetting.ignore_message_during_full_screen) {
        hmtgHelper.exitFullScreen();
      }
    }

    this.add_link_item = function(item) {
      item.timeout_id = setTimeout(remove_item, item.timeout * 1000);
      item.timeout_func = remove_item;
      this.link_array.push(item);
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
      if(!appSetting.ignore_message_during_full_screen) {
        hmtgHelper.exitFullScreen();
      }
      function remove_item() {
        if(item.timeout_action) {
          item.timeout_action();
        }
        var idx = _hmtgAlert.link_array.indexOf(item);
        if(idx != -1) {
          _hmtgAlert.link_array.splice(idx, 1);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
        }
      }
    }

    this.remove_link_item = function(item) {
      var idx = this.link_array.indexOf(item);
      if(idx == -1) return;
      clearTimeout(item.timeout_id);
      _hmtgAlert.link_array.splice(idx, 1);
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
    }

    this.click_link = function(index) {
      clearTimeout(_hmtgAlert.link_array[index].timeout_id);
      _hmtgAlert.link_array.splice(index, 1);
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
    }

    this.click_item_link = function(item) {
      clearTimeout(item.timeout_id);
      var index = _hmtgAlert.link_array.indexOf(item);
      if(index != -1) {
        _hmtgAlert.link_array.splice(index, 1);
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
      }
    }

    this.remove_im_alert = function(target) {
      // search link array
      // try to find an exisitng alert
      var j;
      var item;
      for(j = 0; j < _hmtgAlert.link_array.length; j++) {
        item = _hmtgAlert.link_array[j];
        if(item['im_alert_target'] == target) {
          hmtgHelper.inside_angular++;
          clearTimeout(item.timeout_id);
          _hmtgAlert.link_array.splice(j, 1);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
          hmtgHelper.inside_angular--;
          break;
        }
      }
    }

    this.add_text_item = function(item) {
      item.timeout_id = setTimeout(remove_item, item.timeout * 1000);
      this.text_array.push(item);
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
      if(!appSetting.ignore_message_during_full_screen) {
        hmtgHelper.exitFullScreen();
      }
      function remove_item() {
        if(item.timeout_action) {
          item.timeout_action();
        }
        var idx = _hmtgAlert.text_array.indexOf(item);
        if(idx != -1) {
          _hmtgAlert.text_array.splice(idx, 1);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
        }
      }
    }

    this.remove_text_item = function(item) {
      var idx = this.text_array.indexOf(item);
      if(idx == -1) return;
      clearTimeout(item.timeout_id);
      _hmtgAlert.text_array.splice(idx, 1);
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
    }

    // this is solely used by iOS to show early popup alerts
    this.add_hidden_item = function(item) {
      item.timeout_id = setTimeout(remove_item, 1000);
      this.hidden_array.push(item);
      function remove_item() {
        var idx = _hmtgAlert.hidden_array.indexOf(item);
        if(idx != -1) {
          _hmtgAlert.hidden_array.splice(idx, 1);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
        }
      }
    }

    this.update_status_item = function(item) {
      for(var i = 0; i < this.status_array.length; i++) {
        clearTimeout(this.status_array[i].timeout_id);
      }
      this.status_array = [];
      if(item.text) {
        item.timeout_id = setTimeout(remove_item, item.timeout * 1000);
        this.status_array.push(item);
      }
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
      function remove_item() {
        var idx = _hmtgAlert.status_array.indexOf(item);
        if(idx != -1) {
          _hmtgAlert.status_array.splice(idx, 1);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
        }
      }
    }

    this.update_chat_alert_item = function(item) {
      for(var i = 0; i < this.chat_alert_array.length; i++) {
        clearTimeout(this.chat_alert_array[i].timeout_id);
      }
      this.chat_alert_array = [];
      item.timeout_id = setTimeout(remove_item, item.timeout * 1000);
      this.chat_alert_array.push(item);
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
      if(!appSetting.ignore_message_during_full_screen) {
        hmtgHelper.exitFullScreen();
      }
      function remove_item() {
        var idx = _hmtgAlert.chat_alert_array.indexOf(item);
        if(idx != -1) {
          _hmtgAlert.chat_alert_array.splice(idx, 1);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
        }
      }
    }
    this.clear_chat_alert_item = function() {
      for(var i = 0; i < this.chat_alert_array.length; i++) {
        clearTimeout(this.chat_alert_array[i].timeout_id);
      }
      this.chat_alert_array = [];
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
    }

    this.prompt_http = function(jnj) {
      /*
      // if this is not a jnj/meeting connection failture and there is an ongoing meeting
      // do not try to switch to http
      if(!jnj && (hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting())) return;

      if($rootScope.is_secure) {
        var item = {};
        item['timeout'] = 60;
        item['update'] = function() { return $translate.instant('ID_SWITCH_HTTP_PROMPT') };
        item['text'] = item['update']();
        item['type'] = 'info';
        item['click'] = function(index) {
          if(jnj) {
            var alt = 'http://' + window.location.host + window.location.pathname + '?jnj=' + hmtg.util.encode64_url(jnj);
            window.open(alt, hmtg.util.app_id).focus();
          } else {
            window.open($rootScope.alt_url, hmtg.util.app_id).focus();
          }
          hmtgHelper.inside_angular++;
          _hmtgAlert.click_link(index);
          hmtgHelper.inside_angular--;
        };

        _hmtgAlert.add_link_item(item);
      }
      */
    }
  }
])

.controller('AlertCtrl', ['$scope', 'hmtgAlert', 'hmtgHelper', '$rootScope',
  function($scope, hmtgAlert, hmtgHelper, $rootScope) {
    $scope.get_download_array = function() {
      return hmtgAlert.download_array;
    }
    $scope.get_link_array = function() {
      return hmtgAlert.link_array;
    }
    $scope.get_chat_alert_array = function() {
      return hmtgAlert.chat_alert_array;
    }
    $scope.get_text_array = function() {
      return hmtgAlert.text_array;
    }
    $scope.get_hidden_array = function() {
      return hmtgAlert.hidden_array;
    }
    $scope.get_status_array = function() {
      return hmtgAlert.status_array;
    }

    $scope.close_download = function(index) {
      window.URL.revokeObjectURL(hmtgAlert.download_array[index].url);  // release the url
      hmtgAlert.download_array.splice(index, 1);
    }

    $scope.close_link = function(index) {
      if(hmtgAlert.link_array[index].cancel) {
        hmtgAlert.link_array[index].cancel();
      }
      clearTimeout(hmtgAlert.link_array[index].timeout_id);
      hmtgAlert.link_array.splice(index, 1);
    }

    $scope.close_chat_alert = function(index) {
      if(hmtgAlert.chat_alert_array[index].cancel) {
        hmtgAlert.chat_alert_array[index].cancel();
      }
      clearTimeout(hmtgAlert.chat_alert_array[index].timeout_id);
      hmtgAlert.chat_alert_array.splice(index, 1);
    }

    $scope.close_text = function(index) {
      if(hmtgAlert.text_array[index].cancel) {
        hmtgAlert.text_array[index].cancel();
      }
      clearTimeout(hmtgAlert.text_array[index].timeout_id);
      hmtgAlert.text_array.splice(index, 1);
    }

    $scope.close_status = function(index) {
      clearTimeout(hmtgAlert.status_array[index].timeout_id);
      hmtgAlert.status_array.splice(index, 1);
    }

    $scope.$on(hmtgHelper.WM_UPDATE_ALERT, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $rootScope.$on('$translateChangeEnd', function() {
      var i;
      var a = hmtgAlert.link_array;
      for(i = 0; i < a.length; i++) {
        if(a[i].update) {
          a[i].text = a[i].update();
        }
      }
      var a = hmtgAlert.text_array;
      for(i = 0; i < a.length; i++) {
        if(a[i].update) {
          a[i].text = a[i].update();
        }
      }
      var a = hmtgAlert.status_array;
      for(i = 0; i < a.length; i++) {
        if(a[i].update) {
          a[i].text = a[i].update();
        }
      }

    });

  }
])

;
