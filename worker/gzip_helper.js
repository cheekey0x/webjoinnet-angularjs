importScripts("gzip.min.js");
importScripts("gunzip.min.js");
importScripts("zlib.min.js");
//https://github.com/imaya/zlib.js

var good_worker = false;

this.onmessage = function (e) {
  var data = e.data;
  switch(data.command) {
    case 'init':
      good_worker = data.good_worker;
      break;
    case 'exit':
      self.close();
      break;
    case 'zip':
      try {
        // compression type
        // 0: none
        // 2: dynamic compression
        var option = { deflateOptions: { compressionType: data.compression_type} };
        var gzip = new Zlib.Gzip(data.data, option);
        var output = gzip.compress();
        if(!output || !output.length) {
          self.postMessage({ command: 'error' });
          return;
        }
        if(good_worker) {
          self.postMessage({ command: 'data_out', data: output }, [output.buffer]);
        } else {
          self.postMessage({ command: 'data_out', data: output });
        }
      } catch(e) {
        self.postMessage({ command: 'error' });
        return;
      }

      break;
    case 'unzip':
      try {
        var gunzip = new Zlib.Gunzip(data.data);
        var output = gunzip.decompress();
        if(!output || !output.length) {
          self.postMessage({ command: 'error' });
          return;
        }
        if(good_worker) {
          self.postMessage({ command: 'data_out', data: output }, [output.buffer]);
        } else {
          self.postMessage({ command: 'data_out', data: output });
        }
      } catch(e) {
        self.postMessage({ command: 'error' });
        return;
      }
      break;
    case 'zlib_compress':
      try {
        var deflate = new Zlib.Deflate(data.data);
        var output = deflate.compress();
       if(!output || !output.length) {
          self.postMessage({ command: 'error' });
          return;
        }
        if(good_worker) {
          self.postMessage({ command: 'data_out', data: output }, [output.buffer]);
        } else {
          self.postMessage({ command: 'data_out', data: output });
        }
      } catch(e) {
        self.postMessage({ command: 'error' });
        return;
      }

      break;
    case 'zlib_decompress':
      try {
        var inflate = new Zlib.Inflate(data.data);
        var output = inflate.decompress();
        if(!output || !output.length) {
          self.postMessage({ command: 'error' });
          return;
        }
        if(good_worker) {
          self.postMessage({ command: 'data_out', data: output }, [output.buffer]);
        } else {
          self.postMessage({ command: 'data_out', data: output });
        }
      } catch(e) {
        self.postMessage({ command: 'error' });
        return;
      }
      break;
    default:
      break;
  }
};

