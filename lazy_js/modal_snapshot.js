angular.module('hmtgs')
.controller('SnapshotModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', 'hmtgHelper', 'board', '$ocLazyLoad',
  'hmtgSound', 'appSetting', 'mypicture', '$rootScope',
  function ($scope, $modalInstance, $modal, $translate, hmtgHelper, board, $ocLazyLoad, hmtgSound, appSetting,
    mypicture, $rootScope) {
    var canvas;
    var ctx;
    var width0;
    var canvas0 = $scope.canvas0;
    $scope.w = {};
    $scope.as = appSetting;

    //$scope.w.is_large = canvas0.width > 300 || canvas0.height > 1500;
    $scope.w.descr = '' + canvas0.width + ' x ' + canvas0.height;
    $scope.w.can_save = true;
    $scope.w.filename = $translate.instant('ID_SNAPSHOT') + hmtgHelper.snapshot_count + '.png';
    $scope.w.cropping = false;
    $scope.w.can_crop = false;
    $scope.w.left = $scope.w.right = $scope.w.top = $scope.w.bottom = 0;

    hmtgHelper.snapshot_count++;

    $scope.$on(hmtgHelper.WM_MY_TALKER_STATUS_CHANGED, function () {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, function () {
      var input = document.getElementById('filename');
      if(!input) return;
      width0 = input.clientWidth;
      if(!width0) return;
      draw();
    });

    var intervalID = setInterval(function () {
      var input = document.getElementById('filename');
      if(!input) return;
      width0 = input.clientWidth;
      if(!width0) return;
      var crop_left = document.getElementById('ss_crop_left');
      if(!crop_left) return;
      var crop_top = document.getElementById('ss_crop_top');
      if(!crop_top) return;
      var crop_right = document.getElementById('ss_crop_right');
      if(!crop_right) return;
      var crop_bottom = document.getElementById('ss_crop_bottom');
      if(!crop_bottom) return;

      clearInterval(intervalID);
      intervalID = null;

      crop_left.max = crop_right.max = canvas0.width;
      crop_top.max = crop_bottom.max = canvas0.height;
      $scope.w.can_crop = true;

      canvas = document.getElementById('snapshot');
      ctx = canvas.getContext('2d');
      draw();
      $scope.$digest();
    }, 100);


    function draw() {
      if(!canvas) return;
      if(!width0) return;

      if($scope.w.cropping) {
        /*
        var left = ($scope.w.left * ratio) >> 0;
        var right = ($scope.w.right * ratio) >> 0;
        var top = ($scope.w.top * ratio) >> 0;
        var bottom = ($scope.w.bottom * ratio) >> 0;
        if(left < 0) left = 0;
        if(right < 0) right = 0;
        if(top < 0) top = 0;
        if(bottom < 0) bottom = 0;
        if(left > width) left = width;
        if(right > width) right = width;
        if(top > height) top = height;
        if(bottom > height) bottom = height;

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(0, 0, left, height);
        ctx.fillRect(width - right, 0, right, height);
        ctx.fillRect(0, 0, width, top);
        ctx.fillRect(0, height - bottom, width, bottom);
        ctx.restore();

        ctx.beginPath();
        if(left) {
        ctx.moveTo(left, 0);
        ctx.lineTo(left, height);
        }
        if(right) {
        ctx.moveTo(width - right, 0);
        ctx.lineTo(width - right, height);
        }
        if(top) {
        ctx.moveTo(0, top);
        ctx.lineTo(width, top);
        }
        if(bottom) {
        ctx.moveTo(0, height - bottom);
        ctx.lineTo(width, height - bottom);
        }
        ctx.closePath();
        ctx.stroke();
        */

        var left = Math.max(0, $scope.w.left);
        var right = Math.max(0, $scope.w.right);
        var top = Math.max(0, $scope.w.top);
        var bottom = Math.max(0, $scope.w.bottom);
        var width_cropped = Math.max(0, canvas0.width - left - right);
        var height_cropped = Math.max(0, canvas0.height - top - bottom);
        if(!width_cropped || !height_cropped) {
          canvas.width = canvas.height = 0;
          $scope.w.descr = '' + canvas0.width + ' x ' + canvas0.height + ' => 0 x 0';
          $scope.w.can_save = false;
        } else {
          var ratio = Math.min(1.0, width0 / width_cropped, Math.max(100, hmtgHelper.view_port_height - 90) / height_cropped);
          var width = (width_cropped * ratio) >> 0;
          var height = (height_cropped * ratio) >> 0;
          width = Math.max(2, width);
          height = Math.max(2, height);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(canvas0, left, top, canvas0.width - left - right, canvas0.height - top - bottom, 0, 0, width, height);
          ctx.beginPath();
          ctx.globalAlpha = 0.5;
          ctx.moveTo(0, 0);
          ctx.lineTo(width, 0);
          ctx.lineTo(width, height);
          ctx.lineTo(0, height);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.stroke();
          $scope.w.descr = '' + canvas0.width + ' x ' + canvas0.height + ' => ' + width_cropped + ' x ' + height_cropped;
          $scope.w.can_save = true;
        }
      } else {
        var ratio = Math.min(1.0, width0 / canvas0.width, Math.max(100, hmtgHelper.view_port_height - 90) / canvas0.height);
        var width = (canvas0.width * ratio) >> 0;
        var height = (canvas0.height * ratio) >> 0;
        width = Math.max(2, width);
        height = Math.max(2, height);
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(canvas0, 0, 0, canvas0.width, canvas0.height, 0, 0, width, height);
        $scope.w.descr = '' + canvas0.width + ' x ' + canvas0.height;
        $scope.w.can_save = true;
      }
    }

    $scope.$watch('w.left', draw);
    $scope.$watch('w.right', draw);
    $scope.$watch('w.top', draw);
    $scope.$watch('w.bottom', draw);
    $scope.$watch('w.cropping', draw);


    $scope.save = function () {
      var name = $scope.w.filename;
      if(!hmtg.util.endsWith(name.toLowerCase(), '.png')) {
        name += '.png';
      }
      var c = canvas0;
      if($scope.w.cropping) {
        var left = Math.max(0, $scope.w.left);
        var right = Math.max(0, $scope.w.right);
        var top = Math.max(0, $scope.w.top);
        var bottom = Math.max(0, $scope.w.bottom);
        var width_cropped = Math.max(0, canvas0.width - left - right);
        var height_cropped = Math.max(0, canvas0.height - top - bottom);
        if(!width_cropped || !height_cropped) return;

        var mycanvas = document.createElement("canvas");
        myctx = mycanvas.getContext('2d');
        mycanvas.width = width_cropped;
        mycanvas.height = height_cropped;
        myctx.drawImage(canvas0, left, top, canvas0.width - left - right, canvas0.height - top - bottom, 0, 0, width_cropped, height_cropped);
        c = mycanvas;
      }
      try {
        if(c.toBlob) {
          c.toBlob(function (blob) {
            hmtgHelper.save_file(blob, name);
          });
        } else {
          var url = c.toDataURL();
          hmtgHelper.save_file(hmtgHelper.url2blob(url), name);
        }
      } catch(e) {
        hmtgHelper.inside_angular++;
        hmtgSound.ShowErrorPrompt(function () { return $translate.instant(e.code == 18 ? 'ID_ERROR_TAINTED_CANVAS' : 'ID_ERROR_EXPORT_CANVAS_DATA') }, 20);
        hmtgHelper.inside_angular--;
      }
    }

    $scope.can_upload = function () {
      return board.can_upload();
    }

    $scope.upload = function () {
      if(!board.can_upload()) return;
      var c = canvas0;
      if($scope.w.cropping) {
        var left = Math.max(0, $scope.w.left);
        var right = Math.max(0, $scope.w.right);
        var top = Math.max(0, $scope.w.top);
        var bottom = Math.max(0, $scope.w.bottom);
        var width_cropped = Math.max(0, canvas0.width - left - right);
        var height_cropped = Math.max(0, canvas0.height - top - bottom);
        if(!width_cropped || !height_cropped) return;

        var mycanvas = document.createElement("canvas");
        myctx = mycanvas.getContext('2d');
        mycanvas.width = width_cropped;
        mycanvas.height = height_cropped;
        myctx.drawImage(canvas0, left, top, canvas0.width - left - right, canvas0.height - top - bottom, 0, 0, width_cropped, height_cropped);
        c = mycanvas;
      }
      try {
        if(c.toBlob) {
          c.toBlob(function (blob) {
            $scope.upload_file = blob;
            upload_slide();
          });
        } else {
          var url = c.toDataURL();
          $scope.upload_file = hmtgHelper.url2blob(url);
          upload_slide();
        }
      } catch(e) {
        hmtgHelper.inside_angular++;
        hmtgSound.ShowErrorPrompt(function () { return $translate.instant(e.code == 18 ? 'ID_ERROR_TAINTED_CANVAS' : 'ID_ERROR_EXPORT_CANVAS_DATA') }, 20);
        hmtgHelper.inside_angular--;
        return;
      }

      function upload_slide() {
        $scope.upload_type = 2;
        var name = $scope.w.filename;
        if(!hmtg.util.endsWith(name.toLowerCase(), '.png')) {
          name += '.png';
        }
        $scope.upload_file.name = name;

        if(!board.upload_finished) return;
        if(!board.is_local_slide && hmtg.jnkernel._jn_conversion_count()) return;

        board.upload_finished = false;

        board.upload_slide(2, board.is_local_slide, '', hmtg.util.encodeUtf8(name), $scope.upload_file);
        $modalInstance.dismiss('cancel');
        /*
        $ocLazyLoad.load({
          name: 'joinnet',
          files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_upload_slide' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
        }).then(function () {
          var modalInstance = $modal.open({
            templateUrl: 'template/UploadSlide.htm' + hmtgHelper.cache_param,
            scope: $scope,
            controller: 'UploadSlideModalCtrl',
            size: 'lg',
            backdrop: 'static',
            resolve: {}
          });

          modalInstance.result.then(function (result) {
            board.upload_slide(result.upload_type, board.is_local_slide, result.groupname, result.title, result.file);
            $modalInstance.dismiss('cancel');
          }, function () {
            board.upload_finished = true;
          });
        }, function (e) {
          hmtg.util.log(-1, 'Warning! lazy_loading modal_upload_slide fails');
        });
        */
      }
    }

    $scope.set_mypicture = function () {
      var c = canvas0;
      if($scope.w.cropping) {
        var left = Math.max(0, $scope.w.left);
        var right = Math.max(0, $scope.w.right);
        var top = Math.max(0, $scope.w.top);
        var bottom = Math.max(0, $scope.w.bottom);
        var width_cropped = Math.max(0, canvas0.width - left - right);
        var height_cropped = Math.max(0, canvas0.height - top - bottom);
        if(!width_cropped || !height_cropped) return;

        var mycanvas = document.createElement("canvas");
        myctx = mycanvas.getContext('2d');
        mycanvas.width = width_cropped;
        mycanvas.height = height_cropped;
        myctx.drawImage(canvas0, left, top, canvas0.width - left - right, canvas0.height - top - bottom, 0, 0, width_cropped, height_cropped);
        c = mycanvas;
      }
      try {
        if(c.toBlob) {
          c.toBlob(function (blob) {
            //$scope.upload_file = blob;
            set_as_mypicture(blob);
          });
        } else {
          var url = c.toDataURL();
          //$scope.upload_file = hmtgHelper.url2blob(url);
          set_as_mypicture(hmtgHelper.url2blob(url));
        }
      } catch(e) {
        hmtgHelper.inside_angular++;
        hmtgSound.ShowErrorPrompt(function () { return $translate.instant(e.code == 18 ? 'ID_ERROR_TAINTED_CANVAS' : 'ID_ERROR_EXPORT_CANVAS_DATA') }, 20);
        hmtgHelper.inside_angular--;
        return;
      }

      // copied from function add_mypicture @ MyPictureCtrl
      function set_as_mypicture(file) {
        // switch to my picture setting 
        $rootScope.nav_item = 'setting';
        $rootScope.tabs[3].active = true;

        if(file.size > appSetting.max_blob * 1048576) {
          hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_IMAGE') }, 20);
          return;
        }

        $scope.upload_type = 4;
        $scope.upload_file = file;
        var name = $scope.w.filename;
        if(!hmtg.util.endsWith(name.toLowerCase(), '.png')) {
          name += '.png';
        }
        $scope.upload_file.name = name;

        read_file(file);
        $modalInstance.dismiss('cancel');

        /*
        $ocLazyLoad.load({
          name: 'joinnet',
          files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_upload_slide' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
        }).then(function () {
          var modalInstance = $modal.open({
            templateUrl: 'template/UploadSlide.htm' + hmtgHelper.cache_param,
            scope: $scope,
            controller: 'UploadSlideModalCtrl',
            size: 'lg',
            backdrop: 'static',
            resolve: {}
          });

          modalInstance.result.then(function (result) {
            //board.upload_slide(result.upload_type, board.is_local_slide, result.groupname, result.title, result.file, result.png_blob);
            var file = result.png_blob;
            if(file) {
              file.name = 'a.png';
            } else {
              file = result.file;
            }
            read_file(file);
          }, function () {
          });
        }, function (e) {
          hmtg.util.log(-1, 'Warning! lazy_loading modal_upload_slide fails');
        });
        */

        function read_file(file) {
          var name = file.name.toLowerCase();
          var type = -1;
          if(hmtg.util.endsWith(name, '.jpg') || hmtg.util.endsWith(name, '.jpeg')) type = hmtg.config.MYPICTURE_TYPE_JPG;
          else if(hmtg.util.endsWith(name, '.gif')) type = hmtg.config.MYPICTURE_TYPE_GIF;
          else if(hmtg.util.endsWith(name, '.png')) type = hmtg.config.MYPICTURE_TYPE_PNG;
          else if(hmtg.util.endsWith(name, '.bmp')) type = hmtg.config.MYPICTURE_TYPE_BMP;

          var reader = new FileReader();
          reader.onload = function (e) {
            var name = file.name.toLowerCase();
            if(!(hmtg.util.endsWith(name, '.jpg')
            || hmtg.util.endsWith(name, '.jpeg')
            || hmtg.util.endsWith(name, '.gif')
            || hmtg.util.endsWith(name, '.png')) || file.size > hmtg.config.MAX_MYPICTURE_SIZE
            ) {
              var blob;
              var url;
              try {
                if(e.target.result.byteLength > appSetting.max_blob * 1048576) {
                  onerror();
                  return;
                }
                if(type == -1)
                  blob = new Blob([e.target.result]);
                else
                  blob = new Blob([e.target.result], { type: mypicture.type_array[type] });
                url = window.URL.createObjectURL(blob);
              } catch(e) {
                onerror();
                return;
              }
              function onerror() {
                hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_IMAGE') }, 20);
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
                    hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_IMAGE') }, 20);
                    break;
                  }
                  try {
                    ctx0.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas0.width, canvas0.height);
                  } catch(e) {
                    hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_IMAGE') }, 20);
                    break;
                  }

                  var url = canvas0.toDataURL();
                  var parts = url.split(',');
                  var byteString;
                  if(parts[0].indexOf('base64') >= 0)
                    byteString = hmtg.util.decode64(parts[1]);
                  else
                    byteString = unescape(parts[1]);

                  if(byteString.length <= hmtg.config.MAX_MYPICTURE_SIZE) {
                    accept_image_data(hmtg.util.str2array(byteString), hmtg.config.MYPICTURE_TYPE_PNG);
                    break;
                  } else {
                    var ratio = byteString.length / hmtg.config.MAX_MYPICTURE_SIZE;
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
            } else {
              accept_image_data(new Uint8Array(e.target.result), type);
            }
          }
          reader.onerror = function (e) {
            hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_IMAGE_FILE_READ_ERROR') }, 20);
          };

          reader.readAsArrayBuffer(file);
        }

        function accept_image_data(data, type) {
          mypicture.data = data;
          mypicture.type = type;
          hmtg.util.localStorage['hmtg_mypicture_data'] = JSON.stringify(hmtg.util.array2str(mypicture.data));
          hmtg.util.localStorage['hmtg_mypicture_type'] = JSON.stringify(mypicture.type);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_MYPICTURE);
          //show_image();
          //$scope.$digest();

          if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL && hmtg.jnkernel._jn_bConnected()) {
            if(hmtg.jnkernel.jn_info_HasMyPicture()) {
              prompt_replace_mypicture();
            }
            else {
              hmtg.jnkernel.jn_command_UploadSelfPicture(type, data);
              hmtgSound.ShowInfoPrompt(function () { return $translate.instant('ID_MYPICTURE_UPLOADING') }, 10);
            }
          }
        }
      }

      function prompt_replace_mypicture() {
        hmtgHelper.OKCancelMessageBox($translate.instant('ID_REPLACE_MYPICTURE_PROMPT'), 20, ok);
        function ok() {
          // simulate to disconnect and reconnect immediately
          hmtgHelper.inside_angular++;
          hmtgSound.ShowInfoPrompt(function () { return $translate.instant('ID_LEAVE_AND_RECONNECT') }, 10);
          hmtg.jnkernel.jn_command_QuitConnection();
          hmtg.jnkernel.jn_command_initconnectmedia(true);
          hmtgHelper.inside_angular--;
        }
      }
    }

    $scope.ok = function () {
      if(intervalID) clearInterval(intervalID);
      $modalInstance.close({});
    };

    $scope.cancel = function () {
      if(intervalID) clearInterval(intervalID);
      $modalInstance.dismiss('cancel');
    };
  }
])

;
