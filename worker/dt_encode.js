importScripts("gzip.min.js");
//https://github.com/imaya/zlib.js

var good_worker = false;
var avg_compress_ratio = 5.0;
var TARGET_PKT_SIZE = 1000;
var old_rect_data = [];
var compression_type = 2;
var rect_intervalID = null;

this.onmessage = function (e) {
  var data = e.data;
  switch(data.command) {
    case 'init':
      good_worker = data.good_worker;
      break;
    case 'exit':
      self.close();
      break;
    case 'data_in':
      if(!rect_intervalID) process_data(data);
      break;
    case 'quickFinish':
      quickFinish();
      break;
    default:
      break;
  }
};

function process_data(input) {
  var data = input.data;
  var width = input.width;
  var height = input.height;
  var bit_count = input.bit_count;
  var use_grayscale = input.use_grayscale;
  var is_whole_frame = input.is_whole_frame;

  // decide how to divide the rect
  var divide_count = 1;
  var line_count = 1;
  var compressed_rowsize = ((width * bit_count + 7) >> 3) / avg_compress_ratio;
  if(compressed_rowsize > TARGET_PKT_SIZE) {
    divide_count++;
    while(compressed_rowsize / divide_count > TARGET_PKT_SIZE) divide_count++;
  } else if(compressed_rowsize * 2 < TARGET_PKT_SIZE) {
    line_count++;
    while(compressed_rowsize * line_count < TARGET_PKT_SIZE) line_count++;
    line_count--;
  }

  var rect_width = width;
  if(divide_count > 1) {
    rect_width = ((((width + divide_count - 1) / divide_count) >> 0) + 7) >> 3 << 3;
  }

  // get the rects
  var i = 0, j = 0, idx = 0;
  // for bit count that is less than 8, align the last rect's right according ly
  var aligned_width = width;
  if(bit_count == 4) aligned_width = width >> 1 << 1;
  if(bit_count == 2) aligned_width = width >> 2 << 2;
  if(bit_count == 1) aligned_width = width >> 3 << 3;

  rect_intervalID = setInterval(function () {
    for(j = 0; j < divide_count; j++, idx++) {
      var left = j * rect_width;
      var right = j == (divide_count - 1) ? aligned_width : (left + rect_width);
      var top = i;
      var bottom = top + line_count;
      if(bottom > height) bottom = height;
      processSingleRect(left, top, right, bottom, idx);
    }
    i += line_count;
    if(i >= height) {
      clearInterval(rect_intervalID);
      rect_intervalID = null;
      if(aligned_width != width) {
        processSingleRect(aligned_width, 0, width, height, idx++);
      }

      self.postMessage({ command: 'data_finish', avg: avg_compress_ratio });
    }
  }, 0);
  //return;

  function processSingleRect(left, top, right, bottom, idx) {
    var rect_rowsize = ((right - left) * bit_count + 7) >> 3;
    //console.log('*****debug, left=' + left + ',top=' + top + ',right=' + right + ',bottom=' + bottom);
    var rect_data = new Uint8Array((bottom - top) * rect_rowsize);
    var i, j, offset;
    var data_offset;
    for(i = top; i < bottom; i++) {
      var row_offset = (bottom - i - 1) * rect_rowsize;
      var data_row_offset = i * (width << 2);
      for(j = left; j < right; j++) {
        var col = j;
        var col_bit_offset = (col - left) * bit_count;
        var col_offset = col_bit_offset >> 3;
        offset = row_offset + col_offset;
        data_offset = data_row_offset + (j << 2);
        if(bit_count == 24) {
          rect_data[offset + 2] = data[data_offset++];  // r
          rect_data[offset + 1] = data[data_offset++];  // g
          rect_data[offset] = data[data_offset];  // b
        } else if(bit_count == 16) {
          var r = data[data_offset] >> 3;
          var g = data[data_offset + 1] >> 3;
          var b = data[data_offset + 2] >> 3;
          var word = r << 10 ^ g << 5 ^ b;
          rect_data[offset] = word & 0xff;
          rect_data[offset + 1] = (word >> 8) & 0xff;
        } else if(bit_count <= 8) {
          var col_byte_pos = col_bit_offset & 7;
          var r = data[data_offset];
          var g = data[data_offset + 1];
          var b = data[data_offset + 2];
          if(bit_count == 8) {
            /*
            r >>= 5;
            g >>= 5;
            b >>= 6;
            rect_data[offset] = r << 5 ^ g << 2 ^ b;
            */
            if(use_grayscale) {
              rect_data[offset] = (r + (r << 1) + (g << 2) + b) >>> 3;
            } else {
              rect_data[offset] = palette_8bit_transalte(r, g, b);
            }
          } else if(bit_count == 4) {
            if(use_grayscale) {
              var gray = (r + (r << 1) + (g << 2) + b) >>> 3;
              var shift = 4 - col_byte_pos;
              var mask = 0xff ^ (0xf << shift);
              rect_data[offset] = (rect_data[offset] & mask) ^ (gray >> 4 << shift);
            } else {
              var index = palette_4bit_transalte(r, g, b);
              var shift = 4 - col_byte_pos;
              var mask = 0xff ^ (0xf << shift);
              rect_data[offset] = (rect_data[offset] & mask) ^ (index << shift);
            }
          } else if(bit_count == 2) {
            var gray = (r + (r << 1) + (g << 2) + b) >>> 3;
            var shift = 6 - col_byte_pos;
            var mask = 0xff ^ (3 << shift);
            rect_data[offset] = (rect_data[offset] & mask) ^ (gray >> 6 << shift);
          } else if(bit_count == 1) {
            var gray = (r + (r << 1) + (g << 2) + b) >>> 3;
            var shift = 7 - col_byte_pos;
            var mask = 0xff ^ (1 << shift);
            rect_data[offset] = (rect_data[offset] & mask) ^ (gray >> 7 << shift);
          } else {
            return;
          }
        } else {
          return;
        }
      }
    }

    var old = old_rect_data[idx];
    old_rect_data[idx] = rect_data;
    if(!is_whole_frame && old && old.length == rect_data.length) {
      var same = true;
      var i;
      for(i = 0; i < rect_data.length; i++) {
        if(old[i] != rect_data[i]) {
          same = false;
          break;
        }
      }
      if(same) {
        return;
      }
    }
    
    try {
      // compression type
      // 0: none
      // 2: dynamic compression
      var option = { deflateOptions: { compressionType: compression_type} };
      var gzip = new Zlib.Gzip(rect_data, option);
      var output = gzip.compress();
      if(!output || !output.length) {
        return;
      }
      var ratio = rect_data.length / output.length;
      avg_compress_ratio += (ratio - avg_compress_ratio) * 0.02;
      avg_compress_ratio = Math.min(10, avg_compress_ratio);
      //console.log('******debug, ratio=' + ratio + ',avg=' + avg_compress_ratio);
      var area_str = '';
      area_str += String.fromCharCode(left & 0xff, left >> 8);
      area_str += String.fromCharCode((height - bottom) & 0xff, (height - bottom) >> 8);
      area_str += String.fromCharCode(right & 0xff, right >> 8);
      area_str += String.fromCharCode((height - top) & 0xff, (height - top) >> 8);
      if(good_worker) {
        self.postMessage({ command: 'data_out', data: output, area_str: area_str }, [output.buffer]);
      } else {
        self.postMessage({ command: 'data_out', data: output, area_str: area_str });
      }
    } catch(e) {
      return;
    }
  }
}

