/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('hmtgs', ['pascalprecht.translate', 'ui.bootstrap', 'oc.lazyLoad', 'joinnet', 'msgr'])

.service('appVersion', [
  function () {
    this.major = 0;
    this.minor = 9;
    this.full = hmtg.config.APP_VERSION;
  }
])

.factory('$exceptionHandler', function () {
  return function (exception, cause) {
    if(window.g_exempted_error) return;
    console.error(exception.stack);
    setTimeout(function () {
      throw exception;
    }, 0);
  };
})

.config(['$compileProvider',
  function ($compileProvider) {
    var imgSrcList = $compileProvider.imgSrcSanitizationWhitelist();
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|file|blob):|data:image\//);
    var aHrefList = $compileProvider.aHrefSanitizationWhitelist();
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|data|blob):/);
  }
])

.config(['$translateProvider',
  function ($translateProvider) {
    $translateProvider.useStaticFilesLoader({
      prefix: 'lang/translation-',
      suffix: '.json'
    });
    var list = ['en', 'zh_CN', 'zh_TW', 'ja', 'ko'];
    var list_lowercase = ['en', 'zh_cn', 'zh_tw', 'ja', 'ko'];
    if(typeof hmtg.util.localStorage['hmtg_lang'] !== 'string') {
      $translateProvider.registerAvailableLanguageKeys(list);
      $translateProvider.determinePreferredLanguage();  // need a hack in $translate module
    } else {
      var lang = hmtg.util.localStorage['hmtg_lang'];
      var idx = list_lowercase.indexOf(lang.toLowerCase());
      if(idx == -1) $translateProvider.preferredLanguage(list[0]);
      else $translateProvider.preferredLanguage(list[idx]);
    }
    $translateProvider.fallbackLanguage('en');
  }
])

.config(['$ocLazyLoadProvider',
  function ($ocLazyLoadProvider) {
    $ocLazyLoadProvider.config({});
  }
])

