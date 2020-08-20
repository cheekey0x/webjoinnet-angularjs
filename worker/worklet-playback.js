class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    // The super constructor call is required.
    super();

    this.decoded_audio_data = [];
    this.played_size = 0;
    this.total_size = 0;
    this.type = 0;
    this.buffer_control_size = 1000;

    this.good_worker = false;
    this.is_stopped = false;
    this.quit_flag = false;
    this.ssrc = -1;

    // soundtouch-js-master.zip
    this.playspeed = 1.0;
    this.stretch_size = 1024;
    this.overlap_size = 256;
    this.output_buffer = new Float32Array(1);

    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(e) {
    var data = e.data;
    switch(data.command) {
      case 'init':
        this.quit_flag = false;
        this.is_stopped = false;

        this.buffer_control_size = data.buffer_control_size;
        this.good_worker = data.good_worker;
        this.ssrc = data.ssrc;
        this.decoded_audio_data = [];
        this.played_size = 0;
        this.total_size = 0;

        //console.log(`playbackWorklet, ssrc=${this.ssrc}, init, this.buffer_control_size=${this.buffer_control_size}, this.good_worker=${this.good_worker}`);
        break;
      case 'speed':
        this.playspeed = data.playspeed;
        this.stretch_size = data.stretch_size;
        this.overlap_size = data.overlap_size;
        break;
      case 'exit':
        this.quit_flag = true;
        //console.log(`playbackWorklet, ssrc=${this.ssrc}, exit`);
        break;
      case 'data':
        if(!this.is_stopped
          && this.total_size < (this.buffer_control_size << 2)
        ) {
          this.decoded_audio_data.push(data.data);
          this.total_size += data.data.length;

          //console.log(`playbackWorklet, ssrc=${this.ssrc}, add data length=${data.data.length}, total=${this.total_size}`);
        } else {
          //console.log(`playbackWorklet, ssrc=${this.ssrc}, skip adding data length=${data.data.length}, total=${this.total_size}`);
        }
        break;
      default:
        break;
    }
  }

  process(inputs, outputs) {
    if(this.quit_flag) return false;

    var output = outputs[0];
    this.grab_decoded_audio(output[0]);

    // the AudioWorklet has fixed block size of 128 bytes, which is too small for time domain stretch
    // when the playback speed is increased, this block size will increase the pitch

    //console.log(`playbackWorklet, ssrc=${this.ssrc}, process data length=${copied}, total=${this.total_size}`);

    return true;
  }

  squeeze_audio_data(src, len, outData, playspeed) {
    if(len == 0) {
      return;
    }
    if(len <= outData.length) {
      outData.set(src.subarray(0, len), 0);
      return;
    }

    // pad src with zero
    src.fill(0, len);

    // process
    var idx = 0;
    var idx2 = 0;
    while(1) {
      // basic operation unit size: stretch_size or whatever is left in the target
      var to_copy = outData.length - idx;
      if(to_copy > this.stretch_size) {
        to_copy = this.stretch_size;
      }

      // calculate the part need to be skipped in the src
      var skip = Math.floor((idx + to_copy) * playspeed + 0.5) - idx2 - to_copy;

      // copy the part
      outData.set(src.subarray(idx2, idx2 + to_copy), idx);

      // overlap and add the last part of the skip region and the last part of the copied region
      // to avoid noise caused by the skipping
      var to_overlap = this.overlap_size;
      if(skip < this.overlap_size) {
        to_overlap = skip;
      }
      if(to_overlap >= 1) {
        var overlap_idx1 = idx + to_copy - to_overlap;
        var overlap_idx2 = idx2 + to_copy + skip - to_overlap;
        var i;
        for(i = 0; i < to_overlap; i++) {
          // weight1 + weight2 should equal 1
          var weight1 = (to_overlap - i) / (to_overlap + 1);
          var weight2 = (i + 1) / (to_overlap + 1);
          outData[overlap_idx1 + i] = outData[overlap_idx1 + i] * weight1 + src[overlap_idx2 + i] * weight2;
        }
      }
      idx += to_copy;
      idx2 += to_copy + skip;
      if(idx >= outData.length) {
        break;
      }
    }
  }

  grab_decoded_audio(outData) {
    var idx = 0;
    outData.fill(0, 0);

    var playspeed = this.playspeed;

    if(this.is_stopped) {
      return;
    }
    var low_threshold = this.buffer_control_size;
    if(this.total_size > low_threshold) {
      //var old = this.total_size;
      while(this.total_size > low_threshold * 2) {
        this.total_size -= this.decoded_audio_data[0].length - this.played_size;
        this.played_size = 0;
        this.decoded_audio_data.splice(0, 1);
      }
      while(this.total_size > low_threshold) {
        if(Math.random() >= (this.total_size / low_threshold - 1)) break;
        this.total_size -= this.decoded_audio_data[0].length - this.played_size;
        this.played_size = 0;
        this.decoded_audio_data.splice(0, 1);
      }
      //if(old != this.total_size) { console.log(`ssrc=${this.ssrc}, ` + '(drop ' + (old - this.total_size) + ' to ' + this.total_size + ')audio playback buffer size: ' + old);}
    }
    // calculate the new target length considering the playback speed
    var adjusted_length = Math.floor(outData.length * playspeed + 0.5);

    // grow the output_buffer if the new target length is larger than the existing buffer
    if(this.output_buffer.length < adjusted_length) {
      this.output_buffer = new Float32Array(adjusted_length);
    }

    // for speed 1.0, operating on the outData directly
    // otherwise, use the intermediate output_buffer
    var mybuffer;
    if(adjusted_length <= outData.length) {
      mybuffer = outData;
    } else {
      mybuffer = this.output_buffer;
    }

    // fill mybuffer
    while(this.decoded_audio_data.length) {
      var to_copy = adjusted_length - idx;
      if((this.decoded_audio_data[0].length - this.played_size) > to_copy) {
        mybuffer.set(this.decoded_audio_data[0].subarray(this.played_size, this.played_size + to_copy), idx);
        idx += to_copy;
        this.total_size -= to_copy;
        this.played_size += to_copy;
        break;
      } if((this.decoded_audio_data[0].length - this.played_size) == to_copy) {
        mybuffer.set(this.decoded_audio_data[0].subarray(this.played_size), idx);
        idx += to_copy;
        this.total_size -= to_copy;
        this.played_size = 0;
        this.decoded_audio_data.splice(0, 1);
        break;
      } else {
        mybuffer.set(this.decoded_audio_data[0].subarray(this.played_size), idx);
        idx += this.decoded_audio_data[0].length - this.played_size;
        this.total_size -= this.decoded_audio_data[0].length - this.played_size;
        this.played_size = 0;
        this.decoded_audio_data.splice(0, 1);
      }
    }
    // with playback speed, squeeze the audio data
    if(adjusted_length > outData.length) {
      this.squeeze_audio_data(this.output_buffer, idx, outData, playspeed);
    }
  }
}

registerProcessor('worklet-playback', PlaybackProcessor);
