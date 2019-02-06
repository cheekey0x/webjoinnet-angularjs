class RecordProcessor extends AudioWorkletProcessor {
  constructor() {
    // The super constructor call is required.
    super();

    this.good_worker = false;
    this.is_stopped = false;
    this.quit_flag = false;

    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(e) {
    var data = e.data;
    switch(data.command) {
      case 'init':
        this.quit_flag = false;
        this.is_stopped = false;

        this.good_worker = data.good_worker;

        //console.log(`recordWorklet, init, this.good_worker=${this.good_worker}`);
        break;
      default:
        break;
    }
  }

  process(inputs, outputs) {
    if(this.quit_flag) return false;
    if(this.is_stopped) return true;

    var input = inputs[0];    
    var target = new Float32Array(input[0].length);
    target.set(input[0]);

    if(this.good_worker) {
      this.port.postMessage({ command: 'data_out', data: target }, [target.buffer]);
    } else {
      this.port.postMessage({ command: 'data_out', data: target });
    }

    return true;
  }
}

registerProcessor('worklet-record', RecordProcessor);
