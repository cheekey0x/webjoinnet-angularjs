angular.module('joinnet')
.controller('ImportMediaModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', 'hmtgHelper', 'board', '$rootScope',
  'joinnetTranscoding',
  function ($scope, $modalInstance, $modal, $translate, hmtgHelper, board, $rootScope, joinnetTranscoding) {
    $scope.w = {};
    $scope.w.auto_play = true;
    $scope.w.audio_only = $scope.force_audio_only;
    $scope.w.title = $translate.instant('ID_IMPORT_HTML5');
    var MAX_LINK_ITEM = 20;

    var LS_list = hmtg.util.localStorage['hmtg_media_list'];
    var list = [];
    if(typeof LS_list == 'string') {
      var a_list = hmtg.util.parseJSON(LS_list);
      if(a_list === 'undefined') a_list = [];
      if(hmtg.util.isArray(a_list)) {
        list = a_list.slice(0, MAX_LINK_ITEM);
      }
    }
    var i;
    var descr;
    $scope.links = [];
    if(list.length) {
      for(i = 0; i < list.length; i++) {
        if((typeof list[i].name === 'undefined' || typeof list[i].name === 'string')
          && typeof list[i].src === 'string' && list[i].src
          && -1 == find_src_index(list[i].src)) {
          if(list[i].audio_only) {
            descr = '[' + $translate.instant('ID_TAB_AUDIO') + '] ';
          } else {
            descr = '';
          }
          descr += list[i].name ? (list[i].name + ': ' + list[i].src) : list[i].src;
          $scope.links.push({ audio_only: !!list[i].audio_only, name: list[i].name, src: list[i].src, descr: descr });
        }
      }
    }
    if(!$scope.links.length) {
      list = hmtg.customization.media_links;
      for(i = 0; i < list.length; i++) {
        if((typeof list[i].name === 'undefined' || typeof list[i].name === 'string')
          && typeof list[i].src === 'string' && list[i].src) {
          //var full_src = list[i].src.indexOf('http') != 0 ? ($scope.elem1_html5.baseURI + list[i].src) : list[i].src;
          var full_src = list[i].src;
          if(-1 == find_src_index(full_src)) {
            if(list[i].audio_only) {
              descr = '[' + $translate.instant('ID_TAB_AUDIO') + '] ';
            } else {
              descr = '';
            }
            descr += list[i].name ? (list[i].name + ': ' + full_src) : full_src;
            $scope.links.push({ audio_only: !!list[i].audio_only, name: list[i].name, src: full_src, descr: descr });
          }
        }
      }
    }

    function find_src_index(src) {
      var i;
      for(i = 0; i < $scope.links.length; i++) {
        if(src == $scope.links[i].src) return i;
      }
      return -1;
    }

    /*
    if($scope.links.length) {
    $scope.w.audio_only = $scope.links[0].audio_only;
    $scope.w.name = $scope.links[0].name;
    $scope.w.src = $scope.links[0].src;
    }
    */

    $scope.$watch('w.link_src', function () {
      var idx = find_src_index($scope.w.link_src);
      $scope.w.link_src = '';
      if(idx != -1) {
        $scope.w.audio_only = $scope.links[idx].audio_only || $scope.force_audio_only;
        $scope.w.name = $scope.links[idx].name;
        $scope.w.src = $scope.links[idx].src;
      }
    });

    $scope.open = function() {
      var myinput = hmtgHelper.file_reset('fileInput');

      myinput.addEventListener("change", handleFile, false);
      if(window.navigator.msSaveOrOpenBlob) {
        setTimeout(function() {
          myinput.click();  // use timeout, otherwise, IE will complain error
        }, 0);
      } else {
        // it is necessary to exempt error here
        // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
        window.g_exempted_error++;
        myinput.click();
        window.g_exempted_error--;
      }

      function handleFile() {
        myinput.removeEventListener("change", handleFile, false);
        var file = myinput.files[0];

        if(!file) {
          return;
        }

        $modalInstance.close({ src: window.URL.createObjectURL(file), auto_play: $scope.w.auto_play, audio_only: $scope.w.audio_only });
      }
    }

    $scope.ok = function () {
      if(!$scope.w.src) return;
      var idx = find_src_index($scope.w.src);
      if(idx != -1) {
        $scope.links.splice(idx, 1);
      }
      $scope.links.unshift({ audio_only: $scope.w.audio_only, name: $scope.w.name, src: $scope.w.src, descr: descr });
      if($scope.links.length > MAX_LINK_ITEM) {
        $scope.links = $scope.links.slice(0, MAX_LINK_ITEM);
      }

      hmtg.util.localStorage['hmtg_media_list'] = JSON.stringify($scope.links);

      $modalInstance.close({ src: $scope.w.src, auto_play: $scope.w.auto_play, audio_only: $scope.w.audio_only });
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
])

;