angular.module('joinnet')
.controller('DTCtrl', ['$scope', 'hmtgHelper', 'joinnetHelper', '$rootScope', 'hmtgAlert', 'hmtgSound', '$translate', 'JoinNet',
  'appSetting', '$ocLazyLoad', 'sdt', 'rdc', 'video_bitrate', 'joinnetVideo',
  function($scope, hmtgHelper, joinnetHelper, $rootScope, hmtgAlert, hmtgSound, $translate, JoinNet, appSetting, $ocLazyLoad,
    sdt, rdc, video_bitrate, joinnetVideo) {
    var dt = $scope.dt = {};
    $scope.as = appSetting;
    $scope.jv = joinnetVideo;
    dt.is_sdt = true;
    dt.channel = -1;
    dt.m_dwRecvPriority = 0;
    //dt.m_iDstBitCount = 24;
    //dt.m_wDstCapSequence = 0;
    //dt.m_iClrUsed = 0;
    dt.m_ConnectStatus = 0;  // 0: disconnected, 1: connecting, 2: connected
    dt.m_bFrameEnd = true;
    dt.width = 0;
    dt.height = 0;

    dt.bmp = null;
    // canvas method, use rect -> canvas image data
    dt.canvas0 = document.createElement("canvas");  // source canvas, receive the rect, may be zoomed
    dt.ctx0 = dt.canvas0.getContext('2d');
    dt.image_data = null;
    dt.color_table = typeof Uint8ClampedArray !== 'undefined' ? new Uint8ClampedArray(256 * 4) : new Uint8Array(256 * 4);

    dt.cursor_img = new Image();
    dt.cursor_img.src = "img/cursor.png";
    dt.cursor_x = -1;
    dt.cursor_y = -1;
    dt.MIN_SIZE = 160;
    dt.MAX_SIZE = hmtgHelper.isiOS ? 2048 : 4096;
    dt.img_timerID = null;

    dt.is_fullscreen = false;
    dt.is_fit_page = true;
    dt.ratio_pos = 100;
    dt.ratio_percent = 100;
    dt.min_ratio = 0.01;
    dt.max_ratio = 1.0;
    dt.is_receive = true;
    dt.sync_tab_controller = -1;
    dt.is_sync_tab_controller = false;
    dt.min_bitrate = 20000;
    dt.max_bitrate = 100000000;

    var DT_ENCODER_PATH = 'worker/dt_encode.js' + hmtgHelper.cache_param;
    var DT_DECODER_PATH = 'worker/dt_decode.js' + hmtgHelper.cache_param;
    var dt_decoder = null;
    try {
      dt_decoder = new Worker(DT_DECODER_PATH);
      dt_decoder.addEventListener('error', window.onerrorWorker, false);
      dt_decoder.postMessage({ command: 'init', good_worker: hmtgHelper.good_worker });
    } catch(e) {
    }

    //hmtg.util.log(-2, '******debug, DTCtrl');

    // http://en.wikipedia.org/wiki/BMP_file_format
    // http: //en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering
    //   * 7
    // 3 5 1
    // safety palette
    // https://msdn.microsoft.com/en-us/library/bb250466(v=vs.85).aspx

    // http://en.wikipedia.org/wiki/List_of_software_palettes
    // master palettes
    // 1bit, 2 color, 16, 240; gray >> 7
    // 2bit, 4 color, 32, 96, 160, 224; gray >> 6
    // 4bit, 16 grayscale, 8, 24, 40, 56, 72, 88, 104, 120, 136, 152, 168, 184, 200, 216, 232, 248; gray >> 4
    /*
    4bit, 16 color palette, 8color + 8gray  (64, 192), 16, 48, 80, 112, 144, 176, 208, 240
    64, 192
    256/10 (2 existing values from the 8 colors)
    256/10/2 + 256/10*x (x = [0, 10))
    var i = 0; var s = ''; for(i=0;i<10;i++) {var t = (256/10/2 + 256/10*i + 0.5) >> 0; s += '' + t + ',';}
    13,38,64,90,115,141,166,192,218,243, =>
    13,38,90,115,141,166,218,243
    */
    // 8bit, 256 grayscale, simply gray
    /*
    8bit, 256 color palette, 216color + 40gray
    0x0, 33, 66, 99, cc, ff
    0, 51, 102, 153, 204, 255
    256/46 (6 existing values from the 216 colors)
    256/46/2 + 256/46*x (x = [0, 46))
    var i = 0; var s = ''; for(i=0;i<46;i++) {var t = (256/46/2 + 256/46*i + 0.5) >> 0; s += '' + t + ',';}
    3,8,14,19,25,31,36,42,47,53,58,64,70,75,81,86,92,97,103,109,114,120,125,131,136,142,147,153,159,164,170,175,181,186,192,198,203,209,214,220,225,231,237,242,248,253, =>
    8,14,19,25,31,36,42,47,58,64,70,75,81,86,92,97,109,114,120,125,131,136,142,147,159,164,170,175,181,186,192,198,209,214,220,225,231,237,242,248
    */

    var palette_1bit = '';
    var palette_2bit = '';  // 2bit (4 color) seems not working for windows
    var palette_4bit = '';
    var palette_4bit_g = '';
    var palette_8bit = '';
    var palette_8bit_g = '';
    init_palette();
    function init_palette() {
      // 1 bit
      palette_1bit = String.fromCharCode(16, 16, 16, 0, 240, 240, 240, 0);
      var i, j, k;

      // 2 bit
      for(i = 32; i < 255; i += 64) {
        palette_2bit += String.fromCharCode(i, i, i, 0);
      }

      // 4 bit grayscale
      for(i = 8; i < 255; i += 16) {
        palette_4bit_g += String.fromCharCode(i, i, i, 0);
      }

      // 4 bit
      for(i = 0; i < 2; i++) {
        for(j = 0; j < 2; j++) {
          for(k = 0; k < 2; k++) {
            var r = i ? 192 : 64;
            var g = j ? 192 : 64;
            var b = k ? 192 : 64;
            palette_4bit += String.fromCharCode(b, g, r, 0);
          }
        }
      }
      var palette_4bit_gray = [13, 38, 90, 115, 141, 166, 218, 243];
      for(i = 0; i < 8; i++) {
        palette_4bit += String.fromCharCode(palette_4bit_gray[i], palette_4bit_gray[i], palette_4bit_gray[i], 0);
      }

      // 8 bit grayscale
      for(i = 0; i < 256; i++) {
        palette_8bit_g += String.fromCharCode(i, i, i, 0);
      }

      // 8 bit
      /*
      for(i = 0; i < 256; i++) {
      var r = i & 0xe0;
      var g = (i << 3) & 0xe0;
      var b = (i << 6) & 0xc0;
      palette_8bit += String.fromCharCode(b, g, r, 0);
      }
      */
      for(i = 0; i < 6; i++) {
        for(j = 0; j < 6; j++) {
          for(k = 0; k < 6; k++) {
            var r = i * 51;
            var g = j * 51;
            var b = k * 51;
            palette_8bit += String.fromCharCode(b, g, r, 0);
          }
        }
      }
      var palette_8bit_gray = [8, 14, 19, 25, 31, 36, 42, 47, 58, 64, 70, 75, 81, 86, 92, 97, 109, 114, 120, 125, 131, 136, 142, 147, 159, 164, 170, 175, 181, 186, 192, 198, 209, 214, 220, 225, 231, 237, 242, 248];
      for(i = 0; i < 40; i++) {
        palette_8bit += String.fromCharCode(palette_8bit_gray[i], palette_8bit_gray[i], palette_8bit_gray[i], 0);
      }
    }


    var buffer = '';
    var expected = 0x7fffffff;
    var has_first = false;
    var decode_timerID = null;
    var pkt_array = [];
    var m_ClrTable = [];
    var busy = false;

    $scope.init = function(target_guid) {
      hmtgHelper.inside_angular++;
      //hmtg.util.log(-2, '******debug, plugin init for guid ' + target_guid);
      var i;
      var array = hmtg.jnkernel._jn_plugin_data();
      for(i = 0; i < hmtg.config.MAX_PLUG_IN_CHANNEL; i++) {
        if(array[i] && array[i]._active() && array[i]._guid_str() == target_guid) {
          new_plugin_init(i);
          if(array[i]._static_data()) {
            hmtg.jnkernel.jn_callback_PlugInSetStaticDataResponse(0, i, array[i]._static_data());
            //hmtg.util.log(-2, '******debug, channel ' + i + ' process static data');
          }
          break;
        }
      }
      hmtgHelper.inside_angular--;
    }

    $scope.on_new_plugin = function(target_guid, error_code, request_id, channel) {
      if(error_code) {
        dt.m_ConnectStatus = 0;
        rdc.is_control = false;
        if(!hmtgHelper.inside_angular) $scope.$digest();
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('IDS_ALLOCATE_CHANNEL_FAIL').replace('%1$d', error_code) }, 10);
        return;
      }
      //hmtg.jnkernel.jn_command_PlugInSetRecvingPrio(channel, 0);

      var array = hmtg.jnkernel._jn_plugin_data();
      var guid_str = array[channel]._guid_str();
      if(guid_str != target_guid) return;
      new_plugin_init(channel);
    }

    function new_plugin_init(channel) {
      dt.channel = channel;
      JoinNet.is_appdata_ready[channel] = true;
      dt.update_bitrate();
      //hmtg.util.log(-2, '******debug, set appdata channel ' + channel + ' status ready in on new plugin');
      JoinNet.callback_PlugInSetStaticDataResponse[channel] = $scope.callback_PlugInSetStaticDataResponse;
      JoinNet.callback_PlugInControlChannelData[channel] = $scope.callback_PlugInControlChannelData;
      JoinNet.callback_PlugInPacketRecved[channel] = $scope.callback_PlugInPacketRecved;
      expected = 0x7fffffff;
      hmtg.jnkernel.jn_command_PlugInSetRecvingPrio(dt.channel, dt.is_receive ? 0 : 12);
      dt.m_wSequence = 0;
      if(dt.m_ConnectStatus == 1 && hmtg.jnkernel._tab_ssrc() == hmtg.jnkernel._jn_ssrc_index()) {
        dt.m_ConnectStatus = 2;
        if(dt.is_sdt) {
          if(dt.is_send) {
            dt.request_data_source();
            dt.start_capture();
          }
        } else if(rdc.is_control) {
          dt.remote_control(dt.monitor_only);
        }
      } else {
        dt.m_ConnectStatus = 2;
      }
    }

    $scope.$on(hmtgHelper.WM_CLOSE_PLUGIN, function(e, channel) {
      if(channel == dt.channel) {
        if(!dt.is_sdt) {
          dt.stop_control();
          if(!hmtgHelper.inside_angular) $scope.$digest();
        }
        dt.channel = -1;
        JoinNet.is_appdata_ready[channel] = false;
        //hmtg.util.log(-2, '******debug, reset appdata channel ' + channel + ' status in close plugin');
        dt.m_ConnectStatus = 0;

        dt.descr = '';
        dt.descr_ssrc = -1;
        dt.bmp = null;
        dt.draw();
      }
    });

    dt_decoder.onmessage = function(e) {
      switch(e.data.command) {
        case 'data_out':
          if(dt.descr_ssrc != e.data.ssrc && e.data.ssrc != -1) {
            dt.descr_ssrc = e.data.ssrc;
            if(!dt.is_sdt && rdc.controllee_ssrc < 0) {
              rdc.controllee_ssrc = dt.descr_ssrc;  // in case joinnet doesn't record RDC_CMD_ASSIGN_CONTROL
            }
            var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
            dt.descr = '[' + hmtg.util.decodeUtf8(a[e.data.ssrc] ? a[e.data.ssrc]._szRealName() : ('ssrc' + e.data.ssrc)) + ']';
            $scope.$digest();
          }
          if(!dt.is_receive) return;
          if(!hmtg.jnkernel._jn_bConnected()) return;
          if(e.data.new_frame) {
            var ts = hmtg.util.GetTickCount();
            var target_dt = dt.is_sdt ? sdt : rdc;
            var stat = target_dt.meta_stat;
            if(!stat) {
              stat = target_dt.meta_stat = {};
              // init
              stat.count = 0;
              stat.start_tick = stat.last_tick = ts - 100000;
            }
            video_bitrate.count_fps(stat, ts);
          }
          if(!dt.bmp || dt.width != e.data.width || dt.height != e.data.height) {
            dt.bmp = true;
            dt.width = dt.canvas0.width = e.data.width;
            dt.height = dt.canvas0.height = e.data.height;
            try {
              dt.image_data = dt.ctx0.getImageData(0, 0, dt.width, dt.height);
            } catch(e) {
              break;
            }
          }
          dt.image_data.data.set(e.data.data);
          dt.ctx0.putImageData(dt.image_data, 0, 0);
          dt.cursor_x = e.data.x;
          dt.cursor_y = e.data.y;
          dt.draw();
          break;
        case 'meta':
          var target_dt = dt.is_sdt ? sdt : rdc;
          target_dt.meta_width = e.data.width;
          target_dt.meta_height = e.data.height;
          target_dt.meta_color_str_id = dt.color_id_hash['' + e.data.bit_count + ((e.data.bit_count == 4 || e.data.bit_count == 8) ? (e.data.use_grayscale ? 'g' : 'c') : '')];
          break;
        case 'reset':
          dt.cursor_x = dt.cursor_y = -1;
          dt.bmp = null;
          dt.descr = '';
          dt.descr_ssrc = -1;
          dt.draw();
          if(!hmtgHelper.inside_angular) $scope.$digest();
          break;
        default:
          break;
      }
    }

    dt.is_meeting_mode = function() {
      return hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL;
    }

    dt.getWORD = function(data, idx) {
      var value = (
        data.charCodeAt(idx + 1) << 8 ^
        data.charCodeAt(idx));
      return value;
    }

    dt.getDWORD = function(data, idx) {
      var value = (
        data.charCodeAt(idx + 3) << 24 ^
        data.charCodeAt(idx + 2) << 16 ^
        data.charCodeAt(idx + 1) << 8 ^
        data.charCodeAt(idx));
      return value;
    }

    function handlePkt(data, ssrc) {
      var command = data.charCodeAt(0);
      var size = (
        data.charCodeAt(0 + 3) << 16 ^
        data.charCodeAt(0 + 2) << 8 ^
        data.charCodeAt(0 + 1));
      if(size < 0) return;
      if(data.length < 4 + size) return;
      var total_size = 4 + size;

      switch(command) {
        case hmtg.config.DT_SCREEN_DATA:
        case hmtg.config.DT_SCREEN_DATA2:
          break;
        case hmtg.config.DT_NULL_DATA:
          break;
        case hmtg.config.DT_FRAME_END:
          break;
        case hmtg.config.DT_REQUEST_RECT:
          break;
        case hmtg.config.DT_CAPTURE_INFO:
          break;
        case hmtg.config.DT_CAPTURE_END:
          break;
        case hmtg.config.DT_MOUSE_POS:
          break;
        case hmtg.config.DT_RDC_SIGNAL:
          dt.handleSignal(data, ssrc, size);
          break;
        case hmtg.config.DT_RDC_INPUT:
          break;
        default:
          hmtg.util.log(-1, '******debug, dt, unknown command: ' + command);
          return;
          break;
      }
    }

    dt.draw = function() {
      if(!dt.bmp) {
        $scope.dt.canvas.width = $scope.dt.canvas.height = dt.MIN_SIZE;
        return;
      }

      // determine ratio
      // calculate display area
      /*
      var offsetWidth = hmtgHelper.view_port_width >> 1;
      var offsetHeight = hmtgHelper.view_port_height >> 1;
      if(dt.dt0.offsetWidth && dt.dt0.offsetHeight) {
      if(dt.is_fullscreen) {
      offsetWidth = Math.min(hmtgHelper.view_port_width, Math.max(hmtgHelper.view_port_width - 30, 100));
      offsetHeight = Math.min(hmtgHelper.view_port_height, Math.max(hmtgHelper.view_port_height - 60, 100));
      } else {
      offsetWidth = Math.min(hmtgHelper.view_port_width, Math.max(hmtgHelper.view_port_width * .1, dt.dt0.offsetWidth));
      offsetHeight = Math.min(hmtgHelper.view_port_height, Math.max(hmtgHelper.view_port_height * .8, dt.dt0.offsetHeight * .9));
      }
      offsetWidth = Math.min(dt.MAX_SIZE, offsetWidth);
      offsetHeight = Math.min(dt.MAX_SIZE, offsetHeight);
      }
      */
      var offsetWidth;
      var offsetHeight;
      offsetWidth = Math.max((hmtgHelper.view_port_width >> 3), Math.min(hmtgHelper.view_port_width, dt.container.clientWidth) - dt.dt0.offsetLeft - 1 - 20); // leave at lease 1px space at right
      var element = dt.dt0;
      var offsetY = 0;
      if(dt.is_fullscreen) {
        offsetY += element.offsetTop + element.clientTop;
      } else {
        // Compute the total offset
        if(typeof element.offsetParent !== 'undefined') {
          do {
            offsetY += element.offsetTop + element.clientTop;
          } while((element = element.offsetParent));
        }
      }
      offsetHeight = Math.max((hmtgHelper.view_port_height >> 1), hmtgHelper.view_port_height - offsetY) - 20;

      var ratio = 1.0;
      if(dt.width > offsetWidth) ratio = offsetWidth / dt.width;
      if(dt.height > offsetHeight) ratio = Math.min(ratio, offsetHeight / dt.height);

      if(dt.is_fit_page) {
        var new_ratio;
        new_ratio = ((ratio * 100) >> 0) / 100;
        if(new_ratio < dt.min_ratio) new_ratio = dt.min_ratio;
        if(dt.width == dt.last_width && dt.height == dt.last_height) {
          if(new_ratio > dt.ratio) {
            // re-calculate ratio after we minus potential scroll bar area
            if(dt.width > (offsetWidth - 30)) ratio = (offsetWidth - 30) / dt.width;
            if(dt.height > offsetHeight) ratio = Math.min(ratio, offsetHeight / dt.height);
            ratio = ((ratio * 100) >> 0) / 100;
            if(ratio > dt.ratio) {
              dt.ratio = ratio;
            }
          } else {
            dt.ratio = new_ratio;
          }
        } else {
          dt.ratio = new_ratio;
          dt.last_width = dt.width;
          dt.last_height = dt.height;
        }
      } else {
        // if the manual ratio is too small(50% of fitting ratio), make it larger
        if(dt.ratio < ratio * 0.5) {
          dt.ratio = ((ratio * 50) >> 0) / 100;
        }
      }

      dt.ratio_percent = Math.round(dt.ratio * 100);
      dt.ratio_pos = dt.ratio * 100;

      dt.canvas.width = Math.min(dt.MAX_SIZE, dt.width * dt.ratio);
      dt.canvas.height = Math.min(dt.MAX_SIZE, dt.height * dt.ratio);

      if(!hmtgHelper.inside_angular) $scope.$digest();

      // draw image
      dt.ctx.drawImage(dt.canvas0, 0, 0, dt.canvas0.width, dt.canvas0.height, 0, 0, dt.width * dt.ratio, dt.height * dt.ratio);

      // draw edge
      // if the actual size exceed the max allowed on canvas
      // draw lines at edges
      var ratio = dt.ratio;
      if(dt.width * ratio > dt.MAX_SIZE) {
        hmtgHelper.drawEdge(dt.ctx, '#FF0000', dt.MAX_SIZE - 3, 0, dt.MAX_SIZE - 3, dt.MAX_SIZE);
      }
      if(dt.height * ratio > dt.MAX_SIZE) {
        hmtgHelper.drawEdge(dt.ctx, '#FF0000', 0, dt.MAX_SIZE - 3, dt.MAX_SIZE, dt.MAX_SIZE - 3);
      }

      // draw cursor
      if(dt.cursor_x >= 0) {
        dt.ctx.drawImage(dt.cursor_img, dt.cursor_x * ratio - (dt.cursor_img.width >> 1), dt.cursor_y * ratio - (dt.cursor_img.height >> 1));
      }
    }

    dt.toggle_send = function() {
      if(dt.is_sdt) {
        if(!dt.is_sync_tab_controller) {
          return;
        }
      } else {
        if(!(dt.control_assigned && dt.is_sender)) {
          return;
        }
      }
      dt.is_send = !dt.is_send;

      if(dt.is_send) {
        if(dt.is_sdt) {
          if(dt.m_ConnectStatus == 0) { // disconnected
            dt.m_ConnectStatus = 1; // connecting
            //this.GUID_DESKTOP_SHARING = 'E5AF1A56-E29C-4BA6-839A-24C2F30EED02';
            hmtg.jnkernel.jn_command_RequestPlugInChannel(hmtg.config.PLUGIN_CHANNEL_TYPE_UDP_1,
            String.fromCharCode(0xe5, 0xaf, 0x1a, 0x56,
            0, 0, 0xe2, 0x9c,
            0, 0, 0x4b, 0xa6,
            0x83, 0x9a, 0x24, 0xc2, 0xf3, 0x0e, 0xed, 0x2), 0, 1);
            return;
          } else if(dt.m_ConnectStatus == 1) {
            return;
          }
        }
        dt.request_data_source();
        dt.start_capture();
      } else {
        dt.auto_allow_control_ssrc = -1;
        dt.is_control_allowed = false;
        dt.stop_capture();
      }
    }

    dt.toggle_allowed_control = function() {
      if(!(dt.control_assigned && dt.is_sender)) {
        dt.is_control_allowed = false;
        return;
      }
      dt.is_control_allowed = !dt.is_control_allowed;
      if(dt.is_control_allowed) {
        if(!dt.is_send) dt.toggle_send();
        dt.auto_allow_control_ssrc = dt.controller_ssrc;
        hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, dt.controller_ssrc,
          String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 1, 0, 0, hmtg.config.RDC_CMD_START_CONTROL));
      } else {
        dt.auto_allow_control_ssrc = -1;
      }
    }

    dt.start_capture = function() {
      dt.stop_capture();
      dt.color_id = '0';  // set color depth to auto select at the beginning of capture
      dt.capture_thread = new capture();
    }

    dt.stop_current_capture = function() {
      if(dt.capture_thread) {
        dt.capture_thread.quickFinish();
      }
    }

    dt.stop_capture = function() {
      if(dt.capture_thread) {
        dt.capture_thread.quickFinish();
        dt.capture_thread.stop();  // stop current captureing thread
        dt.capture_thread = null;
      }
    }

    dt.switchSource = function() {
      hmtgHelper.inside_angular++;
      joinnetVideo.stopScreenCapture();
      joinnetVideo.startScreenCapture(true);
      if(!dt.is_send) dt.toggle_send();
      hmtgHelper.inside_angular--;
    }

    function capture() {
      var _capture = this;

      // capture process
      // html2canvas
      // decide bit using bitrate and size
      // canvas -> bitplane data
      // decide to send diff or whole frame
      // send capture info if config changes
      // send rects
      // start a new capture

      var now = hmtg.util.GetTickCount();
      _capture.start_tick = now;
      var last_bit_count = 24;
      var last_use_grayscale = false;
      var last_bit_count_tick = now;
      var last_width = 0;
      var last_height = 0;
      var last_frame_tick = now - 60000;
      var last_whole_frame_tick = now - 60000;
      var avg_compress_ratio = 5.0; // average compress ratio
      var cap_seq = (Math.random() * 32767) >> 0;
      var pktno = 0;
      var pkt_buffer = [];
      var encoding_finished = false;
      var sendWorkerURL = window.URL.createObjectURL(new Blob(["onmessage = function(e) { setInterval(function(){postMessage('dummy'); },40)}"], { type: 'application/javascript' }));
      var sendWorker = null;
      var BIT_COUNT_INCREASE_DELAY_THRESHOLD = 6000;  // only if bit count become continously larger for this period of time, increase it
      var WHOLE_FRAME_INTERVAL = 5000; // if this time has passed since the last whole frame, send another whole frame
      var FRAME_SENDING_UPPER_THRESHOLD = 100; // a whole frame's data must be sent out within this time limit according to current data rate
      var dt_encoder;
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      var pkt_header_str0 = String.fromCharCode(my_ssrc & 0xff, (my_ssrc >> 8) & 0xff, 0, 128, 0, 0);
      var pkt_header_str1 = String.fromCharCode(my_ssrc & 0xff, (my_ssrc >> 8) & 0xff, 0, 128, 0, 128);
      var encoding_frame_pkt_count = 0;
      //var encoding_frame_num = 0;

      _capture.quickFinish = function() { }
      _capture.stop = function() { }  // nothing to stop at first
      try {
        dt_encoder = new Worker(DT_ENCODER_PATH);
        dt_encoder.addEventListener('error', window.onerrorWorker, false);
        dt_encoder.postMessage({ command: 'init', good_worker: hmtgHelper.good_worker });
      } catch(e) {
        return;
      }

      function stop_dt_encoder() {
        dt_encoder.onmessage = function() { }
        dt_encoder.postMessage({ command: 'quickFinish' });
        dt_encoder.postMessage({ command: 'exit' });
      }

      _capture.stop = function() {
        stop_dt_encoder();
        _capture.stop = function() { }  // do not stop twice
      }

      startCapture();

      function startCapture() {
        _capture.quickFinish = function() { }

        if(dt.source_id == 'board') convertData(document.getElementById('board'));
        else if(dt.source_id == 'video') convertData(document.getElementById('main_video'));
        else if(dt.source_id == 'camera') {
          var elem_video = joinnetVideo.elem_video;
          if(!elem_video || elem_video.videoWidth == 0) {
            convertData(null);
            return;
          }
          var canvas = document.createElement("canvas");
          var ctx = canvas.getContext('2d');
          canvas.width = elem_video.videoWidth;
          canvas.height = elem_video.videoHeight;
          try {
            ctx.drawImage(elem_video, 0, 0);
          } catch(e) {
          }
          convertData(canvas);
        } else if(dt.source_id == 'screen') {
          var elem_screen = joinnetVideo.elem_screen;
          if(!elem_screen || elem_screen.videoWidth == 0) {
            convertData(null);
            return;
          }
          var canvas = document.createElement("canvas");
          var ctx = canvas.getContext('2d');
          canvas.width = elem_screen.videoWidth;
          canvas.height = elem_screen.videoHeight;
          try {
            ctx.drawImage(elem_screen, 0, 0);
          } catch(e) {
          }
          convertData(canvas);
        } else if(dt.source_id == 'import') {
          var canvas = document.createElement("canvas");
          var ctx = canvas.getContext('2d');
          var input1 = document.getElementById('html5_media1');
          var input2 = document.getElementById('html5_media2');
          if(input1 && input1.src && input1.videoWidth) {
            canvas.width = input1.videoWidth;
            canvas.height = input1.videoHeight;
            try {
              ctx.drawImage(input1, 0, 0);
            } catch(e) {
            }
            convertData(canvas);
          } else if(input2 && input2.src && input2.videoWidth) {
            canvas.width = input2.videoWidth;
            canvas.height = input2.videoHeight;
            try {
              ctx.drawImage(input2, 0, 0);
            } catch(e) {
            }
            convertData(canvas);
          } else {
            convertData(null);
          }
        } else if(typeof html2canvas == 'function') {
          html2canvas(document.body, { onrendered: convertData });
        } else {
          var get_canvas_thread = new getCanvasThread(convertData);
          // the following line require that the above thread MUST take asynchronous onfinish
          _capture.stop = function() {
            get_canvas_thread.stop();
            stop_dt_encoder();
            _capture.stop = function() { }  // do not stop twice
          }
        }
      }

      function getCanvasThread(onfinish) {
        var _getCanvasThread = this;
        var got_data = null;

        _getCanvasThread.stop = function() {
          got_data = null;
        }

        got_data = function(canvas) {
          onfinish(canvas);
        }

        $ocLazyLoad.load('lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/_html2canvas' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param).then(function() {
          if(got_data) html2canvas(document.body, { onrendered: got_data });
        }, function(e) {
          hmtg.util.log(-1, 'Warning! lazy_loading _html2canvas fails');
          if(got_data) got_data(null);
        });
      }

      function convertData(canvas) {
        var convert_data_thread = new convertDataThread(canvas, startDelayedCapture);
        // the following line require that the above thread MUST take asynchronous onfinish
        _capture.stop = function() {
          convert_data_thread.stop();
          stop_dt_encoder();
          _capture.stop = function() { }  // do not stop twice
        }
      }

      function convertDataThread(canvas, onfinish) {
        var _convertDataThread = this;
        _convertDataThread.stop = function() { }
        function canvas_error() {
          if(0 != last_width || 0 != last_height) {
            var target_dt = dt.is_sdt ? sdt : rdc;
            target_dt.capture_width = 0;
            target_dt.capture_height = 0;
            target_dt.capture_color_str_id = '';
            last_width = 0;
            last_height = 0;
            var param = '';
            param += String.fromCharCode(24, 0, 0, 0, 0, 0);
            cap_seq++;
            param += String.fromCharCode(cap_seq & 0xff, (cap_seq >> 8) & 0xff);

            var size = param.length;
            hmtg.jnkernel.jn_command_PlugInSetStaticData(dt.channel,
            String.fromCharCode(hmtg.config.DT_CAPTURE_INFO, size & 0xff, (size >> 8) & 0xff, 0) + param);
          }
          onfinish();
        }
        if(!canvas || !canvas.width || canvas.width > 32767 || canvas.height > 32767) {
          // asynchronously call is necessary here
          hmtgHelper.async_finish(this, canvas_error);
          return;
        }
        // get the image 
        var ctx = canvas.getContext('2d');
        var pixels;
        try {
          pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch(e) {
          // asynchronously call is necessary here
          hmtgHelper.async_finish(this, canvas_error);
          return;
        }

        var data_rate = hmtg.jnkernel._jn_plugin_data()[dt.channel]._data_rate();
        // assume the frame should be sent in 5s.
        var budget = data_rate * FRAME_SENDING_UPPER_THRESHOLD / 1000 * avg_compress_ratio; // bit budget
        var target_bit_count = budget / (canvas.width * canvas.height);
        var target_use_grayscale = false;
        if(dt.color_id == '0') {
          if(target_bit_count > 24) target_bit_count = 24;
          else if(target_bit_count > 16) target_bit_count = 16;
          else if(target_bit_count > 8) target_bit_count = 8;
          else target_bit_count = 4;
        } else {
          target_bit_count = parseInt(dt.color_id);
          target_use_grayscale = dt.color_id.indexOf('g') != -1;
        }

        now = hmtg.util.GetTickCount();

        if(now - _capture.start_tick < 5000) {
          target_bit_count = Math.min(4, target_bit_count);
        }

        var bit_count;
        var to_send_frame_info = false;
        if(canvas.width != last_width || canvas.height != last_height) {
          to_send_frame_info = true;
          last_width = canvas.width;
          last_height = canvas.height;
          last_bit_count = bit_count = target_bit_count;
          last_use_grayscale = use_grayscale = target_use_grayscale;
          last_bit_count_tick = now;
        } else if(target_bit_count < last_bit_count) {
          to_send_frame_info = true;
          last_bit_count = bit_count = target_bit_count;
          last_use_grayscale = use_grayscale = target_use_grayscale;
          last_bit_count_tick = now;
        } else if(target_bit_count == last_bit_count) {
          to_send_frame_info = target_use_grayscale != last_use_grayscale;
          bit_count = target_bit_count;
          last_use_grayscale = use_grayscale = target_use_grayscale;
          last_bit_count_tick = now;
        } else if(dt.color_id != '0' || now - last_bit_count_tick > BIT_COUNT_INCREASE_DELAY_THRESHOLD) {
          to_send_frame_info = true;
          last_bit_count = bit_count = target_bit_count;
          last_use_grayscale = use_grayscale = target_use_grayscale;
          last_bit_count_tick = now;
        } else {
          bit_count = last_bit_count;
          use_grayscale = last_use_grayscale;
        }

        //hmtg.util.log(-2, '******debug, color_id=' + dt.color_id + ',target=' + target_bit_count + ',bit=' + bit_count + ',gray=' + use_grayscale + ',avg_compress_ratio=' + avg_compress_ratio);

        var is_whole_frame = true;
        if(to_send_frame_info || (now - last_whole_frame_tick) > WHOLE_FRAME_INTERVAL) {
          last_whole_frame_tick = now;
        } else {
          is_whole_frame = false;
        }

        if(to_send_frame_info) {
          var target_dt = dt.is_sdt ? sdt : rdc;
          target_dt.capture_width = canvas.width;
          target_dt.capture_height = canvas.height;
          target_dt.capture_color_str_id = dt.color_id_hash['' + bit_count + ((bit_count == 4 || bit_count == 8) ? (use_grayscale ? 'g' : 'c') : '')];
          var param = '';
          param += String.fromCharCode(bit_count, 0, canvas.width & 0xff, canvas.width >> 8, canvas.height & 0xff, canvas.height >> 8);
          if(bit_count == 1) {
            param += String.fromCharCode(2, 0) + palette_1bit;
          } else if(bit_count == 2) {
            param += String.fromCharCode(4, 0) + palette_2bit;
          } else if(bit_count == 4) {
            param += String.fromCharCode(16, 0) + (use_grayscale ? palette_4bit_g : palette_4bit);
          } else if(bit_count == 8) {
            param += String.fromCharCode(0, 1) + (use_grayscale ? palette_8bit_g : palette_8bit);
          }
          cap_seq++;
          param += String.fromCharCode(cap_seq & 0xff, (cap_seq >> 8) & 0xff);

          var size = param.length;
          hmtg.jnkernel.jn_command_PlugInSetStaticData(dt.channel,
            String.fromCharCode(hmtg.config.DT_CAPTURE_INFO, size & 0xff, (size >> 8) & 0xff, 0) + param);
        }

        //hmtg.util.log(-2, '******debug, frame ' + canvas.width + ' x ' + canvas.height + ',bit_count=' + bit_count + ',is_whole_frame=' + is_whole_frame);
        if(hmtgHelper.good_worker) {
          dt_encoder.postMessage({
            command: 'data_in',
            data: pixels.data,
            width: canvas.width,
            height: canvas.height,
            bit_count: bit_count,
            use_grayscale: use_grayscale,
            is_whole_frame: is_whole_frame
          }, [pixels.data.buffer]);
        } else {
          dt_encoder.postMessage({
            command: 'data_in',
            data: pixels.data,
            width: canvas.width,
            height: canvas.height,
            bit_count: bit_count,
            use_grayscale: use_grayscale,
            is_whole_frame: is_whole_frame
          });
        }

        encoding_finished = false;
        try {
          sendWorker = new Worker(sendWorkerURL);
        } catch(e) {
          sendWorker = new Worker('worker/worker_interval_40.js');
        }
        sendWorker.onmessage = function(e) {
          sendRect();
        };
        sendWorker.postMessage('dummy'); // Start the worker.
        //send_intervalID = setInterval(sendRect, 10);
        _capture.quickFinish = function() {
          dt_encoder.postMessage({ command: 'quickFinish' });
          pkt_buffer = [];
        }
        _convertDataThread.stop = function() {
          //clearInterval(send_intervalID);
          sendWorker.terminate();
        }

        var array = hmtg.jnkernel._jn_plugin_data();
        var plugin = array[dt.channel];
        function sendRect() {
          if(encoding_finished && !pkt_buffer.length) {
            //clearInterval(send_intervalID);
            sendWorker.terminate();
            onfinish();
            return;
          }

          while(1) {
            if(plugin._jn_tokens() < 0) break;
            if(!pkt_buffer.length) break;

            var data = pkt_buffer.shift();
            var str;
            if(!data.data) {
              //str = (encoding_frame_num ? pkt_header_str1 : pkt_header_str0) +
              str = pkt_header_str0 +
                String.fromCharCode(hmtg.config.DT_FRAME_END, 0, 0, 0);
            } else {
              var size = data.data.length + 8;  // 8 is for area_str
              //str = (encoding_frame_num ? pkt_header_str1 : pkt_header_str0) +
              str = pkt_header_str0 +
                String.fromCharCode(hmtg.config.DT_SCREEN_DATA, size & 0xff, (size >> 8) & 0xff, 0) +
              data.area_str + hmtg.util.array2str(data.data);
            }

            var pkt = hmtg.jnkernel.jn_command_write_timestamp_given(
              0,
              str, now, pktno);
            if(dt.monitor_only) {
              hmtg.jnkernel.jn_command_send_plugin_pkt(pkt, dt.channel, dt.controller_ssrc, 10, 0, 1);
            } else {
              hmtg.jnkernel.jn_command_send_plugin_pkt(pkt, dt.channel, -1, 10, 1, 1);
            }
            pktno++;
          }
        }
      }

      function startDelayedCapture() {
        var timerID = setTimeout(function() {
          startCapture();
        }, 20);
        _capture.stop = function() {
          clearTimeout(timerID);
          stop_dt_encoder();
          _capture.stop = function() { }  // do not stop twice
        }
      }

      dt_encoder.onmessage = function(e) {
        switch(e.data.command) {
          case 'data_out':
            pkt_buffer.push(e.data);
            encoding_frame_pkt_count++;
            break;
          case 'data_finish':
            avg_compress_ratio = e.data.avg;
            encoding_finished = true;
            if(encoding_frame_pkt_count) {  // if there is any pkt sent
              //encoding_frame_num = encoding_frame_num ? 0 : 1;  // increase frame number, which is only 1 bit
              pkt_buffer.push({ data: null });

              var ts = hmtg.util.GetTickCount();
              var target_dt = dt.is_sdt ? sdt : rdc;
              var stat = target_dt.capture_stat;
              if(!stat) {
                stat = target_dt.capture_stat = {};
                // init
                stat.count = 0;
                stat.start_tick = stat.last_tick = ts - 100000;
              }
              video_bitrate.count_fps(stat, ts);
            } else {
            }
            encoding_frame_pkt_count = 0;
            break;
          default:
            break;
        }
      }
    }

    $scope.callback_PlugInSetStaticDataResponse = function(data) {
      if(dt_decoder) {
        dt_decoder.postMessage({
          command: 'pkt_in',
          data: data,
          ssrc: -1,
          prio: 15,
          tick: Date.now()
        });
      }
      /*
      if(busy) {
      pkt_array.push({ data: data, ssrc: -1, prio: 15, tick: hmtg.util.GetTickCount() });
      } else {
      handlePkt(data, -1);
      }
      */
    }

    $scope.callback_PlugInControlChannelData = function(data, source_ssrc) {
      handlePkt(data, source_ssrc);
      /*
      if(busy) {
      pkt_array.push({ data: data, ssrc: source_ssrc, prio: 15, tick: hmtg.util.GetTickCount() });
      } else {
      handlePkt(data, source_ssrc);
      }
      */
    }

    function decodePlugin() {
      decode_timerID = null;
      var start_tick = hmtg.util.GetTickCount();
      var i;
      while(1) {
        if(!pkt_array.length) return;
        var pkt = pkt_array.shift();
        var delay = start_tick - pkt.tick;
        if(delay < 2000) { }
        else if(delay < 5000) { if(pkt.prio < 9) continue; }
        else if(delay < 8000) { if(pkt.prio < 11) continue; }
        else { if(pkt.prio < 13) continue; }
        handlePkt(pkt.data, pkt.ssrc);
        if(busy) return;
        var now = hmtg.util.GetTickCount();
        if(now - start_tick >= 10) {
          decode_timerID = setTimeout(decodePlugin, 0);
          return;
        }
      }
    }

    $scope.callback_PlugInPacketRecved = function(data, ssrc, prio) {
      if(!dt.is_receive) return;
      if(data.length < 6) return;
      var word = (data.charCodeAt(3) << 8 ^ data.charCodeAt(2));
      var seq = word & 0x7fff;
      var is_start = word & 0x8000;
      word = (data.charCodeAt(5) << 8 ^ data.charCodeAt(4));
      var end_seq = word & 0x7fff;
      var extra = (word & 0x8000) ? 1 : 0;
      //hmtg.util.log(-2, 'pkt data, channel=' + dt.channel + ',userid=' + userid + ',seq=' + seq + ',is_start=' + is_start + ',end_seq=' + end_seq + ',extra=' + extra);

      var is_expected = seq == expected;
      expected = (seq + 1) & 0x7fff;
      if(is_expected) {
        if(has_first) {
          if(is_start) {  // dup start
            buffer = '';
          }
        } else {
          if(!is_start) {  // need a start
            return;
          }
          buffer = '';
          has_first = true;
        }
      } else {
        if(is_start) {
          buffer = '';
          has_first = true;
        } else {
          has_first = false;
          return;
        }
      }
      buffer += data.slice(6);
      if(seq != end_seq) {
        return;
      }
      data = buffer;

      if(dt_decoder) {
        dt_decoder.postMessage({
          command: 'pkt_in',
          data: data,
          ssrc: ssrc,
          prio: prio,
          extra: extra,
          tick: Date.now()
        });
      }

      /*
      pkt_array.push({ data: data, ssrc: ssrc, prio: prio, tick: hmtg.util.GetTickCount() });
      if(pkt_array.length > 10000) {
      pkt_array.shift();
      }
      if(!busy && !decode_timerID) {
      decode_timerID = setTimeout(decodePlugin, 0);
      }
      */

      has_first = false;
    }

    dt.fit_page = function() {
      dt.is_fit_page = !dt.is_fit_page;
      hmtgHelper.inside_angular++;
      dt.draw();
      hmtgHelper.inside_angular--;
    }

    dt.toggle_receive = function() {
      dt.is_receive = !dt.is_receive;
      if(hmtg.jnkernel._jn_bConnected()
        && dt.channel != -1 && JoinNet.is_appdata_ready[dt.channel]) {
        hmtg.jnkernel.jn_command_PlugInSetRecvingPrio(dt.channel, dt.is_receive ? 0 : 12);

        if(dt.is_receive) {
          var array = hmtg.jnkernel._jn_plugin_data();
          if(array[dt.channel]._static_data()) {
            hmtg.jnkernel.jn_callback_PlugInSetStaticDataResponse(0, dt.channel, array[dt.channel]._static_data());
          }
        } else {
          if(dt_decoder) dt_decoder.postMessage({ command: 'clear' });
        }
      }
    }

    dt.clear_decoder = function() {
      if(dt_decoder) dt_decoder.postMessage({ command: 'clear' });
    }

    function set_snapshot_tail() {
      $scope.snapshot_tail = (appSetting.snapshot_delay ? '(' : '') + (appSetting.snapshot_delay ? appSetting.snapshot_delay : '') + (appSetting.snapshot_delay ? ')' : '');
    }
    $scope.$on(hmtgHelper.WM_SNAPSHOT_DELAY_CHANGED, function() {
      if(!$scope.snapshot_intervalID) {
        set_snapshot_tail();
      }
    });

    set_snapshot_tail();
    $scope.show_snapshot = function() {
      return dt.bmp && dt.width && dt.height;
    };
    $scope.snapshot = function() {
      if($rootScope.snapshot_busy) {
        if($scope.snapshot_intervalID) {
          clearInterval($scope.snapshot_intervalID);
          $scope.snapshot_intervalID = null;
          $rootScope.snapshot_busy = false;
          set_snapshot_tail();
        }
        return;
      }
      if(!(dt.bmp && dt.width && dt.height)) return;

      $rootScope.snapshot_busy = true;
      $scope.snapshot_delay_count = appSetting.snapshot_delay;

      if(appSetting.snapshot_delay) {
        $scope.snapshot_intervalID = setInterval(function() {
          if(!(dt.bmp && dt.width && dt.height)) {
            clearInterval($scope.snapshot_intervalID);
            $scope.snapshot_intervalID = null;
            $rootScope.snapshot_busy = false;
            set_snapshot_tail();
            $scope.$digest();
            return;
          }
          $scope.snapshot_delay_count--;
          $scope.snapshot_tail = ($scope.snapshot_delay_count ? '(' : '') + ($scope.snapshot_delay_count ? $scope.snapshot_delay_count : '') + ($scope.snapshot_delay_count ? ')' : '');
          if($scope.snapshot_delay_count <= 0) {
            clearInterval($scope.snapshot_intervalID);
            $scope.snapshot_intervalID = null;
            snapshot_canvas();
            set_snapshot_tail();
          }
          $scope.$digest();
        }, 1000);
      } else {
        snapshot_canvas();
      }

      function snapshot_canvas() {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext('2d');
        canvas.width = dt.canvas0.width;
        canvas.height = dt.canvas0.height;
        ctx.drawImage(dt.canvas0, 0, 0);

        hmtgHelper.process_snapshot(canvas);
      }
    }

    $scope.$watch('dt.ratio_pos', function() {
      dt.change_ratio();
    });

    dt.change_ratio = function() {
      dt.ratio = dt.ratio_pos / 100;
      dt.ratio_percent = Math.round(dt.ratio_pos);
      hmtgHelper.inside_angular++;
      dt.draw();
      hmtgHelper.inside_angular--;
    }

    $scope.$on(hmtgHelper.WM_HEIGHT_CHANGED, adjust_size);
    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, adjust_size);

    function adjust_size() {
      dt.draw();
    }

    dt.toggle_remote_fullscreen = function() {
      dt.is_remote_fullscreen = !dt.is_remote_fullscreen;
      var sync_fullscreen_controller = hmtg.jnkernel._fullscreen_ssrc();
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      if(sync_fullscreen_controller == my_ssrc) {
        hmtg.jnkernel.jn_command_SyncFullScreen(dt.is_remote_fullscreen ? 1 : 0, hmtg.config.TAB_VIEW_DESKTOP_SHARING);
      }
    }

    dt.fullscreen1 = function() {
      hmtgHelper.inside_angular++;
      // to do
      // for sdt, only trigger remote fullscreen, but locally no change.
      dt.turnon_fullscreen();
      dt.is_passive_fullscreen = false;
      if(!dt.is_sdt)
        joinnetHelper.change_fullscreen_mode(1, hmtg.config.TAB_VIEW_REMOTE_CONTROL);
      hmtgHelper.inside_angular--;
    }
    dt.turnon_fullscreen = function() {
      if(dt.request_fullscreen) {
        dt.request_fullscreen.call(dt.container);
        var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

        dt.is_fullscreen = fullscreenElement == dt.container;
      }
    }

    dt.fullscreen0 = function() {
      hmtgHelper.inside_angular++;
      dt.turnoff_fullscreen();
      if(!dt.is_sdt)
        joinnetHelper.change_fullscreen_mode(0, hmtg.config.TAB_VIEW_REMOTE_CONTROL);
      hmtgHelper.inside_angular--;
    }
    dt.turnoff_fullscreen = function() {
      hmtgHelper.exitFullScreen();
      dt.is_fullscreen = false;
      dt.is_passive_fullscreen = false;
    }

    $scope.$on(hmtgHelper.WM_FULLSCREEN_CHANGED, function() {
      var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

      var old_status = dt.is_fullscreen;
      dt.is_fullscreen = fullscreenElement == dt.container;
      if(!hmtgHelper.inside_angular) $scope.$digest();

      if(old_status && !dt.is_fullscreen) {
        if(!dt.is_sdt)
          joinnetHelper.change_fullscreen_mode(0, hmtg.config.TAB_VIEW_REMOTE_CONTROL);
      }
    });

    $scope.$on(hmtgHelper.WM_SYNC_FULLSCREEN, function(event, is_fullscreen, view) {
      if(view != (dt.is_sdt ? 2 : 3)) return;
      if($rootScope.nav_item != 'joinnet') return;

      var sync_fullscreen_controller = hmtg.jnkernel._fullscreen_ssrc();
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      if(sync_fullscreen_controller != my_ssrc) {
        if(is_fullscreen) {
          if(!dt.is_fullscreen
            && (dt.is_sdt || my_ssrc != dt.controllee_ssrc) // controllee in remote control does not follow sync fullscreen
            ) {
            dt.turnon_fullscreen();

            if(!dt.is_fullscreen) {
              if(dt.request_fullscreen) {
                dt.prompt_sync_fullscreen_alert_item = joinnetHelper.prompt_sync_fullscreen(function() {
                  if(!dt.is_fullscreen) {
                    dt.turnon_fullscreen();
                    dt.is_passive_fullscreen = true;
                  }
                });
              }
            } else {
              dt.is_passive_fullscreen = true;
            }
          }
        } else {
          if(dt.prompt_sync_fullscreen_alert_item) {
            hmtgAlert.remove_link_item(dt.prompt_sync_fullscreen_alert_item);
            dt.prompt_sync_fullscreen_alert_item = null;
          }
          if(dt.is_fullscreen && dt.is_passive_fullscreen) {
            dt.turnoff_fullscreen();
          }
        }
      }
    });

    dt.on_tab_ssrc_change = function() {
      //hmtg.util.log(-2, '******debug, channel ' + dt.channel + ' tab ssrc changed, JoinNet.net_init_finished=' + JoinNet.net_init_finished);
      var sync_tab_controller = hmtg.jnkernel._tab_ssrc();
      var is_sync_tab_controller = sync_tab_controller != -1 && sync_tab_controller == hmtg.jnkernel._jn_ssrc_index();
      if(sync_tab_controller != dt.sync_tab_controller) {
        var old_controller = dt.sync_tab_controller;
        dt.sync_tab_controller = sync_tab_controller;
        dt.is_sync_tab_controller = is_sync_tab_controller;

        if(dt.is_sdt) {
          dt.stop_capture();
          dt.is_send = 0;
        } else {
          if(dt.control_assigned && is_sync_tab_controller) {
            rdc.is_control = false;
            dt.remote_control();  // send RDC_CMD_ASSIGN_CONTROL(-1) to MCU, which is useful for playback
          }

          if(JoinNet.net_init_finished || dt.is_sync_tab_controller) {
            //hmtg.util.log(-2, '******debug, channel ' + dt.channel + ' reset dt.bmp');
            dt.stop_capture();
            dt.is_send = 0;
            dt.is_control_allowed = false;
            dt.stop_control();
            dt.bmp = null;
            dt.descr = '';
            dt.descr_ssrc = -1;
            dt.draw();
          }
          if(dt.is_sync_tab_controller) {
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_RDC_USERLIST); // this will trigger the userlist update
          }
        }

        if(!hmtgHelper.inside_angular) $scope.$digest();
      }
      dt.resetAllowControlPrompt();
      dt.is_remote_fullscreen = false;
      var target_dt = dt.is_sdt ? sdt : rdc;
      target_dt.capture_width = 0;
      target_dt.capture_height = 0;
      target_dt.capture_color_str_id = '';
    }
    $scope.$on(hmtgHelper.WM_TOKEN_STATUS_CHANGED, dt.on_tab_ssrc_change);
    $scope.$on(hmtgHelper.WM_CONTROLLER_STATUS_CHANGED, dt.on_tab_ssrc_change);

    $rootScope.$on('$translateChangeEnd', function() {
      populate_source_list();
      populate_color_list();
    });
    function populate_source_list() {
      dt.source_list = [];
      if(navigator.getUserMedia) {
        dt.source_list = dt.source_list.concat([
        { id: 'screen', name: $translate.instant('ID_CAPTURED_SCREEN') },
        { id: 'camera', name: $translate.instant('ID_CAMERA_VIEW') }
        ]
        );
      }
      if(hmtgSound.ac) {
        dt.source_list = dt.source_list.concat([{ id: 'import', name: $translate.instant('ID_IMPORT_HTML5')}]);
      }
      dt.source_list = dt.source_list.concat([
      { id: 'board', name: $translate.instant('ID_WHITE_BOARD') },
      { id: 'video', name: $translate.instant('ID_TAB_VIDEO') }
      ]
      );
      // only add webappp if the browser support AudioWorkerNode
      //dt.source_list = dt.source_list.concat([{ id: 'webapp', name: $translate.instant('IDS_APP_NAME')}]);
    }
    function populate_color_list() {
      dt.color_list = [
        { id: '0', name: $translate.instant('ID_AUTO_SELECT') },
        { id: '24', name: $translate.instant('ID_24BIT_COLOR') },
        { id: '16', name: $translate.instant('ID_16BIT_COLOR') },
        { id: '8c', name: $translate.instant('ID_8BIT_COLOR') },
        { id: '8g', name: $translate.instant('ID_8BIT_GRAY') },
        { id: '4c', name: $translate.instant('ID_4BIT_COLOR') },
        { id: '4g', name: $translate.instant('ID_4BIT_GRAY') },
        { id: '2', name: $translate.instant('ID_2BIT_COLOR') },
        { id: '1', name: $translate.instant('ID_1BIT_COLOR') }
      ];
    }
    populate_source_list();
    dt.source_id = dt.source_list[0].id;
    populate_color_list();
    dt.color_id = '0';
    dt.color_id_hash = {
      '24': 'ID_24BIT_COLOR',
      '16': 'ID_16BIT_COLOR',
      '8c': 'ID_8BIT_COLOR',
      '8g': 'ID_8BIT_GRAY',
      '4c': 'ID_4BIT_COLOR',
      '4g': 'ID_4BIT_GRAY',
      '2': 'ID_2BIT_COLOR',
      '1': 'ID_1BIT_COLOR'
    };

    $scope.$watch('dt.source_id', function() {
      dt.stop_current_capture();
      if(dt.is_send) {
        dt.request_data_source();
      }
    });

    dt.request_data_source = function() {
      if(dt.source_id == 'camera') {
        var elem_video = joinnetVideo.elem_video;
        if(!elem_video || elem_video.videoWidth == 0) {
          hmtgHelper.inside_angular++;
          joinnetVideo.start();
          hmtgHelper.inside_angular--;
        }
      } else if(dt.source_id == 'screen') {
        var elem_screen = joinnetVideo.elem_screen;
        if(!elem_screen || elem_screen.videoWidth == 0) {
          hmtgHelper.inside_angular++;
          joinnetVideo.startScreenCapture();
          hmtgHelper.inside_angular--;
        }
      } else if(dt.source_id == 'import') {
        var input1 = document.getElementById('html5_media1');
        var input2 = document.getElementById('html5_media2');
        if(input1 && input1.src && input1.videoWidth) {
        } else if(input2 && input2.src && input2.videoWidth) {
        } else {
          $rootScope.$broadcast(hmtgHelper.WM_IMPORT_TRANSCODING);
        }
      }
    }

    $scope.$watch('dt.color_id', function() {
      dt.stop_current_capture();
      if(!dt.is_sdt
        && dt.control_assigned
        && dt.controllee_ssrc != -1
        && dt.controller_ssrc != dt.controllee_ssrc
        && dt.controller_ssrc != -1
        && dt.controller_ssrc == hmtg.jnkernel._jn_ssrc_index()) {
        var target_bit_count = parseInt(dt.color_id);
        hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, dt.controllee_ssrc,
            String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 5, 0, 0,
            ((dt.color_id.indexOf('g') != -1) ? hmtg.config.RDC_CMD_DESIRED_GRAYSCALE_DEPTH : hmtg.config.RDC_CMD_DESIRED_BIT_DEPTH),
            target_bit_count, 0, 0, 0));
      }
    });

    $scope.$watch('dt.bitrate_pos', function() {
      if(dt.channel != -1) {
        var array = hmtg.jnkernel._jn_plugin_data();
        hmtgHelper.inside_angular++;
        array[dt.channel]._data_rate((dt.min_bitrate + (dt.max_bitrate - dt.min_bitrate) * dt.bitrate_pos / 100.0) >> 0);
        hmtgHelper.inside_angular--;
        //dt.bitrate_str = '' + ((array[dt.channel]._data_rate() / 1000) >>> 0) + 'kbps';
        dt.bitrate_str = '' + hmtgHelper.number2gmk(array[dt.channel]._data_rate()) + 'bps';
      }
    });

    $scope.$on(hmtgHelper.WM_UPDATE_APPDATA_BITRATE, function(event, channel) {
      if(typeof channel == 'undefined' || channel == dt.channel) dt.update_bitrate();
    });

    dt.update_bitrate = function() {
      if(dt.channel != -1) {
        var array = hmtg.jnkernel._jn_plugin_data();
        var max = array[dt.channel]._data_rate_threshold();
        if(appSetting.use_max_appdata_bitrate) {
          max = Math.min(max, appSetting.max_appdata_bitrate * 1000);
        }
        dt.max_bitrate = Math.max(dt.min_bitrate, max);
        array[dt.channel]._data_rate(Math.min(dt.max_bitrate, Math.max(dt.min_bitrate, array[dt.channel]._data_rate())));
        //dt.bitrate_str = '' + ((array[dt.channel]._data_rate() / 1000) >>> 0) + 'kbps';
        dt.bitrate_str = '' + hmtgHelper.number2gmk(array[dt.channel]._data_rate()) + 'bps';
        if(dt.max_bitrate == dt.min_bitrate) {
          dt.can_change_bitrate = false;
        } else {
          dt.can_change_bitrate = true;
          dt.bitrate_pos = (array[dt.channel]._data_rate() - dt.min_bitrate) / (dt.max_bitrate - dt.min_bitrate) * 100;
        }
      }
    }

    dt.resetAllowControlPrompt = function() {
      if(dt.allow_control_alert_item) {
        hmtgAlert.remove_link_item(dt.allow_control_alert_item);
        dt.allow_control_alert_item = null;
      }
    }

  }
])

