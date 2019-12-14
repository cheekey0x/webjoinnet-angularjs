importScripts("gunzip.min.js");
//https://github.com/imaya/zlib.js

var good_worker = false;
var pkt_array = [];
var dt = {};
dt.cursor_x = dt.cursor_y = -1;
dt.ssrc = -1;
dt.bmp = null;
dt.color_table = typeof Uint8ClampedArray !== 'undefined' ? new Uint8ClampedArray(256 * 4) : new Uint8Array(256 * 4);
// the following two are used to calculate frame rate
dt.last_extra = 0;
dt.has_data = dt.extra_changed = dt.frame_end_received = false;
var last_update_tick = Date.now();
var frame_interval = 100;
var decode_intervalID = null;

// these are Windows default color palettes
// sequence: B, G, R, 0
// the web's sequence is R, G, B, 0 though
var g_256ClrTable =
  [
    [0, 0, 0, 0], [0, 0, 128, 0],
    [0, 128, 0, 0], [0, 128, 128, 0],
    [128, 0, 0, 0], [128, 0, 128, 0],
    [128, 128, 0, 0], [192, 192, 192, 0],
    [192, 220, 192, 0], [200, 208, 212, 0],
    [51, 0, 0, 0], [0, 0, 51, 0],
    [51, 0, 51, 0], [51, 51, 0, 0],
    [22, 22, 22, 0], [28, 28, 28, 0],
    [34, 34, 34, 0], [41, 41, 41, 0],
    [85, 85, 85, 0], [77, 77, 77, 0],
    [66, 66, 66, 0], [57, 57, 57, 0],
    [128, 124, 255, 0], [80, 80, 255, 0],
    [147, 0, 214, 0], [255, 236, 204, 0],
    [198, 214, 239, 0], [214, 231, 231, 0],
    [144, 169, 173, 0], [0, 255, 51, 0],
    [0, 0, 102, 0], [0, 0, 153, 0],
    [0, 0, 204, 0], [0, 51, 0, 0],
    [0, 51, 51, 0], [0, 51, 102, 0],
    [0, 51, 153, 0], [0, 51, 204, 0],
    [0, 51, 255, 0], [0, 102, 0, 0],
    [0, 102, 51, 0], [0, 102, 102, 0],
    [0, 102, 153, 0], [0, 102, 204, 0],
    [0, 102, 255, 0], [0, 153, 0, 0],
    [0, 153, 51, 0], [0, 153, 102, 0],
    [0, 153, 153, 0], [0, 153, 204, 0],
    [0, 153, 255, 0], [0, 204, 0, 0],
    [0, 204, 51, 0], [0, 204, 102, 0],
    [0, 204, 153, 0], [0, 204, 204, 0],
    [0, 204, 255, 0], [0, 255, 102, 0],
    [0, 255, 153, 0], [0, 255, 204, 0],
    [51, 255, 0, 0], [255, 0, 51, 0],
    [51, 0, 102, 0], [51, 0, 153, 0],
    [51, 0, 204, 0], [51, 0, 255, 0],
    [255, 51, 0, 0], [51, 51, 51, 0],
    [51, 51, 102, 0], [51, 51, 153, 0],
    [51, 51, 204, 0], [51, 51, 255, 0],
    [51, 102, 0, 0], [51, 102, 51, 0],
    [51, 102, 102, 0], [51, 102, 153, 0],
    [51, 102, 204, 0], [51, 102, 255, 0],
    [51, 153, 0, 0], [51, 153, 51, 0],
    [51, 153, 102, 0], [51, 153, 153, 0],
    [51, 153, 204, 0], [51, 153, 255, 0],
    [51, 204, 0, 0], [51, 204, 51, 0],
    [51, 204, 102, 0], [51, 204, 153, 0],
    [51, 204, 204, 0], [51, 204, 255, 0],
    [51, 255, 51, 0], [51, 255, 102, 0],
    [51, 255, 153, 0], [51, 255, 204, 0],
    [51, 255, 255, 0], [102, 0, 0, 0],
    [102, 0, 51, 0], [102, 0, 102, 0],
    [102, 0, 153, 0], [102, 0, 204, 0],
    [102, 0, 255, 0], [102, 51, 0, 0],
    [102, 51, 51, 0], [102, 51, 102, 0],
    [102, 51, 153, 0], [102, 51, 204, 0],
    [102, 51, 255, 0], [102, 102, 0, 0],
    [102, 102, 51, 0], [102, 102, 102, 0],
    [102, 102, 153, 0], [102, 102, 204, 0],
    [102, 153, 0, 0], [102, 153, 51, 0],
    [102, 153, 102, 0], [102, 153, 153, 0],
    [102, 153, 204, 0], [102, 153, 255, 0],
    [102, 204, 0, 0], [102, 204, 51, 0],
    [102, 204, 153, 0], [102, 204, 204, 0],
    [102, 204, 255, 0], [102, 255, 0, 0],
    [102, 255, 51, 0], [102, 255, 153, 0],
    [102, 255, 204, 0], [204, 0, 255, 0],
    [255, 0, 204, 0], [153, 153, 0, 0],
    [153, 51, 153, 0], [153, 0, 153, 0],
    [153, 0, 204, 0], [153, 0, 0, 0],
    [153, 51, 51, 0], [153, 0, 102, 0],
    [153, 51, 204, 0], [153, 0, 255, 0],
    [153, 102, 0, 0], [153, 102, 51, 0],
    [153, 51, 102, 0], [153, 102, 153, 0],
    [153, 102, 204, 0], [153, 51, 255, 0],
    [153, 153, 51, 0], [153, 153, 102, 0],
    [153, 153, 153, 0], [153, 153, 204, 0],
    [153, 153, 255, 0], [153, 204, 0, 0],
    [153, 204, 51, 0], [102, 204, 102, 0],
    [153, 204, 153, 0], [153, 204, 204, 0],
    [153, 204, 255, 0], [153, 255, 0, 0],
    [153, 255, 51, 0], [153, 204, 102, 0],
    [153, 255, 153, 0], [153, 255, 204, 0],
    [153, 255, 255, 0], [204, 0, 0, 0],
    [153, 0, 51, 0], [204, 0, 102, 0],
    [204, 0, 153, 0], [204, 0, 204, 0],
    [153, 51, 0, 0], [204, 51, 51, 0],
    [204, 51, 102, 0], [204, 51, 153, 0],
    [204, 51, 204, 0], [204, 51, 255, 0],
    [204, 102, 0, 0], [204, 102, 51, 0],
    [153, 102, 102, 0], [204, 102, 153, 0],
    [204, 102, 204, 0], [153, 102, 255, 0],
    [204, 153, 0, 0], [204, 153, 51, 0],
    [204, 153, 102, 0], [204, 153, 153, 0],
    [204, 153, 204, 0], [204, 153, 255, 0],
    [204, 204, 0, 0], [204, 204, 51, 0],
    [204, 204, 102, 0], [204, 204, 153, 0],
    [204, 204, 204, 0], [204, 204, 255, 0],
    [204, 255, 0, 0], [204, 255, 51, 0],
    [153, 255, 102, 0], [204, 255, 153, 0],
    [204, 255, 204, 0], [204, 255, 255, 0],
    [204, 0, 51, 0], [255, 0, 102, 0],
    [255, 0, 153, 0], [204, 51, 0, 0],
    [255, 51, 51, 0], [255, 51, 102, 0],
    [255, 51, 153, 0], [255, 51, 204, 0],
    [255, 51, 255, 0], [255, 102, 0, 0],
    [255, 102, 51, 0], [204, 102, 102, 0],
    [255, 102, 153, 0], [255, 102, 204, 0],
    [204, 102, 255, 0], [255, 153, 0, 0],
    [255, 153, 51, 0], [255, 153, 102, 0],
    [255, 153, 153, 0], [255, 153, 204, 0],
    [255, 153, 255, 0], [255, 204, 0, 0],
    [255, 204, 51, 0], [255, 204, 102, 0],
    [255, 204, 153, 0], [255, 204, 204, 0],
    [255, 204, 255, 0], [255, 255, 51, 0],
    [204, 255, 102, 0], [255, 255, 153, 0],
    [255, 255, 204, 0], [102, 102, 255, 0],
    [102, 255, 102, 0], [102, 255, 255, 0],
    [255, 102, 102, 0], [255, 102, 255, 0],
    [255, 255, 102, 0], [33, 0, 165, 0],
    [95, 95, 95, 0], [119, 119, 119, 0],
    [134, 134, 134, 0], [150, 150, 150, 0],
    [203, 203, 203, 0], [178, 178, 178, 0],
    [215, 215, 215, 0], [221, 221, 221, 0],
    [227, 227, 227, 0], [234, 234, 234, 0],
    [241, 241, 241, 0], [248, 248, 248, 0],
    [240, 251, 255, 0], [164, 160, 160, 0],
    [128, 128, 128, 0], [0, 0, 255, 0],
    [0, 255, 0, 0], [0, 255, 255, 0],
    [255, 0, 0, 0], [255, 0, 255, 0],
    [255, 255, 0, 0], [255, 255, 255, 0]
  ];

