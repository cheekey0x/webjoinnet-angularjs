var SIGN_BIT = (0x80); 	/* Sign bit for a A-law byte. */
var QUANT_MASK = (0xf); 	/* Quantization field mask. */
var BIAS = (0x84); 	/* Bias for linear code. */
var SEG_SHIFT = (4); 	/* Left shift for segment number. */
var SEG_MASK = (0x70); 	/* Segment field mask. */

var config = {};
config.MEDIA_AUDIO_G711_50MS = 6;
config.MEDIA_AUDIO_G711_20MS = 7;
config.MEDIA_AUDIO_G711_11K_89K_40MS = 14;

var good_worker = false;
var sampleRate = 8000;

this.onmessage = function (e) {
  var data = e.data;
  switch(data.command) {
    case 'init':
      sampleRate = data.sampleRate;
      good_worker = data.good_worker;
      break;
    case 'exit':
      self.close();
      break;
    case 'data_in':
      decode(data.media_type, data.data);
      break;
    default:
      break;
  }
};

function decode(media_type, data) {
  var sampleRate0;
  if(media_type == config.MEDIA_AUDIO_G711_11K_89K_40MS) {
    sampleRate0 = 11025;
  } else {
    sampleRate0 = 8000;
  }
  var target_length0 = data.length * sampleRate / sampleRate0;
  var target_length = target_length0 >>> 0;
  target_length0 -= target_length;
  if(Math.random() < target_length0) target_length++;

  var target = new Float32Array(target_length);
  target[0] = ulaw2linear(data[0]) / 0x8000;
  var i;
  if(data.length == target_length) {
    for(i = 1; i < target_length; i++) {
      target[i] = ulaw2linear(data[i]) / 0x8000;
    }
  } else {
    for(i = 1; i < target_length; i++) {
      target[i] = ulaw2linear(data[(i * data.length / target_length) >>> 0]) / 0x8000;
    }
  }

  if(good_worker) {
    self.postMessage({ command: 'data_out', data: target }, [target.buffer]);
  } else {
    self.postMessage({ command: 'data_out', data: target });
  }
}

function ulaw2linear(u_val) {
  var t;

  /* Complement to obtain normal u-law value. */
  u_val = ~u_val;

  /*
  * Extract and bias the quantization bits. Then
  * shift up by the segment number and subtract out the bias.
  */
  t = ((u_val & QUANT_MASK) << 3) + BIAS;
  t <<= (u_val & SEG_MASK) >> SEG_SHIFT;

  return ((u_val & SIGN_BIT) ? (BIAS - t) : (t - BIAS));
}

