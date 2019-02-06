angular.module('hmtgs')
.controller('JoinNetSettingCtrl', ['$scope', 'JoinNet', 'appSetting', '$rootScope', 'hmtgHelper', 'video_bitrate', 'board',
  'video_recving', 'rdc', 'main_video', 'main_video_canvas', 'mediasoupWebRTC',
  function($scope, JoinNet, appSetting, $rootScope, hmtgHelper, video_bitrate, board,
    video_recving, rdc, main_video, main_video_canvas, mediasoupWebRTC) {
    $scope.as = $scope.w = appSetting;
    $scope.vr = video_recving;
    $scope.m2 = main_video_canvas;
    $scope.rdc = rdc;
    $scope.support_monitor_mode = hmtg.customization.support_monitor_mode;

    $scope.$watch('w.show_text', function() {
      hmtg.util.localStorage['hmtg_show_text'] = JSON.stringify($scope.w.show_text);
    });
    $scope.$watch('w.no_tip', function() {
      hmtg.util.localStorage['hmtg_no_tip'] = JSON.stringify($scope.w.no_tip);
    });

    $scope.$watch('w.auto_https', function() {
      hmtg.util.localStorage['hmtg_auto_https'] = JSON.stringify($scope.w.auto_https);
    });

    $scope.$watch('w.show_advanced_function', function() {
      hmtg.util.localStorage['hmtg_show_advanced_function'] = JSON.stringify($scope.w.show_advanced_function);
      // need to update this once show_advanced_function is toggled
      $rootScope.hmtg_show_open_jnj = !!hmtg.customization.show_open_jnj && appSetting.show_advanced_function;
    });
    $scope.$watch('w.meeting_capture_video', function() {
      hmtg.util.localStorage['hmtg_meeting_capture_video'] = JSON.stringify($scope.w.meeting_capture_video);
    });
    $scope.$watch('w.meeting_capture_audio', function() {
      hmtg.util.localStorage['hmtg_meeting_capture_audio'] = JSON.stringify($scope.w.meeting_capture_audio);
    });
    $scope.$watch('w.meetintg_idle_mode', function() {
      hmtg.util.localStorage['hmtg_meetintg_idle_mode'] = JSON.stringify($scope.w.meetintg_idle_mode);
    });
    $scope.$watch('w.auto_follow_tab', function() {
      hmtg.util.localStorage['hmtg_auto_follow_tab'] = JSON.stringify($scope.w.auto_follow_tab);
    });
    $scope.$watch('w.auto_try_webrtc', function() {
      hmtg.util.localStorage['hmtg_auto_try_webrtc'] = JSON.stringify($scope.w.auto_try_webrtc);
    });
    $scope.$watch('w.auto_download_all', function() {
      hmtg.util.localStorage['hmtg_auto_download_all'] = JSON.stringify($scope.w.auto_download_all);
      board.auto_download_all = $scope.w.auto_download_all;
    });
    $scope.$watch('w.wait_key_frame', function() {
      hmtg.util.localStorage['hmtg_wait_key_frame'] = JSON.stringify($scope.w.wait_key_frame);
    });
    $scope.$watch('w.use_max_video_bitrate', function() {
      hmtg.util.localStorage['hmtg_use_max_video_bitrate'] = JSON.stringify($scope.w.use_max_video_bitrate);
      hmtgHelper.inside_angular++;
      hmtg.jnkernel._jn_iMaxVideoBitrate($scope.w.use_max_video_bitrate ? $scope.w.max_video_bitrate * 1000 : 10000000);
      video_bitrate.update_bitrate();
      mediasoupWebRTC.update_bitrate();
      hmtgHelper.inside_angular--;
    });
    $scope.$watch('w.max_video_bitrate', function() {
      hmtg.util.localStorage['hmtg_max_video_bitrate'] = JSON.stringify($scope.w.max_video_bitrate);
      if($scope.w.use_max_video_bitrate) {
        hmtgHelper.inside_angular++;
        hmtg.jnkernel._jn_iMaxVideoBitrate($scope.w.max_video_bitrate * 1000);
        video_bitrate.update_bitrate();
        mediasoupWebRTC.update_bitrate();
        hmtgHelper.inside_angular--;
      }
    });
    $scope.$watch('w.use_max_appdata_bitrate', function() {
      hmtg.util.localStorage['hmtg_use_max_appdata_bitrate'] = JSON.stringify($scope.w.use_max_appdata_bitrate);
      hmtg.jnkernel._jn_iMaxAppdataBitrate($scope.w.use_max_appdata_bitrate ? $scope.w.max_appdata_bitrate * 1000 : 0);
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_APPDATA_BITRATE);
      hmtgHelper.inside_angular--;
    });
    $scope.$watch('w.max_appdata_bitrate', function() {
      hmtg.util.localStorage['hmtg_max_appdata_bitrate'] = JSON.stringify($scope.w.max_appdata_bitrate);
      if($scope.w.use_max_appdata_bitrate) {
        hmtg.jnkernel._jn_iMaxAppdataBitrate($scope.w.max_appdata_bitrate * 1000);
        hmtgHelper.inside_angular++;
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_APPDATA_BITRATE);
        hmtgHelper.inside_angular--;
      }
    });
    $scope.$watch('w.auto_send_video', function() {
      hmtg.util.localStorage['hmtg_auto_send_video'] = JSON.stringify($scope.w.auto_send_video);
    });
    $scope.$watch('w.auto_recv_video', function() {
      hmtg.util.localStorage['hmtg_auto_recv_video'] = JSON.stringify($scope.w.auto_recv_video);
    });
    $scope.$watch('w.prefer_questioner', function() {
      hmtg.util.localStorage['hmtg_prefer_questioner'] = JSON.stringify($scope.w.prefer_questioner);
      setTimeout(function() {
        main_video.update_user_list();
      }, 0);
    });
    $scope.$watch('w.auto_reject_visitor', function() {
      hmtg.util.localStorage['hmtg_auto_reject_visitor'] = JSON.stringify($scope.w.auto_reject_visitor);
    });
    $scope.$watch('w.auto_allow_visitor', function() {
      hmtg.util.localStorage['hmtg_auto_allow_visitor'] = JSON.stringify($scope.w.auto_allow_visitor);
    });
    $scope.$watch('w.auto_allow_question', function() {
      hmtg.util.localStorage['hmtg_auto_allow_question'] = JSON.stringify($scope.w.auto_allow_question);
    });
    $scope.$watch('w.show_control_panel_textchat', function() {
      hmtg.util.localStorage['hmtg_show_control_panel_textchat'] = JSON.stringify($scope.w.show_control_panel_textchat);
    });
    $scope.$watch('w.show_private_note', function() {
      hmtg.util.localStorage['hmtg_show_private_note'] = JSON.stringify($scope.w.show_private_note);
      if(!$scope.w.show_private_note && board.is_private) {
        board.switchWhiteBoard();
      }
    });
    $scope.$watch('w.remote_monitor_mode', function() {
      hmtg.util.localStorage['hmtg_remote_monitor_mode'] = JSON.stringify($scope.w.remote_monitor_mode);
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_MONITOR_MODE);
      hmtgHelper.inside_angular--;
    });
    $scope.$watch('w.restrict_audio_decoding', function() {
      hmtg.util.localStorage['hmtg_restrict_audio_decoding'] = JSON.stringify($scope.w.restrict_audio_decoding);
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_AUDIO_DECODING);
      hmtgHelper.inside_angular--;
    });
    $scope.$watch('w.max_audio_decoding', function() {
      hmtg.util.localStorage['hmtg_max_audio_decoding'] = JSON.stringify($scope.w.max_audio_decoding);
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_AUDIO_DECODING);
      hmtgHelper.inside_angular--;
    });
    $scope.profiles = [
      { value: 'high', text: 'high' },
      { value: 'medium', text: 'medium' },
      { value: 'low', text: 'low' }
    ];
    $scope.$watch('w.webrtc_bandwidth_profile', function() {
      hmtg.util.localStorage['hmtg_webrtc_bandwidth_profile'] = JSON.stringify($scope.w.webrtc_bandwidth_profile);
    });
 }
])
;