var g_16ClrTable =
  [
    [0, 0, 0, 0], [0, 0, 128, 0],
    [0, 128, 0, 0], [0, 128, 128, 0],
    [128, 0, 0, 0], [128, 0, 128, 0],
    [128, 128, 0, 0], [128, 128, 128, 0],
    [192, 192, 192, 0], [0, 0, 255, 0],
    [0, 255, 0, 0], [0, 255, 255, 0],
    [255, 0, 0, 0], [255, 0, 255, 0],
    [255, 255, 0, 0], [255, 255, 255, 0]
  ];

var g_4ClrTable =
  [
    [16, 16, 16, 0], [128, 128, 128, 0],
    [192, 192, 192, 0], [255, 255, 255, 0]
  ];

var g_2ClrTable =
  [
    [16, 16, 16, 0], [255, 255, 255, 0]
  ];

var default_color_palette_hash = {
  1: g_2ClrTable,
  2: g_4ClrTable,
  4: g_16ClrTable,
  8: g_256ClrTable
};


var hmtg = {};
var config = hmtg.config = hmtg.config || {};
hmtg['config'] = hmtg.config;

config.DT_CAPTURE_INFO = 0;
config.DT_CAPTURE_END = 1;
config.DT_SCREEN_DATA = 2;
config.DT_REQUEST_RECT = 3;
config.DT_MOUSE_POS = 4;
config.DT_NULL_DATA = 5;
config.DT_FRAME_END = 6;
config.DT_RDC_SIGNAL = 7;
config.DT_RDC_INPUT = 8;
config.DT_SCREEN_DATA2 = 10;

