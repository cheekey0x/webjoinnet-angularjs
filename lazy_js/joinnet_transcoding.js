angular.module('joinnet')
.controller('JoinNetTranscodingCtrl', ['$scope', 'Msgr', '$translate', 'hmtgHelper', 'jnagentDlg', '$modal', 'jnjContent',
          '$rootScope', 'msgrHelper', 'hmtgSound', 'appSetting', 'joinnetTranscoding', 'audio_codec', 'audio_capture',
          'video_codec', 'video_capture', 'main_video_canvas', 'video_recving', 'main_video', 'video_playback', 'JoinNet',
          '$ocLazyLoad', 'mediasoupWebRTC',
  function ($scope, Msgr, $translate, hmtgHelper, jnagentDlg, $modal, jnjContent, $rootScope, msgrHelper,
          hmtgSound, appSetting, joinnetTranscoding, audio_codec, audio_capture, video_codec, video_capture,
          main_video_canvas, video_recving, main_video, video_playback, JoinNet, $ocLazyLoad, mediasoupWebRTC) {
    $scope.w = hmtgSound;
    $scope.as = appSetting;
    $scope.w.loop = false;
    $scope.w.video_info = '';
    $scope.w.video_error = false;
    $scope.jt = joinnetTranscoding;
    $scope.elem1_html5 = document.getElementById('html5_media1');
    $scope.elem2_html5 = document.getElementById('html5_media2');
    $scope.elem3_html5 = document.getElementById('html5_media3');
    if(hmtgSound.ac) {
      $scope.input1 = hmtgSound.ac.createMediaElementSource($scope.elem1_html5);
      $scope.input2 = hmtgSound.ac.createMediaElementSource($scope.elem2_html5);
      $scope.input3 = hmtgSound.ac.createMediaElementSource($scope.elem3_html5);
      $scope.transcoding_gain_node = hmtgSound.ac.createGain();
      $scope.transcoding_gain_node.gain.value = joinnetTranscoding.transcoding_muted ? 0 : joinnetTranscoding.transcoding_gain / 100.0;
      $scope.local_gain_node = hmtgSound.ac.createGain();
      $scope.local_gain_node.gain.value = joinnetTranscoding.local_muted ? 0 : joinnetTranscoding.local_gain / 100.0;
    }
    $scope.frameURL = window.URL.createObjectURL(new Blob(["onmessage = function(e) { setInterval(function(){postMessage('dummy'); },40)}"], { type: 'application/javascript' }));
    $scope.frameWorker = null;

    var firsttime = true;
    var idle_mode = false;

    function on_net_init_finish() {
      idle_mode = false;

      if(!hmtgHelper.inside_angular) $scope.$digest();
    }

    if(JoinNet.net_init_finished) {
      hmtgHelper.inside_angular++;
      on_net_init_finish();
      hmtgHelper.inside_angular--;
    }

    $scope.$on(hmtgHelper.WM_NET_INIT_FINISH, on_net_init_finish);

    $scope.$on(hmtgHelper.WM_QUIT_SESSION, function () {
      //$scope.reset();
      //if(!hmtgHelper.inside_angular) $scope.$digest();
      var elem_html5 = $scope.w.audio_only ? $scope.elem3_html5 : ($scope.w.crossorigin ? $scope.elem1_html5 : $scope.elem2_html5);
      elem_html5.pause();
    });

    $scope.$on(hmtgHelper.WM_RESET_SESSION, function () {
      //$scope.reset();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_IDLE_MODE, function (event, user_count) {
      if(user_count == 1) {
        if(joinnetTranscoding.transcoding) {
          $scope.stop_transcoding();
          idle_mode = true; // only set idle mode to true if the audio is stopped effectively
          if(!hmtgHelper.inside_angular) $scope.$digest();
        }
      } else if(user_count == 2) {
        if(idle_mode && !joinnetTranscoding.transcoding) {
          $scope.start_transcoding();
          if(!hmtgHelper.inside_angular) $scope.$digest();
        }
        idle_mode = false;
      }
    });

    $scope.$on(hmtgHelper.WM_IMPORT_TRANSCODING, function (event, src, audio_broadcast_volume, audio_local_volume, audio_only, loop) {
      if(!src) {
        $scope.import_html5();
      } else {
        $scope.stop_transcoding();
        $scope.elem1_html5.pause();
        $scope.elem2_html5.pause();
        $scope.elem3_html5.pause();
        $scope.elem1_html5.removeAttribute('src');
        $scope.elem2_html5.removeAttribute('src');
        $scope.elem3_html5.removeAttribute('src');
        $scope.elem1_html5.autoplay = $scope.elem2_html5.autoplay = $scope.elem3_html5.autoplay = true;
        joinnetTranscoding.transcoding_gain = Math.min(100, Math.max(0, audio_broadcast_volume));
        if(joinnetTranscoding.transcoding_muted != (joinnetTranscoding.transcoding_gain == 0)) {
          hmtg.util.log('stat, html5 audio muted status is ' + (joinnetTranscoding.transcoding_gain == 0 ? 'Muted' : 'Unmuted'));
        }
        joinnetTranscoding.transcoding_muted = joinnetTranscoding.transcoding_gain == 0;
        joinnetTranscoding.local_gain = Math.min(100, Math.max(0, audio_local_volume));
        joinnetTranscoding.local_muted = joinnetTranscoding.local_gain == 0;
        $scope.w.audio_only = audio_only;
        $scope.w.loop = loop;
        if(audio_only) {
          $scope.elem3_html5.src = src;
          $scope.w.crossorigin = true;
          joinnetTranscoding.active_video = false;
          mediasoupWebRTC.use_imported_as_video = false;
        } else {
          $scope.elem1_html5.src = src;
          $scope.w.crossorigin = true;
          joinnetTranscoding.active_video = true;
          mediasoupWebRTC.use_imported_as_video = joinnetTranscoding.transcoding;
        }
        $scope.w.video_info = '';
        $scope.w.video_error = false;
        $scope.start_transcoding();
        setTimeout(function () { $scope.$digest(); }, 0);
      }
    });

    $scope.$on(hmtgHelper.WM_RESET_TRANSCODING, function () {
      $scope.reset();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.reset = function () {
      $scope.stop_transcoding();
      $scope.elem1_html5.pause();
      $scope.elem2_html5.pause();
      $scope.elem3_html5.pause();
      $scope.elem1_html5.removeAttribute('src');
      $scope.elem2_html5.removeAttribute('src');
      $scope.elem3_html5.removeAttribute('src');
      $scope.w.video_info = '';
      $scope.w.video_error = false;
    }

    $scope.import_html5 = function () {
      if(!joinnetTranscoding.can_show_transcoding_control()) return;

      if(firsttime) {
        firsttime = false;
        // for iOS to support auto play
        $scope.elem1_html5.play();
        $scope.elem2_html5.play();
        $scope.elem3_html5.play();
      }
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

        //$modalInstance.close({ src: window.URL.createObjectURL(file), auto_play: $scope.w.auto_play, audio_only: $scope.w.audio_only });
        var result = { src: window.URL.createObjectURL(file), auto_play: true, audio_only: false };
        hmtgHelper.inside_angular++;
        $rootScope.$broadcast(hmtgHelper.WM_SHOW_CONTROL_PANEL);
        hmtgHelper.inside_angular--;
        $scope.stop_transcoding();
        $scope.elem1_html5.pause();
        $scope.elem2_html5.pause();
        $scope.elem3_html5.pause();
        $scope.elem1_html5.removeAttribute('src');
        $scope.elem2_html5.removeAttribute('src');
        $scope.elem3_html5.removeAttribute('src');
        $scope.elem1_html5.autoplay = $scope.elem2_html5.autoplay = $scope.elem3_html5.autoplay = result.auto_play ? true : false;
        if(result.audio_only) {
          $scope.elem3_html5.src = result.src;
          $scope.w.crossorigin = true;
          joinnetTranscoding.active_video = false;
          mediasoupWebRTC.use_imported_as_video = false;
          $scope.w.video_info = '';
          $scope.w.video_error = false;
          $scope.w.audio_only = true;
        } else {
          $scope.elem1_html5.src = result.src;
          $scope.w.crossorigin = true;
          joinnetTranscoding.active_video = true;
          mediasoupWebRTC.use_imported_as_video = joinnetTranscoding.transcoding;
          $scope.w.video_info = '';
          $scope.w.video_error = false;
          $scope.w.audio_only = false;
        }
        $scope.start_transcoding();
      }

      /*
      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_import_media' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function () {
        var modalInstance = $modal.open({
          templateUrl: 'template/ImportMedia.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'ImportMediaModalCtrl',
          size: 'lg',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function (result) {
          hmtgHelper.inside_angular++;
          $rootScope.$broadcast(hmtgHelper.WM_SHOW_CONTROL_PANEL);
          hmtgHelper.inside_angular--;
          $scope.stop_transcoding();
          $scope.elem1_html5.pause();
          $scope.elem2_html5.pause();
          $scope.elem3_html5.pause();
          $scope.elem1_html5.removeAttribute('src');
          $scope.elem2_html5.removeAttribute('src');
          $scope.elem3_html5.removeAttribute('src');
          $scope.elem1_html5.autoplay = $scope.elem2_html5.autoplay = $scope.elem3_html5.autoplay = result.auto_play ? true : false;
          if(result.audio_only) {
            $scope.elem3_html5.src = result.src;
            $scope.w.crossorigin = true;
            joinnetTranscoding.active_video = false;
            mediasoupWebRTC.use_imported_as_video = false;
            $scope.w.video_info = '';
            $scope.w.video_error = false;
            $scope.w.audio_only = true;
          } else {
            $scope.elem1_html5.src = result.src;
            $scope.w.crossorigin = true;
            joinnetTranscoding.active_video = true;
            mediasoupWebRTC.use_imported_as_video = joinnetTranscoding.transcoding;
            $scope.w.video_info = '';
            $scope.w.video_error = false;
            $scope.w.audio_only = false;
          }
          $scope.start_transcoding();
        }, function () {
        });
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_import_media fails');
      });
      */
    }

    $scope.elem1_html5.onloadeddata = function () {
      hmtg.util.log(-2, 'crossorigin video loaded for ' + $scope.elem1_html5.src);
      if(!idle_mode) {
        $scope.start_transcoding();
        $scope.$digest();
      }
    }

    $scope.elem1_html5.onerror = function () {
      hmtg.util.log(-2, 'error occurs, use non-crossorigin to reload ' + $scope.elem1_html5.src);
      $scope.stop_transcoding();
      $scope.elem2_html5.src = $scope.elem1_html5.src;
      $scope.elem1_html5.pause();
      $scope.elem1_html5.removeAttribute('src');
      $scope.w.crossorigin = false;
      $scope.start_transcoding();
    }

    $scope.elem2_html5.onloadeddata = function () {
      hmtg.util.log(-2, 'non-crossorigin video loaded for ' + $scope.elem2_html5.src);
      if(!idle_mode) {
        $scope.start_transcoding();
        $scope.$digest();
      }
    }

    $scope.elem2_html5.onerror = function () {
      hmtg.util.log(-2, 'non-crossorigin error in loading ' + $scope.elem2_html5.src);
      hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_ERROR_LOAD_HTML5_MEDIA') }, 20);
    }

    $scope.elem3_html5.onloadeddata = function () {
      hmtg.util.log(-2, 'audio loaded for ' + $scope.elem3_html5.src);
      if(!idle_mode) {
        $scope.start_transcoding();
        $scope.$digest();
      }
    }

    $scope.elem3_html5.onerror = function () {
      hmtg.util.log(-2, 'audio error in loading ' + $scope.elem3_html5.src);
      hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_ERROR_LOAD_HTML5_MEDIA') }, 20);
    }

    // disable the mute/volume buttons in the audio control
    $scope.elem1_html5.onvolumechange = function (e, a) {
      $scope.elem1_html5.volume = 1;
      $scope.elem1_html5.muted = false;
    }

    $scope.elem2_html5.onvolumechange = function (e, a) {
      $scope.elem2_html5.volume = 1;
      $scope.elem2_html5.muted = false;
    }

    $scope.elem3_html5.onvolumechange = function (e, a) {
      $scope.elem3_html5.volume = 1;
      $scope.elem3_html5.muted = false;
    }

    $scope.start_transcoding = function () {
      if(!hmtgSound.ac) return;
      if(joinnetTranscoding.transcoding) return;
      joinnetTranscoding.audio_transcoding = true;
      hmtg.util.log('stat, html5 audio forwarding is ON');
      joinnetTranscoding.video_transcoding = !$scope.w.audio_only;
      if(joinnetTranscoding.video_transcoding) {
        hmtg.util.log('stat, html5 video forwarding is ON');
      }

      var elem_html5 = $scope.w.audio_only ? $scope.elem3_html5 : ($scope.w.crossorigin ? $scope.elem1_html5 : $scope.elem2_html5);
      var input = $scope.input = $scope.w.audio_only ? $scope.input3 : ($scope.w.crossorigin ? $scope.input1 : $scope.input2);
      var elem_signal = document.getElementById('html5_signal_strength');

      joinnetTranscoding.transcoding = true;
      mediasoupWebRTC.use_imported_as_video = joinnetTranscoding.active_video;
      hmtgHelper.inside_angular++;
      mediasoupWebRTC.updateAudioSending();
      $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
      hmtgHelper.inside_angular--;

      // update mediasoup video source
      var stream;
      if(elem_html5 && !$scope.w.audio_only) {
        elem_html5.oncanplay = maybeCreateStream;
        elem_html5.onended = function() {
          // when ended, the video stream will stop being sent.
          // reset this to resume the video forwarding when the user click 'play' again
          stream = null;
        }
        if(elem_html5.readyState >= 3) {  // HAVE_FUTURE_DATA
          // Video is already ready to play, call maybeCreateStream in case oncanplay
          // fired before we registered the event handler.
          maybeCreateStream();
        }
      }
      function maybeCreateStream() {
        if(stream) {
          return;
        }
        try {
          if(elem_html5.captureStream) {
            stream = elem_html5.captureStream();
          } else if(elem_html5.mozCaptureStream) {
            stream = elem_html5.mozCaptureStream();
          }
        }
        catch(e) {
          stream = null;
          return;
        }  
        if(stream) {
          mediasoupWebRTC.importedVideoStream = stream;
          mediasoupWebRTC.updateVideoSource();
        }  
      }

      var ac = hmtgSound.ac;
      var sampleRate = ac ? ac.sampleRate : 8000;

      {
        var bufferLen = hmtgSound.record_buffer_size;
        var transcode_node;
        if(!ac.createScriptProcessor) {
          transcode_node = ac.createJavaScriptNode(bufferLen, 1, 1);
        } else {
          transcode_node = ac.createScriptProcessor(bufferLen, 1, 1);
        }

        joinnetTranscoding.transcode_node = transcode_node;
        transcode_node.onaudioprocess = function (e) {
          var ctx = elem_signal.getContext('2d');
          ctx.clearRect(0, 0, elem_signal.width, elem_signal.height);
          if(joinnetTranscoding.transcoding_muted) return;

          $scope.transcoding_analyser.getByteFrequencyData(array);
          hmtgSound.fillVolumeIndicator(array, elem_signal, ctx);
        }
        // show signal strength on GUI
        $scope.transcoding_analyser = hmtgSound.ac.createAnalyser();
        $scope.transcoding_analyser.smoothingTimeConstant = 0.2;
        $scope.transcoding_analyser.fftSize = 1024;
        input.connect($scope.transcoding_gain_node);
        $scope.transcoding_gain_node.connect($scope.transcoding_analyser);
        $scope.transcoding_analyser.connect(transcode_node);
        transcode_node.connect(ac.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.

        var array = new Uint8Array($scope.transcoding_analyser.frequencyBinCount);

        // merge to mixed audio
        $scope.transcoding_gain_node.connect(hmtgSound.merge_analyser);

        // output to local play
        input.connect($scope.local_gain_node);
        $scope.local_gain_node.connect(ac.destination);

        var playback_analyser = ac.createAnalyser();
        playback_analyser.smoothingTimeConstant = 0.2;
        playback_analyser.fftSize = 1024;
        $scope.local_gain_node.connect(playback_analyser);
        $scope.playback_analyser = playback_analyser;

        var bufferLen2 = hmtgSound.playback_buffer_size;
        var playback_node;
        if(!ac.createScriptProcessor) {
          playback_node = ac.createJavaScriptNode(bufferLen2, 1, 1);
        } else {
          playback_node = ac.createScriptProcessor(bufferLen2, 1, 1);
        }

        $scope.playback_node = playback_node;
        var last_value = 0;
        var dup_count = 0;
        playback_node.onaudioprocess = function (e) {
          var elem_signal2 = document.getElementById('html5_playback_signal_strength');
          var ctx2 = elem_signal2.getContext('2d');
          ctx2.clearRect(0, 0, elem_signal2.width, elem_signal2.height);
          if(joinnetTranscoding.local_muted) return;

          playback_analyser.getByteFrequencyData(array2);
          var value = hmtgSound.fillVolumeIndicator(array2, elem_signal2, ctx2);
          if(!value || value != last_value) {
            dup_count = 0;
          } else {
            dup_count++;
            if(dup_count > 8) {  // 8 = 4096/1024 * 2 = ~2s
              dup_count = 0;
              reset_playack_analyser();
            }
          }
          last_value = value;
        }
        // show signal strength on GUI
        playback_analyser.connect(playback_node);
        playback_node.connect(ac.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.

        var array2 = new Uint8Array(playback_analyser.frequencyBinCount);

        function reset_playack_analyser() {
          playback_analyser.disconnect();
          playback_analyser = ac.createAnalyser();
          playback_analyser.smoothingTimeConstant = 0.2;
          playback_analyser.fftSize = 1024;
          $scope.local_gain_node.connect(playback_analyser);
          playback_analyser.connect(playback_node);
          $scope.playback_analyser = playback_analyser;
        }

        if(!$scope.w.audio_play && !$scope.frameWorker) {
          try {
            $scope.frameWorker = new Worker($scope.frameURL);
          } catch(e) {
            $scope.frameWorker = new Worker('worker/worker_interval_40.js');
          }
          $scope.frameWorker.onmessage = function (e) {
            getVideoTranscodingFrame();
          };
          $scope.frameWorker.postMessage('dummy'); // Start the worker.
        }

      }
    }

    function getVideoTranscodingFrame() {
      if($scope.w.audio_only) return;
      var elem_html5 = $scope.w.crossorigin ? $scope.elem1_html5 : $scope.elem2_html5;
      if(elem_html5.videoWidth == 0) return;
      if(!video_recving.has_local_import) {
        video_recving.has_local_import = true;
        main_video.update_user_list();
      }
      var to_draw = false;
      if(main_video_canvas.video_ssrc == -5) {
        var old = main_video_canvas.canvas_orig;
        main_video_canvas.canvas_orig = video_playback.import_canvas;
        if(!old) {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST); // to update ng-show of snapshot button
        }
        to_draw = true;
      } else if(main_video_canvas.video_ssrc2 == -5) {
        main_video_canvas.canvas_orig2 = video_playback.import_canvas;
        to_draw = true;
      }
      if(to_draw) {
        video_playback.import_canvas.width = elem_html5.videoWidth;
        video_playback.import_canvas.height = elem_html5.videoHeight;
        try {
          video_playback.import_ctx.drawImage(elem_html5, 0, 0);
        } catch(e) {
        }
        main_video_canvas.draw_video();
      }
      if(!joinnetTranscoding.transcoding || !joinnetTranscoding.active_video) return;
      var bitrate = hmtg.jnkernel._jn_targetrate();
      if(bitrate == 0) return;
      if(!hmtg.jnkernel._jn_bConnected()) return;
      if(!hmtg.jnkernel.jn_info_CanSendVideo()) return;
      if(!video_capture.video_encode) {
        return;
      }

      if(video_capture.video_encode) {
        var result = video_capture.video_encode(bitrate, elem_html5);
        if(result == 'security') {
          joinnetTranscoding.active_video = false;
          mediasoupWebRTC.use_imported_as_video = false;
          mediasoupWebRTC.importedVideoStream = null;
          if(!$scope.w.audio_only) {
            mediasoupWebRTC.updateVideoSource()
          }
          $scope.w.video_error = true;
          $scope.w.video_info = $translate.instant($scope.crossorigin ? 'ID_CROSS_DOMAIN_VIDEO2' : 'ID_CROSS_DOMAIN_VIDEO1');
          hmtg.util.log(-2, 'cross domain error, stop video broadcasting');
          $scope.$digest();
        }
      }
    }

    $scope.stop_transcoding = function () {
      if(video_recving.has_local_import) {
        video_recving.has_local_import = false;
        hmtgHelper.inside_angular++;
        main_video.update_user_list();
        hmtgHelper.inside_angular--;
      }
      if(!joinnetTranscoding.transcoding) return;
      joinnetTranscoding.transcoding = false;
      mediasoupWebRTC.use_imported_as_video = false;
      mediasoupWebRTC.importedVideoStream = null;
      // update mediasoup video source
      hmtgHelper.inside_angular++;
      if(!$scope.w.audio_only) {
        mediasoupWebRTC.updateVideoSource()
      }
      mediasoupWebRTC.updateAudioSending();
      hmtgHelper.inside_angular--;
      if(joinnetTranscoding.audio_transcoding) {
        hmtg.util.log('stat, html5 audio forwarding is OFF');
      }
      joinnetTranscoding.audio_transcoding = false;
      if(joinnetTranscoding.video_transcoding) {
        hmtg.util.log('stat, html5 video forwarding is OFF');
      }
      joinnetTranscoding.video_transcoding = false;
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_CHANGE_CAP);
      hmtgHelper.inside_angular--;
      if(joinnetTranscoding.transcode_node) {
        joinnetTranscoding.transcode_node.onaudioprocess = null;
        joinnetTranscoding.transcode_node.disconnect();
      }
      joinnetTranscoding.transcode_node = null;
      if($scope.transcoding_gain_node) {
        $scope.transcoding_gain_node.disconnect();
      }
      if($scope.input) {
        $scope.input.disconnect();
      }
      var elem_signal = document.getElementById('html5_signal_strength');
      var ctx = elem_signal.getContext('2d');
      ctx.clearRect(0, 0, elem_signal.width, elem_signal.height);
      //$rootScope.$broadcast(hmtgHelper.WM_AUDIO_RECORDING_CHANGED);
      if($scope.frameWorker) {
        $scope.frameWorker.terminate();
        $scope.frameWorker = null;
      }
    }

    $scope.mute_transcoding = function (muted) {
      if(joinnetTranscoding.transcoding_gain == 0 && !muted) return;
      if(joinnetTranscoding.transcoding_muted != (!!muted)) {
        hmtg.util.log('stat, html5 audio muted status is ' + ((!!muted) ? 'Muted' : 'Unmuted'));
      }
      joinnetTranscoding.transcoding_muted = !!muted;
      hmtgHelper.inside_angular++;
      mediasoupWebRTC.updateAudioSending();
      hmtgHelper.inside_angular--;
      $scope.transcoding_gain_node.gain.value = joinnetTranscoding.transcoding_muted ? 0 : joinnetTranscoding.transcoding_gain / 100.0;

      var elem_signal = document.getElementById('html5_signal_strength');
      var ctx = elem_signal.getContext('2d');
      ctx.clearRect(0, 0, elem_signal.width, elem_signal.height);
    }
    $scope.mute_local = function (muted) {
      if(joinnetTranscoding.local_gain == 0 && !muted) return;
      joinnetTranscoding.local_muted = !!muted;
      $scope.local_gain_node.gain.value = joinnetTranscoding.local_muted ? 0 : joinnetTranscoding.local_gain / 100.0;
    }

    $scope.$watch('jt.transcoding_gain', function () {
      if(joinnetTranscoding.transcoding_muted != (joinnetTranscoding.transcoding_gain == 0)) {
        hmtg.util.log('stat, html5 audio muted status is ' + ((joinnetTranscoding.transcoding_gain == 0) ? 'Muted' : 'Unmuted'));
      }
      joinnetTranscoding.transcoding_muted = joinnetTranscoding.transcoding_gain == 0;
      hmtgHelper.inside_angular++;
      mediasoupWebRTC.updateAudioSending();
      hmtgHelper.inside_angular--;
      $scope.transcoding_gain_node.gain.value = joinnetTranscoding.transcoding_muted ? 0 : joinnetTranscoding.transcoding_gain / 100.0;
    });

    $scope.$watch('jt.local_gain', function () {
      joinnetTranscoding.local_muted = joinnetTranscoding.local_gain == 0;
      $scope.local_gain_node.gain.value = joinnetTranscoding.local_muted ? 0 : joinnetTranscoding.local_gain / 100.0;
    });

    $scope.loop = function () {
      $scope.elem1_html5.loop = $scope.elem2_html5.loop = $scope.elem3_html5.loop = $scope.w.loop = !$scope.w.loop;
    }

    $scope.active_video = function () {
      if($scope.w.video_error) return;
      joinnetTranscoding.active_video = !joinnetTranscoding.active_video;
      //joinnetTranscoding.active_video ? mediasoupWebRTC.resumeImportedVideo() : mediasoupWebRTC.pauseImportedVideo();
      mediasoupWebRTC.use_imported_as_video = joinnetTranscoding.transcoding && joinnetTranscoding.active_video;
      hmtgHelper.inside_angular++;
      mediasoupWebRTC.updateVideoSource()
      hmtgHelper.inside_angular--;
      if(!$scope.w.video_error) {
        $scope.w.video_info = joinnetTranscoding.active_video ? '' : $translate.instant('ID_VIDEO_NOT_BROADCASTED');
      }
    }
  }
])

;