.run(['$log', 'jnjContent', 'appVersion', 'JoinNet', '$rootScope', 'hmtgAlert', 'Msgr', 'hmtgHelper', '$translate',
  'hmtgSound', 'appSetting', 'reconnectName', '$ocLazyLoad', '$http', 'imContainer', 'imDlg', 'jnagentDlg',
  'missedCall', 'mediasoupWebRTC', '$modal',
  function($log, jnjContent, appVersion, JoinNet, $rootScope, hmtgAlert, Msgr, hmtgHelper, $translate, hmtgSound,
    appSetting, reconnectName, $ocLazyLoad, $http, imContainer, imDlg, jnagentDlg, missedCall, mediasoupWebRTC,
    $modal) {
    hmtg.util.log("sound support:" + (hmtgSound.can_mp3 ? ' mp3' : '') + (hmtgSound.can_ogg ? ' ogg' : '') + (hmtgSound.can_wav ? ' wav' : ''));
    if(hmtgSound.ac)
      hmtg.util.log("HTML5 Audio support: " + hmtgSound.typeAudioContext + ", sampleRate=" + hmtgSound.ac.sampleRate);
    else
      hmtg.util.log("HTML5 Audio support: " + hmtgSound.typeAudioContext);
    hmtg.util.log("HTML5 URL support: " + hmtgSound.typeURL);
    hmtg.util.log("HTML5 getUserMedia support: " + hmtgSound.typeGUM);
    if(window.location.href) hmtg.util.log("webapp href: " + window.location.href);

    hmtgHelper.view_port_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    hmtgHelper.view_port_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    hmtg.util.log("(at launch)view port size: " + hmtgHelper.view_port_width + "x" + hmtgHelper.view_port_height);

    document.title = $translate.instant('IDS_APP_NAME');

    // customization
    $rootScope.hmtg_show_msgr = !!hmtg.customization.show_msgr;
    $rootScope.hmtg_show_open_jnj = !!hmtg.customization.show_open_jnj && appSetting.show_advanced_function;
    $rootScope.hmtg_show_user_guide = !!hmtg.customization.show_user_guide;

    $rootScope.is_secure = window.location.protocol == 'https:';
    $rootScope.alt_url = ($rootScope.is_secure ? 'http://' : 'https://') + window.location.host + window.location.pathname + window.location.search;
    /*
    if($rootScope.is_secure) {
    // just to trigger a normal websocket connection request, so that the shield icon appear at address bar
    var myws;
    try {
    myws = new WebSocket('ws://' + window.location.host);
    myws.onopen = function () { myws.close(); }
    } catch(e) {
    }
    }
    */

    $rootScope.turnOnAudio = function() {
      hmtgSound.turnOnAudio();
    }

    $rootScope.has_msg = function() {
      return imDlg.has_msg();
    }

    $rootScope.has_missed_call = function() {
      return !!missedCall.missed_call_array.length;
    }

    $rootScope.$on('$includeContentError', function(e, param) {
      if(param == 'lazy_htm/navitem_reconnect_name.htm' + hmtgHelper.cache_param) $rootScope.partialReconnectName = '';
      else if(param == 'lazy_htm/navitem_missed_call.htm' + hmtgHelper.cache_param) $rootScope.partialMissedCall = '';
      else if(param == 'lazy_htm/navitem_log.htm' + hmtgHelper.cache_param) $rootScope.partialLog = '';
      else if(param == 'lazy_htm/navitem_jnj.htm' + hmtgHelper.cache_param) $rootScope.partialJnj = '';
      else if(param == 'lazy_htm/navitem_prompt.htm' + hmtgHelper.cache_param) $rootScope.partialPrompt = '';
    });

    $rootScope.selectTabReconnectName = function() {
      $rootScope.selectTabJnj();  // reconnect name require jnj tab, for the "open jnj" button
      if($rootScope.partialReconnectName) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/navitem_reconnect_name' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $rootScope.partialReconnectName = 'lazy_htm/navitem_reconnect_name.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading navitem_reconnect_name fails');
      });
    }

    $rootScope.selectTabMissedCall = function() {
      if($rootScope.partialMissedCall) return;

      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/navitem_missed_call' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $rootScope.partialMissedCall = 'lazy_htm/navitem_missed_call.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading navitem_missed_call fails');
      });
    }

    $rootScope.selectTabLog = function() {
      if($rootScope.partialLog) return;

      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/navitem_log' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $rootScope.partialLog = 'lazy_htm/navitem_log.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading navitem_log fails');
      });
    }

    $rootScope.selectTabJnj = function() {
      if($rootScope.partialJnj) return;

      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/navitem_jnj' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $rootScope.partialJnj = 'lazy_htm/navitem_jnj.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading navitem_jnj fails');
      });
    }

    $rootScope.show_snapshot = appSetting.show_snapshot;

    function update_title_text() {
      document.title = $translate.instant('IDS_APP_NAME');
      $rootScope.snapshot_title = $translate.instant('ID_SNAPSHOT') + (appSetting.snapshot_delay ? '(' : '') + (appSetting.snapshot_delay ? appSetting.snapshot_delay : '') + (appSetting.snapshot_delay ? ')' : '') + '...';
      var elem;
      elem = document.getElementById("error_button1");
      if(elem) elem.textContent = $translate.instant('ID_SHOW_ERROR_REPORT');
      elem = document.getElementById("error_button2");
      if(elem) elem.textContent = $translate.instant('ID_HIDE_ERROR_REPORT');
      elem = document.getElementById("log_button1");
      if(elem) elem.textContent = $translate.instant('ID_SHOW_LOG');
      elem = document.getElementById("log_button2");
      if(elem) elem.textContent = $translate.instant('ID_HIDE_LOG');
    }
    update_title_text();
    $rootScope.$on('$translateChangeEnd', update_title_text);
    $rootScope.snapshot = function() {
      if($rootScope.snapshot_busy) {
        if($rootScope.snapshot_intervalID) {
          clearInterval($rootScope.snapshot_intervalID);
          $rootScope.snapshot_intervalID = null;
          $rootScope.snapshot_busy = false;
          $rootScope.snapshot_title = $translate.instant('ID_SNAPSHOT') + (appSetting.snapshot_delay ? '(' : '') + (appSetting.snapshot_delay ? appSetting.snapshot_delay : '') + (appSetting.snapshot_delay ? ')' : '') + '...';
        }
        return;
      }

      $ocLazyLoad.load('lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/_html2canvas' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param).then(function() {
        $rootScope.snapshot_busy = true;
        $rootScope.snapshot_delay_count = appSetting.snapshot_delay;
        if(appSetting.snapshot_delay) {
          $rootScope.snapshot_intervalID = setInterval(function() {
            $rootScope.snapshot_delay_count--;
            if($rootScope.snapshot_delay_count <= 0) {
              clearInterval($rootScope.snapshot_intervalID);
              $rootScope.snapshot_intervalID = null;
              html2canvas(document.body, { onrendered: hmtgHelper.process_snapshot });
              $rootScope.snapshot_title = $translate.instant('ID_SNAPSHOT') + (appSetting.snapshot_delay ? '(' : '') + (appSetting.snapshot_delay ? appSetting.snapshot_delay : '') + (appSetting.snapshot_delay ? ')' : '') + '...';
            } else {
              $rootScope.snapshot_title = $translate.instant('ID_SNAPSHOT') + ($rootScope.snapshot_delay_count ? '(' : '') + ($rootScope.snapshot_delay_count ? $rootScope.snapshot_delay_count : '') + ($rootScope.snapshot_delay_count ? ')' : '') + '...';
            }
            $rootScope.$apply();
          }, 1000);
        } else {
          html2canvas(document.body, { onrendered: hmtgHelper.process_snapshot });
        }
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading _html2canvas fails');
      });
    }

    $rootScope.scroll_to_top = function(id) {
      hmtg.util.scroll_to_top(id);
    }
    $rootScope.scroll_to_bottom = function(id) {
      hmtg.util.scroll_to_bottom(id);
    }

    window.addEventListener("dragover", function(e) {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
    }, false);
    window.addEventListener("drop", function(e) {
      e.stopPropagation();
      e.preventDefault();
    }, false);

    /*
    var mousemove_listener = function () {
    Msgr.g_last_activity_time = hmtg.util.GetTickCount();
    };
    var mousedown_listener = function () {
    Msgr.g_last_activity_time = hmtg.util.GetTickCount();
    };
    var touchstart_listener = function () {
    Msgr.g_last_activity_time = hmtg.util.GetTickCount();
    };
    var keydown_listener = function () {
    Msgr.g_last_activity_time = hmtg.util.GetTickCount();
    };
    document.addEventListener('mousemove', mousemove_listener, false);
    document.addEventListener('mousedown', mousedown_listener, false);
    document.addEventListener('touchstart', touchstart_listener, false);
    document.addEventListener('keydown', keydown_listener, false);
    */
    
    document.addEventListener('mousedown', function() { 
      hmtgSound.turnOnAudio();
    }, false);
    
    window.onbeforeunload = function(e) {
      // this trick can stop the noise when the user try to close the tab
      // the javascript is effectively stopped during the prompt
      if(hmtgSound.playback_gain_node) {
        var old = hmtgSound.playback_gain_node.gain.value;
        hmtgSound.playback_gain_node.gain.value = 0.0;
        setTimeout(function() {
          hmtgSound.playback_gain_node.gain.value = old;
        }, 0);
      }

      hmtg.jmkernel.jm_command_SpeedupClientInfo();

      if(hmtg.jnkernel._jn_bConnecting() || hmtg.jnkernel._jn_bConnected()) {
        return $translate.instant('ID_JOINNET_ACTIVE_SESSION');
      } else if(imDlg.CheckIMConversationWindow()) {
        return $translate.instant('ID_MSGR_CONVERSATION');
      } else if(jnagentDlg.CheckConnection()) {
        return $translate.instant('ID_MSGR_SESSION');
      } else if(jnjContent.valid_jnj) {
        return $translate.instant('ID_JOINNET_IDLE_SESSION');
      }
    }

    var timerID = null;
    var timerIDH = null;
    var timerIDW = null;
    window.addEventListener('resize', function() {
      var old = hmtgHelper.view_port_height;
      hmtgHelper.view_port_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
      if(old != hmtgHelper.view_port_height) {
        if(!timerIDH) {
          timerIDH = setTimeout(function() {
            timerIDH = null;
            $rootScope.$broadcast(hmtgHelper.WM_HEIGHT_CHANGED);
          }, 0);
        }
      }
      old = hmtgHelper.view_port_width;
      hmtgHelper.view_port_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      if(old != hmtgHelper.view_port_width) {
        if(!timerIDW) {
          timerIDW = setTimeout(function() {
            timerIDW = null;
            $rootScope.$broadcast(hmtgHelper.WM_WIDTH_CHANGED);
          }, 0);
        }
      }
      if(timerID) {
        clearTimeout(timerID);
      }
      timerID = setTimeout(function() {
        timerID = null;
        hmtg.util.log(6, "(resize)view port size: " + hmtgHelper.view_port_width + "x" + hmtgHelper.view_port_height);
      }, 10000);
    }, true);

    document.addEventListener('webkitfullscreenchange', onFullScreenChange, true);
    document.addEventListener('mozfullscreenchange', onFullScreenChange, true);
    document.addEventListener('fullscreenchange', onFullScreenChange, true);
    document.addEventListener('MSFullscreenChange', onFullScreenChange, true);

    function onFullScreenChange() {
      $rootScope.$broadcast(hmtgHelper.WM_FULLSCREEN_CHANGED);
    }

    var log_level = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_log_level']);
    if(log_level === 'undefined') log_level = hmtg.config.DEFAULT_LOG_LEVEL;
    if(log_level < 0) log_level = 0;
    hmtg.util.log("log level is set to " + log_level);

    hmtgHelper.inside_angular++;
    hmtg.jmkernel.jm_command_ReadWBL();

    // init for the tab set
    $rootScope.tabs = [
      { active: false },  // 0, Messenger
      { active: false },  // 1, Web App
      { active: false },  // 2, JoinNet
      { active: false },  // 3, My Picture
      { active: false },  // 4, Reset All
      { active: false },  // 5, Native App
      { active: false },  // 6, Demo
      { active: false },  // 7, Test
      { active: false },  // 8, My URL
      { active: false },   // 9, HTML5 Score
      { active: false }   // 10, WebRTC
    ]
    $rootScope.show_reconnect_name = function() {
      return reconnectName.reconnect_name_array && reconnectName.reconnect_name_array.length && appSetting.show_advanced_function;
    }
    $rootScope.show_missed_call = function() {
      return missedCall.missed_call_array && missedCall.missed_call_array.length;
    }

    mediasoupWebRTC.no_stun = hmtg.util.getQuery('no_stun');
    mediasoupWebRTC.no_turn = hmtg.util.getQuery('no_turn');
    mediasoupWebRTC.no_tcp = hmtg.util.getQuery('no_tcp');
    mediasoupWebRTC.no_udp = hmtg.util.getQuery('no_udp');
    if(mediasoupWebRTC.no_stun) {
      mediasoupWebRTC.default_turn_server_array = [];
    }

    var debug_mark_delay = hmtg.util.getQuery('debug_mark_delay');
    if(typeof debug_mark_delay !== 'undefined') {
      hmtg.util['debug_mark_delay'] = Math.max(0, (Math.min(20, debug_mark_delay)));
    }

    var jnj = hmtg.util.getQuery('jnj');
    var jlk;
    var jlk0 = hmtg.util.getQuery('jlk');
    if(typeof jlk0 !== 'undefined')
      try {
        jlk = decodeURIComponent(jlk0);
      } catch(e) {
      }
    $rootScope.has_jnj = true;
    if(typeof jnj === 'undefined' && typeof jlk === 'undefined') {
      $rootScope.has_jnj = false;
      hmtg.jmkernel.jm_command_ConnectAllOffice(hmtg.customization.show_msgr ? true : false);
      if(hmtg.customization.show_msgr) {
        $rootScope.nav_item = 'msgr';
        $rootScope.tabs[0].active = true;

        // if the initial page is msgr and there is no office yet
        // prompt the user to add office
        if(!hmtg.jmkernel.jm_info_GetOfficeCount()) {
          var item = {};
          item['timeout'] = 20;
          item['update'] = function() {
            return $translate.instant('ID_NO_OFFICE_PROMPT');
          };
          item['text'] = item['update']();
          item['type'] = 'info';
          item['click'] = function(index) {
            hmtgHelper.inside_angular++;
            hmtgAlert.click_link(index);
            jnagentDlg.SigninDlg($rootScope, $modal);
            hmtgHelper.inside_angular--;
          };

          hmtgAlert.add_link_item(item);
        }
      } else if(hmtg.customization.show_open_jnj) {
        $rootScope.nav_item = 'jnj';
        $rootScope.tabs[1].active = true;
        $rootScope.selectTabJnj();
      } else {
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;
      }
      if(appSetting.show_advanced_function) {
        reconnectName.checkPermit();
      }  
      missedCall.checkMissedCall();
      hmtg.util.log("jnj not found from the url");
    } else {
      if(typeof jlk !== 'undefined') {
        //http://192.168.10.2:2334/weboffice2_a.jnj
        //http%3A%2F%2F192.168.10.2%3A2334%2Fweboffice2_a.jnj%3Fa%3D1%26b%3D2
        $http.get(jlk)
        .success(function (data, status) {
          hmtg.util.log("jnj link from the url: " + jlk);
          var value = hmtg.util.encodeUtf8(data);
          if(test_playback(value)) return;
          hmtgHelper.inside_angular++;
          if(!JoinNet.connect(value)) {
            hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_JNJ') }, 20);
          }
          hmtgHelper.inside_angular--;
        })
        .error(function (data, status) {
          hmtgHelper.inside_angular++;
          hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_JNJ_LINK').replace('#link#', jlk) }, 20);
          hmtgHelper.inside_angular--;
        });
      } else {
        //hmtg.util.log("jnj from the url: " + jnj);
        var value = hmtg.util.decode64_url(jnj);
        if(test_playback(value)) return;
        if(!JoinNet.connect(value)) {
          hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_JNJ') }, 20);
        }
      }
      hmtg.jmkernel.jm_command_ConnectAllOffice(false);
      $rootScope.nav_item = 'joinnet';
      $rootScope.tabs[2].active = true;
    }

    function test_playback(value) {
      /*
      if($rootScope.is_secure && JoinNet.test_playback_jnj_or_usingIP(value)) {
        hmtg.util.log("switch to http site for playback jnj or jnj using numerical IP address as ip...");
        window.onbeforeunload = null;
        location.replace($rootScope.alt_url);
        return true;
      }
      */
    }

    //if($rootScope.has_jnj && !$rootScope.is_secure) {
      //$rootScope.hmtg_show_msgr = false;
      //$rootScope.hmtg_show_open_jnj = false;
    //}

    if(!window.cache_detection_string) {
      $ocLazyLoad.load('cache_detection.js?p=' + hmtg.util.app_id).then(function () {
        hmtgHelper.inside_angular++;
        if(window.cache_detection_string && window.cache_detection_string != hmtg.config.APP_VERSION) {
          hmtg.util.log('Could be using cache "' + hmtg.config.APP_VERSION + '", prompt to update to "' + window.cache_detection_string + '".');
          var item = {};
          item['timeout'] = 3600 * 24 * 10;
          item['update'] = function () {
            return $translate.instant('ID_WEB_CACHE_WARNING')
            .replace('#old#', hmtg.config.APP_VERSION)
            .replace('#new#', window.cache_detection_string);
          };
          item['text'] = item['update']();
          item['type'] = 'danger';
          item['click'] = function (index) {
            hmtgHelper.inside_angular++;
            hmtgAlert.click_link(index);
            location.reload(true);
            hmtgHelper.inside_angular--;
          };

          hmtgAlert.add_link_item(item);
        }
        hmtgHelper.inside_angular--;
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading cache_detection fails');
      });
    }

    hmtgHelper.inside_angular--;
  }
])

