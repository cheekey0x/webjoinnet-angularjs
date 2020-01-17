angular.module('joinnet')
.controller('StatCtrl', ['$scope', '$rootScope', 'jnjContent', 'hmtgHelper', 'playback', 'video_playback', 'video_capture',
  'statistics', '$sce', 'audio_codec', 'video_bitrate', '$translate', 'video_codec', 'sdt', 'rdc', 'joinnetAudio',
  'joinnetVideo', 'joinnetTranscoding', 'video_recving', 'appSetting', 'userlist', 'board',
  'mediasoupWebRTC', 'hmtgSound',
  function($scope, $rootScope, jnjContent, hmtgHelper, playback, video_playback, video_capture, statistics, $sce, audio_codec,
    video_bitrate, $translate, video_codec, sdt, rdc, joinnetAudio, joinnetVideo, joinnetTranscoding, video_recving,
    appSetting, userlist, board, mediasoupWebRTC, hmtgSound) {
    $scope.as = appSetting;
    $scope.has_snapshot = false;
    $scope.snapshot_info = '';
    $scope.stat_html = '';
    $scope.snapshot_html = '';
    $scope.intervalID = setInterval(update_str, 1000);
    var codec2str = hmtg.jnkernel._codec2str();

    $scope.row_fluid = function() {
      if(!$scope.has_snapshot) return '';
      return 'row-fluid';
    }
    $scope.col_area = function() {
      if(!$scope.has_snapshot) return '';
      return 'col-xs-6';
    }

    $scope.freeze = function() {
      $scope.has_snapshot = true;
      $scope.snapshot_html = $scope.stat_html;
      $scope.snapshot_time = new Date();
      $scope.snapshot_info_func = function() {
        var t = $scope.snapshot_time.toString().replace(/(GMT.*)/, "");
        return $translate.instant('ID_STAT_SNAPSHOT').replace('#time#', t);
      };
      $scope.snapshot_info = $scope.snapshot_info_func();
    }

    $scope.close = function() {
      $scope.has_snapshot = false;
      $scope.snapshot_html = '';
    }

    $scope.show_stat_log = function() {
      appSetting.show_stat_log = 1;
      $rootScope.nav_item = 'log';
      $rootScope.tabs[7].active = true;
      $rootScope.selectTabLog();
      $rootScope.$broadcast(hmtgHelper.WM_SHOW_STAT_LOG);
    }

    $rootScope.$on('$translateChangeEnd', function() {
      if($scope.snapshot_info_func)
        $scope.snapshot_info = $scope.snapshot_info_func();
    });

    $scope.$on(hmtgHelper.WM_RESET_SESSION, function() {
      $scope.close();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    function update_str() {
      if(!statistics.active) {
        $scope.stat_html = '';
        return;
      }
      $scope.stat_html = '';
      var html = '';
      var now = hmtg.util.GetTickCount();
      if(hmtg.jnkernel._memory_usage()) {
        html += '<div class="stat_block"><b>' + $translate.instant('ID_WHITE_BOARD') + ',' + $translate.instant('ID_MEMORY_USAGE') + '</b>: ' + hmtgHelper.number2GMK(hmtg.jnkernel._memory_usage()) + 'B</div>';
      }
      if(board.memory_usage) {
        html += '<div class="stat_block"><b>' + $translate.instant('ID_TOGGLE_LOCAL_SLIDE') + ',' + $translate.instant('ID_MEMORY_USAGE') + '</b>: ' + hmtgHelper.number2GMK(board.memory_usage) + 'B</div>';
      }
      if(hmtg.jnkernel._jn_bConnected()) {
        html += '<div class="stat_block"><b>' + $translate.instant('ID_CIPHER') + '</b>: ' + hmtgHelper.cipher_info($translate.instant, hmtg.jnkernel._cipher_name()) + '</div>';
        if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
          html += '<div class="stat_block"><b>' + $translate.instant('ID_SERVER_CONFIG') + '</b>: ' + hmtgHelper.number2gmk(hmtg.jnkernel._jn_iMaxBandwidth()) + 'bps</div>';
          if(appSetting.use_max_video_bitrate && appSetting.max_video_bitrate * 1000 < hmtg.jnkernel._jn_iMaxBandwidth()) {
            html += '<div class="stat_block"><b>' + $translate.instant('ID_USE_MAX_VIDEO_BITRATE') + '</b>: ' + hmtgHelper.number2gmk(appSetting.max_video_bitrate * 1000) + 'bps</div>';
          }
          if(mediasoupWebRTC.webrtcStatus == 4) {
            html += '<div class="stat_block text-success"><b>' + 'WebRTC' + '</b>: ' + $translate.instant('ID_WEBRTC_STATUS_FULLY_CONNECTED') + '</div>';
          } else if(mediasoupWebRTC.webrtcStatus == 3) {
            html += '<div class="stat_block text-danger"><b>' + 'WebRTC' + '</b>: ' + $translate.instant('ID_WEBRTC_STATUS_BAD_ICE') + '</div>';
          } else if(mediasoupWebRTC.webrtcStatus == 2) {
            html += '<div class="stat_block text-info"><b>' + 'WebRTC' + '</b>: ' + $translate.instant('ID_WEBRTC_STATUS_SEARCH_ICE') + '</div>';
          } else if(mediasoupWebRTC.webrtcStatus == 1) {
            html += '<div class="stat_block text-danger"><b>' + 'WebRTC' + '</b>: ' + $translate.instant('ID_WEBRTC_STATUS_NOT_CONNECTED') + '</div>';
          } else if(!hmtg.jnkernel._jn_is_webrtc_supported()) {
            html += '<div class="stat_block text-danger"><b>' + 'WebRTC' + '</b>: ' + $translate.instant('ID_WEBRTC_STATUS_NOT_SUPPORTED') + '</div>';
          } else {
            html += '<div class="stat_block text-warning"><b>' + 'WebRTC' + '</b>: ' + $translate.instant('ID_WEBRTC_STATUS_NOT_USED') + '</div>';
          }
        }

        var stat;
        if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
          html += '<hr/><h3>' + $translate.instant('ID_SENDING') + '</h3>';

          html += '<div class="stat_block">';
          stat = hmtg.jnkernel._stat_audio();
          if(stat && (now - stat.tick) < 5000) {
            html += '<div><i>' + $translate.instant('ID_AUDIO_CODEC') + '</i>: ' + codec2str(audio_codec.audio_codec).toUpperCase() + '</div>';
            html += '<div><i>' + $translate.instant('ID_AUDIO_TARGET_RATE') + '</i>: ' + audio_codec.audio_bitrate_str + '</div>';
            html += '<div><b>' + $translate.instant('ID_AUDIO_SENDING_RATE') + '</b>: ' + hmtgHelper.number2gmk(stat.rate) + 'bps</div>';
          } else if(!(joinnetAudio.recording || joinnetTranscoding.audio_transcoding)) {
            html += '<div class="text-danger"><b>' + $translate.instant('ID_NO_AUDIO_DATA') + '</b>' + '</div>';
          } else if((!joinnetAudio.recording || hmtgSound.record_muted)
            && (!joinnetTranscoding.audio_transcoding || joinnetTranscoding.transcoding_muted)) {
            html += '<div class="text-danger"><b>' + $translate.instant('ID_AUDIO_MUTED') + '</b>' + '</div>';
          } else if(!hmtg.jnkernel.jn_info_CanSendAudio()) {
            html += '<div class="text-danger"><b>' + $translate.instant('ID_AUDIO_NONTALKER') + '</b>' + '</div>';
          }
          html += '</div>';
          if(mediasoupWebRTC._room && mediasoupWebRTC._audioProducer && mediasoupWebRTC.webrtcStatus == 4) {
            html += '<div class="stat_block">';
            if(mediasoupWebRTC._audioProducer.rtpParameters
              && mediasoupWebRTC._audioProducer.rtpParameters.codecs
              && mediasoupWebRTC._audioProducer.rtpParameters.codecs[0]
              && mediasoupWebRTC._audioProducer.rtpParameters.codecs[0].name
            ) {
              html += '<div class="text-success"><i>WebRTC ' + $translate.instant('ID_AUDIO_CODEC') + '</i>: ' + mediasoupWebRTC._audioProducer.rtpParameters.codecs[0].name.toUpperCase() + '</div>';
            }  
            if(mediasoupWebRTC._audioProducer.paused) {
              html += '<div class="text-danger"><b>' + $translate.instant('ID_STATUS_PAUSED') + '</b>' + '</div>';
            } else if(mediasoupWebRTC.audioStats && mediasoupWebRTC.audioStats.length
              && (now - mediasoupWebRTC.audioStatsTick) < 5000) {
              var rtcStat = mediasoupWebRTC.audioStats[0];
              if(rtcStat.bitrate) {
                html += '<div class="text-success"><b>WebRTC ' + $translate.instant('ID_AUDIO_SENDING_RATE') + '</b>: ' + hmtgHelper.number2gmk(rtcStat.bitrate) + 'bps</div>';
              }
            }  
            html += '</div>';
          }  

          html += '<div class="stat_block">';
          stat = hmtg.jnkernel._stat_video();
          if(stat && (now - stat.tick) < 5000) {
            html += '<div><i>' + $translate.instant('ID_VIDEO_CODEC') + '</i>: ' + codec2str(video_codec.video_codec).toUpperCase() + '</div>';
            html += '<div><i>' + $translate.instant('ID_VIDEO_TARGET_RATE') + '</i>: ' + video_bitrate.bitrate_str + '</div>';
            html += '<div><b>' + $translate.instant('ID_VIDEO_SENDING_RATE') + '</b>: ' + hmtgHelper.number2gmk(stat.rate) + 'bps</div>';

            stat = video_capture.stat;
            if(stat && (now - stat.tick) < 5000) {
              html += '<div><i>' + $translate.instant('ID_TARGET_VIDEO_CAPTURE') + '</i>: ' + video_codec.fps + 'fps</div>';
              html += '<div><i>' + $translate.instant('ID_FEATURE_VIDEO_CAPTURE') + '</i>: ' + hmtgHelper.float2fmt(stat.rate) + 'fps</div>';
              html += '<div>' + $translate.instant('ID_VIDEO_CAPTURE_SIZE') + ': ' + stat.capture_width + ' x ' + stat.capture_height + '</div>';
              html += '<div>' + $translate.instant('ID_VIDEO_SENDING_SIZE') + ': ' + stat.sending_width + ' x ' + stat.sending_height + '</div>';
            }
          } else if(!((joinnetVideo.use_screen_as_video ? joinnetVideo.screen_recording : joinnetVideo.recording) || joinnetTranscoding.video_transcoding)) {
            html += '<div class="text-danger"><b>' + $translate.instant('ID_NO_VIDEO_DATA') + '</b>' + '</div>';
          } else if(!video_bitrate.is_send_video) {
            html += '<div class="text-danger"><b>' + $translate.instant('ID_VIDEO_SENDING_STOPPED') + '</b>' + '</div>';
          } else if(!hmtg.jnkernel.jn_info_CanSendVideo()) {
            html += '<div class="text-danger"><b>' + $translate.instant('ID_VIDEO_NONTALKER') + '</b>' + '</div>';
          }
          html += '</div>';
          if(mediasoupWebRTC._room && mediasoupWebRTC._videoProducer && mediasoupWebRTC.webrtcStatus == 4) {
            html += '<div class="stat_block">';
            if(mediasoupWebRTC._videoProducer.rtpParameters
              && mediasoupWebRTC._videoProducer.rtpParameters.codecs
              && mediasoupWebRTC._videoProducer.rtpParameters.codecs[0]
              && mediasoupWebRTC._videoProducer.rtpParameters.codecs[0].name
            ) {
              html += '<div class="text-success"><i>WebRTC ' + $translate.instant('ID_VIDEO_CODEC') + '</i>: ' + mediasoupWebRTC._videoProducer.rtpParameters.codecs[0].name.toUpperCase() + '</div>';
            }  
            if(mediasoupWebRTC._videoProducer.paused) {
              html += '<div class="text-danger"><b>' + $translate.instant('ID_STATUS_PAUSED') + '</b>' + '</div>';
            } else if(mediasoupWebRTC.videoStats && mediasoupWebRTC.videoStats.length
              && (now - mediasoupWebRTC.videoStatsTick) < 5000) {
              var rtcStat = mediasoupWebRTC.videoStats[0];
              if(rtcStat.bitrate) {
                html += '<div class="text-success"><b>WebRTC ' + $translate.instant('ID_VIDEO_SENDING_RATE') + '</b>: ' + hmtgHelper.number2gmk(rtcStat.bitrate) + 'bps</div>';
              }
            }
            html += '</div>';
          }  

          // appdata
          var array = hmtg.jnkernel._jn_plugin_data();
          for(i = 0; i < hmtg.config.MAX_PLUG_IN_CHANNEL; i++) {
            if(!array[i] || !array[i]._active()) continue;
            html += '<div class="stat_block">';
            stat = array[i]._stat();
            if(stat && (now - stat.tick) < 5000) {
              var name;
              var str = array[i]._guid_str();
              if(str == hmtgHelper.GUID_DESKTOP_SHARING) {
                name = $translate.instant('ID_DESKTOP_SHARING');
                if(sdt.capture_width) {
                  html += '<div>' + name + ',' + $translate.instant('ID_SIZE') + ': ' + sdt.capture_width + ' x ' + sdt.capture_height + '</div>';
                }
                if(sdt.capture_color_str_id) {
                  html += '<div>' + name + ',' + $translate.instant('ID_COLOR_DEPTH') + ': ' + $translate.instant(sdt.capture_color_str_id) + '</div>';
                }
                var capture_stat = sdt.capture_stat;
                if(capture_stat && (now - capture_stat.tick) < 5000) {
                  if(capture_stat.rate) {
                    html += '<div><i>' + name + ',' + $translate.instant('ID_CAPTURE_RATE') + '</i>: ' + hmtgHelper.float2fmt(capture_stat.rate) + 'fps</div>';
                  }
                }
              } else if(str == hmtgHelper.GUID_REMOTE_CONTROL) {
                name = $translate.instant('ID_REMOTE_CONTROL');
                if(rdc.capture_width) {
                  html += '<div>' + name + ',' + $translate.instant('ID_SIZE') + ': ' + rdc.capture_width + ' x ' + rdc.capture_height + '</div>';
                }
                if(rdc.capture_color_str_id) {
                  html += '<div>' + name + ',' + $translate.instant('ID_COLOR_DEPTH') + ': ' + $translate.instant(rdc.capture_color_str_id) + '</div>';
                }
                var capture_stat = rdc.capture_stat;
                if(capture_stat && (now - capture_stat.tick) < 5000) {
                  if(capture_stat.rate) {
                    html += '<div><i>' + name + ',' + $translate.instant('ID_CAPTURE_RATE') + '</i>: ' + hmtgHelper.float2fmt(capture_stat.rate) + 'fps</div>';
                  }
                }
              } else {
                name = str;
              }
              html += '<div><i>' + name + ',' + $translate.instant('ID_TARGET_RATE') + '</i>: ' + hmtgHelper.number2gmk(array[i]._data_rate()) + 'bps</div>';
              html += '<div><b>' + name + ',' + $translate.instant('ID_SENDING_RATE') + '</b>: ' + hmtgHelper.number2gmk(stat.rate) + 'bps</div>';
            }
            html += '</div>';
          }
        }

        html += '<hr/><h3>' + $translate.instant('ID_RECVING') + '</h3>';
        if(!hmtg.jnkernel.jn_callback_IsRecvingAudio() && hmtg.jnkernel.jn_info_IsNoAudioSupportedByMCU()) {
          html += '<div class="text-danger"><b>' + $translate.instant('ID_AUDIO_RECVING_STOPPED') + '</b>' + '</div><br />';
        }
        if(!video_recving.is_recv_video) {
          html += '<div class="text-danger"><b>' + $translate.instant('ID_VIDEO_RECVING_STOPPED') + '</b>' + '</div><br />';
        }

        var hash = {};
        var html_list = [];
        var ssrc;
        // token holder
        ssrc = hmtg.jnkernel._jn_iTokenHolder();
        if(ssrc != -1) {
          hash[ssrc] = true;
          html += printStat(ssrc, now);
        }
        var ssrc2;
        // data sender
        ssrc2 = hmtg.jnkernel._jn_iDataSender();
        if(ssrc2 != -1 && ssrc2 != ssrc) {
          hash[ssrc2] = true;
          add_html_list(html_list, ssrc2, now);
        }
        // other questioneres
        var list = hmtg.jnkernel._jn_iParticipantAudioSsrc();
        var i;
        for(i = 0; i < list.length; i++) {
          if(list[i] != -1 && !hash[list[i]]) {
            hash[list[i]] = true;
            add_html_list(html_list, list[i], now);
          }
        }
        // appdata
        var array = hmtg.jnkernel._jn_plugin_data();
        for(i = 0; i < hmtg.config.MAX_PLUG_IN_CHANNEL; i++) {
          if(!array[i] || !array[i]._active()) continue;
          // to do
          // for each active appdata
          // iterate all possible data source ssrc
        }

        for(i = 0; i < html_list.length; i++) {
          html += html_list[i].html;
        }

      } else {
        html += '<div class="stat_block">' + $translate.instant('ID_NOT_CONNECTED') + '</div>';
      }
      $scope.stat_html = $sce.trustAsHtml(html);
      $scope.$digest();
    }

    function add_html_list(html_list, ssrc, now) {
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var name = hmtg.util.decodeUtf8(a[ssrc] ? a[ssrc]._szRealName() : ('ssrc' + ssrc)) + ssrc;
      var html = printStat(ssrc, now);
      var i;
      for(i = 0; i < html_list.length; i++) {
        if(name < html_list[i].name) {
          html_list.splice(i, 0, { name: name, html: html });
          return;
        }
      }
      html_list.push({ name: name, html: html });
    }

    function printHeader(user, ssrc) {
      return '<div class="stat_block"><h4>' + hmtgHelper.escapeHtml(hmtg.util.decodeUtf8(user._szRealName())) + '(ssrc=' + ssrc + ')</h4><ul>';
    }

    function printStat(ssrc, now) {
      var html = '';
      var user, header;
      var me_using_webrtc = mediasoupWebRTC.webrtcStatus == 4;
      if(ssrc != -1) {
        user = hmtg.jnkernel._jn_UserArray()[ssrc];
        if(user) {
          var peer_using_webrtc = user._m_iWebRTCStatus() == 4;
          header = false;

          // audio
          var has_audio_stat = false;
          if(me_using_webrtc && peer_using_webrtc && mediasoupWebRTC.remoteIsWebRTCAudio[ssrc]) {
            if(mediasoupWebRTC.remoteAudioConsumer[ssrc]) {
              if(!header) {
                header = true;
                html += printHeader(user, ssrc);
              }
              if(mediasoupWebRTC.remoteAudioConsumer[ssrc].rtpParameters
                && mediasoupWebRTC.remoteAudioConsumer[ssrc].rtpParameters.codecs
                && mediasoupWebRTC.remoteAudioConsumer[ssrc].rtpParameters.codecs[0]
                && mediasoupWebRTC.remoteAudioConsumer[ssrc].rtpParameters.codecs[0].name
              ) {
                html += '<li class="text-success"><i>WebRTC ' + $translate.instant('ID_AUDIO_CODEC') + '</i>: ' + mediasoupWebRTC.remoteAudioConsumer[ssrc].rtpParameters.codecs[0].name.toUpperCase();
              }
              if(mediasoupWebRTC.remoteAudioConsumer[ssrc].paused) {
                html += '<div class="text-danger"><b>' + $translate.instant('ID_STATUS_PAUSED') + '</b>' + '</div>';
                has_audio_stat = true;
              } else if(mediasoupWebRTC.remoteAudioStatsTick[ssrc]
                && mediasoupWebRTC.remoteAudioStats[ssrc]
                && (now - mediasoupWebRTC.remoteAudioStatsTick[ssrc]) < 5000) {
                var rtcStat = mediasoupWebRTC.remoteAudioStats[ssrc][0];
                if(rtcStat.bitrate) {
                  html += '<li class="text-success"><b>WebRTC ' + $translate.instant('ID_AUDIO_RECVING_RATE') + '</b>: ' + hmtgHelper.number2gmk(rtcStat.bitrate) + 'bps';
                  has_audio_stat = true;
                }
              }
            }
          } else {
            stat = user.sra;
            if(stat && (now - stat.tick) < 5000) {
              has_audio_stat = true;
              if(!header) {
                header = true;
                html += printHeader(user, ssrc);
              }
              html += '<li><i>' + $translate.instant('ID_AUDIO_CODEC') + '</i>: ' + codec2str(stat.type).toUpperCase();
              if(stat.rate) {
                html += '<li><b>' + $translate.instant('ID_AUDIO_RECVING_RATE') + '</b>: ' + hmtgHelper.number2gmk(stat.rate) + 'bps';
              }
              if(stat.loss_rate) {
                html += '<li><b>' + $translate.instant('ID_AUDIO_LOSS_RATE') + '</b>: ' + (stat.loss_rate / 100) + '%';
              }
              if(appSetting.restrict_audio_decoding) {
                var index = userlist.ssrc2index(ssrc);
                if(index != -1 && !userlist.user_list[index].decoding) {
                  html += '<div class="text-danger"><b>' + $translate.instant('ID_AUDIO_NOT_DECODED') + '</b>' + '</div>';
                }
              }
            }
          }
          if(!has_audio_stat && !(user._cap() & 0x1)) {
            // web joinnet doesn't receive audio from self
            // skip this if the audio is from self
            if(ssrc != hmtg.jnkernel._jn_ssrc_index()) {
              if(!header) {
                header = true;
                html += printHeader(user, ssrc);
              }
              html += '<li>' + $translate.instant('ID_NO_AUDIO_DATA');
            }
          }

          // video
          var has_video_stat = false;
          if(me_using_webrtc && peer_using_webrtc && mediasoupWebRTC.remoteIsWebRTCVideo[ssrc]) {
            if(mediasoupWebRTC.remoteVideoConsumer[ssrc]) {
              if(!header) {
                header = true;
                html += printHeader(user, ssrc);
              }
              if(mediasoupWebRTC.remoteVideoConsumer[ssrc].rtpParameters
                && mediasoupWebRTC.remoteVideoConsumer[ssrc].rtpParameters.codecs
                && mediasoupWebRTC.remoteVideoConsumer[ssrc].rtpParameters.codecs[0]
                && mediasoupWebRTC.remoteVideoConsumer[ssrc].rtpParameters.codecs[0].name
              ) {
                html += '<li class="text-success"><i>WebRTC ' + $translate.instant('ID_VIDEO_CODEC') + '</i>: ' + mediasoupWebRTC.remoteVideoConsumer[ssrc].rtpParameters.codecs[0].name.toUpperCase()
                  //+ ' ' + mediasoupWebRTC.remoteVideoConsumer[ssrc].preferredProfile
                  ;
              }
              if(mediasoupWebRTC.remoteVideoConsumer[ssrc].paused) {
                html += '<div class="text-danger"><b>' + $translate.instant('ID_STATUS_PAUSED') + '</b>' + '</div>';
                has_video_stat = true;
              } else if(mediasoupWebRTC.remoteVideoStatsTick[ssrc]
                && mediasoupWebRTC.remoteVideoStats[ssrc]
                && (now - mediasoupWebRTC.remoteVideoStatsTick[ssrc]) < 5000) {
                var rtcStat = mediasoupWebRTC.remoteVideoStats[ssrc][0];
                if(rtcStat.bitrate) {
                  html += '<li class="text-success"><b>WebRTC ' + $translate.instant('ID_VIDEO_RECV_RATE') + '</b>: ' + hmtgHelper.number2gmk(rtcStat.bitrate) + 'bps';
                  has_video_stat = true;
                }

                var elem = document.getElementById('webrtc-video-' + ssrc);
                if(elem) {
                  if(elem.videoWidth && elem.videoHeight) {
                    html += '<li class="text-success">WebRTC ' + $translate.instant('ID_VIDEO_RECVING_SIZE') + ': ' + elem.videoWidth + ' x ' + elem.videoHeight;
                  }
                } else if(ssrc == video_recving.main_video_ssrc) {
                  elem = document.getElementById('webrtc_main_video');
                  if(elem && elem.videoWidth && elem.videoHeight) {
                    html += '<li class="text-success">WebRTC ' + $translate.instant('ID_VIDEO_RECVING_SIZE') + ': ' + elem.videoWidth + ' x ' + elem.videoHeight;
                  }
                }
              }
            }
          } else {
            stat = user.srv;
            if(stat && (now - stat.tick) < 5000) {
              has_video_stat = true;
              if(!header) {
                header = true;
                html += printHeader(user, ssrc);
              }
              html += '<li><i>' + $translate.instant('ID_VIDEO_CODEC') + '</i>: ' + codec2str(stat.type).toUpperCase();
              if(stat.rate) {
                html += '<li><b>' + $translate.instant('ID_VIDEO_RECV_RATE') + '</b>: ' + hmtgHelper.number2gmk(stat.rate) + 'bps';
              }
              if(stat.loss_rate) {
                html += '<li><b>' + $translate.instant('ID_VIDEO_LOSS_RATE') + '</b>: ' + (stat.loss_rate / 100) + '%';
              }
              var playback = video_playback.video_playback_array[ssrc];
              if(playback) {
                stat = playback.stat;
                if(stat && (now - stat.tick) < 5000) {
                  if(!header) {
                    header = true;
                    html += printHeader(user, ssrc);
                  }
                  if(stat.rate) {
                    html += '<li><i>' + $translate.instant('ID_VIDEO_DISPLAY') + '</i>: ' + hmtgHelper.float2fmt(stat.rate) + 'fps';
                    html += '<li>' + $translate.instant('ID_VIDEO_RECVING_SIZE') + ': ' + stat.recving_width + ' x ' + stat.recving_height;
                  }
                }
              }
            }
          }
          
          if(has_video_stat) {
          } else if(!(user._cap() & 0x2)) {
            // web joinnet doesn't receive video from self when webrtc is fully connected
            // skip this if the video is from self and webrtc is on
            if(ssrc != hmtg.jnkernel._jn_ssrc_index() || !me_using_webrtc) {
              if(!header) {
                header = true;
                html += printHeader(user, ssrc);
              }
              html += '<li>' + $translate.instant('ID_NO_VIDEO_DATA');
            }
          } else if(user._m_iVideoSendingStatus() == 2 && !mediasoupWebRTC.remoteVideoConsumer[ssrc]) {
            // web joinnet doesn't receive video from self when webrtc is fully connected
            // skip this if the video is from self and webrtc is on
            if(ssrc != hmtg.jnkernel._jn_ssrc_index() || !me_using_webrtc) {
              if(!header) {
                header = true;
                html += printHeader(user, ssrc);
              }
              html += '<li>' + $translate.instant('ID_VIDEO_SENDING_STOPPED');
            }
          }

          // appdata
          var i;
          var array = hmtg.jnkernel._jn_plugin_data();
          for(i = 0; i < hmtg.config.MAX_PLUG_IN_CHANNEL; i++) {
            if(!array[i] || !array[i]._active()) continue;
            stat = user['srp' + i];
            if(stat && (now - stat.tick) < 5000) {
              if(!header) {
                header = true;
                html += printHeader(user, ssrc);
              }
              var name;
              var str = array[i]._guid_str();
              if(str == hmtgHelper.GUID_DESKTOP_SHARING) {
                name = $translate.instant('ID_DESKTOP_SHARING');
                if(sdt.meta_width) {
                  html += '<li>' + name + ',' + $translate.instant('ID_SIZE') + ': ' + sdt.meta_width + ' x ' + sdt.meta_height;
                }
                if(sdt.meta_color_str_id) {
                  html += '<li>' + name + ',' + $translate.instant('ID_COLOR_DEPTH') + ': ' + $translate.instant(sdt.meta_color_str_id);
                }
                var meta_stat = sdt.meta_stat;
                if(meta_stat && (now - meta_stat.tick) < 5000) {
                  if(meta_stat.rate) {
                    html += '<li><i>' + name + ',' + $translate.instant('ID_DISPLAY_RATE') + '</i>: ' + hmtgHelper.float2fmt(meta_stat.rate) + 'fps';
                  }
                }
              } else if(str == hmtgHelper.GUID_REMOTE_CONTROL) {
                name = $translate.instant('ID_REMOTE_CONTROL');
                if(rdc.controllee_ssrc == ssrc) {
                  if(rdc.meta_width) {
                    html += '<li>' + name + ',' + $translate.instant('ID_SIZE') + ': ' + rdc.meta_width + ' x ' + rdc.meta_height;
                  }
                  if(rdc.meta_color_str_id) {
                    html += '<li>' + name + ',' + $translate.instant('ID_COLOR_DEPTH') + ': ' + $translate.instant(rdc.meta_color_str_id);
                  }
                  var meta_stat = rdc.meta_stat;
                  if(meta_stat && (now - meta_stat.tick) < 5000) {
                    if(meta_stat.rate) {
                      html += '<li><i>' + name + ',' + $translate.instant('ID_DISPLAY_RATE') + '</i>: ' + hmtgHelper.float2fmt(meta_stat.rate) + 'fps';
                    }
                  }
                }
              } else {
                name = str;
              }
              if(stat.rate) {
                html += '<li><b>' + name + ',' + $translate.instant('ID_RECV_RATE') + '</b>: ' + hmtgHelper.number2gmk(stat.rate) + 'bps';
              }
              if(stat.loss_rate) {
                html += '<li><b>' + name + ',' + $translate.instant('ID_LOSS_RATE') + '</b>: ' + (stat.loss_rate / 100) + '%';
              }
            }
          }
          if(header) html += '</ul></div>';
        }
      }

      return html;
    }

  }
])
;