var util = hmtg['util'] = hmtg.util = hmtg.util || {};
util['str2array'] = util.str2array = function (str) {
  // write the bytes of the string to a typed array
  var ia = new Uint8Array(str.length);
  for(var i = 0; i < str.length; i++) {
    ia[i] = str.charCodeAt(i);
  }
  return ia;
}

this.onmessage = function (e) {
  var data = e.data;
  switch(data.command) {
    case 'init':
      good_worker = data.good_worker;
      break;
    case 'exit':
      self.close();
      break;
    case 'pkt_in':
      pkt_array.push(data);
      if(!decode_intervalID) decode_intervalID = setInterval(function () {
        if(!pkt_array.length) {
          clearInterval(decode_intervalID);
          decode_intervalID = null;
          return;
        }
        var pkt = pkt_array.shift();
        decodePlugin(pkt);
      }, 0);
      break;
    case 'clear':
      pkt_array = [];
      dt.bmp = null;
      if(decode_intervalID) {
        clearInterval(decode_intervalID);
        decode_intervalID = null;
      }
      break;
    default:
      break;
  }
};

function decodePlugin(pkt) {
  var start_tick = Date.now();
  var delay = start_tick - pkt.tick;
  if(delay < 1000) { }
  else if(delay < 3000) { if(pkt.prio < 9) return; }
  else if(delay < 5000) { if(pkt.prio < 11) return; }
  else { if(pkt.prio < 13) return; }
  handlePkt(pkt.data, pkt.ssrc, pkt.extra);
}