.controller('SDTCtrl', ['$scope', 'hmtgHelper', 'sdt', 'joinnetHelper', '$rootScope', 'hmtgAlert', 'hmtgSound', '$translate',
  '$controller',
  function($scope, hmtgHelper, sdt, joinnetHelper, $rootScope, hmtgAlert, hmtgSound, $translate, $controller) {
    $controller('DTCtrl', { $scope: $scope });
    var dt = $scope.dt;
    dt.is_sdt = true;
    $scope.w = sdt;
    dt.dt0 = document.getElementById('sdt0');
    dt.canvas = document.getElementById('sdt'); // final, stretched
    dt.ctx = dt.canvas.getContext('2d');
    dt.canvas.width = dt.canvas.height = dt.MIN_SIZE;
    dt.descr = '';
    dt.descr_ssrc = -1;
    dt.container = document.getElementById('sdt_container');
    $scope.client_width = 0;
    dt.request_fullscreen = dt.container.requestFullscreen
      || dt.container.msRequestFullscreen
      || dt.container.mozRequestFullScreen
      || dt.container.webkitRequestFullscreen
    ;

    var myheight = 100;
    var mywidth = 100;
    dt.style_max_size = function() {
      var old_h = myheight;
      var old_w = mywidth;
      if(dt.is_fullscreen) {
        myheight = hmtgHelper.view_port_height - dt.dt0.offsetTop - 1;
        mywidth = hmtgHelper.view_port_width - 1;
      } else {
        var offset = {};
        hmtg.util.calcOffset(dt.dt0, offset);
        if(offset.y) {
          if(dt.container.clientWidth) $scope.client_width = dt.container.clientWidth;
          myheight = Math.max(((hmtgHelper.view_port_height >> 1) + (hmtgHelper.view_port_height >> 3)), hmtgHelper.view_port_height - offset.y - 1);
          mywidth = Math.max((hmtgHelper.view_port_width >> 3), Math.min(hmtgHelper.view_port_width, $scope.client_width) - 1);
        }
      }

      // this logic can prevent exception caused by too frequent $digest
      // [$rootScope:infdig]
      if(myheight > old_h && myheight - old_h < 15) {
        myheight = old_h;
      }
      if(mywidth > old_w && mywidth - old_w < 15) {
        mywidth = old_w;
      }
      return {
        'max-height': '' + (myheight) + 'px',
        'max-width': '' + (mywidth) + 'px'
      };
    }

    //hmtg.util.log(-2, '******debug, SDTCtrl');

    $scope.init(hmtgHelper.GUID_DESKTOP_SHARING);
    if(hmtg.jnkernel._jn_bConnected()) {
      hmtgHelper.inside_angular++;
      dt.sync_tab_controller = hmtg.jnkernel._tab_ssrc();
      dt.is_sync_tab_controller = dt.sync_tab_controller != -1 && dt.sync_tab_controller == hmtg.jnkernel._jn_ssrc_index();
      hmtgHelper.inside_angular--;
    }

    $scope.$on(hmtgHelper.WM_ADD_USER, function(event, ssrc) {
      // in case the add_user (via control channel) is arrived later than the first plugin packet
      // we need to update the user's name
      if(dt.descr_ssrc != -1 && ssrc == dt.descr_ssrc) {
        var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
        dt.descr = '[' + hmtg.util.decodeUtf8(a[dt.descr_ssrc] ? a[dt.descr_ssrc]._szRealName() : ('ssrc' + dt.descr_ssrc)) + ']';
        if(!hmtgHelper.inside_angular) $scope.$digest();
      }
    });

    $scope.$on(hmtgHelper.WM_NEW_PLUGIN, function(e, error_code, request_id, channel) {
      $scope.on_new_plugin(hmtgHelper.GUID_DESKTOP_SHARING, error_code, request_id, channel);
    });

    $scope.$on(hmtgHelper.WM_QUIT_SESSION, function() {
      dt.stop_capture();
      dt.sync_tab_controller = -1;
      dt.is_sync_tab_controller = false;
      dt.is_send = false;
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_START_SESSION, function() {
      dt.channel = -1;
      dt.m_ConnectStatus = 0;
      dt.descr = '';
      dt.descr_ssrc = -1;
      dt.bmp = null;
      dt.draw();
      dt.clear_decoder();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_RESET_SESSION, function() {
      dt.auto_allow_control_ssrc = -1;
      dt.channel = -1;
      dt.m_ConnectStatus = 0;
      dt.descr = '';
      dt.descr_ssrc = -1;
      dt.bmp = null;
      dt.draw();
      dt.clear_decoder();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_PLAYBACK_RESTART, function() {
      dt.channel = -1;
      dt.m_ConnectStatus = 0;
      dt.descr = '';
      dt.descr_ssrc = -1;
      dt.bmp = null;
      dt.draw();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

  }
])

.controller('RDCCtrl', ['$scope', 'hmtgHelper', 'rdc', 'joinnetHelper', '$rootScope', 'hmtgAlert', 'hmtgSound', '$translate',
  '$controller', 'appSetting',
  function($scope, hmtgHelper, rdc, joinnetHelper, $rootScope, hmtgAlert, hmtgSound, $translate, $controller, appSetting) {
    $controller('DTCtrl', { $scope: $scope });
    var dt = $scope.dt;
    dt.is_sdt = false;
    $scope.w = rdc;
    dt.dt0 = document.getElementById('rdc0');
    dt.canvas = document.getElementById('rdc'); // final, stretched
    dt.ctx = dt.canvas.getContext('2d');
    dt.canvas.width = dt.canvas.height = dt.MIN_SIZE;
    dt.container = document.getElementById('rdc_container');
    $scope.client_width = 0;
    dt.request_fullscreen = dt.container.requestFullscreen
      || dt.container.msRequestFullscreen
      || dt.container.mozRequestFullScreen
      || dt.container.webkitRequestFullscreen
    ;
    rdc.is_control = false;  // whether the control button is pressed
    dt.userlist = [];
    dt.controller_ssrc = -1;
    dt.controllee_ssrc = -1;
    dt.is_controlling = false;  // whether a remote control is active
    dt.control_assigned = false;  // whether a controller vs controllee pair be assigned
    dt.is_sender = false;
    var pktno = 0;
    var mousemove_timerID = null;
    var last_mousemove_tick = hmtg.util.GetTickCount() - 150;
    var last_mousemove_x = -1;
    var last_mousemove_y = -1;

    var myheight = 100;
    var mywidth = 100;
    dt.style_max_size = function() {
      var old_h = myheight;
      var old_w = mywidth;
      if(dt.is_fullscreen) {
        myheight = hmtgHelper.view_port_height - dt.dt0.offsetTop - 1;
        mywidth = hmtgHelper.view_port_width - 1;
      } else {
        var offset = {};
        hmtg.util.calcOffset(dt.dt0, offset);
        if(offset.y) {
          if(dt.container.clientWidth) $scope.client_width = dt.container.clientWidth;
          myheight = Math.max(((hmtgHelper.view_port_height >> 1) + (hmtgHelper.view_port_height >> 3)), hmtgHelper.view_port_height - offset.y - 1);
          mywidth = Math.max((hmtgHelper.view_port_width >> 3), Math.min(hmtgHelper.view_port_width, $scope.client_width) - 1);
        }
      }

      // this logic can prevent exception caused by too frequent $digest
      // [$rootScope:infdig]
      if(myheight > old_h && myheight - old_h < 15) {
        myheight = old_h;
      }
      if(mywidth > old_w && mywidth - old_w < 15) {
        mywidth = old_w;
      }
      return {
        'max-height': '' + (myheight) + 'px',
        'max-width': '' + (mywidth) + 'px'
      };
    }

    dt.remote_control = function(monitor_only) {
      if(!dt.is_sync_tab_controller) return;
      if(!hmtg.jnkernel._jn_bConnected()) return;
      dt.monitor_only = monitor_only;

      if(rdc.is_control) {
        if(dt.m_ConnectStatus == 0) { // disconnected
          dt.m_ConnectStatus = 1; // connecting
          //this.GUID_REMOTE_CONTROL = '4FC0606A-DA4A-423F-A830-AC5D9853C201';
          hmtg.jnkernel.jn_command_RequestPlugInChannel(hmtg.config.PLUGIN_CHANNEL_TYPE_UDP_1,
            String.fromCharCode(0x4f, 0xc0, 0x60, 0x6a,
            0, 0, 0xda, 0x4a,
            0, 0, 0x42, 0x3f,
            0xa8, 0x30, 0xac, 0x5d, 0x98, 0x53, 0xc2, 0x1), 0, 1);
          return;
        } else if(dt.m_ConnectStatus == 2) { // connected
          if(dt.controller_ssrc >= 0 && dt.controllee_ssrc >= 0) {
            var data =
              String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 9, 0, 0, (monitor_only ? hmtg.config.RDC_CMD_ASSIGN_MONITOR : hmtg.config.RDC_CMD_ASSIGN_CONTROL),
              dt.controllee_ssrc & 0xff,
              (dt.controllee_ssrc >> 8) & 0xff,
              (dt.controllee_ssrc >> 16) & 0xff,
              (dt.controllee_ssrc >> 24) & 0xff,
              dt.controller_ssrc & 0xff,
              (dt.controller_ssrc >> 8) & 0xff,
              (dt.controller_ssrc >> 16) & 0xff,
              (dt.controller_ssrc >> 24) & 0xff);
            if(monitor_only) {
              hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 0, dt.controller_ssrc, data);
              if(dt.controller_ssrc != dt.controllee_ssrc) {
                hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 0, dt.controllee_ssrc, data);
              }
            } else {
              hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 1, 0, -1, data);
            }
            cancel_wait_response_timer();
            dt.wait_response_timerID = setTimeout(function() {
              dt.wait_response_timerID = null;
              hmtgSound.ShowErrorPrompt(function() { return $translate.instant('IDS_RDC_NO_RESPONSE') }, 20);
            }, 15000);
          }
        }
      } else {
        cancel_wait_response_timer();
        hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 1, 0, -1,
          String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 5, 0, 0, (monitor_only ? hmtg.config.RDC_CMD_ASSIGN_MONITOR : hmtg.config.RDC_CMD_ASSIGN_CONTROL), 0xff, 0xff, 0xff, 0xff));
      }
      if(dt.channel != -1) {
        hmtg.jnkernel.jn_command_PlugInSetStaticData(dt.channel,
          String.fromCharCode(hmtg.config.DT_CAPTURE_END, 0, 0, 0));
      }
    }

    dt.toggle_control = function(monitor_only) {
      if(!dt.is_sync_tab_controller) return;
      if(!hmtg.jnkernel._jn_bConnected()) return;
      rdc.is_control = !rdc.is_control;
      dt.remote_control(monitor_only);
    }

    $scope.$on(hmtgHelper.WM_REMOTE_MONITOR, function(event, ssrc) {
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      if(dt.controllee_ssrc == ssrc && dt.controller_ssrc == my_ssrc) return;
      if(!dt.is_sync_tab_controller) return;
      if(!hmtg.jnkernel._jn_bConnected()) return;
      if(!appSetting.remote_monitor_mode) return;
      var found = false;
      var i;
      for(i = 0; i < dt.userlist.length; i++) {
        if(ssrc == dt.userlist[i].ssrc) {
          found = true;
          break;
        }
      }
      if(!found) return;
      if(rdc.is_control) {
        rdc.is_control = !rdc.is_control;
        dt.remote_control();
      }
      dt.controller_ssrc = my_ssrc;
      dt.controllee_ssrc = ssrc;
      setTimeout(function() {
        if(!rdc.is_control) {
          rdc.is_control = !rdc.is_control;
          dt.remote_control(true);
        }
      }, 0);
    });

    dt.SendRdcInput = function(message, wParam, lParam) {
      var str;
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      var pkt_header_str0 = String.fromCharCode(my_ssrc & 0xff, (my_ssrc >> 8) & 0xff, 0, 128, 0, 0);
      str = pkt_header_str0 + String.fromCharCode(hmtg.config.DT_RDC_INPUT, 12, 0, 0);
      appendDWORD(message);
      appendDWORD(wParam);
      appendDWORD(lParam);

      var now = hmtg.util.GetTickCount();
      var pkt = hmtg.jnkernel.jn_command_write_timestamp_given(
              0,
              str, now, pktno);
      hmtg.jnkernel.jn_command_send_plugin_pkt(pkt, dt.channel, dt.controllee_ssrc, 14, 1, 1);
      pktno++;
      function appendDWORD(value) {
        str += String.fromCharCode(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
      }
    }

    dt.startRemoteControl = function() {
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      if(dt.controller_ssrc == my_ssrc && dt.controllee_ssrc != my_ssrc) {
        dt.canvas.tabIndex = 0;
        dt.canvas.addEventListener('keydown', onKeyDown, true);
        dt.canvas.addEventListener('keyup', onKeyUp, true);
        dt.dt0.addEventListener('mousedown', onMouseDown, true);
        dt.dt0.addEventListener('mousemove', onMouseMove, true);
        dt.dt0.addEventListener('mouseup', onMouseUp, true);
        dt.dt0.addEventListener('contextmenu', onContextMenu, true);
      }
    }

    dt.stopRemoteControl = function() {
      dt.canvas.removeAttribute('tabIndex');
      dt.canvas.removeEventListener('keydown', onKeyDown, true);
      dt.canvas.removeEventListener('keyup', onKeyUp, true);
      dt.dt0.removeEventListener('mousedown', onMouseDown, true);
      dt.dt0.removeEventListener('mousemove', onMouseMove, true);
      dt.dt0.removeEventListener('mouseup', onMouseUp, true);
      dt.dt0.removeEventListener('contextmenu', onContextMenu, true);
      if(mousemove_timerID) {
        clearTimeout(mousemove_timerID);
        mousemove_timerID = null;
      }
    }

    dt.handleSignal = function(data, ssrc, size) {
      if(size < 1) return;
      if(dt.channel == -1) return;
      var sig = data.charCodeAt(4);
      switch(sig) {
        case hmtg.config.RDC_CMD_END_CONTROL: // only sent by native JoinNet. web app use RDC_CMD_ASSIGN_CONTROL(-1)
          dt.resetAllowControlPrompt();
          cancel_wait_response_timer();
          dt.control_assigned = false;
          dt.stop_capture();
          dt.stop_control();
          rdc.is_control = false;
          dt.is_controlling = false;
          dt.is_send = false;
          dt.is_control_allowed = false;

          if(!hmtgHelper.inside_angular) $scope.$digest();
          break;
        case hmtg.config.RDC_CMD_REQUEST_CONTROL:
        case hmtg.config.RDC_CMD_REQUEST_MONITOR:
          if(ssrc != dt.controller_ssrc) return;
          dt.monitor_only = sig == hmtg.config.RDC_CMD_REQUEST_MONITOR;
          hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, ssrc,
            String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 1, 0, 0, (sig == hmtg.config.RDC_CMD_REQUEST_CONTROL ? hmtg.config.RDC_CMD_ACK_REQUEST_CONTROL : hmtg.config.RDC_CMD_ACK_REQUEST_MONITOR)));
          //hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, ssrc,
          //String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 1, 0, 0, hmtg.config.RDC_CMD_REQUEST_CONTROL_DENY));
          if(dt.auto_allow_control_ssrc != dt.controller_ssrc && dt.controller_ssrc != hmtg.jnkernel._jn_ssrc_index()) {
            var item = {};
            item['timeout'] = 15;
            var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
            var myname = hmtg.util.decodeUtf8(a[dt.controller_ssrc] ? a[dt.controller_ssrc]._szRealName() : ('ssrc' + dt.controller_ssrc));
            item['update'] = function() { return $translate.instant('ID_ALLOW_CONTROL_PROMPT').replace('#user#', myname) };
            item['text'] = item['update']();
            item['type'] = 'info';
            item['click'] = function(index) {
              hmtgHelper.inside_angular++;
              hmtgAlert.click_link(index);
              if(dt.control_assigned && dt.is_sender) {
                dt.auto_allow_control_ssrc = dt.controller_ssrc;
                if(!dt.is_send) dt.toggle_send();
                dt.is_control_allowed = true;
                hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, dt.controller_ssrc,
                  String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 1, 0, 0, hmtg.config.RDC_CMD_START_CONTROL));
              }
              hmtgHelper.inside_angular--;
            };
            item['timeout_action'] = item['cancel'] = function() {
              hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, ssrc,
                String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 1, 0, 0, hmtg.config.RDC_CMD_REQUEST_CONTROL_DENY));
            }

            dt.allow_control_alert_item = item;
            hmtgAlert.add_link_item(item);
          } else {
            if(!dt.is_send) dt.toggle_send();
            dt.is_control_allowed = true;
            hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, dt.controller_ssrc,
              String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 1, 0, 0, hmtg.config.RDC_CMD_START_CONTROL));
          }
          break;
        case hmtg.config.RDC_CMD_DESIRED_BIT_DEPTH:
          var depth = dt.getDWORD(data, 5);
          if(depth == 1 || depth == 2 || depth == 4 || depth == 8 || depth == 16 || depth == 24) {
            dt.color_id = '' + depth;
            if(depth == 4 || depth == 8) {
              dt.color_id += 'c';
            }
          } else {
            dt.color_id = '0';
          }
          break;
        case hmtg.config.RDC_CMD_DESIRED_GRAYSCALE_DEPTH:
          var depth = dt.getDWORD(data, 5);
          if(depth == 4 || depth == 8) {
            dt.color_id = '' + depth + 'g';
          } else {
            dt.color_id = '0';
          }
          break;
        case hmtg.config.RDC_CMD_ACK_REQUEST_CONTROL:
        case hmtg.config.RDC_CMD_ACK_REQUEST_MONITOR:
          cancel_wait_response_timer();
          if(!dt.is_sync_tab_controller && dt.controllee_ssrc != -1) {
            dt.monitor_only = sig == hmtg.config.RDC_CMD_ACK_REQUEST_MONITOR;
            if(dt.sync_tab_controller != -1) {
              hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, dt.sync_tab_controller,
               String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 1, 0, 0, (sig == hmtg.config.RDC_CMD_ACK_REQUEST_CONTROL ? hmtg.config.RDC_CMD_ACK_ASSIGN_CONTROL : hmtg.config.RDC_CMD_ACK_ASSIGN_MONITOR)));
            }
            hmtgSound.ShowInfoPrompt(
              function() {
                var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
                return $translate.instant('IDS_REMIND_CONTROL')
                  .replace('%1$s', hmtg.util.decodeUtf8(a[dt.controllee_ssrc] ? a[dt.controllee_ssrc]._szRealName() : ('ssrc' + dt.controllee_ssrc)))
              },
              10);
          }
          break;
        case hmtg.config.RDC_CMD_MAX_BIT_DEPTH:
          break;
        case hmtg.config.RDC_CMD_REQUEST_CONTROL_DENY:
          break;
        case hmtg.config.RDC_CMD_DUMMY_MODE_PASSWORD_ERR:
          break;
        case hmtg.config.RDC_CMD_START_CONTROL:
          dt.controlling = true;
          pktno = 0;
          if(!dt.monitor_only) {
            dt.startRemoteControl();
          }
          break;
        case hmtg.config.RDC_CMD_ASSIGN_CONTROL:
        case hmtg.config.RDC_CMD_ASSIGN_MONITOR:
          var sync_tab_controller = hmtg.jnkernel._tab_ssrc();
          if(sync_tab_controller != ssrc) return;
          if(size < 5) return;
          var controllee_ssrc = dt.getDWORD(data, 5);
          if(controllee_ssrc >= 0) {
            if(size < 9) return;
            var controller_ssrc = dt.getDWORD(data, 9);
            if(controller_ssrc >= 0) {
              dt.controller_ssrc = '' + controller_ssrc;
              dt.controllee_ssrc = '' + controllee_ssrc;
              dt.control_assigned = true;
              dt.is_sender = dt.controllee_ssrc == hmtg.jnkernel._jn_ssrc_index();
              dt.descr = '';
              dt.descr_ssrc = -1;
              var target_dt = rdc;
              target_dt.capture_width = 0;
              target_dt.capture_height = 0;
              target_dt.capture_color_str_id = '';

              rdc.controllee_ssrc = controllee_ssrc;

              var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
              dt.controller_name = '[' + hmtg.util.decodeUtf8(a[controller_ssrc] ? a[controller_ssrc]._szRealName() : ('ssrc' + controller_ssrc)) + ']';
              dt.controllee_name = '[' + hmtg.util.decodeUtf8(a[controllee_ssrc] ? a[controllee_ssrc]._szRealName() : ('ssrc' + controllee_ssrc)) + ']';
              if(controller_ssrc == hmtg.jnkernel._jn_ssrc_index()) {
                hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, controllee_ssrc,
                  String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 1, 0, 0, (sig == hmtg.config.RDC_CMD_ASSIGN_CONTROL ? hmtg.config.RDC_CMD_REQUEST_CONTROL : hmtg.config.RDC_CMD_REQUEST_MONITOR)));
              }
            }
          } else {
            dt.stopRemoteControl();
            dt.resetAllowControlPrompt();
            cancel_wait_response_timer();
            dt.control_assigned = false;
            dt.stop_capture();
            dt.is_send = false;
            dt.is_control_allowed = false;
            dt.descr = '';
            dt.descr_ssrc = -1;
          }
          if(!hmtgHelper.inside_angular) $scope.$digest();

          break;
        case hmtg.config.RDC_CMD_ACK_ASSIGN_CONTROL:
        case hmtg.config.RDC_CMD_ACK_ASSIGN_MONITOR:
          cancel_wait_response_timer();
          break;
        case hmtg.config.RDC_CMD_SHOW_CONTENT_WHILE_DRAGGING:
          break;
        case hmtg.config.RDC_STATUS_WINDOW_SIZEMOVE:
          break;
        case hmtg.config.RDC_CMD_CONTROL_NOT_SUPPORTED:
          break;
        case hmtg.config.RDC_CMD_KEYBOARD_LANG_ID:
          break;
        default:
          break;
      }
    }

    var WM_KEYDOWN = 0x100;
    var WM_KEYUP = 0x101;
    var WM_LBUTTONDOWN = 0x201;
    var WM_LBUTTONUP = 0x202;
    var WM_RBUTTONDOWN = 0x204;
    var WM_RBUTTONUP = 0x205;
    var WM_MOUSEMOVE = 0x200;
    var MK_CONTROL = 0x8; // CTRL
    var MK_SHIFT = 0x4; // SHIFT
    var onKeyDown = function(e) {
      //e.stopPropagation();
      //e.preventDefault();
      if(!dt.is_receive) return;
      dt.SendRdcInput(WM_KEYDOWN, e.keyCode, 0);
    }
    var onKeyUp = function(e) {
      //e.stopPropagation();
      //e.preventDefault();
      if(!dt.is_receive) return;
      dt.SendRdcInput(WM_KEYUP, e.keyCode, 0);
    }

    var transformX = function(x) {
      return Math.min(parseInt((dt.container.scrollLeft + dt.dt0.scrollLeft + x) / dt.ratio), 32767);
    }

    var transformY = function(y) {
      return Math.min(parseInt((dt.container.scrollTop + dt.dt0.scrollTop + y) / dt.ratio), 32767);
    }

    var in_scrollbar = function(element, x, y) {
      if(element.offsetHeight > element.clientHeight ||
        element.offsetWidth > element.clientWidth) {
        if(x > element.clientWidth) {
          return true;
        } else if(y > element.clientHeight) {
          return true;
        }
        return false;
      }
    }

    var onMouseDown = function(e) {
      if(!dt.is_receive) return;
      //dt.canvas.focus();
      if(e.button != 0 && e.button != 2) return;
      //e.stopPropagation();
      //e.preventDefault();
      var offset = {};
      hmtg.util.calcOffset(dt.dt0, offset);
      var x, y;
      if(e.type == 'touchstart') {
        if(in_scrollbar(dt.dt0, e.touches[0].pageX - offset.x, e.touches[0].pageY - offset.y)) return;
        e.preventDefault();
        x = transformX(e.touches[0].pageX - offset.x);
        y = transformY(e.touches[0].pageY - offset.y);
      } else {
        if(in_scrollbar(dt.dt0, e.pageX - offset.x, e.pageY - offset.y)) return;
        x = transformX(e.pageX - offset.x);
        y = transformY(e.pageY - offset.y);
      }
      dt.SendRdcInput(e.button == 0 ? WM_LBUTTONDOWN : WM_RBUTTONDOWN, 0, ((y << 16) | x));
      last_mousemove_x = x;
      last_mousemove_y = y;
    }

    var onMouseMove = function(e) {
      if(!dt.is_receive) return;
      //e.stopPropagation();
      //e.preventDefault();
      var offset = {};
      hmtg.util.calcOffset(dt.dt0, offset);
      var x, y;
      if(e.type == 'touchmove') {
        if(in_scrollbar(dt.dt0, e.touches[0].pageX - offset.x, e.touches[0].pageY - offset.y)) return;
        e.preventDefault();
        x = transformX(e.touches[0].pageX - offset.x);
        y = transformY(e.touches[0].pageY - offset.y);
      } else {
        if(in_scrollbar(dt.dt0, e.pageX - offset.x, e.pageY - offset.y)) return;
        x = transformX(e.pageX - offset.x);
        y = transformY(e.pageY - offset.y);
      }
      if(!mousemove_timerID) {
        var now = hmtg.util.GetTickCount();
        if(now - last_mousemove_tick < 50) {
          mousemove_timerID = setTimeout(function() {
            mousemove_timerID = null;
            send_mousemove();
          }, 50 - (now - last_mousemove_tick));
        } else {
          send_mousemove();
        }
      }
      function send_mousemove() {
        if(x == last_mousemove_x && y == last_mousemove_y) return;

        dt.SendRdcInput(WM_MOUSEMOVE, 0, ((y << 16) | x));
        last_mousemove_tick = hmtg.util.GetTickCount();
        last_mousemove_x = x;
        last_mousemove_y = y;
      }
    }

    var onMouseUp = function(e) {
      if(!dt.is_receive) return;
      if(e.button != 0 && e.button != 2) return;
      //e.stopPropagation();
      //e.preventDefault();
      var offset = {};
      hmtg.util.calcOffset(dt.dt0, offset);
      var x, y;
      if(e.type == 'touchend') {
        if(in_scrollbar(dt.dt0, e.touches[0].pageX - offset.x, e.touches[0].pageY - offset.y)) return;
        e.preventDefault();
        x = transformX(e.changedTouches[0].pageX - offset.x);
        y = transformY(e.changedTouches[0].pageY - offset.y);
      } else {
        if(in_scrollbar(dt.dt0, e.pageX - offset.x, e.pageY - offset.y)) return;
        x = transformX(e.pageX - offset.x);
        y = transformY(e.pageY - offset.y);
      }
      dt.SendRdcInput(e.button == 0 ? WM_LBUTTONUP : WM_RBUTTONUP, 0, ((y << 16) | x));
      last_mousemove_x = x;
      last_mousemove_y = y;
    }

    var onContextMenu = function(e) {
      if(dt.is_receive) {
        if(e.button != 0 && e.button != 2) return;
        e.stopPropagation();
        e.preventDefault();
      }
    }

    function cancel_wait_response_timer() {
      if(dt.wait_response_timerID) {
        clearTimeout(dt.wait_response_timerID);
        dt.wait_response_timerID = null;
      }
    }

    function cancel_wait_permission_timer() {
      if(dt.wait_permission_timerID) {
        clearTimeout(dt.wait_permission_timerID);
        dt.wait_permission_timerID = null;
      }
    }

    $scope.$on(hmtgHelper.WM_NEW_PLUGIN, function(e, error_code, request_id, channel) {
      $scope.on_new_plugin(hmtgHelper.GUID_REMOTE_CONTROL, error_code, request_id, channel);
    });

    dt.stop_control = function() {
      if(dt.control_assigned) {
        dt.control_assigned = false;
        dt.is_controlling = false;
        rdc.is_control = false;
        cancel_wait_response_timer();
      }
    }

    $scope.$on(hmtgHelper.WM_TALKER_STATUS_CHANGED, update_rdc_userlist);
    $scope.$on(hmtgHelper.WM_UPDATE_RDC_USERLIST, update_rdc_userlist);

    function update_rdc_userlist() {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
      var sync_tab_controller = hmtg.jnkernel._tab_ssrc();
      var is_sync_tab_controller = sync_tab_controller != -1 && sync_tab_controller == hmtg.jnkernel._jn_ssrc_index();
      if(is_sync_tab_controller) {
        update_userlist();
        var to_stop_remote_control = false;
        if(dt.controller_ssrc != -1 && !hmtg.jnkernel.is_talker(dt.controller_ssrc)) {
          if(dt.control_assigned) to_stop_remote_control = true;
          dt.stop_capture();  // in case I am the sender, stop capture
          dt.stop_control();
          dt.bmp = null;
          dt.draw();
          dt.controller_ssrc = -1;
        }
        if(dt.controller_ssrc == -1) {
          if(dt.userlist.length) dt.controller_ssrc = dt.userlist[0].ssrc;
          else dt.controller_ssrc = -1;
        }
        if(dt.controllee_ssrc != -1 && !hmtg.jnkernel.is_talker(dt.controllee_ssrc)) {
          if(dt.control_assigned) to_stop_remote_control = true;
          dt.stop_control();
          dt.bmp = null;
          dt.draw();
          dt.controllee_ssrc = -1;
        }
        if(to_stop_remote_control) {
          rdc.is_control = false;
          dt.remote_control(); // send RDC_CMD_ASSIGN_CONTROL(-1) to MCU, which is useful for playback
        }
        if(dt.controllee_ssrc == -1) {
          if(dt.userlist.length > 1) dt.controllee_ssrc = dt.userlist[1].ssrc;
          else if(dt.userlist.length) dt.controllee_ssrc = dt.userlist[0].ssrc;
          else dt.controllee_ssrc = -1;
        }
        // sync tab controller doesn't show dt.descr
        dt.descr = '';
        dt.descr_ssrc = -1;
      } else {
        if(dt.controller_ssrc != -1 && !hmtg.jnkernel.is_talker(dt.controller_ssrc)) {
          dt.stop_capture();  // in case I am the sender, stop capture
          dt.stop_control();
          dt.bmp = null;
          dt.draw();
          dt.controller_ssrc = -1;
          dt.descr = '';
          dt.descr_ssrc = -1;
        }
        if(dt.controllee_ssrc != -1 && !hmtg.jnkernel.is_talker(dt.controllee_ssrc)) {
          dt.stop_control();
          dt.bmp = null;
          dt.draw();
          dt.controllee_ssrc = -1;
          dt.descr = '';
          dt.descr_ssrc = -1;
        }
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    }

    function update_userlist() {
      var userlist = [];
      var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
      var ssrc_sender = hmtg.jnkernel._jn_iDataSender();
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var hash = {};
      if(ssrc_holder != -1) {
        userlist.push({ ssrc: '' + ssrc_holder, name: hmtg.util.decodeUtf8(a[ssrc_holder] ? a[ssrc_holder]._szRealName() : ('ssrc' + ssrc_holder)) });
        hash[ssrc_holder] = true;
      }

      var start_idx = userlist.length;
      if(ssrc_sender != -1 && ssrc_sender != ssrc_holder) {
        userlist_insert(userlist, start_idx, { ssrc: '' + ssrc_sender, name: hmtg.util.decodeUtf8(a[ssrc_sender] ? a[ssrc_sender]._szRealName() : ('ssrc' + ssrc_sender)) });
        hash[ssrc_sender] = true;
      }

      var list = hmtg.jnkernel._jn_iParticipantAudioSsrc();
      var i;
      for(i = 0; i < list.length; i++) {
        if(list[i] != -1 && !hash[list[i]]) {
          userlist_insert(userlist, start_idx, { ssrc: '' + list[i], name: hmtg.util.decodeUtf8(a[list[i]] ? a[list[i]]._szRealName() : ('ssrc' + list[i])) });
          hash[list[i]] = true;
        }
      }
      dt.userlist = userlist;

      function userlist_insert(userlist, start_idx, item) {
        var i;
        for(i = start_idx; i < userlist.length; i++) {
          if(item.name < userlist[i].name) {
            break;
          }
        }

        userlist.splice(i, 0, item);
      }
    }

    $scope.$on(hmtgHelper.WM_QUIT_SESSION, function() {
      dt.resetAllowControlPrompt();
      dt.stop_capture();
      dt.is_send = false;
      dt.is_control_allowed = false;
      dt.is_sender = false;
      dt.sync_tab_controller = -1;
      dt.is_sync_tab_controller = false;
      cancel_wait_response_timer();
      cancel_wait_permission_timer();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_START_SESSION, function() {
      dt.channel = -1;
      dt.m_ConnectStatus = 0;
      dt.descr = '';
      dt.descr_ssrc = -1;
      dt.stop_control();
      dt.bmp = null;
      dt.draw();
      dt.clear_decoder();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_RESET_SESSION, function() {
      dt.auto_allow_control_ssrc = -1;
      dt.channel = -1;
      dt.m_ConnectStatus = 0;
      dt.descr = '';
      dt.descr_ssrc = -1;
      dt.stop_control();
      dt.bmp = null;
      dt.draw();
      dt.clear_decoder();
      cancel_wait_response_timer();
      cancel_wait_permission_timer();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_PLAYBACK_RESTART, function() {
      dt.channel = -1;
      dt.m_ConnectStatus = 0;
      dt.descr = '';
      dt.descr_ssrc = -1;
      dt.stop_control();
      dt.bmp = null;
      dt.draw();
      cancel_wait_response_timer();
      cancel_wait_permission_timer();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_ADD_USER, function(event, ssrc) {
      // in case the add_user (via control channel) is arrived later than the first plugin packet
      // we need to update the user's name
      if(dt.descr_ssrc != -1 && ssrc == dt.descr_ssrc) {
        var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
        dt.descr = '[' + hmtg.util.decodeUtf8(a[dt.descr_ssrc] ? a[dt.descr_ssrc]._szRealName() : ('ssrc' + dt.descr_ssrc)) + ']';
        if(!hmtgHelper.inside_angular) $scope.$digest();
      }

      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
      if(dt.channel == -1) return;
      if(!dt.is_sync_tab_controller) return;
      if(!dt.control_assigned) return;
      if(dt.m_ConnectStatus != 2) return;
      if(dt.monitor_only) return; // do not send meta info if the remote control is for monitor only
      if(dt.controller_ssrc >= 0 && dt.controllee_ssrc >= 0) {
        // send meta info to the new user
        hmtg.jnkernel.jn_command_PlugInControlChannelSend(dt.channel, 0, 1, ssrc, // do not record
          String.fromCharCode(hmtg.config.DT_RDC_SIGNAL, 9, 0, 0, hmtg.config.RDC_CMD_ASSIGN_CONTROL,
          dt.controllee_ssrc & 0xff,
          (dt.controllee_ssrc >> 8) & 0xff,
          (dt.controllee_ssrc >> 16) & 0xff,
          (dt.controllee_ssrc >> 24) & 0xff,
          dt.controller_ssrc & 0xff,
          (dt.controller_ssrc >> 8) & 0xff,
          (dt.controller_ssrc >> 16) & 0xff,
          (dt.controller_ssrc >> 24) & 0xff));
      }
    });

    $scope.show_color = function() {
      if(dt.control_assigned && dt.is_sender && dt.is_send) return true;
      var result = (hmtg.jnkernel._jn_bConnected()
        && dt.control_assigned
        && dt.controllee_ssrc != -1
        && dt.controller_ssrc != dt.controllee_ssrc
        && dt.controller_ssrc != -1
        && dt.controller_ssrc == hmtg.jnkernel._jn_ssrc_index()
        );
      return result;
    }

    $scope.$watch('dt.controller_ssrc', user_selection_changed);
    $scope.$watch('dt.controllee_ssrc', user_selection_changed);
    function user_selection_changed(newValue, oldValue) {
      if(newValue == oldValue) return;  // such as integer 0 vs string "0"
      if(dt.is_sync_tab_controller && rdc.is_control) {
        dt.toggle_control();
      }
    }

    $scope.init(hmtgHelper.GUID_REMOTE_CONTROL);
    if(hmtg.jnkernel._jn_bConnected()) {
      hmtgHelper.inside_angular++;
      update_rdc_userlist();
      dt.sync_tab_controller = hmtg.jnkernel._tab_ssrc();
      dt.is_sync_tab_controller = dt.sync_tab_controller != -1 && dt.sync_tab_controller == hmtg.jnkernel._jn_ssrc_index();
      hmtgHelper.inside_angular--;
    }
  }
])
;