.service('appSetting', ['$rootScope', 'hmtgHelper',
  function ($rootScope, hmtgHelper) {
    this.switch_to_download = function () {
      $rootScope.nav_item = 'setting';
      $rootScope.tabs[7].active = true;
    }

    var i = document.createElement("input");
    i.setAttribute("type", "color");
    this.has_type_color = i.type !== "text";

    if(hmtg.util.test_error & 2) {
      JSON.parse('undefined');  // trigger an error at logo
    }

    var parsed;
    // msgr
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_max_win']);
    var width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    this.max_win = parsed === 'undefined' ? Math.min(12, Math.max(2, ((width / 360) >> 0))) : Math.min(12, Math.max(1, parsed));
    if(this.max_win == 5) this.max_win = 4;
    else if(this.max_win > 6 && this.max_win < 12) this.max_win = 6;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_alert_online']);
    this.alert_online = parsed === 'undefined' ? hmtg.config.DEFAULT_ALERT_ONLINE : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_alert_newmessage']);
    this.alert_newmessage = parsed === 'undefined' ? hmtg.config.DEFAULT_ALERT_NEWMESSAGE : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_play_sound']);
    this.play_sound = parsed === 'undefined' ? hmtg.config.DEFAULT_PLAY_SOUND : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_vibrate']);
    this.vibrate = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_show_other_user']);
    this.show_other_user = parsed === 'undefined' ? hmtg.config.DEFAULT_SHOW_OTHER_USER : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_show_offline_user']);
    this.show_offline_user = parsed === 'undefined' ? hmtg.config.DEFAULT_SHOW_OFFLINE_USER : !!parsed;

    // web app
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_max_display_item']);
    this.max_display_item = parsed === 'undefined' ? (hmtgHelper.isMobile ? 50 : 200) : Math.min(10000, Math.max(0, parsed));
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_snapshot_delay']);
    this.snapshot_delay = parsed === 'undefined' ? 0 : Math.min(10, Math.max(0, parsed));
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_show_snapshot']);
    this.show_snapshot = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_show_text']);
    this.show_text = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_is_enter_for_newline']);
    this.is_enter_for_newline = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_no_tip']);
    this.no_tip = parsed === 'undefined' ? (hmtgHelper.isMobile ? true : false) : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_use_native']);
    this.use_native = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_max_blob']);
    this.max_blob = parsed === 'undefined' ? (hmtgHelper.isMobile ? 100 : 500) : Math.min(4000, Math.max(10, parsed));
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_max_zip_size']);
    this.max_zip_size = parsed === 'undefined' ? 100 : Math.min(4000, Math.max(2, parsed));
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_auto_https']);
    this.auto_https = parsed === 'undefined' ? true : !!parsed;

    // joinnet
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_show_advanced_function']);
    this.show_advanced_function = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_meeting_capture_video']);
    this.meeting_capture_video = parsed === 'undefined' ? (hmtg.customization.capture_video_by_default ? true : false) : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_meeting_capture_audio']);
    this.meeting_capture_audio = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_meetintg_idle_mode']);
    this.meetintg_idle_mode = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_auto_download_all']);
    this.auto_download_all = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_wait_key_frame']);
    this.wait_key_frame = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_use_max_video_bitrate']);
    this.use_max_video_bitrate = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_max_video_bitrate']);
    this.max_video_bitrate = parsed === 'undefined' ? 1000 : parsed;
    this.max_video_bitrate = Math.min(1000, Math.max(10, this.max_video_bitrate));
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_use_max_appdata_bitrate']);
    this.use_max_appdata_bitrate = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_max_appdata_bitrate']);
    this.max_appdata_bitrate = parsed === 'undefined' ? 2000 : parsed;
    this.max_appdata_bitrate = Math.min(2000, Math.max(20, this.max_appdata_bitrate));
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_auto_send_video']);
    this.auto_send_video = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_auto_recv_video']);
    this.auto_recv_video = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_prefer_questioner']);
    this.prefer_questioner = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_auto_follow_tab']);
    this.auto_follow_tab = parsed === 'undefined' ? true : !!parsed;
    this.auto_reject_visitor = false;
    this.auto_allow_visitor = false;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_auto_try_webrtc']);
    this.auto_try_webrtc = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_auto_allow_question']);
    this.auto_allow_question = parsed === 'undefined' ? true : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_show_control_panel_textchat']);
    this.show_control_panel_textchat = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_restrict_audio_decoding']);
    this.restrict_audio_decoding = parsed === 'undefined' ? (hmtgHelper.isMobile ? true : false) : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_max_audio_decoding']);
    this.max_audio_decoding = parsed === 'undefined' ? (hmtgHelper.isMobile ? (hmtgHelper.isiOS ? 2 : 6) : 17) : parsed;
    this.max_audio_decoding = Math.min(17, Math.max(0, this.max_audio_decoding));
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_video_fps']);
    var fps = parsed === 'undefined' ? -1 : parsed;
    if(fps != 1 && fps != 2 && fps != 5 && fps != 10 && fps != 25 && !(fps <= 0 && fps >= -5)) fps = -1;
    this.video_fps = fps;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_show_private_note']);
    this.show_private_note = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_remote_monitor_mode']);
    this.remote_monitor_mode = parsed === 'undefined' ? false : !!parsed;
    if(!hmtg.customization.support_monitor_mode) this.remote_monitor_mode = false;
    //parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_fit_mode']);
    //this.fit_mode = parsed === 'undefined' ? 1 : parsed;
    //this.fit_mode = 1;
    //parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_text_mark_as_image']);
    //this.text_mark_as_image = parsed === 'undefined' ? true : !!parsed;
    this.text_mark_as_image = true;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_is_bold_text']);
    this.is_bold_text = parsed === 'undefined' ? false : !!parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_is_italic_text']);
    this.is_italic_text = parsed === 'undefined' ? false : !!parsed;
    this.font_list = hmtg.customization.font_list;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_text_font']);
    this.text_font = parsed === 'undefined' ? '' : parsed;
    if(!this.text_font || this.font_list.indexOf(this.text_font) == -1) {
      this.text_font = this.font_list[0];
    }
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_webrtc_bandwidth_profile']);
    this.webrtc_bandwidth_profile = parsed === 'undefined' ? (hmtgHelper.isMobile ? 'low' : 'high') : parsed;
  }
])

