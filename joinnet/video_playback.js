/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('video_recving', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope', 'hmtgSound',
  'main_video_canvas', 'video_bitrate',
  function ($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope, hmtgSound, main_video_canvas, video_bitrate) {
    var _video_recving = this;
    this.is_recv_video = appSetting.auto_recv_video;
    //this.show_2nd_video = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_show_2nd_video']);
    //this.show_2nd_video = this.show_2nd_video === 'undefined' ? (hmtgHelper.isMobile ? false : true) : !!this.show_2nd_video;
    this.show_2nd_video = false;
    this.main_video_ssrc = -1;  // -1: auto select; -2: do not show; -3: camera view
    this.main_video_ssrc2 = -1;
    this.ssrc_array = []; // sorted ssrc list in video window
    this.display_size = 320;  // the display size in video window
    this.ssrc_hash = {};  // properties of the video of ssrc, such as canvas, is_fullscreen, has_img, etc.

    this.is_selected_video_ssrc = function (ssrc) {
      if(ssrc < 0) return false;
      if(this.main_video_ssrc == ssrc
        || this.ssrc_array.indexOf(ssrc) != -1
        || (this.show_2nd_video && this.main_video_ssrc2 == ssrc)) {
        return true;
      }
      return false;
    }

    this.update_holder_sender_video_recv_status = function () {
      var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
      var ssrc_sender = hmtg.jnkernel._jn_iDataSender();

      var sender_video = this.is_selected_video_ssrc(ssrc_sender);
      var holder_video = this.is_selected_video_ssrc(ssrc_holder);

      if(!sender_video && !holder_video) {
        hmtg.jnkernel.jn_command_RequestVideo(false);
      } else {
        if(this.is_recv_video) {
          hmtg.jnkernel.jn_command_RequestVideo(true);
        }
        if(ssrc_sender != -1 && ssrc_sender != ssrc_holder) {
          if(sender_video && holder_video) {
            hmtg.jnkernel.jn_command_UpdateBothVideoPreference(true);
          } else {
            hmtg.jnkernel.jn_command_UpdateBothVideoPreference(false);
            hmtg.jnkernel.jn_command_UpdatePreference(sender_video);
          }
        }
      }
    }

    this.reset_video = function (ssrc) {
      var hash = this.ssrc_hash[ssrc];
      if(!hash) return;
      if(!hash.canvas) return;
      hash.canvas.width = hash.canvas.height = 0;
      hash.has_img = false;
    }

    this.draw_video = function (_video_playback, ssrc) {
      var hash = this.ssrc_hash[ssrc];
      if(!hash) {
        hash = this.ssrc_hash[ssrc] = {};
      }
      if(!hash.canvas) {
        hash.canvas = document.getElementById('video-' + ssrc);
        if(!hash.canvas) return;
        hash.ctx = hash.canvas.getContext('2d');
        hash.has_img = false;
      }

      var video_playback = _video_playback.video_playback_array[ssrc];
      var old = hash.has_img;
      if(!video_playback || !video_playback.canvas || !video_playback.canvas.width) {
        hash.canvas.width = hash.canvas.height = 0;
        hash.has_img = false;
        if(old) {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_VIDEO_WINDOW); // to update ng-show of snapshot button
        }
        return;
      }

      var video_w = video_playback.canvas.width;
      var video_h = video_playback.canvas.height;

      hash.has_img = true;
      if(!old) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_VIDEO_WINDOW); // to update ng-show of snapshot button
      }

      var w, h;
      if(hash.is_fullscreen) {
        w = hmtgHelper.view_port_width;
        h = (w * video_h / video_w) >> 0;
        if(h > hmtgHelper.view_port_height) {
          h = hmtgHelper.view_port_height;
          w = (h * video_w / video_h) >> 0;
        }
      } else {
        var display_size = this.display_size >> 0;
        if(video_h > video_w) {
          h = display_size;
          w = (h * video_w / video_h) >> 0;
        } else {
          w = display_size;
          h = (w * video_h / video_w) >> 0;
        }
      }
      if(w < 20) w = 20;
      if(h < 20) h = 20;
      if(hash.canvas.width != w || hash.canvas.height != h) {
        hash.canvas.width = w;
        hash.canvas.height = h;
      }

      hash.ctx.clearRect(0, 0, hash.canvas.width, hash.canvas.height);
      hash.ctx.drawImage(video_playback.canvas, 0, 0, video_playback.canvas.width, video_playback.canvas.height, 0, 0, w, h);
    }

  }
])

