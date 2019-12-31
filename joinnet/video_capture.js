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
    this.force_key_frame_flag = false;  // when true, the encoder need to force a key frame immediately
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext('2d');

    var WORKER_H264_ENCODE_PATH = 'worker/openh264_encoder.js' + hmtgHelper.cache_param;
    var WORKER_VPX_ENCODE_PATH = 'worker/vpx_encoder.js' + hmtgHelper.cache_param;

    this.event_quit_session = function () {
    }

    this.change_video_codec = function () {
      if(video_codec.video_codec == this.last_codec) return;
      this.last_codec = video_codec.video_codec;

      if(video_codec.video_codec == hmtg.config.VIDEO_MJPG) {
        hmtg.util.log('Use Mjpg video');
        this.video_encode = this.mjpg_encode;
      } else if(video_codec.video_codec == hmtg.config.VIDEO_H264) {
        hmtg.util.log('Use H264(openh264) video');
        this.video_encode = this.kazuki_encode;
      } else if(video_codec.video_codec == hmtg.config.VIDEO_VPX) {
        hmtg.util.log('Use VPX video');
        this.video_encode = this.kazuki_encode;
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
        // var target_jpg_size = bitrate / 8 / target_fps;
        // shift = calc_shift(target_jpg_size, elem_video.videoWidth, elem_video.videoHeight);
        var rounded_targetrate = ((hmtg.jnkernel._jn_targetrate() >> 16) + 1) << 16;
        var supported_area = rounded_targetrate / 0.6 / 1 / video_codec.fps;
        var img_size_encode_factor = 4; // any requirement of the size dimension, whole number of 2, or 4, or 8, etc.
        var w = elem_video.videoWidth >> img_size_encode_factor << img_size_encode_factor;
        var h = elem_video.videoHeight >> img_size_encode_factor << img_size_encode_factor;
        shift = shift = calc_supported_area_shift(supported_area, w, h);
      } else {
        // 0=>100%, 1=>25%, 2=>6%, 3=>1.5%, 4=>0.4%, 5=>0.1%
        shift = calc_shift2(-target_fps, elem_video.videoWidth, elem_video.videoHeight);
      }

      canvas.width = elem_video.videoWidth >> shift >> 4 << 4;
      canvas.height = elem_video.videoHeight >> shift >> 4 << 4;
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

    function calc_supported_area_shift(supported_area, w, h) {
      var shift = 0;
      var size2 = Math.min(w, h);
      var area = w * h;
      while((size2 >> shift) >= 16 && (area >> shift >> shift) > supported_area) {
        shift++;
      }

      return shift;
    }

    // https://github.com/kazuki/video-codec.js
    var kazuki_busy = false;  // if true, waiting for encoder's result
    var kazuki_encoder = null;  // encoder worker
    var kazuki_encoder_initialized = false; // whether the encoder has been initialized
    var kazuki_buffer = {}; // a buffer to save the captured frame as the encoder is busy
    var kazuki_current_encoder = 0; // could be h264 or vpx
    var kazuki_current_fps = 15;
    var kazuki_current_width = 16;
    var kazuki_current_height = 16;
    var kazuki_current_bitrate = 0;
    var kazuki_base_tick = hmtg.util.GetTickCount() - 1000; // reset when setup a new encoder
    var kazuki_vpx_qc_level = 16; // default QC level
    // the numbers below are obtained via testing with file tree.mp4
    var kazuki_vpx_avg_compression_ratio = {
      32: 0.005, // 32:63
      16: 0.01, // 16:31
      8: 0.02,  // 8:15
      4: 0.03, // 4:7
      2: 0.04, // 2:3
      1: 0.06, // 0:1
    };

    // estimate the initial target QC level from frame dimension, current target rate, frame rate
    function vpx_calc_qc_level(w, h)
    {
      var target_ratio = hmtg.jnkernel._jn_targetrate() / video_codec.fps / 8 / (w * h * 3);
      if(target_ratio < kazuki_vpx_avg_compression_ratio[32]) return 32;
      if(target_ratio < kazuki_vpx_avg_compression_ratio[16]) return 16;
      if(target_ratio < kazuki_vpx_avg_compression_ratio[8]) return 8;
      if(target_ratio < kazuki_vpx_avg_compression_ratio[4]) return 4;
      if(target_ratio < kazuki_vpx_avg_compression_ratio[2]) return 2;
      return 1;
    }

    // shared by H264 and VPX
    this.kazuki_encode = function(bitrate, elem_video) {
      if(!video_bitrate.is_send_video) {
        return;  // video sending stopped
      }

      // change dimension to multiple of 16 for video encoder
      // https://stackoverflow.com/questions/5024114/suggested-compression-ratio-with-h-264
      // https://www.securitycameraking.com/securityinfo/a-bit-on-bit-rates/
      // h.264 desired bitrate
      // [image width] x [image height] x [framerate] x [motion rank] x 0.07 = [desired bitrate]
      // the motion rank is an integer between 1 and 4, 
      // 1 being low motion, 2 being medium motion, and 4 being high motion
      var rounded_targetrate = ((hmtg.jnkernel._jn_targetrate() >> 16) + 1) << 16;
      var supported_area = rounded_targetrate / 0.07 / 1 / video_codec.fps;
      // need to be whole number of 16
      // otherwise there will be black margin at right and bottom side
      var img_size_encode_factor = 4; // multiple of 16
      var w = elem_video.videoWidth >> img_size_encode_factor << img_size_encode_factor;
      var h = elem_video.videoHeight >> img_size_encode_factor << img_size_encode_factor;
      if(w * h > supported_area) {
        var shift = calc_supported_area_shift(supported_area, w, h);
        w = elem_video.videoWidth >> shift >> img_size_encode_factor << img_size_encode_factor;
        h = elem_video.videoHeight >> shift >> img_size_encode_factor << img_size_encode_factor;
      }
      w = Math.max(16, w);
      h = Math.max(16, h);
      canvas.width = w;
      canvas.height = h;
      try {
        ctx.drawImage(elem_video, 0, 0, elem_video.videoWidth, elem_video.videoHeight, 0, 0, w, h);
      } catch(e) {
        return;
      }
      var img = ctx.getImageData(0, 0, w, h);

      var ts = hmtg.util.GetTickCount();
      // save the frame data to a buffer
      kazuki_buffer = {
        ts: ts,
        // timestamp: elem_video.currentTime,
        timestamp: (ts - kazuki_base_tick) / 1000,
        capture_width: elem_video.videoWidth,
        capture_height: elem_video.videoHeight,
        img: img
      };

      // if encoder busy or no budget, return quickly
      if(kazuki_busy || hmtg.jnkernel._jn_tokens() < 0) {
        return;
      }

      var need_setup = false; // whether need to allocate a new encoder
      var vpx_to_change_qc_level = false; // whether we need to change teh QC level
      var vpx_new_qc_level; // if so, the new QC level

      // check all the condition that trigger a new video encoder
      var condition_changed = false;
      if(_video_capture.force_key_frame_flag) {
        _video_capture.force_key_frame_flag = false;
        condition_changed = true;
      } else if(kazuki_current_width != w
        || kazuki_current_height != h
        || kazuki_current_fps != video_codec.fps
        || kazuki_current_encoder != video_codec.video_codec
        || (video_codec.video_codec == hmtg.config.VIDEO_H264 && kazuki_current_bitrate != rounded_targetrate)
      ) {
        condition_changed = true;
        // hmtg.util.log(-1, 'change found, w=' + w + ' vs ' + kazuki_current_width
        //   + ', h=' + h + ' vs ' + kazuki_current_height
        //   + ', fps=' + kazuki_current_fps + ' vs ' + video_codec.fps
        //   + ', bitrate=' + kazuki_current_bitrate + ' vs ' + rounded_targetrate
        //   + ', codec=' + kazuki_current_encoder + ' vs ' + video_codec.video_codec
        // );
      } else if(video_codec.video_codec == hmtg.config.VIDEO_VPX) {
        // check whether the QC level need to be modifed
        var vpx_expected_compression_ratio = hmtg.jnkernel._jn_targetrate() / video_codec.fps / 8 / (w * h * 3);
        var current_ratio = kazuki_vpx_avg_compression_ratio[kazuki_vpx_qc_level];
        if(current_ratio > vpx_expected_compression_ratio * 2) {
          // only try to increase the QC level every 20s
          if(ts - kazuki_base_tick > 20000) {
            if(kazuki_vpx_qc_level != 32) {
              vpx_to_change_qc_level = true;
              vpx_new_qc_level = kazuki_vpx_qc_level << 1;
            }
          }
        }
        else if(current_ratio < vpx_expected_compression_ratio / 2) {
          // only try to decrease the QC level every 60s
          if(ts - kazuki_base_tick > 60000) {
            if(kazuki_vpx_qc_level != 1) {
              vpx_to_change_qc_level = true;
              vpx_new_qc_level = kazuki_vpx_qc_level >> 1;
            }
          }
        }
        if(vpx_to_change_qc_level) {
          condition_changed = true;
        }
      }
      if(condition_changed) {
        // shut down the existing encoder if there is one
        if(kazuki_encoder) {
          kazuki_encoder.onmessage = null;
          kazuki_encoder.terminate();
        }
        kazuki_encoder = null;
      }

      if(!kazuki_encoder) {
        // create a new video encoder
        try {
          if(video_codec.video_codec == hmtg.config.VIDEO_H264) {
            kazuki_encoder = new Worker(WORKER_H264_ENCODE_PATH);
            kazuki_current_encoder = hmtg.config.VIDEO_H264;
          }
          if(video_codec.video_codec == hmtg.config.VIDEO_VPX) {
            kazuki_encoder = new Worker(WORKER_VPX_ENCODE_PATH);
            kazuki_current_encoder = hmtg.config.VIDEO_VPX;
          }
          need_setup = true;

          // flag not ready, wait the setup to return some results
          kazuki_encoder_initialized = false;
        } catch(e) {
          return;
        }
      }
      if(!kazuki_encoder) {
        // creation fails
        return;
      }

      function check_buffer() {
        // check whether the next frame is ready
        if(hmtg.jnkernel._jn_tokens() < 0) {
          return;
        }
        if(!video_bitrate.is_send_video) {
          kazuki_buffer = null;
          return;  // video sending stopped
        }
        if(!kazuki_buffer) {
          return;
        }
        if(kazuki_current_width != kazuki_buffer.img.width
          || kazuki_current_height != kazuki_buffer.img.height
          || kazuki_current_encoder != video_codec.video_codec
        ) {
          // incompatible, skip it
          kazuki_buffer = null;
          return;
        }
        var ts2 = hmtg.util.GetTickCount();
        if(ts2 - kazuki_buffer.ts > 100) {
          // the buffer is too old (+100ms), skip it
          kazuki_buffer = null;
          return;
        }
        encode_frame(kazuki_buffer, ts2);
        kazuki_buffer = null;
      }

      function setup_handler(e) {
        kazuki_busy = false;
        if(e.data && e.data.status == 0) {
          // flag as ready
          kazuki_encoder_initialized = true;
          // change message handler
          kazuki_encoder.onmessage = encode_handler;
          // check buffer immediately
          check_buffer();
        } else {
          kazuki_encoder.onmessage = null;
          kazuki_encoder.terminate();
          kazuki_encoder = null;
          // hmtg.util.log(2, 'kazuki encoder setup fails');
        }
      }

      if(need_setup) {
        // setup process is here
        if(vpx_to_change_qc_level) {
          // hmtg.util.log(2, 'VPX changes qc level from ' + kazuki_vpx_qc_level + ' to ' + vpx_new_qc_level);
          kazuki_vpx_qc_level = vpx_new_qc_level;
        } else {
          kazuki_vpx_qc_level = vpx_calc_qc_level(w, h);
          // hmtg.util.log(-1, 'in setup, vpx init qc level=' + kazuki_vpx_qc_level);
        }
        kazuki_current_width = w;
        kazuki_current_height = h;
        kazuki_current_fps = video_codec.fps > 0 ? video_codec.fps : 25;
        kazuki_current_bitrate = ((hmtg.jnkernel._jn_targetrate() >> 16) + 1) << 16;
        kazuki_current_encoder = video_codec.video_codec;
        kazuki_base_tick = ts;
        kazuki_buffer.timestamp = 0;  // because the base_tick is updated, reset the timestamp to 0
        // hmtg.util.log(-1, 'to setup, w=' + w + ', h=' + h + ', fps=' + kazuki_current_fps + ', bitrate=' + kazuki_current_bitrate + ', codec=' + kazuki_current_encoder);

        try {
          kazuki_encoder.onmessage = setup_handler;

          // for H264, use quality rc control (rc_mode = 0)
          // for VPX, use constant quality rc control (rc_end_usage = 3)
          var encoder_cfg =
            kazuki_current_encoder == hmtg.config.VIDEO_H264 ?
            {
              'usage': 0, // camera
              'rc_mode': 0, // 0: quality; 1: bitrate
              'bitrate': kazuki_current_bitrate,
              'ref_frames': -1,
              'complexity': 0,  // low
              'entropy_coding': 0, // CAVLC
              'denoise': 0,
              'background_detection': 1,
              'adaptive_quant': 1,
              'scene_change_detect': 1,
              'keyframe_interval': kazuki_current_fps * 10 // 10s
            } :
            {
              'version': 8, // vp8 or 9
              'cpuused': 16, // fast
              'rc_end_usage': 3, // 0: VBR, 1: CBR, 3: const quality
              'lag_in_frames': 0, //disabled
              // https://chromium.googlesource.com/webm/libvpx/+/frame_parallel/vpx/vpx_encoder.h
              'kf_mode': 1, // key frame mode. 0: disabled, 1: auto?
              // VP8 has several display issue when packet loss occurs
              // set key frame interval at around 5s
              'kf_min_dist': kazuki_current_fps * 5, // 5s
              'kf_max_dist': kazuki_current_fps * 5, // 5s
              'rc_target_bitrate': ((kazuki_current_bitrate / 1000) >> 0), // in kbps
              'cq_level': kazuki_vpx_qc_level,
              'rc_min_quantizer': (kazuki_vpx_qc_level == 1 ? 0 : kazuki_vpx_qc_level),
              'rc_max_quantizer': ((kazuki_vpx_qc_level << 1) - 1)
              // 'rc_min_quantizer': 0,
              // 'rc_max_quantizer': 63
            };
          ;

          kazuki_busy = true;
          kazuki_encoder.postMessage({
            width: w,
            height: h,
            fps_num: kazuki_current_fps,
            fps_den: 1,
            params: encoder_cfg
          });
        } catch(e) {
          return;
        }
        return;
      }

      if(!kazuki_encoder_initialized)
        return;

      function encode_handler(e) {
        kazuki_busy = false;
        if(e.data && e.data.data && e.data.status == 0) {
          if(kazuki_current_encoder == hmtg.config.VIDEO_VPX) {
            var this_ratio = e.data.data.byteLength / (kazuki_current_width * kazuki_current_height * 3);
            kazuki_vpx_avg_compression_ratio[kazuki_vpx_qc_level] += (this_ratio - kazuki_vpx_avg_compression_ratio[kazuki_vpx_qc_level]) * 0.01;
            // var target_ratio = hmtg.jnkernel._jn_targetrate() / video_codec.fps / 8 / (kazuki_current_width * kazuki_current_height * 3);
            // hmtg.util.log(-1, 'ratio update, level=' + kazuki_vpx_qc_level + ',size=' + e.data.data.byteLength + ', ratio=' + this_ratio + ', avg=' + kazuki_vpx_avg_compression_ratio[kazuki_vpx_qc_level] + ', target=' + target_ratio);
          }
          // hmtg.util.log(-1, '******debug, len='+e.data.data.byteLength);
          var buffer = new Uint8Array(e.data.data.byteLength + 1);
          buffer.set(new Uint8Array(e.data.data));
          buffer[buffer.length - 1] = kazuki_current_encoder == hmtg.config.VIDEO_H264 ? 0 : 0;
          var frame = hmtg.jnkernel.jn_command_write_timestamp_given(
            kazuki_current_encoder,
            buffer, ts, _video_capture.pktno);
          // if(Math.random() < 0.98)
          hmtg.jnkernel.jn_command_send_video_pkt(frame);
          //if(!(_video_capture.pktno & 0x3f)) hmtg.util.log(-2, '******debug, send video frame, size=' + frame.length() + ',pktno=' + _video_capture.pktno);
          _video_capture.pktno++;
        // } else {
        //   if(e.data && e.data.data) {
        //     hmtg.util.log('kazuki encoder encode() fails, result=' + JSON.stringify(e.data));
        //   } else {
        //     hmtg.util.log(-1, 'kazuki encoder encode() fails');
        //   }
        }

        check_buffer();
      }

      function encode_frame(buffer, ts) {
        var ts = buffer.ts;
        var img = buffer.img;
        var stat = _video_capture.stat;
        if(!stat) {
          stat = _video_capture.stat = {};
          // init
          stat.count = 0;
          stat.start_tick = stat.last_tick = ts - 100000;
        }
        stat.capture_width = buffer.capture_width;
        stat.capture_height = buffer.capture_height;
        stat.sending_width = img.width;
        stat.sending_height = img.height;
        video_bitrate.count_fps(stat, ts);

        kazuki_busy = true;
        _video_capture._buf = new ArrayBuffer(w * h * 1.5);
        _video_capture._y = new Uint8ClampedArray(_video_capture._buf, 0, img.width * img.height);
        _video_capture._u = new Uint8ClampedArray(_video_capture._buf, img.width * img.height, img.width * img.height / 4);
        _video_capture._v = new Uint8ClampedArray(_video_capture._buf, img.width * img.height * 1.25, img.width * img.height / 4);

        var rgba = img.data;
        for(var y = 0, j = 0; y < img.height; y += 2) {
          var p = y * img.width;
          for(var x = 0; x < img.width; x += 2, ++j) {
            var pp = p + x;
            var pw = pp + img.width;
            var p0 = pp * 4;
            var p1 = pw * 4;
            var r0 = rgba[p0], g0 = rgba[p0 + 1], b0 = rgba[p0 + 2];
            var r1 = rgba[p0 + 4], g1 = rgba[p0 + 5], b1 = rgba[p0 + 6];
            var r2 = rgba[p1], g2 = rgba[p1 + 1], b2 = rgba[p1 + 2];
            var r3 = rgba[p1 + 4], g3 = rgba[p1 + 5], b3 = rgba[p1 + 6];
            _video_capture._y[pp] = Math.floor(0.257 * r0 + 0.504 * g0 + 0.098 * b0 + 16);
            _video_capture._y[pp + 1] = Math.floor(0.257 * r1 + 0.504 * g1 + 0.098 * b1 + 16);
            _video_capture._y[pw] = Math.floor(0.257 * r2 + 0.504 * g2 + 0.098 * b2 + 16);
            _video_capture._y[pw + 1] = Math.floor(0.257 * r3 + 0.504 * g3 + 0.098 * b3 + 16);
            _video_capture._u[j] = Math.floor(-0.148 * r0 - 0.291 * g0 + 0.439 * b0 + 128);
            _video_capture._v[j] = Math.floor(0.439 * r1 - 0.368 * g1 - 0.071 * b1 + 128);
          }
        }
        if(hmtgHelper.good_worker) {
          kazuki_encoder.postMessage({
            timestamp: buffer.timestamp,
            ended: false,
            width: w,
            height: h,
            data: _video_capture._buf,
            y: _video_capture._y,
            u: _video_capture._u,
            v: _video_capture._v,
            transferable: hmtgHelper.good_worker
          }, [_video_capture._buf]);
        } else {
          kazuki_encoder.postMessage({
            timestamp: buffer.timestamp,
            ended: false,
            width: w,
            height: h,
            data: _video_capture._buf,
            y: _video_capture._y,
            u: _video_capture._u,
            v: _video_capture._v,
            transferable: hmtgHelper.good_worker
          });
        }
      }
      encode_frame(kazuki_buffer, ts);
      kazuki_buffer = null;
    }
  }
])

;
