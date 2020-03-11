/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('audio_playback', ['$translate', 'appSetting', 'hmtgHelper', 'hmtgAlert', '$rootScope', 'hmtgSound',
  function ($translate, appSetting, hmtgHelper, hmtgAlert, $rootScope, hmtgSound) {
    var _audio_playback = this;
    var ac = hmtgSound.ac;
    var local_sample_rate = ac ? ac.sampleRate : 8000;
    var buffer_control_size = Math.max((hmtgSound.playback_buffer_size << 1), local_sample_rate);  // ~1s
    this.audio_playback_array = {};
    this.prev_opus = {};
    // stress test
    var stress_num = 0;

    var WORKER_G711_DECODE_PATH = 'worker/g711_decode.js' + hmtgHelper.cache_param;
    var WORKER_OPUS_DECODE_PATH = 'worker/opus_decode.js' + hmtgHelper.cache_param;

    this.event_quit_session = function () {
      for(var ssrc in this.audio_playback_array) {
        if(this.audio_playback_array[ssrc]) {
          this.audio_playback_array[ssrc].decoded_audio_data = [];
          this.audio_playback_array[ssrc].played_size = 0;
          this.audio_playback_array[ssrc].total_size = 0;
          if(hmtgSound.playbackWorkletReady) {
            this.audio_playback_array[ssrc].playback_node.port.postMessage({ command: 'exit' });
          } else {
            this.audio_playback_array[ssrc].playback_node.onaudioprocess = null;
          }  
          this.audio_playback_array[ssrc].playback_node.disconnect();
          this.audio_playback_array[ssrc].playback_node = null;
          if(this.audio_playback_array[ssrc].g711_decoder) {
            this.audio_playback_array[ssrc].g711_decoder.onmessage = null;
            this.audio_playback_array[ssrc].g711_decoder.postMessage({ command: 'exit' });
            this.audio_playback_array[ssrc].g711_decoder = null;
          }
          if(this.audio_playback_array[ssrc].opus_decoder) {
            this.audio_playback_array[ssrc].opus_decoder.onmessage = null;
            this.audio_playback_array[ssrc].opus_decoder.postMessage({ command: 'exit' });
            this.audio_playback_array[ssrc].opus_decoder = null;
          }
          // stress test
          var i;
          for(i = 0; i < stress_num; i++) {
            if(this.audio_playback_array[ssrc].opus_decoder_array[i]) {
              this.audio_playback_array[ssrc].opus_decoder_array[i].onmessage = null;
              this.audio_playback_array[ssrc].opus_decoder_array[i].postMessage({ command: 'exit' });
              this.audio_playback_array[ssrc].opus_decoder_array[i] = null;
            }
          }
          this.audio_playback_array[ssrc] = null;
        }
      }
      this.audio_playback_array = {};

      this.prev_opus = {};
    }

    this.recv_audio = function (data, type, ssrc) {
      if(!ac) return;

      function grab_decoded_audio(ssrc, outData) {
        var idx = 0;
        if(!_audio_playback.audio_playback_array[ssrc]) {
          for(; idx < outData.length; idx++) {
            outData[idx] = 0;
          }
          return;
        }
        var decoded_audio_data = _audio_playback.audio_playback_array[ssrc].decoded_audio_data;
        var played_size = _audio_playback.audio_playback_array[ssrc].played_size;
        var total_size = _audio_playback.audio_playback_array[ssrc].total_size;
        var low_threshold = buffer_control_size;
        if(total_size > low_threshold) {
          //var old = total_size;
          while(total_size > low_threshold * 2) {
            total_size -= decoded_audio_data[0].length - played_size;
            played_size = 0;
            decoded_audio_data.splice(0, 1);
          }
          while(total_size > low_threshold) {
            if(Math.random() >= (total_size / low_threshold - 1)) break;
            total_size -= decoded_audio_data[0].length - played_size;
            played_size = 0;
            decoded_audio_data.splice(0, 1);
          }
          //if(old != total_size) { console.log('(drop ' + (old - total_size) + ' to ' + total_size + ')audio playback buffer size: ' + old); }
        }
        while(decoded_audio_data.length) {
          var to_copy = outData.length - idx;
          if((decoded_audio_data[0].length - played_size) > to_copy) {
            outData.set(decoded_audio_data[0].subarray(played_size, played_size + to_copy), idx);
            idx += to_copy;
            total_size -= to_copy;
            played_size += to_copy;
            break;
          } if((decoded_audio_data[0].length - played_size) == to_copy) {
            outData.set(decoded_audio_data[0].subarray(played_size), idx);
            idx += to_copy;
            total_size -= to_copy;
            played_size = 0;
            decoded_audio_data.splice(0, 1);
            break;
          } else {
            outData.set(decoded_audio_data[0].subarray(played_size), idx);
            idx += decoded_audio_data[0].length - played_size;
            total_size -= decoded_audio_data[0].length - played_size;
            played_size = 0;
            decoded_audio_data.splice(0, 1);
          }
        }
        var copied = idx;
        for(; idx < outData.length; idx++) {
          outData[idx] = 0;
        }
        _audio_playback.audio_playback_array[ssrc].played_size = played_size;
        _audio_playback.audio_playback_array[ssrc].total_size = total_size;
        return copied;
      }

      var audio_playback = this.audio_playback_array[ssrc];
      if(!audio_playback) {
        var playback_node;
        var bufferLen2 = hmtgSound.playback_buffer_size;
        if(hmtgSound.playbackWorkletReady) {
          playback_node = new AudioWorkletNode(hmtgSound.ac, 'worklet-playback');
          playback_node.port.postMessage({ command: 'init', buffer_control_size: buffer_control_size, good_worker: hmtgHelper.good_worker, ssrc: ssrc });
        } else if(!ac.createScriptProcessor) {
          playback_node = ac.createJavaScriptNode(bufferLen2, 0, 1);
        } else {
          playback_node = ac.createScriptProcessor(bufferLen2, 0, 1);
        }
        this.audio_playback_array[ssrc] = {};
        this.audio_playback_array[ssrc].playback_node = playback_node;
        this.audio_playback_array[ssrc].decoded_audio_data = [];
        this.audio_playback_array[ssrc].played_size = 0;
        this.audio_playback_array[ssrc].total_size = 0;
        this.audio_playback_array[ssrc].type = 0;
        // stress test
        this.audio_playback_array[ssrc].opus_decoder_array = [];

        var last_tick = hmtg.util.GetTickCount() - 60000;
        if(!hmtgSound.playbackWorkletReady) {
          playback_node.onaudioprocess = function(e) {
            var outputBuffer = e.outputBuffer;
            var outData = outputBuffer.getChannelData(0);
            var count = grab_decoded_audio(ssrc, outData)
          }
        }  

        playback_node.connect(hmtgSound.create_playback_gain_node()); // Connect to speakers
      }

      var old_type = this.audio_playback_array[ssrc].type
      this.audio_playback_array[ssrc].type = type;
      if(old_type != type && appSetting.restrict_audio_decoding) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_AUDIO_DECODING);
      }
      var first_byte = data.charCodeAt(0);
      switch(type) {
        case hmtg.config.AUDIO_G711:
          if(first_byte == 0) this.g711_decode(hmtg.config.MEDIA_AUDIO_G711_50MS, data, ssrc);
          else if(first_byte == 1) this.g711_decode(hmtg.config.MEDIA_AUDIO_G711_20MS, data, ssrc);
          else if(first_byte == 2) this.g711_decode(hmtg.config.MEDIA_AUDIO_G711_11K_89K_40MS, data, ssrc);
          break;
        case hmtg.config.AUDIO_G726_11:
          if(first_byte == 2) this.g711_decode(hmtg.config.MEDIA_AUDIO_G711_11K_89K_40MS, data, ssrc);
          //else if(media_type == 4) this.g726
          break;
        case hmtg.config.AUDIO_G711_11:
          this.g711_decode(hmtg.config.MEDIA_AUDIO_G711_11K_89K_40MS, data, ssrc);
          break;
        case hmtg.config.AUDIO_OPUS:
          if(appSetting.restrict_audio_decoding && !this.audio_playback_array[ssrc].decoding) {
            return;
          }

          if(first_byte == 0) {
            this.opus_decode(data, ssrc);
            this.prev_opus[ssrc] = this.prev_opus[ssrc] || {};
            this.prev_opus[ssrc].data = null;
          } else {
            var seq = (data.charCodeAt(2) & 0xf) << 8 | data.charCodeAt(3);
            if(this.prev_opus[ssrc] && this.prev_opus[ssrc].data) {
              if(seq - this.prev_opus[ssrc].seq == 1) {
                // for the prev_seq and seq, they can only be in format of
                // 0,1
                // 2,3
                // ...
                // 4094,4095
                this.opus_decode2(this.prev_opus[ssrc].data, data, ssrc);
                this.prev_opus[ssrc].data = null;
              } else if(!(seq & 1)) {
                // web joinnet doesn't support playing half packet
                //this.opus_decode2(this.prev_opus[ssrc].data, null, ssrc);
                this.prev_opus[ssrc].data = data;
                this.prev_opus[ssrc].seq = seq;
              } else {
                //this.opus_decode2(this.prev_opus[ssrc].data, null, ssrc);
                this.opus_decode2(null, data, ssrc);
                this.prev_opus[ssrc].data = null;
              }
            } else if(!(seq & 1)) {
              this.prev_opus[ssrc] = this.prev_opus[ssrc] || {};
              this.prev_opus[ssrc].data = data;
              this.prev_opus[ssrc].seq = seq;
            } else {
              //this.opus_decode2(null, data, ssrc);
            }
          }
          break;
        default:
          return;
      }

    }

    this.g711_decode = function (media_type, data, ssrc) {
      if(!_audio_playback.audio_playback_array[ssrc].g711_decoder) {
        try {
          _audio_playback.audio_playback_array[ssrc].g711_decoder = new Worker(WORKER_G711_DECODE_PATH);
          _audio_playback.audio_playback_array[ssrc].g711_decoder.addEventListener('error', window.onerrorWorker, false);
          _audio_playback.audio_playback_array[ssrc].g711_decoder.postMessage({ command: 'init', sampleRate: local_sample_rate, good_worker: hmtgHelper.good_worker });
        } catch(e) {
          hmtg.jnkernel.jn_command_UnknownMedia(hmtg.config.AUDIO_G711, ssrc);
          return;
        }
        _audio_playback.audio_playback_array[ssrc].g711_decoder.onmessage = function (e) {
          switch(e.data.command) {
            case 'data_out':
              if(hmtgSound.playbackWorkletReady) {
                if(hmtgHelper.good_worker) {
                  _audio_playback.audio_playback_array[ssrc].playback_node.port.postMessage({ command: 'data', data: e.data.data }, [e.data.data.buffer]);
                } else {
                  _audio_playback.audio_playback_array[ssrc].playback_node.port.postMessage({ command: 'data', data: e.data.data });
                }
              } else {
                if(_audio_playback.audio_playback_array[ssrc].total_size < (buffer_control_size << 2)) {
                  _audio_playback.audio_playback_array[ssrc].decoded_audio_data.push(e.data.data);
                  _audio_playback.audio_playback_array[ssrc].total_size += e.data.data.length;
                }
              }  
              break;
            default:
              break;
          }
        }
      }

      var uInt8Array = new Uint8Array(data.length - 1);
      for(var i = 0; i < uInt8Array.length; ++i) {
        uInt8Array[i] = data.charCodeAt(i + 1);
      }

      if(hmtgHelper.good_worker) {
        _audio_playback.audio_playback_array[ssrc].g711_decoder.postMessage({ command: 'data_in', media_type: media_type, data: uInt8Array }, [uInt8Array.buffer]);
      } else {
        _audio_playback.audio_playback_array[ssrc].g711_decoder.postMessage({ command: 'data_in', media_type: media_type, data: uInt8Array });
      }
    }

    this.check_opus_decoder = function (ssrc) {
      if(!_audio_playback.audio_playback_array[ssrc].opus_decoder) {
        try {
          _audio_playback.audio_playback_array[ssrc].opus_decoder_error = false;
          _audio_playback.audio_playback_array[ssrc].opus_decoder = new Worker(WORKER_OPUS_DECODE_PATH);
          _audio_playback.audio_playback_array[ssrc].opus_decoder.addEventListener('error', window.onerrorWorker, false);
          _audio_playback.audio_playback_array[ssrc].opus_decoder.postMessage({ command: 'init', sampleRate: local_sample_rate, good_worker: hmtgHelper.good_worker });
          // stress test
          var i;
          for(i = 0; i < stress_num; i++) {
            _audio_playback.audio_playback_array[ssrc].opus_decoder_array[i] = new Worker(WORKER_OPUS_DECODE_PATH);
            _audio_playback.audio_playback_array[ssrc].opus_decoder_array[i].postMessage({ command: 'init', sampleRate: local_sample_rate, good_worker: hmtgHelper.good_worker });
          }
        } catch(e) {
          hmtg.jnkernel.jn_command_UnknownMedia(hmtg.config.AUDIO_OPUS, ssrc);
          return;
        }
        _audio_playback.audio_playback_array[ssrc].opus_decoder.onmessage = function (e) {
          switch(e.data.command) {
            case 'data_out':
              if(hmtgSound.playbackWorkletReady) {
                if(hmtgHelper.good_worker) {
                  _audio_playback.audio_playback_array[ssrc].playback_node.port.postMessage({ command: 'data', data: e.data.data }, [e.data.data.buffer]);
                } else {
                  _audio_playback.audio_playback_array[ssrc].playback_node.port.postMessage({ command: 'data', data: e.data.data });
                }
              } else {
                if(_audio_playback.audio_playback_array[ssrc].total_size < (buffer_control_size << 2)) {
                  _audio_playback.audio_playback_array[ssrc].decoded_audio_data.push(e.data.data);
                  _audio_playback.audio_playback_array[ssrc].total_size += e.data.data.length;
                }
              }  
              break;
            case 'log':
              hmtg.util.log('opus_decoder: ' + e.data.line);
              break;
            case 'error':
              _audio_playback.audio_playback_array[ssrc].opus_decoder_error = true;
              hmtg.jnkernel.jn_command_UnknownMedia(hmtg.config.AUDIO_OPUS, ssrc, '(decode error)');
              break;
            default:
              break;
          }
        }
      }
    }

    this.opus_decode = function (data, ssrc) {
      _audio_playback.check_opus_decoder(ssrc);
      if(_audio_playback.audio_playback_array[ssrc].opus_decoder_error) return;

      var uInt8Array = new Uint8Array(data.length - 4);
      for(var i = 0; i < uInt8Array.length; ++i) {
        uInt8Array[i] = data.charCodeAt(i + 4);
      }

      // stress test
      var i;
      for(i = 0; i < stress_num; i++) {
        _audio_playback.audio_playback_array[ssrc].opus_decoder_array[i].postMessage({ command: 'data_in', data: uInt8Array });
      }

      if(hmtgHelper.good_worker) {
        _audio_playback.audio_playback_array[ssrc].opus_decoder.postMessage({ command: 'data_in', data: uInt8Array }, [uInt8Array.buffer]);
      } else {
        _audio_playback.audio_playback_array[ssrc].opus_decoder.postMessage({ command: 'data_in', data: uInt8Array });
      }
    }

    this.opus_decode2 = function (data0, data1, ssrc) {
      _audio_playback.check_opus_decoder(ssrc);
      if(_audio_playback.audio_playback_array[ssrc].opus_decoder_error) return;

      var uInt8Array0;
      if(data0) {
        uInt8Array0 = new Uint8Array(data0.length - 4);
        for(var i = 0; i < uInt8Array0.length; ++i) {
          uInt8Array0[i] = data0.charCodeAt(i + 4);
        }
      } else {
        uInt8Array0 = new Uint8Array(0);
      }
      var uInt8Array1;
      if(data0) {
        uInt8Array1 = new Uint8Array(data0.length - 4);
        for(var i = 0; i < uInt8Array1.length; ++i) {
          uInt8Array1[i] = data1.charCodeAt(i + 4);
        }
      } else {
        uInt8Array1 = new Uint8Array(0);
      }

      // stress test
      var i;
      for(i = 0; i < stress_num; i++) {
        _audio_playback.audio_playback_array[ssrc].opus_decoder_array[i].postMessage({ command: 'data_in2', data0: uInt8Array0, data1: uInt8Array1 });
      }

      if(hmtgHelper.good_worker) {
        _audio_playback.audio_playback_array[ssrc].opus_decoder.postMessage({ command: 'data_in2', data0: uInt8Array0, data1: uInt8Array1 }, [uInt8Array0.buffer, uInt8Array1.buffer]);
      } else {
        _audio_playback.audio_playback_array[ssrc].opus_decoder.postMessage({ command: 'data_in2', data0: uInt8Array0, data1: uInt8Array1 });
      }
    }

  }
])

;