function getWORD(data, idx) {
  var value = (
        data.charCodeAt(idx + 1) << 8 ^
        data.charCodeAt(idx));
  return value;
}

function getDWORD(data, idx) {
  var value = (
        data.charCodeAt(idx + 3) << 24 ^
        data.charCodeAt(idx + 2) << 16 ^
        data.charCodeAt(idx + 1) << 8 ^
        data.charCodeAt(idx));
  return value;
}

function handlePkt(data, ssrc, extra) {
  var command = data.charCodeAt(0);
  var size = (
        data.charCodeAt(0 + 3) << 16 ^
        data.charCodeAt(0 + 2) << 8 ^
        data.charCodeAt(0 + 1));
  if(size < 0) return;
  if(data.length < 4 + size) return;
  var total_size = 4 + size;

  switch(command) {
    case hmtg.config.DT_SCREEN_DATA:
    case hmtg.config.DT_SCREEN_DATA2:
      if(!dt.bmp) return;
      if(size < 9) return;
      var left = getWORD(data, 4);
      var top = getWORD(data, 6);
      var right = getWORD(data, 8);
      var bottom = getWORD(data, 10);
      if(left < 0 || top < 0 || right > 32767 || bottom > 32767 || left >= right || top >= bottom) return;
      //if(right > dt.width + 7 || bottom > dt.height) {
      if(right > dt.width || bottom > dt.height) {
        //console.log('******debug, right(' + right + ') > announced_width(' + dt.width + ')');
        return;
      }

      try {
        var gunzip = new Zlib.Gunzip(hmtg.util.str2array(data).subarray(12));
        var output = gunzip.decompress();
        if(!output || !output.length) {
          return;
        }
      } catch(e) {
        return;
      }

      var rowsize = ((right - left) * dt.m_iDstBitCount + 7) >> 3;
      if(output.length == rowsize * (bottom - top)) {
        dt.has_data = true;
        if(dt.last_extra != extra) {
          dt.last_extra = extra;
          dt.extra_changed = true;
        }

        //if(right > dt.width || bottom > dt.height) create_canvas(Math.max(right, dt.width), Math.max(bottom, dt.height));
        if(update_canvas_rect(left, top, right, bottom, output)) {
          if(ssrc >= 0) dt.ssrc = ssrc;
          update_data();
        }
      }
      break;
    case hmtg.config.DT_NULL_DATA:
      break;
    case hmtg.config.DT_FRAME_END:
      dt.frame_end_received = true;
      break;
    case hmtg.config.DT_REQUEST_RECT:
      break;
    case hmtg.config.DT_CAPTURE_INFO:
      dt.cursor_x = dt.cursor_y = -1;

      if(size < 8) return;
      var width = getWORD(data, 4 + 2);
      var height = getWORD(data, 4 + 4);
      if(width > 32767 || height > 32767) {
        dt.bmp = null;
        reset_data();
        return;
      }
      var iDstBitCount = getWORD(data, 4);
      var iClrUsed = 0;
      var color_table = '';
      if(iDstBitCount <= 8) {
        if(size < 8) return;
        iClrUsed = getWORD(data, 4 + 6);
        if(iClrUsed > 256) return;
        if(iClrUsed < 0) return;
        if(size < 8 + iClrUsed * 4) return;
        color_table = data.slice(4 + 8, 4 + 8 * iClrUsed * 4);
      }
      dt.m_wDstCapSequence = getWORD(data, 4 + 6 + iClrUsed * 4);
      if(ssrc != -1) dt.data_source_ssrc = ssrc;

      if(!dt.bmp || dt.width != width || dt.height != height) {
        create_canvas(width, height);
      }
      dt.m_iClrUsed = iClrUsed;
      dt.m_iDstBitCount = iDstBitCount;
      if(iDstBitCount <= 8) {
        parse_color_table(iDstBitCount, iClrUsed, color_table);
      }
      self.postMessage({ command: 'meta', width: dt.width, height: dt.height, bit_count: dt.m_iDstBitCount, use_grayscale: dt.use_grayscale });
      break;
    case hmtg.config.DT_CAPTURE_END:
      if(dt.data_source_ssrc == ssrc && size >= 2
            && dt.m_wDstCapSequence != 0
            && getWORD(data, 4) != dt.m_wDstCapSequence) {
      } else {
        dt.bmp = null;
        reset_data();
      }
      break;
    case hmtg.config.DT_MOUSE_POS:
      if(size < 4) return;
      dt.cursor_x = getWORD(data, 4);
      dt.cursor_y = getWORD(data, 6);
      if(ssrc >= 0) dt.ssrc = ssrc;
      update_data();
      break;
    case hmtg.config.DT_RDC_INPUT:
      if(size < 12) return;
      var msg = getDWORD(data, 4);
      var wParam = getDWORD(data, 8);
      var lParam = getDWORD(data, 12);
      break;
    default:
      console.log('******debug, dt_decoder, unknown command: ' + command);
      return;
      break;
  }
}

