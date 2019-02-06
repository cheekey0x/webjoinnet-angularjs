var data;
var rate;
var good_worker = false;

try {
  var uInt8Array = new Uint8Array(1);
  self.postMessage({ command: '', data: uInt8Array }, [uInt8Array.buffer]);
  if(uInt8Array.buffer.byteLength != 0) good_worker = false;
  else good_worker = true;
} catch(e) {
  good_worker = false;
}


this.onmessage = function (e) {
  switch(e.data.command) {
    case 'data_in':
      data = e.data.data;
      rate = e.data.sampleRate;
      break;
    case 'request_data':
      request_data();
      break;
    case 'trigger_error':
      no_such_function();  // this is to trigger an error for testing
      break;
    default:
      setTimeout(function () { self.close(); }, 100);
      break;
  }
};


function request_data() {
  if(good_worker)
    self.postMessage({command: 'data_out', data: data, rate: rate}, [data.buffer]);
  else
    self.postMessage({ command: 'data_out', data: data, rate: rate });
}
