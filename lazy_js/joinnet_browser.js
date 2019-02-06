angular.module('joinnet')
.controller('BrowserCtrl', ['$scope', 'hmtgHelper', 'browser', 'joinnetHelper', '$rootScope', 'hmtgAlert', 'hmtgSound',
  '$translate', 'appSetting',
  function($scope, hmtgHelper, browser, joinnetHelper, $rootScope, hmtgAlert, hmtgSound, $translate, appSetting) {
    $scope.w = browser;
    $scope.w.bad_https = false;
    $scope.as = appSetting;
    $scope.iframe = document.getElementById('iframe');
    var container2 = document.getElementById('browser_container2');
    var MAX_HISTORY_ITEM = 30;

    var LS_list = hmtg.util.localStorage['hmtg_joint_browser_history'];
    var list = [];
    if(typeof LS_list == 'string') {
      var a_list = hmtg.util.parseJSON(LS_list);
      if(a_list === 'undefined') a_list = [];
      if(hmtg.util.isArray(a_list)) {
        list = a_list.slice(0, MAX_HISTORY_ITEM);
      }
    }
    var i;
    var descr;
    $scope.history = [];
    if(list.length) {
      for(i = 0; i < list.length; i++) {
        if(typeof list[i] === 'string') {
          $scope.history.push(list[i]);
        }
      }
    }

    $scope.$watch('w.url', function() {
      $scope.w.bad_https = false;
      if($scope.w.url) {
        var h = $scope.w.url.toLowerCase();
        if(h.indexOf('about:') == 0) return;
        if(h.length >= 8) {
          if(h.indexOf('https://') != 0)
            $scope.w.bad_https = true;
        } else {
          if('https://'.indexOf(h) != 0)
            $scope.w.bad_https = true;
        }
      }
    });

    var myheight = 100;
    $scope.style_browser_height = function() {
      var old = myheight;
      if(browser.is_fullscreen) {
        // at chrome, there are about ~5 pixel space left at the bottom. need to adjust for it
        myheight = hmtgHelper.view_port_height - container2.offsetTop - 5;
      } else {
        var offset = {};
        hmtg.util.calcOffset(container2, offset);
        if(offset.y) {
          myheight = Math.max(((hmtgHelper.view_port_height >> 1) + (hmtgHelper.view_port_height >> 3)), hmtgHelper.view_port_height - offset.y - 1);
        }
      }

      // this logic can prevent exception caused by too frequent $digest
      // [$rootScope:infdig]
      if(myheight > old && myheight - old < 5) {
        myheight = old;
      }
      return {
        'height': '' + (myheight) + 'px'
      };
    }

    $scope.iframe.addEventListener('load', function(e) {
      if(browser.relay_url2) {
        browser.url2 = browser.relay_url2;
        $rootScope.$broadcast(hmtgHelper.WM_BROWSER_URL);
        browser.relay_url2 = '';
        return;
      }

      // new_href is a trick to detect cross-origin domain?
      var new_href = '';
      try {
        new_href = $scope.iframe.contentWindow.location.href;
      } catch(e) {
        // when new_href is reset here, it is a cross-origin domain page
        new_href = '';
      }
      browser.href = new_href;
      //hmtg.util.log(-2, '******debug, iframe loaded,src=' + $scope.iframe.src + ',href=' + browser.href);

      if(browser.is_new_url) {
        browser.is_new_url = false; // all following load event indicates a URL from inside an existing page
        // as a new URL from outside input, remember the src as base_src
        browser.base_src = $scope.iframe.src;
        //hmtg.util.log(-2, '******debug, got new url,base=' + browser.base_src + ',href=' + browser.href);
      } else {
        if(!$scope.can_browse() // not eligible to browse
        || ($scope.iframe.src == browser.base_src && !browser.href) // loaded, but base not changed with cross domain site. go back to old url by refreshing
        ) {
          browser.relay_url2 = browser.url2;
          browser.url2 = browser.loading_url2;
          browser.is_new_url = true;  // a url input from outside (reload the old URL)
          $rootScope.$broadcast(hmtgHelper.WM_BROWSER_URL);

          if($scope.can_browse()) {
            hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_IFRAME_FOLLOW_LINK_ERROR') }, 20);
          }
        } else {
          browser.base_src = $scope.iframe.src;
          var url = browser.url = browser.url2_url = browser.href;
          hmtg.jnkernel.jn_command_JointBrowsing(browser.LINK_MODE_LINK, hmtg.util.encodeUtf8(url));
          browser.append_history(url);
          $rootScope.$broadcast(hmtgHelper.WM_BROWSER_URL);
          //hmtg.util.log(-2, '******debug, find and issue new url,base=' + browser.base_src + ',href=' + browser.href);
        }
      }
    }, false);

    $scope.open_url = function() {
      window.open(browser.url2, hmtg.util.app_id + hmtg.jnkernel._jn_iWorkMode() + hmtg.jnkernel._jn_iSessionIndex()).focus();
    }

    $scope.$on(hmtgHelper.WM_MY_TOKEN_STATUS_CHANGED, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_CONTROLLER_STATUS_CHANGED, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_BROWSER_URL, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_FULLSCREEN_CHANGED, function() {
      var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

      var old_status = browser.is_fullscreen;
      browser.is_fullscreen = fullscreenElement == browser.container;
      if(!hmtgHelper.inside_angular) $scope.$digest();

      if(old_status && !browser.is_fullscreen) {
        joinnetHelper.change_fullscreen_mode(0, hmtg.config.TAB_VIEW_BROWSER);
      }
    });

    $scope.$on(hmtgHelper.WM_SYNC_FULLSCREEN, function(event, is_fullscreen, view) {
      if(view != 1) return;
      if($rootScope.nav_item != 'joinnet') return;

      var sync_fullscreen_controller = hmtg.jnkernel._fullscreen_ssrc();
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      if(sync_fullscreen_controller != my_ssrc) {
        if(is_fullscreen) {
          if(!browser.is_fullscreen) {
            browser.turnon_fullscreen();

            if(!browser.is_fullscreen) {
              if(browser.request_fullscreen) {
                browser.prompt_sync_fullscreen_alert_item = joinnetHelper.prompt_sync_fullscreen(function() {
                  if(!browser.is_fullscreen) {
                    browser.turnon_fullscreen();
                    browser.is_passive_fullscreen = true;
                  }
                });
              }
            } else {
              browser.is_passive_fullscreen = true;
            }
          }
        } else {
          if(browser.prompt_sync_fullscreen_alert_item) {
            hmtgAlert.remove_link_item(browser.prompt_sync_fullscreen_alert_item);
            browser.prompt_sync_fullscreen_alert_item = null;
          }
          if(browser.is_fullscreen && browser.is_passive_fullscreen) {
            browser.turnoff_fullscreen();
          }
        }
      }
    });

    $scope.onkeypress = function(event) {
      if(event.keyCode != 13) return;
      if(!$scope.can_browse()) return;
      if(!$scope.w.url) return;
      var url = $scope.w.url;
      if($rootScope.is_secure && appSetting.auto_https) {
        var scheme = hmtg.util.schemeURL(url);
        if(!scheme || scheme === 'http') {
          var old = url;
          if(!scheme) url = 'https://' + url;
          else url = 'https://' + url.slice(7);
          $scope.w.url = url;
          hmtgHelper.inside_angular++;
          hmtgSound.ShowInfoPrompt(function() {
            return $translate.instant('ID_HTTP_TO_HTTPS').replace('#http#', old).replace('#https#', url);
          }, 10, false);
          hmtgHelper.inside_angular--;
        }
      }

      var idx = $scope.history.indexOf($scope.w.url);
      if(idx != -1) {
        $scope.history.splice(idx, 1);
      }
      $scope.history.unshift($scope.w.url);
      if($scope.history.length > MAX_HISTORY_ITEM) {
        $scope.history = $scope.history.slice(0, MAX_HISTORY_ITEM);
      }
      hmtg.util.localStorage['hmtg_joint_browser_history'] = JSON.stringify($scope.history);

      hmtg.jnkernel.jn_command_JointBrowsing(browser.LINK_MODE_GOTO, hmtg.util.encodeUtf8($scope.w.url));
      hmtgHelper.inside_angular++;
      browser.append_history(url);
      browser.displayURL(url);
      hmtgHelper.inside_angular--;
    }

    $scope.can_browse = function() {
      if(!(hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL)) return false;

      var sync_tab_controller = hmtg.jnkernel._tab_ssrc();
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      return sync_tab_controller == my_ssrc;
    }

    $scope.is_meeting_mode = function() {
      return hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL;
    }

    $scope.can_refresh = function() {
      return !!browser.url2_url;
    }

    $scope.home = function() {
      if(!$scope.can_browse()) return;
      $scope.w.url = 'about:blank';
      var url = $scope.w.url;

      var idx = $scope.history.indexOf($scope.w.url);
      if(idx != -1) {
        $scope.history.splice(idx, 1);
      }
      $scope.history.unshift($scope.w.url);
      if($scope.history.length > MAX_HISTORY_ITEM) {
        $scope.history = $scope.history.slice(0, MAX_HISTORY_ITEM);
      }
      hmtg.util.localStorage['hmtg_joint_browser_history'] = JSON.stringify($scope.history);

      hmtg.jnkernel.jn_command_JointBrowsing(browser.LINK_MODE_GOTO, hmtg.util.encodeUtf8($scope.w.url));
      hmtgHelper.inside_angular++;
      browser.append_history(url);
      browser.displayURL(url);
      hmtgHelper.inside_angular--;
    }

    $scope.refresh = function() {
      if(!browser.url2_url) return;
      browser.url = browser.url2_url;
      browser.is_new_url = true;  // a url input from outside
      hmtgHelper.inside_angular++;
      browser.relay_url2 = browser.url2;
      browser.url2 = browser.loading_url2;
      $rootScope.$broadcast(hmtgHelper.WM_BROWSER_URL);
      hmtgHelper.inside_angular--;
    }

    $scope.can_prev = function() {
      return browser.history.length && browser.history_idx > 0;
    }

    $scope.can_next = function() {
      return browser.history.length && browser.history_idx < browser.history.length - 1;
    }

    $scope.prev = function() {
      if(!$scope.can_prev()) return;
      browser.history_idx--;
      if($scope.can_browse())
        hmtg.jnkernel.jn_command_JointBrowsing(browser.LINK_MODE_BACK, hmtg.util.encodeUtf8(browser.history[browser.history_idx]));
      hmtgHelper.inside_angular++;
      browser.displayURL(browser.history[browser.history_idx]);
      hmtgHelper.inside_angular--;
    }

    $scope.next = function() {
      if(!$scope.can_next()) return;
      browser.history_idx++;
      if($scope.can_browse())
        hmtg.jnkernel.jn_command_JointBrowsing(browser.LINK_MODE_FORWARD, hmtg.util.encodeUtf8(browser.history[browser.history_idx]));
      hmtgHelper.inside_angular++;
      browser.displayURL(browser.history[browser.history_idx]);
      hmtgHelper.inside_angular--;
    }

    $scope.fullscreen1 = function() {
      hmtgHelper.inside_angular++;
      browser.turnon_fullscreen();
      browser.is_passive_fullscreen = false;
      joinnetHelper.change_fullscreen_mode(1, hmtg.config.TAB_VIEW_BROWSER);
      hmtgHelper.inside_angular--;
    }

    $scope.fullscreen0 = function() {
      hmtgHelper.inside_angular++;
      browser.turnoff_fullscreen();
      joinnetHelper.change_fullscreen_mode(0, hmtg.config.TAB_VIEW_BROWSER);
      hmtgHelper.inside_angular--;
    }

  }
])
;