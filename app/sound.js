/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('hmtgs')

.service('hmtgSound', ['hmtgAlert', 'hmtgHelper', '$rootScope', '$translate', 'appSetting',
  function(hmtgAlert, hmtgHelper, $rootScope, $translate, appSetting) {
    var _hmtgSound = this;

    this.record_buffer_size = 4096;
    // shorter for lower(better) latency, but too short will cause bad quality
    // should be at least 4096, otherwise, the android phone will show broken audio
    this.playback_buffer_size = 4096;
    //this.playback_buffer_size = 16384;

    this.record_gain = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_record_gain']);
    if(this.record_gain === 'undefined') this.record_gain = 100.0;
    this.record_gain = Math.max(0.0, Math.min(100.0, this.record_gain));
    this.record_muted = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_record_muted']);
    this.record_muted = this.record_muted === 'undefined' ? false : !!this.record_muted;

    this.playback_gain = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_playback_gain']);
    if(this.playback_gain === 'undefined') this.playback_gain = 100.0;
    this.playback_gain = Math.max(0.0, Math.min(100.0, this.playback_gain));
    this.playback_muted = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_playback_muted']);
    this.playback_muted = this.playback_muted === 'undefined' ? false : !!this.playback_muted;

    this.mixer_node = null;    
    this.MIN_GAIN = 10.0;
    this.record_gain_node = null;
    this.analyser = null;
    this.playback_gain_node = null;
    this.record_gain_node_gain_value = this.record_muted ? 0.0 : this.record_gain / 100.0;
    this.playback_gain_node_gain_value = this.playback_muted ? 0.0 : this.playback_gain / 100.0;

    this.audio_video_capture_tick = 0;    

    this.playbackWorkletReady = false;
    this.recordWorkletReady = false;
    this.promiseRecordWorklet = null;

    this.shadowRecording = false; // shadow variable connecting joinnetAudio and mediasoupWebRTC

    this.create_playback_gain_node = function() {
      if(!this.playback_gain_node) {
        this.playback_gain_node = this.ac.createGain();
        this.playback_gain_node.gain.value = this.playback_gain_node_gain_value;
        this.playback_gain_node.connect(this.ac.destination);

        this.playback_analyser = this.ac.createAnalyser();
        this.playback_analyser.smoothingTimeConstant = 0.2;
        this.playback_analyser.fftSize = 1024;
        this.playback_gain_node.connect(this.playback_analyser);

        var bufferLen = _hmtgSound.playback_buffer_size;
        var playback_node;
        var ac = _hmtgSound.ac;
        if(!ac.createScriptProcessor) {
          playback_node = ac.createJavaScriptNode(bufferLen, 1, 1);
        } else {
          playback_node = ac.createScriptProcessor(bufferLen, 1, 1);
        }

        _hmtgSound.playback_node = playback_node;
        var last_value = 0;
        var dup_count = 0;
        playback_node.onaudioprocess = function(e) {
          var elem_signal = document.getElementById('playback_signal_strength');
          if(!elem_signal) return;
          var ctx = elem_signal.getContext('2d');
          ctx.clearRect(0, 0, elem_signal.width, elem_signal.height);
          if(_hmtgSound.playback_muted) return;

          _hmtgSound.playback_analyser.getByteFrequencyData(array);
          var value = _hmtgSound.fillVolumeIndicator(array, elem_signal, ctx);
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
        _hmtgSound.playback_analyser.connect(playback_node);
        playback_node.connect(ac.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.

        var array = new Uint8Array(_hmtgSound.playback_analyser.frequencyBinCount);

        function reset_playack_analyser() {
          _hmtgSound.playback_analyser.disconnect();
          _hmtgSound.playback_analyser = _hmtgSound.ac.createAnalyser();
          _hmtgSound.playback_analyser.smoothingTimeConstant = 0.2;
          _hmtgSound.playback_analyser.fftSize = 1024;
          _hmtgSound.playback_gain_node.connect(_hmtgSound.playback_analyser);
          _hmtgSound.playback_analyser.connect(playback_node);
        }
      }
      return this.playback_gain_node;
    }
    this.create_record_gain_node = function() {
      if(!this.record_gain_node) {
        this.record_gain_node = this.ac.createGain();
        this.record_gain_node.gain.value = this.record_gain_node_gain_value;
        this.analyser = this.ac.createAnalyser();
        this.analyser.smoothingTimeConstant = 0.2;
        this.analyser.fftSize = 1024;
        this.record_gain_node.connect(this.analyser);
      }
      return this.record_gain_node;
    }
    this.getAverageVolume = function(array) {
      var values = 0;
      var average;

      var length = array.length;

      // get all the frequency amplitudes
      for(var i = 0; i < length; i++) {
        values += array[i];
      }

      average = values / length;
      return average;
    }
    this.fillVolumeIndicator = function(array, elem_signal, ctx) {
      var average = this.getAverageVolume(array);

      var width = elem_signal.width * average / 128;
      if(width > elem_signal.width)
        width = elem_signal.width;
      if(width > elem_signal.width * 3 / 4) {
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(elem_signal.width * 3 / 4, 0, width - elem_signal.width * 3 / 4, elem_signal.height);
        ctx.fillStyle = "#ffff00";
        ctx.fillRect(elem_signal.width / 2, 0, elem_signal.width / 4, elem_signal.height);
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(0, 0, elem_signal.width / 2, elem_signal.height);
      } else if(width > elem_signal.width / 2) {
        ctx.fillStyle = "#ffff00";
        ctx.fillRect(elem_signal.width / 2, 0, width - elem_signal.width / 2, elem_signal.height);
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(0, 0, elem_signal.width / 2, elem_signal.height);
      } else {
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(0, 0, width, elem_signal.height);
      }
      return average;
    }

    this.connectVolumeIndicator = function(gain_node, canvas) {
      var ac = this.ac;
      var sampleRate = ac ? ac.sampleRate : 8000;

      var bufferLen = 4096;
      var script_node;
      if(!ac.createScriptProcessor) {
        script_node = ac.createJavaScriptNode(bufferLen, 1, 1);
      } else {
        script_node = ac.createScriptProcessor(bufferLen, 1, 1);
      }

      script_node.onaudioprocess = function(e) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if(!gain_node.gain.value) return;

        analyser.getByteFrequencyData(array);
        _hmtgSound.fillVolumeIndicator(array, canvas, ctx);
      }
      // show signal strength on GUI
      var analyser = this.ac.createAnalyser();
      analyser.smoothingTimeConstant = 0.2;
      analyser.fftSize = 1024;
      gain_node.connect(analyser);
      analyser.connect(script_node);
      script_node.connect(ac.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.
      var array = new Uint8Array(analyser.frequencyBinCount);
    }

    // mp3 encoder
    // https://github.com/akrennmair/libmp3lame-js

    // convert audio format
    // http://media.io
    var a = new Audio();
    this.can_mp3 = !!a.canPlayType && a.canPlayType('audio/mpeg');
    this.can_ogg = !!a.canPlayType && a.canPlayType('audio/ogg');
    this.can_wav = !!a.canPlayType && a.canPlayType('audio/wav');
    this.webkit_audio = false;
    this.audio_turned_on = hmtgHelper.isiOS ? false : true;

    this.typeAudioContext = '';
    this.can_mix = false;
    if(window['AudioContext']) {
      this.ac = new window.AudioContext();
      this.typeAudioContext = 'AudioContext';
    } else if(window['webkitAudioContext']) {
      this.ac = new window.webkitAudioContext();
      this.webkit_audio = true;
      this.typeAudioContext = 'webkitAudioContext';
      this.ac.createGain = this.ac.createGain || this.ac.createGainNode;
      this.ac.createDelay = this.ac.createDelay || this.ac.createDelayNode;
    } else {
      this.ac = null;
    }

    if(this.ac) {
      hmtg.util.log(2, "AutoContext's state upon creation is " + this.ac.state);
      this.merge_analyser = this.ac.createAnalyser();
      this.merge_analyser.smoothingTimeConstant = 0.2;
      this.merge_analyser.fftSize = 1024;

      this.can_mix = !!_hmtgSound.ac.createMediaStreamDestination;
      if(this.can_mix) {
        this.mixer_node = _hmtgSound.ac.createMediaStreamDestination();
        this.merge_analyser.connect(this.mixer_node);
      }

      if(this.ac.audioWorklet) {
        hmtg.util.log("Support AudioWorklet: Yes");
        this.ac.audioWorklet.addModule('worker/worklet-playback.js?p=' + hmtgHelper.cache_param).then(function() { 
          this.playbackWorkletReady = true;
        });
        this.promiseRecordWorklet =
          this.ac.audioWorklet.addModule('worker/worklet-record.js?p=' + hmtgHelper.cache_param);
        this.promiseRecordWorklet.then(function() {
          this.recordWorkletReady = true;
        });
      }  
    }

    //normalize window.URL
    this.typeURL = '';
    if(window['URL']) {
      this.typeURL = 'URL';
    } else if(window['webkitURL']) {
      window.URL = window.webkitURL;
      this.typeURL = 'webkitURL';
    } else if(window['msURL']) {
      window.URL = window.msURL;
      this.typeURL = 'msURL';
    } else if(window['oURL']) {
      window.URL = window.oURL;
      this.typeURL = 'oURL';
    } else {
    }

    //normalize navigator.getUserMedia
    this.typeGUM = '';
    if(navigator['getUserMedia']) {
      this.typeGUM = 'getUserMedia';
    } else if(navigator['webkitGetUserMedia']) {
      navigator.getUserMedia = navigator.webkitGetUserMedia;
      this.typeGUM = 'webkitGetUserMedia';
    } else if(navigator['msGetUserMedia']) {
      navigator.getUserMedia = navigator.msGetUserMedia;
      this.typeGUM = 'msGetUserMedia';
    } else if(navigator['mozGetUserMedia']) {
      navigator.getUserMedia = navigator.mozGetUserMedia;
      this.typeGUM = 'mozGetUserMedia';
    } else {
    }

    // whether source id or device id is used.
    // when this variable is true, it means that navigator.mediaDevices is not avaiable, but MediaStreamTrack.getSources can be used
    // when this variable is false, it means that navigator.mediaDevices is available, or neither is available
    this.is_source_id = false;
    this.audio_output_array = [];
    this.audio_device_array = [];
    this.video_device_array = [];
    this.audio_output_hash = {};
    this.audio_device_hash = {};
    this.video_device_hash = {};
    this.refresh_device_list = function() {
      // input
      if(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.enumerateDevices().then(function(sourceInfos) {
          var name;
          var audio_array = [];
          var video_array = [];
          var audio_hash = {};
          var video_hash = {};
          for(var i = 0; i < sourceInfos.length; ++i) {
            var sourceInfo = sourceInfos[i];
            if(sourceInfo.kind === 'audioinput') {
              if(audio_hash.hasOwnProperty(sourceInfo.deviceId)) continue;
              if(sourceInfo.label || _hmtgSound.audio_device_hash[sourceInfo.deviceId]) {
                name = sourceInfo.label || _hmtgSound.audio_device_hash[sourceInfo.deviceId];
                audio_hash[sourceInfo.deviceId] = name;
              } else {
                name = $translate.instant('ID_MICROPHONE_DESCR') + ' - ' + sourceInfo.deviceId.slice(0, 4);
                audio_hash[sourceInfo.deviceId] = '';
              }
              audio_array.push({ id: sourceInfo.deviceId, name: name });
            } else if(sourceInfo.kind === 'videoinput') {
              if(video_hash.hasOwnProperty(sourceInfo.deviceId)) continue;
              if(sourceInfo.label || _hmtgSound.video_device_hash[sourceInfo.deviceId]) {
                name = sourceInfo.label || _hmtgSound.video_device_hash[sourceInfo.deviceId];
                video_hash[sourceInfo.deviceId] = name;
              } else {
                if(sourceInfo.facing) name = sourceInfo.facing;
                else name = $translate.instant('ID_CAMERA_DESCR') + ' - ' + sourceInfo.deviceId.slice(0, 4);
                video_hash[sourceInfo.deviceId] = '';
              }
              video_array.push({ id: sourceInfo.deviceId, name: name });
            }
          }
          _hmtgSound.audio_device_array = audio_array;
          _hmtgSound.video_device_array = video_array;
          _hmtgSound.audio_device_hash = audio_hash;
          _hmtgSound.video_device_hash = video_hash;
          _hmtgSound.is_source_id = false;
          //hmtg.util.localStorage.removeItem('hmtg_audio_capture_source_id');
          //hmtg.util.localStorage.removeItem('hmtg_video_capture_source_id');
        });
      } else if(typeof MediaStreamTrack !== 'undefined' && typeof MediaStreamTrack.getSources === 'function') {
        try {
          MediaStreamTrack.getSources(function(sourceInfos) {
            var name;
            var audio_array = [];
            var video_array = [];
            var audio_hash = {};
            var video_hash = {};
            for(var i = 0; i < sourceInfos.length; ++i) {
              var sourceInfo = sourceInfos[i];
              if(sourceInfo.kind === 'audio') {
                if(audio_hash.hasOwnProperty(sourceInfo.id)) continue;
                if(sourceInfo.label || _hmtgSound.audio_device_hash[sourceInfo.id]) {
                  name = sourceInfo.label || _hmtgSound.audio_device_hash[sourceInfo.id];
                  audio_hash[sourceInfo.id] = name;
                } else {
                  name = $translate.instant('ID_MICROPHONE_DESCR') + ' - ' + sourceInfo.id.slice(0, 4);
                  audio_hash[sourceInfo.id] = '';
                }
                audio_array.push({ id: sourceInfo.id, name: name });
              } else if(sourceInfo.kind === 'video') {
                if(video_hash.hasOwnProperty(sourceInfo.id)) continue;
                if(sourceInfo.label || _hmtgSound.video_device_hash[sourceInfo.id]) {
                  name = sourceInfo.label || _hmtgSound.video_device_hash[sourceInfo.id];
                  video_hash[sourceInfo.id] = name;
                } else {
                  if(sourceInfo.facing) name = sourceInfo.facing;
                  else name = $translate.instant('ID_CAMERA_DESCR') + ' - ' + sourceInfo.id.slice(0, 4);
                  video_hash[sourceInfo.id] = '';
                }
                video_array.push({ id: sourceInfo.id, name: name });
              }
            }
            _hmtgSound.audio_device_array = audio_array;
            _hmtgSound.video_device_array = video_array;
            _hmtgSound.audio_device_hash = audio_hash;
            _hmtgSound.video_device_hash = video_hash;
            _hmtgSound.is_source_id = true;
            //hmtg.util.localStorage.removeItem('hmtg_audio_capture_device_id');
            //hmtg.util.localStorage.removeItem('hmtg_video_capture_device_id');
          });
        } catch(e) {
        }
      }
      // output
      // setSindId now only support from an element yet.
      // the audio node must be connect to an audio element first using createMediaStreamDestination
      if(_hmtgSound.ac
        //&& _hmtgSound.ac.setSinkId
        && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(function(sourceInfos) {
          var name;
          var output_array = [];
          var output_hash = {};
          for(var i = 0; i < sourceInfos.length; ++i) {
            var sourceInfo = sourceInfos[i];
            if(sourceInfo.kind === 'audiooutput') {
              if(output_hash.hasOwnProperty(sourceInfo.deviceId)) continue;
              if(sourceInfo.label || _hmtgSound.audio_output_hash[sourceInfo.deviceId]) {
                name = sourceInfo.label || _hmtgSound.audio_output_hash[sourceInfo.deviceId];
                output_hash[sourceInfo.deviceId] = name;
              } else {
                name = $translate.instant('ID_SPEAKER_DESCR') + ' - ' + sourceInfo.deviceId.slice(0, 4);
                output_hash[sourceInfo.deviceId] = '';
              }
              output_array.push({ id: sourceInfo.deviceId, name: name });
            }
          }
          _hmtgSound.audio_output_array = output_array;
          _hmtgSound.audio_output_hash = output_hash;
        });
      }
    }

    this.refresh_device_list();

    // http://codebase.es/riffwave/
    var FastBase64 = {

      chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
      encLookup: [],

      Init: function() {
        for(var i = 0; i < 4096; i++) {
          this.encLookup[i] = this.chars[i >> 6] + this.chars[i & 0x3F];
        }
      },

      Encode: function(src) {
        var len = src.length;
        var dst = '';
        var i = 0;
        while(len > 2) {
          n = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
          dst += this.encLookup[n >> 12] + this.encLookup[n & 0xFFF];
          len -= 3;
          i += 3;
        }
        if(len > 0) {
          var n1 = (src[i] & 0xFC) >> 2;
          var n2 = (src[i] & 0x03) << 4;
          if(len > 1) n2 |= (src[++i] & 0xF0) >> 4;
          dst += this.chars[n1];
          dst += this.chars[n2];
          if(len == 2) {
            var n3 = (src[i++] & 0x0F) << 2;
            n3 |= (src[i] & 0xC0) >> 6;
            dst += this.chars[n3];
          }
          if(len == 1) dst += '=';
          dst += '=';
        }
        return dst;
      } // end Encode

    }

    FastBase64.Init();

    var RIFFWAVE = function(data) {

      this.data = [];        // Array containing audio samples
      this.wav = [];         // Array containing the generated wave file
      this.dataURI = '';     // http://en.wikipedia.org/wiki/Data_URI_scheme

      this.header = {                         // OFFS SIZE NOTES
        chunkId: [0x52, 0x49, 0x46, 0x46], // 0    4    "RIFF" = 0x52494646
        chunkSize: 0,                     // 4    4    36+SubChunk2Size = 4+(8+SubChunk1Size)+(8+SubChunk2Size)
        format: [0x57, 0x41, 0x56, 0x45], // 8    4    "WAVE" = 0x57415645
        subChunk1Id: [0x66, 0x6d, 0x74, 0x20], // 12   4    "fmt " = 0x666d7420
        subChunk1Size: 16,                    // 16   4    16 for PCM
        audioFormat: 1,                     // 20   2    PCM = 1
        numChannels: 1,                     // 22   2    Mono = 1, Stereo = 2...
        sampleRate: 8000,                  // 24   4    8000, 44100...
        byteRate: 0,                     // 28   4    SampleRate*NumChannels*BitsPerSample/8
        blockAlign: 0,                     // 32   2    NumChannels*BitsPerSample/8
        bitsPerSample: 8,                     // 34   2    8 bits = 8, 16 bits = 16
        subChunk2Id: [0x64, 0x61, 0x74, 0x61], // 36   4    "data" = 0x64617461
        subChunk2Size: 0                      // 40   4    data size = NumSamples*NumChannels*BitsPerSample/8
      };

      function u32ToArray(i) {
        return [i & 0xFF, (i >> 8) & 0xFF, (i >> 16) & 0xFF, (i >> 24) & 0xFF];
      }

      function u16ToArray(i) {
        return [i & 0xFF, (i >> 8) & 0xFF];
      }

      function split16bitArray(data) {
        var r = [];
        var j = 0;
        var len = data.length;
        for(var i = 0; i < len; i++) {
          r[j++] = data[i] & 0xFF;
          r[j++] = (data[i] >> 8) & 0xFF;
        }
        return r;
      }

      this.Make = function(data) {
        if(data instanceof Array) this.data = data;
        this.header.blockAlign = (this.header.numChannels * this.header.bitsPerSample) >> 3;
        this.header.byteRate = this.header.blockAlign * this.sampleRate;
        this.header.subChunk2Size = this.data.length * (this.header.bitsPerSample >> 3);
        this.header.chunkSize = 36 + this.header.subChunk2Size;

        this.wav = this.header.chunkId.concat(
            u32ToArray(this.header.chunkSize),
            this.header.format,
            this.header.subChunk1Id,
            u32ToArray(this.header.subChunk1Size),
            u16ToArray(this.header.audioFormat),
            u16ToArray(this.header.numChannels),
            u32ToArray(this.header.sampleRate),
            u32ToArray(this.header.byteRate),
            u16ToArray(this.header.blockAlign),
            u16ToArray(this.header.bitsPerSample),
            this.header.subChunk2Id,
            u32ToArray(this.header.subChunk2Size),
            (this.header.bitsPerSample == 16) ? split16bitArray(this.data) : this.data
        );
        this.dataURI = 'data:audio/wav;base64,' + FastBase64.Encode(this.wav);
      };

      if(data instanceof Array) this.Make(data);

    }; // end RIFFWAVE



    var Base64Binary = {
      _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

      /* will return a  Uint8Array type */
      decodeArrayBuffer: function(input) {
        var bytes = (input.length / 4) * 3;
        var ab = new ArrayBuffer(bytes);
        this.decode(input, ab);

        return ab;
      },

      decode: function(input, arrayBuffer) {
        //get last chars to see if are valid
        var lkey1 = this._keyStr.indexOf(input.charAt(input.length - 1));
        var lkey2 = this._keyStr.indexOf(input.charAt(input.length - 2));

        var bytes = (input.length / 4) * 3;
        if(lkey1 == 64) bytes--; //padding chars, so skip
        if(lkey2 == 64) bytes--; //padding chars, so skip

        var uarray;
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        var j = 0;

        if(arrayBuffer)
          uarray = new Uint8Array(arrayBuffer);
        else
          uarray = new Uint8Array(bytes);

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        for(i = 0; i < bytes; i += 3) {
          //get the 3 octects in 4 ascii chars
          enc1 = this._keyStr.indexOf(input.charAt(j++));
          enc2 = this._keyStr.indexOf(input.charAt(j++));
          enc3 = this._keyStr.indexOf(input.charAt(j++));
          enc4 = this._keyStr.indexOf(input.charAt(j++));

          chr1 = (enc1 << 2) | (enc2 >> 4);
          chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
          chr3 = ((enc3 & 3) << 6) | enc4;

          uarray[i] = chr1;
          if(enc3 != 64) uarray[i + 1] = chr2;
          if(enc4 != 64) uarray[i + 2] = chr3;
        }

        return uarray;
      }
    };

    //sound: sound data used for testing
    //var sound = "UklGRnqOAABXQVZFZm10IBAAAAABAAEAIlYAACJWAAABAAgAZGF0YVWOAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBgYKAgIKBgIGBgIF/f4KBf4CAgIGBgIGBgIGBf4CAf4CAf4CAfoCAf39/f4CAfn+BgYB/f4CAf3+Af3+AgICAgICAgICAf3+AgICBgICCgX+AgYGCgH+AgICBgICBgICBgoCBgYGBgH+AgH+AgH9/gICAf36AgX9+f4CAgH+AgH9/f4CAgH+AgIB/gICAgIB/f3+AgYCAgYGBgICBgYCAgIF/f4CBgYCAgIGBgYGBgoGBgH+AgICAf39/f39+f39/f39/gICAgYGBgICBgYCBgYCBgYGBgoKBgoGAgYB/gH9/gH9+fn9/f39/f399f4GAgICAgYGCgoKCgoKBgYCAgH9/f39+fn5+f35+f39/f4GBgYGAgIGBgIGBgIGCgYGBgoKCgYGBgICAgIB/fn9/fn5+fn9/fn5+foCAf4CAgIKDg4SFhISEgoGBf3+Afn19fX19e3p8fX1+fn6AgH6AgICBf3+BgYGDg4SGhoWEg4KCgoGCgn9+fXt7enl7fHx8fXx8fn+AgoOEhoWGiIeIiIWEhIGBgYKBgHt2d3VwcHR5eXd5fHh0dnV1en6BhIeHh4aEg4GAgoGAg4aEhIaDfXt5d3Z2eHyBg4KBgYB9foSHio+RkZKRkI+Mi4uJh4iHhYOBfHd0bmtrampucXJxcnBtbm9xdHp+gYOGhYaHhYWGh4iJioyNi4mHgn16eHd5fH2Ag4SBf4B/gYWIi4+TkZCSko+PkI+OjIqJh4OBfXZwbWloaGhqbW1rbGxra21xdHd8f4CCgoKDhIOGiYmKjY2Mi4mIhoF/gH9/gYOFhoWEg4GBhIiLjY6Qko+NjoyLi4mIiIaEg4F+eHJua2hmaGlrbW1ubmxsbm5wdHd5fYCBgoOChYiHiYyMjY6NjIqGhIKBgIGDhYiJiYiGhoaFiIyPkZOTk5KQj46MiomHhIOCf3x4c25qZ2NiZWdnaGpramlqbnBydXp9foGDg4WGhoiLi4yOkJCPjouIhYOCgYKDhomKiYqJh4eHiY2Oj5GRkJCPjYuKiIaFg4KCf3t5dG9raGZmZmhra2pqaWhqbG1ydnl9f4GDg4OFhoeJi4yPkpKSkY6MiYeFhYaIiImKiYiIh4WGiYqMjY2NjYuKiYaFhIKBgYB/fXp4dHBsamloaGptbmxrbGtrbW9yd3l7fX+BgoSFhoiJi42OkZOTk5CNi4iGhoiJiouLjIqIiIeGh4mJiouKiYqJh4WDgoGAf39/fHp3c29raGdnaGpsa2pra2trbXBzdHh7fYCChIeIiImKjI2PkZKTkpCNioeGhoaGh4mJiIeGhoaFh4mJiImJiYmJiIaEgoGAgIB/fXt3cm9raGdnZ2lqampramttbm9ydXl7fYGFhoiKiouLjY+Rk5SVlJGOi4mIhoeIiIiKiYiGhYWGh4eHh4iIiYiIh4SDgX9+fn1+fHp4c25samhoaWlra2lrbGxucHFzdnh6foCEhoiJioqLjo6Rk5SUk5COjImIiIiHiIiJiYaGhoWEhYaGhoaGh4aFhYOBgH9+fn19fXp2cm9sa2ppa2xsbGxrbG5wcnN0d3p8f4KFh4mJiouLjZCSlJSTkpCNi4mIiIiHhoeGhISEg4OEhYaGhoeGhoeGhIOCgIB/f4CAfXp3c3Fua2tra2xtbGtsbW5wcXN1d3l8f4KFh4mKioqMj5GTlZWUko6MiomJiIeHhoaFhISFhIODhISFhYaHh4aHhYKBgYCAgIB/fHl3dHFubWxsbGxsbWxrbW5vcXJ1d3p8f4KEh4mKioqMj5CSlJWTkY6Mi4mIiYiHhoaFhISFhYSDhIWEhYaGh4aGhIKBgIGCgYB/fXp3dHFvbm1sbGxtbWxtbm9wcnN1d3l7f4KEhoiJiouMjpCRlJSSkY6Li4mHiYiGhYSDhISDhISCg4SDg4WFhoeFg4GAgIGBgYB/fHt3dHJwb25tbGxsbG1tbW9xcnN0dnp8foKEhYeJiYqMjpCSk5OTkY6MiomJiIeGhYODg4SFhISDhISDhIaGh4eGg4GBgoGCgoKBfnt4dXNycW9tbWxtbWxtbm9wcnJzdnl8f4KEhYaHiImLjo+Rk5KRkI6Ni4mJiIeFhYSEhISEhIOCg4SDhYaGhoaGg4GBgYGCgoGAfXp3dHNxcG9ubWxtbW1ub3BxcXJ0dnl8f4KDhIWGiImMj5CRkpKRkI6Ni4mIiIaFhIWFhYSEg4KCg4OEhYWGhYWFhIKBgYCBgYGAfXp3dXJxcW9ubW1tbW1ucHFycnN0d3l9gIOEhYaGiImMkJGSkpKQkI6NjIqJh4aEhISFhISEgoGAgoOEhoaFhYWFhIKBgoKBgYKAfXx4dXRycXBvbm5tbW5vcHFycnN0dnp9f4KEhIaGh4mMj5GSkpGRkI+OjIuKh4aEg4SFhYWEgoCAgoOEhYaFhYSEgoGCg4KBgYB/fXt5dnNxcW9ubW1ubW1ub29xcnJ0d3l7foCCg4SEhoiLjo+RkpGPj46NjIuKiIaEhIWFhYWEgoGAgoOEhYaGhYSDgYGCg4OCgIB/fXt5d3VycXBubW5ubm9vb3Byc3R2eHp9f4GCg4SFh4mMj5CRk5KRkI+NjYyKiYeGhYaGhYWEg4KBg4OEhYaGhYSCgYGCg4OCgIB+e3p4dnRycG9tbG1ubm9vb29xcnR2eHt9f4CBgoSGh4mMjo+RkpGQj46NjIuJiIaFhYWFhISEgoGBgoOEhYaFhIOCgYGCgoKBgX99e3t4dnVzcW9tbW5vb29wb3BycnR3enx+f4CBgoSGiIqMjo+QkZGQj4+OjIqJiIaGhYWFhISDgYCBgoKEhYSDg4KCgYGBgoKBgH9+fHt5d3VzcnBubm5vb29wcHBycnR3enx+f4CAgoSGiIqMj4+QkZGQkI+OjIuJiIeFhYWFhISDgYCAg4SEhYSDg4KBgYGBgoGAf39+fHt5d3VzcXBubm9vb29wb3Fyc3V3en1+f4CBgoSGiIqNjo+QkJCRkI+OjIuKiIeGhoaGhYSDgYCChISEhIODgoGBgYGCgoF/f39+fHt5d3VzcXBvbnBwb29wb3BzdHV4enx+f3+Bg4SGiYqNjo+QkZGRkI6OjIqKiIaGhYaGhIOCgYCCg4OEhIOCgYCAgICBgYB/f359fHt5d3Rycm9ub3BwcG9vcHFzdXZ5e31+f4CBg4WGiouNjo+QkpKRkI+OjIuJiIeGhoaFg4KBgICBg4ODg4KBgICAgICAgIB+fn59fHt4d3VycHBvb3Bwb29wcHF0dXd6fH1+gIGChIaHiYuNjo+RkpKSkY+OjIqJiIeGhYWEg4KBgICBg4ODg4GBgICAgICAgIB/fn59fHt5d3VycHBvcHBwcG9vcHF0dnh6fH1+gIGChIaHiouMjo+QkpKRkI+Ni4qJiIeGhYSDgoKBgICBgoKCgoGAgIB/f4CAgIB/fn59fHt5d3VzcXBwcHFxcHBwcHJ1d3l7fX5/gIGChYeIiouMjo+RkpKRkI6Ni4mJiIeGhISCgoGAgICBgoKCgYCAgICAgICAgIB/f39+fXx5dnVzcXFxcHFxcHBwcXN2d3l7fX1/gIGDhIaHiouMjY+QkZGQj42MiomIh4eFhISCgYGAgICBgoGBgYB/f4CAgICAgIB/f39+fXt4dnRycXFxcHFwb29xcXN2d3l7fH5/gIKDhIaIiouMjY+QkZGRj42Ni4qJh4eFhISCgYGBgYGCgoGBgX+Af4CBgIGBgIB/f4B/fXx5dnRzcnJycXFwb29xcnR3eHl7fH1/gIKDhYaIioqMjY+RkZCQj42Mi4mJiIaFhIOCgYCAgYCBgYCAgH9/f3+AgICAgH9/gIB/fXt4dnVzc3JxcnFwb29xc3V3eHl7fH5/gIGDhIaIiYmMjY6QkZCPjo2Mi4mIh4aEg4KBgICAgICAgYB/f39/fn+AgICAgICAgYF/fXt5d3Z0c3NycnJxcHFyc3Z4eXp8fX5/gIGDhYaHiYmLjY6PkJCPjYyLioqJh4aEgoKBgYGBgICBgYCAf35/f4CAgICAgYGBgYF/fXx5d3Z1dHNzcnFxcHFydHZ4eXt8fX5+gIKDhIaHiIqMjY6Pj4+PjYyLiomJh4WEgoGBgYCAgICBgH9/f36AgICAgICAgYGCgoGAfnt5eHZ1dHNycXFxcHBydHV4eXp7fX1+gIGDhYWGiYqMjY6PkI+OjYyLioqIh4WDgoGBgYCAgICAgH9/f39/gICAgIGAgYKCgoKAfnx5eHd1dHRycXFwcHFydHZ4eXp7fH1+gIKDhIWGiIqMjY6Pj46NjIuLiomIhoSDgoGBgICAgH+AgH9/f39/f4CAgICBgoKCgoGAfnx6eHd2dXRzcnJxcHFzdXd4eXp7fH1/gYKDhIWGiIqMjY6Pjo2Mi4uLiomIhoOCgoGAgICAgH9/f39/f39/gICAf4CBgoKCgoJ/fnx6eXh3dnZzdHNxcnN0c3l4eXp8fX6AgIOChIWFiImMjI6OjYyLi4mKiomHhYSAgYCAgIGBf39/gH5/gICBgIJ/f4GDgoKDgoJ/f3x8e3h4dnVzcnJxcnFzdXZ3eXp5fH1/f4GCgoSGh4mNjY2PjY2MioqLiomJhoODg4GBgoCAgX+AgICBgYGCgYB/f4CBgYKBgIB+fXt7eXh4dnRzc3JycnR0dnl5e3t8fX1+f4GAgoSFh4mLio2OjY2MjIyNi4yJhoSCgIB/f39/fn1+f36AgYGAf4F/gYCChIOEg4OAf357enl3dHRycXFxcnJydHh3eXt9f3+BgYKCg4WFiIiKiYqKiouKiYmLiYiIhoSBg4GCgYGDgYGBgX+AgH+Afn58f4CBgYGCgYF/f31+fnt8eHdzdHNyc3J1dHV2d3l6f36AgIGCg4WHiYuNjIyOjY2LjIuKiomJhoWDgoF/f3x+fXx8e3x8fn2Af3+BgIGBgoKDg4ODgYB9fHp3dnR0dHVzc3NzdHZ4eXx9fX9+f3+Bg4aJioqKi46QkZKSkY+LiYaDfXt7eXp5eXVzdXh9hIeFh4F+fn2Bg4aGhH97eHR1dXl8fX14c3FwdHl6fXx7fHp8f4OHiYeEgXt7e4CGioqJhoKAg4aHjIyJh4B+fH+DhIaCgHt2c3V5fIGCgHx5eXuBh4qNj4qLjIyOjZCPioaAd3Nyc3NzcW5raGhqa25wcnBxcXF2e4KIjI+MiomHiY2PkZCNioeEgoSGiImGhYSGhoyRk5aUj4mFgYCDhISAfXVyb25ubm1paWViY2Jma3Bydnd1eHp+hImKi4mHh4aJi46PkZCNjIyNkJWZm5yWk46KiImHhoN9d3NwbG1vbGxsamhrb3N6gISGh4WEhYeKjo6Jh4J+fnx8fX9+fX17fX+Dh4qMi4mFhIODhoeIhYSBfXl5eHZ2c3JvbWxtc3d9gYOCgoGDh4uQlJKRj4yKiYqMjIyLiIaGhomMj4+MiIJ+e3l6eHdzb2pnZWRkY2RlZGRjZWpxeYGGiouLjY+TlpmamZmWk5CPjI2OjYuJiYiIiIyQkI+MiYSDgX+AfXx4dXJta2pqZ2dlZGNhY2ZrcXd4eXl6fYCFhomLjIyKi4qMjpCRkJCNkJGTlpeXlZOPjImGgoB+eXZzcW9tbGxsbG1tbW1wdHd+goWHh4iJi4uNjY2MioiFg4CBgoKAfnx7fn+Cg4WGhIOBgH9/gH5/fHt4dnV0dXNzcnFxcXN2eXx+gIKDhIeIiouMjIyNjIyKiYmJiYuKiIiKi4uMioiGgoB8eXZ0cm9tamdlZGNjZGRlZWZobXJ4foSIjI+QkpWWmJqal5eWk5GQjouKiIaEg4aHiYuLiomHhoaFg4J/fXx6eHVycW9ua2poZ2doa21wcnV3en1+gYOHiIuLjIyLjYyMjY2PjY2Ljo6PkJCRj42LioiEgn59enh2dHBvcG9vbmxsbnBzeXp+gISHiIqKjI6NjoyMiYiGhIKAfnx7eXp8fX5/gICCgYKCgYCAf35/fn18eXd3d3V1dHR1dXd5enx9gYSFh4qIioyOj46Ni4yMjIyKiomIh4mKioqJiIeFgoB+end1cm9ta2pqaGdnZWRlaGpscHR4fYGFiY2OkZKSlJaWlpWTkY+NioiFhISEhYaHh4aHiYmHhoOCgYB+fHp4d3V0cnFubGtrbGxtbW9ydHd4e31/gYGDhIeIiYmJiYiIiYmKi4uNj4+Rj5CRkZCNioWEgX58eHd1dXNxcG1tbm9ycnN1eXyAg4aHiIqLjIyMjIuLiYmGg4B/fn18ent9fn9/gYKDg4SCgYB/f39+fHx8enl3dXR1dXh4eHl4en2Ag4SFh4mKi4uMjY6Pjo6LiYmIiYmIhoiHh4eHiIaEgoB9eXZ0cnBubGtpZ2dmZWZna21vcXR3fYKFiYyMj5GTlJSVlJaVko+LiIaGh4aFhYSEhYaIiIeHhoSCgH59fXt6d3VxcG5tbWxubm5ub3F0dnl8fX6AgYSFhoaIiYqKiYeHiImMjIyNjI6PkJGRkI6MiYaDfnx6eHh2c29ubWxubnBycnR2eX1/g4eJioqKjI2NjI2MioeEgH5+fX59e3t7fH5+gIKCgYGAf35+fX59fH17d3Z2dXZ3eHl4eXp8fX6Bg4WGh4iIiouMjo6OjYyJh4iIiYmHhoeGh4aHh4aEgX97d3V0c3FwbmxoZmZmaGlrbm5wdHh8gISIi42PkJGTlJaWl5WTkIyKiYiHh4SEhYSFhIWGhoaGhIF/f35+fXx6d3RxcW9vcG9xbm9vcHN0eHp8fn+AgYOFiImKiomHhoaHiYqLiYqLi42Njo6OjYuJhYOAfn18enZ0cG5ubW1ub3Fyc3Z5e3+BhYeJiouLjY6PkI6NioaEgIB/f358fHx8fX5+gIGBgH99e3x8fX5+fHl3dXZ2dXZ3eHh4ent8f4GChISFhoeIi42Ojo2Mi4qJiYmIiIiGhoeGh4eHhoWCgH15d3Z1dHJvbGloaGhoaWpsb3BydXl+goaJi42Nj5KWl5iXlZORj4yLiomIhoSEg4OEhIWGhYSCgoB/gH9/fXt4dXRzc3JxcXFxcXJzdHd5e31+fn+Ag4eJioqKiIiHhoaGh4mIiIiJiYqKjI2LiYeFgoGBfn15d3Rxb21ubW5ucHJzdXh7f4KFh4iJiIqMj5GQj42KiIWDgIB+fn17ent7fH1+f39+fHx7e319fXx7eXh3dnd3d3h4enp7fH6Bg4SFhoWGh4iLjY6NjoyLiomIiYmIiIaFhYSGhoeGhoOAfXt6eXh2c3BubGtqamppbGxub3F0eHyAhIaHiYuNj5OUlZWUlJKQjYuJiIeFg4KBgIGBgoODg4GAf3+AgIB9e3l3dXRzc3JycnNycXN1d3p8fHx9foGChoiIiYmJiIeGhYaGhoaFhYaHiIqLi4uKiIeGhYWDgH17eHVzcnBwb3Fxc3R0d3t/goSGh4iJiYyOkJCPjoyKh4SCgIB/fnx5enp7fX5/fn59fH19fn59fHt6eHd3dnd3eHh5enp9f4GDhISFhYWHiYqLjIyLjIqKiIiHh4eGhYOEhISGhoeFg4F/fnx7enh1dHFubGpqa2tqbG1ucHN3en6Ag4WGiYuOkJKUlJSSkpCOjIqKiIWDgYCBgYKDgoOBgICAgYGBgH98e3l2dXR1c3JzcnNzdHZ4eHt8fH1+gIKEhoeHh4iHhoWEhISFg4OCgoWHiImKiYmIh4eHhoWEgX57eHVzc3JxcHFxcnR3en1/goOEhoeJi42Pj46NjIqIhoOBgX59e3p4enx9fn5+fn19f39+gH9+fXt6d3d3eHh3d3d5en1/gYKEg4SFhYaIiouLi4qKiImIh4eGhoWEgoKEhoeHhoaEgoGBf359e3l3dHFvbW1tbWxrbG5xc3d6fH6AgoSGiIyNkJGSkpGRkI+NjIqIhoSDgYKDg4ODg4GAgIGBgYGBgH58enh3dnZ2dHNycnR1d3h5eXp7fH1/gYOEhoeGhYWGhoaFg4KBgoKChIaHiImIiIiHh4eGhoWCgH16d3V0c3Jwb29wcnV4e31+gIGDhoeKi42Pj46MiomIh4WBf317e3p7fH1+fn59fX1+f4CAgH59e3p5eXh3d3Z1dnd5e36BgYGCg4SGh4iKiYuLioqJiIiIh4WEgoOCg4WGhoeHh4aEgoGBgH9/fHl2dHJxcG5ubGtsbXBydXh7fH1/gYSGioyNj4+Qj4+Ojo6MioiFg4ODhIWEhIODgoKCgYGBgoKBf3x7e3p5d3Z0cnNzdXV2d3l6ent7fH6Bg4SFhYWFhoaGhYODgoGAgIGChoeHh4eHh4eHiIiHh4WCf3x7enh2dHBub3BydHV4enx+f4GDhYmMjY2NjIyMjIqHhIKAfnx8e3t9fn9/fn5+f39/gH+AgH58enp5eHh2dXN0dXh6fH6AgYKDg4SFiIqLi4qJiYmKiYmGhIOCgYKCg4WHh4iGhYWFhIODgH9+e3p4dXNycG5tbGtsb3J0dXd6e36AgoSGiYyNjo6Ojo+PjoyKh4aFhIODhIaGhoWDgoKCg4ODgYB/fn17enp3dnVzcnJzdXZ4eHl4eXt9f4CCg4SFhYWGhoeGhYKAgH+BgYKDhYaHiIiHh4eIiYiHhoSCgH58enZ0dHJwb3BzdHd5ent8f4GEh4mKi42MjIyMi4mHhIB+fHx9fX5/f4CAgH9/f4CBgYB/fn59fXt5dnV1dHN0dXd5e35/gICChIaIiYmJiouKioqJiIeFgoGAgIGChIWGh4eHhoaFhISDgX99fHp4d3Rxb25sa2ttb3Fzdnh5enyAg4aIiYmLjI2Pj4+NjYqIhoSDhIWFhoaFhYWFhYWDg4OCgYCAfn18enl2dXRyc3N0dXZ3eXl5enx+gIKDg4OEhoeHh4aFhIGAfn6AgYOEhoaFhoeIiIiIiIeGhoWDgH99e3d0cnFwcXN0dXZ4ent+gIGFhomJiouMjo2NioiFgX9+fHx9fX6AgH9/gIGBgYGBgICAgH9+fXx6eHZ0c3J0dnh6e3x+gIGChIaHiImJiYqLi4yKh4WCf39+f4CCg4SFhYaGh4eGhYSCgYGAfnt5eHZycG5tbG1vcHJ0dnd5fH6AgoWHiImKi42Njo6MioeEg4KDg4SEhYWFhISFhoaEg4OBgYGAf358enh2dHNzc3R2dnZ2eHl6fH1/gIGCg4WFh4iHh4aDgH9+fn+AgIGDhIWGhoaIiIiIh4aGhoWDgX98end1c3Jyc3R1dnd4eXt+gIKDhYeHiYuMjY2MioeDgH99fn5+fn5/f4CBgYKBgoKBgICAgYB/fXt5dnV0dHR1d3h5e3x+gIKDhIWGh4iJiouLjIuJh4SBf39/gICBgYOEhYaGh4aGhoSDgYGAf317eHVycXBvb3BxcnN1dnh6fX+Bg4OGh4mKjI2NjYuKiIWEg4ODg4ODhISFhoaFhYWFhIOCgoKBf357end1dHN0dXV2d3d4eXp7fH5/gIGCg4WGiIiHhoSCgH5/fn+AgIGCg4SGh4eHh4eHh4aHhoWEgn57eHZ2dHR0dHV2d3h6e3x+f4GChIWHioqMjIyKiIaDgX9+fn1+fX5/f4GCgoKBgYKBgYGBgYB/fXp4dXV1dXV2d3h5fH1+f4CChIWGh4eJi4yMi4qHhoSCgYB/f3+AgYKDhIWGhoWFhYSDg4KBf316eHVycXBwcHBycnR1d3h5e32AgoOFhomKjI2Mi4qIh4aFhIODgoKDg4SEhYaGhYWEhISDhIOBf3x6eHZ1dHR1dXZ3d3h5enp7fH1/gIKDhYaHiIeGhYSCgIB/f39/f4GCg4SFhoaHhoaGhoaHh4WDgH17eHd1dXV1dnd3eHl6e3x9foCBg4WHiYqLi4qJh4WDgYB/fn19fn9/gIGBgoGBgYGBgoKCgYB9e3l4d3Z1dnZ3eHl7fH1+gICBgoOFhoiKi4uKiomIhYSCgYGAf39/gYKDg4SFhYWFhISEhIOBgHx6d3V0c3JxcnJzdHV3eHp6fH1/gIKGh4mKi4uLi4mIh4WFhIODgoGDhISEhYWFhYWFhYSFhIOBfnt5d3Z1dXR1dXZ4eHl6ent7fH1+gIKDhYaHh4eGhYSCgICAf39/f4GCg4SFhYWFhYaHh4eHhoSBf3x6eHd3dnZ2d3h4enp7e3x9fX+Bg4SHiImJiYmIh4WDgoCAf35+f39/gIGBgYGBgYKCg4KCgH99e3l3d3d3dnd4eXp7fX5+f3+AgYOEhoiJioqKiYmHhYSCgYCAf3+AgIGCgoKDg4SEhYWFhIOBf316eHZ1dHN0dHR1dnh4eXp6e3x/gIKEhoiJioqKiYiIhoWEg4KCgoKCgoODhIOEhISFhYaFhIKAfnx6d3Z2dnZ2dnd5ent7e3t7fH5/gIKDhIaGhoaFhISCgYB/f3+AgIGCgoKDhISEhYaHiIiHhoOBf3x6eXh3d3d3eHl6e3x8fHx9fn+Bg4SGh4iJiYiHhoWEg4GAgH9/gICAgICAgYGBgoKDg4OBgH58e3p4eHd3d3h5ent8fX5+fn+AgYKEhYeHiImJiYeGhYSDgoGAgICBgYGBgYGCg4SEhIWFhIOBf3x7eXd2dXR1dXZ3eHl5eXp7e31+gIOEhoaIiYmJiIeGhYWEg4KCgoKCgoKCgoKDhISEhYWFhIKAfXt6eXh2dnZ3eHl6e3t7e3x8fX1/gYKDhIWFhYaFhIOBgIB/gH+AgYGBgYKCgoODhYaGhoeGhYOAfnx6eXh3d3d5enp7e3t7fH19fn+Bg4SFhoaHh4iHhoSCgoGAgIB/gICAf39/f4CBgoOCgoKBf399e3l5eXh4eHl6e3x9fX1+f3+AgYKDhYaHh4iIiIiGhYOCgoGBgICAgYGBgYCBgoOFhYWEhIKBf316eXh3dnV2dnd4eXl5eXp7fH5/gIKEhoaIiIiJiYiGhYWEhISDg4OCgoKBgoKCg4WEhYWEg4KAfnx6eXh4eHh4eXp7fHx8fHx9fX5/gIKDhIWFhYWFhIOCgYCAgYGBgYGBgYGCgoKDhIaGh4aFhIKBfn17enl5eXl6ent8e3x8fHx+foCBgoOEhoaHh4eGhISCgoGAgYCBgH9/f39/f4CBgoKDg4KBgH99fHp6eXl5enp7fHx+fn5+fn+AgYKDg4SFhoeHh4aFhIOCgoGBgYGBgICAgIGBgoKDg4SEg4KAfn18enh3d3d3eHh4eHl6ent7fH1/gYKDhIWGh4iHh4aGhYWEg4ODg4OCgYCAgIGCgoKDg4SDgoF/fnx7enl4eHl6enp6e3x7e3x8fX6AgIGCg4SFhYSEg4KCgoGBgYGBgoGBgYGBgoODhISFhoaGhIKAfn18enl5eXp6e3p7e3t8fH1+foCBgoOEhYaHhoaFhISDgoGBgYCBgIB/f35/gICAgYGCg4KCgH9+fXx7e3p7e3x8fH19fX5/gICAgYKCg4SFhYaGhoWEg4KCgoGBgIGBgYGAgICBgoKDg4SDg4KAf318e3p5eHh4eXl5enp6enx9fn+AgYKDhIWGhoeHh4aFhYSFhISDgoKBgYGAgICBgYKCgoODgoGAfn18e3t7enp7e3t8fHt8fHx9fX5/gIGCg4ODhISEg4KCgYGCgYKCgoGBgYGBgYGCg4SEhYWFhIKAf318e3p6ent7ent7e3t7fH5+f4CBgoOEhYWGhYWFhIOCgoKBgYCAgICAf39+fn+AgYGCgoKBgH9+fXx7e3t7e3x8fX19fX5/gICBgYKCg4OEhISEhISCgoGBgoKCgYGBgYGBgYGBgYGCgoODgoGAfn17e3p6enp6eXl5ent7e3x9fn+AgYKDhIWFhoWGhYWFhISEhISDg4KCgYCAgH+AgIGBgYKCgYGAfn19fHx8fH18fHx8fHx8fH19fn+AgIGBgoODg4KCgoGCgoKCgoKCgoKCgYGBgYGBgoOEhIWEg4KAf359fHt7e3t7e3t7e3t7fH1+gIGBgoOEhIWFhYWEg4ODgoKBgYGBgIB/f39/f39/gIGCgoKBgH9+fn19fX19fX19fX5+fn5/f4CBgoKDg4ODg4SDg4KCgoGBgYGBgoKCgoGBgYGBgYKCgoOCgoGAfn18e3p6enp6enp6e3p7fHx9fn+BgoODhISFhYWFhYSEhISFhISDg4OCgYCAf39/f4CAgYGBgIB/fn19fXx8fH19fX19fXx8fH19fn9/gIGBgYKCgoKCgoGBgoKCgoKCgoKCgYGBgYGBgoKDhISEg4GAf35+fXx8e3t7e3t7e3t7fH1+f4CCg4ODhISEhIWDg4KCgoGBgYGAf39+fn5+fn9/gICBgYKBgIB/fn5+fn5+fX5+fX5+fn+AgICBgoKDg4ODgoKCgoGBgYCAgYGBgYGCgYGBgYCBgYKCg4OCgoCAfn18fHt7e3t7e3t7e3t7fH1+f4CBgoODhISEhYSFhISEhISEhISEg4KCgYB/f39/f3+AgICAgH9+fn5+fX19fn5+fn5+fX19fX1+fn+AgIGBgYGBgoKCgYGBgYKCg4ODgoKCgYGBgYGCgoODg4SDgoGAf399fX18fHt7e3t7e3t7fX1+gICCgoOEhISEhISEg4OCgoKBgYCAf39+fn19fn+AgIGBgYGBgH9/fn5/fn5+fn5+fn5+fn+AgIGBgoKCgoOCgoKBgYCAgH+AgIGBgYCAgYGBgICBgoKDg4OCgYF/fn18e3t8e3t7e3t7fHx8fX5+gIGBgoOEhISEhISEhIODg4ODg4SDgoGBgH9/fn5/f3+AgICAf39+fX19fn5+fn5+fn5+f35+fn5+f4B/gICBgYGBgYGBgYGBgYGCgoOCgoKBgYGBgYKCgoODhIODgoGAf35+fX19fHx7e3t7e3t8fH5/gIGBgoODhISEhISDg4OCgoGBgYCAf35+fn5+f3+AgIGCgYGBgH9/f39+f39/f35+fn5/f4CAgYGCgoOCgoKCgoGBgYCAgH9/gICAgYCAgICAgYGCgoODg4SDgoB/fn18fHx7e3t8e3t8fHx9fn+AgIGCg4ODhISEhYSEg4OCg4ODg4OCgYGAf39+fn9/f3+AgICAf359fX19fn1+fn5/f39/f39/gH9/f3+AgIGAgIGBgYGAgICAgYGBgoKBgYGBgYGBgoKDg4ODg4ODgoB/f35+fX18fHx8fHt7e3x9fn5/f4CBgoODhISEhISDg4KCgoGAgH9+fn5+fX5+fn+AgYGBgYGBgH9/f39/f39/f39/f3+AgIGBgoKCgoKCgoKBgYGBgYCAf39/f3+Af39/f4CAgIGCg4OEhIODgoF/fn18e3t7e3x7e3t8fX1+f3+AgYKCgoOEhISEhYSEhIODg4OCgoKBgYCAf39/fn5/f4CBgIB/f35+fX19fX1+fn5+f3+AgICAgICAgICAgICAgIGBgYGBgICBgYCBgYGBgYCBgYGCgoKDhISEhIODgoGAf359fX18fHt7fHx9fX19fn5/gIGBgYKDg4SEhISDg4KCgYCAf39+fX19fn5/f4CAgYGCgoGBgIB/f35/f39/f39/gICBgYGCgoKCgoKBgYGBgYGBgIB/f39+fn5+fn5+f3+AgIGCg4SEhISDgoF/fn18e3t7e3t7e3x8fX5/f4CAgYKCg4ODhISFhYSEg4SDg4KBgYGAgH9+fn5+fn9/f4CAgIB/f35+fX18fH19fn5+f3+AgYGBgICAgICAgICAgIGBgYCAgICAgH+AgICAgICAgIGCg4ODhISEhISDgoF/f359fHt7e3t8fHx8fX5+f3+AgICBgYKCg4SEhISEg4KCgX9/f35+fX19fX5/f4CBgYGCgoKBgIB/f39/fn9+f4CAgYGBgoODg4ODgoKCgYGBgYGBgYCAf39+fn59fX1+fn+AgIKCg4SEhISDg4GAf359fHx7e3t7fH19fn9/gIGBgoKDg4OEhISEhYWFhISDgoKBgYCAf35+fn5+fn+AgICAgYCAgH9+fn18fH19fX5/gICAgYGBgoKBgYGBgYCBgIGBgYGBgYCAgH9/f39/f4CAgYGCg4OEhISFhISDgoGAf318fHt7e3t8fH19fn5/f4CAgICBgYKCg4SEhISDgoGBgH9+fn19fX19fX5/f4CBgYKCgoKBgH9/fn5+fX5+f3+AgYGCgoODgoOCgoKCgYGBgYGBgH9/fn19fX18fX19fn5/gIGCgoOEhIODg4GAfn18e3t6e3t7fHx9fn+AgIGBgoKCg4ODg4SFhYWEhIOCgoGAgH9+fn5+fn5+fn5/gICAgICAgH9+fX18fHx8fX5+f4CBgYGCgoKBgoGBgYCBgYGBgYGAgH9/f39/f39/f3+AgYGCgoOEhIWFhYWEg4F/fn19fHx8e3t8fX5+f39/gICBgYGBgoKCg4SEhIODgoGAf39+fn59fX1+fn5/f4GBgoKCg4KCgYB/fn5+f39/f4CAgYKCg4ODg4ODg4KCgoKCgoGBgIB/fn59fX19fX1+fn5/gIGBgoOEhISEg4KBf359fHx7e3t8fH1+f4CAgYGCg4ODg4OEhIWFhYWEg4KCgYCAgH9/fn5+fn5+f39/gICBgYGBgH9+fX18fHx9fX1+f4CAgYKCgoKCgoKBgYGBgYGBgYCAgH9/fn5+f39/f3+AgIGCgoODhISEhISDgoF/fn18fHx7e3x8fH1+fn+AgICBgIGBgYKCg4ODgoKBgYB/fn5+fn59fX19fX5+f4CAgYKCgoKBgH9/fn5+fn5/f4CAgYGCgoODg4ODgoKCgYKBgYGAf35+fX19fX18fX19fX5/gICBgYKDg4SDg4KAf359fHx8fHx8fX1+f4CBgYKCgoKDhISEhISFhYSEg4KBgIB/gH9/f35+fn5+fn9/gICBgYGBgH9+fn19fXx9fX5+f3+AgYKCgoKCgoKCgoKCgoKBgYGAgH9/fn5/fn9/f4CAgYGBgoOEhIWFhISDgoGAf359fXx8fH19fX5+f3+AgYGBgYKCgoKDg4ODgoKBgH9/f39+fn19fn5+fn5/f4CBgoKCgoKBgIB/f39/f39/f4CBgoKCg4ODg4ODg4OCgoKBgYGAf39+fX18fX19fX1+fn5/f4CAgYKCg4ODgoGBf359fX18fXx8fX1/f4CBgYKCgoODg4SEhISEhIODgoKBgIB/f39/fn5/fn5+fn5/gICAgICAf39/fn19fX19fX5+f4CAgYGBgYKCg4KCgoKCgoKBgIB/f39/fn5+fn5/f4CAgIGBgYKCg4SEhIOCgYGAf359fXx8fHx9fn5/f39/gICBgoKCgoKCg4KCgYGAgH9/fn5+fn5+fn1+fn9/f3+AgYGCgoKBgIB/f39+f3+AgICAgYKCg4ODg4ODg4ODgoKCgYB/f39+fn18fHx9fn5+fn5+f4CAgYGCgoKCgoGAgH9+fX18fH19fn5/f4CAgYKCg4ODhISEhIWEhIOCgoGBgICAf39/f39/f35/fn9/f3+AgICAf39+fn5+fX19fX5/gICBgYGCgoKCgoODg4KCgoGBgYCAf39+fn9+f39/gICAgIGBgoKCgoKDhIODgoGAf39+fn19fX5+fn5/f4CAgICBgYKCg4KCgoKBgYGAf39/f35+fn5/f39+fn5/f4CAgYGBgYGBgICAf39/fn9/gIGBgYGCgoODg4ODg4ODgoKBgYCAf359fX19fX19fX1+fn9/f3+AgIGBgYGCgYGAf39+fn19fX19fn9/f4CAgYKCgoKDg4SEhIODg4OCgYGAgICAgH9/f39/f39+fn5/f39/f39/f39+fn59fn19fn5/f4CAgIGBgoKCgoKCgoKCgoGBgYCAf35+fn9/f39/f4CAgICAgYGCgoKCgoOCgoGAf35+fn19fX5+fn9/f3+AgICBgYGBgoKCgoGBgYGAf39/f39/fn5+f39/f35/f4CAgYGBgYGBgYCAf39/f4B/gICBgoKCgoKDg4ODg4KCgoKCgYCAf39+fX19fX19fn1+fn9/f39/gIGBgYGBgYGBgH9+fn5+fn5+fn+AgIGBgYGCg4ODg4ODhISDg4KBgYGBgICAgICAf39/f39/f39/f39/f39/f39/fn59fn5+fn9/f4CBgYGBgYGCgoKCgoKCgoKBgIB/gH9/f39/f39/gH+AgICBgIGBgYKCgoKCgYGAgH9+fn5+fn5+f39/f3+AgICBgYGBgYGCgoKBgYCAgH9/f35/fn5+fn5+f39/f39/gICBgYGAgIB/f39/f3+AgICBgYGCgoODg4ODg4KCgoKCgYGAf39+fn19fX19fX5+fn5/f3+AgICAgYGBgYCAgH9/f35+fn5+f4CAgICBgYGCgoKCgoODg4ODg4KCgYGBgICAgICAf39/f39/f39/f39/f4B/f39+fn5+fn5+fn9/gICAgYGCgoGCgYKCgoKCgoGBgYCAgH9/f39/f39/f3+AgICBgYGBgYKCgoKCgYGAgIB/f35+fn5/f39/gICAgICAgIGBgYGCgoGBgYGAgIB/f39/f35+fn5+fn9/f3+AgICBgYCAgICAf39/f3+AgICBgYGCgoKCgoKCgoKCgoKCgYGAgH9+fn5+fn19fX1+fn5+f39/gICBgYGBgYCAgH9/fn5+fn5+f3+AgICAgYGBgYGCgoKDg4OCgoKCgYGAgICAgICAf39/f39/f39/f3+Af39/f39+fn5+fn5+fn9/gICBgYGBgYGBgYGBgYGBgYGBgYCAgH9/f39/f39/f3+AgICAgIGBgYGCgoKCgYGBgIB/f39/f39/f3+AgICAf4CAgICBgYGBgYGBgYGBgICAgH9/f39/fn5/f39/f4CAgICBgYGBgICAf4CAgICAgICBgYGCgoKCgoKCgoKCgoKCgoGBgIB/f35+fn5+fX5+fn5+fn+AgICBgYGBgYGAgH9/f35+f39/f4CAgICAgYGBgYGCgoKCg4OCgoKBgYGBgYCAgICAgH9/f39/f39/f4B/gIB/f39+fn5+fn5+fn9/gICAgYGBgYKBgYGBgYGCgYGBgYGAgIB/f39/f39/f39/f4CAgIGBgYGCgoKCgYGAgIB/f39/f39/f39/f39/f4CAgICAgYGBgYGBgYGBgYCAgH9/f39/fn5+fn9/f3+AgICBgYCAgIB/gH9/gH+AgICAgYGBgYKCgoKCgoKCgoKCgYGBgIB/f35+fn5+fn59fn5+fn9/f4CBgYKCgYGAgIB/f39/f39/f3+AgICAgYGBgYGBgYKCgoKCgoKCgYGBgYCAgICAgH9/f39/f39/f4CAgICAf39/fn5+fn5+fn9/f4CAgIGBgYGBgYGBgYGBgYGBgYGBgIB/f39/f39/f39/f3+AgICBgYKCgoKCgYGBgIB/f39/f39/f39/f39/f4CAgICAgIGBgYGBgYGBgYGAgICAf39/f39+fn9/f3+AgIGBgIGAgICAgH9/f4CAgICAgIGBgYKCgoKCgoKCgoKCgoKBgYB/f39/fn5+fn5+fn5+fn5/gICBgYKCgYGBgIB/f39/f39/f39/f3+AgICAgYGBgYGCgoKCgoKCgYGBgYCBgICAgIB/f39/f39/gICAgICAgH9/f35+fn5+fn5/f4CAgIGBgYGBgYGBgYGBgYGBgYGAgIB/f39/f39/f39/f39/gICBgYKCgoKCgoGBgIB/f39/f39/f39/f39/gH+AgICAgICBgYGBgYGBgYGAgIB/f39/f39+fn5/f3+AgICAgYGBgICAf39/f39/f4CAgIGBgYGCgoKCgoKCgoKCgoGBgICAf39/fn5+fn5+fn5+fn5/gICBgYKCgoKBgYCAf39/f35+fn9/f39/gICAgYGBgYKCgoKCgoKCgYGBgYCAgICAgIB/f39/f3+AgICAgICAgIB/f39+fn5+fn5+f3+AgIGBgYGBgYGCgoGCgoKBgYCAgIB/f39/f39/f39/f39/gICBgYGCgoKCgoKBgYCAf39/f39/f39/f39/gICAgICAgIGBgYGBgYGBgIGAgICAgH9/f39/f39/f39/gICBgYGAgICAgIB/f39/f3+AgICBgYGCgoKCgoKCgoKCgoGBgYB/f39/fn5+fn5+fX5+fn9/f4CAgYKCgoKBgYGAgH9/fn5+fn5+fn9/gICAgICBgYKCgoKCgoKBgYGBgYGAgICAgICAf39/f39/gICAgICAgICAf39+fn19fX5+f39/gICBgYGBgYKCgoKCgoKBgYCAf39/f39/f39/f39/f39/gICAgYKCgoKCgoKCgYGAf39+fn9+f39/f3+AgICAgICAgYGBgYGBgYGAgICAgICAgICAf39/f39/f39/gICAgYGBgYCAgH9/f39/f3+AgICBgYGCgoKCgoKCgoKCgoGBgIB/f39/f35+fn5+fn5+fn5/f4CBgYKCgoKCgoGBgH9/fn5+fn5+f39/f4CAgIGBgYGBgoKCgoKCgYGBgYGAgICAgICAf39/f39/gICAgICBgYCAgH9/fn59fX5+fn9/gICBgYGBgoKCgoKCgoKBgYCAf39/f39/f39/f39/f39/gICAgYGCgoKDgoKCgYCAf39+fn5+fn9/f39/gICAgICAgYGBgYGBgYCAgICAgICAgICAgIB/f39/f39/gICAgIGBgICAgH9/f35+f39/gICAgYGBgoKCgoKCgoKCgoGBgICAf39/f35+fn5+fn5+fn5/f4CBgYKCgoKCgoGBgIB/fn5+fn5+fn5/f3+AgICBgYGCgoKCgoKBgYGBgYGBgYCAgICAgIB/f39/gICAgYGBgYCAgH9/fn59fX5+fn9/gICBgYGBgoKCgoKCgoKBgYCAf39/f39/f39/f39/f39/gICBgYGCgoKCgoKCgYGAf39+fn5+fn9/f39/gICAgICBgYGBgYGBgYCAgICAgICAgICAgIB/f39/f39/gICAgICAgICAf39/fn5/f39/gICAgYGBgYGCgoKCgoKCgoGBgICAf39/f35+fn5+fn5+fn9/f4CBgYKCgoKCgoGBgH9/f35+fn5+fn5/f39/gICAgYGCgoKCgoKBgYGBgYGAgICAgICAgIB/f4CAgICAgYGBgICAgH9+fn5+fn5+fn9/gICAgYGBgYKCgoKCgoKBgYCAf39/fn5+fn5/f39/f3+AgICBgYKCgoKCgoKCgYCAf39/fn9/f39/f39/f3+AgICBgYGBgYGBgYCAgICAgICAgICAgICAf39/f4CAgICAgICAgIB/f39/f39/f3+AgICAgICAgIGBgYGCgYGBgYCAgICAf39/f39+fn5+fn5+fn9/gICAgICBgYGBgICAgIB/f39+fn5+fn5+f39/gICAgICBgYGBgYGAgICAgICAgICAgICAgIB/gICAgICAgICAgICAf39/fn5+fn5/f39/f4CAgICAgYGBgYGBgYGAgICAf39/f35+fn5+fn9/f3+AgICAgIGBgYGBgYGAgICAgH9/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgH9/gH+AgICAgICAgICAgH9/f39/f39/f39/gICAgICAgICBgYGBgYKBgYCAgICAf39/fn5+fn5+fn5/f3+AgICAgICAgICAgICAgIB/f39/f39/fn5/fn9/gICAgICAgYGBgYCAgICAgICAgICAgICAgICAgICAgICAgICAgIB/f39/fn5+fn9/f39/gICAgICAgICBgYGBgYGAgICAgH9/f35/fn5+fn5/f3+AgICAgIGBgYGBgICAgICAgICAf4B/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAf39/gICAgICAgICAgICAf39/f39/f39/f4CAgICAgICAgICBgYGBgYGBgYCAgICAf39/f35+fn5+fn9/f3+AgICAgIGAgICAgICAgIB/f39/f39/f39/f39/f4CAgICAgYGBgYCAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f35/fn9/f39/f39/gICAgICAgICAgYGBgYGAgICAgH9/f39/fn5+fn9/f39/gICAgICAgICAgICAgICAgICAgICAf39/f39/f39/gICAgICAgICAgICAgICAgICAgH9/f39/f4CAgICAgICAgIB/f39/f39/f39/f4CAgICAgICAgICBgYGBgYGBgYCAgICAf39/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgH9/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f4CAgICAgICAgICAgICAgICAgH9/f39/f4CAgICAgICAgIB/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f39/f4CAgICAgICAgICAgICAgIB/f4B/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f4CAgICAgICAgICAgICAgICAf39/f39/f3+AgICAgICAgICAf39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f39/f4CAgICAgICAgICAgICAgIB/f39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/gICAgICAgICAgICAgICAgICAgH9/f39/f3+AgICAgICAgICAf39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f4CAgICAgICAgICAgICAf3+Af39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgH9/f39/f4CAgICAgICAgICAgICAgICAgICAgIB/f39/f3+AgICAgICAgICAf39/f39/f39/gH9/f4CAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f3+AgICAgICAgICAgICAgIB/f4CAf39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/gICAgICAgICAgICAgICAgICAgICAgH9/f4CAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/gICAgICAgICAf39/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f3+AgICAgICAgICAgICAgH+AgH9/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgIB/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f4CAgICAgICAgIB/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f3+AgICAgICAgICAgICAgICAgH9/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/gICAgICAgICAgICAgICAgH+AgICAgH9/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgIB/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f4B/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIB/gICAgICAgICAgICAgICAgICAgICAf3+AgH+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIB/gICAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAf39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/gICAgICAgICAgICAgICAgICAgIB/f39/f39/f39/f3+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgIB/f39/f39/f3+AgICAgICAgICAgICAgICAgIB/gICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f39/gICAgICAgICAgICAgICAgIB/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f4CAgICAgICAgICAgICAgICAgH9/gH9/f4CAgICAgICAgICAgICAgICAgICAgICAgH9/f39/f4CAgICAgICAgICAgICAgIB/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgH+AgH+AgICAgICAgICAgICAgICAgICAf39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgH9/f39/f39/f4CAgICAgICAgICAgICAgICAgICAf4B/gH+AgICAgICAgICAgICAgICAgICAgICAgH9/f39/gH+AgICAgICAgICAgICAgIB/f39/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAf39/f3+AgICAgICAgICAgICAgICAgICAgH9/f39/f39/f4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAf39/f39/f39/gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAA=";
    var sound = "";
    var effect = []; for(var i = 0; i < 10000; i++) effect[i] = 64 + Math.round(32 * (Math.cos(i * i / 2000) + Math.sin(i * i / 4000)));
    var wave3 = new RIFFWAVE();
    wave3.header.sampleRate = 22000;
    wave3.Make(effect);
    sound = FastBase64.Encode(wave3.wav);

    var myBuffer;
    var arrayBuff = Base64Binary.decodeArrayBuffer(sound);

    if(this.ac) {
      this.ac.decodeAudioData(arrayBuff, function(audioData) {
        myBuffer = audioData;
      });
    }

    this.buffer_list = {};
    this.sound_online_file = this.can_mp3 ? 'media/online.mp3' : (this.can_ogg ? 'media/online.ogg' : 'media/online.wav');
    this.sound_online = new Audio(this.sound_online_file);
    this.sound_online.load();
    this.sound_alert_file = this.can_mp3 ? 'media/alert.mp3' : (this.can_ogg ? 'media/alert.ogg' : 'media/alert.wav');
    this.sound_alert = new Audio(this.sound_alert_file);
    this.sound_alert.load();
    this.sound_ringin_file = this.can_mp3 ? 'media/ringin.mp3' : (this.can_ogg ? 'media/ringin.ogg' : 'media/ringin.wav');
    this.sound_ringin = new Audio(this.sound_ringin_file);
    this.sound_ringin.load();
    this.sound_typing_file = this.can_mp3 ? 'media/type.mp3' : (this.can_ogg ? 'media/type.ogg' : 'media/type.wav');
    this.sound_typing = new Audio(this.sound_typing_file);
    this.sound_typing.load();
    this.sound_speaker_file = this.can_wav ? 'media/speaker.wav' : (this.can_ogg ? 'media/speaker.ogg' : 'media/speaker.mp3');

    this.getUserMediaError = function(e) {
      if(typeof e == 'undefined') return 'undefined error';
      if(typeof e == 'string') return e;
      var str = '';
      if(e.name) str += ' name=' + e.name;
      if(e.code) str += ' code=' + e.code;
      if(e.message) str += ' message=' + e.message;
      if(e.stack) str += ' stack=\n' + e.stack;
      if(str) return str.slice(1);
      return e.toString();
    }

    this.turnOnAudio = function() {
      if(this.ac) {
        if(this.ac.state == 'suspended') {
          this.ac.resume();
        }
      }

      /*
      if(this.audio_turned_on) return;

      this.audio_turned_on = true;

      this.sound_online.load();
      this.sound_alert.load();
      this.sound_ringin.load();
      this.sound_typing.load();

      if(hmtgHelper.isiOS) {
        if(this.ac) {
          var ac = this.ac;
          var src = ac.createBufferSource();
          if(this.webkit_audio) {
            src.start = src.start || src.noteOn;
            src.stop = src.stop || src.noteOff;
          }
          src.buffer = myBuffer;
          var node = ac.createGain();
          src.connect(node);
          node.connect(ac.destination);
          node.gain.value = 0.0;

          src.start(0);
        }
      }
      */
    }
    this.playAudio = function() {
      var ac = this.ac;
      if(ac) {
        var src = ac.createBufferSource();
        if(this.webkit_audio) {
          src.start = src.start || src.noteOn;
          src.stop = src.stop || src.noteOff;
        }
        src.buffer = myBuffer;
        src.connect(ac.destination);

        src.start(0);
      }
    }

    this.playSoundViaAudio = function(file) {
      var ac = this.ac;
      var src = ac.createBufferSource();
      if(this.webkit_audio) {
        src.start = src.start || src.noteOn;
        src.stop = src.stop || src.noteOff;
      }
      if(this.buffer_list[file]) {
        src.buffer = this.buffer_list[file];
        src.connect(ac.destination);
        src.start(0);
      } else {
        var request = new XMLHttpRequest();
        request.open('GET', file, true);
        request.responseType = 'arraybuffer';

        request.onload = function() {
          ac.decodeAudioData(request.response, function(buffer) {
            _hmtgSound.buffer_list[file] = buffer;
            src.buffer = buffer;
            src.connect(ac.destination);
            src.start(0);
          }, function(e) {
          });
        }
        request.send();
      }
    }
    this.playOnlineSound = function() {
      if(this.ac) {
        this.playSoundViaAudio(this.sound_online_file);
      } else {
        this.sound_online.load();
        this.sound_online.play();
      }
    }
    this.playAlertSound = function() {
      if(this.ac) {
        this.playSoundViaAudio(this.sound_alert_file);
      } else {
        this.sound_alert.load();
        this.sound_alert.play();
      }
    }
    this.playRinginSound = function() {
      if(this.ac) {
        this.playSoundViaAudio(this.sound_ringin_file);
      } else {
        this.sound_ringin.load();
        this.sound_ringin.play();
      }
    }
    this.playTypingSound = function() {
      if(this.ac) {
        this.playSoundViaAudio(this.sound_typing_file);
      } else {
        this.sound_typing.load();
        this.sound_typing.play();
      }
    }

    this.ShowErrorPrompt = function(strf, timeout) {
      var item = {};
      item['timeout'] = timeout || 20;
      item['update'] = strf;
      item['text'] = strf();
      item['type'] = 'danger';
      item['jnj'] = '';

      hmtgAlert.add_text_item(item);

      hmtg.util.log("error prompt, '" + item['text'] + "'");
      if(appSetting.play_sound) {
        this.playAlertSound();
      }
    }

    this.ShowInfoPrompt = function(strf, timeout, play_sound) {
      var item = {};
      item['timeout'] = timeout || 20;
      item['update'] = strf;
      item['text'] = strf();
      item['type'] = 'success';
      item['jnj'] = '';

      hmtgAlert.add_text_item(item);
      if(play_sound) {
        this.playAlertSound();
      }
    }

    this.stopStream = function(stream) {
      if(stream.getTracks) {
        var tracks = stream.getTracks();
        if(tracks && tracks[0]) {
          tracks.forEach(function(track) {
            track.stop();
          });
        }  
        //if(tracks && tracks[0] && tracks[0].stop) tracks[0].stop();
      } else if(stream.stop) {
        // deprecated, may be removed in future
        stream.stop();
      }
    }

    setInterval(function() {
      if(hmtgAlert.need_ring()) {
        _hmtgSound.playRinginSound();
      }
    }, 2200);

    if(hmtg.util.isPrivateStorage) {
      _hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_PRIVATE_STORAGE_WARNING') }, 30);
    }
    var m = hmtg.util.checkBrowser();
    if(!_hmtgSound.typeAudioContext) {
      m += (m ? ', ' : '') + 'Web Audio';
    }
    if(!_hmtgSound.typeGUM) {
      m += (m ? ', ' : '') + 'Media Capture Stream';
    }
    if(m != '') {
      _hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_BAD_BROWSER').replace('#feature#', m) }, 30);
    }
    if(/*!_hmtgSound.audio_turned_on && */hmtgHelper.isiOS && this.ac && this.ac.state == 'suspended') {
      var item = {};
      item['timeout'] = 20;
      item['update'] = function() { return $translate.instant('ID_TURN_ON_IOS_AUDIO_PROMPT') };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['click'] = function(index) {
        _hmtgSound.turnOnAudio();
        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);
        hmtgHelper.inside_angular--;
      };

      hmtgAlert.add_link_item(item);
    }

  }
])

;