.service('jnjSource', [
  function () {
    var jnj = '';

    this.save = function (value) {
      jnj = value;
    }

    this.get = function () {
      return jnj;
    }
  }
])

.service('jnjContent', [
  function () {
    this.valid_jnj = false;
    this.jnj = '';

    this.parseJnj = function (value) {
      this.jnj = value;
      this.valid_jnj = false;
      this.entries = convert_entry(value);
      this.valid_jnj = check_entry(this.entries);
    }

    this.validateJnj = function (value) {
      return check_entry(convert_entry(value));
    }

    this.convertJnj = function (value) {
      return convert_entry(value);
    }

    function convert_entry(value) {
      var entries = {};
      var lines = value.split('\n');
      for(var i = 0; i < lines.length; i++) {
        var idx = lines[i].search('=');
        if(idx == -1)
          continue;
        var name = lines[i].slice(0, idx).trim().toLowerCase();
        var value = lines[i].slice(idx + 1).trim();
        entries[name] = value;
      }
      return entries;
    }

    function check_entry(entries) {
      if(typeof entries['codetype'] !== 'undefined'
        && typeof entries['ip'] !== 'undefined'
        && typeof entries['portm'] !== 'undefined') {
        return true;
      }
      return false;
    }

  }
])

.controller('OptionCtrl', ['$scope', 'appSetting', 'hmtgHelper', '$rootScope', '$translate', '$ocLazyLoad', 'hmtgAlert',
  function ($scope, appSetting, hmtgHelper, $rootScope, $translate, $ocLazyLoad, hmtgAlert) {
    $scope.w = {};
    $scope.w.show_msgr = !!hmtg.customization.show_msgr;
    $scope.w.show_demo_link = !!hmtg.customization.show_demo_link;
    $scope.w.show_native_app = !!hmtg.customization.show_native_app;

    $scope.$on('$includeContentError', function (e, param) {
      if(param == 'lazy_htm/option_msgr.htm' + hmtgHelper.cache_param) $scope.partialMsgr = '';
      else if(param == 'lazy_htm/option_webapp.htm' + hmtgHelper.cache_param) $scope.partialWebApp = '';
      else if(param == 'lazy_htm/option_joinnet.htm' + hmtgHelper.cache_param) $scope.partialJoinNet = '';
      else if(param == 'lazy_htm/option_webrtc.htm' + hmtgHelper.cache_param) $scope.partialWebRTC = '';
      else if(param == 'lazy_htm/option_url.htm' + hmtgHelper.cache_param) $scope.partialURL = '';
      else if(param == 'lazy_htm/option_mypicture.htm' + hmtgHelper.cache_param) $scope.partialMyPicture = '';
      else if(param == 'lazy_htm/option_nativeapp.htm' + hmtgHelper.cache_param) $scope.partialNativeApp = '';
      else if(param == 'lazy_htm/option_demo.htm' + hmtgHelper.cache_param) $scope.partialDemo = '';
      else if(param == 'lazy_htm/option_score.htm' + hmtgHelper.cache_param) $scope.partialScore = '';
      else if(param == 'lazy_htm/_internal_option_test.htm' + hmtgHelper.cache_param) $scope.partialTest = '';
    });

    $scope.partialMsgr = '';
    $scope.selectMsgr = function () {
      if($scope.partialMsgr) return;

      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/option_msgr' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function () {
        $scope.partialMsgr = 'lazy_htm/option_msgr.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading option_msgr fails');
      });
    }

    $scope.partialWebApp = '';
    $scope.selectWebApp = function () {
      if($scope.partialWebApp) return;

      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/option_webapp' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function () {
        $scope.partialWebApp = 'lazy_htm/option_webapp.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading option_webapp fails');
      });
    }

    $scope.partialJoinNet = '';
    $scope.selectJoinNet = function () {
      if($scope.partialJoinNet) return;

      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/option_joinnet' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function () {
        $scope.partialJoinNet = 'lazy_htm/option_joinnet.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading option_joinnet fails');
      });
    }

    $scope.partialWebRTC = '';
    $scope.selectWebRTC = function() {
      if($scope.partialWebRTC) return;

      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/option_webrtc' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialWebRTC = 'lazy_htm/option_webrtc.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading option_webrtc fails');
      });
    }

    $scope.partialURL = '';
    $scope.selectURL = function () {
      if($scope.partialURL) return;

      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/option_url' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function () {
        $scope.partialURL = 'lazy_htm/option_url.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading option_url fails');
      });
    }

    $scope.partialMyPicture = '';
    $scope.selectMyPicture = function () {
      if($scope.partialMyPicture) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/option_mypicture' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function () {
        $scope.partialMyPicture = 'lazy_htm/option_mypicture.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading option_mypicture fails');
      });
    }

    $scope.partialNativeApp = '';
    $scope.selectNativeApp = function () {
      if($scope.partialNativeApp) return;
      $scope.partialNativeApp = 'lazy_htm/option_nativeapp.htm' + hmtgHelper.cache_param;
      hmtgHelper.fast_apply();
    }

    $scope.partialDemo = '';
    $scope.selectDemo = function () {
      if($scope.partialDemo) return;
      $scope.partialDemo = 'lazy_htm/option_demo.htm' + hmtgHelper.cache_param;
      hmtgHelper.fast_apply();
    }

    $scope.partialScore = '';
    $scope.selectScore = function() {
      if($scope.partialScore) return;
      $scope.partialScore = 'lazy_htm/option_score.htm' + hmtgHelper.cache_param;
      hmtgHelper.fast_apply();
    }

    $scope.partialTest = '';
    $scope.selectTest = function () {
      if($scope.partialTest) return;

      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/_internal_option_test' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function () {
        $scope.partialTest = 'lazy_htm/_internal_option_test.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading _internal_option_test fails');
      });
    }

    $scope.test_noti = function () {
      hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), 'This is an instant notification', true);
    }

    $scope.test_noti2 = function () {
      setTimeout(function () {
        hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), 'This is a 10s delayed notification');
      }, 10000);
    }

    $scope.close_noti = function () {
      hmtgAlert.close_notification();
    }

  }
])

