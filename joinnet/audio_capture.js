/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('audio_capture', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope', 'hmtgSound', 'audio_codec',
  'video_bitrate', 'joinnetTranscoding',
  function($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope, hmtgSound, audio_codec, video_bitrate,
    joinnetTranscoding) {
    var _audio_capture = this;
    var ac = hmtgSound.ac;
    var local_sample_rate = ac ? ac.sampleRate : 8000;
    this.audio_encode = null;
    this.g711_encoder = null;
    this.opus_encoder = null;
    this.opus_encoder_error = false;
    this.pktno = 0;
    this.last_codec = 0;
    //this.use_silence_detection = true;

    var WORKER_G711_ENCODE_PATH = 'worker/g711_encode.js' + hmtgHelper.cache_param;
    var WORKER_OPUS_ENCODE_PATH = 'worker/opus_encode.js' + hmtgHelper.cache_param;

    // if(0 && hmtgSound.ac.audioWorklet) {
    //   hmtgSound.ac.audioWorklet.addModule('worker/worklet-record.js?p=' + hmtgHelper.cache_param).then(function() { 
    //     hmtg.util.log("Use AudioWorklet for recording");
    //     hmtgSound.recordWorkletReady = true;
    //     create_merge_node();
    //   }).catch(function() { 
    //     create_merge_node();
    //   });
    // } else {
      create_merge_node();
    // }  

    function create_merge_node() {
      if(!hmtgSound.ac) return;
      var ac = hmtgSound.ac;
      var node;
      var bufferLen = hmtgSound.record_buffer_size;
      if(hmtgSound.recordWorkletReady) {
        node = new AudioWorkletNode(hmtgSound.ac, 'worklet-record');
        node.port.postMessage({ command: 'init', good_worker: hmtgHelper.good_worker });
        node.port.onmessage = function(e) {
          if(e.data.command != 'data_out' || !e.data.data) return;
          if(!can_record()) return;

          _audio_capture.audio_encode(_audio_capture.media_type, e.data.data);
        }
      } else if(!ac.createScriptProcessor) {
        node = ac.createJavaScriptNode(bufferLen, 1, 1);
      } else {
        node = ac.createScriptProcessor(bufferLen, 1, 1);
      }

      _audio_capture.merge_node = node;
      if(!hmtgSound.recordWorkletReady) {
        node.onaudioprocess = function(e) {
          if(!can_record()) return;

          var samples = e.inputBuffer.getChannelData(0);
          var data = new Float32Array(samples.length);
          data.set(samples);

          _audio_capture.audio_encode(_audio_capture.media_type, data);
        }
      }  

      hmtgSound.merge_analyser.connect(node);
      node.connect(ac.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.
      var array = new Uint8Array(hmtgSound.merge_analyser.frequencyBinCount);
      function can_record() {
        if(!_audio_capture.audio_encode) {
          return;
        }
        if(!hmtg.jnkernel._jn_bConnected()) return;
        if(!hmtg.jnkernel._jn_bAudioCap()) return;
        if(!hmtg.jnkernel.jn_info_CanSendAudio()) return;
        if((!hmtgSound.shadowRecording || hmtgSound.record_muted)
          && (!joinnetTranscoding.audio_transcoding || joinnetTranscoding.transcoding_muted)) {
          return;
        }
        /*
        if(_audio_capture.use_silence_detection) {
          hmtgSound.merge_analyser.getByteFrequencyData(array);
          var max = Math.max.apply(null, array);
          if(max < 10) {
            return;
          }
        }
        */
        return true;
      }
    }

    this.event_quit_session = function () {
      if(this.g711_encoder) {
        this.g711_encoder.onmessage = null;
        this.g711_encoder.postMessage({ command: 'exit' });
        this.g711_encoder = null;
      }
      if(this.opus_encoder) {
        this.opus_encoder.onmessage = null;
        this.opus_encoder.postMessage({ command: 'exit' });
        this.opus_encoder = null;
      }
    }

    this.change_audio_codec = function () {
      if(audio_codec.audio_codec == this.last_codec) return;
      this.last_codec = audio_codec.audio_codec;

      if(audio_codec.audio_codec == hmtg.config.AUDIO_OPUS) {
        hmtg.util.log('Use 48000 Opus audio');
        this.media_type = hmtg.config.MEDIA_AUDIO_OPUS;
        this.audio_encode = this.opus_encode;
        hmtg.jnkernel._jn_audio_rate(audio_codec.opus_bitrate);
      } else if(audio_codec.audio_codec == hmtg.config.AUDIO_G711) {
        hmtg.util.log('Use G711 50ms');
        this.media_type = hmtg.config.MEDIA_AUDIO_G711_50MS;
        //hmtg.util.log('Use 11K G711 40ms');
        //this.media_type = hmtg.config.MEDIA_AUDIO_G711_11K_89K_40MS;
        this.audio_encode = this.g711_encode;
        hmtg.jnkernel._jn_audio_rate(audio_codec.g711_bitrate);
      } else {
        this.audio_encode = null;
        hmtg.jnkernel._jn_audio_rate(0);
      }

      video_bitrate.update_bitrate();
    }

    this.g711_encode = function (media_type, data) {
      if(!_audio_capture.g711_encoder) {
        try {
          _audio_capture.g711_encoder = new Worker(WORKER_G711_ENCODE_PATH);
          _audio_capture.g711_encoder.addEventListener('error', window.onerrorWorker, false);
          _audio_capture.g711_encoder.postMessage({ command: 'init', sampleRate: local_sample_rate, good_worker: hmtgHelper.good_worker });
        } catch(e) {
          return;
        }
        _audio_capture.g711_encoder.onmessage = function (e) {
          switch(e.data.command) {
            case 'data_out':
              hmtg.jnkernel.jn_command_send_audio_pkt(hmtg.jnkernel.jn_command_write_timestamp_given(
                e.data.media_type == hmtg.config.MEDIA_AUDIO_G711_11K_89K_40MS ? hmtg.config.AUDIO_G726_11 : hmtg.config.AUDIO_G711,
                e.data.data, e.data.ts, _audio_capture.pktno));
              _audio_capture.pktno++;
              break;
            default:
              break;
          }
        }
      }

      //hmtg.util.log("******debug, data_in, size=" + data.length + " ts=" + hmtg.util.GetTickCount());
      if(hmtgHelper.good_worker) {
        _audio_capture.g711_encoder.postMessage({ command: 'data_in', ts: hmtg.util.GetTickCount(), media_type: media_type, data: data }, [data.buffer]);
      } else {
        _audio_capture.g711_encoder.postMessage({ command: 'data_in', ts: hmtg.util.GetTickCount(), media_type: media_type, data: data });
      }
    }

    this.change_opus_bitrate = function() {
      if(hmtg.jnkernel._jn_bConnected()) {
        hmtg.jnkernel._jn_audio_rate(audio_codec.opus_bitrate);
      }  
      video_bitrate.update_bitrate();

      if(!this.opus_encoder) return;
      try {
        this.opus_encoder.postMessage({ command: 'bitrate', bitrate: audio_codec.opus_bitrate });
      } catch(e) {
      }
    }

    this.opus_encode = function (media_type, data) {
      if(!_audio_capture.opus_encoder) {
        try {
          _audio_capture.opus_encoder_error = false;
          _audio_capture.opus_encoder = new Worker(WORKER_OPUS_ENCODE_PATH);
          _audio_capture.opus_encoder.addEventListener('error', window.onerrorWorker, false);
          var bitrate = audio_codec.opus_bitrate;
          var frame_duration = 20;
          if(bitrate < 48000) frame_duration = 60;
          else if(bitrate < 72000) frame_duration = 40;
          else if(bitrate >= 144000) frame_duration = 10;
          _audio_capture.opus_encoder.postMessage({ command: 'init', sampleRate: local_sample_rate, good_worker: hmtgHelper.good_worker,
            frame_duration: frame_duration, bitrate: bitrate
          });
        } catch(e) {
          return;
        }
        _audio_capture.opus_encoder.onmessage = function (e) {
          switch(e.data.command) {
            case 'data_out':
              hmtg.jnkernel.jn_command_send_audio_pkt(hmtg.jnkernel.jn_command_write_timestamp_given(
                hmtg.config.AUDIO_OPUS,
                e.data.data, e.data.ts, _audio_capture.pktno));
              //hmtg.util.log(-2, "******debug, data_out, size=" + e.data.data.length + " ts=" + e.data.ts + " pktno=" + _audio_capture.pktno);
              _audio_capture.pktno++;
              break;
            case 'log':
              hmtg.util.log('opus_encoder: ' + e.data.line);
              break;
            case 'error':
              _audio_capture.opus_encoder_error = true;
              break;
            default:
              break;
          }
        }
      }

      if(_audio_capture.opus_encoder_error) return;

      //hmtg.util.log("******debug, data_in, size=" + data.length + " ts=" + hmtg.util.GetTickCount());
      if(hmtgHelper.good_worker) {
        _audio_capture.opus_encoder.postMessage({ command: 'data_in', ts: hmtg.util.GetTickCount(), data: data }, [data.buffer]);
      } else {
        _audio_capture.opus_encoder.postMessage({ command: 'data_in', ts: hmtg.util.GetTickCount(), data: data });
      }
    }

  }
])

;
