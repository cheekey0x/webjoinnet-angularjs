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

var raw_data_array = [];
var last_raw_data_type = -1;
var raw_data_size = 0;
var first_item_used = 0;

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
      raw_data_array.push({ data: data.data, ts: data.ts, media_type: data.media_type });
      raw_data_size += data.data.length;
      while(true) {
        if(!encode())
          break;
      }
      break;
    default:
      break;
  }
};

function encode() {
  if(!raw_data_array.length) return false;
  var media_type = raw_data_array[0].media_type;
  var target_length;
  var sampleRate0;
  if(media_type == config.MEDIA_AUDIO_G711_11K_89K_40MS) {
    sampleRate0 = 11025;
    target_length = (11025 * 40 / 1000) >>> 0;
  } else if(media_type == config.MEDIA_AUDIO_G711_50MS) {
    sampleRate0 = 8000;
    target_length = (8000 * 50 / 1000) >>> 0;
  } else {
    sampleRate0 = 8000;
    target_length = (8000 * 20 / 1000) >>> 0;
  }
  var src_length0 = target_length * sampleRate / sampleRate0;
  var src_length = src_length0 >>> 0;
  src_length0 -= src_length;
  if(Math.random() < src_length0) src_length++;
  if(raw_data_size < src_length) return false;

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

  var target = new Uint8Array(target_length + 1);
  if(media_type == config.MEDIA_AUDIO_G711_50MS) target[0] = 0;
  else if(media_type == config.MEDIA_AUDIO_G711_20MS) target[0] = 1;
  else target[0] = 2;
  target[1] = linear2ulaw(src[0]);
  var i;
  if(src_length == target_length) {
    for(i = 1; i < target_length; i++) {
      target[i + 1] = linear2ulaw(src[i]);
    }
  } else {
    for(i = 1; i < target_length; i++) {
      target[i + 1] = linear2ulaw(src[(i * src_length / target_length) >>> 0]);
    }
  }

  if(good_worker) {
    self.postMessage({ command: 'data_out', data: target, ts: ts, media_type: media_type }, [target.buffer]);
  } else {
    self.postMessage({ command: 'data_out', data: target, ts: ts, media_type: media_type });
  }
  return true;
}

var seg_end = [0xFF, 0x1FF, 0x3FF, 0x7FF, 0xFFF, 0x1FFF, 0x3FFF, 0x7FFF];
function search(val, table, size) {
  var i;

  for(i = 0; i < size; i++) {
    if(val <= table[i]) return (i);
  }

  return (size);
}

function linear2ulaw(pcm_val) { /* 2's complement (16-bit range) */
  var	mask;
  var	seg;
  var uval;

  pcm_val = (pcm_val * 0x8000) >> 0;

  /* Get the sign and the magnitude of the value. */
  if (pcm_val < 0) {
    pcm_val = BIAS - pcm_val;
    mask = 0x7F;
  } else {
    pcm_val += BIAS;
    mask = 0xFF;
  }

  /* Convert the scaled magnitude to segment number. */
  seg = search(pcm_val, seg_end, 8);

  /*
    * Combine the sign, segment, quantization bits;
    * and complement the code word.
    */
  if(seg >= 8) {	/* out of range, return maximum value. */
    return (0x7F ^ mask);
  } else {
    uval = (seg << 4) | ((pcm_val >> (seg + 3)) & 0xF);
    return (uval ^ mask);
  }
}