function quickFinish() {
  if(rect_intervalID) {
    clearInterval(rect_intervalID);
    rect_intervalID = null;
    self.postMessage({ command: 'data_finish', avg: avg_compress_ratio });
  }
}

function get_color_error(value1, value2) {
  return value1 > value2 ? value1 - value2 : value2 - value1;
}

// 8 bit
var palette_8bit_color = [0, 51, 102, 153, 204, 255];
var palette_8bit_gray = [8, 14, 19, 25, 31, 36, 42, 47, 58, 64, 70, 75, 81, 86, 92, 97, 109, 114, 120, 125, 131, 136, 142, 147, 159, 164, 170, 175, 181, 186, 192, 198, 209, 214, 220, 225, 231, 237, 242, 248];
var palette_8bit_color_translate_table = new Uint8Array(256);
var palette_8bit_color_error_table = new Uint8Array(256);
var palette_8bit_gray_translate_table = new Uint8Array(256);
//color_translate_table = [0@[0,25]; 51@[26,76]; 102@[77,127]; 153@[128,178]; 204@[179,229]; 255@[230,255]]
var i, j, k;
for(i = 0; i <= 25; i++) palette_8bit_color_translate_table[i] = 0, palette_8bit_color_error_table[i] = i;
for(i = 26; i <= 76; i++) palette_8bit_color_translate_table[i] = 1, palette_8bit_color_error_table[i] = i > 51 ? i - 51 : 51 - i;
for(i = 77; i <= 127; i++) palette_8bit_color_translate_table[i] = 2, palette_8bit_color_error_table[i] = i > 102 ? i - 102 : 102 - i;
for(i = 128; i <= 178; i++) palette_8bit_color_translate_table[i] = 3, palette_8bit_color_error_table[i] = i > 153 ? i - 153 : 153 - i;
for(i = 179; i <= 229; i++) palette_8bit_color_translate_table[i] = 4, palette_8bit_color_error_table[i] = i > 204 ? i - 204 : 204 - i;
for(i = 230; i <= 255; i++) palette_8bit_color_translate_table[i] = 5, palette_8bit_color_error_table[i] = 255 - i;
for(i = 0, j = 0; i < 256; i++) {
  if(i > palette_8bit_gray[j]
          && j != 39
          && palette_8bit_gray[j + 1] - i < i - palette_8bit_gray[j]) {
    j++;
  }
  palette_8bit_gray_translate_table[i] = j;
}
function palette_8bit_transalte(r, g, b) {
  var color_index = palette_8bit_color_translate_table[r] * 36 + palette_8bit_color_translate_table[g] * 6 + palette_8bit_color_translate_table[b];
  var color_error = palette_8bit_color_error_table[r] + palette_8bit_color_error_table[g] + palette_8bit_color_error_table[b];
  var max_diff = Math.max(r,g,b) - Math.min(r,g,b);
  if(max_diff >= color_error || max_diff >= 51) return color_index;
  var gray = (r + (r << 1) + (g << 2) + b) >>> 3;
  var gray_index = palette_8bit_gray_translate_table[gray];
  var gray_value = palette_8bit_gray[gray_index];
  var gray_error = get_color_error(r, gray_value) + get_color_error(g, gray_value) + get_color_error(b, gray_value);
  if(gray_error < color_error) return gray_index + 216;
  return color_index;
}

