importScripts("libopus.js");
importScripts("opus.js");
//https://github.com/kazuki/opus.js-sample

var encoder = null;
var sampling_ = null, channels_ = null;
var frame_duration = 20;
var bitrate = 24000;

var good_worker = false;
var sampleRate = 8000;

var raw_data_array = [];
var last_raw_data_type = -1;
var raw_data_size = 0;
var first_item_used = 0;

this.onmessage = function (e) {
  var data = e.data;
  switch (data.command) {
    case 'init':
      sampleRate = data.sampleRate;
      good_worker = data.good_worker;
      frame_duration = data.frame_duration;
      bitrate = data.bitrate;
      init();
      break;
    case 'bitrate':
      bitrate = data.bitrate;
      change_bitrate();
      break;
    case 'exit':
      if (encoder) encoder.destroy();
      encoder = null;
      self.close();
      break;
    case 'data_in':
      raw_data_array.push({ data: data.data, ts: data.ts });
      raw_data_size += data.data.length;
      while (true) {
        if (!encode())
          break;
      }
      break;
    default:
      break;
  }
};

function init() {
  sampling_ = 48000;
  channels_ = 1;
  try {
    encoder = new OpusEncoder(sampling_, channels_, 2048, frame_duration);  // voip:2048; audio:2049
    change_bitrate();
  } catch (e) {
    self.postMessage({ command: 'error', code: 1 });
    return;
  }
}

function change_bitrate() {
  try {
    /*
    var old;
    _opus_encoder_ctl(encoder.handle_, 4003, encoder.in_ptr); // get bitrate
    old = HEAPU32[encoder.in_ptr >> 2];

    HEAPU32[encoder.in_ptr >> 2] = bitrate;
    _opus_encoder_ctl(encoder.handle_, 4002, encoder.in_ptr); // set bitrate
    _opus_encoder_ctl(encoder.handle_, 4003, encoder.in_ptr); // get bitrate
    old = HEAPU32[encoder.in_ptr >> 2];
    */

    var out_bytes = bitrate * frame_duration / 8000;
    out_bytes = out_bytes >>> 0;
    out_bytes -= 21 + 4;  // packet header
    out_bytes += 4; // by experience, the real output normally is 4-5 bytes less than the target.
    if(out_bytes < 5) out_bytes = 5;
    if(out_bytes > 475) out_bytes = 475; // 500 byte limitation

    encoder.out_bytes = out_bytes;

  } catch(e) {
    self.postMessage({ command: 'error', code: 1 });
    return;
  }
}

function encode() {
  if (!raw_data_array.length) {
    return false;
  }
  var target_length;
  var sampleRate0 = sampling_;
  target_length = frame_duration * sampleRate0 / 1000;
  var src_length0 = target_length * sampleRate / sampleRate0;
  var src_length = src_length0 >>> 0;
  src_length0 -= src_length;
  if(Math.random() < src_length0) src_length++;
  if (raw_data_size < src_length) {
    return false;
  }

  var ts = raw_data_array[0].ts;
  var src = new Float32Array(src_length);
  var i = 0;
  while(true) {
    var left = raw_data_array[0].data.length - first_item_used;
    var to_copy = src_length - i;
    if(left > to_copy) {
      src.set(raw_data_array[0].data.subarray(first_item_used, first_item_used + to_copy), i);
      raw_data_size -= to_copy;
      first_item_used += to_copy;
      break;
    } else if(left == to_copy) {
      src.set(raw_data_array[0].data.subarray(first_item_used), i);
      raw_data_size -= to_copy;
      first_item_used = 0;
      raw_data_array.splice(0, 1);
      break;
    } else {
      src.set(raw_data_array[0].data.subarray(first_item_used), i);
      i += left;
      raw_data_size -= left;
      first_item_used = 0;
      raw_data_array.splice(0, 1);
    }
  }

  var src2;
  if(src_length == target_length) {
    src2 = src;
  } else {
    src2 = new Float32Array(target_length);
    for(i = 0; i < target_length; i++) {
      src2[i] = src[(i * src_length / target_length) >>> 0];
    }
  }

  //for (var i = 0; i < src2.length; i++) src2[i] = (64 + Math.round(32 * (Math.cos(i * i / 2000) + Math.sin(i * i / 4000)))) / 0x8000;

  var output;
  var ret;
  try {
    //output = encoder.encode_float(src2);
    //if (src2.length != encoder.in_len) {
    //}
    encoder.in_f32.set(src2);
    ret = _opus_encode_float(encoder.handle, encoder.in_ptr, encoder.frame_size, encoder.out_ptr, encoder.out_bytes);
    if (ret <= 0) {
      return true;
    }

  } catch (e) {
    return true;
  }

  /*
  if (!output.length) {
    return true;
  }
  var view = new Int8Array(output[0]);
  var target = new Uint8Array(view.length + 4);
  target[0] = 0;
  target.set(view, 4);
  */

  var target = new Uint8Array(ret + 4);
  target[0] = 0;
  target.set(encoder.out_buf.subarray(0, ret), 4);

  if(good_worker) {
    self.postMessage({ command: 'data_out', data: target, ts: ts }, [target.buffer]);
  } else {
    self.postMessage({ command: 'data_out', data: target, ts: ts });
  }
  return true;
}

function log(line) {
  self.postMessage({ command: 'log', line: line });
}

