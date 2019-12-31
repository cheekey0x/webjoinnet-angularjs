/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('video_bitrate', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope', 'hmtgSound',
  function ($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope, hmtgSound) {
    var _video_bitrate = this;
    this.min_bitrate = 10000;
    this.max_bitrate = 10000000;
    this.bitrate_str = '';
    this.bitrate_pos = 100;
    this.is_send_video = appSetting.auto_send_video;

    this.update_bitrate = function () {
      this.max_bitrate = Math.max(this.min_bitrate, hmtg.jnkernel._jn_iAdjustedMaxBandwidth() - hmtg.jnkernel._jn_audio_rate());
      //this.bitrate_str = '' + ((hmtg.jnkernel._jn_targetrate() / 1000) >>> 0) + 'kbps';
      this.bitrate_str = '' + hmtgHelper.number2gmk(hmtg.jnkernel._jn_targetrate()) + 'bps';
      if(this.max_bitrate == this.min_bitrate) {
        this.can_change_bitrate = false;
      } else {
        this.can_change_bitrate = true;
        this.bitrate_pos = (hmtg.jnkernel._jn_targetrate() - this.min_bitrate) / (this.max_bitrate - this.min_bitrate) * 100;
      }

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }

    this.count_fps = function (stat, tick) {
      stat.count++;

      if(((tick - stat.last_tick) >>> 0) > 10000) {
        stat.start_tick = tick;
        stat.count = 0;
      } else if(tick - stat.start_tick > 3000) {
        stat.rate = 0;
        if(stat.count > 0) {
          stat.tick = tick;
          stat.rate = stat.count * 1000 / (tick - stat.start_tick);
        }
        stat.start_tick = tick;
        stat.count = 0;
      }
      stat.last_tick = tick;
    }
  }
])

.service('video_codec', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope', 'hmtgSound', 'video_bitrate',
  function ($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope, hmtgSound, video_bitrate) {
    var _video_codec = this;
    this.video_codecs = [];
    this.video_codec = 0;
    this.afps = [
      // { name: '100%', value: 0 },
      // { name: '25%', value: -1 },
      // { name: '6%', value: -2 },
      // { name: '1.5%', value: -3 },
      // { name: '0.4%', value: -4 },
      // { name: '0.1%', value: -5 },
      { name: '1fps', value: 1 },
      { name: '2fps', value: 2 },
      { name: '5fps', value: 5 },
      { name: '10fps', value: 10 },
      { name: '15fps', value: 15 },
      { name: '20fps', value: 20 },
      { name: '25fps', value: 25 }
    ];
    this.fps = appSetting.video_fps;

    this.launch_from_jnj = function () {
      this.video_codec = 0;
    }

    this.reset = function () {
      this.video_codecs = [];
      /*
      if(this.change_video_codec_timerID) {
      clearTimeout(this.change_video_codec_timerID);
      this.change_video_codec_timerID = null;
      }
      */

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }

    this.net_init_finished = function () {
      var array = hmtg.jnkernel._jn_video_codec_array();
      if(!array) return;
      var i;
      var my_codec = 0;
      var is_current_codec_valid = false;
      for(i = 0; i < array.length; i++) {
        var c = array[i];
        if(c == hmtg.config.VIDEO_MJPG) {
          this.video_codecs.push({ name: 'Mjpg', value: c });
          if(!my_codec) my_codec = c;
          if(this.video_codec == c) is_current_codec_valid = true;
        }
        else if(c == hmtg.config.VIDEO_H264) {
          this.video_codecs.push({ name: 'H264', value: c });
          my_codec = c;
          if(this.video_codec == c) is_current_codec_valid = true;
        }
        else if(c == hmtg.config.VIDEO_VPX) {
          this.video_codecs.push({ name: 'VPX', value: c });
          if(!my_codec || my_codec == hmtg.config.VIDEO_MJPG) my_codec = c;
          if(this.video_codec == c) is_current_codec_valid = true;
        }
      }
      if(!is_current_codec_valid) this.video_codec = my_codec;

      if(!this.video_codec) {
        if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL)
          hmtg.util.log('no common video codec');
      }

      video_bitrate.update_bitrate();
    }

  }
])

;