// 4 bit
var palette_4bit_color = [64, 192];
var palette_4bit_gray = [13, 38, 90, 115, 141, 166, 218, 243];
var palette_4bit_color_translate_table = new Uint8Array(256);
var palette_4bit_color_error_table = new Uint8Array(256);
var palette_4bit_gray_translate_table = new Uint8Array(256);
//color_translate_table = [64@[0,127]; 192@[128,255];]
for(i = 0; i <= 127; i++) palette_4bit_color_translate_table[i] = 0, palette_4bit_color_error_table[i] = i > 64 ? i - 64 : 64 - i;
for(i = 128; i <= 255; i++) palette_4bit_color_translate_table[i] = 1, palette_4bit_color_error_table[i] = i > 192 ? i - 192 : 192 - i;
for(i = 0, j = 0; i < 256; i++) {
  if(i > palette_4bit_gray[j]
          && j != 7
          && palette_4bit_gray[j + 1] - i < i - palette_4bit_gray[j]) {
    j++;
  }
  palette_4bit_gray_translate_table[i] = j;
}
function palette_4bit_transalte(r, g, b) {
  var color_index = palette_4bit_color_translate_table[r] * 4 + palette_4bit_color_translate_table[g] * 2 + palette_4bit_color_translate_table[b];
  var color_error = palette_4bit_color_error_table[r] + palette_4bit_color_error_table[g] + palette_4bit_color_error_table[b];
  var max_diff = Math.max(r, g, b) - Math.min(r, g, b);
  if(max_diff >= color_error || max_diff >= 128) return color_index;
  var gray = (r + (r << 1) + (g << 2) + b) >>> 3;
  var gray_index = palette_4bit_gray_translate_table[gray];
  var gray_value = palette_4bit_gray[gray_index];
  var gray_error = get_color_error(r, gray_value) + get_color_error(g, gray_value) + get_color_error(b, gray_value);
  if(gray_error < color_error) return gray_index + 8;
  return color_index;
}