.controller('AboutCtrl', ['$scope', 'appVersion',
  function ($scope, appVersion) {
    $scope.app_version = appVersion.full;
    $scope.jmkernel_version = hmtg.jmkernel.version();
    $scope.jnkernel_version = hmtg.jnkernel.version();
  }
])

.controller('LangCtrl', ['$scope', '$rootScope', '$translate', 'hmtgHelper',
  function ($scope, $rootScope, $translate, hmtgHelper) {
    $scope.lang = $translate.preferredLanguage();

    $scope.$watch('lang', function () {
      hmtg.util.localStorage['hmtg_lang'] = $scope.lang;
      $translate.use($scope.lang);
      //hmtgHelper.inside_angular++;
      //$rootScope.$broadcast(hmtgHelper.WM_LANG_CHANGED);
      //hmtgHelper.inside_angular--;
    });

  }
])

.controller('ResetAllCtrl', ['$scope', '$translate', '$modal', 'hmtgHelper', 'jnjContent', 'jnagentDlg', 'JoinNet', 'reconnectName',
  function ($scope, $translate, $modal, hmtgHelper, jnjContent, jnagentDlg, JoinNet, reconnectName) {
    $scope.reset_all = function () {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_RESET_ALL_WARNING'), 0, ok);
      function ok() {
        hmtgHelper.inside_angular++;
        // stop joinnet sessions
        hmtg.jnkernel.jn_command_QuitConnection();
        if(hmtg.jnkernel.jn_callback_EventStartSession) hmtg.jnkernel.jn_callback_EventStartSession();
        jnjContent.valid_jnj = false;
        jnjContent.jnj = '';
        // remove all msgr offices
        jnagentDlg.remove_all_office();

        // remove all reconnect names
        reconnectName.reset_reconnect_name();

        // reset all settings
        hmtg.util.localStorage.clear();

        hmtgHelper.inside_angular--;

        window.onbeforeunload = function (e) { };
        location.replace(location.href.split('?')[0].split('#')[0]);
      }
    }

  }
])

.controller('BrowserDetectCtrl', ['$scope', 'hmtgAlert', 'hmtgHelper',
  function ($scope, hmtgAlert, hmtgHelper) {
    if(hmtgHelper.isiOS) {
      // this is just to let the stupid iOS to show alert in the following codes
      // any better work around?
      hmtgAlert.add_hidden_item({ type: 'muted' });
    }

    $scope.browser_supported = true;
  }
])
;

