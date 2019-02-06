angular.module('joinnet')
.controller('UploadSlideModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', 'hmtgHelper', 'board', '$rootScope',
  'appSetting', 'hmtgSound',
  function($scope, $modalInstance, $modal, $translate, hmtgHelper, board, $rootScope, appSetting, hmtgSound) {
    // upload_type, 1: blank page; 2: slide; 3: file; 4: my picture; 5: IM file transfer
    var canvas; // display canvas
    var ctx;
    var width0; // used to calculate the ratio of the display canvas
    var img;  // source image
    var crop_left;  // element of the four cropping bar
    var crop_top;
    var crop_right;
    var crop_bottom;
    $scope.w = {};
    $scope.bd = board;
    $scope.as = appSetting;
    $scope.loading = false;
    $scope.w.upload_type = $scope.upload_type;
    $scope.can_paste_mark = !!window.ClipboardEvent;
    $scope.rotate_degree = 0;
    $scope.w.cropping = false;
    $scope.w.can_crop = false;
    $scope.w.left = $scope.w.right = $scope.w.top = $scope.w.bottom = 0;
    $scope.w.empty_image = false;
    var png_blob_timerID;

    var intervalID = setInterval(function() {
      var input = document.getElementById('file_name');
      if(!input) return;
      width0 = input.clientWidth;
      if(!width0) return;
      crop_left = document.getElementById('crop_left');
      if(!crop_left) return;
      crop_top = document.getElementById('crop_top');
      if(!crop_top) return;
      crop_right = document.getElementById('crop_right');
      if(!crop_right) return;
      crop_bottom = document.getElementById('crop_bottom');
      if(!crop_bottom) return;

      clearInterval(intervalID);
      intervalID = null;

      if(img) {
        crop_left.max = crop_right.max = img.naturalWidth;
        crop_top.max = crop_bottom.max = img.naturalHeight;
        $scope.w.can_crop = img.naturalWidth && img.naturalHeight;
      }

      canvas = document.getElementById('upload_thumbnail');
      ctx = canvas.getContext('2d');
      draw(true);
      $scope.$digest();
    }, 100);

    window.addEventListener("paste", pasteHandler);
    $scope.$on('$destroy', function() {
      window.removeEventListener("paste", pasteHandler);
    });

    function is_file_image(filename) {
      var name = filename.toLowerCase();
      return (hmtg.util.endsWith(name, '.jpg')
      || hmtg.util.endsWith(name, '.jpeg')
      || hmtg.util.endsWith(name, '.gif')
      || hmtg.util.endsWith(name, '.svg')
      || hmtg.util.endsWith(name, '.png')
      || hmtg.util.endsWith(name, '.bmp')
      );
    }

    function is_file_image2(filename) {
      var name = filename.toLowerCase();
      return (hmtg.util.endsWith(name, '.jpg')
      || hmtg.util.endsWith(name, '.jpeg')
      || hmtg.util.endsWith(name, '.gif')
      || hmtg.util.endsWith(name, '.svg')
      || hmtg.util.endsWith(name, '.png')
      );
    }

    function is_file_pdf(filename) {
      var name = filename.toLowerCase();
      return (hmtg.util.endsWith(name, '.pdf')
      );
    }

    function pasteHandler(e) {
      if(e.clipboardData) {
        var items = e.clipboardData.items;
        if(items) {
          for(var i = 0; i < items.length; i++) {
            if(items[i].type.indexOf("image") !== -1) {
              var blob = items[i].getAsFile();
              img = new Image;

              $scope.upload_file = blob;
              $scope.w.png_blob0 = $scope.w.png_blob = null;
              if($scope.w.upload_type != 2 && $scope.w.upload_type != 4 && $scope.w.upload_type != 5) {
                $scope.w.upload_type = $scope.upload_type = 2;
                $scope.w.title = $translate.instant('ID_UPLOAD_SLIDE');
              }
              $scope.rotate_degree = 0;
              $scope.w.cropping = false;
              $scope.w.can_crop = false;
              $scope.w.left = $scope.w.right = $scope.w.top = $scope.w.bottom = 0;
              $scope.w.as_file = false;
              $scope.w.need_conversion = false;
              $scope.w.no_conversion = false;
              $scope.w.use_group = false;
              $scope.w.group = '';
              $scope.w.group_title = '';
              $scope.w.filename = $scope.w.slide_title = $scope.upload_file.name = 'paste.png';
              $scope.w.filesize_descr0 = $scope.w.filesize_descr = '' + hmtgHelper.number2GMK(blob.size) + 'B(' + blob.size + ')';
              var url = window.URL.createObjectURL(blob);
              var img_onload = function() {
                window.URL.revokeObjectURL(url);
                $scope.w.img_descr = '' + img.naturalWidth + ' x ' + img.naturalHeight;
                $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_IMAGE_LOADED);
                img.removeEventListener("load", img_onload, false);
                img.removeEventListener("error", img_onerror, false);
                update_image();
              }
              var img_onerror = function() {
                window.URL.revokeObjectURL(url);
                loading_fails();
                img.removeEventListener("load", img_onload, false);
                img.removeEventListener("error", img_onerror, false);
                update_image();
              };
              $scope.w.empty_image = false;
              img.addEventListener("load", img_onload, false);
              img.addEventListener("error", img_onerror, false);
              img.src = url;
              $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_IMAGE_LOADED);
            }
          }
        }
      }
    }

    $scope.w.use_group = false;
    $scope.w.slide_title = $scope.w.group_title = $scope.w.group = $scope.w.filename = '';
    var id;
    switch($scope.w.upload_type) {
      case 1:
        id = 'ID_UPLOAD_BLANK_PAGE';
        break;
      case 2:
        id = 'ID_UPLOAD_SLIDE';
        break;
      case 3:
        id = 'ID_UPLOAD_FILE';
        break;
      case 4:
        id = 'ID_MYPICTURE';
        break;
      case 5:
      default:
        id = 'ID_TRANSFER';
        break;
    }
    $scope.w.title = $translate.instant(id);
    $scope.w.as_file = $scope.w.upload_type == 3;
    function loading_fails() {
      $scope.w.empty_image = true;
      if(is_file_image($scope.upload_file.name)) return;
      $scope.w.use_group = true;
      $scope.w.group = $scope.w.filename;
      $scope.w.need_conversion = hmtg.jnkernel._jn_conversion_support() ? true : false;
      if(board.is_local_slide) {
        $scope.w.need_conversion = false;
      }
      $scope.w.no_conversion = !$scope.w.need_conversion;

      $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_IMAGE_LOADED);
    }
    if($scope.upload_file) {
      $scope.w.filename = $scope.w.slide_title = $scope.upload_file.name;
      $scope.w.filesize_descr0 = $scope.w.filesize_descr = '' + hmtgHelper.number2GMK($scope.upload_file.size) + 'B(' + $scope.upload_file.size + ')';

      var exceed_memory = false;
      if(board.is_local_slide) {
        if(board.memory_usage + hmtg.jnkernel._memory_usage() + $scope.upload_file.size > appSetting.max_blob * 1048576) {
          exceed_memory = true;
        }
      }
      if(!exceed_memory && $scope.upload_file.size <= appSetting.max_blob * 1048576) {
        $scope.loading = true;
        var url = window.URL.createObjectURL($scope.upload_file);
        setTimeout(function() {
          if(is_file_pdf($scope.upload_file.name)) {
            $scope.loading = false;
            loading_fails();
            return;
          }
          img = new Image;
          function img_onload() {
            $scope.loading = false;
            window.URL.revokeObjectURL(url);
            $scope.w.img_descr = '' + img.naturalWidth + ' x ' + img.naturalHeight;
            if(!is_file_image2($scope.upload_file.name)) {
              var canvas0 = document.createElement("canvas");
              var ctx0 = canvas0.getContext('2d');
              canvas0.width = img.naturalWidth;
              canvas0.height = img.naturalHeight;

              try {
                ctx0.drawImage(img, 0, 0);
                var url = canvas0.toDataURL();
                var parts = url.split(',');
                var byteString;
                if(parts[0].indexOf('base64') >= 0)
                  byteString = hmtg.util.decode64(parts[1]);
                else
                  byteString = unescape(parts[1]);

                $scope.w.png_blob0 = $scope.w.png_blob = new Blob([hmtg.util.str2array(byteString)], { type: 'image/png' });
              } catch(e) {
                $scope.loading = false;
                loading_fails();
                img.removeEventListener("load", img_onload, false);
                img.removeEventListener("error", img_onerror, false);
                return;
              }
              $scope.w.png_descr = ' => ' + hmtgHelper.number2GMK($scope.w.png_blob.size) + 'B(' + $scope.w.png_blob.size + ')';
              if($scope.w.upload_type == 2 || $scope.w.upload_type == 4 || $scope.w.upload_type == 5) {
                if(!hmtg.util.endsWith($scope.w.filename, '.png')) {
                  $scope.w.slide_title = $scope.w.filename + '.png';
                }
                $scope.w.filesize_descr = $scope.w.filesize_descr0 + $scope.w.png_descr;
              }
            }

            $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_IMAGE_LOADED);
            img.removeEventListener("load", img_onload, false);
            img.removeEventListener("error", img_onerror, false);
            update_image();
          }
          function img_onerror() {
            window.URL.revokeObjectURL(url);
            $scope.loading = false;
            loading_fails();
            img.removeEventListener("load", img_onload, false);
            img.removeEventListener("error", img_onerror, false);
          }
          $scope.w.empty_image = false;
          img.addEventListener("load", img_onload, false);
          img.addEventListener("error", img_onerror, false);
          img.src = url;
        }, 0);
      } else {
        loading_fails();
        if(exceed_memory) {
          $scope.w.img_descr = $translate.instant('IDS_FILE_TOO_LARGE') + '(' + $translate.instant('ID_MEMORY_USAGE') + ',' + hmtgHelper.number2GMK(board.memory_usage + hmtg.jnkernel._memory_usage()) + ' + ' + hmtgHelper.number2GMK($scope.upload_file.size) + ' > ' + hmtgHelper.number2GMK(appSetting.max_blob * 1048576) + ')';
        } else {
          $scope.w.img_descr = $translate.instant('IDS_FILE_TOO_LARGE') + '(' + hmtgHelper.number2GMK($scope.upload_file.size) + ' > ' + hmtgHelper.number2GMK(appSetting.max_blob * 1048576) + ')';
        }
      }
      $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_IMAGE_LOADED);
    }
    $scope.w.type = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_conversion_type']);
    if($scope.w.type != 0 && $scope.w.type != 1) {
      $scope.w.type = 1;
    }
    $scope.w.dpis = [50, 75, 100, 150, 300, 600];
    $scope.w.dpi = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_conversion_dpi']);
    if($scope.w.dpi === 'undefined') $scope.w.dpi = 150;
    if($scope.w.dpis.indexOf($scope.w.dpi) == -1) {
      $scope.w.dpi = 150;
    }
    //$scope.w.page = '1-2';
    $scope.w.page = '';
    $scope.w.need_trusted_server = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_need_trusted_server']);
    $scope.w.need_trusted_server = $scope.w.need_trusted_server === 'undefined' ? true : !!$scope.w.need_trusted_server;
    $scope.w.convert_to_file_on_failure = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_convert_to_file_on_failure']);
    $scope.w.convert_to_file_on_failure = $scope.w.convert_to_file_on_failure === 'undefined' ? false : !!$scope.w.convert_to_file_on_failure;
    $scope.w.convert_all_or_none = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_convert_all_or_none']);
    $scope.w.convert_all_or_none = $scope.w.convert_all_or_none === 'undefined' ? false : !!$scope.w.convert_all_or_none;

    var ssrc = board.is_local_slide ? -1 : hmtg.jnkernel._jn_ssrc_index();
    $scope.w.group_titles = board.ssrc_get_group_title_list(ssrc);
    var current_group = board.ssrc_get_current_groupname(ssrc);
    if(current_group) {
      $scope.w.use_group = true;
      $scope.w.group = current_group;
    }

    function update_image() {
      if(!canvas) return;
      crop_left.max = crop_right.max = img.naturalWidth;
      crop_top.max = crop_bottom.max = img.naturalHeight;
      $scope.w.can_crop = img.naturalWidth && img.naturalHeight;
      draw(true);
      $scope.$digest();
    }

    $scope.$on(hmtgHelper.WM_UPLOAD_IMAGE_LOADED, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$watch('w.as_file', function() {
      if($scope.w.upload_type == 2 || $scope.w.upload_type == 3) {
        if($scope.w.as_file) {
          $scope.w.upload_type = 3;
          $scope.w.slide_title = $scope.w.filename;
          $scope.w.filesize_descr = $scope.w.filesize_descr0;
        } else {
          $scope.w.upload_type = 2;
          $scope.w.slide_title = $scope.w.filename;
          $scope.w.filesize_descr = $scope.w.filesize_descr0;
          if($scope.w.png_blob) {
            $scope.w.slide_title += '.png';
            $scope.w.filesize_descr += $scope.w.png_descr;
          }
          draw(true);
        }
        $scope.w.title = $translate.instant($scope.w.upload_type == 2 ? 'ID_UPLOAD_SLIDE' : 'ID_UPLOAD_FILE');
      }
    });

    $scope.$watch('w.group_title', function() {
      if($scope.w.group_title) {
        $scope.w.group = $scope.w.group_title;
        $scope.w.group_title = '';
      }
    });

    $scope.$watch('w.group', function() {
      if($scope.w.group && $scope.w.group != $scope.w.group_title) {
        $scope.w.group_title = "";
      }
    });

    $scope.ok = function() {
      if($scope.loading) return;
      if($scope.w.upload_type == 2 && $scope.w.no_conversion) return;

      var result;
      var groupname = '';
      var title = '';
      var convert_prefix = '';
      if($scope.w.upload_type == 1) { // blank page
        if($scope.w.use_group) {
          groupname = hmtg.util.encodeUtf8($scope.w.group);
          if(groupname.length >= hmtg.config.MAX_SLIDENAME) return;
          if(!groupname.length) return;
          title = groupname;
          if(!hmtg.util.endsWith(title, 'blank page')) {
            title += '.blank page';
          }
          if(title.length >= hmtg.config.MAX_SLIDENAME) return;
        } else {
          title = hmtg.util.encodeUtf8($scope.w.slide_title);
          if(!title) title = 'blank page';
          else if(!hmtg.util.endsWith(title, 'blank page')) {
            title += '.blank page';
          }
          if(title.length >= hmtg.config.MAX_SLIDENAME) return;
          if(!title.length) return;
        }

        result = {
          upload_type: 1,
          groupname: groupname,
          title: title
        };
      } else if($scope.w.upload_type == 2) {  // slide
        if(!$scope.upload_file.size) return;
        if($scope.upload_file.size > appSetting.max_blob * 1048576) return;
        if($scope.w.png_blob) {
          if($scope.w.png_blob.size > appSetting.max_blob * 1048576) return;
        }
        //if(!canvas.width && !$scope.w.need_conversion) return;
        if(png_blob_timerID) return;

        if($scope.w.use_group) {
          groupname = hmtg.util.encodeUtf8($scope.w.group);
          if(groupname.length >= hmtg.config.MAX_SLIDENAME) return;
          if(!groupname.length) return;
          title = $scope.w.group;
        } else {
          title = $scope.w.slide_title;
        }
        if(!title) return;
        var old_ext = $scope.w.png_blob ? '.png' : hmtg.util.getExt($scope.upload_file.name);
        if(old_ext) {
          var new_ext = hmtg.util.getExt(title);
          if(old_ext.toLowerCase() != new_ext.toLowerCase()) {
            title += old_ext;
          }
        }
        title = hmtg.util.encodeUtf8(title);
        if(!title.length) return;
        var name = $scope.upload_file.name.toLowerCase();
        if(hmtg.util.endsWith(name, '.bmp') && !$scope.w.png_blob) {
          title += '.jcz';
        }
        if(title.length >= hmtg.config.MAX_SLIDENAME) return;

        if($scope.w.need_conversion) {
          if(!hmtg.util.getExt(title)) return;  // to convert to slides, the title must have an extension

          var page = $scope.w.page;
          var start = 0;
          var end = 0;
          var tmp = 0;
          if(!page) {
            start = end = 0;
          } else if((tmp = page.indexOf('-')) != -1) {
            start = page.slice(0, tmp) >> 0;
            end = page.slice(tmp + 1) >> 0;
            if(start <= 0 || end <= 0) {
              start = end = 0;
            } else if(end < start) {
              tmp = start;
              start = end;
              end = tmp;
            }
          } else {
            start = page >> 0;
            if(start <= 0) {
              start = end = 0;
            } else {
              end = start;
            }
          }
          convert_prefix = '' + ($scope.w.type == 1 ? 1 : ($scope.w.type == 2 ? 2 : $scope.w.dpi))
          + ',' + ($scope.w.need_trusted_server ? 0 : 1)
          + ',' + ($scope.w.convert_to_file_on_failure ? 0 : 1)
          + ',' + start
          + ',' + end
          + ',' + ($scope.w.convert_all_or_none ? 2 : 1)
          ;

          groupname += '\0\0' + convert_prefix;
          title += '.jzf';
          if(title.length >= hmtg.config.MAX_SLIDENAME) return;

          hmtg.util.localStorage['hmtg_conversion_type'] = JSON.stringify($scope.w.type);
          if($scope.w.type == 0) {
            hmtg.util.localStorage['hmtg_conversion_dpi'] = JSON.stringify($scope.w.dpi);
          }
          hmtg.util.localStorage['hmtg_need_trusted_server'] = JSON.stringify($scope.w.need_trusted_server);
          hmtg.util.localStorage['hmtg_convert_to_file_on_failure'] = JSON.stringify($scope.w.convert_to_file_on_failure);
          hmtg.util.localStorage['hmtg_convert_all_or_none'] = JSON.stringify($scope.w.convert_all_or_none);
        }
        result = {
          upload_type: 2,
          groupname: groupname,
          title: title,
          file: $scope.upload_file,
          png_blob: $scope.w.png_blob
        };
      } else if($scope.w.upload_type == 4) {  // my picture
        if(!$scope.upload_file.size) return;
        if($scope.upload_file.size > appSetting.max_blob * 1048576) return;
        if($scope.w.png_blob) {
          if($scope.w.png_blob.size > appSetting.max_blob * 1048576) return;
        }
        if(!canvas.width) return;
        if(png_blob_timerID) return;

        result = {
          upload_type: 4,
          groupname: '',
          title: '',
          file: $scope.upload_file,
          png_blob: $scope.w.png_blob
        };
      } else if($scope.w.upload_type == 5) {  // file transfer
        if(!$scope.upload_file.size) return;
        if($scope.upload_file.size > appSetting.max_blob * 1048576) return;
        if($scope.w.png_blob) {
          if($scope.w.png_blob.size > appSetting.max_blob * 1048576) return;
        }
        if(!canvas.width) return;
        if(png_blob_timerID) return;

        if(!$scope.w.png_blob) {
          // this trick is necessary
          // without this trick, when clicking the thumbnail in the sender's IM, 
          // the new popup window just show the binary content, instead of the image
          $scope.w.png_blob = $scope.upload_file.slice(0, $scope.upload_file.size, 'image/png');
        }

        var fn = $scope.w.filename;
        if(!hmtg.util.endsWith(fn, '.png')) {
          fn += '.png';
        }

        result = {
          upload_type: 5,
          groupname: '',
          title: fn,
          file: $scope.upload_file,
          png_blob: $scope.w.png_blob
        };
      } else {  // file
        if(!$scope.upload_file.size) return;
        if($scope.upload_file.size > appSetting.max_blob * 1048576) return;
        if($scope.rotate_degree || $scope.w.cropping) return;
        title = $scope.w.slide_title;
        if(!title) return;
        var old_ext = hmtg.util.getExt($scope.upload_file.name);
        if(old_ext) {
          var new_ext = hmtg.util.getExt(title);
          if(old_ext.toLowerCase() != new_ext.toLowerCase()) {
            title += old_ext;
          }
        }
        title = hmtg.util.encodeUtf8(title);
        if(!title.length) return;
        title += '.jzf';
        if(title.length >= hmtg.config.MAX_SLIDENAME) return;
        result = {
          upload_type: 3,
          title: title,
          file: $scope.upload_file
        };
      }
      if($scope.w.use_group
      && $scope.w.upload_type <= 2  // blank page or slide
      && $scope.w.group_titles
      && $scope.w.group_titles.indexOf($scope.w.group) != -1) {
        hmtgHelper.OKCancelMessageBox($translate.instant('IDS_UPLOAD_EXISTING_GROUP').replace('#group#', $scope.w.group), 0, ok);
      } else {
        action(result);
      }

      function ok() {
        action(result);
      }
      function action(result) {
        clean_up();
        $modalInstance.close(result);
      }

      function clean_up() {
        if(intervalID) clearInterval(intervalID);
        if(png_blob_timerID) {
          clearTimeout(png_blob_timerID);
        }
        if($scope.draw_thumbnail_thread) {
          $scope.draw_thumbnail_thread.stop();
          $scope.draw_thumbnail_thread = null;
        }
        if($scope.draw_image_thread) {
          $scope.draw_image_thread.stop();
          $scope.draw_image_thread = null;
        }
        if($scope.stop_toblob) {
          $scope.stop_toblob();
          $scope.stop_toblob = null;
        }
      }
    };

    $scope.cancel = function() {
      if(intervalID) clearInterval(intervalID);
      if(png_blob_timerID) {
        clearTimeout(png_blob_timerID);
      }

      $modalInstance.dismiss('cancel');
    };

    $scope.rotate = function(degree) {
      if($scope.w.upload_type != 2 && $scope.w.upload_type != 4 && $scope.w.upload_type != 5) return;

      $scope.rotate_degree += degree;
      $scope.rotate_degree %= 360;
      draw(true);
    }

    function draw(to_update_png_blob) {
      if(!canvas) return;
      if(!width0) return;
      if(!img) return;
      if($scope.w.upload_type != 2 && $scope.w.upload_type != 4 && $scope.w.upload_type != 5) return;

      if($scope.draw_thumbnail_thread) {
        $scope.draw_thumbnail_thread.stop();
        $scope.draw_thumbnail_thread = null;
      }
      if($scope.draw_image_thread) {
        $scope.draw_image_thread.stop();
        $scope.draw_image_thread = null;
      }
      if($scope.stop_toblob) {
        $scope.stop_toblob();
        $scope.stop_toblob = null;
      }

      // do the rotation and cropping
      $scope.w.img_descr = '' + img.naturalWidth + ' x ' + img.naturalHeight;
      if(to_update_png_blob) {
        $scope.w.png_blob = $scope.w.png_blob0;
        $scope.w.filesize_descr = $scope.w.filesize_descr0;
      }
      if($scope.w.cropping) {
        var left = Math.max(0, $scope.w.left);
        var right = Math.max(0, $scope.w.right);
        var top = Math.max(0, $scope.w.top);
        var bottom = Math.max(0, $scope.w.bottom);
        var width_cropped = Math.max(0, img.naturalWidth - left - right);
        var height_cropped = Math.max(0, img.naturalHeight - top - bottom);
        $scope.w.img_descr = '' + width_cropped + ' x ' + height_cropped;
      } else {
        var left = 0;
        var right = 0;
        var top = 0;
        var bottom = 0;
        var width_cropped = img.naturalWidth;
        var height_cropped = img.naturalHeight;
      }
      if(!width_cropped || !height_cropped) {
        canvas.width = canvas.height = 0;
        $scope.w.img_descr = '' + width_cropped + ' x ' + height_cropped;
        return;
      }

      // determine ratio
      var rotated_width = width_cropped;
      var rotated_height = height_cropped;
      if($scope.rotate_degree == 90 || $scope.rotate_degree == 270) {
        rotated_width = height_cropped;
        rotated_height = width_cropped;
      }
      var ratio = Math.min(1.0, width0 / rotated_width, Math.max(100, hmtgHelper.view_port_height - 90) / rotated_height);
      var width = (rotated_width * ratio) >> 0;
      var height = (rotated_height * ratio) >> 0;
      width = Math.max(2, width);
      height = Math.max(2, height);
      canvas.width = width;
      canvas.height = height;
      $scope.w.img_descr = '' + rotated_width + ' x ' + rotated_height;

      if($scope.rotate_degree != 0 || width_cropped != img.naturalWidth || height_cropped != img.naturalHeight) {
        ctx.save();
        if($scope.rotate_degree == 90) {
          ctx.translate(width, 0);
          ctx.rotate(Math.PI * 0.5);
        } else if($scope.rotate_degree == 180) {
          ctx.translate(width, height);
          ctx.rotate(Math.PI);
        } else if($scope.rotate_degree == 270) {
          ctx.translate(0, height);
          ctx.rotate(Math.PI * 1.5);
        }
        var width2 = ($scope.rotate_degree == 90 || $scope.rotate_degree == 270 ? height : width);
        var height2 = ($scope.rotate_degree == 90 || $scope.rotate_degree == 270 ? width : height);
        //ctx.drawImage(img, left, top, width_cropped, height_cropped, 0, 0, width2, height2);
        $scope.draw_thumbnail_thread = new hmtgHelper.drawImageThread(ctx, img, left, top, width_cropped, height_cropped, 0, 0, width2, height2, function() {
          if(width_cropped != img.naturalWidth || height_cropped != img.naturalHeight) {
            ctx.restore();
            ctx.beginPath();
            ctx.globalAlpha = 0.5;
            ctx.moveTo(0, 0);
            ctx.lineTo(width, 0);
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.stroke();
          }
        });
        if(to_update_png_blob) {
          $scope.w.png_descr = ' => ...';
          $scope.w.filesize_descr = $scope.w.filesize_descr0 + $scope.w.png_descr;
        } else {
          return;
        }

        if(png_blob_timerID) {
          clearTimeout(png_blob_timerID);
        }
        png_blob_timerID = setTimeout(function() {
          png_blob_timerID = null;
          var canvas0 = document.createElement("canvas");
          var ctx0 = canvas0.getContext('2d');
          if($scope.rotate_degree == 0) {
            canvas0.width = width_cropped;
            canvas0.height = height_cropped;
          } else if($scope.rotate_degree == 180) {
            canvas0.width = width_cropped;
            canvas0.height = height_cropped;
          } else {
            canvas0.width = height_cropped;
            canvas0.height = width_cropped;
          }

          try {
            if($scope.rotate_degree == 90) {
              ctx0.translate(height_cropped, 0);
              ctx0.rotate(Math.PI * 0.5);
            } else if($scope.rotate_degree == 180) {
              ctx0.translate(width_cropped, height_cropped);
              ctx0.rotate(Math.PI);
            } else if($scope.rotate_degree == 270) {
              ctx0.translate(0, width_cropped);
              ctx0.rotate(Math.PI * 1.5);
            }
            if($scope.draw_image_thread) {
              $scope.draw_image_thread.stop();
              $scope.draw_image_thread = null;
            }
            //ctx0.drawImage(img, left, top, width_cropped, height_cropped, 0, 0, width_cropped, height_cropped);
            var after_image_draw = function() {
              if(canvas0.toBlob) {
                if($scope.stop_toblob) {
                  $scope.stop_toblob();
                  $scope.stop_toblob = null;
                }
                var is_active = true;
                $scope.stop_toblob = function() {
                  is_active = false;
                }
                canvas0.toBlob(function(blob) {
                  if(is_active) {
                    $scope.w.png_blob = blob;
                    apply_blob();
                  }
                });
              } else {
                var url = canvas0.toDataURL();
                var parts = url.split(',');
                var byteString;
                if(parts[0].indexOf('base64') >= 0)
                  byteString = hmtg.util.decode64(parts[1]);
                else
                  byteString = unescape(parts[1]);

                $scope.w.png_blob = new Blob([hmtg.util.str2array(byteString)], { type: 'image/png' });
                apply_blob();
              }
            }
            $scope.draw_image_thread = new hmtgHelper.drawImageThread(ctx0, img, left, top, width_cropped, height_cropped, 0, 0, width_cropped, height_cropped, after_image_draw);
          } catch(e) {
            if($scope.stop_toblob) {
              $scope.stop_toblob();
              $scope.stop_toblob = null;
            }
            $scope.w.png_descr = ' => (' + $translate.instant('IDS_ERROR_UNKNOWN_ERROR') + ')';
            $scope.w.filesize_descr = $scope.w.filesize_descr0 + $scope.w.png_descr;
            $scope.$digest();
            return;
          }
        }, 1000);
      } else {
        if(png_blob_timerID) {
          clearTimeout(png_blob_timerID);
        }
        $scope.w.png_blob = $scope.w.png_blob0;
        //ctx.drawImage(img, left, top, width_cropped, height_cropped, 0, 0, width, height);
        if($scope.draw_thumbnail_thread) {
          $scope.draw_thumbnail_thread.stop();
          $scope.draw_thumbnail_thread = null;
        }
        $scope.draw_thumbnail_thread = new hmtgHelper.drawImageThread(ctx, img, left, top, width_cropped, height_cropped, 0, 0, width, height);
      }
      function apply_blob() {
        $scope.w.png_descr = ' => ' + hmtgHelper.number2GMK($scope.w.png_blob.size) + 'B(' + $scope.w.png_blob.size + ')';
        $scope.w.filesize_descr = $scope.w.filesize_descr0 + $scope.w.png_descr;
        $scope.$digest();
      }
    }

    $scope.rotate90 = function() {
      $scope.rotate(90);
    }
    $scope.rotate270 = function() {
      $scope.rotate(270);
    }
    $scope.$watch('w.left', draw);
    $scope.$watch('w.right', draw);
    $scope.$watch('w.top', draw);
    $scope.$watch('w.bottom', draw);
    $scope.$watch('w.cropping', draw);

    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, function() {
      var input = document.getElementById('file_name');
      if(!input) return;
      width0 = input.clientWidth;
      if(!width0) return;
      draw(false);
    });

  }
])

;