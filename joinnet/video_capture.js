/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('video_capture', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope', 'hmtgSound', 'video_codec', 'video_bitrate',
  function ($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope, hmtgSound, video_codec, video_bitrate) {
    var _video_capture = this;
    this.pktno = 0;
    this.last_codec = 0;
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext('2d');

    this.event_quit_session = function () {
    }

    this.change_video_codec = function () {
      if(video_codec.video_codec == this.last_codec) return;
      this.last_codec = video_codec.video_codec;

      if(video_codec.video_codec == hmtg.config.VIDEO_MJPG) {
        hmtg.util.log('Use Mjpg video');
        this.video_encode = this.mjpg_encode;
      } else {
        this.video_encode = null;
      }
    }

    var last_send_tick = hmtg.util.GetTickCount() - 10000;
    var last_send_timespan = 20;
    var avg_jpg_size = {};
    var reading = false;
    var last_encode_print_tick = last_send_tick;
    var encode_print_count = 0;

    this.mjpg_encode = function(bitrate, elem_video) {
      //var JPG_QUAL = 0.92;
      var JPG_QUAL = 0.5;

      /*
      function mylog(str) {
        var now = hmtg.util.GetTickCount();
        if(encode_print_count < 100 || now - last_encode_print_tick > 10000) {
          last_encode_print_tick = now;
          encode_print_count++;
          hmtg.util.log(9, '******debug, mjpg_encode, ' + str);
        }
      }
      */
      
      if(reading) {
        //mylog('skipped, still reading last frame');
        return; // still reading last video frame
      }
      if(!video_bitrate.is_send_video) {
        //mylog('skipped, video sending status is off');
        return;  // video sending stopped
      }

      var ts = hmtg.util.GetTickCount();

      if(ts - last_send_tick < last_send_timespan) {
        //mylog('skipped, too near to last sending event');
        return;
      }
      if(hmtg.jnkernel._jn_tokens() < 0) {
        //mylog('skipped, no token available');
        return;
      }

      var stat = _video_capture.stat;
      if(!stat) {
        stat = _video_capture.stat = {};
        // init
        stat.count = 0;
        stat.start_tick = stat.last_tick = ts - 100000;
      }
      video_bitrate.count_fps(stat, ts);

      var shift = 0;
      var target_fps = video_codec.fps;
      if(target_fps > 0) {
        var target_jpg_size = bitrate / 8 / target_fps;
        shift = calc_shift(target_jpg_size, elem_video.videoWidth, elem_video.videoHeight);
      } else {
        // 0=>100%, 1=>25%, 2=>6%, 3=>1.5%, 4=>0.4%, 5=>0.1%
        shift = calc_shift2(-target_fps, elem_video.videoWidth, elem_video.videoHeight);
      }

      canvas.width = elem_video.videoWidth >> shift >> 1 << 1;
      canvas.height = elem_video.videoHeight >> shift >> 1 << 1;
      stat.capture_width = elem_video.videoWidth;
      stat.capture_height = elem_video.videoHeight;
      stat.sending_width = canvas.width;
      stat.sending_height = canvas.height;
      var area = canvas.width * canvas.height;
      try {
        ctx.drawImage(elem_video, 0, 0, elem_video.videoWidth, elem_video.videoHeight, 0, 0, canvas.width, canvas.height);
      } catch(e) {
        //mylog('error, drawImage fails, ' + hmtgSound.getUserMediaError(e));
      }
      if(canvas.toBlob) {
        reading = true;
        try {
          canvas.toBlob(function (blob) {
            save_jpg_size(area, blob.size);

            last_send_timespan = blob.size * hmtg.config.MTU_SIZE / (hmtg.config.MTU_SIZE - hmtg.config.TS_SIZE) * 8000 / bitrate;
            last_send_tick = ts;

            var reader = new FileReader();
            reader.onload = function(e) {
              reading = false;
              _video_capture.send_mjpg_frame(new Uint8Array(e.target.result), ts);
            }
            reader.onerror = function(e) {
              //mylog('error, read blob fails, ' + hmtgSound.getUserMediaError(e));
              reading = false;
            };

            reader.readAsArrayBuffer(blob);
          }, 'image/jpeg', JPG_QUAL);
        } catch(e) {
          reading = false;
          //mylog('error, toBlob fails, ' + hmtgSound.getUserMediaError(e));
          if(e.code == 18) {
            // once tainted, the canvas may be always tagged as tainted. need to create a new one
            canvas = document.createElement("canvas");
            ctx = canvas.getContext('2d');
            return 'security';
            //hmtg.util.log(-2, '******debug, security error, e=' + e.toString());
          }
          return;
        }
      } else {
        try {
          var url = canvas.toDataURL('image/jpeg', JPG_QUAL);
        } catch(e) {
          //mylog('error, toDataURL fails, ' + hmtgSound.getUserMediaError(e));
          if(e.code == 18) {
            // once tainted, the canvas may be always tagged as tainted. need to create a new one
            canvas = document.createElement("canvas");
            ctx = canvas.getContext('2d');
            return 'security';
            //hmtg.util.log(-2, '******debug, security error, e=' + e.toString());
          }
          return;
        }
        var parts = url.split(',');
        var byteString;
        if(parts[0].indexOf('base64') >= 0)
          byteString = hmtg.util.decode64(parts[1]);
        else
          byteString = unescape(parts[1]);

        save_jpg_size(area, byteString.length);

        last_send_timespan = byteString.length * hmtg.config.MTU_SIZE / (hmtg.config.MTU_SIZE - hmtg.config.TS_SIZE) * 8000 / bitrate;
        last_send_tick = ts;

        _video_capture.send_mjpg_frame(byteString, ts);
      }

      // create jpg size for prev and next area
      if(!avg_jpg_size[area << 2]) {
        canvas.width <<= 1;
        canvas.height <<= 1;
        try {
          ctx.drawImage(elem_video, 0, 0, elem_video.videoWidth, elem_video.videoHeight, 0, 0, canvas.width, canvas.height);
          var url = canvas.toDataURL('image/jpeg', JPG_QUAL);
          var parts = url.split(',');
          var byteString;
          if(parts[0].indexOf('base64') >= 0)
            byteString = hmtg.util.decode64(parts[1]);
          else
            byteString = unescape(parts[1]);
          save_jpg_size(canvas.width * canvas.height, byteString.length);
        } catch(e) {
          //mylog('drawImage(2) fails, error: ' + hmtgSound.getUserMediaError(e));
        }
      } else if(!avg_jpg_size[area >> 2]) {
        canvas.width >>= 1;
        canvas.height >>= 1;
        try {
          ctx.drawImage(elem_video, 0, 0, elem_video.videoWidth, elem_video.videoHeight, 0, 0, canvas.width, canvas.height);
          var url = canvas.toDataURL('image/jpeg', JPG_QUAL);
          var parts = url.split(',');
          var byteString;
          if(parts[0].indexOf('base64') >= 0)
            byteString = hmtg.util.decode64(parts[1]);
          else
            byteString = unescape(parts[1]);
          save_jpg_size(canvas.width * canvas.height, byteString.length);
        } catch(e) {
          //mylog('drawImage(3) fails, error: ' + hmtgSound.getUserMediaError(e));
        }
      }

      function estimate_jpg_size(area) {
        // size estimation:
        // when jpeg size reach ~1k, do not decreases any more.
        // 640x480, 300k => 15k
        // 320x240, 76k => 6k
        // 160x120, 20k => 3k
        // 80x60, 5k => 1.5k
        // 40x30, 1k => 1k
        if(area < 1000) return 1000;
        else if(area < 5000) return 1500;
        else if(area < 20000) return 3000;
        else if(area < 75000) return 6000;
        else if(area < 300000) return 15000;
        return 60000;
      }

      function get_jpg_size(area) {
        if(avg_jpg_size[area]) {
          return avg_jpg_size[area];
        } else {
          return estimate_jpg_size(area);
        }
      }

      function save_jpg_size(area, jpg_size) {
        if(avg_jpg_size[area]) {
          return avg_jpg_size[area] += ((jpg_size - avg_jpg_size[area]) >> 3);
        } else {
          avg_jpg_size[area] = jpg_size;
        }
      }

      function calc_shift(target_jpg_size, w, h) {
        if(target_jpg_size < 1000) target_jpg_size = 1000;

        var shift = 0;
        //var size = Math.max(w, h);
        var size2 = Math.min(w, h);
        var area = w * h;
        var shift_area = area >> shift >> shift;
        while((size2 >> shift) >= 16 && get_jpg_size(area >> shift >> shift) > target_jpg_size * 1.4) {
          shift++;
        }
        while((size2 >> shift) >= 4096) {
          shift++;
        }

        return shift;
      }

      function calc_shift2(target_shift, w, h) {
        var shift = 0;
        var size2 = Math.min(w, h);
        while((size2 >> shift) >= 16 && shift < target_shift) {
          shift++;
        }
        while((size2 >> shift) >= 4096) {
          shift++;
        }

        return shift;
      }

    }

    this.send_mjpg_frame = function (data, ts) {
      var frame = hmtg.jnkernel.jn_command_write_timestamp_given(
        hmtg.config.VIDEO_MJPG,
        data, ts, _video_capture.pktno);
      hmtg.jnkernel.jn_command_send_video_pkt(frame);
      //if(!(_video_capture.pktno & 0x3f)) hmtg.util.log(-2, '******debug, send video frame, size=' + frame.length() + ',pktno=' + _video_capture.pktno);
      _video_capture.pktno++;
    }

  }
])

;
