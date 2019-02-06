importScripts('ogv-decoder-video-vp8.js');
//https://github.com/brion/ogv.js/
//https://brionv.com/misc/ogv.js/demo/
//https://brionv.com/misc/ogv.js/demo/lib/ogv.js
//https://brionv.com/misc/ogv.js/demo/lib/ogv-decoder-video-vp8.js
//https://tools.ietf.org/html/rfc6386

var Module = OGVDecoderVideoVP8();
var good_worker = false;
var decoded_ok = false;
var width = 0;

var clip = new Uint8Array(1024);
var tab_rv = new Uint16Array(256);
var tab_gu = new Uint16Array(256);
var tab_gv = new Uint16Array(256);
var tab_bu = new Uint16Array(256);

this.onmessage = function (e) {
  var data = e.data;
  switch(data.command) {
    case 'init':
      good_worker = data.good_worker;
      init_table();

      Module.init(function () { });
      break;
    case 'exit':
      self.close();
      break;
    case 'data_in':
      //console.log('is_keyframe=' + ((data.data[0] & 1) ? 0 : 1));
      if(!(data.data[0] & 1)) {
        width = ((data.data[7] & 0x3f) << 8) | data.data[6];
        //var height = ((data.data[9] & 0x3f) << 8) | data.data[8];
        //var width_scale = data.data[7] >> 6;
        //var height_scale = data.data[9] >> 6;
        //console.log('keyframe: width=' + width + ',height=' + height + ',width_scale=' + width_scale + ',height_scale=' + height_scale);
      }
      if(!width) {
        self.postMessage({ command: 'data_error' });
        return;
      }
      try {
        decoded_ok = false;
        Module.processFrame(data.data.buffer, function (ret) {
          if(ret) {
            var f = Module.frameBuffer;
            paint(f.bytesY, f.bytesCb, f.bytesCr, f.height, width, f.strideY)
          }
        });
      } catch(e) {
        width = 0;
        self.postMessage({ command: 'crash' });
        return;
      }
      if(!decoded_ok) {
        width = 0;
        self.postMessage({ command: 'data_error' });
      }
      break;
    default:
      break;
  }
};

function paint(y, u, v, height, width, stride) {
  decoded_ok = true;

  var rgba = new Uint8Array(width * height * 4);

  var lumaSize = width * height;
  var chromaSize = lumaSize >> 2;

  var i, j, k, ky, k4;
  k = 0;
  ky = 0;
  k4 = 0;
  var rgb;
  for(i = 0; i < (height >> 1); i++) {
    for(j = 0; j < (width >> 1); j++) {
      rgb = yuv2rgb(rgba, k4, y[ky], u[k], v[k]);
      rgba[k4 + 3] = 255;

      rgb = yuv2rgb(rgba, k4 + (width << 2), y[ky + stride], u[k], v[k]);
      rgba[k4 + (width << 2) + 3] = 255;

      ky++;
      k4 += 4;

      rgb = yuv2rgb(rgba, k4, y[ky], u[k], v[k]);
      rgba[k4 + 3] = 255;

      rgb = yuv2rgb(rgba, k4 + (width << 2), y[ky + stride], u[k], v[k]);
      rgba[k4 + (width << 2) + 3] = 255;

      ky++;
      k4 += 4;
      k++;
    }
    ky += stride + stride - width;
    k4 += (width << 2);
    k += (stride - width) >> 1;
  }

  if(good_worker) {
    self.postMessage({ command: 'data_out', data: rgba, width: width, height: height }, [rgba.buffer]);
  } else {
    self.postMessage({ command: 'data_out', data: rgba, width: width, height: height });
  }
}

function yuv2rgb0(rgba, idx, y, u, v) {
  var r, g, b;

  r = y + 1.4075 * (v - 128);
  g = y - 0.3455 * (u - 128) - (0.7169 * (v - 128));
  b = y + 1.7790 * (u - 128);

  r = Math.floor(r);
  g = Math.floor(g);
  b = Math.floor(b);

  if(r < 0) r = 0;
  else
    if(r > 255) r = 255;

  if(g < 0) g = 0;
  else
    if(g > 255) g = 255;

  if(b < 0) b = 0;
  else
    if(b > 255) b = 255;

  rgba[idx] = r;
  rgba[idx + 1] = g;
  rgba[idx + 2] = b;
}

function yuv2rgb(rgba, idx, y, u, v) {
  rgba[idx] = clip[y + tab_rv[v]];
  rgba[idx + 1] = clip[y + tab_gu[u] + tab_gv[v]];
  rgba[idx + 2] = clip[y + tab_bu[u]];
}

function init_table() {
  //r = y + 1.4075 * (v - 128);
  //g = y - 0.3455 * (u - 128) - (0.7169 * (v - 128));
  //b = y + 1.7790 * (u - 128);
  var i;
  for(i = 0; i < 256; i++) {
    tab_rv[i] = Math.floor(256 + 1.4075 * (i - 128));
    tab_gu[i] = Math.floor(128 - 0.3455 * (i - 128));
    tab_gv[i] = Math.floor(128 - 0.7169 * (i - 128));
    tab_bu[i] = Math.floor(256 + 1.7790 * (i - 128));
  }

  for(i = 512; i < 1024; i++) {
    clip[i] = 255;
  }

  for(i = 256; i < 512; i++) {
    clip[i] = i - 256;
  }
}

