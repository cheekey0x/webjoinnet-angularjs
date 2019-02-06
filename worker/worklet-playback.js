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
    var copied = this.grab_decoded_audio(output[0]);

    //console.log(`playbackWorklet, ssrc=${this.ssrc}, process data length=${copied}, total=${this.total_size}`);

    return true;
  }

  grab_decoded_audio(outData) {
    var idx = 0;
    if(this.is_stopped) {
      for(; idx < outData.length; idx++) {
        outData[idx] = 0;
      }
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
    while(this.decoded_audio_data.length) {
      var to_copy = outData.length - idx;
      if((this.decoded_audio_data[0].length - this.played_size) > to_copy) {
        outData.set(this.decoded_audio_data[0].subarray(this.played_size, this.played_size + to_copy), idx);
        idx += to_copy;
        this.total_size -= to_copy;
        this.played_size += to_copy;
        break;
      } if((this.decoded_audio_data[0].length - this.played_size) == to_copy) {
        outData.set(this.decoded_audio_data[0].subarray(this.played_size), idx);
        idx += to_copy;
        this.total_size -= to_copy;
        this.played_size = 0;
        this.decoded_audio_data.splice(0, 1);
        break;
      } else {
        outData.set(this.decoded_audio_data[0].subarray(this.played_size), idx);
        idx += this.decoded_audio_data[0].length - this.played_size;
        this.total_size -= this.decoded_audio_data[0].length - this.played_size;
        this.played_size = 0;
        this.decoded_audio_data.splice(0, 1);
      }
    }
    var copied = idx;
    for(; idx < outData.length; idx++) {
      outData[idx] = 0;
    }
    return copied;
  }
}

registerProcessor('worklet-playback', PlaybackProcessor);
