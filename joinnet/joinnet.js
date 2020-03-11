/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet', ['pascalprecht.translate'])

.service('JoinNet', ['$rootScope', 'jnjContent', 'hmtgAlert', 'hmtgHelper', 'joinnetHelper', '$translate',
    '$modal', 'userlist', 'chat', 'board', 'browser', '$sce', 'playback', 'audio_playback', 'hmtgSound', 'audio_capture', 'audio_codec',
    'video_playback', 'main_video', 'main_video_canvas', 'video_codec', 'video_capture', 'video_bitrate', 'appSetting', 'video_recving',
    'reconnectName', 'mypicture', 'qlist', 'missedCall', 'mediasoupWebRTC',
  function($rootScope, jnjContent, hmtgAlert, hmtgHelper, joinnetHelper, $translate, $modal,
      userlist, chat, board, browser, $sce, playback, audio_playback, hmtgSound, audio_capture, audio_codec, video_playback,
      main_video, main_video_canvas, video_codec, video_capture, video_bitrate, appSetting, video_recving,
      reconnectName, mypicture, qlist, missedCall, mediasoupWebRTC) {
    var _JoinNet = this;
    this.is_chat_area_visible = false;
    this.net_init_finished = false;
    this.recording_status = 1;
    this.archive_status = false;
    this.has_jnr_password = false;
    this.jnr_decryption = false;
    this.user_array = {};
    this.auto_reconnect_start_tick = 0;
    this.auto_reconnect_alert_item = null;
    this.auto_reconnect_count = 0;
    this.auto_reconnect_no_alert_count = 2; // do not show the alert for the first 2 times
    this.auto_reconnect_max_time_window = 10 * 60 * 1000; // stop after 10 minutes
    this.is_appdata_ready = [];
    this.callback_PlugInSetStaticDataResponse = [];
    this.callback_PlugInControlChannelData = [];
    this.callback_PlugInPacketRecved = [];
    this.is_owner = false;
    this.is_assistant = false;
    this.is_presenter = false;
    this.is_holder = false;
    this.is_questioner = false;

    var jnkernel = hmtg.jnkernel;
    jnkernel['jn_callback_ErrorReport'] = function() {
      var item = {};
      item['timeout'] = 3600 * 24 * 10;
      item['update'] = function() { return $translate.instant('ID_ERROR_REPORT') };
      item['text'] = item['update']();
      item['type'] = 'danger';
      item['click'] = function(index) {
        var elem = document.getElementById("error_button1");
        if(elem) elem.onclick();
        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);
        hmtgHelper.inside_angular--;
      };

      if(_JoinNet.error_report_alert_item) {
        hmtgAlert.remove_link_item(_JoinNet.error_report_alert_item);
      }
      _JoinNet.error_report_alert_item = item;
      hmtgAlert.add_link_item(item);
    }

    jnkernel['jn_callback_decompress'] = function() {
      return hmtgHelper.decompress;
    }

    jnkernel['jn_callback_memory_threshold'] = function() {
      return appSetting.max_blob;
    }

    jnkernel['jn_callback_fail_to_connect'] = function() {
      hmtgAlert.prompt_http(_JoinNet.jnj);
    }

    jnkernel['jn_callback_UpdateStatus'] = function(error_code) {
      if(error_code == hmtg.config.JN_CONNECTION_ESTABLISHED) {
        _JoinNet.resetAutoReconnect();
      }

      var item = {};
      item['timeout'] = 20;
      item['update'] = function() { return $translate.instant(joinnetHelper.errorcode2id(error_code)) };
      item['text'] = item['update']();
      item['type'] = 'success';

      hmtgAlert.update_status_item(item);
    }

    jnkernel['jn_callback_UpdateStatus_MessageBox'] = function(error_code) {
      hmtgAlert.update_status_item({});
      // hmtgHelper.MessageBox('(' + error_code + ') ' + $translate.instant(joinnetHelper.errorcode2id(error_code)), 0);
      var msg_func = dummy;
      if(error_code == hmtg.config.JN_MEETING_OVER
        || (error_code > hmtg.config.JN_ERROR_BASE - 256 && error_code < hmtg.config.JN_ERROR_BASE)
      ) {
        msg_func = switch_to_msgr;
      }
      hmtgHelper.MessageBox('(' + error_code + ') ' + $translate.instant(joinnetHelper.errorcode2id(error_code)), 0, msg_func);
      function switch_to_msgr()
      {
        if($rootScope.hmtg_show_msgr) {
          $rootScope.nav_item = 'msgr';
          $rootScope.tabs[0].active = true;
        }
      }
      function dummy()
      {
      }
    }

    jnkernel['jn_callback_ErrorWrongVersion'] = function(error_code, majorversion, minorversion) {
      hmtgAlert.update_status_item({});
      hmtgHelper.MessageBox('(' + (hmtg.config.JN_ERROR_BASE - 256 + error_code) + ') ' + $translate.instant('IDS_FILE_WRONG_VERSION').replace('%d', majorversion).replace('%d', minorversion), 0);
    }

    this.resetAutoReconnect = function() {
      this.auto_reconnect_count = 0;
      if(this.auto_reconnect_alert_item) {
        hmtgAlert.remove_link_item(this.auto_reconnect_alert_item);
        this.auto_reconnect_alert_item = null;
      }
    }

    jnkernel['jn_callback_DisconnectFromMCU'] = function(bConnectionReset) {
      hmtgAlert.update_status_item({});

      _JoinNet.auto_reconnect_count++;
      if(_JoinNet.auto_reconnect_count == 1) {
        _JoinNet.auto_reconnect_start_tick = hmtg.util.GetTickCount();
      }
      // for playback, do not auto-reconnect
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
        && _JoinNet.auto_reconnect_count <= _JoinNet.auto_reconnect_no_alert_count) {
        setTimeout(function() {
          if(!(hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting())) {
            $rootScope.nav_item = 'joinnet';
            $rootScope.tabs[2].active = true;
            hmtg.jnkernel.jn_command_QuitConnection();
            hmtg.jnkernel.jn_command_initconnectmedia(true);
          }
        }, 0);
        return;
      }

      if(hmtg.util.GetTickCount() - _JoinNet.auto_reconnect_start_tick > _JoinNet.auto_reconnect_max_time_window) {
        return;
      }

      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        var delay = 500 << _JoinNet.auto_reconnect_count;
        if(delay > 60 * 1000) delay = 60 * 1000;

        var item = {};
        item['timeout'] = delay / 1000;
        item['update'] = function() {
          return $translate.instant('ID_AUTO_RECONNECT_PROMPT');
        };
        item['text'] = item['update']();
        item['type'] = 'info';
        item['click'] = function(index) {
          _JoinNet.auto_reconnect_count = 0;

          hmtgHelper.inside_angular++;
          hmtgAlert.click_link(index);
          if(!(hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting())) {
            $rootScope.nav_item = 'joinnet';
            $rootScope.tabs[2].active = true;
            hmtg.jnkernel.jn_command_QuitConnection();
            hmtg.jnkernel.jn_command_initconnectmedia(true);
          }
          hmtgHelper.inside_angular--;
        };
        item['timeout_action'] = function(index) {
          if(!(hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting())) {
            $rootScope.nav_item = 'joinnet';
            $rootScope.tabs[2].active = true;
            hmtg.jnkernel.jn_command_QuitConnection();
            hmtg.jnkernel.jn_command_initconnectmedia(true);
          }
        };

        _JoinNet.auto_reconnect_alert_item = item;
        hmtgAlert.add_link_item(item);
      } else {
        hmtgHelper.OKCancelMessageBox($translate.instant('ID_TRY_RECONNECT'), 0, ok);
        function ok(result) {
          hmtgHelper.inside_angular++;
          if(!(hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting())) {
            $rootScope.nav_item = 'joinnet';
            $rootScope.tabs[2].active = true;
            hmtg.jnkernel.jn_command_QuitConnection();
            hmtg.jnkernel.jn_command_initconnectmedia(true);
          }
          hmtgHelper.inside_angular--;
        }
      }
    }

    jnkernel['jn_callback_AddUser'] = function(ssrc) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // user list will be refreshed at the end of the random access or end of file
        return;
      }

      userlist.add_user(ssrc);
      video_playback.add_user(ssrc);
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        mediasoupWebRTC.add_user(ssrc);
      }
      $rootScope.$broadcast(hmtgHelper.WM_ADD_USER, ssrc);
    }

    jnkernel['jn_callback_DeleteUser'] = function(ssrc, leave_by_action) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // user list will be refreshed at the end of the random access or end of file
        return;
      }
      userlist.delete_user(ssrc);
      main_video.delete_user(ssrc);
    }

    jnkernel['jn_callback_sipclient_status_update'] = function(ssrc, uri, status) {
      // do not support to display non-joinnet user in playback any more
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) {
        // random access, 
        // no show non-joinnet user
        return;
      }

      if(status) {
        userlist.add_sip_user(ssrc, uri);
      } else {
        userlist.delete_sip_user(ssrc, uri);
      }
    }

    jnkernel['jn_callback_sipclient_transfer_update'] = function(ssrc, uri, uri2) {
      // do not support to display non-joinnet user in playback any more
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) {
        // random access, 
        // no show non-joinnet user
        return;
      }

      userlist.transfer_sip_user(ssrc, uri, uri2);
    }

    jnkernel['jn_callback_EventQuitSession'] = function() {
      _JoinNet.recording_status = 1;
      _JoinNet.archive_status = false;
      _JoinNet.has_jnr_password = false;
      _JoinNet.jnr_decryption = false;
      _JoinNet.is_appdata_ready = [];
      _JoinNet.is_owner = false;
      _JoinNet.is_assistant = false;
      _JoinNet.is_presenter = false;
      _JoinNet.is_holder = false;
      _JoinNet.is_questioner = false;
      _JoinNet.bookmark = [];

      audio_codec.reset();
      video_codec.reset();
      userlist.reset();
      chat.event_quit_session();
      board.event_quit_session();
      playback.event_quit_session();
      audio_playback.event_quit_session();
      audio_capture.event_quit_session();
      main_video.event_quit_session();
      video_playback.event_quit_session();
      mediasoupWebRTC.event_quit_session();
      $rootScope.$broadcast(hmtgHelper.WM_QUIT_SESSION);
    }

    jnkernel['jn_callback_EventStartSession'] = function() {
      _JoinNet.net_init_finished = false;
      _JoinNet.init_browsing_url_update_func = null;
      _JoinNet.is_appdata_ready = [];
      _JoinNet.jnr_prop = {};
      audio_capture.last_codec = 0;
      video_capture.last_codec = 0;
      board.reset();
      chat.reset();
      //browser.reset();  // dont reset history here, only reset history for a new jnj, or playback restart, or joinnet.reset()
      playback.reset();
      $rootScope.$broadcast(hmtgHelper.WM_START_SESSION);
    }

    jnkernel['jn_callback_AddSlideTitle'] = function(slide) {
      board.add_slide(slide, false);
    }

    jnkernel['jn_callback_ChatText'] = function(source_ssrc, target_ssrc, settopflag, text, codepage, ts, date) {
      chat.add_chat(source_ssrc, target_ssrc, settopflag, text, codepage, ts, date, _JoinNet.is_chat_area_visible);
    }

    jnkernel['jn_callback_NetInitFinish'] = function() {
      _JoinNet.net_init_finished = true;
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        hmtg.jnkernel._jn_iMaxVideoBitrate(appSetting.use_max_video_bitrate ? appSetting.max_video_bitrate * 1000 : 10000000);
        hmtg.jnkernel._jn_iMaxAppdataBitrate(appSetting.use_max_appdata_bitrate ? appSetting.max_appdata_bitrate * 1000 : 0);
        
        hmtg.util.log('stat, audio record mute status is ' + (hmtgSound.record_muted ? 'Muted' : 'Unmuted'));
        hmtg.util.log('stat, audio playback mute status is ' + (hmtgSound.playback_muted ? 'Muted' : 'Unmuted'));
        hmtg.util.log('stat, video sending status is ' + (video_bitrate.is_send_video ? 'ON' : 'OFF'));
        hmtg.util.log('stat, video recving status is ' + (video_recving.is_recv_video ? 'ON' : 'OFF'));
      }
      _JoinNet.is_owner = hmtg.jnkernel._jn_ssrc_index() == 0;
      //hmtg.util.log(-2, '******debug, net init finish');
      var v = hmtg.jnkernel._jn_auto_download_all();
      if(typeof v === 'undefined') {
        board.auto_download_all = appSetting.auto_download_all;
      } else {
        board.auto_download_all = v >> 0;
      }
      board.net_init_finished();
      userlist.net_init_finished();
      //main_video_canvas.display_size = Math.max(hmtg.jnkernel._jn_iSize_w(), hmtg.jnkernel._jn_iSize_h());
      video_codec.net_init_finished();
      if(video_codec.video_codec) video_capture.change_video_codec();
      else if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_NO_VIDEO_CODEC') }, 20);
      audio_codec.net_init_finished();
      if(audio_codec.audio_codec) audio_capture.change_audio_codec();
      else if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_NO_AUDIO_CODEC') }, 20);
      video_playback.net_init_finished();
      $rootScope.$broadcast(hmtgHelper.WM_NET_INIT_FINISH);
      jnkernel.jn_command_UpdateTextCodePage(hmtg.config.UTF8_CODEPAGE);
      mypicture.net_init_finished();
      mediasoupWebRTC.net_init_finished();

      // the first browsing url, if available will be received before net_init_finished
      // remember it and call it later when net_init_finished is set
      if(_JoinNet.init_browsing_url_update_func) {
        _JoinNet.init_browsing_url_update_func();
      }

      // if this is a reconnection, the audio/video may be in capture mode, update the audio/video cap
      $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
      qlist.default_ssrc = -1;
      qlist.resetQ();
      main_video.update_user_list();

      // if this is a meeting, and as an owner, and am not a token holder, prompt to retrieve token
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
        && hmtg.jnkernel._jn_bTokenOwner()
        && !hmtg.jnkernel._jn_bTokenHolder()
      ) {
        var item = {};
        item['timeout'] = 20;
        item['update'] = function() { return $translate.instant('ID_RETRIEVE_TOKEN_PROMPT') };
        item['text'] = item['update']();
        item['type'] = 'info';
        item['click'] = function(index) {
          hmtg.jnkernel.jn_command_GiveoutToken2(hmtg.jnkernel._jn_ssrc_index());
          hmtgHelper.inside_angular++;
          hmtgAlert.click_link(index);
          hmtgHelper.inside_angular--;
        };

        hmtgAlert.add_link_item(item);
      }
    }

    jnkernel['jn_callback_JointBrowsing'] = function(command_type, url) {
      if(hmtg.customization.support_joint_browsing) {
        browser.callback_JointBrowsing(command_type, hmtg.util.decodeUtf8(url));
      } else {
        var func = function() {
          // use the joint browsing rule to determine the source ssrc and its name
          var username = '';
          var ssrc = hmtg.jnkernel._tab_ssrc()
          var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
          var item = a[ssrc];
          if(item) {
            username += hmtg.util.decodeUtf8(item._szRealName());
          }

          // use the tick at the moment of receiving as the ts
          var ts;
          if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
            // for meeting, the tick could be delayed if the user join the meeting after the URL is shared
            ts = (hmtg.util.GetTickCount() - hmtg.jnkernel._jn_dwSessionStartTick()) >> 0;
          } else {
            // use the tick as ts
            // for playback, the tick could be delayed if it is received during fast forwarding
            ts = playback.tick;
          }
          var date;
          // prefix the text chat with "Joint Web Browsing: " to show that this text chat 
          // is the result of a joint browsing
          chat.add_chat(ssrc, -1, 1, username + '>' + $translate.instant('IDS_JOINT_WEB_BROWSING') + ': ' + hmtg.util.decodeUtf8(url), 0, ts, date, _JoinNet.is_chat_area_visible);
        }
        if(_JoinNet.net_init_finished) {
          func();
        } else {
          // the first browsing url, if available will be received before net_init_finished
          // remember it and call it later when net_init_finished is set
          _JoinNet.init_browsing_url_update_func = func;
        }
      }
    }

    jnkernel['jn_callback_update_duration_str'] = function() {
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_DURATION);
    }

    jnkernel['jn_callback_PlaybackInitStat'] = function(start_tick, end_tick, bandwidth, start_str) {
      playback.init_stat(start_tick, end_tick, bandwidth, start_str);
    }

    jnkernel['jn_callback_PlaybackTickUpdate'] = function(tick) {
      $rootScope.$broadcast(hmtgHelper.WM_PLAYBACK_TICK_UPDATE, tick);
    }

    jnkernel['jn_callback_PlaybackEndOfFile'] = function() {
      $rootScope.$broadcast(hmtgHelper.WM_PLAYBACK_END_OF_FILE);
    }

    jnkernel['jn_callback_PlaybackJNRDecryptionStatus'] = function(status) {
      if(status == 0) {
        _JoinNet.jnr_decryption = true;
        _JoinNet.jnr_decryption_func = function() {
          return $translate.instant('ID_JNR_START_DECRYPTION');
        };
        _JoinNet.jnr_decryption_text = _JoinNet.jnr_decryption_func();
      } else if(status == 1) {
        _JoinNet.jnr_decryption = false;
      } else {
        _JoinNet.jnr_decryption = false;
        _JoinNet.jnr_decryption_func = function() {
          return $translate.instant('ID_JNR_DECRYPTION_ERROR');
        };
        _JoinNet.jnr_decryption_text = _JoinNet.jnr_decryption_func();
      }
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
    }

    jnkernel['jn_callback_PlaybackJNRDecryptionProgress'] = function(progress) {
      if(_JoinNet.jnr_decryption) {
        _JoinNet.jnr_decryption_func = function() {
          return $translate.instant('ID_JNR_DECRYPTION_PROGRESS').replace('#progress#', progress);
        };
        _JoinNet.jnr_decryption_text = _JoinNet.jnr_decryption_func();
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
      }
    }

    jnkernel['jn_callback_PlaybackRestart'] = function() {
      _JoinNet.is_appdata_ready = [];
      userlist.reset();
      chat.event_quit_session();
      board.reset();
      chat.reset();
      browser.reset();
      playback.restart();
      main_video.restart();
      video_playback.restart();
      $rootScope.$broadcast(hmtgHelper.WM_PLAYBACK_RESTART);
    }

    jnkernel['jn_callback_ChangeWorkMode'] = function() {
      $rootScope.$broadcast(hmtgHelper.WM_WORKMODE_CHANGED);
    }

    jnkernel['jn_callback_AudioPacketRecved'] = function(data, type, ssrc) {
      if(type == hmtg.config.AUDIO_G711
        || type == hmtg.config.AUDIO_G711_11
        || type == hmtg.config.AUDIO_OPUS) {
        if(!mediasoupWebRTC.remoteIsWebRTCAudio[ssrc] || !mediasoupWebRTC.to_play_webrtc_audio(ssrc)) {
          audio_playback.recv_audio(data, type, ssrc);
        }
      } else {
        hmtg.jnkernel.jn_command_UnknownMedia(type, ssrc);
      }
    }

    jnkernel['jn_callback_VideoPacketRecved'] = function(data, type, ssrc, ts, ts2) {
      if(type == hmtg.config.VIDEO_H264
        || type == hmtg.config.VIDEO_F264
        || type == hmtg.config.VIDEO_VPX
        || type == hmtg.config.VIDEO_MJPG) {
        //video_playback.recv_video(data, type, 1, ts, ts2);
        //if(Math.random() > 0.5)
        if(!mediasoupWebRTC.remoteIsWebRTCVideo[ssrc] || !mediasoupWebRTC.to_show_webrtc_video(ssrc)) {
          video_playback.recv_video(data, type, ssrc, ts, ts2);
        }  
        //hmtg.util.log(-2, '******debug, recv video, ssrc=' + ssrc + ',size=' + data.length);
      } else {
        hmtg.jnkernel.jn_command_UnknownMedia(type, ssrc);
      }
    }

    jnkernel['jn_callback_SetDefaultPlaybackVideo'] = function(ssrc) {
      main_video.default_video_ssrc = ssrc;
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // will be refreshed at the end of the random access or end of file
        return;
      }

      main_video.update_user_list();
    }

    jnkernel['jn_callback_ForceIFrame'] = function() {
      if(video_codec.video_codec != hmtg.config.VIDEO_MJPG) {
        video_capture.force_key_frame_flag = true;
      }
    }

    jnkernel['jn_callback_PlaybackJNRPropertyReady'] = function(doc) {
      try {
        var i;
        var jnr = doc.getElementsByTagName("jnr")[0];
        if(!jnr) return;
        var bookmark = jnr.getElementsByTagName("bookmark")[0];
        _JoinNet.bookmark = [];
        _JoinNet.jnr_prop = {};

        try {
          if(bookmark) {
            var items = bookmark.getElementsByTagName("i");
            for(i = 0; items[i]; i++) {
              var item = items[i];
              var name = hmtg.util.decodeUtf8(item.childNodes[0].nodeValue);
              var tick = item.getAttribute('tick');
              if(typeof tick === 'string' && name) {
                _JoinNet.bookmark.push({ name: name, tick: tick, str: playback.calc_tick_str(tick) });
              }

            }
          }
        } catch(e) {
        }

        var title = get_value(jnr, 'title');
        var category = get_value(jnr, 'category');
        var keyword = get_value(jnr, 'keyword');
        var abstrct = get_value(jnr, 'abstract');
        var comment = get_value(jnr, 'comment');
        var registration = get_value(jnr, 'registration');
        var release_date = get_value(jnr, 'release_date');

        var user_record = '';
        var _record = hmtg.jnkernel._jn_user_record();
        for(i = 0; i < _record.length; i++) {
          user_record += (i != 0 ? ', ' : '') + hmtg.util.decodeUtf8(_record[i]);
        }

        _JoinNet.jnr_prop = { empty: true, title: title, category: category, keyword: keyword, abstrct: abstrct, comment: comment, registration: registration, release_date: release_date,
          user_record: user_record, user_record_count: _record.length
        };
        if(title || category || keyword || abstrct || comment || registration || release_date) _JoinNet.jnr_prop.empty = false;
      } catch(e) {
      }

      function get_value(node, item) {
        try {
          return hmtg.util.decodeUtf8(node.getElementsByTagName(item)[0].childNodes[0].nodeValue);
        } catch(e) {
          return '';
        }
      }
    }

    jnkernel['jn_callback_UnknownMediaAlert'] = function(type, name, subtype) {
      var type_str;
      switch(type) {
        case hmtg.config.AUDIO_DFLT:
          type_str = 'AUDIO_DFLT[' + type + subtype + ']';
          break;
        case hmtg.config.AUDIO_ILBC:
          type_str = 'AUDIO_ILBC[' + type + subtype + ']';
          break;
        case hmtg.config.AUDIO_G726:
          type_str = 'AUDIO_G726[' + type + subtype + ']';
          break;
        case hmtg.config.AUDIO_G726_11:
          type_str = 'AUDIO_G726_11K[' + type + subtype + ']';
          break;
        case hmtg.config.VIDEO_DFLT:
          type_str = 'VIDEO_DFLT[' + type + subtype + ']';
          break;
        case hmtg.config.VIDEO_H264:
          type_str = 'VIDEO_H264[' + type + subtype + ']';
          break;
        case hmtg.config.VIDEO_F264:
          type_str = 'VIDEO_F264[' + type + subtype + ']';
          break;
        case hmtg.config.VIDEO_VPX:
          type_str = 'VIDEO_VPX[' + type + subtype + ']';
          break;
        default:
          type_str = $translate.instant('ID_UNKNOWN_CODEC') + '[' + type + subtype + ']';
          break;
      }
      hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_UNKNOWN_MEDIA').replace('#type#', type_str).replace('#name#', hmtg.util.decodeUtf8(name)) }, 20);
    }

    jnkernel['jn_callback_GetSelectedSlideIndex'] = function() {
      return board.jnkernel_slide_index;
    }

    jnkernel['jn_callback_FlipSlide'] = function(hint, slide_index) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // will be refreshed at the end of the random access or end of file
        if(hint == 0) {
          playback.queue_flipslide_index = slide_index;
          playback.queue_has_flipslide_index = true;
        } else if(hint == 1) {
          playback.queue_hint1_index = slide_index;
          playback.queue_has_hint1_index = true;
        } else if(hint == 2) {
          playback.queue_hint2_index = slide_index;
          playback.queue_has_hint2_index = true;
        }
        return;
      }

      board.callback_FlipSlide(hint, slide_index);
      if(hmtg.jnkernel._jn_bTokenHolder() && !hmtg.jnkernel._is_sync_ssrc()) {
        userlist.callback_ResetSlidePolling(slide_index);
      }
    }

    jnkernel['jn_callback_mark_event'] = function(event, index, mark) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // will be refreshed at the end of the random access or end of file
        return;
      }

      board.callback_mark_event(event, index, mark);
    }

    jnkernel['jn_callback_FocusPointer'] = function(index, x, y, cx, cy, color, width) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // will be refreshed at the end of the random access or end of file
        return;
      }

      board.callback_FocusPointer(index, x, y, cx, cy, color, width);
    }

    jnkernel['jn_callback_UpdateDeletedSlideTitle'] = function(index) {
      if(board.callback_UpdateDeletedSlideTitle(index)) {
        if(hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_bTokenHolder()) {
          userlist.callback_ResetSlidePolling(-1);
        }
      }
    }

    jnkernel['jn_callback_UpdateReleasedSlideTitle'] = function(index) {
      board.callback_UpdateReleasedSlideTitle(index);
    }

    jnkernel['jn_callback_NewTokenHolder'] = function(ssrc, old_token_holder, old_data_sender) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // no need to render during random access
        return;
      }

      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      _JoinNet.is_holder = my_ssrc >= 0 && my_ssrc == ssrc;
      _JoinNet.is_questioner = hmtg.jnkernel.is_questioner(hmtg.jnkernel._jn_ssrc_index());
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
      main_video.update_user_list();
      userlist.callback_NewTokenHolder(old_token_holder, old_data_sender);
      userlist.user_status_changed();
      video_recving.update_holder_sender_video_recv_status();

      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        $rootScope.$broadcast(hmtgHelper.WM_TOKEN_STATUS_CHANGED);

        var my_ssrc_index = hmtg.jnkernel._jn_ssrc_index();
        if(old_token_holder == my_ssrc_index || hmtg.jnkernel._jn_bTokenHolder()) {
          $rootScope.$broadcast(hmtgHelper.WM_MY_TALKER_STATUS_CHANGED);
          $rootScope.$broadcast(hmtgHelper.WM_MY_TOKEN_STATUS_CHANGED);
        }
      }
      $rootScope.$broadcast(hmtgHelper.WM_TALKER_STATUS_CHANGED);
      video_playback.on_video_interrupted2();
      video_playback.clear_queue2();
    }

    jnkernel['jn_callback_NewDataSender'] = function(ssrc) {
      if(hmtg.jnkernel.is_questioner(ssrc)) qlist.addQ(ssrc);
      else qlist.resetQ();

      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // no need to render during random access
        return;
      }

      _JoinNet.is_questioner = hmtg.jnkernel.is_questioner(hmtg.jnkernel._jn_ssrc_index());
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
      main_video.update_user_list();
      userlist.callback_NewDataSender();
      userlist.user_status_changed();
      video_recving.update_holder_sender_video_recv_status();

      $rootScope.$broadcast(hmtgHelper.WM_TALKER_STATUS_CHANGED);
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        $rootScope.$broadcast(hmtgHelper.WM_MY_TALKER_STATUS_CHANGED);
      }
      video_playback.on_video_interrupted2();
      video_playback.clear_queue2();
    }

    jnkernel['jn_callback_NewAssistant'] = function() {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // no need to render during random access
        return;
      }

      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      _JoinNet.is_assistant = my_ssrc >= 0 && my_ssrc == hmtg.jnkernel._jn_iAssistant();
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
      userlist.user_status_changed();
    }

    jnkernel['jn_callback_NewController'] = function() {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // no need to render during random access
        return;
      }

      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      _JoinNet.is_presenter = my_ssrc >= 0 && my_ssrc == hmtg.jnkernel._jn_iController();
      _JoinNet.update_holder_presetner_tip();
      userlist.update_restricted_audio_decoding();
      userlist.user_status_changed();
      userlist.callback_ControllerStatusChanged();
      $rootScope.$broadcast(hmtgHelper.WM_CONTROLLER_STATUS_CHANGED);
    }

    jnkernel['jn_callback_NewControlFlag'] = function(flag) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // no need to render during random access
        return;
      }

      _JoinNet.update_holder_presetner_tip();
      userlist.callback_ControllerStatusChanged();
      $rootScope.$broadcast(hmtgHelper.WM_CONTROLLER_STATUS_CHANGED);
    }

    jnkernel['jn_callback_ParticipantVideoSpeakerStatus'] = function(ssrc, status, channel) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // will be refreshed at the end of the random access or end of file
        if(!status) {
          qlist.resetQ();
        } else {
          qlist.addQ(ssrc);
        }
        return;
      }

      if(!status) {
        // if become not speaker, do not subscribe its video
        hmtg.jnkernel.jn_command_ParticipantVideoStop(ssrc);
        qlist.resetQ();
        video_playback.on_video_interrupted2();
        video_playback.clear_queue2();
      } else {
        $rootScope.$broadcast(hmtgHelper.WM_NEW_SPEAKER, ssrc); // tell video window to subscribe its video if in list
        qlist.addQ(ssrc);
      }
      _JoinNet.is_questioner = hmtg.jnkernel.is_questioner(hmtg.jnkernel._jn_ssrc_index());
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
      main_video.update_user_list();
      userlist.callback_ParticipantVideoSpeakerStatus(ssrc, status, channel);
      userlist.user_status_changed();

      $rootScope.$broadcast(hmtgHelper.WM_TALKER_STATUS_CHANGED);
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        if(hmtg.jnkernel._jn_ssrc_index() == ssrc) {
          $rootScope.$broadcast(hmtgHelper.WM_MY_TALKER_STATUS_CHANGED);
        }
      }
    }

    jnkernel['jn_callbackQuestionSkipped'] = function(ssrc) {
      userlist.user_status_changed();
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
    }

    jnkernel['jn_callback_VideoBitrateChanged'] = function() {
      video_bitrate.update_bitrate();
    }

    jnkernel['jn_callback_AppdataBitrateChanged'] = function(channel) {
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_APPDATA_BITRATE, channel);
    }

    jnkernel['jn_callback_AddQuestion'] = function(ssrc) {
      userlist.callback_AddQuestion(ssrc);
    }

    jnkernel['jn_callback_CancelQuestion'] = function(ssrc) {
      userlist.callback_CancelQuestion(ssrc);
    }

    jnkernel['jn_callback_JoinRequest'] = function(id, name) {
      if(appSetting.auto_reject_visitor) {
        setTimeout(function() {
          hmtg.jnkernel.jn_command_OwnerResponse(id, -1);
        }, 0);
        return;
      } else if(appSetting.auto_allow_visitor) {
        setTimeout(function() {
          hmtg.jnkernel.jn_command_OwnerResponse(id, 1);
        }, 0);
        return;
      }

      var item = {};
      item['timeout'] = 20;
      item['update'] = function() { return $translate.instant('IDS_SHADOW_REQUEST_FORMAT').replace('%1$s', hmtg.util.decodeUtf8(name)) };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['need_ring'] = true;
      item['click'] = function(index) {
        hmtgAlert.close_notification();
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;
        hmtg.jnkernel.jn_command_OwnerResponse(id, 1);
        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);
        hmtgHelper.inside_angular--;
      };
      item['cancel'] = function() {
        hmtgAlert.close_notification();
        hmtg.jnkernel.jn_command_OwnerResponse(id, -1);
      }
      item['timeout_action'] = function() {
        missedCall.update_missed_call('IDS_JOIN', hmtg.util.decodeUtf8(name));
      }

      hmtgAlert.add_link_item(item);
      hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), item['update']());
    }

    jnkernel['jn_callback_SIPJoinRequest'] = function(ssrc, name, uri) {
      if(appSetting.auto_reject_visitor) {
        setTimeout(function() {
          hmtg.jnkernel.jn_command_sipclient_response(ssrc, uri, 1);  // reject
        }, 0);
        return;
      } else if(appSetting.auto_allow_visitor) {
        setTimeout(function() {
          hmtg.jnkernel.jn_command_sipclient_response(ssrc, uri, 0);  // accept
        }, 0);
        return;
      }

      var item = {};
      item['timeout'] = 20;
      item['update'] = function() { return $translate.instant('IDS_SIP_JOIN_REQUEST_FORMAT').replace('%1$s', hmtg.util.decodeUtf8(uri)).replace('%2$s', hmtg.util.decodeUtf8(name)) };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['need_ring'] = true;
      item['click'] = function(index) {
        hmtgAlert.close_notification();
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;
        hmtg.jnkernel.jn_command_sipclient_response(ssrc, uri, 0);  // accept
        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);
        hmtgHelper.inside_angular--;
      };
      item['cancel'] = function() {
        hmtgAlert.close_notification();
        hmtg.jnkernel.jn_command_sipclient_response(ssrc, uri, 1);  // reject
      }
      item['timeout_action'] = function() {
        missedCall.update_missed_call('IDS_JOIN', 'SIP ' + hmtg.util.decodeUtf8(uri) + ' @ ' + hmtg.util.decodeUtf8(name));
      }

      hmtgAlert.add_link_item(item);
      hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), item['update']());
    }

    jnkernel['jn_callback_ConversionCount'] = function() {
      board.callback_ConversionCount();
    }

    jnkernel['jn_callback_ConversionResult'] = function(filename, error) {
      board.callback_ConversionResult(filename, error);
    }

    jnkernel['jn_callback_ChangeCapability'] = function(ssrc, a, v) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // will be refreshed at the end of the random access or end of file
        return;
      }

      userlist.callback_ChangeCapability(ssrc, a, v);
    }

    jnkernel['jn_callback_PollRequest'] = function() {
      $rootScope.$broadcast(hmtgHelper.WM_POLL_REQUEST, 1);
    }

    jnkernel['jn_callback_AddPollResult'] = function(ssrc, pollResult) {
      userlist.callback_AddPollResult(ssrc, pollResult);
    }

    jnkernel['jn_callback_TokenHolderPollRequest'] = function() {
      $rootScope.$broadcast(hmtgHelper.WM_POLL_REQUEST, 2);
    }

    jnkernel['jn_callback_AddTokenHolderPollResult'] = function(ssrc, pollResult) {
      userlist.callback_AddPollResult(ssrc, pollResult);
    }

    jnkernel['jn_callback_LeaveMessage'] = function(ownername, type) {
      var ownername2 = hmtg.util.decodeUtf8(ownername);
      hmtgAlert.update_status_item({});

      var text;
      if(type == 1)
        text = $translate.instant('IDS_LEAVE_MESSAGE').replace('%1$s', (ownername ? ownername2 : $translate.instant('ID_OWNER')));
      else
        text = $translate.instant('IDS_LEAVE_MESSAGE_OWNER_REJECT').replace('%1$s', (ownername ? ownername2 : $translate.instant('ID_OWNER')));
      hmtgHelper.OKCancelMessageBox(text, 30, ok, cancel);
      function ok() {
        hmtg.jnkernel.jn_command_UserContinue();
      }
      function cancel() {
        hmtgHelper.inside_angular++;
        hmtg.jnkernel.jn_command_UserCancel();
        hmtgHelper.inside_angular--;
      }
    }

    jnkernel['jn_callback_WaitForResponse'] = function(ownername) {
      var ownername2 = hmtg.util.decodeUtf8(ownername);
      var item = {};
      item['timeout'] = 60;
      item['update'] = function() { return $translate.instant('IDS_WAIT_OWNER_RESPONSE').replace('%1$s', (ownername ? ownername2 : $translate.instant('ID_OWNER'))) };
      item['text'] = item['update']();
      item['type'] = 'success';

      hmtgAlert.update_status_item(item);
    }

    jnkernel['jn_callback_JointBrowsingMode'] = function(mode) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // will be refreshed at the end of the random access or end of file
        playback.queue_has_tab_mode = true;
        playback.queue_tab_mode = mode;
        return;
      }

      $rootScope.$broadcast(hmtgHelper.WM_TAB_MODE, mode);
    }

    jnkernel['jn_callback_SyncFullScreen'] = function(is_fullscreen, view) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // do not follow sync fullscreen during random access
        return;
      }

      $rootScope.$broadcast(hmtgHelper.WM_SYNC_FULLSCREEN, is_fullscreen, view);
    }

    jnkernel['jn_callback_ServerShutdown'] = function() {
      hmtgSound.ShowErrorPrompt(function() { return $translate.instant('IDS_WEBOFFICE_EX_ERROR_SERVER_SHUTDOWN') }, 60);
    }

    jnkernel['jn_callback_PromptPassword'] = function(type) {
      $rootScope.$broadcast(hmtgHelper.WM_PROMPT_PASSWORD, type);
    }

    jnkernel['jn_callback_ReconnectName'] = function(reconnect_name, real_name, ssrc) {
      if(ssrc == -1) {
        reconnectName.remove_reconnect_name(reconnect_name);
      } else {
        reconnectName.update_reconnect_name(reconnect_name, real_name, ssrc, _JoinNet.jnj);
      }
    }

    jnkernel['jn_callback_SelfPictureReady'] = function(ssrc) {
    }

    jnkernel['jn_callback_ForceSync'] = function() {
      board.callback_ForceSync();
    }

    jnkernel['jn_callback_SwapSlide'] = function(m, n) {
      //hmtg.util.log(-2, '******debug, swap ' + m + ' and ' + n);
    }
    jnkernel['jn_callback_MoveSlide'] = function(index, target_pos) {
      //hmtg.util.log(-2, '******debug, move ' + index + ' to ' + target_pos);
    }

    jnkernel['jn_callback_ResetSlidePolling'] = function(index) {
      userlist.callback_ResetSlidePolling(index);
    }

    jnkernel['jn_callback_PollSlideDownloadResult'] = function(result_ssrc, slide_index, result) {
      userlist.callback_PollSlideDownloadResult(result_ssrc, slide_index, result);
    }

    jnkernel['jn_callback_RecordingStatusNotification'] = function() {
      _JoinNet.recording_status = hmtg.jnkernel._jn_iRecordingStatus();
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
    }

    jnkernel['jn_callback_archive_recording'] = function() {
      _JoinNet.archive_status = hmtg.jnkernel._jn_to_archive();
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
    }

    jnkernel['jn_callback_jnr_password_status'] = function(value) {
      _JoinNet.has_jnr_password = value;
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
    }

    jnkernel['jn_callback_PlugInRequestChannelResponse'] = function(error_code, request_id, channel) {
      var array = hmtg.jnkernel._jn_plugin_data();
      var guid = array[channel]._guid_str();

      if(guid == 'E5AF1A56-E29C-4BA6-839A-24C2F30EED02' // shared desktop
        || guid == '4FC0606A-DA4A-423F-A830-AC5D9853C201' // remote control
      ) {
        $rootScope.$broadcast(hmtgHelper.WM_NEW_PLUGIN, error_code, request_id, channel);
      } else {
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_UNKNOWN_PLUGIN').replace('#guid#', guid) }, 30);
      }
    }

    jnkernel['jn_callback_PlugInCloseChannelResponse'] = function(error_code, channel) {
      if(error_code) {
        return;
      }
      $rootScope.$broadcast(hmtgHelper.WM_CLOSE_PLUGIN, channel);
    }

    jnkernel['jn_callback_PlugInSetStaticDataResponse'] = function(error_code, channel, data) {
      if(error_code) {
        return;
      }
      if(!_JoinNet.is_appdata_ready[channel]) return;
      _JoinNet.callback_PlugInSetStaticDataResponse[channel](data);
    }

    jnkernel['jn_callback_PlugInControlChannelData'] = function(data, channel, source_ssrc) {
      if(!_JoinNet.is_appdata_ready[channel]) return;
      _JoinNet.callback_PlugInControlChannelData[channel](data, source_ssrc);
    }

    jnkernel['jn_callback_PlugInPacketRecved'] = function(data, channel, ssrc, prio) {
      if(!_JoinNet.is_appdata_ready[channel]) return;
      _JoinNet.callback_PlugInPacketRecved[channel](data, ssrc, prio);
    }

    jnkernel['jn_callback_VideoSendingStatusNotification'] = function(ssrc) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL && playback.random_access) {
        // random access, 
        // will be refreshed at the end of the random access or end of file
        return;
      }

      userlist.callback_VideoSendingStatusNotification(ssrc);
    }

    jnkernel['jn_callback_WebRTCStatusNotification'] = function(ssrc) {
      userlist.callback_WebRTCStatusNotification(ssrc);
    }

    jnkernel['jn_callback_IsRecvingAudio'] = function() {
      if(hmtg.customization.stop_audio_when_mute && hmtgSound.playback_muted) {
        return 0;
      }
      return 1;
    }

    jnkernel.jn_command_CallbackReady();

    this.update_holder_presetner_tip = function() {
      var old1 = this.holder_tooltip;
      var old2 = this.presenter_tooltip;
      this.holder_tooltip = $translate.instant('ID_HOLDER_TIP1');
      this.presenter_tooltip = '';
      var c = hmtg.jnkernel._jn_iController();
      var flag = hmtg.jnkernel._jn_iControlFlag();
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var action = '';

      if((flag & hmtg.config.CONTROLLER_QUESTION_CONTROL)
        && (flag & hmtg.config.CONTROLLER_POLL)
        && (flag & hmtg.config.CONTROLLER_SYNC)
        && (flag & hmtg.config.CONTROLLER_SYNC_TAB)
        ) {
        action = '' + $translate.instant('ID_CONTROLLER_QUESTION')
          + ', ' + $translate.instant('ID_CONTROLLER_POLL')
          + ', ' + $translate.instant('ID_CONTROLLER_SYNC')
          + ', ' + $translate.instant('ID_CONTROLLER_SYNC_TAB')
          ;
        this.holder_tooltip = $translate.instant('ID_HOLDER_TIP2')
          .replace('#name#', ((c != -1 && a[c]) ? hmtg.util.decodeUtf8(a[c]._szRealName()) : $translate.instant('IDS_UNKNOWN_ERROR')))
          .replace("#action#", action);
        this.presenter_tooltip = $translate.instant('ID_PRESENTER_TIP')
          .replace("#action#", action);
      } else if((flag & hmtg.config.CONTROLLER_QUESTION_CONTROL)
        || (flag & hmtg.config.CONTROLLER_POLL)
        || (flag & hmtg.config.CONTROLLER_SYNC)
        || (flag & hmtg.config.CONTROLLER_SYNC_TAB)
        ) {
        var action2 = '';
        if(flag & hmtg.config.CONTROLLER_QUESTION_CONTROL) {
          action += (action ? ', ' : '') + $translate.instant('ID_CONTROLLER_QUESTION');
        } else {
          action2 += (action2 ? ', ' : '') + $translate.instant('ID_CONTROLLER_QUESTION');
        }
        if(flag & hmtg.config.CONTROLLER_POLL) {
          action += (action ? ', ' : '') + $translate.instant('ID_CONTROLLER_POLL');
        } else {
          action2 += (action2 ? ', ' : '') + $translate.instant('ID_CONTROLLER_POLL');
        }
        if(flag & hmtg.config.CONTROLLER_SYNC) {
          action += (action ? ', ' : '') + $translate.instant('ID_CONTROLLER_SYNC');
        } else {
          action2 += (action2 ? ', ' : '') + $translate.instant('ID_CONTROLLER_SYNC');
        }
        if(flag & hmtg.config.CONTROLLER_SYNC_TAB) {
          action += (action ? ', ' : '') + $translate.instant('ID_CONTROLLER_SYNC_TAB');
        } else {
          action2 += (action2 ? ', ' : '') + $translate.instant('ID_CONTROLLER_SYNC_TAB');
        }

        this.holder_tooltip = $translate.instant('ID_HOLDER_TIP3')
          .replace('#name#', ((c != -1 && a[c]) ? hmtg.util.decodeUtf8(a[c]._szRealName()) : $translate.instant('IDS_UNKNOWN_ERROR')))
          .replace("#action1#", action)
          .replace("#action2#", action2)
          ;
        this.presenter_tooltip = $translate.instant('ID_PRESENTER_TIP')
          .replace("#action#", action);
      } else if(c != -1) {
        this.presenter_tooltip = $translate.instant('ID_PRESENTER_TIP2');
      }

      if(old1 != this.holder_tooltip || old2 != this.presenter_tooltip) {
        setTimeout(function() {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
        }, 0);
      }
    }

    this.test_playback_jnj_or_usingIP = function(jnj) {
      if(!jnjContent.validateJnj(jnj)) {
        return;
      }
      var _ipv4 = '(?:\\d{1,3}\\.){3}\\d{1,3}';
      var _pattern = new RegExp(_ipv4);
      var t = jnjContent.convertJnj(jnj);
      if(_pattern.test(t['ip'])) return true;
      var codetype = t['codetype'];
      if(codetype == 0) {
        return;
      } else if(codetype == 5 || codetype == 15) {
        return true;
      } else if(codetype == 13) {
        var action = t['action'] || 0;
        if(action) {
          return true;
        }
      }
    }

    this.connect = function(jnj, try_saved_visitor_name) {
      this.jnj = hmtg.util.localStorage['last_jnj'] = jnj;

      jnjContent.parseJnj(jnj);
      if(!jnjContent.valid_jnj) {
        hmtg.util.log("invalid jnj");
        return false;
      }

      hmtg.util.log("jnj content:\n" + hmtg.util.decodeUtf8(jnj));
      if(!jnkernel.jn_command_read_jnj(jnjContent)) return false;

      this.resetAutoReconnect();

      $rootScope.$broadcast(hmtgHelper.WM_WORKMODE_CHANGED);
      // reset vars for new meeting/jnj
      audio_codec.launch_from_jnj();
      video_codec.launch_from_jnj();
      video_playback.launch_from_jnj();
      browser.reset();
      $rootScope.$broadcast(hmtgHelper.WM_RESET_SESSION);
      hmtgAlert.update_status_item({});

      var userid = jnkernel.jn_info_GetWebOfficeVisitorTargetID();
      var ownerid = jnkernel.jn_info_GetWebOfficeOwnerTargetID();
      if(userid) {
        var s = hmtg.util.localStorage['hmtg_saved_visitor_name'];
        if(try_saved_visitor_name && s) {
          hmtg.util.localStorage['hmtg_visitor_name'] = s;
          hmtg.jnkernel.jn_command_WebOfficeSetVisitorName(hmtg.util.encodeUtf8(s));
          hmtg.jnkernel.jn_command_QuitConnection(); // to stop previous session if necessary
          hmtg.jnkernel.jn_command_initconnectmedia();
          hmtgHelper.snapshot_count = 1;
        } else {
          joinnetHelper.prompt_for_visitor_info(userid);
        }
      } else if(ownerid) {
        joinnetHelper.prompt_for_visitor_info(ownerid, true, 1);
      } else {
        jnkernel.jn_command_QuitConnection(); // to stop previous session if necessary
        jnkernel.jn_command_initconnectmedia();
        hmtgHelper.snapshot_count = 1;
      }
      return true;
    };

  }
])

