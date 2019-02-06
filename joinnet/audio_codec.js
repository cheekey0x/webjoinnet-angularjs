/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('audio_codec', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope', 'hmtgSound',
  function ($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope, hmtgSound) {
    var _audio_codec = this;
    this.audio_codecs = [];
    this.max_opus_bitrate = 256000;
    this.min_opus_bitrate = 12000;
    this.opus_bitrate_pos = 100;
    this.opus_bitrate = 0;
    this.g711_bitrate = 67520;  // ((8 * 50ms) + 21 + 1) * 8 / 50ms = 422 * 8 / 50 = 67520
    //this.g711_bitrate_str = '' + ((this.g711_bitrate / 1000) >>> 0) + 'kbps';
    this.g711_bitrate_str = '' + hmtgHelper.number2gmk(this.g711_bitrate) + 'bps';
    this.audio_codec = 0;
    this.audio_bitrate_str = '';

    this.launch_from_jnj = function () {
      this.opus_bitrate = 0;
      this.audio_codec = 0;
      this.max_opus_bitrate = 256000;
    }

    this.reset = function () {
      this.audio_codecs = [];
      /*
      if(this.change_opus_bitrate_timerID) {
      clearTimeout(this.change_opus_bitrate_timerID);
      this.change_opus_bitrate_timerID = null;
      }
      if(this.change_audio_codec_timerID) {
      clearTimeout(this.change_audio_codec_timerID);
      this.change_audio_codec_timerID = null;
      }
      */

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }

    this.net_init_finished = function () {
      var array = hmtg.jnkernel._jn_audio_codec_array();
      if(!array) return;
      var i;
      var my_codec = 0;
      var is_current_codec_valid = false;
      for(i = 0; i < array.length; i++) {
        var c = array[i];
        if(c == hmtg.config.AUDIO_OPUS) {
          this.audio_codecs.push({ name: 'Opus', value: c });
          my_codec = c;
          if(this.audio_codec == c) is_current_codec_valid = true;
        } else if(c == hmtg.config.AUDIO_G711) {
          this.audio_codecs.push({ name: 'G711', value: c });
          if(!my_codec) my_codec = c;
          if(this.audio_codec == c) is_current_codec_valid = true;
        }
      }
      if(!is_current_codec_valid) this.audio_codec = my_codec;

      if(!this.audio_codec) {
        if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL)
          hmtg.util.log('no common audio codec');
      }

      this.is_opus_audio = this.audio_codec == hmtg.config.AUDIO_OPUS;
      this.max_opus_bitrate = hmtgHelper.get_opus_bitrate();
      if(this.opus_bitrate < this.min_opus_bitrate || this.opus_bitrate > this.max_opus_bitrate) this.opus_bitrate = this.max_opus_bitrate;
      //this.opus_bitrate_str = '' + ((this.opus_bitrate / 1000) >>> 0) + 'kbps';
      this.opus_bitrate_str = '' + hmtgHelper.number2gmk(this.opus_bitrate) + 'bps';
      if(this.max_opus_bitrate < 13000) {
        this.can_change_opus_bitrate = false;
      } else {
        this.can_change_opus_bitrate = true;
        this.opus_bitrate_pos = (this.opus_bitrate - this.min_opus_bitrate) / (this.max_opus_bitrate - this.min_opus_bitrate) * 100;
      }

    }

  }
])

;
