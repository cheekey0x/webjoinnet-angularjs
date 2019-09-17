/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('hmtgs')

.service('hmtgHelper', ['$rootScope', '$modal', '$ocLazyLoad',
  function($rootScope, $modal, $ocLazyLoad) {
    var _hmtgHelper = this;
    //this.WM_LANG_CHANGED = 'app_lang_changed';
    this.WM_HEIGHT_CHANGED = 'app_height_changed';
    this.WM_WIDTH_CHANGED = 'app_width_changed';
    this.WM_SHOW_CHAT_AREA = 'show_chat_area';
    this.WM_SHOW_CONTROL_PANEL = 'show_user_list';
    this.WM_BROWSER_URL = 'browser_url';
    this.WM_UPDATE_DURATION = 'update_duration';
    this.WM_PLAYBACK_INIT_STAT = 'playback_init_stat';
    this.WM_PLAYBACK_TICK_UPDATE = 'playback_tick_update';
    this.WM_PLAYBACK_END_OF_FILE = 'playback_end_of_file';
    this.WM_PLAYBACK_UPDATE_TICK_STR = 'playback_update_tick_str';
    this.WM_PLAYBACK_UPDATE_POS = 'playback_update_pos';
    this.WM_UPDATE_ALERT = 'update_alert';
    this.WM_UPDATE_MSGR = 'update_msgr';
    this.WM_UPDATE_JOINNET = 'update_joinnet';
    this.WM_UPDATE_USERLIST = 'update_userlist';
    this.WM_UPDATE_VIDEO_WINDOW = 'update_video_window';
    this.WM_UPDATE_BOARD = 'update_board';
    this.WM_UPDATE_CHAT = 'update_chat';
    this.WM_QUIT_SESSION = 'quit_session';
    this.WM_RESET_SESSION = 'reset_session';
    this.WM_START_SESSION = 'start_session';
    this.WM_PLAYBACK_RESTART = 'playback_restart';
    this.WM_NET_INIT_FINISH = 'net_init_finish';
    this.WM_WORKMODE_CHANGED = 'workmode_changed';
    this.WM_UPDATE_PLAYBACK = 'update_playback';
    this.WM_FULLSCREEN_CHANGED = 'fullscreen_changed';
    this.WM_MAX_DISPLAY_ITEM_CHANGED = 'max_display_item_changed';
    this.WM_MEETING_CONTROL = 'meeting_control';
    this.WM_IDLE_MODE = 'idle_mode';
    this.WM_UPLOAD_SLIDE = 'upload_slide';
    this.WM_UPLOAD_IMAGE_LOADED = 'upload_image_loaded';
    this.WM_SNAPSHOT_DELAY_CHANGED = 'snapshot_delay_changed';
    this.WM_MY_TALKER_STATUS_CHANGED = 'my_talker_status_changed';
    this.WM_UPDATE_RDC_USERLIST = 'update_rdc_userlist';
    this.WM_TALKER_STATUS_CHANGED = 'talker_status_changed';
    this.WM_NEW_SPEAKER = 'new_speaker';
    this.WM_DELETE_SLIDE = 'delete_slide';
    this.WM_POLL_REQUEST = 'poll_request';
    this.WM_POLL_RESULT = 'poll_result';
    this.WM_TAB_MODE = 'change_tab_mode';
    this.WM_SYNC_FULLSCREEN = 'sync_fullscreen';
    this.WM_PROMPT_PASSWORD = 'prompt_password';
    this.WM_OPEN_JNJ = 'open_jnj';
    this.WM_MY_TOKEN_STATUS_CHANGED = 'my_token_status_changed';
    this.WM_TOKEN_STATUS_CHANGED = 'token_status_changed';
    this.WM_CONTROLLER_STATUS_CHANGED = 'controller_status_changed';
    this.WM_AUDIO_RECORDING_CHANGED = 'audio_recording_changed';
    this.WM_UPDATE_AUDIO_DECODING = 'update_audio_decoding';
    this.WM_CHANGE_CAP = 'change_cap';
    this.WM_IMPORT_TRANSCODING = 'import_transcoding';
    this.WM_RESET_TRANSCODING = 'reset_transcoding';
    this.WM_NEW_PLUGIN = 'new_plugin';
    this.WM_CLOSE_PLUGIN = 'close_plugin';
    this.WM_COPY_USER_LIST = 'copy_user_list';
    this.WM_ADD_USER = 'add_user';
    this.WM_REFRESH_USER = 'refresh_user';
    this.WM_UPDATE_APPDATA_BITRATE = 'update_appdata_bitrate';
    this.WM_UPDATE_IMAGE_MARK = 'update_image_mark';
    this.WM_UPDATE_MYPICTURE = 'update_mypicture';
    this.WM_UPDATE_IMAGE_BAR_ITEM_SIZE = 'update_image_bar_item_size';
    this.WM_SHOW_STAT_LOG = 'show_stat_log';
    this.WM_UPDATE_MONITOR_MODE = 'update_monitor_mode';
    this.WM_REMOTE_MONITOR = 'remote_monitor';
    this.WM_MAX_WIN_CHANGED = 'max_win_changed';
    this.WM_SHOW_IM = 'show_im';
    this.WM_SHOW_CM = 'show_cm';
    this.WM_SHARE_JNR = 'share_jnr';
    this.WM_VIEW_RECORD = 'view_record';
    this.WM_JNR_PROGRESS = 'jnr_progress';
    this.WM_UPDATE_DISPLAY_CM = 'update_display_cm';
    this.WM_UPDATE_ACTIVE_SPEAKER = 'update_active_speaker';
    this.WM_UPDATE_LAYOUT_MODE = 'update_layout_mode';
    this.WM_CONCISE_TAB_CHANGED = 'concise_tab_changed';

    this.GUID_DESKTOP_SHARING = 'E5AF1A56-E29C-4BA6-839A-24C2F30EED02';
    this.GUID_REMOTE_CONTROL = '4FC0606A-DA4A-423F-A830-AC5D9853C201';

    this.snapshot_count = 1;
    //this.cache_param = hmtg.customization.is_lazy_cache_on ? '' : ('?p=' + hmtg.util.app_id);
    $rootScope.cache_param = this.cache_param = '?p=' + encodeURIComponent(hmtg.config.APP_VERSION);

    var WORKER_TEST_PATH = 'worker/test_worker.js' + this.cache_param;
    var WORKER_GZIP_PATH = 'worker/gzip_helper.js' + this.cache_param;


    this.inside_angular = 0;
    this.exempted_error = 0;

    this.view_port_height = 100;
    this.view_port_width = 100;

    var ua = navigator.userAgent.toLowerCase();
    this.isAndroid = /android/.test(ua);
    this.isiOS = /(iphone|ipod|ipad)/.test(ua);
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    this.isChrome = "chrome" in window;

    //https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser/9851769
    this.isFirefox = typeof InstallTrigger !== 'undefined';

    this.apply_timer = null;
    this.fast_apply = function() {
      if(this.apply_timer) return;
      this.apply_timer = setTimeout(function() {
        _hmtgHelper.apply_timer = null;
        $rootScope.$apply();
      }, 0);
    }

    this.cipher_info = function(t, name) {
      switch(name) {
        case 'des':
          return 'DES 56' + t('ID_BITS');
        case '3des':
          return 'TRIPLE-DES 168' + t('ID_BITS');
        case 'aes128':
          return 'AES 128' + t('ID_BITS');
        case 'aes192':
          return 'AES 192' + t('ID_BITS');
        case 'aes256':
          return 'AES 256' + t('ID_BITS');
        default:
          return '';
      }
    }

    this.get_opus_bitrate = function() {
      var bitrate = hmtg.jnkernel._jn_opus_preferred_bitrate();
      var bitrate2 = hmtg.jnkernel._jnj_opus_preferred_bitrate();
      if(bitrate2 > 0) {
        if(bitrate <= 0) bitrate = bitrate2;
        else bitrate = Math.min(bitrate, bitrate2);
      }
      if(bitrate <= 0) bitrate = 48000;
      if(bitrate < 24000) bitrate = 24000;
      return bitrate;
    }

    this.checkWorkerInterface = function() {
      var worker = new Worker(WORKER_TEST_PATH);
      worker.addEventListener('error', window.onerrorWorker, false);

      try {
        var uInt8Array = new Uint8Array(1);
        worker.postMessage({ command: '', data: uInt8Array }, [uInt8Array.buffer]);
        if(uInt8Array.buffer.byteLength == 0)
          return true;
        return false;
      } catch(e) {
        return false;
      }
    }
    this.good_worker = this.checkWorkerInterface();

    this.triggerWorkerError = function() {
      var worker = new Worker(WORKER_TEST_PATH);
      worker.addEventListener('error', window.onerrorWorker, false);

      worker.postMessage({ command: 'trigger_error' });
    }
    if(hmtg.util.test_error & 4) {
      this.triggerWorkerError();  // trigger an Worker error
    }

    this.async_finish = function(thread, onfinish) {
      var async_timerID = setTimeout(function() {
        onfinish();
      }, 0);
      thread.stop = function() {
        clearTimeout(async_timerID);
        thread.stop = function() { }
      }
    }

    /**
     * @constructor
     */
    this.compress = function(cmd, data, compression_type, onsuccess, onerror) {
      var zip_worker;
      this.stop = function() { }
      try {
        zip_worker = new Worker(WORKER_GZIP_PATH);
        zip_worker.addEventListener('error', window.onerrorWorker, false);
        zip_worker.postMessage({ command: 'init', good_worker: _hmtgHelper.good_worker });
      } catch(e) {
        // asynchronously call is necessary here
        _hmtgHelper.async_finish(this, onerror);
        return;
      }
      zip_worker.onmessage = function(e) {
        switch(e.data.command) {
          case 'data_out':
            zip_worker.postMessage({ command: 'exit' });
            onsuccess(e.data.data);
            break;
          case 'error':
          default:
            zip_worker.postMessage({ command: 'exit' });
            onerror();
            break;
        }
      }
      // do not use ownership transfer because we still need to keep the original buffer
      zip_worker.postMessage({ command: cmd, data: data, compression_type: compression_type });

      this.stop = function() {
        zip_worker.onmessage = function() { }
        zip_worker.postMessage({ command: 'exit' });
        this.stop = function() { }
      }
    }

    /**
     * @constructor
     */
    this.decompress = function(cmd, data, onsuccess, onerror) {
      var unzip_worker;
      this.stop = function() { }
      try {
        unzip_worker = new Worker(WORKER_GZIP_PATH);
        unzip_worker.addEventListener('error', window.onerrorWorker, false);
        unzip_worker.postMessage({ command: 'init', good_worker: _hmtgHelper.good_worker });
      } catch(e) {
        // asynchronously call is necessary here
        _hmtgHelper.async_finish(this, onerror);
        return;
      }
      unzip_worker.onmessage = function(e) {
        switch(e.data.command) {
          case 'data_out':
            unzip_worker.postMessage({ command: 'exit' });
            onsuccess(e.data.data);
            break;
          case 'error':
          default:
            unzip_worker.postMessage({ command: 'exit' });
            onerror();
            break;
        }
      }
      // do not use ownership transfer because we still need to keep the original buffer
      unzip_worker.postMessage({ command: cmd, data: data });

      this.stop = function() {
        unzip_worker.onmessage = function() { }
        unzip_worker.postMessage({ command: 'exit' });
        this.stop = function() { }
      }
    }

    /*
    this.img2BMP24bit = function (img, onsuccess, onerror) {
    //var tick = hmtg.util.GetTickCount();
    var canvas0 = document.createElement("canvas");
    var ctx0 = canvas0.getContext('2d');
    canvas0.width = img.width;
    canvas0.height = img.height;
    var pixels;

    try {
    ctx0.drawImage(img, 0, 0);
    pixels = ctx0.getImageData(0, 0, img.width, img.height);
    } catch(e) {
    onerror();
    }
    var rowsize = (img.width * 3 + 3) >> 2 << 2;
    var data = new Uint8Array(40 + rowsize * img.height);
    data[0] = 40; // header size
    data[4] = img.width & 0xff;
    data[5] = (img.width >> 8) & 0xff;
    data[6] = (img.width >> 16) & 0xff;
    data[7] = (img.width >> 24) & 0xff;
    data[8] = img.height & 0xff;
    data[9] = (img.height >> 8) & 0xff;
    data[10] = (img.height >> 16) & 0xff;
    data[11] = (img.height >> 24) & 0xff;
    data[12] = 1; // bitplane
    data[14] = 24;  // color depth
    var size = rowsize * img.height;
    data[20] = size & 0xff;
    data[21] = (size >> 8) & 0xff;
    data[22] = (size >> 16) & 0xff;
    data[23] = (size >> 24) & 0xff;
    data[24] = 19;
    data[25] = 11;
    data[28] = 19;
    data[29] = 11;
    var i, j;
    for(i = 0; i < img.height; i++) {
    var src = (img.height - 1 - i) * img.width * 4;
    var dst = 40 + i * rowsize;
    for(j = 0; j < img.width; j++, src += 4, dst += 3) {
    // BMP: B G R A
    // canvas: R G B A
    data[dst] = pixels.data[src + 2];
    data[dst + 1] = pixels.data[src + 1];
    data[dst + 2] = pixels.data[src];
    }
    }

    var compression_type = 2;
    _hmtgHelper.compress('zip', data, compression_type, function (output) {
    //tick = hmtg.util.GetTickCount() - tick;
    //hmtg.util.log(-1, '******debug, tick1=' + tick);
    onsuccess(new Blob([output]), data.length);
    }, function () {
    onerror();
    });
    }
    */

    /*
    this.img2BMP32bit = function(img, shift, onsuccess, onerror) {
      //var tick = hmtg.util.GetTickCount();
      var canvas0 = document.createElement("canvas");
      var ctx0 = canvas0.getContext('2d');
      canvas0.width = img.width >> shift;
      canvas0.height = img.height >> shift;
      var pixels;

      try {
        ctx0.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas0.width, canvas0.height);
        pixels = ctx0.getImageData(0, 0, canvas0.width, canvas0.height);
      } catch(e) {
        onerror();
      }
      var rowsize = canvas0.width * 4;
      var data = new Uint8Array(40 + rowsize * canvas0.height);
      data[0] = 40; // header size
      data[4] = canvas0.width & 0xff;
      data[5] = (canvas0.width >> 8) & 0xff;
      data[6] = (canvas0.width >> 16) & 0xff;
      data[7] = (canvas0.width >> 24) & 0xff;
      data[8] = canvas0.height & 0xff;
      data[9] = (canvas0.height >> 8) & 0xff;
      data[10] = (canvas0.height >> 16) & 0xff;
      data[11] = (canvas0.height >> 24) & 0xff;
      data[12] = 1; // bitplane
      data[14] = 32;  // color depth
      var size = rowsize * canvas0.height;
      data[20] = size & 0xff;
      data[21] = (size >> 8) & 0xff;
      data[22] = (size >> 16) & 0xff;
      data[23] = (size >> 24) & 0xff;
      data[24] = 19;
      data[25] = 11;
      data[28] = 19;
      data[29] = 11;
      var i, j;
      for(i = 0; i < canvas0.height; i++) {
        var src = (canvas0.height - 1 - i) * canvas0.width * 4;
        var dst = 40 + i * rowsize;
        for(j = 0; j < canvas0.width; j++, src += 4, dst += 4) {
          // BMP: B G R A
          // canvas: R G B A
          data[dst] = pixels.data[src + 2];
          data[dst + 1] = pixels.data[src + 1];
          data[dst + 2] = pixels.data[src];
          data[dst + 3] = pixels.data[src + 3];
        }
      }

      var compression_type = 2;
      _hmtgHelper.compress('zip', data, compression_type, function(output) {
        //tick = hmtg.util.GetTickCount() - tick;
        //hmtg.util.log(-1, '******debug, tick1=' + tick);
        onsuccess(output, data.length);
      }, function() {
        onerror();
      });
    }
    */

    /*
    this.img2BMP32bit_V4 = function (img, onsuccess, onerror) {
    //var tick = hmtg.util.GetTickCount();
    var canvas0 = document.createElement("canvas");
    var ctx0 = canvas0.getContext('2d');
    canvas0.width = img.width;
    canvas0.height = img.height;
    var pixels;

    try {
    ctx0.drawImage(img, 0, 0);
    pixels = ctx0.getImageData(0, 0, img.width, img.height);
    } catch(e) {
    onerror();
    }
    // http://en.wikipedia.org/wiki/BMP_file_format
    var data = new Uint8Array(108 + pixels.data.length);
    data[0] = 108; // header size
    data[4] = img.width & 0xff;
    data[5] = (img.width >> 8) & 0xff;
    data[6] = (img.width >> 16) & 0xff;
    data[7] = (img.width >> 24) & 0xff;
    data[8] = img.height & 0xff;
    data[9] = (img.height >> 8) & 0xff;
    data[10] = (img.height >> 16) & 0xff;
    data[11] = (img.height >> 24) & 0xff;
    data[12] = 1; // bitplane
    data[14] = 32;  // color depth
    data[16] = 3; // BI_BITFIELDS
    var size = img.width * img.height * 4;
    data[20] = size & 0xff;
    data[21] = (size >> 8) & 0xff;
    data[22] = (size >> 16) & 0xff;
    data[23] = (size >> 24) & 0xff;
    data[24] = 19;
    data[25] = 11;
    data[28] = 19;
    data[29] = 11;
    data[0x36 - 0xe] = 0xff;  // r
    data[0x3a - 0xe + 1] = 0xff;  // g
    data[0x3e - 0xe + 2] = 0xff;  // b
    data[0x42 - 0xe + 3] = 0xff;  // a
    data[0x46 - 0xe] = 0x20;
    data[0x47 - 0xe] = 0x6e;
    data[0x48 - 0xe] = 0x69;
    data[0x49 - 0xe] = 0x57;
    var i, j;
    for(i = 0; i < img.height; i++) {
    var src = (img.height - 1 - i) * img.width * 4;
    data.set(pixels.data.subarray(src, src + img.width * 4), 108 + i * img.width * 4);
    }

    var compression_type = 2;
    _hmtgHelper.compress('zip', data, compression_type, function (output) {
    //tick = hmtg.util.GetTickCount() - tick;
    //hmtg.util.log(-1, '******debug, size=' + output.length + ',tick1=' + tick);
    //hmtg.util.log(-1, '******debug, size=' + output.length);
    onsuccess(new Blob([output]), data.length);
    }, function () {
    onerror();
    });
    }
    */

    this.exitFullScreen = function() {
      var fullscreenElement = document.fullscreenElement
        || document.mozFullScreenElement
        || document.webkitFullscreenElement
        || document.msFullscreenElement
        ;
      if(fullscreenElement) {
        if(document.exitFullscreen) {
          document.exitFullscreen();
        } else if(document.msExitFullscreen) {
          document.msExitFullscreen();
        } else if(document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if(document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    }

    this.number2GMK = function(size) {
      if(size >= 999 * 1024 * 1024 * 100) return '' + ((size / (1024.0 * 1024.0 * 1024.0) + 0.5) >>> 0) + 'G';
      else if(size >= 999 * 1024 * 1024 * 10) return '' + ((size / (1024.0 * 1024.0 * 1024.0) * 10 + 0.5) >>> 0) / 10 + 'G';
      else if(size >= 999 * 1024 * 1024) return '' + ((size / (1024.0 * 1024.0 * 1024.0) * 100 + 0.5) >>> 0) / 100 + 'G';
      else if(size >= 999 * 1024 * 100) return '' + ((size / (1024.0 * 1024.0) + 0.5) >>> 0) + 'M';
      else if(size >= 999 * 1024 * 10) return '' + ((size / (1024.0 * 1024.0) * 10 + 0.5) >>> 0) / 10 + 'M';
      else if(size >= 999 * 1024) return '' + ((size / (1024.0 * 1024.0) * 100 + 0.5) >>> 0) / 100 + 'M';
      else if(size >= 999 * 100) return '' + ((size / (1024.0) + 0.5) >>> 0) + 'K';
      else if(size >= 999 * 10) return '' + ((size / (1024.0) * 10 + 0.5) >>> 0) / 10 + 'K';
      else if(size > 999) return '' + ((size / (1024.0) * 100 + 0.5) >>> 0) / 100 + 'K';
      else return '' + (size >>> 0);
    }

    this.number2gmk = function(size) {
      if(size >= 1000 * 1000 * 1000 * 100) return '' + ((size / (1000.0 * 1000.0 * 1000.0) + 0.5) >>> 0) + 'g';
      else if(size >= 1000 * 1000 * 1000 * 10) return '' + ((size / (1000.0 * 1000.0 * 1000.0) * 10 + 0.5) >>> 0) / 10 + 'g';
      else if(size >= 1000 * 1000 * 1000) return '' + ((size / (1000.0 * 1000.0 * 1000.0) * 100 + 0.5) >>> 0) / 100 + 'g';
      else if(size >= 1000 * 1000 * 100) return '' + ((size / (1000.0 * 1000.0) + 0.5) >>> 0) + 'm';
      else if(size >= 1000 * 1000 * 10) return '' + ((size / (1000.0 * 1000.0) * 10 + 0.5) >>> 0) / 10 + 'm';
      else if(size >= 1000 * 1000) return '' + ((size / (1000.0 * 1000.0) * 100 + 0.5) >>> 0) / 100 + 'm';
      else if(size >= 1000 * 100) return '' + ((size / (1000.0) + 0.5) >>> 0) + 'k';
      else if(size >= 1000 * 10) return '' + ((size / (1000.0) * 10 + 0.5) >>> 0) / 10 + 'k';
      else if(size >= 1000) return '' + ((size / (1000.0) * 100 + 0.5) >>> 0) / 100 + 'k';
      else return '' + (size >>> 0);
    }

    this.second2timestr = function(value) {
      var sec = value >>> 0;
      var hour = (sec / 3600) >>> 0;
      sec -= hour * 3600;
      var minute = (sec / 60) >>> 0;
      sec -= minute * 60;
      var s = '';
      if(hour) {
        s = '' + hour + ':';
      }
      s += ('0000' + minute).slice(-2);
      s += ':';
      s += ('0000' + sec).slice(-2);

      return s;
    }

    this.number2fmt = function(size) {
      var x = '' + size;
      var rgx = /(\d+)(\d{3})/;
      while(rgx.test(x)) {
        x = x.replace(rgx, '$1' + ',' + '$2');
      }
      return x;
    }

    this.float2fmt = function(v) {
      if(v >= 10) {
        return (v + 0.5) >>> 0;
      }
      if(v >= 1) return ((v * 10 + 0.5) >>> 0) / 10;
      if(v >= 0.1) return ((v * 100 + 0.5) >>> 0) / 100;
      return ((v * 1000 + 0.5) >>> 0) / 1000;
    }

    this.escapeHtml = function(text) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    this.save_file = function(blob, filename) {
      // http://mozilla.github.io/pdf.js/web/viewer.js
      if(window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, filename);
        return;
      }
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      if(a.click) {
        // Use a.click() if available. Otherwise, Chrome might show
        // "Unsafe JavaScript attempt to initiate a navigation change
        //  for frame with URL" and not open the PDF at all.
        // Supported by (not mentioned = untested):
        // - Firefox 6 - 19 (4- does not support a.click, 5 ignores a.click)
        // - Chrome 19 - 26 (18- does not support a.click)
        // - Opera 9 - 12.15
        // - Internet Explorer 6 - 10
        // - Safari 6 (5.1- does not support a.click)

        a.href = url;
        a.target = 'save';
        // Use a.download if available. This increases the likelihood that
        // the file is downloaded instead of opened by another PDF plugin.
        if('download' in a) {
          a.download = filename;
        }
        // <a> must be in the document for IE and recent Firefox versions.
        // (otherwise .click() is ignored)
        (document.body || document.documentElement).appendChild(a);
        a.click();
        a.parentNode.removeChild(a);
        setTimeout(function() {
          window.URL.revokeObjectURL(url);
        }, 0);  // if not using timeout, firefox's saving will fails (dialog box not show up)
      }
    }

    this.data2url = function(data) {
      return window.URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }))
    }

    this.url2blob = function(dataURI) {
      // convert base64/URLEncoded data component to raw binary data held in a string
      var parts = dataURI.split(',');
      var byteString;
      if(parts[0].indexOf('base64') >= 0)
        byteString = hmtg.util.decode64(parts[1]);
      else
        byteString = unescape(parts[1]);

      // separate out the mime component
      var mimeString = parts[0].split(':')[1].split(';')[0]

      // write the bytes of the string to a typed array
      var ia = new Uint8Array(byteString.length);
      for(var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      return new Blob([ia], { type: mimeString });
    }

    this.process_snapshot = function(canvas) {
      $rootScope.canvas0 = canvas;
      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_snapshot' + (hmtg.lazy_min ? '.min' : '') + '.js' + _hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/Snapshot.htm' + _hmtgHelper.cache_param,
          scope: $rootScope,
          controller: 'SnapshotModalCtrl',
          size: 'lg',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
          $rootScope.snapshot_busy = false;
        }, function() {
          $rootScope.snapshot_busy = false;
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_snapshot fails');
      });
    }

    this.drawEdge = function(ctx3, color, x1, y1, x2, y2) {
      ctx3.lineWidth = 5;
      ctx3.strokeStyle = color;
      ctx3.beginPath();
      ctx3.save();
      ctx3.moveTo(x1, y1);
      ctx3.lineTo(x2, y2);
      ctx3.stroke();
      ctx3.restore();
    }

    this.file_reset = function(id, accept) {
      var file_input = document.getElementById(id);
      var newInput = document.createElement("input");

      newInput.type = "file";
      if(accept) newInput.accept = accept;
      newInput.id = file_input.id;
      newInput.name = file_input.name;
      newInput.className = file_input.className;
      newInput.style.cssText = file_input.style.cssText;
      newInput.multiple = file_input.multiple;

      file_input.parentNode.replaceChild(newInput, file_input);
      return newInput;
    }

    this.MessageBox = function(text, timeout, ok) {
      // not using "." in the name: name passing, child scope will keep its own value
      $rootScope.msgbox_text = text;
      $rootScope.hide_cancel = true;
      $rootScope.timeout = timeout;
      var modalInstance = $modal.open({
        templateUrl: 'appMessageBox.html',
        scope: $rootScope,
        controller: 'AppMessageBoxModalCtrl',
        size: '',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(ok);
    }

    this.OKCancelMessageBox = function(text, timeout, ok, cancel) {
      // not using "." in the name: name passing, child scope will keep its own value
      $rootScope.msgbox_text = text;
      $rootScope.hide_cancel = false;
      $rootScope.timeout = timeout;
      var modalInstance = $modal.open({
        templateUrl: 'appMessageBox.html',
        scope: $rootScope,
        controller: 'AppMessageBoxModalCtrl',
        size: '',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(ok, cancel);
    }

    this.drawImageThread = function(ctx, img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, onfinish, max_canvas_size) {
      var _thread = this;
      var i = 0;
      var j = 0;
      var k = 0;
      var cx = 1;
      var cy = 1;
      var draw_intervalID = setInterval(draw, 0);
      var THRESHOLD = 256;

      function normal_stop() {
        clearInterval(draw_intervalID);
        _thread.stop = function() {
        }
      }

      var max_x = Math.max(sWidth, dWidth);
      var min_x = Math.min(sWidth, dWidth);
      var max_y = Math.max(sHeight, dHeight);
      var min_y = Math.min(sHeight, dHeight);

      if(max_x > THRESHOLD && min_x > 1) {
        cx = Math.min(min_x, max_x / THRESHOLD) >> 0;
        cx = Math.max(1, cx);
      }
      if(max_y > THRESHOLD && min_y > 1) {
        cy = Math.min(min_y, max_y / THRESHOLD) >> 0;
        cy = Math.max(1, cy);
      }
      var max = cx * cy;

      _thread.stop = normal_stop;
      function draw() {
        //var start_tick = hmtg.util.GetTickCount();
        i = (k / cy) >> 0;
        j = k - i * cy;
        for(; k < max; /*j++, k++*/) {
          if(j >= cy) {
            j = 0;
            i++;
          }
          try {
            // to avoid minor shifting at boundary, do not round the parameters
            //var dst_x = Math.floor(dx + i * dWidth / cx);
            //var dst_y = Math.floor(dy + j * dHeight / cy);
            var dst_x = (dx + i * dWidth / cx);
            var dst_y = (dy + j * dHeight / cy);
            if(typeof max_canvas_size === 'undefined' || (dst_x < max_canvas_size && dst_y < max_canvas_size)) {
              ctx.drawImage(img,
                //Math.floor(sx + i * sWidth / cx), Math.floor(sy + j * sHeight / cy),
                //Math.ceil(sWidth / cx), Math.ceil(sHeight / cy),
                //dst_x, dst_y,
                //Math.ceil(dWidth / cx), Math.ceil(dHeight / cy)
                (sx + i * sWidth / cx), (sy + j * sHeight / cy),
                (sWidth / cx), (sHeight / cy),
                dst_x, dst_y,
                (dWidth / cx), (dHeight / cy)
                );
            }
          } catch(e) {
            break;
          }
          k++;
          return;
        }
        clearInterval(draw_intervalID);
        _thread.stop = function() {
        }

        if(onfinish) onfinish();
      }
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions

    // http://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
    var _p_scheme = 'https?:\\/\\/';
    var _p_ipv4 = '(?:\\d{1,3}\\.){3}\\d{1,3}';
    var _p_domain_name1 = '(?:(?:[a-z\\d](?:[a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}';
    var _p_domain_name2 = '(?:(?:[a-z\\d](?:[a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}';
    var _p_domain_name3 = 'www\\.(?:(?:[a-z\\d](?:[a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}';
    var _p_domain_name4 = '(?:[a-z\\d-]+\\.)+(?:com|org|edu|net|cn|tw|hk|jp|kr|sg|us)';
    var _p_domain_name5 = 'mail\\.(?:(?:[a-z\\d](?:[a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}';
    var _p_name_type1 = '' + _p_scheme + '(?:' + _p_domain_name2 + '|' + _p_ipv4 + ')';
    var _p_name_type2 = '(?:' + _p_domain_name3 + '|' + _p_domain_name4 + ')';
    var _p_name = '(?:' + _p_name_type1 + '|' + _p_name_type2 + ')';
    var _p_port = '(?:\\:\\d+)?';
    var _p_path = '(?:\\/[-a-z\\d%_\\.~+]*)*';
    var _p_query = '(?:\\?[;:&a-z\\d%_\\.\\/,~+=-@]*)?';
    var _p_fragment = '(?:\\#[-a-z\\d_]*)?';
    var _p_url = '' + _p_name + _p_port + _p_path + _p_query + _p_fragment + '';

    /*
    expected good ones:
    http://localhost/web www.abc https://1.2.3.4 http://abc.com/web http://abc test.com
    expected bad ones:
    test.abcdefghi test.abcdefghi/web 1.2.3.4 localhost/web a http://ab 1 http://123 com 

    performance test:
    http://abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz
    http://abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz.abc
    abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz
    abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz.com
    */

    // http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
    var _p_email = '(?:[^<>()\\[\\]\\\\.,;:\\s@"]+(?:\\.[^<>()\\[\\]\\\\.,;:\\s@"]+)*)@(?:' + _p_domain_name5 + '|' + _p_domain_name4 + ')';
    /*
    expected good ones:
    a@a.com a@mail.abc
    expected bad ones:
    a@a.abc a@www.abc a@1.2.3.4
    */

    // http://stackoverflow.com/questions/16699007/regular-expression-to-match-standard-10-digit-phone-number
    var _p_tel = '(\\+\\d{1,2}\\s)?(?:(?:[()-]|\\)\\s)?\\d){7,16}';
    /*
    expected good ones:
    (123)456-7890 001-22-333-1234567 001-86-151-1234-5678 1234567 (123) 456-7890
    expected bad ones:
    123456 
    */

    var _p_url_pattern = new RegExp('(?:^|[\\s\\\'"])(' + _p_url + ')(?:[\\s\\\'"]|$)', 'i');
    var _p_email_pattern = new RegExp('(?:^|[\\s\\\'"])(' + _p_email + ')(?:[\\s\\\'"]|$)', 'i');
    var _p_tel_pattern = new RegExp('(?:^|[\\s\\\'"])(' + _p_tel + ')(?:[\\s\\\'"]|$)', 'i');

    function parse_str(pattern, str) {
      var m;
      m = pattern.exec(str);
      if(!m || !m[1]) {
        return [str];
      }
      var idx;
      idx = str.indexOf(m[1]);
      if(idx == -1) {
        return [str];
      }
      return [str.slice(0, idx), m[1], str.slice(idx + m[1].length)];
    }

    this.parseURL = function(str) {
      return parse_str(_p_url_pattern, str);
    }
    this.parseEmail = function(str) {
      return parse_str(_p_email_pattern, str);
    }
    this.parseTel = function(str) {
      return parse_str(_p_tel_pattern, str);
    }
    var _p_absolute_pattern = new RegExp('^(?:[a-z]+:)?//', 'i');
    this.is_absolute_url = function(url) {
      return _p_absolute_pattern.test(url);
    }

    this.convertText = function(text, str) {
      while(1) {
        var m = _hmtgHelper.parseURL(str);
        if(m[1]) {
          if(m[0]) {
            convert_email(text, m[0]);
          }
          var is_a = _hmtgHelper.is_absolute_url(m[1]);
          text.append(angular.element('<a target="url" href="' + (is_a ? '' : '//') + m[1] + '">' + m[1] + '</a>'));
          str = m[2];
        } else {
          convert_email(text, m[0]);
          break;
        }
      }
      text.append(angular.element('<text></text>').text('\n'))

      function convert_email(text, str) {
        while(1) {
          var m = _hmtgHelper.parseEmail(str);
          if(m[1]) {
            if(m[0]) {
              convert_tel(text, m[0]);
            }
            text.append(angular.element('<a target="url" href="mailto:' + m[1] + '">' + m[1] + '</a>'));
            str = m[2];
          } else {
            convert_tel(text, m[0]);
            break;
          }
        }
      }

      function convert_tel(text, str) {
        while(1) {
          var m = _hmtgHelper.parseTel(str);
          if(m[1]) {
            if(m[0]) {
              text.append(angular.element('<text></text>').text(m[0]));
            }
            text.append(angular.element('<a target="url" href="tel:' + m[1] + '">' + m[1] + '</a>'));
            str = m[2];
          } else {
            text.append(angular.element('<text></text>').text(m[0]));
            break;
          }
        }
      }
    }

    this.replaceUnicode = function(str) {
      // convert escaped unicode to unicode. e.g.,
      // [u1F604] => smiling face with open mouth and smiling eyes
      return str.replace(/\[[uU]([0-9a-fA-F]{3,5})\]/ig, func);
      function func(t, s) {
        var v = parseInt(s, 16);
        if(
          //v >= 0x80 &&
          v <= 0x10ffff) {
          if((v & 0xf800) != 0xd800) {
            if(v <= 0xffff) {
              return String.fromCharCode(v);
            }
            v -= 0x10000;
            return String.fromCharCode(((v >> 10) | 0xD800), ((v & 0x3ff) | 0xDC00));
          }
        }
        return '';
      }
    }

    this.renameDialog = function($scope, old_name, title, subtitle, ok, func, context) {
      $scope.func = func;
      $scope.context = context;
      $scope.title = title;
      $scope.subtitle = subtitle;
      $scope.new_name = old_name;
      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_rename' + (hmtg.lazy_min ? '.min' : '') + '.js' + _hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/Rename.htm' + _hmtgHelper.cache_param,
          scope: $scope,
          controller: 'RenameModalCtrl',
          size: '',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
          ok(result.new_name);
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_rename fails');
      });
    }

    /*
    this.resolveURL = function(url, base_url) {
    var doc = document
    , old_base = doc.getElementsByTagName('base')[0]
    , old_href = old_base && old_base.href
    , doc_head = doc.head || doc.getElementsByTagName('head')[0]
    , our_base = old_base || doc_head.appendChild(doc.createElement('base'))
    , resolver = doc.createElement('a')
    , resolved_url
    ;
    our_base.href = base_url || '';
    resolver.href = url;
    resolved_url = resolver.href; // browser magic at work here

    if(old_base) old_base.href = old_href;
    else doc_head.removeChild(our_base);
    return resolved_url;
    }
    */

    this.updateBandwidthRestriction = function(sdp, type, bandwidth) {
      var lines = sdp.split('\r\n');
      var modifier = 'AS';
      if(adapter.browserDetails.browser === 'firefox') {
        bandwidth = (bandwidth >>> 0) * 1000;
        modifier = 'TIAS';
      }
      var base = type == 'audio' ? 'm=audio' : 'm=video';
      var i;
      for(i = 0; i < lines.length; i++) {
        if(lines[i].indexOf(base) != -1) {
          if(bandwidth) {
            lines.splice(i + 1, 0, 'b=' + modifier + ':' + bandwidth);
            i++;
          }  
          var j;
          for(j = i + 1; j < lines.length; j++) {
            if(lines[j].indexOf('m=')) {
              break;
            }
            if(lines[j].indexOf('b=')) {
              lines.splice(j, 1);
              j--;
            }
          }
          break;
        }
      }
      return lines.join('\r\n');
    }

    // https://webrtchacks.com/sdp-anatomy/
    // https://github.com/fippo/minimal-webrtc/blob/master/js/sdp-minimizer.js
    this.reduceSdp = function(desc) {
      var sdp = desc.sdp;
      var lines = sdp.split('\r\n');
      lines = lines.filter(function(line) {
        return (
          line.indexOf('a=rtcp-fb:') !== 0
          && line.indexOf('a=extmap:') !== 0
          // As ICE is mandatory in WebRTC the IP in the c-line is not going to be used.
          && line.indexOf('c=') !== 0 
          && line.indexOf('a=rtcp:') !== 0 
        );
      });

      desc.sdp = lines.join('\r\n');
      return desc;
    }

    this.calcGalleryDisplaySize = function(count) {
      if(count <= 0) return 100;
      var size = Math.min(this.view_port_height, this.view_port_width) - 30;
      if(size <= 80) return 80;
      if(count == 1) {
        return size;
      }
      while(size > 80) {
        // 30, and 2 are determined via testing by changing view port height and width respectively
        // 20 is for potential/temporary scrollbar width
        var row = ((this.view_port_height - 20) / (size + 30)) >>> 0;
        var col = ((this.view_port_width - 20) / (size + 2)) >>> 0;
        if(row * col < count) {
          size--;
        } else {
          //console.log('w=' + this.view_port_width + '; h=' + this.view_port_height + ';count=' + count + ';size=' + size + ';row=' + row + ';col=' + col);
          return size;
        }
      }
      return 80;
    }

  }
])

;
