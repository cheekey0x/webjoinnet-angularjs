/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('joinnetAudio', ['hmtgSound', '$rootScope', 'audio_codec', 'hmtgHelper', 'audio_capture', '$translate',
  'hmtgAlert', 'mediasoupWebRTC',
  function(hmtgSound, $rootScope, audio_codec, hmtgHelper, audio_capture, $translate, hmtgAlert,
    mediasoupWebRTC) {
    var _joinnetAudio = this;
    this.audio_record_support = navigator.getUserMedia && hmtgSound.ac;
    this.audio_playback_support = hmtgSound.ac;
    this.audio_stream = null;
    this.record_node = null;
    hmtgSound.shadowRecording = this.recording = false;
    this.error_occurred = false;

    // chrome not support getuserMedia over http
    // https://sites.google.com/a/chromium.org/dev/Home/chromium-security/deprecating-powerful-features-on-insecure-origins

    this.can_show_record_control = function() {
      if(!this.audio_record_support) return false;
      //if(!audio_codec.audio_codec) return false;
      if(hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return false;
      //if(!hmtg.jnkernel._jn_bConnected()) return false;
      return true;
    }

    this.can_show_playback_control = function() {
      if(!this.audio_playback_support) return false;
      //if(!hmtg.jnkernel._jn_bConnected()) return false;
      return true;
    }

    this.start = function(device_id) {
      this.remove_alert_item();
      if(!navigator.getUserMedia) return;
      if(!hmtgSound.ac) return;
      if(this.recording) return;
      //if(!audio_codec.audio_codec) return;

      var capture_tick = hmtg.util.GetTickCount();      
      if(capture_tick - hmtgSound.audio_video_capture_tick < 100) {
        setTimeout(function() { _joinnetAudio.start(device_id) }, 100);
        return;
      }
      hmtgSound.audio_video_capture_tick = capture_tick;

      var elem_signal = document.getElementById('signal_strength');

      var need_adjust_volume;
      need_adjust_volume = false;
      if(hmtgSound.record_muted) {
        need_adjust_volume = true;
      } else if(hmtgSound.record_gain < hmtgSound.MIN_GAIN) {
        need_adjust_volume = true;
      }
      if(need_adjust_volume) {
        if(hmtgSound.record_muted) {
          hmtg.util.log('stat, audio record mute status is Unmuted');
        }
        hmtgSound.record_muted = false;
        hmtgSound.record_gain = hmtgSound.MIN_GAIN;
        hmtg.util.localStorage['hmtg_record_muted'] = JSON.stringify(hmtgSound.record_muted);
        hmtg.util.localStorage['hmtg_record_gain'] = JSON.stringify(hmtgSound.record_gain);
      }

      hmtgSound.shadowRecording = this.recording = true;
      hmtg.util.log('stat, local audio capture is ON');
      $rootScope.$broadcast(hmtgHelper.WM_AUDIO_RECORDING_CHANGED);
      $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
      mediasoupWebRTC.updateAudioSending();

      var ac = hmtgSound.ac;

      if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if(!device_id) {
          hmtg.util.log(2, 'try to capture audio without deviceId');
          navigator.mediaDevices.getUserMedia({
            audio: true
          }).then(gotAudioStream, audioStreamError);
        } else {
          hmtg.util.log(2, 'try to capture audio with deviceId ' + device_id);
          navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: device_id } }
          }).then(gotAudioStream, audioStreamError);
        }
      }

      function audioStreamError(e) {
        hmtg.util.log(5, 'capture audio fails, error: ' + hmtgSound.getUserMediaError(e));
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_AUDIO') + hmtgSound.getUserMediaError(e) }, 20);
        _joinnetAudio.error_occurred = true;
        if(_joinnetAudio.recording) {
          hmtg.util.log('stat, local audio capture is OFF');
        }
        hmtgSound.shadowRecording = _joinnetAudio.recording = false;
        //$rootScope.$broadcast(hmtgHelper.WM_AUDIO_RECORDING_CHANGED);
        //$rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
        mediasoupWebRTC.updateAudioSending();
      }
      function gotAudioStream(stream) {
        $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);

        _joinnetAudio.audio_stream = stream;
        if(!(hmtgSound.ac && hmtgSound.can_mix)) {
          mediasoupWebRTC.audioStream = stream;
          mediasoupWebRTC.startAudioSource();
        }
        var audioTracks = stream.getAudioTracks();
        if(audioTracks && audioTracks[0]) {
          hmtg.util.log('capture audio succeeds, using audio device: ' + audioTracks[0].label);
        }  
        var input = ac.createMediaStreamSource(stream);
        var bufferLen = hmtgSound.record_buffer_size;
        var record_node;
        if(!ac.createScriptProcessor) {
          record_node = ac.createJavaScriptNode(bufferLen, 1, 1);
        } else {
          record_node = ac.createScriptProcessor(bufferLen, 1, 1);
        }

        _joinnetAudio.record_node = record_node;
        record_node.onaudioprocess = function(e) {
          if(!elem_signal) return;
          var ctx = elem_signal.getContext('2d');
          ctx.clearRect(0, 0, elem_signal.width, elem_signal.height);
          if(hmtgSound.record_muted) return;

          hmtgSound.analyser.getByteFrequencyData(array);
          hmtgSound.fillVolumeIndicator(array, elem_signal, ctx);
        }
        // show signal strength on GUI
        var record_gain_node = hmtgSound.create_record_gain_node();
        input.connect(record_gain_node);
        hmtgSound.analyser.connect(record_node);
        record_node.connect(ac.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.

        // merge to mixed audio
        record_gain_node.connect(hmtgSound.merge_analyser);

        if(!_joinnetAudio.tmp_gain_node) {
          var tmp_gain_node = ac.createGain();
          tmp_gain_node.gain.value = _joinnetAudio.is_record_loop ? 1.0 : 0.0;
          record_gain_node.connect(tmp_gain_node);
          tmp_gain_node.connect(hmtgSound.create_playback_gain_node()); // Connect to speakers
          _joinnetAudio.tmp_gain_node = tmp_gain_node;
        }


        var array = new Uint8Array(hmtgSound.analyser.frequencyBinCount);
      }
    }

    this.stop = function() {
      this.remove_alert_item();
      if(!this.recording) return;
      hmtg.util.log('stat, local audio capture is OFF');
      hmtgSound.shadowRecording = this.recording = false;
      $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
      if(_joinnetAudio.audio_stream)
        hmtgSound.stopStream(_joinnetAudio.audio_stream);
      _joinnetAudio.audio_stream = null;
      if(!(hmtgSound.ac && hmtgSound.can_mix)) {
        mediasoupWebRTC.audioStream = null;
        mediasoupWebRTC.stopAudioSource();
      }
      mediasoupWebRTC.updateAudioSending();
      if(_joinnetAudio.record_node) {
        _joinnetAudio.record_node.onaudioprocess = null;
        _joinnetAudio.record_node.disconnect();
      }
      _joinnetAudio.record_node = null;
      var elem_signal = document.getElementById('signal_strength');
      var ctx = elem_signal.getContext('2d');
      ctx.clearRect(0, 0, elem_signal.width, elem_signal.height);
      $rootScope.$broadcast(hmtgHelper.WM_AUDIO_RECORDING_CHANGED);
    }

    this.remove_alert_item = function() {
      if(this.alert_item) {
        hmtgAlert.remove_link_item(this.alert_item);
        this.alert_item = null;
      }
    }
  }
])

