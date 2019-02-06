angular.module('joinnet')
.service('imageMark', ['hmtgHelper', '$rootScope', 'hmtgSound', '$translate', 'appSetting', 'board',
  function (hmtgHelper, $rootScope, hmtgSound, $translate, appSetting, board) {
    var _imageMark = this;
    this.display_size = 32;
    this.mark_array0 = [];
    this.mark_size0 = 0;
    this.mark_size_str0 = hmtgHelper.number2gmk(this.mark_size0);
    this.show_mark0 = true;
    this.mark_array1 = [];
    this.mark_size1 = 0
    this.mark_size_str1 = hmtgHelper.number2gmk(this.mark_size1);
    this.show_mark1 = true;
    this.mark_loaded = false;
    this.is_mark_loading = false;
    this.file_input = document.getElementById('files');
    board.selected_mark = null;
    this.pen_width_map = {
      1: 1,
      2: 2,
      5: 3,
      8: 4,
      12: 5,
      20: 6
    };
    this.max_mark_data = 10000000;  // total mark data, 10mB

    this.is_same_mark = function (mark1, mark2) {
      if(mark1.data.length != mark2.data.length) return false;
      var i;
      for(i = 0; i < mark1.data.length; i++) {
        if(mark1.data[i] != mark2.data[i]) return false;
      }
      return true;
    }

    this.compare_mark = function (mark1, mark2) {
      var size1 = Math.max(mark1.width, mark1.height);
      var size2 = Math.max(mark2.width, mark2.height);
      if(size1 == size2) {
        return mark1.data.length - mark2.data.length;
      }
      return size1 - size2;
    }

    this.change_selected_mark = function (mark) {
      var old = board.selected_mark;
      if(old == mark) return;
      if(old) {
        old.img = null;
      }
      if(!mark.img) {
        var img = new Image();
        img.src = mark.url;
        mark.img = img;
      }
      board.selected_mark = mark;
      board.draw_slide(true); // quick draw
    }

    this.add_mark = function (mark) {
      var i;
      for(i = 0; i < this.mark_array1.length; i++) {
        if(this.is_same_mark(this.mark_array1[i], mark)) {
          this.change_selected_mark(this.mark_array1[i]);
          return false;
        }
      }
      for(i = 0; i < this.mark_array0.length; i++) {
        if(this.is_same_mark(this.mark_array0[i], mark)) {
          this.change_selected_mark(this.mark_array0[i]);
          return false;
        }
      }
      for(i = 0; i < this.mark_array1.length; i++) {
        if(this.compare_mark(mark, this.mark_array1[i]) < 0) {
          this.mark_array1.splice(i, 0, mark);
          return true;
        }
      }
      this.mark_array1.push(mark);
      return true;
    }

    this.delete_mark = function (mark) {
      var idx = this.mark_array1.indexOf(mark);
      if(idx == -1) return;
      if(board.selected_mark == mark) board.selected_mark = null;
      this.mark_size1 -= mark.data.length;
      _imageMark.mark_size_str1 = hmtgHelper.number2gmk(_imageMark.mark_size1);
      mark.img = null;
      window.URL.revokeObjectURL(mark.url);
      this.mark_array1.splice(idx, 1);
    }

    this.load_mark = function () {
      this.is_mark_loading = true;
      if(!hmtg.customization.builtin_mark_array) {
        this.is_mark_loading = false;
        this.mark_loaded = true;
        return;
      }
      var i = 0;
      if(i < hmtg.customization.builtin_mark_array.length) {
        load_single_mark(i);
      } else {
        this.is_mark_loading = false;
        this.mark_loaded = true;
      }

      function load_single_mark(i) {
        var img = new Image();
        img.addEventListener("load", function () {
          var canvas0 = document.createElement("canvas");
          var ctx0 = canvas0.getContext('2d');
          canvas0.width = img.width;
          canvas0.height = img.height;

          try {
            ctx0.drawImage(img, 0, 0);
            var url = canvas0.toDataURL();
            var parts = url.split(',');
            var byteString;
            if(parts[0].indexOf('base64') >= 0)
              byteString = hmtg.util.decode64(parts[1]);
            else
              byteString = unescape(parts[1]);

            var mark = {};
            mark.data = hmtg.util.str2array(byteString);
            mark.width = img.width;
            mark.height = img.height;
            mark.size_descr = '' + img.width + ' x ' + img.height;
            mark.datasize = hmtgHelper.number2gmk(mark.data.length);
            _imageMark.mark_array0.push(mark);
            _imageMark.mark_size0 += byteString.length;
            _imageMark.mark_size_str0 = hmtgHelper.number2gmk(_imageMark.mark_size0);
            mark.url = window.URL.createObjectURL(new Blob([mark.data], { type: 'image/png' }));
          } catch(e) {
          }
          i++;
          if(i < hmtg.customization.builtin_mark_array.length) {
            load_single_mark(i);
          } else {
            _imageMark.is_mark_loading = false;
            _imageMark.mark_loaded = true;
          }
        }, false);
        img.addEventListener("error", function () {
          i++;
          if(i < hmtg.customization.builtin_mark_array.length) {
            load_single_mark(i);
          } else {
            _imageMark.is_mark_loading = false;
            _imageMark.mark_loaded = true;
          }
        }, false);
        img.src = hmtg.customization.builtin_mark_location + hmtg.customization.builtin_mark_array[i];
      }
    }

    this.open_mark = function () {
      if(_imageMark.adding) return;

      if(this.mark_size1 >= this.max_mark_data) {
        hmtgHelper.MessageBox($translate.instant('ID_TOO_MANY_MARK'), 20);
        return;
      }

      _imageMark.file_input = hmtgHelper.file_reset('files', 'image/*');

      _imageMark.file_input.addEventListener("change", _open, false);
      if(window.navigator.msSaveOrOpenBlob) {
        setTimeout(function () {
          _imageMark.file_input.click();  // use timeout, otherwise, IE will complain error
        }, 0);
      } else {
        // it is necessary to exempt error here
        // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
        window.g_exempted_error++;
        _imageMark.file_input.click();
        window.g_exempted_error--;
      }
      function _open() {
        _imageMark.file_input.removeEventListener("change", _open, false);
        var i = 0;
        var orig_total = _imageMark.file_input.files.length;
        if(orig_total == 0) return;

        if(orig_total != 1) {
          _imageMark.adding = true;
        }

        _imageMark.add_total = 0;
        _imageMark.add_error = 0;
        _imageMark.add_skip = 0;
        _imageMark.add_ok = 0;
        _imageMark.add_changed = 0;

        read_file(i);

        function read_file(i) {
          var file = _imageMark.file_input.files[i];
          i++;
          if(!file || _imageMark.mark_size1 >= _imageMark.max_mark_data) {
            _imageMark.adding = false;
            displaySummary();
            return;
          }
          if(file.size > appSetting.max_blob * 1048576) {
            onerror();
            return;
          }

          function onerror() {
            if(orig_total == 1) {
              hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_IMAGE') }, 20);
            } else {
              _imageMark.add_total++;
              _imageMark.add_error++;
              read_file(i);
            }
          }

          var reader = new FileReader();
          reader.onload = function (e) {
            var blob;
            var url;
            try {
              if(e.target.result.byteLength > appSetting.max_blob * 1048576) {
                onerror();
                return;
              }
              blob = new Blob([e.target.result]);
              var f = function () {
                read_file(i);
              }
              if(orig_total == 1) {
                blob2mark(blob);
              } else {
                blob2mark(blob, f);
              }
            } catch(e) {
              onerror();
              return;
            }
          }
          reader.onerror = function (e) {
            if(orig_total == 1) {
              hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_IMAGE_FILE_READ_ERROR') }, 20);
            } else {
              _imageMark.add_total++;
              _imageMark.add_error++;
              read_file(i);
            }
          };

          reader.readAsArrayBuffer(file);
        }

        function displaySummary() {
          hmtgSound.ShowInfoPrompt(function () {
            var str = '';
            if(_imageMark.add_total < orig_total) {
              _imageMark.add_skip += orig_total - _imageMark.add_total;
              _imageMark.add_total = orig_total;
            }
            str += $translate.instant('ID_ADD_MARK_TOTAL').replace('#N#', _imageMark.add_total);
            if(_imageMark.add_ok) {
              str += '\n' + $translate.instant('ID_ADD_MARK_OK').replace('#N#', _imageMark.add_ok);
            }
            if(_imageMark.add_changed) {
              str += '(' + $translate.instant('ID_IMPORT_MARK_DOWNSAMPLED').replace('#N#', _imageMark.add_changed) + ')';
            }
            if(_imageMark.add_skip) {
              str += '\n' + $translate.instant('ID_IMPORT_MARK_SKIP').replace('#N#', _imageMark.add_skip);
            }
            if(_imageMark.add_error) {
              str += '\n' + $translate.instant('ID_IMPORT_MARK_ERROR').replace('#N#', _imageMark.add_error);
            }
            return str;
          }, 20);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_IMAGE_MARK);
        }
      }
    }

    function blob2mark(blob, onfinish) {
      var url;
      url = window.URL.createObjectURL(blob);
      function onerror() {
        if(!onfinish) {
          hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_IMAGE') }, 20);
        } else {
          _imageMark.add_total++;
          _imageMark.add_error++;
          onfinish();
        }
      }
      var img = new Image();
      img.addEventListener("load", function () {
        window.URL.revokeObjectURL(url);

        var canvas0 = document.createElement("canvas");
        var ctx0 = canvas0.getContext('2d');
        var shift = 0;

        for(; ; shift++) {
          canvas0.width = img.width >> shift;
          canvas0.height = img.height >> shift;
          if(canvas0.width <= 1 || canvas0.height <= 1) {
            onerror();
            break;
          }
          try {
            ctx0.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas0.width, canvas0.height);
          } catch(e) {
            onerror();
            break;
          }

          var url = canvas0.toDataURL();
          var parts = url.split(',');
          var byteString;
          if(parts[0].indexOf('base64') >= 0)
            byteString = hmtg.util.decode64(parts[1]);
          else
            byteString = unescape(parts[1]);

          if(byteString.length <= board.max_single_mark_size) {
            var mark = {};
            mark.data = hmtg.util.str2array(byteString);
            mark.width = canvas0.width;
            mark.height = canvas0.height;
            mark.size_descr = '' + canvas0.width + ' x ' + canvas0.height;
            mark.datasize = hmtgHelper.number2gmk(mark.data.length);
            if(_imageMark.add_mark(mark)) {
              _imageMark.mark_size1 += byteString.length;
              _imageMark.mark_size_str1 = hmtgHelper.number2gmk(_imageMark.mark_size1);
              mark.url = window.URL.createObjectURL(new Blob([mark.data], { type: 'image/png' }));
              _imageMark.change_selected_mark(mark);

              if(onfinish) {
                _imageMark.add_total++;
                _imageMark.add_ok++;
              }
              if(shift) {
                if(!onfinish) {
                  hmtgSound.ShowInfoPrompt(function () { return $translate.instant('ID_IMAGE_MARK_DOWNSAMPLED') }, 20);
                } else {
                  _imageMark.add_changed++;
                }
              }
            } else {
              if(!onfinish) {
                hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_EXIST_IMAGE_MARK') }, 20);
              } else {
                _imageMark.add_total++;
                _imageMark.add_skip++;
              }
            }
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_IMAGE_MARK);
            if(onfinish) {
              onfinish();
            }
            break;
          } else {
            var ratio = byteString.length / board.max_single_mark_size;
            while((1 << shift) * (1 << shift) < ratio / 4)
              shift++;
          }
        }
      }, false);
      img.addEventListener("error", function () {
        window.URL.revokeObjectURL(url);
        onerror();
      }, false);
      img.src = url;
    }

    this.paste_mark = function (blob) {
      if(this.mark_size1 >= this.max_mark_data) {
        hmtgHelper.MessageBox($translate.instant('ID_TOO_MANY_MARK'), 20);
        return;
      }
      blob2mark(blob);
    }

    this.toggle_show_mark0 = function () {
      this.show_mark0 = !this.show_mark0;
    }

    this.toggle_show_mark1 = function () {
      this.show_mark1 = !this.show_mark1;
    }

    this.import_mark = function () {
      if(this.mark_size1 >= this.max_mark_data) {
        hmtgHelper.MessageBox($translate.instant('ID_TOO_MANY_MARK'), 20);
        return;
      }

      if(board.mark_importing_thread) {
        board.mark_importing_thread.stop();  // stop current drawing thread
        board.mark_importing_thread = null;
      }
      this.importing = true;
      this.import_total = 0;
      this.import_error = 0;
      this.import_skip = 0;
      this.import_ok = 0;
      this.import_changed = 0;
      board.mark_importing_thread = new draw();
    }
    function draw() {
      var _draw = this;
      _draw.stop = function () {
        _imageMark.importing = false;
        if(_imageMark.import_ok) {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_IMAGE_MARK);
        }
        _draw.stop = function () { }
      }

      drawMark();

      function drawMark() {
        var draw_mark_thread = new drawMarkThread(function () {
          finishDraw();
        });
        // the following line require that the above thread MUST take asynchronous onfinish
        _draw.stop = function () {
          draw_mark_thread.stop();
          _imageMark.importing = false;
          if(_imageMark.import_ok) {
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_IMAGE_MARK);
          }
          _draw.stop = function () { }
        }
      }

      function drawMarkThread(onfinish) {
        var _drawMarkThread = this;
        var i = 0;
        var draw_intervalID = setInterval(draw_mark, 0);

        function normal_stop() {
          clearInterval(draw_intervalID);
          _drawMarkThread.stop = function () { }
        }

        _drawMarkThread.stop = normal_stop;

        function draw_mark() {
          var start_tick = hmtg.util.GetTickCount();
          for(; i < board.mark_array.length; i++) {
            if(hmtg.util.GetTickCount() - start_tick >= 10) return;
            var mark = board.mark_array[i];
            var _mark = mark.link;
            if(_mark._m_byMarkType() == hmtg.config.MARK_CUSTOMIZED) {
              var type2 = _mark._m_iCustomizedMarkType();
              if((type2 == 1 || type2 == 4 || type2 == 5) && mark.unzipped_data) {
                i++;  // keep index valid
                clearInterval(draw_intervalID);
                var thread = new draw_stamp(mark, type2, function () {
                  if(_imageMark.mark_size1 >= _imageMark.max_mark_data) {
                    // too many marks
                    _drawMarkThread.stop = function () { }
                    onfinish();
                  }
                  draw_intervalID = setInterval(draw_mark, 0);
                  _drawMarkThread.stop = normal_stop;
                });
                // the following line require that the above thread MUST take asynchronous onfinish
                _drawMarkThread.stop = function () {
                  thread.stop();
                  _drawMarkThread.stop = function () { }
                }
                return;
              } else {
                //draw_customized(mark);
              }
            }
          }
          clearInterval(draw_intervalID);
          _drawMarkThread.stop = function () { }

          onfinish();
        }

        function draw_stamp(mark, type2, onfinish) {
          var _draw_stamp = this;
          var data = mark.unzipped_data;
          var blob;
          var url;
          var img = new Image();
          try {
            if(data.length > appSetting.max_blob * 1048576) {
              // asynchronously call is necessary here
              hmtgHelper.async_finish(this, onerror);
              return;
            }
            blob = new Blob([data], { type: (type2 == 5 ? 'image/png' : 'image/bmp') });
            url = window.URL.createObjectURL(blob);
          } catch(e) {
            // asynchronously call is necessary here
            hmtgHelper.async_finish(this, onerror);
            return;
          }
          function onerror() {
            _imageMark.import_error++;
            _imageMark.import_total++;
            onfinish();
          }
          var aborted = false;
          function img_onload() {
            window.URL.revokeObjectURL(url);
            if(aborted) return;

            if(type2 == 5) {
              var new_mark = {};
              new_mark.data = data;
              new_mark.width = img.width;
              new_mark.height = img.height;
              new_mark.size_descr = '' + img.width + ' x ' + img.height;
              new_mark.datasize = hmtgHelper.number2gmk(new_mark.data.length);
              if(_imageMark.add_mark(new_mark)) {
                _imageMark.mark_size1 += data.length;
                _imageMark.mark_size_str1 = hmtgHelper.number2gmk(_imageMark.mark_size1);
                new_mark.url = window.URL.createObjectURL(new Blob([new_mark.data], { type: 'image/png' }));
                _imageMark.change_selected_mark(new_mark);
                _imageMark.import_ok++;
                _imageMark.import_total++;
              } else {
                _imageMark.import_skip++;
                _imageMark.import_total++;
              }
            } else if(type2 == 1) {
              img2mark(img, img.width, img.height);
            } else {
              var img_error = false;
              board.canvas4.width = img.width;
              board.canvas4.height = img.height;
              try {
                board.ctx4.drawImage(img, 0, 0);
              } catch(e) {
                _imageMark.import_error++;
                _imageMark.import_total++;
                img_error = true;
              }

              if(!img_error) {
                try {
                  // copy alpha value if neccessary
                  if(mark.is_32bit_bmp) {
                    var pixels = board.ctx4.getImageData(0, 0, img.width, img.height);
                    var i, j;
                    for(i = 0; i < img.height; i++) {
                      var src = mark.bmp_data_offset + (img.height - 1 - i) * img.width * 4;
                      var dst = i * img.width * 4;
                      for(j = 0; j < img.width; j++, src += 4, dst += 4) {
                        pixels.data[dst + 3] = mark.unzipped_data[src + 3];
                      }
                    }
                    board.ctx4.putImageData(pixels, 0, 0);
                  }

                  img2mark(board.canvas4, img.width, img.height);
                } catch(e) {
                  _imageMark.import_error++;
                  _imageMark.import_total++;
                }
              }
            }
            onfinish();

            function img2mark(img, width, height) {
              _imageMark.import_total++;
              var canvas0 = document.createElement("canvas");
              var ctx0 = canvas0.getContext('2d');
              var shift = 0;

              for(; ; shift++) {
                canvas0.width = width >> shift;
                canvas0.height = height >> shift;
                if(canvas0.width <= 1 || canvas0.height <= 1) {
                  _imageMark.import_error++;
                  break;
                }
                try {
                  ctx0.drawImage(img, 0, 0, width, height, 0, 0, canvas0.width, canvas0.height);
                } catch(e) {
                  _imageMark.import_error++;
                  break;
                }

                var url = canvas0.toDataURL();
                var parts = url.split(',');
                var byteString;
                if(parts[0].indexOf('base64') >= 0)
                  byteString = hmtg.util.decode64(parts[1]);
                else
                  byteString = unescape(parts[1]);

                if(byteString.length <= board.max_single_mark_size) {
                  var new_mark = {};
                  new_mark.data = hmtg.util.str2array(byteString);
                  new_mark.width = canvas0.width;
                  new_mark.height = canvas0.height;
                  new_mark.size_descr = '' + canvas0.width + ' x ' + canvas0.height;
                  new_mark.datasize = hmtgHelper.number2gmk(new_mark.data.length);
                  if(_imageMark.add_mark(new_mark)) {
                    _imageMark.mark_size1 += byteString.length;
                    _imageMark.mark_size_str1 = hmtgHelper.number2gmk(_imageMark.mark_size1);
                    new_mark.url = window.URL.createObjectURL(new Blob([new_mark.data], { type: 'image/png' }));
                    _imageMark.change_selected_mark(new_mark);

                    _imageMark.import_ok++;
                    if(shift) {
                      _imageMark.import_changed++;
                    }
                  } else {
                    _imageMark.import_skip++;
                  }
                  break;
                } else {
                  var ratio = byteString.length / board.max_single_mark_size;
                  while((1 << shift) * (1 << shift) < ratio / 4)
                    shift++;
                }
              }
            }
          }
          function img_onerror() {
            window.URL.revokeObjectURL(url);
            if(aborted) return;

            onerror();
          }
          img.addEventListener("load", img_onload, false);
          img.addEventListener("error", img_onerror, false);
          img.src = url;

          _draw_stamp.stop = function () {
            aborted = true;
            window.URL.revokeObjectURL(url);
            //img.removeEventListener("load", img_onload, false);
            //img.removeEventListener("error", img_onerror, false);
            _draw_stamp.stop = function () { }
          }
        }
      }

      function finishDraw() {
        // done!
        _imageMark.importing = false;
        _draw.stop = function () { }

        hmtgSound.ShowInfoPrompt(function () {
          var str = '';
          str += $translate.instant('ID_IMPORT_MARK_TOTAL').replace('#N#', _imageMark.import_total);
          if(_imageMark.import_ok) {
            str += '\n' + $translate.instant('ID_IMPORT_MARK_OK').replace('#N#', _imageMark.import_ok);
          }
          if(_imageMark.import_changed) {
            str += '(' + $translate.instant('ID_IMPORT_MARK_DOWNSAMPLED').replace('#N#', _imageMark.import_changed) + ')';
          }
          if(_imageMark.import_skip) {
            str += '\n' + $translate.instant('ID_IMPORT_MARK_SKIP').replace('#N#', _imageMark.import_skip);
          }
          if(_imageMark.import_error) {
            str += '\n' + $translate.instant('ID_IMPORT_MARK_ERROR').replace('#N#', _imageMark.import_error);
          }
          return str;
        }, 20);
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_IMAGE_MARK);
      }
    }

  }
])