// canvas method
function create_canvas(width, height) {
  if(!width || !height) {
    dt.bmp = null;
    reset_data();
    return;
  }
  var i, j;
  var old = null;
  if(dt.bmp && dt.width && dt.height) {
    old = dt.bmp;
  }
  dt.bmp = new Uint8Array((width * height) << 2);
  if(old) {
    // copy image data
    var copy_width = Math.min(width, dt.width);
    var copy_height = Math.min(height, dt.height);
    for(i = 0; i < copy_height; i++) {
      dt.bmp.set(old.subarray((i * dt.width) << 2, (i * dt.width + copy_width) << 2), (i * width) << 2);
    }
  }

  dt.width = width;
  dt.height = height;

  var i;
  for(i = 0; i < width * height; i++) {
    dt.bmp[(i << 2) + 3] = 255; // alpha
  }
}

function parse_color_table(iDstBitCount, iClrUsed, color_table) {
  var i;
  for(i = 0; i < 256 * 4; i++) {
    dt.color_table[i] = 0;
  }
  var idx2 = 0;
  dt.use_grayscale = false;
  // when iClrUsed is zero, the default color palette is using color
  if(iClrUsed) {
    if(iDstBitCount == 4 || iDstBitCount == 8) dt.use_grayscale = true;
  }  
  //console.log('******debug, bitcount=' + dt.m_iDstBitCount + ',color number: ' + iClrUsed);
  for(i = 0; i < iClrUsed; i++) {
    var b = color_table.charCodeAt(idx2++); // b
    var g = color_table.charCodeAt(idx2++); // g
    var r = color_table.charCodeAt(idx2++); // r

    if(dt.use_grayscale) {
      if(r != g || r != b) dt.use_grayscale = false;
    }

    dt.color_table[i * 4 + 2] = b;
    dt.color_table[i * 4 + 1] = g;
    dt.color_table[i * 4 + 0] = r;
    //console.log('******debug, idx=' + i + ',rgb=' + dt.color_table[i * 4 + 0] + ',' + dt.color_table[i * 4 + 1] + ',' + dt.color_table[i * 4 + 2]);
    idx2++;
  }
}