.controller('JoinNetAudioCtrl', ['$scope', 'Msgr', '$translate', 'hmtgHelper', 'jnagentDlg', '$modal', 'jnjContent',
          '$rootScope', 'msgrHelper', 'hmtgSound', 'appSetting', 'audio_capture', 'audio_codec', 'joinnetAudio',
          'hmtgAlert', 'mediasoupWebRTC',
  function($scope, Msgr, $translate, hmtgHelper, jnagentDlg, $modal, jnjContent, $rootScope, msgrHelper,
          hmtgSound, appSetting, audio_capture, audio_codec, joinnetAudio, hmtgAlert,
          mediasoupWebRTC) {
    $scope.w = hmtgSound;
    $scope.ja = joinnetAudio;
    $scope.as = appSetting;

    var idle_mode = false;

    $scope.$on(hmtgHelper.WM_AUDIO_RECORDING_CHANGED, function() {
      setTimeout(function() { $scope.$digest(); }, 0);
    });

    $scope.$on(hmtgHelper.WM_NET_INIT_FINISH, function() {
      joinnetAudio.is_record_loop = false;
      if(joinnetAudio.tmp_gain_node) {
        joinnetAudio.tmp_gain_node.gain.value = joinnetAudio.is_record_loop ? 1.0 : 0.0;
      }

      idle_mode = false;

      var need_adjust_volume = false;
      if(hmtgSound.playback_muted) {
        need_adjust_volume = true;
      } else if(hmtgSound.playback_gain < hmtgSound.MIN_GAIN) {
        need_adjust_volume = true;
      }
      if(need_adjust_volume) {
        if(hmtgSound.playback_muted) {
          hmtg.util.log('stat, audio playback mute status is Unmuted');
        }
        hmtgSound.playback_muted = false;
        hmtgSound.playback_gain = hmtgSound.MIN_GAIN;
        hmtg.util.localStorage['hmtg_playback_muted'] = JSON.stringify(hmtgSound.playback_muted);
        hmtg.util.localStorage['hmtg_playback_gain'] = JSON.stringify(hmtgSound.playback_gain);
      }

      if(!joinnetAudio.recording && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        if(appSetting.meeting_capture_audio) {
          joinnetAudio.start();
        } else if(!joinnetAudio.error_occurred && joinnetAudio.can_show_record_control() && audio_codec.audio_codec) {
          joinnetAudio.remove_alert_item();

          var item = {};
          item['timeout'] = 10;
          item['update'] = function() { return $translate.instant('ID_START_RECORD') };
          item['text'] = item['update']();
          item['type'] = 'info';
          item['click'] = function(index) {
            hmtgHelper.inside_angular++;
            hmtgAlert.click_link(index);
            joinnetAudio.start();
            hmtgHelper.inside_angular--;
          };

          hmtgAlert.add_link_item(item);
          joinnetAudio.alert_item = item;
        }
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_QUIT_SESSION, function() {
      // do not stop audio capture when quit session, the reconnection will be smoother
      //joinnetAudio.stop();
      //if(!hmtgHelper.inside_angular) $scope.$digest();

      // but still clear the alert item
      joinnetAudio.remove_alert_item();
    });

    $scope.$on(hmtgHelper.WM_RESET_SESSION, function() {
      //joinnetAudio.stop();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_IDLE_MODE, function(event, user_count) {
      if(user_count == 1) {
        if(joinnetAudio.recording) {
          joinnetAudio.stop();
          idle_mode = true; // only set idle mode to true if the audio is stopped effectively
          if(!hmtgHelper.inside_angular) $scope.$digest();
        }
      } else if(user_count == 2) {
        if(idle_mode && !joinnetAudio.recording) {
          joinnetAudio.start();
          if(!hmtgHelper.inside_angular) $scope.$digest();
        }
        idle_mode = false;
      }
    });

    $scope.start = function() {
      hmtgHelper.inside_angular++;
      joinnetAudio.start();
      hmtgHelper.inside_angular--;
    }

    $scope.mute_record = function(muted) {
      if($scope.w.record_gain == 0 && !muted) return;
      if($scope.w.record_muted != (!!muted)) {
        hmtg.util.log('stat, audio record mute status is ' + ((!!muted) ? 'Muted' : 'Unmuted'));
      }
      $scope.w.record_muted = !!muted;
      mediasoupWebRTC.updateAudioSending();
      hmtg.util.localStorage['hmtg_record_muted'] = JSON.stringify($scope.w.record_muted);
      $scope.w.record_gain_node_gain_value = hmtgSound.record_muted ? 0.0 : hmtgSound.record_gain / 100.0;
      if($scope.w.record_gain_node) {
        $scope.w.record_gain_node.gain.value = $scope.w.record_gain_node_gain_value;
      }

      if(muted) {
        var elem_signal = document.getElementById('signal_strength');
        var ctx = elem_signal.getContext('2d');
        ctx.clearRect(0, 0, elem_signal.width, elem_signal.height);
      }
    }
    $scope.mute_playback = function(muted) {
      if($scope.w.playback_gain == 0 && !muted) return;
      var old_status = $scope.w.playback_muted;
      if($scope.w.playback_muted != (!!muted)) {
        hmtg.util.log('stat, audio playback mute status is ' + ((!!muted) ? 'Muted' : 'Unmuted'));
      }
      $scope.w.playback_muted = !!muted;
      hmtg.util.localStorage['hmtg_playback_muted'] = JSON.stringify($scope.w.playback_muted);
      $scope.w.playback_gain_node_gain_value = hmtgSound.playback_muted ? 0.0 : hmtgSound.playback_gain / 100.0;
      if($scope.w.playback_gain_node) {
        $scope.w.playback_gain_node.gain.value = $scope.w.playback_gain_node_gain_value;
      }

      if($scope.w.playback_muted != old_status && hmtg.customization.stop_audio_when_mute) {
        hmtg.jnkernel.jn_command_RequestAudio(!$scope.w.playback_muted);
      }
    }

    $scope.$watch('w.record_gain', function() {
      if($scope.w.record_muted != ($scope.w.record_gain == 0)) {
        hmtg.util.log('stat, audio record mute status is ' + ($scope.w.record_gain == 0 ? 'Muted' : 'Unmuted'));
      }
      $scope.w.record_muted = $scope.w.record_gain == 0;
      mediasoupWebRTC.updateAudioSending();
      hmtg.util.localStorage['hmtg_record_gain'] = JSON.stringify($scope.w.record_gain);
      $scope.w.record_gain_node_gain_value = hmtgSound.record_muted ? 0.0 : hmtgSound.record_gain / 100.0;
      if($scope.w.record_gain_node) {
        $scope.w.record_gain_node.gain.value = $scope.w.record_gain_node_gain_value;
      }
    });

    $scope.$watch('w.playback_gain', function() {
      var old_status = $scope.w.playback_muted;
      if($scope.w.playback_muted != ($scope.w.playback_gain == 0)) {
        hmtg.util.log('stat, audio playback mute status is ' + (($scope.w.playback_gain == 0) ? 'Muted' : 'Unmuted'));
      }
      $scope.w.playback_muted = $scope.w.playback_gain == 0;
      hmtg.util.localStorage['hmtg_playback_gain'] = JSON.stringify($scope.w.playback_gain);
      $scope.w.playback_gain_node_gain_value = hmtgSound.playback_muted ? 0.0 : hmtgSound.playback_gain / 100.0;
      if($scope.w.playback_gain_node) {
        $scope.w.playback_gain_node.gain.value = $scope.w.playback_gain_node_gain_value;
      }

      if($scope.w.playback_muted != old_status && hmtg.customization.stop_audio_when_mute) {
        hmtg.jnkernel.jn_command_RequestAudio(!$scope.w.playback_muted);
      }
    });
  }
])

.service('joinnetVideo', ['hmtgSound', '$rootScope', 'video_codec', 'hmtgHelper', 'video_capture', 'main_video_canvas',
  'video_recving', 'main_video', '$translate', 'video_playback', 'joinnetTranscoding', 'hmtgAlert', '$ocLazyLoad',
  'mediasoupWebRTC', 'appSetting',
  function(hmtgSound, $rootScope, video_codec, hmtgHelper, video_capture, main_video_canvas, video_recving, main_video,
    $translate, video_playback, joinnetTranscoding, hmtgAlert, $ocLazyLoad,
    mediasoupWebRTC, appSetting) {
    var _joinnetVideo = this;
    this.recording = false;
    this.video_record_support = navigator.getUserMedia;
    this.elem_video = document.getElementById('joinnet_video');
    //this.elem_video = document.createElement("video");
    this.elem_screen = document.getElementById('screen_capture');
    //this.elem_screen = document.createElement("video");
    this.frameURL = window.URL.createObjectURL(new Blob(["onmessage = function(e) { setInterval(function(){postMessage('dummy'); },40)}"], { type: 'application/javascript' }));
    this.frameWorker = null;
    this.screenWorker = null;
    this.error_occurred = false;
    this.use_screen_as_video = false;

    // screen capture info
    // chrome
    // https://www.webrtc-experiment.com/Pluginfree-Screen-Sharing/
    // https://www.webrtc-experiment.com/getScreenId/
    // https://github.com/muaz-khan/WebRTC-Experiment/tree/master/getScreenId.js
    // firefox
    // http://mozilla.github.io/webrtc-landing/gum_test.html

    // screen capture
    // chrome
    // 1. install extension
    // https://chrome.google.com/webstore/detail/screen-capturing/ajhifddimkapgcifgcodmmfdlknahffk
    // 2. must be able to access https://www.webrtc-experiment.com
    // 3. add command line option "--allow-http-screen-capture" and restart chrome
    // firefox
    // 1. 

    this.has_video_loop = function() {
      if(this.use_screen_as_video && video_recving.main_video_ssrc == hmtg.jnkernel._jn_ssrc_index()) {
        // screen as video and viewing self, could be a loop
        return true;
      }

      if(video_recving.main_video_ssrc == -4) {
        // captured screen, could be a loop
        return true;
      }

      return false;
    }
    this.can_show_record_control = function() {
      if(!this.video_record_support) return false;
      //if(!video_codec.video_codec) return false;
      if(hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return false;
      //if(!hmtg.jnkernel._jn_bConnected()) return false;
      return true;
    }

    this.can_show_recv_video_control = function() {
      if(!hmtg.jnkernel._jn_bConnected()) return false;
      return true;
    }

    this.start = function(device_id) {
      this.remove_alert_item();
      if(!navigator.getUserMedia) return;
      if(this.recording) return;
      //if(!video_codec.video_codec) return;

      var capture_tick = hmtg.util.GetTickCount();
      if(capture_tick - hmtgSound.audio_video_capture_tick < 100) {
        setTimeout(function() { _joinnetVideo.start(device_id) }, 100);
        return;
      }
      hmtgSound.audio_video_capture_tick = capture_tick;

      this.recording = true;
      hmtg.util.log('stat, local video capture is ON');
      var elem_video = this.elem_video;

      var constraints;
      var large;
      var small;
      if(appSetting.use_ideal_video_capture_dimension) {
        large = appSetting.ideal_video_capture_dimension >> 4 << 4;
        small = (large / 1.54 + 8) >> 4 << 4;
      }
      if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if(appSetting.use_ideal_video_capture_dimension) {
          captureVideo1stAttempt();
        } else {
          captureVideoLastAttempt();
        }
      }

      function captureVideo1stAttempt() {
        if(device_id) {
          constraints = {
            deviceId: { exact: device_id },
            width: { ideal: large },
            height: { ideal: small }
          }
          hmtg.util.log(2, 'try to capture video with deviceId ' + device_id + ' @ ' + large + ' x ' + small);
        } else {
          constraints = {
            width: { ideal: large },
            height: { ideal: small }
          }
          hmtg.util.log(2, 'try to capture video without deviceId @ ' + large + ' x ' + small);
        }
        navigator.mediaDevices.getUserMedia({
          video: constraints
        }).then(getUserMediaOK, captureVideo2ndAttempt);
      }
      function captureVideo2ndAttempt() {
        if(device_id) {
          constraints = {
            deviceId: { exact: device_id },
            width: { ideal: small },
            height: { ideal: large }
          }
          hmtg.util.log(2, 'try to capture video with deviceId ' + device_id + ' @ ' + small + ' x ' + large);
        } else {
          constraints = {
            width: { ideal: small },
            height: { ideal: large }
          }
          hmtg.util.log(2, 'try to capture video without deviceId @ ' + small + ' x ' + large);
        }
        navigator.mediaDevices.getUserMedia({
          video: constraints
        }).then(getUserMediaOK, captureVideoLastAttempt);
      }
      function captureVideoLastAttempt() {
        if(device_id) {
          constraints = {
            deviceId: { exact: device_id }
          }
          hmtg.util.log(2, 'try to capture video with deviceId ' + device_id);
        } else {
          constraints = true;
          hmtg.util.log(2, 'try to capture video without deviceId');
        }
        navigator.mediaDevices.getUserMedia({
          video: constraints
        }).then(getUserMediaOK, videoStreamError);
      }
      function videoStreamError(e) {
        hmtg.util.log(5, 'capture video fails, error: ' + hmtgSound.getUserMediaError(e));
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_VIDEO') + ' Error: ' + hmtgSound.getUserMediaError(e) }, 20);
        _joinnetVideo.error_occurred = true;
        if(_joinnetVideo.recording) {
          hmtg.util.log('stat, local video capture is OFF');
        }
        _joinnetVideo.recording = false;
        //$rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
        //$rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      }
      function getUserMediaOK(stream) {
        $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
        _joinnetVideo.video_stream = stream;
        mediasoupWebRTC.localVideoStream = stream;
        mediasoupWebRTC.updateVideoSource();
        var videoTracks = stream.getVideoTracks();
        if(videoTracks && videoTracks[0]) {
          hmtg.util.log('capture video succeeds, using video device: ' + videoTracks[0].label);
        }  
        if(typeof elem_video.srcObject == "object") {
          // http://chasefarmer.com/articles/2017-06-06-ios-webrtc/
          elem_video.srcObject = stream;
          hmtg.util.log(2, 'attach video source using srcObject');
        } else {
          try {
            hmtg.util.log(2, 'attach video source using src');
            elem_video.src = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(stream) : stream;
          } catch(e) {
            hmtg.util.log(5, 'failed to attach video source using src, error: ' + e);
          }
        }
        //setTimeout(function () { $scope.$digest(); }, 0);
        if(!_joinnetVideo.frameWorker) {
          try {
            _joinnetVideo.frameWorker = new Worker(_joinnetVideo.frameURL);
          } catch(e) {
            _joinnetVideo.frameWorker = new Worker('worker/worker_interval_40.js');
          }
          _joinnetVideo.frameWorker.onmessage = function(e) {
            getVideoFrame();
          };
          _joinnetVideo.frameWorker.postMessage('dummy'); // Start the worker.
        }
      }
    }

    this.stop = function() {
      this.remove_alert_item();
      if(video_recving.has_local_camera) {
        video_recving.has_local_camera = false;
        hmtgHelper.inside_angular++;
        main_video.update_user_list();
        hmtgHelper.inside_angular--;
      }
      if(!this.recording) return;
      if(this.video_stream) {
        hmtgSound.stopStream(this.video_stream);
      }
      this.video_stream = null;
      if(this.elem_video) this.elem_video.src = null;
      if(this.recording) {
        hmtg.util.log('stat, local video capture is OFF');
      }
      this.recording = false;
      mediasoupWebRTC.localVideoStream = null;
      hmtgHelper.inside_angular++;
      mediasoupWebRTC.updateVideoSource();
      hmtgHelper.inside_angular--;
      $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
      if(this.frameWorker) {
        this.frameWorker.terminate();
        this.frameWorker = null;
      }
    }

    var last_video_print_tick = hmtg.util.GetTickCount() - 60000;
    var video_print_count = 0;
    function getVideoFrame() {
      var elem_video = _joinnetVideo.elem_video;

      /*
      function mylog(str) {
        var now = hmtg.util.GetTickCount();
        if(video_print_count < 100 || now - last_video_print_tick > 10000) {
          last_video_print_tick = now;
          video_print_count++;
          hmtg.util.log(9, '******debug, getVideoFrame, error/skipped: ' + str);
        }
      }
      */

      if(elem_video.videoWidth == 0) {
        //mylog('video size is 0');
        return;
      }
      if(!video_recving.has_local_camera) {
        hmtg.util.log('video capture info, screen=' + window.screen.width + 'x' + window.screen.height +
        ', viewport=' + hmtgHelper.view_port_width + 'x' + hmtgHelper.view_port_height +
        ', video=' + elem_video.videoWidth + 'x' + elem_video.videoHeight);
        video_recving.has_local_camera = true;
        main_video.update_user_list();
      }
      var to_draw = false;
      if(main_video_canvas.video_ssrc == -3) {
        var old = main_video_canvas.canvas_orig;
        main_video_canvas.canvas_orig = video_playback.camera_canvas;
        if(!old) {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST); // to update ng-show of snapshot button
        }
        to_draw = true;
      } else if(main_video_canvas.video_ssrc2 == -3) {
        main_video_canvas.canvas_orig2 = video_playback.camera_canvas;
        to_draw = true;
      }
      if(to_draw) {
        video_playback.camera_canvas.width = elem_video.videoWidth;
        video_playback.camera_canvas.height = elem_video.videoHeight;
        try {
          video_playback.camera_ctx.drawImage(elem_video, 0, 0);
        } catch(e) {
          //mylog('drawImage fails, error: ' + hmtgSound.getUserMediaError(e));
        }
        main_video_canvas.draw_video();
      }
      if(joinnetTranscoding.transcoding && joinnetTranscoding.active_video) {
        //mylog('in transcoding');
        return;
      }
      if(_joinnetVideo.use_screen_as_video) {
        //mylog('sending screen capture');
        return;
      }
      var bitrate = hmtg.jnkernel._jn_targetrate();
      if(bitrate == 0) {
        //mylog('target rate is 0');
        return;
      }
      if(!hmtg.jnkernel._jn_bConnected()) {
        //mylog('not connected');
        return;
      }
      if(!hmtg.jnkernel.jn_info_CanSendVideo()) {
        //mylog('not eligible to send');
        return;
      }
      if(video_capture.video_encode) {
        video_capture.video_encode(bitrate, elem_video);
      } else {
        //mylog('no encoding codec');
      }
    }

    this.remove_alert_item = function() {
      if(this.alert_item) {
        hmtgAlert.remove_link_item(this.alert_item);
        this.alert_item = null;
      }
    }

    this.startScreenCapture = function(window_mode) {
      if(!navigator.getUserMedia) return;
      if(this.screen_recording) return;

      this.screen_recording = true;
      hmtg.util.log('stat, screen capture status is ON');
      if(!_joinnetVideo.use_screen_as_video) {
        hmtg.util.log('stat, use screen as video status: Yes');
      }
      mediasoupWebRTC.use_screen_as_video = _joinnetVideo.use_screen_as_video = true;
      var elem_screen = this.elem_screen;

      if(hmtgHelper.isChrome && hmtgHelper.isAndroid
        && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // android chrome already support navigator.mediaDevices.getDisplayMedia
        // however, calling navigator.mediaDevices.getDisplayMedia will crash the browser
        // check android chrome first and use chromeMediaSource if matched
        hmtg.util.log(2, '(androidChrome)try to capture screen via navigator.mediaDevices.getUserMedia');
        navigator.mediaDevices.getUserMedia({
          video: { 'mandatory': { 'chromeMediaSource': 'screen', maxHeight: 1280 } }
        }).then(getUserMediaOK, videoStreamError);
      } else if(navigator.getDisplayMedia) {
        hmtg.util.log(2, 'try to capture screen via navigator.getDisplayMedia');
        navigator.getDisplayMedia({
          video: true
        }).then(getUserMediaOK, videoStreamError);
      } else if(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        hmtg.util.log(2, 'try to capture screen via navigator.mediaDevices.getDisplayMedia');
        navigator.mediaDevices.getDisplayMedia({
          video: true
        }).then(getUserMediaOK, videoStreamError);
      } else if(hmtgHelper.isChrome) {
        hmtg.util.log(2, '(chrome)try to capture screen via Chrome extension');
        if(typeof getScreenId != 'function') {
          $ocLazyLoad.load('//cdn.WebRTC-Experiment.com/getScreenId.js').then(function() {
            hmtgHelper.inside_angular++;
            if(_joinnetVideo.screen_recording) screen_capture();
            hmtgHelper.inside_angular--;
          }, function(e) {
            hmtg.util.log(-1, 'Warning! lazy_loading getScreenId fails');
            if(_joinnetVideo.screen_recording) {
              hmtg.util.log('stat, screen capture status is OFF');
            }
            _joinnetVideo.screen_recording = false;
            if(_joinnetVideo.use_screen_as_video) {
              hmtg.util.log('stat, use screen as video status: No');
            }
            mediasoupWebRTC.use_screen_as_video = _joinnetVideo.use_screen_as_video = false;
          });
        } else {
          screen_capture();
        }
      } else if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        hmtg.util.log(2, 'try to capture screen via navigator.mediaDevices.getUserMedia/mediaSource');
        navigator.mediaDevices.getUserMedia({
          video: { mediaSource: (window_mode ? 'window' : 'screen') }
        }).then(getUserMediaOK, videoStreamError);
      } else {
        hmtg.util.log(2, 'donot know how to capture screen');
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_SCREEN') }, 20);
        if(_joinnetVideo.screen_recording) {
          hmtg.util.log('stat, screen capture status is OFF');
        }
        _joinnetVideo.screen_recording = false;
        if(_joinnetVideo.use_screen_as_video) {
          hmtg.util.log('stat, use screen as video status: No');
        }
        mediasoupWebRTC.use_screen_as_video = _joinnetVideo.use_screen_as_video = false;
      }

      function screen_capture() {
        getScreenId(function(error, sourceId, screen_constraints) {
          // error    == null || 'permission-denied' || 'not-installed' || 'installed-disabled' || 'not-chrome'
          // sourceId == null || 'string' || 'firefox'
          if(error) {
            hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_SCREEN') + error }, 20);
            if(_joinnetVideo.screen_recording) {
              hmtg.util.log('stat, screen capture status is OFF');
            }
            _joinnetVideo.screen_recording = false;
            if(_joinnetVideo.use_screen_as_video) {
              hmtg.util.log('stat, use screen as video status: No');
            }
            mediasoupWebRTC.use_screen_as_video = _joinnetVideo.use_screen_as_video = false;
            mediasoupWebRTC.localScreenStream = null;
            //$rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
            //$rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
            return;
          }

          if(!!navigator.mozGetUserMedia && !window_mode) {
            screen_constraints = {
              video: {
                mozMediaSource: 'screen',
                mediaSource: 'screen'
              }
            };
          }
          navigator.getUserMedia(screen_constraints, getUserMediaOK, videoStreamError);
        });
      }

      function videoStreamError(e) {
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_SCREEN') + hmtgSound.getUserMediaError(e) }, 20);
        if(_joinnetVideo.screen_recording) {
          hmtg.util.log('stat, screen capture status is OFF');
        }
        _joinnetVideo.screen_recording = false;
        if(_joinnetVideo.use_screen_as_video) {
          hmtg.util.log('stat, use screen as video status: No');
        }
        mediasoupWebRTC.use_screen_as_video = _joinnetVideo.use_screen_as_video = false;
        mediasoupWebRTC.localScreenStream = null;
            //$rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
            //$rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      }
      function getUserMediaOK(stream) {
        $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
        _joinnetVideo.screen_stream = stream;
        mediasoupWebRTC.localScreenStream = stream;
        mediasoupWebRTC.updateVideoSource();
        if(typeof elem_screen.srcObject == "object") {
          // http://chasefarmer.com/articles/2017-06-06-ios-webrtc/
          elem_screen.srcObject = stream;
        } else {
          try {
            elem_screen.src = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(stream) : stream;
          } catch(e) {
          }
        }
        if(!_joinnetVideo.screenWorker) {
          try {
            _joinnetVideo.screenWorker = new Worker(_joinnetVideo.frameURL);
          } catch(e) {
            _joinnetVideo.screenWorker = new Worker('worker/worker_interval_40.js');
          }
          _joinnetVideo.screenWorker.onmessage = function(e) {
            getScreenFrame();
          };

          _joinnetVideo.screenWorker.postMessage('dummy'); // Start the worker.
        }
      }
    }

    this.stopScreenCapture = function() {
      if(video_recving.has_local_screen) {
        video_recving.has_local_screen = false;
        hmtgHelper.inside_angular++;
        main_video.update_user_list();
        hmtgHelper.inside_angular--;
      }
      if(!this.screen_recording) return;
      if(this.screen_stream) {
        hmtgSound.stopStream(this.screen_stream);
      }
      this.screen_stream = null;
      if(this.elem_screen) this.elem_screen.src = null;
      if(this.screen_recording) {
        hmtg.util.log('stat, screen capture status is OFF');
      }
      this.screen_recording = false;
      if(this.use_screen_as_video) {
        hmtg.util.log('stat, use screen as video status: No');
      }
      mediasoupWebRTC.use_screen_as_video = this.use_screen_as_video = false;
      mediasoupWebRTC.localScreenStream = null;
      hmtgHelper.inside_angular++;
      mediasoupWebRTC.updateVideoSource();
      hmtgHelper.inside_angular--;
      $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
      if(this.screenWorker) {
        this.screenWorker.terminate();
        this.screenWorker = null;
      }
    }

    function getScreenFrame() {
      var elem_screen = _joinnetVideo.elem_screen;
      if(elem_screen.videoWidth == 0) return;
      if(!video_recving.has_local_screen) {
        hmtg.util.log('screen capture info, screen=' + window.screen.width + 'x' + window.screen.height +
        ', viewport=' + hmtgHelper.view_port_width + 'x' + hmtgHelper.view_port_height +
        ', screen_capture=' + elem_screen.videoWidth + 'x' + elem_screen.videoHeight);
        video_recving.has_local_screen = true;
        main_video.update_user_list();
      }
      var to_draw = false;
      if(main_video_canvas.video_ssrc == -4) {
        var old = main_video_canvas.canvas_orig;
        main_video_canvas.canvas_orig = video_playback.screen_canvas;
        if(!old) {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST); // to update ng-show of snapshot button
        }
        to_draw = true;
      } else if(main_video_canvas.video_ssrc2 == -4) {
        main_video_canvas.canvas_orig2 = video_playback.screen_canvas;
        to_draw = true;
      }
      if(to_draw) {
        video_playback.screen_canvas.width = elem_screen.videoWidth;
        video_playback.screen_canvas.height = elem_screen.videoHeight;
        try {
          video_playback.screen_ctx.drawImage(elem_screen, 0, 0);
        } catch(e) {
        }
        main_video_canvas.draw_video();
      }
      if(joinnetTranscoding.transcoding && joinnetTranscoding.active_video) return;
      if(!_joinnetVideo.use_screen_as_video) return;
      var bitrate = hmtg.jnkernel._jn_targetrate();
      if(bitrate == 0) return;
      if(!hmtg.jnkernel._jn_bConnected()) return;
      if(!hmtg.jnkernel.jn_info_CanSendVideo()) return;
      if(video_capture.video_encode) video_capture.video_encode(bitrate, elem_screen);
    }

  }
])

.controller('JoinNetVideoCtrl', ['$scope', 'Msgr', '$translate', 'hmtgHelper', 'jnagentDlg', '$modal', 'jnjContent',
          '$rootScope', 'msgrHelper', 'hmtgSound', 'appSetting', 'video_capture', 'video_codec', 'video_bitrate', 'video_playback',
          'video_recving', 'main_video', 'main_video_canvas', 'joinnetVideo', 'hmtgAlert',
  function($scope, Msgr, $translate, hmtgHelper, jnagentDlg, $modal, jnjContent, $rootScope, msgrHelper,
          hmtgSound, appSetting, video_capture, video_codec, video_bitrate, video_playback, video_recving, main_video,
          main_video_canvas, joinnetVideo, hmtgAlert) {
    $scope.v = video_playback;
    $scope.vr = video_recving;
    $scope.jv = joinnetVideo;
    $scope.as = appSetting;

    var idle_mode = false;

    $scope.$on(hmtgHelper.WM_NET_INIT_FINISH, function() {
      idle_mode = false;

      if(!joinnetVideo.recording && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        if(appSetting.meeting_capture_video) {
          if(!hmtg.util.localStorage['hmtg_capture_video_decided']) {
            var item = {};
            item['timeout'] = 5;
            item['update'] = function() { return $translate.instant('ID_DELAY_VIDEO_CAPTURE') };
            item['text'] = item['update']();
            item['type'] = 'info';
            item['timeout_action'] = function() {
              joinnetVideo.start();
            }
            item['click'] = function(index) {
              hmtg.util.localStorage['hmtg_capture_video_decided'] = true;
              hmtgHelper.inside_angular++;
              hmtgAlert.click_link(index);
              joinnetVideo.start();
              hmtgHelper.inside_angular--;
            };
            item['cancel'] = function() {
              hmtg.util.localStorage['hmtg_capture_video_decided'] = true;
              appSetting.meeting_capture_video = hmtg.util.localStorage['hmtg_meeting_capture_video'] = false;
            }

            hmtgAlert.add_link_item(item);
            joinnetVideo.alert_item = item;
          } else {
            joinnetVideo.start();
          }
        } else if(!joinnetVideo.error_occurred && joinnetVideo.can_show_record_control() && video_codec.video_codec) {
          joinnetVideo.remove_alert_item();

          var item = {};
          item['timeout'] = 10;
          item['update'] = function() { return $translate.instant('ID_START_VIDEO_CAPTURE') };
          item['text'] = item['update']();
          item['type'] = 'info';
          item['click'] = function(index) {
            hmtgHelper.inside_angular++;
            hmtgAlert.click_link(index);
            joinnetVideo.start();
            hmtgHelper.inside_angular--;
          };

          hmtgAlert.add_link_item(item);
          joinnetVideo.alert_item = item;
        }
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_QUIT_SESSION, function() {
      // do not stop video capture when quit session, the reconnection will be smoother
      //joinnetVideo.stop();
      //if(!hmtgHelper.inside_angular) $scope.$digest();

      // but still clear the alert item
      joinnetVideo.remove_alert_item();
    });

    $scope.$on(hmtgHelper.WM_RESET_SESSION, function() {
      //joinnetVideo.stop();
      //joinnetVideo.stopScreenCapture();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_IDLE_MODE, function(event, user_count) {
      if(user_count == 1) {
        if($scope.recording) {
          joinnetVideo.stop();
          idle_mode = true; // only set idle mode to true if the audio is stopped effectively
          if(!hmtgHelper.inside_angular) $scope.$digest();
        }
      } else if(user_count == 2) {
        if(idle_mode && !$scope.recording) {
          joinnetVideo.start();
          if(!hmtgHelper.inside_angular) $scope.$digest();
        }
        idle_mode = false;
      }
    });

    $scope.start = function() {
      hmtgHelper.inside_angular++;
      joinnetVideo.start();
      hmtgHelper.inside_angular--;
    }
  }
])

.service('joinnetTranscoding', ['hmtgSound', '$rootScope', 'hmtgHelper', 'audio_codec', 'video_codec',
  function(hmtgSound, $rootScope, hmtgHelper, audio_codec, video_codec) {
    var _joinnetTranscoding = this;
    this.transcode_node = null;
    this.transcoding = false;
    this.audio_transcoding = false;
    this.video_transcoding = false;
    this.video_error_code = 0;
    this.active_video = true;
    this.transcoding_gain = 80;
    this.transcoding_muted = false;
    this.local_gain = 80;
    this.local_muted = false;

    // how to add CORS to your server
    // http://enable-cors.org/server.html

    // not all browsers can handle crossorigin for video tag
    // https://gist.github.com/keyvanfatehi/6002271

    // use the following site to download direct video files from various sites
    // http://youtubeinmp4.com/
    // http://savefrom.net/
    // http://www.youtube-mp3.org/

    this.can_show_transcoding_control = function() {
      if(!hmtgSound.ac) return false;
      //if(!audio_codec.audio_codec && !video_codec.video_codec) return false;
      //if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return false;
      //if(!hmtg.jnkernel._jn_bConnected()) return false;
      return true;
    }

    this.import_html5_media = function(src, audio_broadcast_volume, audio_local_volume, audio_only, loop) {
      if(!src) return;
      $rootScope.$broadcast(hmtgHelper.WM_IMPORT_TRANSCODING, src, audio_broadcast_volume, audio_local_volume, audio_only, loop);
    }

    this.reset_html5_media = function() {
      $rootScope.$broadcast(hmtgHelper.WM_RESET_TRANSCODING);
    }

    // quality seems not good
    this.import_audio_file = function(link) {
      if(!hmtgSound.ac) return;
      var ac = hmtgSound.ac;
      var src = ac.createBufferSource();
      if(hmtgSound.webkit_audio) {
        src.start = src.start || src.noteOn;
        src.stop = src.stop || src.noteOff;
      }

      var request = new XMLHttpRequest();
      request.open('GET', link, true);
      request.responseType = 'arraybuffer';

      // Decode asynchronously
      request.onload = function() {
        ac.decodeAudioData(request.response, function(buffer) {
          src.buffer = buffer;
          src.connect(hmtgSound.merge_analyser);

          src.start(0);
        }, function(e) {
          hmtgSound.ShowErrorPrompt(function() { return 'audio decoding error:' + hmtgSound.getUserMediaError(e) }, 20);
        });
      }
      request.send();
    }

  }
])

;
