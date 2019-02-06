angular.module('hmtgs')
.controller('TestCtrl', ['$scope', 'Msgr', '$translate', 'hmtgHelper', 'jnagentDlg', '$modal', 'jnjContent',
  '$rootScope', 'msgrHelper', 'hmtgSound', 'hmtgAlert',
  function ($scope, Msgr, $translate, hmtgHelper, jnagentDlg, $modal, jnjContent, $rootScope, msgrHelper,
    hmtgSound, hmtgAlert) {
    var WORKER_TEST_PATH = 'worker/test_worker.js';

    $scope.play_alert = function () {
      hmtgSound.playAlertSound();
    }
    $scope.play_audio = function () {
      hmtgSound.playAudio();
    }
    $scope.play_script_audio = function () {
      var ac = hmtgSound.ac;
      if(!ac) return;
      var bufferLen = hmtgSound.playback_buffer_size;
      var audioNode;
      if(!ac.createScriptProcessor) {
        audioNode = ac.createJavaScriptNode(bufferLen, 0, 1);
      } else {
        audioNode = ac.createScriptProcessor(bufferLen, 0, 1);
      }
      //hmtgSound.audioNode = audioNode;

      var volume = .5;
      var frequency = 440;
      var a = 0;
      audioNode.onaudioprocess = function (e) {
        a++;
        if(a == 10) a = 0;
        var outputBuffer = e.outputBuffer;
        for(var channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
          var outData = outputBuffer.getChannelData(channel);
          for(var sample = 0; sample < outputBuffer.length; sample++) {
            var sampleTime = ac.currentTime + outputBuffer.duration * sample / outputBuffer.length;
            if(a == 0)
              outData[sample] = volume * Math.sin(sampleTime * frequency * Math.PI * 2);
            else
              outData[sample] = 0;
          }
        }
      }
      audioNode.connect(ac.destination); // Connect to speakers
    }
    $scope.turn_on_audio = function () {
      hmtgSound.turnOnAudio();
    }
    function playAlertViaAudio(ext) {
      if(hmtgSound.ac) {
        var ac = hmtgSound.ac;
        var src = ac.createBufferSource();
        if(hmtgSound.webkit_audio) {
          src.start = src.start || src.noteOn;
          src.stop = src.stop || src.noteOff;
        }

        var request = new XMLHttpRequest();
        request.open('GET', 'media/alert.' + ext, true);
        request.responseType = 'arraybuffer';

        // Decode asynchronously
        request.onload = function () {
          /*
          var data = new forge.util.ByteBuffer(request.response);
          var a = hmtg.util.encode64(data.bytes());
          hmtg.util.log(a);
          */

          ac.decodeAudioData(request.response, function (buffer) {
            src.buffer = buffer;
            src.connect(ac.destination);

            src.start(0);
          }, function (e) {
            hmtgSound.ShowErrorPrompt(function () { return 'cannot decode audio: ' + hmtgSound.getUserMediaError(e) }, 20);
          });
        }
        request.send();
      }
    }
    $scope.play_alert_via_audio_mp3 = function () {
      playAlertViaAudio('mp3');
    }
    $scope.play_alert_via_audio_ogg = function () {
      playAlertViaAudio('ogg');
    }
    $scope.play_alert_via_audio_wav = function () {
      playAlertViaAudio('wav');
    }

    // http://html5doctor.com/getusermedia/
    // https://gist.github.com/miketaylr/f2ac64ed7fc467ccdfe3
    // http://webaudiodemos.appspot.com/AudioRecorder/index.html#

    function startAudioLoop() {
      if(!navigator.getUserMedia) return;
      if(!hmtgSound.ac) return;

      var ac = hmtgSound.ac;
      var sampleRate = ac.sampleRate;

      navigator.getUserMedia({ audio: true, toString: function () { return "audio"; } },
        gotAudioStream,
        function (e) {
          hmtgSound.ShowErrorPrompt(function () { return 'cannot get audio: ' + hmtgSound.getUserMediaError(e) }, 20);
        });

      var decoded_audio_data = [];
      var playing = false;
      var play_start_tick = 0;
      var play_duration = 0;
      var play_next_timerID = null;

      function play_next_audio(ac) {
        if(decoded_audio_data.length) {
          var now = hmtg.util.GetTickCount();
          var delay = play_duration - (now - play_start_tick);
          if(delay < 0) delay = 0;
          decoded_audio_data[0].start(ac.currentTime + delay);
          play_start_tick = now;
          play_duration = delay + decoded_audio_data[0].buffer.duration;
          decoded_audio_data.splice(0, 1);
        }
      }

      function gotAudioStream(stream) {
        hmtgSound.audio_stream = stream;
        var ac = hmtgSound.ac;
        var input = ac.createMediaStreamSource(stream);
        var bufferLen = hmtgSound.record_buffer_size;
        var record_node;
        if(!ac.createScriptProcessor) {
          record_node = ac.createJavaScriptNode(bufferLen, 1, 1);
        } else {
          record_node = ac.createScriptProcessor(bufferLen, 1, 1);
        }
        hmtgSound.record_node = record_node;
        record_node.onaudioprocess = function (e) {
          var samples = e.inputBuffer.getChannelData(0);
          var wav_data = encodeWAV(samples, true);

          ac.decodeAudioData(wav_data, function (audioData) {
            var src = ac.createBufferSource();
            if(hmtgSound.webkit_audio) {
              src.start = src.start || src.noteOn;
              src.stop = src.stop || src.noteOff;
            }
            src.buffer = audioData;
            src.connect(ac.destination);

            if(playing) {
              decoded_audio_data.push(src);
              var now = hmtg.util.GetTickCount();
              if(play_duration - (now - play_start_tick) < 20) {
                if(play_next_timerID) {
                  clearTimeout(play_next_timerID);
                  play_next_timerID = null;
                }
                play_next_audio(ac);
              } else {
                if(!play_next_timerID) {
                  play_next_timerID = setTimeout(play_next_audio, (play_duration - (now - play_start_tick) - 20) * 1000, ac);
                }
              }
            } else {
              playing = true;
              src.start(0);
              play_start_tick = hmtg.util.GetTickCount();
              play_duration = audioData.duration;
            }
          });

        }
        input.connect(record_node);
        record_node.connect(ac.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.
      }

      function floatTo16BitPCM(output, offset, input) {
        for(var i = 0; i < input.length; i++, offset += 2) {
          var s = Math.max(-1, Math.min(1, input[i]));
          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
      }

      function writeString(view, offset, string) {
        for(var i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      }

      // https: //ccrma.stanford.edu/courses/422/projects/WaveFormat/
      function encodeWAV(samples, mono) {
        var buffer = new ArrayBuffer(44 + samples.length * 2);
        var view = new DataView(buffer);

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');
        /* file length */
        view.setUint32(4, 36 + samples.length * 2, true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, mono ? 1 : 2, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * (mono ? 1 : 2) * 2, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, (mono ? 1 : 2) * 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, samples.length * 2, true);

        floatTo16BitPCM(view, 44, samples);

        return buffer;
      }
    }
    stopAudioLoop = function () {
      hmtgSound.stopStream(hmtgSound.audio_stream);
    }

    hmtgSound.script_audio_loop_start_tick = 0;
    startScriptAudioLoop = function () {
      if(!navigator.getUserMedia) return;
      if(!hmtgSound.ac) return;

      hmtgSound.script_audio_loop_start_tick = hmtg.util.GetTickCount();

      var ac = hmtgSound.ac;
      var sampleRate = ac.sampleRate;

      navigator.getUserMedia({ audio: true, toString: function () { return "audio"; } },
        gotAudioStream,
        function (e) {
          hmtgSound.ShowErrorPrompt(function () { return 'cannot get audio: ' + hmtgSound.getUserMediaError(e) }, 20);
        });

      var decoded_audio_data = [];
      var played_size = 0;

      function gotAudioStream(stream) {
        hmtgSound.audio_stream = stream;
        var ac = hmtgSound.ac;
        var input = ac.createMediaStreamSource(stream);
        var bufferLen = hmtgSound.record_buffer_size;
        var record_node;
        if(!ac.createScriptProcessor) {
          record_node = ac.createJavaScriptNode(bufferLen, 1, 1);
        } else {
          record_node = ac.createScriptProcessor(bufferLen, 1, 1);
        }
        hmtgSound.record_node = record_node;
        record_node.onaudioprocess = function (e) {
          var samples = e.inputBuffer.getChannelData(0);
          var data = new Float32Array(samples.length);
          data.set(samples);
          decoded_audio_data.push(data);
        }
        input.connect(record_node);
        record_node.connect(ac.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.

        var playback_node;
        var bufferLen2 = hmtgSound.playback_buffer_size;
        if(!ac.createScriptProcessor) {
          playback_node = ac.createJavaScriptNode(bufferLen2, 0, 1);
        } else {
          playback_node = ac.createScriptProcessor(bufferLen2, 0, 1);
        }
        hmtgSound.playback_node = playback_node;
        playback_node.onaudioprocess = function (e) {
          var outputBuffer = e.outputBuffer;
          var outData = outputBuffer.getChannelData(0);

          var idx = 0;
          var now = hmtg.util.GetTickCount();
          if(now - hmtgSound.script_audio_loop_start_tick > 500) {
            while(decoded_audio_data.length) {
              var to_copy = outputBuffer.length - idx;
              if((decoded_audio_data[0].length - played_size) > to_copy) {
                outData.set(decoded_audio_data[0].subarray(played_size, played_size + to_copy), idx);
                idx += to_copy;
                played_size += to_copy;
                break;
              } if((decoded_audio_data[0].length - played_size) == to_copy) {
                outData.set(decoded_audio_data[0].subarray(played_size), idx);
                idx += to_copy;
                played_size = 0;
                decoded_audio_data.splice(0, 1);
                break;
              } else {
                outData.set(decoded_audio_data[0].subarray(played_size), idx);
                idx += decoded_audio_data[0].length - played_size;
                played_size = 0;
                decoded_audio_data.splice(0, 1);
              }
            }
          }
          for(; idx < outputBuffer.length; idx++) {
            outData[idx] = 0;
          }
        }
        playback_node.connect(ac.destination); // Connect to speakers
      }
    }
    stopScriptAudioLoop = function () {
      hmtgSound.stopStream(hmtgSound.audio_stream);
      hmtgSound.playback_node.disconnect();
    }


    $scope.start_audio_loop = function () {
      startAudioLoop();
    }
    $scope.stop_audio_loop = function () {
      stopAudioLoop();
    }
    $scope.start_script_audio_loop = function () {
      startScriptAudioLoop();
    }
    $scope.stop_script_audio_loop = function () {
      stopScriptAudioLoop();
    }

    // video
    var canvas_timerID = null;
    $scope.elem_video = document.getElementById('video');
    function startVideoLoop() {
      if(!navigator.getUserMedia) return;
      if(canvas_timerID) {
        $scope.elem_video.play();
        return;
      }

      var old_width = 0, old_height = 0;
      var elem_video = $scope.elem_video = document.getElementById('video');
      var elem_canvas = document.getElementById('self_video_canvas');
      var elem_canvas2 = document.getElementById('self_video_canvas2');
      var ctx = elem_canvas.getContext('2d');
      var ctx2 = elem_canvas2.getContext('2d');
      if(!canvas_timerID) {
        canvas_timerID = setInterval(function () {
          var target_width, target_height;
          if(elem_video.videoWidth / elem_video.videoHeight > 1.1 * (elem_canvas.width / elem_canvas.height)) {
            target_width = elem_canvas.width;
            target_height = elem_canvas.width * elem_video.videoHeight / elem_video.videoWidth;
          } else if(elem_video.videoWidth / elem_video.videoHeight < 0.9 * (elem_canvas.width / elem_canvas.height)) {
            target_height = elem_canvas.height;
            target_width = elem_canvas.height * elem_video.videoWidth / elem_video.videoHeight;
          } else {
            target_width = elem_canvas.width;
            target_height = elem_canvas.height;
          }

          var need_reset = false;
          if(old_width != target_width || old_height != target_height) {
            need_reset = true;
            old_width = target_width;
            old_height = target_height;
          }
          if(need_reset) ctx.clearRect(0, 0, elem_canvas.width, elem_canvas.height);
          try {
            ctx.drawImage(elem_video, 0, 0, target_width, target_height);

            // Grab the pixel data from the backing canvas
            var idata = ctx.getImageData(0, 0, target_width, target_height);
            var data = idata.data;
            // Loop through the pixels, turning them grayscale
            for(var i = 0; i < data.length; i += 4) {
              var r = data[i];
              var g = data[i + 1];
              var b = data[i + 2];
              var brightness = (r + (r << 1) + (g << 2) + b) >>> 3;
              data[i] = brightness;
              data[i + 1] = brightness;
              data[i + 2] = brightness;
            }
            idata.data = data;
            // Draw the pixels onto the visible canvas
            if(need_reset) ctx2.clearRect(0, 0, elem_canvas2.width, elem_canvas2.height);
            ctx2.putImageData(idata, 0, 0);
          } catch(e) {
          }

        }, 67);
      }

      navigator.getUserMedia({ video: true, toString: function () { return "video"; } }, function (stream) {
        elem_video.src = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(stream) : stream;
      }, function (e) {
        hmtgSound.ShowErrorPrompt(function () { return 'cannot get video: ' + hmtgSound.getUserMediaError(e) }, 20);
      });
    }

    function stopVideoLoop() {
      $scope.elem_video.pause();
    }

    $scope.start_video_loop = function () {
      startVideoLoop();
    }
    $scope.stop_video_loop = function () {
      stopVideoLoop();
    }

    // screen
    function startScreenLoop() {
      // https://html5-demos.appspot.com/static/getusermedia/screenshare.html
      if(!navigator.getUserMedia) return;
      if(!location.protocol.match('https')) {
        hmtgHelper.inside_angular++;
        hmtgSound.ShowErrorPrompt(function () { return 'must use https to capture screen' }, 20);
        hmtgHelper.inside_angular--;
        return;
      }
      if(!(navigator.userAgent.match('Chrome') &&
        parseInt(navigator.userAgent.match(/Chrome\/(.*) /)[1]) >= 26)) {
        hmtgHelper.inside_angular++;
        hmtgSound.ShowErrorPrompt(function () { return 'must use Chrome 26+ to capture screen' }, 20);
        hmtgHelper.inside_angular--;
        return;
      }

      var elem_video = document.getElementById('video');
      var elem_canvas = document.getElementById('self_video_canvas');
      var ctx = elem_canvas.getContext('2d');
      setInterval(function () {
        try {
          ctx.drawImage(elem_video, 0, 0, elem_canvas.width, elem_canvas.height);
        } catch(e) {
        }
      }, 67);

      navigator.getUserMedia({ video: {
        mandatory: {
          chromeMediaSource: 'screen'
        }
      }
      },
      function (stream) {
        elem_video.src = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(stream) : stream;
      }, function (e) {
        hmtgSound.ShowErrorPrompt(function () { return 'cannot get screen: ' + hmtgSound.getUserMediaError(e) }, 20);
      });
    }
    function stopScreenLoop() {
    }

    $scope.start_screen_loop = function () {
      startScreenLoop();
    }
    $scope.stop_video_loop = function () {
      stopVideoLoop();
    }

    $scope.sound_info = '';
    $scope.sound_info += ("sound support:" + (hmtgSound.can_mp3 ? ' mp3' : '') + (hmtgSound.can_ogg ? ' ogg' : '') + (hmtgSound.can_wav ? ' wav' : ''));
    $scope.audio_info = ("HTML5 Audio support: " + hmtgSound.typeAudioContext);
    $scope.url_info = ("HTML5 URL support: " + hmtgSound.typeURL);
    $scope.gum_info = ("HTML5 getUserMedia support: " + hmtgSound.typeGUM);

    $scope.can_show_audio = function () {
      return !!hmtgSound.ac;
    }

    $scope.can_show_audio2 = function () {
      return !!hmtgSound.ac && !!hmtgSound.typeGUM;
    }

    $scope.can_show_video = function () {
      return !!hmtgSound.typeGUM;
    }

    $scope.worker_test = function () {
      var timerID = null;
      var worker_audio_decode = new Worker(WORKER_TEST_PATH);
      worker_audio_decode.onmessage = function (e) {
        switch(e.data.command) {
          case 'data_out':
            var error = 0;
            if(e.data.rate != 1234 || e.data.data.byteLength != 1024 || e.data.data[1] != 1)
              error = 1;
            var item = {};
            item['timeout'] = 20;
            item['text'] = 'got reponse from worker: data is ' + (error ? 'ERROR' : 'OK');
            item['type'] = 'success';

            hmtgAlert.update_status_item(item);

            worker_audio_decode.terminate();
            if(timerID) {
              clearTimeout(timerID);
              timerID = null;
            }
            break;
        }
      }

      var uInt8Array = new Uint8Array(1024);
      for(var i = 0; i < uInt8Array.length; ++i) {
        uInt8Array[i] = i;
      }

      if(hmtgHelper.good_worker)
        worker_audio_decode.postMessage({ command: 'data_in', data: uInt8Array, sampleRate: 1234 }, [uInt8Array.buffer]);
      else
        worker_audio_decode.postMessage({ command: 'data_in', data: uInt8Array, sampleRate: 1234 });
      worker_audio_decode.postMessage({ command: 'request_data' });

      var timerID = setTimeout(function () {
        hmtgSound.ShowErrorPrompt(function () { return 'no reponse from worker in 1 second, abort' }, 20);
        worker_audio_decode.terminate();
      }, 1000);

    }
  }
])
;