.controller('JoinnetCtrl', ['$scope', 'jnjContent', 'JoinNet', '$translate', '$rootScope', 'hmtgHelper', '$modal', 'userlist',
    'chat', 'board', 'browser', 'joinnetHelper', 'appSetting', 'statistics', '$ocLazyLoad', 'joinnetAudio', 'joinnetVideo',
    'video_recving', 'video_playback', 'joinnetTranscoding', 'hmtgSound', 'hmtgAlert', 'video_bitrate', 'main_video_canvas',
    'audio_playback', 'mediasoupWebRTC', 'layout',
  function($scope, jnjContent, JoinNet, $translate, $rootScope, hmtgHelper, $modal, userlist, chat, board,
    browser, joinnetHelper, appSetting, statistics, $ocLazyLoad, joinnetAudio, joinnetVideo, video_recving, video_playback,
    joinnetTranscoding, hmtgSound, hmtgAlert, video_bitrate, main_video_canvas, audio_playback, mediasoupWebRTC,
    layout) {
    $scope.jn = JoinNet;
    $scope.ct = chat;
    $scope.as = appSetting;
    $scope.ul = userlist;
    $scope.lo = layout;
    $scope.v2 = video_bitrate;
    $scope.vr = video_recving;
    $scope.hmtg = hmtg;

    $scope.can_show_badge = function() {
      return hmtg.jnkernel._jn_bConnected() || (typeof hmtg.jnkernel._jn_iWorkMode() != 'undefined' && (hmtg.jnkernel._jn_bConnecting() || jnjContent.valid_jnj));
    }

    // concise layout related code
    $scope.show_concise_full_toolbar = true;
    $scope.toggle_concise_mode = function() {
      $rootScope.gui_mode = $rootScope.gui_mode == 'concise' ? '' : 'concise';
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_LAYOUT_MODE);
      if($rootScope.gui_mode == 'concise') {
        $scope.loadVideoWindow();
        // $scope.track_mouse_move();

        // when float video is used concise layout, set display size to ~100
        // if(layout.is_video_visible) {
        //   layout.set_fixed_video_display_size();
        // }
      } else {
        // $scope.untrack_mouse_move();
        // when changing to non-concise mode, the video window display size may need
        // be adjusted from 100 to auto-calculated value
        video_recving.display_size = Math.min(640, hmtgHelper.calcGalleryDisplaySize(video_recving.ssrc_array.length));
      }
    }

    // var auto_hide_navbar_timerID = null;
    // function turn_off_auto_hide_navbar_timer() {
    //   if(auto_hide_navbar_timerID) {
    //     clearTimeout(auto_hide_navbar_timerID);
    //     auto_hide_navbar_timerID = null;
    //   }
    // }
    $scope.turn_on_auto_hide_navbar_timer = function() {
      // turn_off_auto_hide_navbar_timer();
      // auto_hide_navbar_timerID = setTimeout(function() {
      //   auto_hide_navbar_timerID = null;
      //   if($rootScope.gui_mode == 'concise') {
      //     if(layout.is_navbar_visible) {
      //       layout.is_navbar_visible = false;
      //       $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
      //     }
      //   }
      // }, 15000);
    }
    // var delayedShowupTimerID = null;
    // var onMouseMove = function(e) {
    //   if($rootScope.gui_mode != 'concise') {
    //     $scope.untrack_mouse_move();
    //     return;
    //   }

    //   // when in concise mode
    //   // if the navbar is visible and the auto hide timer is on
    //   // refresh the timer when the mouse is moving
    //   if(auto_hide_navbar_timerID && layout.is_navbar_visible) {
    //     $scope.turn_on_auto_hide_navbar_timer(); // refresh the auto hide timer
    //     return;
    //   }

    //   //console.log('pageX=' + e.pageX + '; pageY=' + e.pageY + '; width=' + hmtgHelper.view_port_width + '; height=' + hmtgHelper.view_port_height);
    //   if(e.pageX < 40 && e.pageY > hmtgHelper.view_port_height - 35) {
    //     // the reason to use 100ms timeout here:
    //     // on mobile browser, when the user clicks the area near the bottom
    //     // a mousemove may be triggered first, and then a mousedown.
    //     // the combined effect is:
    //     // the toolbar show up, and then the button underneath is immediately clicked
    //     // using a timeout avoid this unwanted click
    //     if(delayedShowupTimerID) {
    //       clearTimeout(delayedShowupTimerID);
    //     }
    //     delayedShowupTimerID = setTimeout(function() {
    //       delayedShowupTimerID = null;
    //       if($rootScope.gui_mode == 'concise' && !layout.is_navbar_visible) {
    //         layout.is_navbar_visible = true;
    //         $scope.turn_on_auto_hide_navbar_timer();
    //         $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
    //       }
    //     }, 100)
    //   }
    // }
    // $scope.track_mouse_move = function() {
    //   //$scope.untrack_mouse_move();
    //   //document.addEventListener('mousemove', onMouseMove, true);
    // }

    // $scope.untrack_mouse_move = function() {
    //   //document.removeEventListener('mousemove', onMouseMove, true);
    // }

    $scope.is_concise_toolbar_tall = function() {
      var elem1 = document.getElementById('concise_tool_first');
      var elem2 = document.getElementById('concise_tool_container');

      if(!elem1 || !elem2) {
        return false;
      }
      var height1 = elem1.offsetHeight;
      var height2 = elem2.offsetHeight;
      return height2 > height1;
    }

    $scope.style_concise_toolbar = function() {
      var elem1 = document.getElementById('concise_tool_first');
      var elem2 = document.getElementById('concise_tool_container');
      
      if(!elem1 || !elem2) {
        return;
      }
      var pos = 0;

      if(!$scope.show_concise_full_toolbar) {
        var height1 = elem1.offsetHeight;
        var height2 = elem2.offsetHeight;
        //console.log('height1=' + height1 + ';height2=' + height2);
        if(height2 > height1) {
          pos = height1 - height2;
        }
      }

      return {
        'bottom': '' + (pos) + 'px'
      };
    }

    $scope.class_concise_video = function() {
      if($rootScope.gui_mode == 'concise') {
        return layout.is_gallery_visible ? '' : 'concise_float_video';
      } else {
        return $scope.col_area('video');
      }
    }

    $scope.style_nav_bar_menu = function() {
      if($rootScope.gui_mode == 'concise') {
        var base = 40;
        var elem1 = document.getElementById('concise_tool_first');
        var elem2 = document.getElementById('concise_tool_container');

        if(elem1 && elem2) {
          if($scope.show_concise_full_toolbar) {
            base = elem2.offsetHeight;
          } else {
            base = elem1.offsetHeight;
          }
        }
        return {
          'overflow-y': 'auto',
          'max-height': '' + Math.max(50, hmtgHelper.view_port_height - base) + 'px'
        };
      } else {
        return;
      }
    }

    $scope.is_video_container_visible = function() {
      if($rootScope.gui_mode == 'concise') {
        return layout.is_gallery_visible;
        // return layout.is_video_visible || layout.is_gallery_visible;
      } else {
        return $scope.is_area_visible('video');
      }
    }

    $scope.onConciseShow = function() {
      if(!layout.is_navbar_visible) {
        $scope.show_concise_full_toolbar = true;
        setTimeout(function() { 
          $scope.$digest(); // force style_concise_toolbar()
        }, 100);
        layout.is_navbar_visible = true;
        // $scope.turn_on_auto_hide_navbar_timer();
      }
    }

    $scope.onConciseHide = function() {
      layout.is_navbar_visible = false;
      // if(delayedShowupTimerID) {
      //   clearTimeout(delayedShowupTimerID);
      //   delayedShowupTimerID = null;
      // }
      /*
      $scope.untrack_mouse_move();
      setTimeout(function() {
        if($rootScope.gui_mode == 'concise') {
          $scope.track_mouse_move();
        }
      }, 5000)
      */
    }

    $scope.onConciseBoard = function() {
      layout.visible_area = layout.visible_area == 'white_board' ? 'userlist' : 'white_board';
      layout.is_gallery_visible = false;
      layout.is_userlist_visible = false;
      layout.is_textchat_visible = false;
      update_tab_mode(layout.visible_area);
    }

    $scope.onConciseSDT = function() {
      $scope.loadSDT();
      layout.visible_area = layout.visible_area == 'sdt' ? 'userlist' : 'sdt';
      layout.is_gallery_visible = false;
      layout.is_userlist_visible = false;
      layout.is_textchat_visible = false;
      update_tab_mode(layout.visible_area);
    }

    $scope.onConciseRDC = function() {
      $scope.loadRDC();
      layout.visible_area = layout.visible_area == 'rdc' ? 'userlist' : 'rdc';
      layout.is_gallery_visible = false;
      layout.is_userlist_visible = false;
      layout.is_textchat_visible = false;
      update_tab_mode(layout.visible_area);
    }

    $scope.onConciseBrowser = function() {
      $scope.loadBrowser();
      layout.visible_area = layout.visible_area == 'browser' ? 'userlist' : 'browser';
      layout.is_gallery_visible = false;
      layout.is_userlist_visible = false;
      layout.is_textchat_visible = false;
      update_tab_mode(layout.visible_area);
    }

    $scope.onConciseUserList = function() {
      layout.is_userlist_visible = !layout.is_userlist_visible;
      if(layout.is_userlist_visible) {
        layout.visible_area = 'userlist';
        layout.is_gallery_visible = false;
        update_tab_mode(layout.visible_area);
      }
      layout.is_textchat_visible = false;
      // layout.is_video_visible = false;
    }

    $scope.onConciseTextChat = function() {
      layout.is_textchat_visible = !layout.is_textchat_visible;
      if(layout.is_textchat_visible) {
        layout.visible_area = 'userlist';
        layout.is_gallery_visible = false;
        update_tab_mode(layout.visible_area);
      }
      layout.is_userlist_visible = false;
      // layout.is_video_visible = false;
    }

    $scope.onConciseVideo = function() {
      // layout.is_video_visible = !layout.is_video_visible;
      // if(layout.is_video_visible) {
      //   layout.is_gallery_visible = false;
      // }
      // layout.is_userlist_visible = false;
      // layout.is_textchat_visible = false;

      // if(layout.is_video_visible) {
      //   layout.set_fixed_video_display_size();
      // }
    }

    $scope.onConciseGallery = function() {
      layout.is_gallery_visible = !layout.is_gallery_visible;
      layout.visible_area = 'userlist';
      // layout.is_video_visible = false;
      layout.is_userlist_visible = false;
      layout.is_textchat_visible = false;

      if(layout.is_gallery_visible) {
        // change display size from 100 to gallery value
        video_recving.display_size = hmtgHelper.calcGalleryDisplaySize(video_recving.ssrc_array.length);
      }
      update_tab_mode(layout.visible_area);
    }

    $scope.$on(hmtgHelper.WM_CONCISE_TAB_CHANGED, function() {
      update_tab_mode(layout.visible_area);
    });

    //hmtgSound.refresh_device_list();

    function adjust_height() {
      if(board.is_fullscreen || browser.is_fullscreen)
        $scope.style_height = { 'height': '' + Math.max(10, hmtgHelper.view_port_height - 70) + 'px' };
      else
        $scope.style_height = { 'height': '' + Math.min(hmtgHelper.view_port_height * 0.9, Math.max(10, hmtgHelper.view_port_height - 70)) + 'px' };
      $scope.style_half_height = { 'max-height': '' + Math.max(240, (hmtgHelper.view_port_height >> 1)) + 'px' };
      if(board.is_fullscreen || browser.is_fullscreen)
        $scope.style_max_height = { 'max-height': '' + (hmtgHelper.view_port_height) + 'px' };
      else {
        // restricted_height is also used in board.decide_min_size(). should use the same parameters
        var restricted_height = Math.max(hmtgHelper.view_port_height * 0.5, hmtgHelper.view_port_height - 203);
        $scope.style_max_height = { 'max-height': '' + (restricted_height) + 'px' };
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    }
    $scope.$on(hmtgHelper.WM_HEIGHT_CHANGED, adjust_height);

    $scope.last_work_mode = -1;
    $scope.w = {};
    // when the width is large enough to show two areas
    // this flag decide whether to show one or two areas
    // when set to true, show two areas if width is large enough
    // when set to false, only show one area
    $scope.w.show_area2 = true;
    // whether it is able to show two area or only show one area
    // this is determined by the screen width
    // larger width give the user option to show one or two areas
    // smaller width will force to only show one area
    $scope.w.show_check_show_area2 = true;  
    JoinNet.is_chat_area_visible = false;
    $scope.w.ratio = '1.1';
    // meeting
    $scope.areas0 = [
      { id: 'userlist', name: 'userlist' },
      { id: 'statistics', name: 'statistics' },
      { id: 'chat', name: 'chat' },
      { id: 'video', name: 'video' },
      { id: 'white_board', name: 'white board' },
      { id: 'sdt', name: 'desktop sharing' },
      { id: 'rdc', name: 'remote control' }
    ];
    if(hmtg.customization.support_joint_browsing) {
      $scope.areas0.push({ id: 'browser', name: 'browser' });
    }
    $scope.area_idx0 = {
      'userlist': 0,
      'statistics': 1,
      'chat': 2,
      'video': 3,
      'white_board': 4,
      'sdt': 5,
      'rdc': 6
    };
    if(hmtg.customization.support_joint_browsing) {
      $scope.area_idx0['browser'] = 7;
    }

    // playback
    $scope.areas1 = [
      { id: 'userlist', name: 'userlist' },
      { id: 'statistics', name: 'statistics' },
      { id: 'jnr', name: 'jnr' },
      { id: 'chat', name: 'chat' },
      { id: 'video', name: 'video' },
      { id: 'white_board', name: 'white board' },
      { id: 'sdt', name: 'desktop sharing' },
      { id: 'rdc', name: 'remote control' }
    ];
    if(hmtg.customization.support_joint_browsing) {
      $scope.areas1.push({ id: 'browser', name: 'browser' });
    }
    $scope.area_idx1 = {
      'userlist': 0,
      'statistics': 1,
      'jnr': 2,
      'chat': 3,
      'video': 4,
      'white_board': 5,
      'sdt': 6,
      'rdc': 7
    };
    if(hmtg.customization.support_joint_browsing) {
      $scope.area_idx1['browser'] = 8;
    }
    update_components();
    update_area_name();
    $scope.$watch('w.area1', switch_area);
    $scope.$watch('w.area2', switch_area);
    function switch_area(newValue, oldValue) {
      //console.log('******debug, area-tracking, user action, area1=' + $scope.w.area1 + '; area2=' + $scope.w.area2);
      // hack
      // always use baloon to alert received chat text
      //JoinNet.is_chat_area_visible = $scope.is_area_visible('chat') || $scope.is_area_visible('userlist');
      statistics.active = $scope.is_area_visible('statistics');
      if(newValue == 'statistics') $scope.loadStat();
      else if(newValue == 'jnr') $scope.loadJNR();
      else if(newValue == 'userlist' || newValue == 'chat') $scope.loadChat();
      else if(newValue == 'video') $scope.loadVideoWindow();
      else if(newValue == 'browser') $scope.loadBrowser();
      else if(newValue == 'sdt') $scope.loadSDT();
      else if(newValue == 'rdc') $scope.loadRDC();
      if($scope.area_idx[$scope.w.area1] > $scope.area_idx[$scope.w.area2]) {
        if($scope.w.show_check_show_area2 && $scope.w.show_area2) {
          var t = $scope.w.area1;
          $scope.w.area1 = $scope.w.area2;
          //console.log('******debug, area-tracking, switch_area,1, area1=' + $scope.w.area1);
          setTimeout(function() {
            $scope.w.area2 = t;
            //console.log('******debug, area-tracking, switch_area,2, area2=' + $scope.w.area2);
            $scope.$digest();
          }, 0);
        } else {
          $scope.w.area2 = $scope.w.area1;
          //console.log('******debug, area-tracking, switch_area,3, area2=' + $scope.w.area2);
        }
      }
      update_tab_mode(newValue);
      if(board.is_fit_page) {
        setTimeout(function() {
          board.draw_slide();
        }, 0);
      }
    }

    $scope.$watch('w.show_area2', function() {
      if(!$scope.w.show_area2) {
        $scope.w.area1 = $scope.w.area2;
        //console.log('******debug, area-tracking, watch,1, area1=' + $scope.w.area1);
        //update_tab_mode($scope.w.area1);
      } else {
        $scope.w.area2 = $scope.w.area1;
        if($scope.w.area1 != 'userlist' && $scope.w.area1 != 'statistics') {
          $scope.w.area1 = 'userlist';
        }  
        if($scope.w.area1 == $scope.w.area2) {
          $scope.w.area2 = 'white_board';
        }
        //console.log('******debug, area-tracking, watch,2, area1=' + $scope.w.area1 + '; area2=' + $scope.w.area2);
      }
      if(board.is_fit_page) {
        setTimeout(function() {
          // simple draw_slide is not good enough
          // change to broadcast WM_WIDTH_CHANGED
          // the difference is that the WM_WIDTH_CHANGED handler also handle width height ratio change
          $rootScope.$broadcast(hmtgHelper.WM_WIDTH_CHANGED);
          //board.draw_slide();
        }, 0);
      }
    });
    var last_mode = -1;
    var update_tab_mode_timer = null;
    function update_tab_mode(newValue) {
      var mode = -1;
      if(newValue == 'white_board') mode = 0;
      else if(newValue == 'browser') mode = 1;
      else if(newValue == 'sdt') mode = 2;
      else if(newValue == 'rdc') mode = 3;
      else if(newValue == 'userlist') mode = 4;
      if(mode != -1 && mode != last_mode) {
        last_mode = mode;
        if(update_tab_mode_timer) clearTimeout(update_tab_mode_timer);
        update_tab_mode_timer = setTimeout(function() {
          update_tab_mode_timer = null;
          if(hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
            if(mode == 3 && appSetting.remote_monitor_mode) { // do nothing in this case
            } else {
              var sync_tab_controller = hmtg.jnkernel._tab_ssrc();
              var my_ssrc = hmtg.jnkernel._jn_ssrc_index();

              if(sync_tab_controller == my_ssrc) {
                hmtg.jnkernel.jn_command_JointBrowsingMode(mode);
              }
            }
          }
        }, 100);
      }
    }
    $scope.ratios = [
      { id: '3.1', name: '3 : 1' },
      { id: '2.1', name: '2 : 1' },
      { id: '1.1', name: '1 : 1' },
      { id: '1.2', name: '1 : 2' },
      { id: '1.3', name: '1 : 3' }
    ];

    $scope.col_entry1 = {
      '3.1': 'col-xs-9',
      '2.1': 'col-xs-8',
      '1.1': 'col-xs-6',
      '1.2': 'col-xs-4',
      '1.3': 'col-xs-3'
    };

    $scope.col_entry2 = {
      '3.1': 'col-xs-3',
      '2.1': 'col-xs-4',
      '1.1': 'col-xs-6',
      '1.2': 'col-xs-8',
      '1.3': 'col-xs-9'
    };

    $scope.col_value1 = 6;

    $scope.is_area_visible = function(target) {
      if($rootScope.gui_mode == 'concise') {
        if(layout.is_gallery_visible) {
          return false;
        } else {
          return target == layout.visible_area;
        }
      }
      return $scope.w.area1 == target || ($scope.w.show_check_show_area2 && $scope.w.show_area2 && $scope.w.area2 == target);
    }
    $scope.col_area = function(target) {
      if(!$scope.is_area_visible(target)) return '';
      if(board.is_fullscreen || browser.is_fullscreen) return '';
      if($rootScope.gui_mode == 'concise') return '';
      if(!$scope.w.show_check_show_area2 || !$scope.w.show_area2 || $scope.w.area2 == $scope.w.area1) return '';
      //if($scope.w.area1 == target) return $scope.col_entry1[$scope.w.ratio];
      //if($scope.w.area2 == target) return $scope.col_entry2[$scope.w.ratio];
      if($scope.w.area1 == 'userlist') {
        if($scope.w.area1 == target) return 'col-xs-' + $scope.col_value1;
        if($scope.w.area2 == target) return 'col-xs-' + (12 - $scope.col_value1);
      } else {
        return 'col-xs-6';
      }
      return '';
    }
    $scope.row_fluid = function() {
      if(!$scope.w.show_check_show_area2 || !$scope.w.show_area2 || $scope.w.area2 == $scope.w.area1) return '';
      return 'row-fluid';
    }
    $scope.container_fluid = function() {
      if($rootScope.gui_mode == 'concise') return '';
      return 'container-fluid';
    }

    function adjust_width() {
      var fullscreenElement = document.fullscreenElement
        || document.mozFullScreenElement
        || document.webkitFullscreenElement
        || document.msFullscreenElement
        ;
      // in full screen mode, do not adjust component number and layout
      // the adjustment may cause the fullscreen element hidden and no response GUI
      // instead, turn on the flag and execute the adjustment after exiting the fullscreen
      if(fullscreenElement) {
        $scope.to_adjust_width_after_existing_fullscreen = true;
        return;
      }

      if($rootScope.gui_mode == 'concise'
        && $rootScope.nav_item == 'joinnet'
        && layout.is_navbar_visible
        && !$scope.show_concise_full_toolbar
      ) {
        // to refresh the one-line toolbar display
        setTimeout(function() {
          $rootScope.$digest();
        }, 1);
      }

      var min_width = Math.max(320, (main_video_canvas.display_size >> 0) + 36) - 1;

      var value = ((min_width * 12 / hmtgHelper.view_port_width) >>> 0) + 1;
      $scope.col_value1 = Math.max(2, Math.min(6, value));

      var changed = false;      
      if(hmtgHelper.view_port_width >= 480) {
        if(!$scope.w.show_check_show_area2) {
          changed = true;
          $scope.w.show_check_show_area2 = true;
          if($scope.w.show_area2) {
            $scope.w.area2 = $scope.w.area1;
            if($scope.w.area1 != 'userlist' && $scope.w.area1 != 'statistics') {
              $scope.w.area1 = 'userlist';
            }
            if($scope.w.area1 == $scope.w.area2) {
              $scope.w.area2 = 'white_board';
            }
            //console.log('******debug, area-tracking, adjust_width,1, area1=' + $scope.w.area1 + '; area2=' + $scope.w.area2);
          }
        }  
      } else {
        if($scope.w.show_check_show_area2) {
          changed = true;
          $scope.w.show_check_show_area2 = false;
          if($scope.w.show_area2) {
            $scope.w.area1 = $scope.w.area2;
            //console.log('******debug, area-tracking, adjust_width,2, area1=' + $scope.w.area1);
          }
        }  
      }

      if(changed && $rootScope.nav_item == 'joinnet') {
        if(!hmtgHelper.inside_angular) {
          $scope.$digest();
        }
        // the following delayed $digest is necessary for mobile chrome
        // otherwise the <div> width of 2nd area will not be updated in the following sequence
        // open web joinnet =>
        // change to joinnet =>
        // rotate screen to landscape(show two areas) =>
        // rotate screen to portrait(show one area)
        // at this momoment, the <div> of the one are will be only half the screen width
        // the delayed $digest can get around it
        setTimeout(function() { 
          $rootScope.$digest();
        }, 1);  // 2019-05-05, change from 0 to 1. when using 0, firefox android will have minor problem when the user stays at non-control panel in the last instance
      }  
    }
    $scope.$on(hmtgHelper.WM_FULLSCREEN_CHANGED, function() {
      var fullscreenElement = document.fullscreenElement
        || document.mozFullScreenElement
        || document.webkitFullscreenElement
        || document.msFullscreenElement
        ;
      // if exiting fullscreen and the flag to adjust width is on
      // do the adjustment now
      if(!fullscreenElement && $scope.to_adjust_width_after_existing_fullscreen) {
        adjust_width();
      }
      // clear the flag when fullscreen mode changes, either ON or OFF
      $scope.to_adjust_width_after_existing_fullscreen = false; // reset this
    });
    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, adjust_width);
    $scope.$on(hmtgHelper.WM_SHOW_CHAT_AREA, function() {
      $rootScope.nav_item = 'joinnet';
      $rootScope.tabs[2].active = true;
      if(!$scope.is_area_visible('chat')) {
        show_area('chat');
      }
      if($rootScope.gui_mode == 'concise') {
        if(!layout.is_textchat_visible) {
          layout.is_textchat_visible = true;
          layout.visible_area = 'userlist';
          layout.is_gallery_visible = false;
          layout.is_userlist_visible = false;
          // layout.is_video_visible = false;
          update_tab_mode(layout.visible_area);
        }
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_CHAT, true);
    });
    $scope.$on(hmtgHelper.WM_SHOW_CONTROL_PANEL, function() {
      $rootScope.nav_item = 'joinnet';
      $rootScope.tabs[2].active = true;
      if(!$scope.is_area_visible('userlist')) {
        show_area('userlist');
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_SHOW_WHITE_BOARD, function() {
      $rootScope.nav_item = 'joinnet';
      $rootScope.tabs[2].active = true;
      if(!$scope.is_area_visible('white_board')) {
        show_area('white_board');
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_REMOTE_MONITOR, function() {
      $rootScope.nav_item = 'joinnet';
      $rootScope.tabs[2].active = true;
      if(!$scope.is_area_visible('rdc')) {
        show_area('rdc');
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_START_SESSION, function() {
      show_area('userlist');
      layout.is_userlist_visible = false;
      layout.is_textchat_visible = false;
      layout.is_video_visible = false;
      layout.is_gallery_visible = false;
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_TAB_MODE, function(event, mode) {
      var target_area = '';
      switch(mode) {
        case 0:
          target_area = 'white_board';
          break;
        case 1:
          target_area = hmtg.customization.support_joint_browsing ? 'browser' : 'chat';
          break;
        case 2:
          target_area = 'sdt';
          break;
        case 3:
          target_area = 'rdc';
          break;
        case 4:
          target_area = 'userlist';
          break;
        default:
          return;
      }
      if(!JoinNet.net_init_finished
        && ($rootScope.gui_mode == 'concise' || !$scope.w.show_check_show_area2 || !$scope.w.show_area2)) {
        // for concise mode or one area mode, ignore the first mode update, which is white board or joint browsing, which is configured in configm.ini
        return;
      }
      if(!$scope.is_area_visible(target_area)) {
        if(!appSetting.auto_follow_tab) {
          // no follow tab prompt in concise layout
          if($rootScope.gui_mode == 'concise'
            && target_area != 'white_board'
            && target_area != 'userlist'
            && target_area != 'sdt'
            && target_area != 'rdc'
            && target_area != 'browser'
          ) return;

          var item = {};
          item['timeout'] = 5;
          item['update'] = function() { return $translate.instant('ID_FOLLOW_TAB_PROMPT') };
          item['text'] = item['update']();
          item['type'] = 'info';
          item['click'] = function(index) {
            appSetting.auto_follow_tab = true;

            hmtgHelper.inside_angular++;
            hmtgAlert.click_link(index);
            hmtgHelper.inside_angular--;
          };

          hmtgAlert.add_link_item(item);
          return;
        }
        show_area(target_area);
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $rootScope.$on('$translateChangeEnd', function() {
      update_area_name();
      JoinNet.update_holder_presetner_tip();
      if(JoinNet.jnr_decryption_func) JoinNet.jnr_decryption_text = JoinNet.jnr_decryption_func();
    });
    $scope.$on(hmtgHelper.WM_UPDATE_MONITOR_MODE, function() {
      update_area_name();
    });

    $scope.show_control_panel = function() {
      if(!$scope.is_area_visible('userlist')) {
        show_area('userlist');
      }
    }

    function update_components() {
      var workmode = hmtg.jnkernel._jn_iWorkMode();
      if(workmode != $scope.last_work_mode) {
        $scope.last_work_mode = workmode;
        if(workmode == hmtg.config.NORMAL) {
          $scope.areas = $scope.areas0;
          $scope.area_idx = $scope.area_idx0;
        } else {
          $scope.areas = $scope.areas1;
          $scope.area_idx = $scope.area_idx1;
        }
        $scope.w.area1 = 'userlist';
        $scope.w.area2 = 'white_board';
        //console.log('******debug, area-tracking, update_components, area1=userlist, area2=white_board');
      }
    }

    function show_area(target) {
      if($rootScope.nav_item == 'joinnet') {
        hmtgHelper.exitFullScreen();
      }
      if($rootScope.gui_mode == 'concise') {
        if((target == 'browser' && !hmtg.customization.support_joint_browsing)
          || target == 'chat'
          ) {
          layout.visible_area = 'userlist';
          layout.is_textchat_visible = true;
          layout.is_gallery_visible = false;
          layout.is_userlist_visible = false;
        } else if(target == 'userlist'
          || target == 'white_board'
          || target == 'sdt'
          || target == 'rdc'
          || target == 'browser'
          ) {
          layout.visible_area = target;
          if(target != 'userlist') {
            layout.is_gallery_visible = false;
            layout.is_userlist_visible = false;
            layout.is_textchat_visible = false;
          }
        }
      }
      if($scope.w.show_check_show_area2 && $scope.w.show_area2) {
        if(target == $scope.w.area1 || target == $scope.w.area2) {
          return;
        } else if($scope.area_idx[target] < $scope.area_idx[$scope.w.area1]) {
          $scope.w.area1 = target;
          //console.log('******debug, area-tracking, show_area,1, area1=' + $scope.w.area1);
        } else {
          $scope.w.area2 = target;
          //console.log('******debug, area-tracking, show_area,2, area2=' + $scope.w.area2);
        }
      } else {
        if($scope.w.area1 == target) return;
        $scope.w.area1 = target;
        //console.log('******debug, area-tracking, show_area,3, area1=' + $scope.w.area1);
        if($scope.area_idx[$scope.w.area1] > $scope.area_idx[$scope.w.area2]) {
          $scope.w.area2 = $scope.w.area1;
          //console.log('******debug, area-tracking, show_area,4, area2=' + $scope.w.area2);
        }
      }
    }

    $scope.$on(hmtgHelper.WM_WORKMODE_CHANGED, function() {
      update_components();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    function update_area_name() {
      // meeting
      $scope.areas0[$scope.area_idx0['statistics']].name = $translate.instant('ID_STATISTICS');
      $scope.areas0[$scope.area_idx0['userlist']].name = $translate.instant('ID_CONTROL_PANEL');
      $scope.areas0[$scope.area_idx0['chat']].name = $translate.instant('ID_TEXT_CHAT');
      $scope.areas0[$scope.area_idx0['video']].name = $translate.instant('ID_VIDEO_WINDOW');
      $scope.areas0[$scope.area_idx0['white_board']].name = $translate.instant('ID_WHITE_BOARD');
      if(hmtg.customization.support_joint_browsing) {
        $scope.areas0[$scope.area_idx0['browser']].name = $translate.instant('IDS_JOINT_WEB_BROWSING');
      }
      $scope.areas0[$scope.area_idx0['sdt']].name = $translate.instant('ID_DESKTOP_SHARING');
      var to_show_monitor = false;
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL && appSetting.remote_monitor_mode) {
        var sync_tab_controller = hmtg.jnkernel._tab_ssrc();
        var is_sync_tab_controller = sync_tab_controller != -1 && sync_tab_controller == hmtg.jnkernel._jn_ssrc_index();
        if(is_sync_tab_controller) to_show_monitor = true;
      }
      $scope.areas0[$scope.area_idx0['rdc']].name = $translate.instant(to_show_monitor ? 'ID_REMOTE_MONITOR' : 'ID_REMOTE_CONTROL');

      // playback
      $scope.areas1[$scope.area_idx1['statistics']].name = $translate.instant('ID_STATISTICS');
      $scope.areas1[$scope.area_idx1['userlist']].name = $translate.instant('ID_CONTROL_PANEL');
      $scope.areas1[$scope.area_idx1['chat']].name = $translate.instant('ID_TEXT_CHAT');
      $scope.areas1[$scope.area_idx1['video']].name = $translate.instant('ID_VIDEO_WINDOW');
      $scope.areas1[$scope.area_idx1['white_board']].name = $translate.instant('ID_WHITE_BOARD');
      if(hmtg.customization.support_joint_browsing) {
        $scope.areas1[$scope.area_idx1['browser']].name = $translate.instant('IDS_JOINT_WEB_BROWSING');
      }
      $scope.areas1[$scope.area_idx1['sdt']].name = $translate.instant('ID_DESKTOP_SHARING');
      $scope.areas1[$scope.area_idx1['rdc']].name = $translate.instant('ID_REMOTE_CONTROL');
    }

    function on_tab_ssrc_change() {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
      if(appSetting.remote_monitor_mode) {
        update_area_name();
      }
    }
    $scope.$on(hmtgHelper.WM_TOKEN_STATUS_CHANGED, on_tab_ssrc_change);
    $scope.$on(hmtgHelper.WM_CONTROLLER_STATUS_CHANGED, on_tab_ssrc_change);

    $scope.can_disconnect = function() {
      return hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting();
    }
    $scope.can_reconnect = function() {
      return !(hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting()) && jnjContent.valid_jnj;
    }

    // jnj
    $scope.jnj = hmtg.util.decodeUtf8(jnjContent.jnj);
    $scope.valid_jnj = jnjContent.valid_jnj;
    $scope.jnj_name = 'joinnet-' + hmtg.util.app_id + '.jnj';
    $scope.blob = null;
    $scope.jnj_href_need_revoke = false;
    if(window.URL && jnjContent.jnj) {
      $scope.blob = new Blob([jnjContent.jnj], { type: hmtgHelper.isiOS ? 'text/plain' : 'application/joinnet' });
      $scope.jnj_href = window.URL.createObjectURL($scope.blob);
      $scope.jnj_href_need_revoke = true;
      //hmtg.util.log($scope.jnj_href);
    } else {
      $scope.jnj_href = 'data:application/joinnet;base64,' + hmtg.util.encode64(jnjContent.jnj);
      $scope.jnj_href_need_revoke = false;
    }
    $scope.switch_to_download = function() {
      appSetting.switch_to_download();
    }
    $scope.launch_native = function() {
      if(window.navigator.msSaveOrOpenBlob && $scope.blob) {
        window.navigator.msSaveOrOpenBlob($scope.blob, $scope.jnj_name);
      }
    }


    $scope.status = 'ready';

    $scope.$watch(function() { return jnjContent.valid_jnj; }, function() {
      $scope.jnj = hmtg.util.decodeUtf8(jnjContent.jnj);
      $scope.valid_jnj = jnjContent.valid_jnj;
      if(window.URL && jnjContent.jnj) {
        if($scope.jnj_href && $scope.jnj_href_need_revoke) window.URL.revokeObjectURL($scope.jnj_href);
        $scope.blob = new Blob([jnjContent.jnj], { type: hmtgHelper.isiOS ? 'text/plain' : 'application/joinnet' });
        $scope.jnj_href = window.URL.createObjectURL($scope.blob);
        $scope.jnj_href_need_revoke = true;
        //hmtg.util.log($scope.jnj_href);
      } else {
        $scope.jnj_href = 'data:application/joinnet;base64,' + hmtg.util.encode64(jnjContent.jnj);
        $scope.jnj_href_need_revoke = false;
      }
    });

    $scope.$watch(function() { return jnjContent.jnj; }, function() {
      $scope.jnj = hmtg.util.decodeUtf8(jnjContent.jnj);
      $scope.valid_jnj = jnjContent.valid_jnj;
      if(window.URL && jnjContent.jnj) {
        if($scope.jnj_href && $scope.jnj_href_need_revoke) window.URL.revokeObjectURL($scope.jnj_href);
        $scope.blob = new Blob([jnjContent.jnj], { type: hmtgHelper.isiOS ? 'text/plain' : 'application/joinnet' });
        $scope.jnj_href = window.URL.createObjectURL($scope.blob);
        $scope.jnj_href_need_revoke = true;
        //hmtg.util.log($scope.jnj_href);
      } else {
        $scope.jnj_href = 'data:application/joinnet;base64,' + hmtg.util.encode64(jnjContent.jnj);
        $scope.jnj_href_need_revoke = false;
      }
    });

    $scope.disconnect = function() {
      hmtgHelper.inside_angular++;
      JoinNet.resetAutoReconnect();
      hmtgHelper.inside_angular--;

      if(!$scope.can_disconnect()) return;

      hmtgHelper.inside_angular++;
      hmtg.jnkernel.jn_command_QuitConnection();
      hmtgHelper.inside_angular--;

      // when manually disconnect, stop audio/video capture
      if(joinnetAudio.recording) {
        $scope.stopAudioRecording();
      }
      if(joinnetVideo.recording) {
        $scope.stopVideoRecording();
      }
    }

    $scope.reconnect = function() {
      hmtgHelper.inside_angular++;
      JoinNet.resetAutoReconnect();
      hmtgHelper.inside_angular--;

      if(!$scope.can_reconnect()) return;

      hmtgHelper.inside_angular++;
      var ownerid = hmtg.jnkernel.jn_info_IsWOOwnerWrongPassword();
      if(ownerid) {
        joinnetHelper.prompt_for_visitor_info(ownerid, true, 1);
      } else {
        hmtg.jnkernel.jn_command_QuitConnection();
        hmtg.jnkernel.jn_command_initconnectmedia(true);
      }
      hmtgHelper.inside_angular--;
    }

    $scope.$on(hmtgHelper.WM_QUIT_SESSION, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.reset = function() {
      hmtg.jnkernel.jn_command_Reset();
      hmtgHelper.inside_angular++;
      JoinNet.resetAutoReconnect();
      hmtgHelper.inside_angular--;

      hmtgHelper.inside_angular++;
      hmtg.jnkernel.jn_command_QuitConnection();
      hmtg.jnkernel.jn_callback_EventStartSession();
      board.reset(true);
      browser.reset();
      userlist.reset();
      hmtgHelper.inside_angular--;
      jnjContent.valid_jnj = false;
      jnjContent.jnj = '';

      // when reset, stop audio/video/screen capture
      if(joinnetAudio.recording) {
        $scope.stopAudioRecording();
      }
      if(joinnetVideo.recording) {
        $scope.stopVideoRecording();
      }
      if(joinnetVideo.screen_recording) {
        $scope.stopScreenRecording();
      }

      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_RESET_SESSION);
      hmtgAlert.update_status_item({});
      hmtgHelper.inside_angular--;

      if(appSetting.remote_monitor_mode) {
        update_area_name();
      }

      if($rootScope.hmtg_show_msgr) {
        $rootScope.nav_item = 'msgr';
        $rootScope.tabs[0].active = true;
      }
    }

    $scope.can_show_playback_button = function() {
      var r = hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.PLAYBACK;
      if(r) {
        $scope.loadPlayback();
      }
      if(JoinNet.jnr_decryption) return false;
      return r;
    }

    $scope.$on(hmtgHelper.WM_RESET_SESSION, function() {
    });

    $scope.$on('$includeContentError', function(e, param) {
      if(param == 'lazy_htm/joinnet_stat.htm' + hmtgHelper.cache_param) $scope.partialStat = '';
      else if(param == 'lazy_htm/joinnet_playback.htm' + hmtgHelper.cache_param) $scope.partialPlayback = '';
      else if(param == 'lazy_htm/joinnet_jnr.htm' + hmtgHelper.cache_param) $scope.partialJNR = '';
      else if(param == 'lazy_htm/joinnet_chat.htm' + hmtgHelper.cache_param) $scope.partialChat1 = $scope.partialChat2 = '';
      else if(param == 'lazy_htm/joinnet_chat2.htm' + hmtgHelper.cache_param) $scope.partialChat1 = $scope.partialChat2 = '';
      else if(param == 'lazy_htm/joinnet_browser.htm' + hmtgHelper.cache_param) $scope.partialBrowser = '';
      else if(param == 'lazy_htm/joinnet_sdt.htm' + hmtgHelper.cache_param) $scope.partialSDT = '';
      else if(param == 'lazy_htm/joinnet_rdc.htm' + hmtgHelper.cache_param) $scope.partialRDC = '';
    });

    $scope.loadStat = function() {
      if($scope.partialStat) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_stat' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialStat = 'lazy_htm/joinnet_stat.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_stat fails');
      });
    }

    $scope.loadPlayback = function() {
      if($scope.partialPlayback) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_playback' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialPlayback = 'lazy_htm/joinnet_playback.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_playback fails');
      });
    }

    $scope.loadJNR = function() {
      if($scope.partialJNR) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_jnr' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialJNR = 'lazy_htm/joinnet_jnr.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_jnr fails');
      });
    }

    $scope.loadChat = function() {
      if($scope.partialChat1) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_chat' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialChat1 = 'lazy_htm/joinnet_chat.htm' + hmtgHelper.cache_param;
        $scope.partialChat2 = 'lazy_htm/joinnet_chat2.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_chat fails');
      });
    }

    $scope.loadVideoWindow = function() {
      if($scope.partialVideo) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_video' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialVideo = 'lazy_htm/joinnet_video.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_video fails');
      });
    }
    // if launched in concise layout, load video window immediately
    if($rootScope.gui_mode == 'concise') {
      $scope.loadVideoWindow();
    }

    $scope.loadBrowser = function() {
      if($scope.partialBrowser) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_browser' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialBrowser = 'lazy_htm/joinnet_browser.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_browser fails');
      });
    }

    $scope.loadSDT = function() {
      if($scope.partialSDT) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_dt' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialSDT = 'lazy_htm/joinnet_sdt.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_dt fails');
      });
    }

    $scope.loadRDC = function() {
      if($scope.partialRDC) return;

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_dt' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialRDC = 'lazy_htm/joinnet_rdc.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_dt fails');
      });
    }

    // action menu
    $scope.menu = [];
    $scope.ontoggle = function(open) {
      $scope.menu = [];

      if(open) {
        // turn_off_auto_hide_navbar_timer();
        if(hmtg.util.test_error & 1) {
          $scope.$digest();  // trigger an angular error
        }
        hmtgSound.refresh_device_list();
        var menu = $scope.menu;
        // prepare the menu
        if(joinnetAudio.recording) {
          menu.push({ "text": $translate.instant('ID_STOP_RECORD'), "onclick": $scope.stopAudioRecording });
        }
        if(joinnetAudio.can_show_record_control()) {
          if(!joinnetAudio.recording) {
            if(hmtgSound.audio_device_array.length > 1 && !navigator.mozGetUserMedia) {
              var i;
              for(i = 0; i < hmtgSound.audio_device_array.length && i < 20; i++) {
                menu.push({ "text": $translate.instant('ID_START_RECORD') + ' @ ' + hmtgSound.audio_device_array[i].name, "onclick": $scope.startAudioRecording, "value": hmtgSound.audio_device_array[i].id });
              }
            } else {
              menu.push({ "text": $translate.instant('ID_START_RECORD'), "onclick": $scope.startAudioRecording });
            }
          }
        }
        if(joinnetVideo.recording) {
          menu.push({ "text": $translate.instant('ID_STOP_VIDEO_CAPTURE'), "onclick": $scope.stopVideoRecording });
        }
        if(joinnetVideo.can_show_record_control()) {
          if(!joinnetVideo.recording) {
            if(hmtgSound.video_device_array.length > 1 && !navigator.mozGetUserMedia) {
              var i;
              for(i = 0; i < hmtgSound.video_device_array.length && i < 20; i++) {
                menu.push({ "text": $translate.instant('ID_START_VIDEO_CAPTURE') + ' @ ' + hmtgSound.video_device_array[i].name, "onclick": $scope.startVideoRecording, "value": hmtgSound.video_device_array[i].id });
              }
            } else {
              menu.push({ "text": $translate.instant('ID_START_VIDEO_CAPTURE'), "onclick": $scope.startVideoRecording });
            }
          }
        }
        if(joinnetVideo.screen_recording) {
          menu.push({ "text": $translate.instant('ID_STOP_SCREEN_CAPTURE'), "onclick": $scope.stopScreenRecording });
        }
        if(joinnetVideo.can_show_record_control()) {
          if(!joinnetVideo.screen_recording) {
            menu.push({ "text": $translate.instant('ID_START_SCREEN_CAPTURE'), "onclick": $scope.startScreenRecording });
            if(!!navigator.mozGetUserMedia) { // Firefox use different api for screen and window
              if(!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
                menu.push({ "text": $translate.instant('ID_START_SCREEN_CAPTURE2'), "onclick": $scope.startScreenRecording2 });
              }
            }
          }
        }
        if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL && joinnetTranscoding.can_show_transcoding_control()) {
          menu.push({ "text": $translate.instant('ID_IMPORT_HTML5'), "onclick": $scope.importHtml5 });
        }
        if(joinnetTranscoding.transcoding) {
          menu.push({ "text": $translate.instant('ID_STOP_IMPORTING'), "onclick": $scope.stopImporting });
        }
        /*
        // need audio element to use setSindId
        if(hmtgSound.ac
          //&& hmtgSound.ac.setSinkId
          && hmtgSound.audio_output_array.length > 1) {
          var i;
          for(i = 0; i < hmtgSound.audio_output_array.length && i < 20; i++) {
            menu.push({ "text": $translate.instant('ID_CHOOSE_SPEAKER') + ' @ ' + hmtgSound.audio_output_array[i].name, "onclick": $scope.chooseSpeaker, "value": hmtgSound.audio_output_array[i].id });
          }
        }
        */
        if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
          && hmtg.jnkernel._jn_bConnected()
          && (hmtg.jnkernel._jn_bTokenOwner() || JoinNet.is_assistant)
        ) {
          menu.push({ "text": $translate.instant('ID_TERMINATE_MEETING'), "onclick": $scope.terminate_meeting });
        }
        if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
          && hmtg.jnkernel._jn_bConnected()
          && hmtg.jnkernel._jn_bTokenOwner()
          && !hmtg.jnkernel._jn_to_archive()  // archived meeting enforce recording
          && hmtg.jnkernel._jn_iRecordingStatus()) {
          if(hmtg.jnkernel._jn_iRecordingStatus() == 1) {
            menu.push({ "text": $translate.instant('ID_PAUSE_RECORDING'), "onclick": $scope.pause_recording });
          } else {
            menu.push({ "text": $translate.instant('ID_RESUME_RECORDING'), "onclick": $scope.resume_recording });
          }
        }
        if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
          && hmtg.jnkernel._jn_bConnected()
          && hmtg.jnkernel._jn_bEnableJNRPassword()
          && hmtg.jnkernel._jn_iRecordingStatus()
          && hmtg.jnkernel._jn_bTokenOwner()) {
          menu.push({ "text": $translate.instant('ID_SET_JNR_PASSWORD'), "onclick": $scope.change_jnr_password });
        }
        // if($rootScope.gui_mode != 'concise' && $scope.can_disconnect()) {
        //   menu.push({ "text": $translate.instant('ID_SIGNOUT'), "onclick": $scope.disconnect });
        // }
        // if($rootScope.gui_mode != 'concise' && $scope.can_reconnect()) {
        //   menu.push({ "text": $translate.instant('ID_RECONNECT'), "onclick": $scope.reconnect });
        //   menu.push({ "text": $translate.instant('ID_RESET'), "onclick": $scope.reset });
        // }
        // if($rootScope.gui_mode != 'concise' && appSetting.show_advanced_function && $scope.can_disconnect()) {
        //   menu.push({ "text": $translate.instant('ID_SIMULATE_DISCONNECT'), "onclick": $scope.simulate_disconnect });
        //   menu.push({ "text": $translate.instant('ID_SIMULATE_RECONNECT'), "onclick": $scope.simulate_reconnect_overwrite });
        // }

        if(joinnetAudio.can_show_playback_control()) {
          if($rootScope.gui_mode != 'concise' && joinnetAudio.recording
            //&& !hmtg.jnkernel._jn_bConnected()
          ) {
            if(!joinnetAudio.is_record_loop) {
              menu.push({ "text": $translate.instant('ID_START_RECORD_LOOP'), "onclick": $scope.start_record_loop });
            } else {
              menu.push({ "text": $translate.instant('ID_STOP_RECORD_LOOP'), "onclick": $scope.stop_record_loop });
            }
          }
          if(!$scope.playing) {
            if($rootScope.gui_mode != 'concise') {
              menu.push({ "text": $translate.instant('ID_PLAY_SOUND_FILE'), "onclick": $scope.play_sound_file });
            }
          } else if($scope.src) {
            menu.push({ "text": $translate.instant('ID_STOP_SOUND_FILE'), "onclick": $scope.stop_sound_file });
          }

          if($rootScope.gui_mode != 'concise' && hmtg.jnkernel._jn_bConnected()) {
            menu.push({ "text": $translate.instant('ID_RESET_AUDIO_PLAYBACK'), "onclick": $scope.reset_audio_playback });
          }
        }

        if($rootScope.gui_mode == 'concise') {
          menu.push({ "text": (layout.visible_area == 'sdt' ? '* ' : '') + $translate.instant('ID_DESKTOP_SHARING'), "onclick": $scope.onConciseSDT });
          menu.push({ "text": (layout.visible_area == 'rdc' ? '* ' : '') + $translate.instant('ID_REMOTE_CONTROL'), "onclick": $scope.onConciseRDC });
          if(hmtg.customization.support_joint_browsing) {
            menu.push({ "text": (layout.visible_area == 'browser' ? '* ' : '') + $translate.instant('IDS_JOINT_WEB_BROWSING'), "onclick": $scope.onConciseBrowser });
          }
        }

        menu.push({ "text": $translate.instant('ID_TOGGLE_CONCISE_LAYOUT'), "onclick": $scope.toggle_concise_mode });

        if(!menu.length) {
          $scope.w.is_menu_open = 0;
        }
      } else {
        // if($rootScope.gui_mode == 'concise' && layout.is_navbar_visible) {
        //   $scope.turn_on_auto_hide_navbar_timer();
        // }
      }
    }

    $scope.terminate_meeting = function() {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_TERMINATE_MEETING_PROMPT'), 0, ok);
      function ok() {
        hmtg.jnkernel.jn_command_TerminateSession();
      }
    }

    $scope.pause_recording = function() {
      hmtg.jnkernel.jn_command_SetRecordingStatus(2);
    }

    $scope.resume_recording = function() {
      hmtg.jnkernel.jn_command_SetRecordingStatus(1);
    }

    $scope.chooseSpeaker = function(menu) {
      //hmtgSound.ac.setSinkId(menu.value);
    }

    $scope.startAudioRecording = function(menu) {
      hmtgHelper.inside_angular++;
      joinnetAudio.start(menu.value);
      hmtgHelper.inside_angular--;
    }
    $scope.stopAudioRecording = function() {
      hmtgHelper.inside_angular++;
      joinnetAudio.stop();
      hmtgHelper.inside_angular--;
    }

    $scope.startVideoRecording = function(menu) {
      hmtgHelper.inside_angular++;
      joinnetVideo.start(menu.value);
      hmtgHelper.inside_angular--;
    }
    $scope.stopVideoRecording = function() {
      hmtgHelper.inside_angular++;
      joinnetVideo.stop();
      hmtgHelper.inside_angular--;
    }
    $scope.toggle_video_capture = function() {
      hmtgHelper.inside_angular++;
      if(joinnetVideo.recording) {
        joinnetVideo.stop();
      } else {
        joinnetVideo.start();
      }
      hmtgHelper.inside_angular--;
    }

    $scope.startScreenRecording = function() {
      hmtgHelper.inside_angular++;
      joinnetVideo.startScreenCapture();
      hmtgHelper.inside_angular--;
    }
    $scope.startScreenRecording2 = function() {
      hmtgHelper.inside_angular++;
      joinnetVideo.startScreenCapture(true);
      hmtgHelper.inside_angular--;
    }
    $scope.stopScreenRecording = function() {
      hmtgHelper.inside_angular++;
      joinnetVideo.stopScreenCapture();
      hmtgHelper.inside_angular--;
    }

    $scope.startVideoRecving = function() {
      hmtgHelper.inside_angular++;
      video_playback.start_recv_video();
      hmtgHelper.inside_angular--;
    }
    $scope.stopVideoRecving = function() {
      hmtgHelper.inside_angular++;
      video_playback.stop_recv_video();
      hmtgHelper.inside_angular--;
    }
    $scope.toggle_video_recving = function() {
      hmtgHelper.inside_angular++;
      if(video_recving.is_recv_video) {
        video_playback.stop_recv_video();
      } else {
        video_playback.start_recv_video();
      }
      mediasoupWebRTC.updateVideoRecving(video_recving.is_recv_video);
      hmtgHelper.inside_angular--;
    }
    $scope.toggle_video_sending = function() {
      if(hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
      mediasoupWebRTC.is_send_video = video_bitrate.is_send_video = !video_bitrate.is_send_video;
      hmtg.util.log('stat, video sending status is ' + (video_bitrate.is_send_video ? 'ON' : 'OFF'));
      hmtgHelper.inside_angular++;
      mediasoupWebRTC.updateVideoSending();
      hmtgHelper.inside_angular--;
      hmtg.jnkernel.jn_command_UpdateVideoSendingStatus(video_bitrate.is_send_video);
    }
    $scope.toggle_screen_as_video = function() {
      mediasoupWebRTC.use_screen_as_video = joinnetVideo.use_screen_as_video = !joinnetVideo.use_screen_as_video;
      hmtg.util.log('stat, use screen as video status: ' + (joinnetVideo.use_screen_as_video ? 'Yes' : 'No'));
      hmtgHelper.inside_angular++;
      mediasoupWebRTC.updateVideoSource();
      $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
      hmtgHelper.inside_angular--;
    }

    $scope.lazyLoadTranscoding = function(_import) {
      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/joinnet_transcoding' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        $scope.partialTranscoding = 'lazy_htm/joinnet_transcoding.htm' + hmtgHelper.cache_param;
        hmtgHelper.fast_apply();
        joinnetTranscoding.transcoding_loaded = _import;
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading joinnet_transcoding fails');
      });
    }

    $scope.importHtml5 = function() {
      //joinnetTranscoding.import_html5_media('http://www.homemeeting.com/html5/tree.mp4', 80, 0, true, true); return;
      var myinput = hmtgHelper.file_reset('fileInput');

      myinput.addEventListener("change", handleFile, false);
      if(window.navigator.msSaveOrOpenBlob) {
        setTimeout(function() {
          myinput.click();  // use timeout, otherwise, IE will complain error
        }, 0);
      } else {
        // it is necessary to exempt error here
        // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
        window.g_exempted_error++;
        myinput.click();
        window.g_exempted_error--;
      }

      function handleFile() {
        myinput.removeEventListener("change", handleFile, false);
        var file = myinput.files[0];

        if(!file) {
          return;
        }

        if($scope.partialTranscoding) {
          _import();
          return;
        }
        $scope.lazyLoadTranscoding(_import);

        function _import() {
          //$rootScope.$broadcast(hmtgHelper.WM_IMPORT_TRANSCODING);
          $rootScope.$broadcast(hmtgHelper.WM_IMPORT_TRANSCODING, window.URL.createObjectURL(file), 100, 100, false, false);
        }
        //$modalInstance.close({ src: window.URL.createObjectURL(file), auto_play: $scope.w.auto_play, audio_only: $scope.w.audio_only });
      }
    }

    $scope.stopImporting = function() {
      hmtgHelper.inside_angular++;
      joinnetTranscoding.reset_html5_media();
      hmtgHelper.inside_angular--;
    }

    $scope.$on(hmtgHelper.WM_IMPORT_TRANSCODING, function(event, src, audio_broadcast_volume, audio_local_volume, audio_only, loop) {
      if($scope.partialTranscoding) return; // JoinNetTrancodingCtrl will handle this message
      $scope.lazyLoadTranscoding(_import);

      function _import() {
        $rootScope.$broadcast(hmtgHelper.WM_IMPORT_TRANSCODING, src, audio_broadcast_volume, audio_local_volume, audio_only, loop);
      }
    });

    $scope.change_jnr_password = function() {
      $scope.set_password_only = true;
      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_change_jnr_password' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/ChangeJnrPassword.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'ChangeJnrPasswordModalCtrl',
          size: '',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
          hmtg.jnkernel.jn_command_SetJNRPassword(result.password);
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_change_jnr_password fails');
      });
    }

    $scope.start_record_loop = function() {
      joinnetAudio.is_record_loop = true;
      joinnetAudio.tmp_gain_node.gain.value = joinnetAudio.is_record_loop ? 1.0 : 0.0;
    }

    $scope.stop_record_loop = function() {
      joinnetAudio.is_record_loop = false;
      joinnetAudio.tmp_gain_node.gain.value = joinnetAudio.is_record_loop ? 1.0 : 0.0;
    }

    $scope.play_sound_file = function() {
      if(!hmtgSound.ac) return;
      if($scope.playing) return;

      var need_adjust_volume;
      need_adjust_volume = false;
      if(hmtgSound.playback_muted) {
        need_adjust_volume = true;
      } else if(hmtgSound.playback_gain < hmtgSound.MIN_GAIN) {
        need_adjust_volume = true;
      }
      if(need_adjust_volume) {
        hmtgHelper.inside_angular++;
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_NEED_ADJUST_VOLUME') }, 20);
        hmtgHelper.inside_angular--;
      }
      $scope.playing = true;
      var file = hmtgSound.sound_speaker_file;

      var ac = hmtgSound.ac;
      if(hmtgSound.buffer_list[file]) {
        $scope.play_buffer(hmtgSound.buffer_list[file]);
      } else {
        var request = new XMLHttpRequest();
        request.open('GET', file, true);
        request.responseType = 'arraybuffer';

        request.onload = function() {
          ac.decodeAudioData(request.response, function(buffer) {
            hmtgSound.buffer_list[file] = buffer;
            $scope.play_buffer(buffer);
          }, function(e) {
            $scope.playing = false;
          });
        }
        request.send();
      }
    }

    $scope.play_buffer = function(buffer) {
      var ac = hmtgSound.ac;
      var src = $scope.src = ac.createBufferSource();
      if(hmtgSound.webkit_audio) {
        src.start = src.start || src.noteOn;
        src.stop = src.stop || src.noteOff;
      }
      src.buffer = buffer;
      var playback_gain_node = hmtgSound.create_playback_gain_node();
      src.connect(playback_gain_node);
      src.start(0);

      src.onended = function() {
        $scope.playing = false;
      }
    }

    $scope.stop_sound_file = function() {
      if($scope.src) $scope.src.stop(0);
    }

    $scope.reset_audio_playback = function() {
      // some times, firefox will suddently stop audio playback.
      // this function can reset audio playback\
      audio_playback.event_quit_session();  // useful to reset audio playback
    }

    $scope.simulate_disconnect = function() {
      hmtg.jnkernel.jn_command_simulate_disconnect();
    }

    $scope.simulate_reconnect_overwrite = function() {
      hmtg.util.log('simulate to disconnect and reconnect immediately');
      hmtgHelper.inside_angular++;
      hmtgSound.ShowInfoPrompt(function() { return $translate.instant('ID_LEAVE_AND_RECONNECT') }, 10);
      hmtg.jnkernel.jn_command_QuitConnection();
      hmtg.jnkernel.jn_command_initconnectmedia(true);
      hmtgHelper.inside_angular--;
    }

    $scope.$on(hmtgHelper.WM_UPDATE_JOINNET, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    // change cap
    $scope.$on(hmtgHelper.WM_CHANGE_CAP, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();

      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        var a = joinnetAudio.recording || joinnetTranscoding.audio_transcoding;
        var v = (joinnetVideo.use_screen_as_video ? joinnetVideo.screen_recording : joinnetVideo.recording) || joinnetTranscoding.video_transcoding;
        hmtg.jnkernel.jn_command_ChangeCapability(a, v);
      }
    });

    hmtgHelper.inside_angular++;
    adjust_height();
    adjust_width();
    hmtgHelper.inside_angular--;

    // remote monitor may send to request to a new user, who never switch to "remote control" tab yet.
    // need to load Remote Control tab at the beginning
    $scope.loadRDC();
  }
])

