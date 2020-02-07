angular.module('joinnet')
.controller('MyPictureCtrl', ['$scope', 'hmtgHelper', 'JoinNet', '$rootScope', '$translate', '$modal', 'hmtgSound', 'mypicture',
  'appSetting', '$ocLazyLoad',
  function ($scope, hmtgHelper, JoinNet, $rootScope, $translate, $modal, hmtgSound, mypicture, appSetting, $ocLazyLoad) {
    $scope.w = {};
    $scope.as = appSetting;
    $scope.file_input = document.getElementById('fileMyPicture');
    $scope.w.descr = $translate.instant('ID_MYPICTURE_DESCR');

    if(mypicture.data)
      show_image();

    $rootScope.$on('$translateChangeEnd', function () {
      $scope.w.descr = $translate.instant('ID_MYPICTURE_DESCR');
    });

    $scope.$on(hmtgHelper.WM_UPDATE_MYPICTURE, function () {
      show_image();
      $scope.$digest();
    });

    $scope.open = function () {
      $scope.file_input = hmtgHelper.file_reset('fileMyPicture', 'image/*');

      $scope.file_input.addEventListener("change", _open, false);
      if(window.navigator.msSaveOrOpenBlob) {
        setTimeout(function () {
          $scope.file_input.click();  // use timeout, otherwise, IE will complain error
        }, 0);
      } else {
        // it is necessary to exempt error here
        // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
        window.g_exempted_error++;
        $scope.file_input.click();
        window.g_exempted_error--;
      }
      function _open() {
        $scope.file_input.removeEventListener("change", _open, false);
        var file = $scope.file_input.files[0];
        if(!file) return;

        add_mypicture(file);
      }
    }

    function add_mypicture(file) {
      if(file.size > appSetting.max_blob * 1048576) {
        hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_INVALID_IMAGE') }, 20);
        return;
      }

      $scope.upload_type = 4;
      $scope.upload_file = file;

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
        show_image();
        $scope.$digest();

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

    function show_image() {
      var blob;
      var url;
      try {
        blob = new Blob([mypicture.data], { type: mypicture.type_array[mypicture.type] });
        url = window.URL.createObjectURL(blob);
      } catch(e) {
        $scope.w.img_descr = '?';
        return;
      }
      $scope.w.has_data = true;
      // http://www.homemeeting.com/en_US/images/image_home.gif
      var img = document.getElementById('mypicture');
      if(img) {
        function img_onload() {
          window.URL.revokeObjectURL(url);
          $scope.w.img_descr = '' + img.naturalWidth + ' x ' + img.naturalHeight;
          $scope.$digest();
          img.removeEventListener("load", img_onload, false);
          img.removeEventListener("error", img_onerror, false);
        }
        function img_onerror() {
          window.URL.revokeObjectURL(url);
          $scope.w.img_descr = '?';
          $scope.$digest();
          img.removeEventListener("load", img_onload, false);
          img.removeEventListener("error", img_onerror, false);
        }
        img.addEventListener("load", img_onload, false);
        img.addEventListener("error", img_onerror, false);
      }
      $scope.w.image_url = url;
    }

    $scope.remove = function () {
      mypicture.data = null;
      hmtg.util.localStorage['hmtg_mypicture_data'] = JSON.stringify('');
      hmtg.util.localStorage['hmtg_mypicture_type'] = JSON.stringify(-1);
      $scope.w.img_descr = '';
      $scope.w.has_data = false;
      $scope.w.image_url = '';

      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL && hmtg.jnkernel._jn_bConnected()) {
        if(hmtg.jnkernel.jn_info_HasMyPicture()) {
          prompt_replace_mypicture();
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
])
;