.service('video_playback', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope', 'hmtgSound',
  'main_video_canvas', 'video_bitrate', 'video_recving',
  function ($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope, hmtgSound, main_video_canvas, video_bitrate,
    video_recving) {
    var _video_playback = this;
    this.camera_canvas = document.createElement("canvas");
    this.camera_ctx = this.camera_canvas.getContext('2d');
    this.screen_canvas = document.createElement("canvas");
    this.screen_ctx = this.screen_canvas.getContext('2d');
    this.import_canvas = document.createElement("canvas");
    this.import_ctx = this.import_canvas.getContext('2d');
    this.video_playback_array = {};

    var WORKER_H264_DECODE_PATH = 'worker/h264_decode.js' + hmtgHelper.cache_param;
    var WORKER_VP8_DECODE_PATH = 'worker/vp8_decode.js' + hmtgHelper.cache_param;

    this.launch_from_jnj = function () {
      //video_bitrate.is_send_video = appSetting.auto_send_video;
      //video_recving.is_recv_video = appSetting.auto_recv_video;
    }

    this.remove_alert_item = function () {
      if(this.alert_item) {
        hmtgAlert.remove_link_item(this.alert_item);
        this.alert_item = null;
      }
    }

    this.net_init_finished = function () {
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.PLAYBACK) {
        // for playback, the initial value is recv_video and prefer questioner
        // if user's setting is different, need to take action
        if(!video_recving.is_recv_video) {
          video_recving.is_recv_video = !video_recving.is_recv_video;
          this.stop_recv_video();
        }

        if(!appSetting.prefer_questioner) {
          hmtg.jnkernel.jn_command_UpdatePreference(false);
        }
      }

      if(!video_recving.is_recv_video) {
        _video_playback.remove_alert_item();

        var item = {};
        item['timeout'] = 10;
        item['update'] = function () { return $translate.instant('ID_START_VIDEO_RECVING') };
        item['text'] = item['update']();
        item['type'] = 'info';
        item['click'] = function (index) {
          hmtgHelper.inside_angular++;
          hmtgAlert.click_link(index);
          _video_playback.start_recv_video();
          hmtgHelper.inside_angular--;
        };

        hmtgAlert.add_link_item(item);
        _video_playback.alert_item = item;
      }
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);  // to trigger lazy loading of playback bar module
    }

    this.event_quit_session = function () {
      for(var ssrc in this.video_playback_array) {
        var video_playback = this.video_playback_array[ssrc];
        video_playback.quit_flag = true;
        if(video_playback.h264_decoder) {
          video_playback.h264_decoder.onmessage = null;
          video_playback.h264_decoder.postMessage({ command: 'exit' });
          video_playback.h264_decoder = null;
        }
        if(video_playback.vp8_decoder) {
          video_playback.vp8_decoder.onmessage = null;
          video_playback.vp8_decoder.postMessage({ command: 'exit' });
          video_playback.vp8_decoder = null;
        }
        if(video_playback.decode_timerID) {
          clearTimeout(video_playback.decode_timerIDf);
          video_playback.decode_timerID = null;
        }
        this.video_playback_array[ssrc] = null;

        var hash = video_recving.ssrc_hash[ssrc];
        if(hash && hash.canvas) {
          hash.canvas.width = hash.canvas.height = 0;
          hash.has_img = false;
        }
      }

      this.video_playback_array = {};

      this.remove_alert_item();
    }

    this.on_video_interrupted = function (ssrc) {
      if(this.video_playback_array[ssrc]) {
        var video_playback = this.video_playback_array[ssrc];
        video_playback.h264_waitI = true;
        video_playback.vp8_waitI = true;
      }
    }

    this.on_video_interrupted2 = function () {
      for(var ssrc in this.video_playback_array) {
        if(!video_recving.is_selected_video_ssrc(ssrc)) {
          this.on_video_interrupted(ssrc);
        }
      }
    }

    this.on_all_video_interrupted = function () {
      for(var ssrc in this.video_playback_array) {
        this.on_video_interrupted(ssrc);
      }
    }

    this.clear_queue = function (ssrc) {
      if(this.video_playback_array[ssrc]) {
        this.video_playback_array[ssrc].queue = [];
      }
    }

    this.clear_queue2 = function () {
      for(var ssrc in this.video_playback_array) {
        if(!video_recving.is_selected_video_ssrc(ssrc)) {
          this.video_playback_array[ssrc].queue = [];
        }
      }
    }

    this.clear_all_queue = function () {
      for(var ssrc in this.video_playback_array) {
        this.video_playback_array[ssrc].queue = [];
      }
    }

    this.restart = function () {
      if(video_recving.is_recv_video) {
        video_recving.update_holder_sender_video_recv_status();

        var list = hmtg.jnkernel._jn_iParticipantAudioSsrc(); // use speaker array for requesting
        var i;
        for(i = 0; i < list.length; i++) {
          if(list[i] != -1 && video_recving.is_selected_video_ssrc(list[i])) hmtg.jnkernel.jn_command_ParticipantVideoRequest(list[i]);
        }
      } else {
        // for playback, the restart default value is recv_video=TRUE
        // if user's setting is different, need to take action
        hmtg.jnkernel.jn_command_RequestVideo(false);

        var list = hmtg.jnkernel._jn_iParticipantVideoSsrc(); // use video ssrc array for stopping
        var i;
        for(i = 0; i < list.length; i++) {
          if(list[i] != -1) hmtg.jnkernel.jn_command_ParticipantVideoStop(list[i]);
        }
      }

      // for playback, the restart value is  prefer questioner
      // if user's setting is different, need to take action
      if(!appSetting.prefer_questioner) {
        hmtg.jnkernel.jn_command_UpdatePreference(false);
      }
    }

    main_video_canvas.turnon_mypicture_interval = function () {
      if(_video_playback.mypicture_intervalID) return;
      _video_playback.mypicture_intervalID = setInterval(mypicture_interval, 1000);
    }

    main_video_canvas.turnoff_mypicture_interval = function () {
      if(!_video_playback.mypicture_intervalID) return;
      clearInterval(_video_playback.mypicture_intervalID);
      _video_playback.mypicture_intervalID = null;
    }

    function mypicture_interval() {
      if(!hmtg.jnkernel._jn_bConnected()) return;
      var video_ssrc = -1;
      var video_ssrc2 = -1;
      var ssrc;
      var now = hmtg.util.GetTickCount();
      // main video
      var to_draw = false;
      if(main_video_canvas.video_ssrc >= 0) {
        video_ssrc = main_video_canvas.video_ssrc;
        var canvas = check_mypicture(main_video_canvas.video_ssrc);
        if(canvas) {
          if(video_recving.ssrc_array.indexOf(main_video_canvas.video_ssrc) != -1) {
            video_recving.draw_video(_video_playback, main_video_canvas.video_ssrc);
          }
          var old = main_video_canvas.canvas_orig;
          main_video_canvas.canvas_orig = typeof canvas != 'boolean' ? canvas : null;
          if(!old) {
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST); // to update ng-show of snapshot button
          }
          to_draw = true;
        }
      }
      if(main_video_canvas.video_ssrc2 >= 0 && main_video_canvas.video_ssrc != main_video_canvas.video_ssrc2) {
        video_ssrc2 = main_video_canvas.video_ssrc2;
        var canvas = check_mypicture(main_video_canvas.video_ssrc2);
        if(canvas) {
          if(video_recving.ssrc_array.indexOf(main_video_canvas.video_ssrc2) != -1) {
            video_recving.draw_video(_video_playback, main_video_canvas.video_ssrc2);
          }
          main_video_canvas.canvas_orig2 = typeof canvas != 'boolean' ? canvas : null;
          to_draw = true;
        }
      }
      if(to_draw) main_video_canvas.draw_video();

      // video window
      var i;
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      for(i = 0; i < video_recving.ssrc_array.length; i++) {
        ssrc = video_recving.ssrc_array[i];
        if(!a[ssrc]) continue;
        if(ssrc == video_ssrc || ssrc == video_ssrc2) continue;  // already checked above
        // even if the user has logged out, we still track its video/my picture in video window!
        //if(!a[ssrc]._bLogged()) continue;
        var canvas = check_mypicture(ssrc);
        if(canvas) {
          video_recving.draw_video(_video_playback, ssrc);
        }
      }

      function check_mypicture(ssrc) {
        var video_playback = _video_playback.video_playback_array[ssrc];
        if(!video_playback) {
          video_playback = _video_playback.video_playback_array[ssrc] = {};
          _video_playback.init_video_playback(video_playback, ssrc);
        }
        var user = hmtg.jnkernel._jn_UserArray()[ssrc];
        var img = user._m_spic_img();
        if(!video_playback.canvas.width // no video display yet, check my picture
          || (!video_playback.is_video_canvas && !img)  // showing my picture and now my picture is reset
          ||
        // the video has no input for certain time, check my picture
          (video_playback.is_video_canvas && now - video_playback.tick > hmtg.config.SHOW_MYPICTURE_DELAY)
          ) {
          if(img) {
            if(video_playback.w != img.width || video_playback.h != img.height) {
              video_playback.w = img.width;
              video_playback.h = img.height;
              video_playback.canvas.width = video_playback.w;
              video_playback.canvas.height = video_playback.h;
            }
            try {
              video_playback.ctx.drawImage(img, 0, 0);
            } catch(e) {
              var old = video_playback.canvas.width;
              video_playback.w = 0;
              video_playback.canvas.width = video_playback.canvas.height = 0;
              video_playback.is_video_canvas = false;
              return !!old; // if change occurs, return true to let video window clear the stopped video
            }
            video_playback.is_video_canvas = false;
            return video_playback.canvas;
          } else if(video_playback.canvas.width) {
            // when video is stopped for a certain time, clear it
            video_playback.w = 0;
            video_playback.canvas.width = video_playback.canvas.height = 0;
            video_playback.is_video_canvas = false;
            return true;  // return true to let video window clear the stopped video
          }
        }
        if(video_playback.canvas.width) return video_playback.canvas;
      }
    }

    this.add_user = function (ssrc) {
      var video_playback = _video_playback.video_playback_array[ssrc];
      if(video_playback) {
        video_playback.w = 0;
        video_playback.canvas.width = video_playback.canvas.height = 0;
        video_playback.is_video_canvas = false;
      }
      video_recving.reset_video(ssrc);
    }

    this.start_recv_video = function () {
      this.remove_alert_item();
      if(video_recving.is_recv_video) return;
      video_recving.is_recv_video = true;
      if(!hmtg.jnkernel._jn_bConnected()) return;
      video_recving.update_holder_sender_video_recv_status();

      var list = hmtg.jnkernel._jn_iParticipantAudioSsrc(); // use speaker array for requesting
      var i;
      for(i = 0; i < list.length; i++) {
        if(list[i] != -1 && video_recving.is_selected_video_ssrc(list[i])) hmtg.jnkernel.jn_command_ParticipantVideoRequest(list[i]);
      }
    }

    this.stop_recv_video = function () {
      this.remove_alert_item();
      if(!video_recving.is_recv_video) return;
      video_recving.is_recv_video = false;
      if(!hmtg.jnkernel._jn_bConnected()) return;
      hmtg.jnkernel.jn_command_RequestVideo(false);

      var list = hmtg.jnkernel._jn_iParticipantVideoSsrc(); // use video ssrc array for stopping
      var i;
      for(i = 0; i < list.length; i++) {
        if(list[i] != -1) hmtg.jnkernel.jn_command_ParticipantVideoStop(list[i]);
      }

      this.on_all_video_interrupted();
      this.clear_all_queue();
    }

    function adjust_queue(video_playback) {
      var q = video_playback.queue;
      var ssrc = video_playback.ssrc;
      var adjusted = false;
      while(q.length > 60 || (q.length > 1 && q[q.length - 1].ts - q[0].ts > 2000)) {
        //hmtg.util.log(-2, '******debug, ssrc ' + ssrc + ' drop video frame');
        q.splice(0, 1);
        adjusted = true;
      }
      if(adjusted) {
        _video_playback.on_video_interrupted(ssrc);
      }
    }

    function request_decode_next_item(video_playback) {
      if(video_playback.decode_timerID) return;

      video_playback.decode_timerID = setTimeout(function () {
        adjust_queue(video_playback);
        decode_next_item(video_playback);
      }, 0);
    }

    function decode_next_item(video_playback) {
      if(video_playback.decode_timerID) {
        clearTimeout(video_playback.decode_timerIDf);
        video_playback.decode_timerID = null;
      }
      if(video_playback.busy) {
        return;
      }

      var q = video_playback.queue;
      if(!q.length) return;
      var item = q[0];
      q.splice(0, 1);

      var subtype;

      switch(item.type) {
        case hmtg.config.VIDEO_H264:
          subtype = item.data.charCodeAt(item.data.length - 1);
          if(subtype == 0 // h264 baseline
          || subtype == 1 // o264 baseline
          ) {
            _video_playback.h264_decode(item.data, item.type, item.ssrc);
            return;
          } else {
            hmtg.jnkernel.jn_command_UnknownMedia(item.type, item.ssrc, '(subtype=' + subtype + ')');
          }
          break;
        case hmtg.config.VIDEO_F264:
          subtype = item.data.charCodeAt(item.data.length - 1);
          if(subtype == 0 // f264 baseline
          || subtype == 2 // f264 high
          ) { 
            _video_playback.h264_decode(item.data, item.type, item.ssrc);
            return;
          } else {
            hmtg.jnkernel.jn_command_UnknownMedia(item.type, item.ssrc, '(subtype=' + subtype + ')');
          }
          break;
        case hmtg.config.VIDEO_VPX:
          subtype = item.data.charCodeAt(item.data.length - 1);
          if(subtype == 0) {  // vp8
            _video_playback.vp8_decode(item.data, item.type, item.ssrc);
            return;
          } else {
            hmtg.jnkernel.jn_command_UnknownMedia(item.type, item.ssrc, '(subtype=' + subtype + ')');
          }
          break;
        case hmtg.config.VIDEO_MJPG:
          _video_playback.mjpg_decode(item.data, item.ssrc);
          return;
          break;
        default:
          break;
      }
      if(q.length)
        request_decode_next_item(video_playback);
    }

    this.draw_video = function (video_playback, ssrc) {
      var tick = hmtg.util.GetTickCount();
      video_playback.tick = tick;
      video_playback.is_video_canvas = true;
      var stat = video_playback.stat;
      if(!stat) {
        stat = video_playback.stat = {};
        // init
        stat.count = 0;
        stat.start_tick = stat.last_tick = tick - 100000;
      }
      video_bitrate.count_fps(stat, tick);
      stat.recving_width = video_playback.w;
      stat.recving_height = video_playback.h;

      // main video
      var to_draw = false;
      if(main_video_canvas.video_ssrc == ssrc) {
        var old = main_video_canvas.canvas_orig;
        main_video_canvas.canvas_orig = video_playback.canvas;
        if(!old) {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST); // to update ng-show of snapshot button
        }
        to_draw = true;
      } else if(main_video_canvas.video_ssrc2 == ssrc) {
        main_video_canvas.canvas_orig2 = video_playback.canvas;
        to_draw = true;
      }
      if(to_draw) main_video_canvas.draw_video();

      // video window
      video_recving.draw_video(_video_playback, ssrc);
    }

    this.init_video_playback = function (video_playback, ssrc) {
      video_playback.ssrc = ssrc;
      video_playback.canvas = document.createElement("canvas");
      video_playback.ctx = video_playback.canvas.getContext('2d');
      video_playback.w = 0;
      video_playback.h = 0;
      video_playback.canvas.width = video_playback.w;
      video_playback.canvas.height = video_playback.h;
      video_playback.queue = [];
      video_playback.busy = false;
      video_playback.tick = hmtg.util.GetTickCount() - 60000;
      video_playback.is_video_canvas = false;
      video_playback.decode_timerID = null;
    }

    this.recv_video = function (data, type, ssrc, ts, ts2) {
      if(!video_recving.is_selected_video_ssrc(ssrc)) {
        return;
      }

      var video_playback = this.video_playback_array[ssrc];
      if(!video_playback) {
        video_playback = this.video_playback_array[ssrc] = {};
        this.init_video_playback(video_playback, ssrc);
      }
      var q = video_playback.queue;
      q.push({ data: data, type: type, ssrc: ssrc, ts: ts, ts2: ts2 });
      adjust_queue(video_playback);
      if(video_playback.busy) {
        return;
      }

      decode_next_item(video_playback);
    }

    //var tick = hmtg.util.GetTickCount();
    //var avg_tick = 0;
    this.h264_decode = function (data, type, ssrc) {
      function is_key_frame(data) {
        var i = 0;
        while(i + 4 < data.length) {
          if(data.charCodeAt(i) || data.charCodeAt(i + 1) || data.charCodeAt(i + 2) != 1) { i++; continue; }
          i += 3;
          var type = data.charCodeAt(i) & 0x1f;
          if(type == 5) return 1;
          if(type == 6 || type == 7 || type == 8 || type == 9) { i++; continue; }
          return 0;
        }
        return 0;
      }

      var video_playback = _video_playback.video_playback_array[ssrc];
      if(video_playback.h264_waitI) {
        if(appSetting.wait_key_frame && !is_key_frame(data)) {
          request_decode_next_item(video_playback);
          return;
        }
        video_playback.h264_waitI = false;
      }
      if(!video_playback.h264_decoder) {
        try {
          video_playback.h264_decoder = new Worker(WORKER_H264_DECODE_PATH);
          video_playback.h264_decoder.addEventListener('error', window.onerrorWorker, false);
          video_playback.h264_decoder.postMessage({ command: 'init', good_worker: hmtgHelper.good_worker });
        } catch(e) {
          hmtg.jnkernel.jn_command_UnknownMedia(type, ssrc);
          request_decode_next_item(video_playback);
          return;
        }
        video_playback.h264_decoder.onmessage = function (e) {
          switch(e.data.command) {
            case 'data_out':
              if(video_playback.quit_flag) {
                return;
              }
              //tick = hmtg.util.GetTickCount() - tick;
              //avg_tick += (tick - avg_tick) * 0.1;
              //hmtg.util.log(-2, '******debug, broadway.js decoding ' + e.data.width + 'x' + e.data.height + ',use ' + tick + 'ms,avg=' + ((avg_tick + 0.5) >> 0) + 'ms');

              if(video_playback.w != e.data.width || video_playback.h != e.data.height) {
                video_playback.w = e.data.width;
                video_playback.h = e.data.height;
                video_playback.canvas.width = video_playback.w;
                video_playback.canvas.height = video_playback.h;
                video_playback.idata = video_playback.ctx.createImageData(video_playback.w, video_playback.h);
              }

              video_playback.idata.data.set(e.data.data);
              video_playback.ctx.putImageData(video_playback.idata, 0, 0);

              _video_playback.draw_video(video_playback, ssrc);
            case 'data_error':
              if(video_playback.quit_flag) {
                return;
              }
              video_playback.busy = false;
              adjust_queue(video_playback);
              decode_next_item(video_playback);
              break;
            default:
              break;
          }
        }
      }

      video_playback.busy = true;

      //tick = hmtg.util.GetTickCount();

      var uInt8Array = new Uint8Array(data.length - 1);
      for(var i = 0; i < uInt8Array.length; ++i) {
        uInt8Array[i] = data.charCodeAt(i);
      }

      if(hmtgHelper.good_worker) {
        video_playback.h264_decoder.postMessage({ command: 'data_in', data: uInt8Array }, [uInt8Array.buffer]);
      } else {
        video_playback.h264_decoder.postMessage({ command: 'data_in', data: uInt8Array });
      }
    }

    this.vp8_decode = function (data, type, ssrc) {
      function is_key_frame(data) {
        if(data.length <= 10) return 0;
        if(data.charCodeAt(0) & 1) return 0;
        //if(data.charCodeAt(3) != 0x9d) return 0;
        //if(data.charCodeAt(4) != 0x1) return 0;
        //if(data.charCodeAt(5) != 0x2a) return 0;
        return 1;
      }

      var video_playback = _video_playback.video_playback_array[ssrc];
      if(video_playback.vp8_waitI) {
        if(appSetting.wait_key_frame && !is_key_frame(data)) {
          request_decode_next_item(video_playback);
          return;
        }
        video_playback.vp8_waitI = false;
      }
      if(!video_playback.vp8_decoder) {
        try {
          video_playback.vp8_decoder = new Worker(WORKER_VP8_DECODE_PATH);
          video_playback.vp8_decoder.addEventListener('error', window.onerrorWorker, false);
          video_playback.vp8_decoder.postMessage({ command: 'init', good_worker: hmtgHelper.good_worker });
        } catch(e) {
          hmtg.jnkernel.jn_command_UnknownMedia(type, ssrc);
          request_decode_next_item(video_playback);
          return;
        }
        video_playback.vp8_decoder.onmessage = function (e) {
          switch(e.data.command) {
            case 'data_out':
              if(video_playback.quit_flag) {
                return;
              }
              //tick = hmtg.util.GetTickCount() - tick;
              //avg_tick += (tick - avg_tick) * 0.1;
              //hmtg.util.log(-2, '******debug, broadway.js decoding ' + e.data.width + 'x' + e.data.height + ',use ' + tick + 'ms,avg=' + ((avg_tick + 0.5) >> 0) + 'ms');

              if(video_playback.w != e.data.width || video_playback.h != e.data.height) {
                video_playback.w = e.data.width;
                video_playback.h = e.data.height;
                video_playback.canvas.width = video_playback.w;
                video_playback.canvas.height = video_playback.h;
                video_playback.idata = video_playback.ctx.createImageData(video_playback.w, video_playback.h);
              }

              video_playback.idata.data.set(e.data.data);
              video_playback.ctx.putImageData(video_playback.idata, 0, 0);

              _video_playback.draw_video(video_playback, ssrc);
            case 'data_error':
              if(video_playback.quit_flag) {
                return;
              }
              video_playback.busy = false;
              adjust_queue(video_playback);
              decode_next_item(video_playback);
              break;
            case 'crash':
              video_playback.vp8_decoder.onmessage = null;
              video_playback.vp8_decoder.postMessage({ command: 'exit' });
              video_playback.vp8_decoder = null;

              hmtg.util.log(-2, '******info, vp8 decoder crashed, terminate it...');

              video_playback.busy = false;
              adjust_queue(video_playback);
              decode_next_item(video_playback);
              break;
            default:
              break;
          }
        }
      }

      video_playback.busy = true;

      //tick = hmtg.util.GetTickCount();

      var uInt8Array = new Uint8Array(data.length - 1);
      for(var i = 0; i < uInt8Array.length; ++i) {
        uInt8Array[i] = data.charCodeAt(i);
      }

      if(hmtgHelper.good_worker) {
        video_playback.vp8_decoder.postMessage({ command: 'data_in', data: uInt8Array }, [uInt8Array.buffer]);
      } else {
        video_playback.vp8_decoder.postMessage({ command: 'data_in', data: uInt8Array });
      }
    }

    this.mjpg_decode = function (data, ssrc) {
      var video_playback = _video_playback.video_playback_array[ssrc];

      video_playback.busy = true;

      var uInt8Array = new Uint8Array(data.length);
      for(var i = 0; i < uInt8Array.length; ++i) {
        uInt8Array[i] = data.charCodeAt(i);
      }

      var blob;
      var url;
      try {
        blob = new Blob([uInt8Array], { type: 'image/jpeg' });
        url = window.URL.createObjectURL(blob);
      } catch(e) {
        if(video_playback.quit_flag) {
          return;
        }
        video_playback.busy = false;
        request_decode_next_item(video_playback);
        return;
      }
      var img = new Image();
      img.addEventListener("load", function () {
        window.URL.revokeObjectURL(url);

        if(video_playback.quit_flag) {
          return;
        }
        if(video_playback.w != img.width || video_playback.h != img.height) {
          video_playback.w = img.width;
          video_playback.h = img.height;
          video_playback.canvas.width = video_playback.w;
          video_playback.canvas.height = video_playback.h;
        }
        try {
          video_playback.ctx.drawImage(img, 0, 0);
        } catch(e) {
        }

        _video_playback.draw_video(video_playback, ssrc);

        video_playback.busy = false;
        adjust_queue(video_playback);
        decode_next_item(video_playback);
      }, false);
      img.addEventListener("error", function () {
        window.URL.revokeObjectURL(url);

        if(video_playback.quit_flag) {
          return;
        }
        video_playback.busy = false;
        adjust_queue(video_playback);
        decode_next_item(video_playback);
      }, false);
      img.src = url;
    }

  }
])

;