.controller('DurationCtrl', ['$scope', 'jnjContent', 'hmtgHelper', 'playback',
  function($scope, jnjContent, hmtgHelper, playback) {
    $scope.duration_str = hmtg.jnkernel._duration_str;
    $scope.playback_tick_str = function() { return playback.tick_str + ' [' + playback.pos_str + '] ' + playback.end_str; }

    $scope.can_show_badge = function() {
      return hmtg.jnkernel._jn_bConnected() || (typeof hmtg.jnkernel._jn_iWorkMode() != 'undefined' && (hmtg.jnkernel._jn_bConnecting() || jnjContent.valid_jnj));
    }
    $scope.can_show_mode = function(mode) {
      return (hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting() || jnjContent.valid_jnj)
       && hmtg.jnkernel._jn_iWorkMode() == mode
       ;
    }
    $scope.can_show_duration = function() {
      return hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL;
    }
    $scope.can_show_tick_str = function() {
      return hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.PLAYBACK;
    }
    $scope.is_joinnet_connected = function() {
      return hmtg.jnkernel._jn_bConnected();
    }

    $scope.$on(hmtgHelper.WM_UPDATE_DURATION, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_PLAYBACK_UPDATE_TICK_STR, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

  }
])

.service('statistics', ['$rootScope',
  function($rootScope) {
    var _statistics = this;
    this.active = false;
  }
])

.service('layout', ['$rootScope', 'video_recving',
  function($rootScope, video_recving) {
    var _layout = this;
    this.is_navbar_visible = true;
    this.visible_area = 'userlist';
    this.is_userlist_visible = false;
    this.is_textchat_visible = false;
    this.is_video_visible = false;
    this.is_gallery_visible = false;

    this.set_fixed_video_display_size = function() {
      video_recving.display_size = 100 - 3;
    }
  }
])

;
