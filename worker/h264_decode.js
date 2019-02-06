importScripts('avc-codec.js');
importScripts('avc.js');
//https://github.com/mbebenita/broadway
//http://bkw.github.io/Broadway/storyDemo.html

var good_worker = false;
var avc;
var decoded_ok = false;

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
      init();
      break;
    case 'exit':
      self.close();
      break;
    case 'data_in':
      try {
        decoded_ok = false;
        avc.decode(data.data);
      } catch(e) {
        //if(!decoded_ok) self.postMessage({ command: 'data_error' });
      }
      if(!decoded_ok) {
        self.postMessage({ command: 'data_error' });
      }
      break;
    default:
      break;
  }
};

function init() {
  var defaultConfig = {
    filter: "original",
    filterHorLuma: "optimized",
    filterVerLumaEdge: "optimized",
    getBoundaryStrengthsA: "optimized"
  };
  avc = new Avc();
  avc.configure(defaultConfig);
  avc.onPictureDecoded = onPictureDecoded;
  init_table();
}

function onPictureDecoded(buffer, width, height) {
  decoded_ok = true;

  if(!buffer) {
    self.postMessage({ command: 'data_error' });
    return;
  }

  var rgba = new Uint8Array(width * height * 4);

  var lumaSize = width * height;
  var chromaSize = lumaSize >> 2;
  var y = buffer.subarray(0, lumaSize);
  var u = buffer.subarray(lumaSize, lumaSize + chromaSize);
  var v = buffer.subarray(lumaSize + chromaSize, lumaSize + 2 * chromaSize);

  var i, j, k, ky, k4;
  k = 0;
  ky = 0;
  var rgb;
  for(i = 0; i < (height >> 1); i++) {
    for(j = 0; j < (width >> 1); j++) {
      k4 = ky << 2;
      rgb = yuv2rgb(rgba, k4, y[ky], u[k], v[k]);
      rgba[k4 + 3] = 255;

      k4 = (ky + width) << 2;
      rgb = yuv2rgb(rgba, k4, y[ky + width], u[k], v[k]);
      rgba[k4 + 3] = 255;

      ky++;

      k4 = ky << 2;
      rgb = yuv2rgb(rgba, k4, y[ky], u[k], v[k]);
      rgba[k4 + 3] = 255;

      k4 = (ky + width) << 2;
      rgb = yuv2rgb(rgba, k4, y[ky + width], u[k], v[k]);
      rgba[k4 + 3] = 255;

      ky++;
      k++;
    }
    ky += width;
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

