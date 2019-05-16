angular.module('joinnet')
.controller('VideoWindowCtrl', ['$scope', 'hmtgHelper', 'JoinNet', 'appSetting', 'userlist', 'main_video', 'video_recving',
  'video_playback', '$rootScope', 'main_video_canvas', 'mediasoupWebRTC', 'layout',
  function ($scope, hmtgHelper, JoinNet, appSetting, userlist, main_video, video_recving, video_playback, $rootScope,
    main_video_canvas, mediasoupWebRTC, layout) {
    $scope.w = {};
    $scope.as = appSetting;
    $scope.ul = userlist;
    $scope.vr = video_recving;
    $scope.rtc = mediasoupWebRTC;
    $scope.lo = layout;
    $scope.count = (appSetting.max_display_item >> 0);
    $scope.name_hash = {};  // ssrc -> name
    $scope.removed_hash = {}; // those are removed from the list explicity by the user
    $scope.talker_array = []; // talker ssrc array, which is NOT in the video_recving.ssrc_array
    $scope.request_fullscreen = main_video.request_fullscreen;
    $scope.show_list = false;
    $scope.show_name = true;
    $scope.MAX_VIDEO_ITEM = 100;   // maximum video item in the list
    $scope.container = document.getElementById('video_container');
    $scope.video_list = document.getElementById('video-list');
    $scope.auto_add_video = true;
    $scope.video_list_info = '';

    // concise layout related code
    $scope.onVideoClick = function(ssrc) {
      if(ssrc != video_recving.main_video_ssrc) {
        video_recving.main_video_ssrc = ssrc;
        if($rootScope.gui_mode == 'concise') {
          layout.is_board_visible = false;
        }
      }
    }

    $scope.$on(hmtgHelper.WM_NET_INIT_FINISH, function () {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_MAX_DISPLAY_ITEM_CHANGED, function () {
      $scope.count = (appSetting.max_display_item >> 0);
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_ADD_USER, function (event, ssrc) {
      var a = hmtg.jnkernel._jn_UserArray();
      var name = hmtg.util.decodeUtf8(a[ssrc] ? a[ssrc]._szRealName() : ('ssrc' + ssrc));
      $scope.name_hash['' + ssrc] = name;
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_REFRESH_USER, function() {
      // init, remember all the names
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      for(var ssrc in a) {
        if(!a.hasOwnProperty(ssrc)) continue;
        var name = hmtg.util.decodeUtf8(a[ssrc]._szRealName());
        $scope.name_hash['' + ssrc] = name;
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
      // init, fill the talker array
      hmtgHelper.inside_angular++;
      on_talker_status_changed();
      hmtgHelper.inside_angular--;
    });
    $scope.$on(hmtgHelper.WM_TALKER_STATUS_CHANGED, on_talker_status_changed);
    $scope.$on(hmtgHelper.WM_NEW_SPEAKER, function (event, ssrc) {
      if($scope.auto_add_video) {
        $scope.add(ssrc, true);
        if(!hmtgHelper.inside_angular) $scope.$digest();
      }
    });
    $scope.$on(hmtgHelper.WM_UPDATE_VIDEO_WINDOW, function () {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_QUIT_SESSION, function() {
      $scope.video_list_info = '';
      $scope.talker_array = [];
      video_recving.ssrc_array = [];
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_RESET_SESSION, function() {
      $scope.video_list_info = '';
      $scope.talker_array = [];
      video_recving.ssrc_array = [];
      $scope.name_hash = {};
      $scope.removed_hash = {};
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_PLAYBACK_RESTART, function() {
      $scope.video_list_info = '';
      $scope.talker_array = [];
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_PLAYBACK_END_OF_FILE, function() {
      $scope.video_list_info = '';
      $scope.talker_array = [];
      video_recving.ssrc_array = [];
      $scope.name_hash = {};
      $scope.removed_hash = {};
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, adjust_size);
    $scope.$on(hmtgHelper.WM_HEIGHT_CHANGED, adjust_size);
    function adjust_size() {
      // update gallery display size when not in concise layout or in concise gallery mode
      if($rootScope.gui_mode != 'concise' || layout.is_gallery_visible) {
        video_recving.display_size = hmtgHelper.calcGalleryDisplaySize(video_recving.ssrc_array.length);
        if($rootScope.gui_mode != 'concise') {
          video_recving.display_size = Math.min(640, video_recving.display_size);
        }
      }
    }

    $scope.canvas_id = function (ssrc) {
      return 'video-' + ssrc;
    }

    $scope.container_id = function (ssrc) {
      return 'container-' + ssrc;
    }

    $scope.video_id = function(ssrc) {
      return 'webrtc-video-' + ssrc;
    }

    $scope.show_snapshot = function(ssrc) {
      if(mediasoupWebRTC.to_show_webrtc_video(ssrc)) return true;

      var v = video_playback.video_playback_array[ssrc];
      if(!v) return false;
      if(!v.canvas) return false;

      var video_w = v.canvas.width;
      var video_h = v.canvas.height;
      if(!video_w || !video_h) return false;
      return true;
    }

    $scope.snapshot = function (ssrc) {
      if($rootScope.snapshot_busy) {
        return;
      }
      var elem;
      var v;
      if(mediasoupWebRTC.to_show_webrtc_video(ssrc)) {
        elem = document.getElementById('webrtc-video-' + ssrc);
        if(!elem || !elem.videoWidth) return;
      } else {
        v = video_playback.video_playback_array[ssrc];
        if(!(v
          && v.canvas
          && v.canvas.width)) return;
      }

      hmtgHelper.inside_angular++;
      $scope.turnoff_fullscreen();
      hmtgHelper.inside_angular--;

      $rootScope.snapshot_busy = true;
      snapshot_canvas();

      function snapshot_canvas() {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext('2d');
        if(elem) {
          canvas.width = elem.videoWidth;
          canvas.height = elem.videoHeight;
          ctx.drawImage(elem, 0, 0);
        } else {
          canvas.width = v.canvas.width;
          canvas.height = v.canvas.height;
          ctx.drawImage(v.canvas, 0, 0);
        }  

        hmtgHelper.process_snapshot(canvas);
      }
    }

    $scope.turnoff_fullscreen = function () {
      hmtgHelper.exitFullScreen();
    }

    $scope.w.is_fullscreen = false;
    $scope.w.request_fullscreen = $scope.container.requestFullscreen
      || $scope.container.msRequestFullscreen
      || $scope.container.mozRequestFullScreen
      || $scope.container.webkitRequestFullscreen
    ;

    $scope.w.fullscreen1 = function () {
      if($scope.w.request_fullscreen) {
        hmtgHelper.inside_angular++;
        $scope.w.request_fullscreen.call($scope.container);
        hmtgHelper.inside_angular--;
        var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

        $scope.w.is_fullscreen = fullscreenElement == $scope.container;
      }
    }

    $scope.w.fullscreen0 = function () {
      hmtgHelper.inside_angular++;
      hmtgHelper.exitFullScreen();
      hmtgHelper.inside_angular--;
      $scope.w.is_fullscreen = false;
    }

    $scope.is_fullscreen = function (ssrc) {
      return false;
    }

    $scope.fullscreen1 = function (ssrc) {
      var elem = document.getElementById((mediasoupWebRTC.to_show_webrtc_video(ssrc) ? 'webrtc-video-' : 'video-') + ssrc);
      if(!elem) return;
      var request_fullscreen = elem.requestFullscreen
        || elem.msRequestFullscreen
        || elem.mozRequestFullScreen
        || elem.webkitRequestFullscreen
      ;
      if(request_fullscreen) {
        hmtgHelper.inside_angular++;
        request_fullscreen.call(elem);
        hmtgHelper.inside_angular--;
        var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

        if(video_recving.ssrc_hash[ssrc]) video_recving.ssrc_hash[ssrc].is_fullscreen = fullscreenElement == elem;
        hmtgHelper.inside_angular++;
        video_recving.draw_video(video_playback, ssrc);
        hmtgHelper.inside_angular--;
      }
    }
    $scope.fullscreen0 = function (ssrc) {
      hmtgHelper.inside_angular++;
      hmtgHelper.exitFullScreen();
      hmtgHelper.inside_angular--;
      if(video_recving.ssrc_hash[ssrc]) video_recving.ssrc_hash[ssrc].is_fullscreen = false;
      hmtgHelper.inside_angular++;
      video_recving.draw_video(video_playback, ssrc);
      hmtgHelper.inside_angular--;
    }
    $scope.$on(hmtgHelper.WM_FULLSCREEN_CHANGED, function () {
      var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

      var hash = video_recving.ssrc_hash;
      for(var ssrc in hash) {
        if(!hash.hasOwnProperty(ssrc)) continue;
        var elem = document.getElementById('container-' + ssrc);
        var old = hash[ssrc].is_fullscreen;
        hash[ssrc].is_fullscreen = elem && (fullscreenElement == elem);
        if(old != hash[ssrc].is_fullscreen) {
          video_recving.draw_video(video_playback, ssrc);
        }
      }

      $scope.w.is_fullscreen = fullscreenElement == $scope.container;

      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.has_video_loop = function(ssrc) {
      if(mediasoupWebRTC.use_screen_as_video && ssrc == hmtg.jnkernel._jn_ssrc_index()) {
        // screen as video and viewing self, could be a loop
        return true;
      }
      return false;
    }

    $scope.username_trimmed = function(name) {
      if(name.length > 10) {
        return name.slice(0, 8) + '...';
      }
      return name;
    }

    var myheight = 100;
    $scope.style_video_height = function() {
      var old = myheight;
      var offset = {};
      hmtg.util.calcOffset($scope.video_list, offset);
      if(offset.y >= 0) {
        myheight = hmtgHelper.view_port_height - offset.y - 1;
      }

      // this logic can prevent exception caused by too frequent $digest
      // [$rootScope:infdig]
      if(myheight > old && myheight - old < 15) {
        myheight = old;
      }
      return {
        'max-height': '' + (myheight) + 'px'
      };
    }


    $scope.$watch('vr.display_size', function () {
      var ssrc;
      var i;
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      $scope.style_webrtc_video =
      {
        'max-width': '' + video_recving.display_size + 'px',
        'max-height': '' + video_recving.display_size + 'px'
      };
      hmtgHelper.inside_angular++;
      for(i = 0; i < video_recving.ssrc_array.length; i++) {
        ssrc = video_recving.ssrc_array[i];
        if(!a[ssrc]) continue;
        video_recving.draw_video(video_playback, ssrc);
      }
      hmtgHelper.inside_angular--;
    });

    $scope.toggle_show_list = function () {
      $scope.show_list = !$scope.show_list;
    }

    /*
    $scope.toggle_show_name = function() {
      $scope.show_name = !$scope.show_name;
    }
    */

    $scope.move_up = function (ssrc) {
      var idx = video_recving.ssrc_array.indexOf(ssrc);
      if(idx == -1) return;
      if(idx == 0) return;

      video_recving.ssrc_array.splice(idx, 1)
      video_recving.ssrc_array.splice(idx - 1, 0, ssrc);
      var hash = video_recving.ssrc_hash[ssrc];
      if(hash) {
        hash.canvas = null;
      }
      $scope.delayedAssociateVideoStream();
    }

    $scope.move_down = function (ssrc) {
      var idx = video_recving.ssrc_array.indexOf(ssrc);
      if(idx == -1) return;
      if(idx == video_recving.ssrc_array.length - 1) return;

      video_recving.ssrc_array.splice(idx, 1)
      video_recving.ssrc_array.splice(idx + 1, 0, ssrc);
      var hash = video_recving.ssrc_hash[ssrc];
      if(hash) {
        hash.canvas = null;
      }
      $scope.delayedAssociateVideoStream();
    }

    $scope.remove = function(ssrc) {
      // add the ssrc to the removed list
      // this ssrc will not be auto added to the display list until the user manually add back this ssrc
      $scope.removed_hash['' + ssrc] = true;

      var idx = video_recving.ssrc_array.indexOf(ssrc);
      if(idx == -1) return;

      video_recving.ssrc_array.splice(idx, 1);
      main_video.deselect_video_ssrc(ssrc);

      if(!(main_video_canvas.video_ssrc >= 0 || main_video_canvas.video_ssrc2 >= 0 || video_recving.ssrc_array.length)) {
        if(main_video_canvas.turnoff_mypicture_interval) main_video_canvas.turnoff_mypicture_interval();
      }

      if(hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel.is_talker(ssrc)) {
        $scope.talker_array.push(ssrc);
      }

      video_playback.on_video_interrupted(ssrc);
      video_playback.clear_queue(ssrc);

      update_video_list_info();
    }

    $scope.add = function(ssrc, is_auto_add) {
      if(is_auto_add) {
        // if this is an auto add, check whether the ssrc is in the removed list
        // if so, skip it
        if($scope.removed_hash['' + ssrc]) {
          if(ssrc != -1 && video_recving.ssrc_array.indexOf(ssrc) == -1 && $scope.talker_array.indexOf(ssrc) == -1) {
            $scope.talker_array.push(ssrc);
          }
          return;
        }
      } else {
        // if this is not an auto add, it is by the user
        // clear the ssrc from the removed list
        delete $scope.removed_hash['' + ssrc];
      }

      var idx = $scope.talker_array.indexOf(ssrc);
      if(idx != -1) {
        $scope.talker_array.splice(idx, 1);
      }

      if(video_recving.ssrc_array.indexOf(ssrc) == -1) {
        video_recving.ssrc_array.push(ssrc);
        $scope.delayedAssociateVideoStream();
        if(video_recving.ssrc_array.length > $scope.MAX_VIDEO_ITEM) {
          var i;
          for(i = 0; i < video_recving.ssrc_array.length; i++) {
            if(!hmtg.jnkernel.is_talker(video_recving.ssrc_array[i])) {
              $scope.remove(video_recving.ssrc_array[i]);
              break;
            }
          }
        }

        if(video_recving.ssrc_array.length > $scope.MAX_VIDEO_ITEM) $scope.remove(video_recving.ssrc_array[0]);
      }

      main_video.select_video_ssrc(ssrc);
      if(main_video_canvas.turnon_mypicture_interval) main_video_canvas.turnon_mypicture_interval();

      var a = hmtg.jnkernel._jn_UserArray();
      var name = hmtg.util.decodeUtf8(a[ssrc] ? a[ssrc]._szRealName() : ('ssrc' + ssrc));
      $scope.name_hash['' + ssrc] = name;
      var hash = video_recving.ssrc_hash[ssrc];
      if(hash) {
        hash.canvas = null;
      }

      update_video_list_info();
    }

    $scope.delayedAssociateVideoStream = function() {
      if($scope.timerAssociateId) {
        clearTimeout($scope.timerAssociateId);
      }
      $scope.timerAssociateId = setTimeout(function() {
        mediasoupWebRTC.associateVideoStream();
        $scope.timerAssociateId = null;
      }, 0);
    }

    function on_talker_status_changed() {
      var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
      var ssrc_sender = hmtg.jnkernel._jn_iDataSender();
      var list = hmtg.jnkernel._jn_iParticipantAudioSsrc();
      var i;

      // first, auto-add all talkers to the ssrc_array
      if($scope.auto_add_video) {
        for(i = 0; i < list.length; i++) {
          if(list[i] != -1) $scope.add(list[i], true);
        }
        if(ssrc_sender != -1) $scope.add(ssrc_sender, true);
        if(ssrc_holder != -1) $scope.add(ssrc_holder, true);
      }

      // if anyone in the talker array is not a talker any more, remove it
      for(i = $scope.talker_array.length - 1; i >= 0; i--) {
        if(!hmtg.jnkernel.is_talker($scope.talker_array[i])) {
          $scope.talker_array.splice(i, 1);
        }
      }

      // if anyone in the ssrc array is not a talker any more, remove it
      for(i = video_recving.ssrc_array.length - 1; i >= 0; i--) {
        if(!hmtg.jnkernel.is_talker(video_recving.ssrc_array[i])) {
          video_recving.ssrc_array.splice(i, 1);
        }
      }

      /*
      for(i = 0; i < list.length; i++) {
        if(list[i] != -1 && video_recving.ssrc_array.indexOf(list[i]) == -1 && $scope.talker_array.indexOf(list[i]) == -1) {
          $scope.talker_array.push(list[i]);
        }
      }

      if(ssrc_holder != -1 && video_recving.ssrc_array.indexOf(ssrc_holder) == -1 && $scope.talker_array.indexOf(ssrc_holder) == -1) {
        $scope.talker_array.push(ssrc_holder);
      }
      if(ssrc_sender != -1 && video_recving.ssrc_array.indexOf(ssrc_sender) == -1 && $scope.talker_array.indexOf(ssrc_sender) == -1) {
        $scope.talker_array.push(ssrc_sender);
      }
      */

      update_video_list_info();

      if(!hmtgHelper.inside_angular) $scope.$digest();
    }

    function update_video_list_info() {
      if($scope.talker_array.length) {
        $scope.video_list_info = (video_recving.ssrc_array.length) + '/' + ($scope.talker_array.length + video_recving.ssrc_array.length);
      } else if(video_recving.ssrc_array.length) {
        $scope.video_list_info = '' + video_recving.ssrc_array.length;
      } else {
        $scope.video_list_info = '';
      }

      // when talker number changes, react as the viewport size changes
      adjust_size();
    }

    // init, remember all the names
    var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
    for(var ssrc in a) {
      if(!a.hasOwnProperty(ssrc)) continue;
      var name = hmtg.util.decodeUtf8(a[ssrc]._szRealName());
      $scope.name_hash['' + ssrc] = name;
    }

    // init, fill the talker array
    hmtgHelper.inside_angular++;
    on_talker_status_changed();
    hmtgHelper.inside_angular--;

    // when the self webrtc video is on, need to mute it for Chrome
    // when Chrome load the lazy module, the muted video is unmuted somehow
    // need the following code to mute it manually
    var mute_attemp_count = 0;
    var timerid = setTimeout(function() {
      mute_attemp_count++;
      if(mute_attemp_count > 100) {
        clearTimeout(timerid);
        return;
      }
      var elem;
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      if(my_ssrc >= 0 && mediasoupWebRTC.to_show_webrtc_video(my_ssrc)) {
        elem = document.getElementById('webrtc-video-' + my_ssrc);
        if(elem) {
          elem.muted = true;
          clearTimeout(timerid);
        }
      }
    }, 10)
  }
])
;