function update_canvas_rect(left, top, right, bottom, output) {
  if(!dt.bmp) return false;
  var rect_rowsize = ((right - left) * dt.m_iDstBitCount + 7) >> 3;

  var new_top = dt.height - bottom;
  var new_bottom = dt.height - top;

  var i, j, offset;
  var data_offset;
  for(i = new_top; i < new_bottom; i++) {
    var row = dt.height - 1 - i;
    var row_offset = (row - top) * rect_rowsize;
    var data_row_offset = i * (dt.width << 2);
    for(j = left; j < right && j < dt.width; j++) {
      var col = j;
      var col_bit_offset = (col - left) * dt.m_iDstBitCount;
      var col_offset = col_bit_offset >> 3;
      offset = row_offset + col_offset;
      data_offset = data_row_offset + (j << 2);
      var table_idx;
      if(dt.m_iDstBitCount == 24) {
        dt.bmp[data_offset++] = output[offset + 2];  // r
        dt.bmp[data_offset++] = output[offset + 1];  // g
        dt.bmp[data_offset] = output[offset];  // b
      } else if(dt.m_iDstBitCount == 16) {
        var word = (output[offset + 1] << 8) ^ output[offset];
        dt.bmp[data_offset++] = (word & 0x7c00) >> 7;  // r
        dt.bmp[data_offset++] = (word & 0x3e0) >> 2;  // g
        dt.bmp[data_offset] = (word & 0x1f) << 3;  // b
      } else if(dt.m_iDstBitCount <= 8) {
        var col_byte_pos = col_bit_offset & 7;
        if(dt.m_iDstBitCount == 8) {
          table_idx = output[offset];
        } else if(dt.m_iDstBitCount == 4) {
          table_idx = (output[offset] >> (4 - col_byte_pos)) & 0xf;
        } else if(dt.m_iDstBitCount == 2) {
          table_idx = (output[offset] >> (6 - col_byte_pos)) & 0x3;
        } else if(dt.m_iDstBitCount == 1) {
          table_idx = (output[offset] >> (7 - col_byte_pos)) & 0x1;
        } else {
          return false;
        }
        if(dt.m_iClrUsed) {
          table_idx = table_idx << 2;
          dt.bmp[data_offset++] = dt.color_table[table_idx++];
          dt.bmp[data_offset++] = dt.color_table[table_idx++];
          dt.bmp[data_offset] = dt.color_table[table_idx];
        } else {
          // use default color palette
          // BGR -> RGB
          var table = default_color_palette_hash[dt.m_iDstBitCount];
          dt.bmp[data_offset++] = table[table_idx][2];
          dt.bmp[data_offset++] = table[table_idx][1];
          dt.bmp[data_offset] = table[table_idx][0];
        }
      } else {
        return false;
      }
    }
  }
  return true;
}

var delayed_update_timerID = null;
function update_data() {
  if(!dt.bmp) {
    cancel_delayed_update_timer();
    return;
  }
  if(delayed_update_timerID) return;

  var now = Date.now();
  if(now - last_update_tick < frame_interval) {
    delayed_update_timerID = setTimeout(function () {
      delayed_update_timerID = null;
      update_data();
    }, frame_interval - (now - last_update_tick) + 1);
    return;
  }

  var new_frame = false;
  if(dt.has_data && (dt.frame_end_received
    //|| dt.extra_changed
    )) {
    new_frame = true;
  }
  dt.has_data = dt.extra_changed = dt.frame_end_received = false;  // reset at each data_out

  // do not use ownership transfer because we still need to keep the original buffer
  self.postMessage({ command: 'data_out', data: dt.bmp, width: dt.width, height: dt.height, x: dt.cursor_x, y: dt.cursor_y, ssrc: dt.ssrc, new_frame: new_frame });
  last_update_tick = now;
}

function reset_data() {
  dt.cursor_x = dt.cursor_y = -1;
  cancel_delayed_update_timer();
  self.postMessage({ command: 'reset' });
}

function cancel_delayed_update_timer() {
  if(delayed_update_timerID) {
    clearTimeout(delayed_update_timerID);
    delayed_update_timerID = null;
  }
}
