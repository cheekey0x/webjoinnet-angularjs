/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('browser', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope', '$sce', 'joinnetHelper', 'hmtgSound',
  function ($translate, appSetting, hmtgHelper, $rootScope, $sce, joinnetHelper, hmtgSound) {
    var _browser = this;
    this.url = this.url2 = '';
    this.relay_url2 = '';
    this.url2_url = ''; // the url when this url2 is set
    this.href = '';
    this.loading_url2 = $sce.trustAsResourceUrl('loading.htm');
    this.container = document.getElementById('browser_container');
    this.history = [];
    this.history_idx = -1;
    this.is_fullscreen = false;
    this.request_fullscreen = this.container.requestFullscreen
      || this.container.msRequestFullscreen
      || this.container.mozRequestFullScreen
      || this.container.webkitRequestFullscreen
    ;
    this.LINK_MODE_GOTO = 1;
    this.LINK_MODE_LINK = 2;
    this.LINK_MODE_BACK = 3;
    this.LINK_MODE_FORWARD = 4;

    this.reset = function () {
      _browser.url = '';
      _browser.url2 = $sce.trustAsResourceUrl('about:blank'); // must use this, empty string ('') not working to reset the cache
      _browser.url2_url = '';
      _browser.is_new_url = true; // a url input from outside

      this.history = [];
      this.history_idx = -1;
      $rootScope.$broadcast(hmtgHelper.WM_BROWSER_URL);
    }

    this.callback_JointBrowsing = function (command_type, url) {
      if($rootScope.is_secure && appSetting.auto_https) {
        var scheme = hmtg.util.schemeURL(url);
        if(!scheme || scheme === 'http') {
          var old = url;
          if(!scheme) url = 'https://' + url;
          else url = 'https://' + url.slice(7);
          hmtgSound.ShowInfoPrompt(function () {
            return $translate.instant('ID_HTTP_TO_HTTPS').replace('#http#', old).replace('#https#', url);
          }, 10, false);
        }
      }
      this.append_history(url);
      this.displayURL(url);
    }

    this.displayURL = function(url) {
      // try to render loading.htm first
      this.url2 = _browser.loading_url2;

      _browser.is_new_url = true; // a url input from outside
      _browser.url2_url = _browser.url = url;
      // relay_url2 is the URL that will be rendered once loading.htm is loaded
      try {
        var scheme = hmtg.util.schemeURL(url);
        if(!scheme) {
          _browser.relay_url2 = $sce.trustAsResourceUrl('http://' + url);
        } else {
          _browser.relay_url2 = $sce.trustAsResourceUrl(url);
        }
      } catch(e) {
        _browser.relay_url2 = '';
      }
      $rootScope.$broadcast(hmtgHelper.WM_BROWSER_URL);
    }

    this.append_history = function (url) {
      // remove existing one
      var i;
      for(i = 0; i < this.history.length; i++) {
        if(this.history[i] == url) {
          this.history.splice(i, 1);
          break;
        }
      }
      this.history.push(url);
      this.history_idx = this.history.length - 1;
    }

    this.turnon_fullscreen = function () {
      if(this.request_fullscreen) {
        this.request_fullscreen.call(this.container);
      }
    }

    this.turnoff_fullscreen = function () {
      hmtgHelper.exitFullScreen(true);
      this.is_fullscreen = false;
      this.is_passive_fullscreen = false;
    }

  }
])

;