.controller('ImageMarkCtrl', ['$scope', '$rootScope', '$modalInstance', 'imageMark', 'hmtgHelper', 'appSetting', 'board',
  function ($scope, $rootScope, $modalInstance, imageMark, hmtgHelper, appSetting, board) {
    $scope.w = imageMark;
    $scope.as = appSetting;
    $scope.bd = board;
    $scope.display_size = imageMark.display_size;
    $scope.loading_intervalID = null;
    $scope.can_paste_mark = !!window.ClipboardEvent;

    window.addEventListener("paste", pasteHandler);
    $scope.$on('$destroy', function () {
      window.removeEventListener("paste", pasteHandler);
    });

    function pasteHandler(e) {
      if(e.clipboardData) {
        var items = e.clipboardData.items;
        if(items) {
          for(var i = 0; i < items.length; i++) {
            if(items[i].type.indexOf("image") !== -1) {
              var blob = items[i].getAsFile();
              imageMark.paste_mark(blob);
            }
          }
        }
      }
    }

    if(!imageMark.mark_loaded) {
      if(!imageMark.mark_loaded) {
        if(!imageMark.is_mark_loading) {
          hmtgHelper.inside_angular++;
          imageMark.load_mark();
          hmtgHelper.inside_angular--;
        }
      }
      $scope.loading_intervalID = setInterval(function () {
        $scope.$digest();
        if(imageMark.mark_loaded) {
          clearInterval($scope.loading_intervalID);
          $scope.loading_intervalID = null;
        }
      }, 1000);
    }

    function stop_loading_interval() {
      if($scope.loading_intervalID) {
        clearInterval($scope.loading_intervalID);
        $scope.loading_intervalID = null;
      }
    }

    function change_img_size() {
      imageMark.display_size = $scope.display_size;
      $scope.style_img = {
        'max-width': '' + $scope.display_size + 'px',
        'max-height': '' + $scope.display_size + 'px',
        'min-width': '32px'
      };
      $scope.style_selected_img = {
        'max-width': '' + $scope.display_size + 'px',
        'max-height': '' + $scope.display_size + 'px'
      };
    }

    change_img_size();
    $scope.$watch('display_size', change_img_size);

    $scope.$watch('as.can_show_image_bar', function () {
      if(!$scope.as.can_show_image_bar && !$scope.as.can_show_bottom_image_bar) $scope.as.can_show_bottom_image_bar = true;
      hmtg.util.localStorage['hmtg_can_show_image_bar'] = JSON.stringify($scope.as.can_show_image_bar);
    });
    $scope.$watch('as.can_show_bottom_image_bar', function () {
      if(!$scope.as.can_show_image_bar && !$scope.as.can_show_bottom_image_bar) $scope.as.can_show_image_bar = true;
      hmtg.util.localStorage['hmtg_can_show_bottom_image_bar'] = JSON.stringify($scope.as.can_show_bottom_image_bar);
    });
    $scope.$watch('as.image_bar_item_size', function () {
      hmtg.util.localStorage['hmtg_image_bar_item_size'] = JSON.stringify($scope.as.image_bar_item_size);
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_IMAGE_BAR_ITEM_SIZE);
      hmtgHelper.inside_angular--;
    });
    //$scope.$watch('as.use_png_mark', function () {
      //hmtg.util.localStorage['hmtg_use_png_mark'] = JSON.stringify($scope.as.use_png_mark);
    //});

    $scope.$on(hmtgHelper.WM_UPDATE_IMAGE_MARK, function () {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.select_mark = function (mark) {
      imageMark.change_selected_mark(mark);
    }

    $scope.delete_mark = function (mark) {
      imageMark.delete_mark(mark);
    }

    $scope.open = function () {
      imageMark.open_mark();
    }

    $scope.import_mark = function () {
      imageMark.import_mark();
    }

    $scope.save = function () {
      if(!board.selected_mark) return;
      var name = 'image_mark.png';
      var blob = new Blob([board.selected_mark.data], { type: 'image/png' })
      hmtgHelper.save_file(blob, name);
    }

    $scope.ok = function () {
      stop_loading_interval();
      $modalInstance.dismiss('cancel');
    };

    $scope.cancel = function () {
      stop_loading_interval();
      $modalInstance.dismiss('cancel');
    };
  }
])

.controller('ImageBarCtrl', ['$scope', '$element', 'imageMark', 'hmtgHelper', 'appSetting', 'board', '$modal', '$rootScope',
  function ($scope, $element, imageMark, hmtgHelper, appSetting, board, $modal, $rootScope) {
    $scope.w = imageMark;
    $scope.as = appSetting;
    $scope.bd = board;
    $scope.selected_display_size = 32;
    $scope.loading_intervalID = null;
    var $p = $element.parent();
    $scope.position = ($p && $p[0] && $p[0].id == 'bottom_bar') ? 'top' : 'bottom';
    //hmtg.util.log(-2, 'id=' + $element.parent()[0].id);
    $scope.style_selected_img = {
      'max-width': '' + $scope.selected_display_size + 'px',
      'max-height': '' + $scope.selected_display_size + 'px'
    };

    function update_image_bar_item_size() {
      $scope.style_img = {
        'max-width': '' + appSetting.image_bar_item_size + 'px',
        'max-height': '' + appSetting.image_bar_item_size + 'px',
        'min-width': '' + appSetting.image_bar_item_size + 'px'
      };
    }
    update_image_bar_item_size();

    if(!imageMark.mark_loaded) {
      if(!imageMark.mark_loaded) {
        if(!imageMark.is_mark_loading) {
          hmtgHelper.inside_angular++;
          imageMark.load_mark();
          hmtgHelper.inside_angular--;
        }
      }
      $scope.loading_intervalID = setInterval(function () {
        $scope.$digest();
        if(imageMark.mark_loaded) {
          clearInterval($scope.loading_intervalID);
          $scope.loading_intervalID = null;
        }
      }, 1000);
    }

    function stop_loading_interval() {
      if($scope.loading_intervalID) {
        clearInterval($scope.loading_intervalID);
        $scope.loading_intervalID = null;
      }
    }

    $scope.$on(hmtgHelper.WM_UPDATE_IMAGE_MARK, function () {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_UPDATE_IMAGE_BAR_ITEM_SIZE, function () {
      update_image_bar_item_size();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.select_mark = function (mark) {
      imageMark.change_selected_mark(mark);
    }

    $scope.open = function () {
      imageMark.open_mark();
    }

    $scope.import_mark = function () {
      imageMark.import_mark();
    }

    $scope.ok = function () {
      stop_loading_interval();
      $modalInstance.dismiss('cancel');
    };

    $scope.cancel = function () {
      stop_loading_interval();
      $modalInstance.dismiss('cancel');
    };
  }
])

;