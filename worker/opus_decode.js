importScripts("libopus.js");
importScripts("opus.js");
//https: //github.com/kazuki/opus.js-sample

var decoder = null;
var sampling_ = null, channels_ = null;

var good_worker = false;
var sampleRate = 8000;

this.onmessage = function (e) {
  var data = e.data;
  switch (data.command) {
    case 'init':
      sampleRate = data.sampleRate;
      good_worker = data.good_worker;
      init();
      break;
    case 'exit':
      if (decoder) decoder.destroy();
      decoder = null;
      self.close();
      break;
    case 'data_in':
      decode(data.data);
      break;
    case 'data_in2':
      decode2(data.data0, data.data1);
      break;
    default:
      break;
  }
};

function init() {
  sampling_ = 48000;
  channels_ = 1;
  try {
    decoder = new OpusDecoder(sampling_, channels_);
  } catch (e) {
    self.postMessage({ command: 'error', code: 1 });
    return;
  }
}

function decode(data) {
  var output;
  try {
    output = decoder.decode_float(data.buffer);
  } catch (e) {
    return;
  }

  var sampleRate0 = sampling_;
  if(sampleRate == sampleRate0) {
    target = output;
  } else {
    var target_length0 = output.length * sampleRate / sampleRate0;
    var target_length = target_length0 >>> 0;
    target_length0 -= target_length;
    if(Math.random() < target_length0) target_length++;

    var target = new Float32Array(target_length);
    for(i = 0; i < target_length; i++) {
      target[i] = output[(i * output.length / target_length) >>> 0];
    }
  }
  if(good_worker) {
    self.postMessage({ command: 'data_out', data: target }, [target.buffer]);
  } else {
    self.postMessage({ command: 'data_out', data: target });
  }
}

function simple_decode2(data0, data1) {
  var output0, output1, output;
  try {
    output0 = decoder.decode_float(data0.buffer);
    output1 = decoder.decode_float(data1.buffer);
  } catch (e) {
    return;
  }
  if (output0.length != output1.length) return;
  output = new Float32Array(output0.length * 2);
  var i;
  for (i = 0; i < output0.length / 960; i++) {
    output.set(output0.subarray(i * 960, i * 960 + 960), i * 960 * 2);
    output.set(output1.subarray(i * 960, i * 960 + 960), i * 960 * 2 + 960);
  }

  var sampleRate0 = sampling_;
  if (sampleRate == sampleRate0) {
    target = output;
  } else {
    var target_length0 = output.length * sampleRate / sampleRate0;
    var target_length = target_length0 >>> 0;
    target_length0 -= target_length;
    if (Math.random() < target_length0) target_length++;

    var target = new Float32Array(target_length);
    for (i = 0; i < target_length; i++) {
      target[i] = output[(i * output.length / target_length) >>> 0];
    }
  }
  if (good_worker) {
    self.postMessage({ command: 'data_out', data: target }, [target.buffer]);
  } else {
    self.postMessage({ command: 'data_out', data: target });
  }
}

// own version of opus_packet_parse
// rfc 6716 section 3.2
function parse_frame(data) {
  var frames = [];
  try {
    var toc = data[0] & 0xfc;
    var code = data[0] & 3;
    if (code == 2) {
      var idx = 1;
      var n1 = data[idx];
      idx++;
      if (n1 >= 252) {
        n1 = data[idx] * 4 + n1;
        idx++;
      }
      var n2 = data.length - idx - n1;
      if(n2 < 0) {
        return [];
      }
      var frame = new Uint8Array(n1 + 1);
      frame[0] = toc;
      frame.set(data.subarray(idx, idx + n1), 1);
      idx += n1;
      frames.push(frame);

      frame = new Uint8Array(n2 + 1);
      frame[0] = toc;
      frame.set(data.subarray(idx, idx + n2), 1);
      frames.push(frame);

      return frames;
    } else if (code == 3) {
      var flag = data[1];
      if(!(flag & 0x80)) {
        return [];  // only support vbr
      }
      if(flag & 0x40) {
        return []; // not support padding
      }
      var count = flag & 0x3f;
      var n = new Uint32Array(count);
      var idx = 2;
      var i;
      var total = 0;
      for (i = 0; i < count - 1; i++) {
        n[i] = data[idx];
        idx++;
        if (n[i] >= 252) {
          n[i] = data[idx] * 4 + n[i];
          idx++;
        }
        total += n[i];
      }
      var left = data.length - idx - total;
      if(left < 0) {
        return [];
      }
      n[i] = left;
      var frame;
      for (i = 0; i < count; i++) {
        frame = new Uint8Array(n[i] + 1);
        frame[0] = toc;
        frame.set(data.subarray(idx, idx + n[i]), 1);
        idx += n[i];
        frames.push(frame);
      }
      return frames;
    } else {
      return frames;
    }
  } catch (e) {
    return [];
  }
}

function decode2(data0, data1) {
  var frames0 = parse_frame(data0);
  if(frames0.length == 0) {
    return;
  }
  var frames1 = parse_frame(data1);
  if(frames1.length != frames0.length) {
    return;
  }

  var output;
  var i;
  var t = [];
  try {
    for(i = 0; i < frames0.length; i++) {
      t.push(decoder.decode_float(frames0[i].buffer));
      t.push(decoder.decode_float(frames1[i].buffer));
    }
    //var zero = new Float32Array(t[0].length);
    output = new Float32Array(t[0].length * t.length);
    var pos = 0;
    for(i = 0; i < t.length; i++) {
      //if(i & 1) output.set(zero, pos); else 
      output.set(t[i], pos);
      pos += t[i].length;
    }
  } catch (e) {
    return;
  }

  var sampleRate0 = sampling_;
  if (sampleRate == sampleRate0) {
    target = output;
  } else {
    var target_length0 = output.length * sampleRate / sampleRate0;
    var target_length = target_length0 >>> 0;
    target_length0 -= target_length;
    if (Math.random() < target_length0) target_length++;

    var target = new Float32Array(target_length);
    for (i = 0; i < target_length; i++) {
      target[i] = output[(i * output.length / target_length) >>> 0];
    }
  }
  if (good_worker) {
    self.postMessage({ command: 'data_out', data: target }, [target.buffer]);
  } else {
    self.postMessage({ command: 'data_out', data: target });
  }
}

function log(line) {
  self.postMessage({ command: 'log', line: line });
}

