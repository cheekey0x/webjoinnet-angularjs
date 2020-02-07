/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('msgr')
  .service('imDlg', ['$translate', 'msgrHelper', 'appSetting', 'hmtgHelper', '$rootScope', '$ocLazyLoad', 'hmtgAlert',
    'hmtgSound', '$sce', '$compile', 'imStyle', 'imContainer', 'board', '$modal', 'missedCall',
    'mediasoupWebRTC',
    function($translate, msgrHelper, appSetting, hmtgHelper, $rootScope, $ocLazyLoad, hmtgAlert, hmtgSound, $sce, $compile,
      imStyle, imContainer, board, $modal, missedCall, mediasoupWebRTC) {
      var _imDlg = this;
      this.im_array = []; // conversation
      this.iml_array = [];  // conversation log
      /*
      this.iceConfig = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun.bcs2005.net" }
        ]
      };
      */
      this.webrtcOfferOptions = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
        voiceActivityDetection: false
      };
      this.webrtcOfferOptionsAudio = {
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 0,
        voiceActivityDetection: false
      };

      this.fast_update = function() {
        if(this.delayed_update_timerID) {
          clearTimeout(this.delayed_update_timerID);
          this.delayed_update_timerID = null;
        }
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_MSGR);
      }
      this.delayed_update = function() {
        if(this.delayed_update_timerID) return;
        this.delayed_update_timerID = setTimeout(function() {
          _imDlg.delayed_update_timerID = null;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_MSGR);
        }, 500);
      }

      var last_msg_status = false;
      this.has_msg = function() {
        var new_status = false;
        var i;
        for(i = 0; i < this.im_array.length; i++) {
          if(this.im_array[i].msg || this.im_array[i].alert_save || this.im_array[i].alert_recv) {
            new_status = true;
            break;
          }
        }
        if(new_status != last_msg_status) {
          last_msg_status = new_status;
          hmtgHelper.fast_apply();
          document.title = (new_status ? '*** ' : '') + $translate.instant('IDS_APP_NAME');
        }
        return new_status;
      }

      var TYPING_SEND_INTERVAL = 2000;
      var TYPING_DISAPPEAR_INTERVAL = (10000 + (TYPING_SEND_INTERVAL >> 1));

      var SEND_ERROR = 1;
      var SEND_WAIT = 2;
      var SEND_SEND = 3;
      var SEND_LOSE_CONTACT = 4;
      var RECV_ERROR = 5;
      var RECV_WAIT = 6;
      var RECV_RECV = 7;
      var ALL_FINISH = 8;

      var SENDFILE_ACTION_ACCEPT = 1;
      var SENDFILE_ACTION_CANCEL = 2;
      var SENDFILE_ACTION_RESUME = 3;
      var SENDFILE_ACTION_ACK = 4;
      var SENDFILE_ACTION_NOT_FOUND = 101;
      var SENDFILE_ACTION_LOW_VERSION = 102;
      var SENDFILE_ACTION_LOSE_CONTACT = 103;
      var SENDFILE_ACTION_CANCEL2 = 201;


      // im: object of conversation and conversation log
      function im(is_log) {
        var now = hmtg.util.GetTickCount();
        this.is_log = is_log;
        this.title = '';
        this.m_group_id = '';
        this.m_b_is_peer_guest = false;
        this.guest_user_name = '';
        this.peer_userid = '';
        this.peer_username = '';
        this.guest_office_name = '';
        this.last_typing_sent_tick = now - 60000;
        this.m_last_im_sent_tick = this.last_typing_sent_tick - 60000;
        this.last_show_time_tick = now - 60000;
        this.show_fts_tick = now - 60000;
        this.last_show_time_count = 100;
        this.last_show_time_id = this.last_show_time_name = '';
        this.img = is_log ? 'img/icon_im_log_large.png' : 'img/icon_im_large.png';
        this.m_request_hash = {};
        this.waiting_id = '';
        this.input = '';

        this.offset1 = -1;  // when offset1 is 0, it has reached the head of the log
        this.offset2 = -1;
        this.show_download2 = true;
        this.has_error = false;

        this.fts_array = [];
        this.m_server_queue_size = 0;
        this.m_server_queue_tick = now;
        this.memory_usage = 0;

        this.alert = '';
        this.typing_intervalID = null;
        this.peer_typing_tick = now - 60000;

        this.pc = null;
        this.can_mix = hmtgSound.can_mix;
        this.is_webrtc_audio_only = true;
        this.webrtc_local_id = 0;
        this.webrtc_peer_id = 0;
        this.local_stream = null;
        this.ice_candidate_array = [];
        this.webrtc_connected = false;
        this.last_poll_tick = 0;
        this.open_poll_count = 0;
        this.webrtc_wait_timerID = null;
        this.has_video_webrtc = false;
        this.webrtc_video_layout = 1;
        this.local_video = null;
        this.remote_video = null;
        this.import_video = null;
        this.import_audio = null;
        this.microphone_node = null;
        this.import_node = null;
        this.microphone_canvas = null;
        this.speaker_canvas = null;
        this.import_forward_canvas = null;
        this.import_playback_canvas = null;
        this.import_forward_gain_node = null;
        this.microphone_gain_node = null;
        this.import_playback_gain_node = null;
        this.speaker_gain_node = null;
        this.mixer_node = null;
        this.loop = true;
        this.webrtc_audio_senders = [];
        this.webrtc_video_senders = [];
        this.webrtc_start_tick = 0;
        this.webrtc_duration_str = '';
        this.webrtc_intervalID = null;
        this.is_firefox = !!navigator.mozGetUserMedia;
        this.is_webrtc_fullscreen = false;
        this.webrtc_fullscreen_element = null;
      }

      // fts: object of file transfer
      function fts(is_send) {
        this.file_transfer = is_send ? 1 : 2;
        this.idle_timerID = resume_timerID = null;
        //this.transfer_timerID = null;
        this.transferWorker = null;
        this.progress = 0;
        this.tick_array = [];
        this.len_array = [];
        this.rate_data_size = 0;
        this.last_send_tick = hmtg.util.GetTickCount();
      }

      // webrtc stuff
      im.prototype.start_webrtc_audio_session = function($scope, target) {
        if(!target) target = this;
        target.start_webrtc_session($scope, target, false);
      }

      im.prototype.start_webrtc_video_session = function($scope, target) {
        if(!target) target = this;
        target.start_webrtc_session($scope, target, true);
      }

      im.prototype.start_webrtc_session = function($scope, target, with_video) {
        if(!target) target = this;
        if(target.pc) return;

        /*
        var stream;
        target.hasLocalFile = true;
        var myVideo = pinSourceVideo(target);
        myVideo.loop = true;
        myVideo.src = null;
        myVideo.src = 'http://www.homemeeting.com/html5/tree.mp4';
        myVideo.oncanplay = maybeCreateStream;
        if(myVideo.readyState >= 3) {  // HAVE_FUTURE_DATA
          // Video is already ready to play, call maybeCreateStream in case oncanplay
          // fired before we registered the event handler.
          maybeCreateStream();
        }
        myVideo.play();
        return;
  
        var myinput = document.createElement('input');
        myinput.type = 'file';
        myinput.style = 'display: none;';
        var elm = target.IM0[0].appendChild(myinput);
        myinput.addEventListener("change", handleFile, false);
        window.g_exempted_error++;
        myinput.click();
        window.g_exempted_error--;
  
        function handleFile() {
          myinput.removeEventListener("change", handleFile, false);
          var file = myinput.files[0];
          target.IM0[0].removeChild(elm);
  
          if(!file) return;
  
          var myVideo = pinSourceVideo(target);
          myVideo.loop = true;
          myVideo.src = null;
          myVideo.src = window.URL.createObjectURL(file);
          myVideo.oncanplay = maybeCreateStream;
          if(myVideo.readyState >= 3) {  // HAVE_FUTURE_DATA
            // Video is already ready to play, call maybeCreateStream in case oncanplay
            // fired before we registered the event handler.
            maybeCreateStream();
          }
          myVideo.play();
        }
        function maybeCreateStream() {
          if(stream) {
            return;
          }
          if(myVideo.captureStream) {
            stream = myVideo.captureStream();
            gotStream(stream);
          } else if(myVideo.mozCaptureStream) {
            stream = myVideo.mozCaptureStream();
            gotStream(stream);
          } else {
            console.log('captureStream() not supported');
          }
        }
        return;
        */

        navigator.mediaDevices.getUserMedia({
          audio: true,
          video: with_video
        })
          .then(gotMediaStream, function(e) {
            if(with_video) {
              // remove video and try again
              hmtg.util.log('getusermedia fails[' + hmtgSound.getUserMediaError(e) + '], skip video and try again. ' + target.im_id_string());
              return navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
              })
                .then(gotMediaStream, function(e) {
                  hmtg.util.log('getusermedia fails[' + hmtgSound.getUserMediaError(e) + '], skip video and fails again. ' + target.im_id_string());
                  gotMediaStream();
                });
            } else {
              hmtg.util.log('getusermedia fails[' + hmtgSound.getUserMediaError(e) + ']. ' + target.im_id_string());
              gotMediaStream();
            }
          })
          .catch(function(e) {
            hmtg.util.log('error occured in getusermedia/gotMediaStream[' + hmtgSound.getUserMediaError(e) + ']. ' + target.im_id_string());
            hmtgHelper.MessageBox($translate.instant(with_video ? 'ID_CANNOT_CAPTURE_VIDEO' : 'ID_CANNOT_CAPTURE_AUDIO') + hmtgSound.getUserMediaError(e), 0);
          });

        function gotMediaStream(stream) {
          mediasoupWebRTC.request_delayed_turn_servers(target.m_param._turn_server_array(), function(turn_server_array) { 
            gotMediaStreamOriginal(stream, turn_server_array)
          });
        }
        function gotMediaStreamOriginal(stream, turn_server_array) {
          target.pinAllElements();

          if(target.microphone_node) {
            target.microphone_node.disconnect();
            target.microphone_node = null;
          }

          if(stream) {
            hmtg.util.log('got local stream(1). ' + target.im_id_string());
            target.microphone_node = hmtgSound.ac.createMediaStreamSource(stream);
            target.microphone_node.connect(target.microphone_gain_node);
          } else {
            hmtg.util.log('no local stream(1), proceed anyway. ' + target.im_id_string());
          }
          target.local_stream = stream;

          if(turn_server_array.length) {
            hmtg.util.log(5, 'use STUN/TURN servers: ' + mediasoupWebRTC.turn_server_array_2_string(turn_server_array));
          }
          hmtg.util.log(5, 'create RTCPeerConnection to call the peer. ' + target.im_id_string());
          target.pc = new RTCPeerConnection({ iceServers: turn_server_array });
          target.is_webrtc_audio_only = with_video ? false : true;
          target.pc.onicecandidate = function(e) {
            handleIceCandidate(target, e);
          };
          target.pc.onconnectionstatechange = function(e) {
            handleConnectionStateChange(target, e);
          };
          target.pc.ontrack = gotRemoteStream;
          target.webrtc_local_id = new Date().getTime();
          hmtg.util.log(5, 'recording webrtc local id as ' + target.webrtc_local_id + '. ' + target.im_id_string());

          // audio from mixer node
          if(target.webrtc_audio_senders.length == 0) {
            var mixerStream;
            if(hmtgSound.ac && hmtgSound.can_mix && target.mixer_node) {
              mixerStream = target.mixer_node.stream;
            } else {
              mixerStream = target.local_stream;
            }
            if(mixerStream) {
              mixerStream.getTracks().forEach(
                function(track) {
                  try {
                    var new_sender = target.pc.addTrack(
                      track,
                      mixerStream
                    );
                    target.webrtc_audio_senders.push(new_sender);
                  } catch(e) { }
                }
              );
            }
          }

          // video from this stream
          // remove old video first
          target.webrtc_video_senders.forEach(
            function(sender) {
              try {
                target.pc.removeTrack(sender);
              } catch(e) { }
            }
          );
          target.webrtc_video_senders.length = 0;

          if(stream) {
            var has_video = false;
            stream.getTracks().forEach(
              function(track) {
                if(track.kind == 'video') {
                  has_video = true;
                  try {
                    var new_sender = target.pc.addTrack(
                      track,
                      stream
                    );
                    target.webrtc_video_senders.push(new_sender);
                  } catch(e) { }
                }
              }
            );

            target.has_video_webrtc = target.has_video_webrtc || has_video;

            if(target.local_video) {
              try {
                target.local_video.srcObject = stream;
              } catch(e) {
                try {
                  target.local_video.src = URL.createObjectURL(stream);
                } catch(e) { }
              }
            }
          }

          target.webrtc_wait_timerID = setTimeout(function() {
            hmtg.util.log('no response from peer, stop the webrtc call. ' + target.im_id_string());
            target.webrtc_wait_timerID = null;
            hmtgHelper.MessageBox($translate.instant('ID_WEBRTC_NOT_ACCEPTED').replace("#username#", target.calc_peer_name()), 0);
            target.stopWebRTCSession();
          }, 30000);

          target.update_typing_status(true);

          target.pc.createOffer(
            with_video ? _imDlg.webrtcOfferOptions : _imDlg.webrtcOfferOptionsAudio
          ).then(
            function(desc) {
              hmtg.util.log(6, 'create ' + (with_video ? 'video' : 'audio') + ' offer. ' + target.im_id_string() + '\n' + desc.sdp);
              handleDescription(target, desc, with_video);
            },
            onCreateSessionDescriptionError
            );
        }

        function gotRemoteStream(e) {
          handleRemoteStream(target, e);
        }
      }

      im.prototype.toggle_video_layout = function() {
        if(this.is_webrtc_fullscreen) {
          // do not toggle layout when fullscreen mode is on
          return;
        }
        this.webrtc_video_layout++;
        if(this.webrtc_video_layout > 3) {
          this.webrtc_video_layout = 1;
        }
      }
      im.prototype.style_webrtc_video = function(type) {
        if(this.webrtc_video_layout == 2) {
          return {
            'position': 'relative',
            'width': 'calc(50% - 2px)',
            'vertical-align': 'middle',
            'max-height': '320px'
          };
        }
        if((this.webrtc_video_layout == 1 && type == 'remote')
          || (this.webrtc_video_layout == 3 && type == 'local')
        ) {
          return {
            'max-width': '100%',
            'max-height': '320px',
            'position': 'relative',
            'z-index': '10',
            'vertical-align': 'middle'
          };
        }  
        if(type == 'remote') {
          return {
            'position': 'absolute',
            'bottom': '0',
            'right': '0',
            'z-index': '100',
            'max-width': '20%',
            'max-height': '20%'
          };
        }  
        return {
          'position': 'absolute',
          'top': '0',
          'left': '0',
          'z-index': '100',
          'max-width': '20%',
          'max-height': '20%'
        };
      }

      im.prototype.pinAllElements = function() {
        var _im = this;

        this.remote_video = this.remote_video || pinElement(this, 'webrtc-remote');
        this.local_video = this.local_video || pinElement(this, 'webrtc-local');
        this.import_video = this.import_video || pinElement(this, 'webrtc-import-video');
        this.import_audio = this.import_audio || pinElement(this, 'webrtc-import-audio');

        // disable the mute/volume buttons in the audio control
        var elm1 = this.import_audio;
        elm1.onvolumechange = function(e, a) {
          elm1.volume = 1;
          elm1.muted = false;
        }
        var elm2 = this.import_video;
        elm2.onvolumechange = function(e, a) {
          elm2.volume = 1;
          elm2.muted = false;
        }

        this.microphone_canvas = this.microphone_canvas || pinElement(this, 'microphone_signal_strength');
        this.speaker_canvas = this.speaker_canvas || pinElement(this, 'speaker_signal_strength');
        this.import_forward_canvas = this.import_forward_canvas || pinElement(this, 'import_forward_signal_strength');
        this.import_playback_canvas = this.import_playback_canvas || pinElement(this, 'import_playback_signal_strength');

        if(!this.microphone_gain_node) {
          this.microphone_gain_node = hmtgSound.ac.createGain();
          this.microphone_gain_node.gain.value = this.microphone_muted ? 0 : this.microphone_gain / 100.0;
          hmtgSound.connectVolumeIndicator(this.microphone_gain_node, this.microphone_canvas);
        }
        if(!this.speaker_gain_node) {
          this.speaker_gain_node = hmtgSound.ac.createGain();
          this.speaker_gain_node.gain.value = this.speaker_muted ? 0 : this.speaker_gain / 100.0;
          hmtgSound.connectVolumeIndicator(this.speaker_gain_node, this.speaker_canvas);
        }
        if(!this.import_forward_gain_node) {
          this.import_forward_gain_node = hmtgSound.ac.createGain();
          this.import_forward_gain_node.gain.value = this.import_forward_muted ? 0 : this.import_forward_gain / 100.0;
          hmtgSound.connectVolumeIndicator(this.import_forward_gain_node, this.import_forward_canvas);
        }
        if(!this.import_playback_gain_node) {
          this.import_playback_gain_node = hmtgSound.ac.createGain();
          this.import_playback_gain_node.gain.value = this.import_playback_muted ? 0 : this.import_playback_gain / 100.0;
          hmtgSound.connectVolumeIndicator(this.import_playback_gain_node, this.import_playback_canvas);
        }
        if(hmtgSound.ac && hmtgSound.can_mix) {
          if(!this.mixer_node) {
            this.mixer_node = hmtgSound.ac.createMediaStreamDestination();
          }

          this.import_forward_gain_node.connect(this.mixer_node);
          this.microphone_gain_node.connect(this.mixer_node);
        }

        this.speaker_gain_node.connect(hmtgSound.ac.destination);
        this.import_playback_gain_node.connect(hmtgSound.ac.destination);

        if(!this.import_node1) {
          this.import_node1 = hmtgSound.ac.createMediaElementSource(this.import_audio);
          this.import_node1.connect(this.import_forward_gain_node);
          this.import_node1.connect(this.import_playback_gain_node);
        }
        if(!this.import_node2) {
          this.import_node2 = hmtgSound.ac.createMediaElementSource(this.import_video);
          this.import_node2.connect(this.import_forward_gain_node);
          this.import_node2.connect(this.import_playback_gain_node);
        }

        return true;
      }

      function pinElement(target, className) {
        var nodes = document.getElementsByClassName(className);
        var i;
        var n;
        for(i = 0; i < nodes.length; i++) {
          var n = nodes[i].parentNode;
          var base = target.IM0[0].parentNode.parentNode;
          while(n) {
            if(n == base) {
              return nodes[i];
            }
            n = n.parentNode;
          }
        }
        return null;
      }

      function handleRemoteStream(target, e) {
        hmtg.util.log('Received remote stream. ' + target.im_id_string());
        if(e.track.kind == 'audio') {
          if(!target.remotePlayer) {
            target.remotePlayer = new Audio();
            if(target.sinkId && target.remotePlayer.setSinkId) {
              target.remotePlayer.setSinkId(target.sinkId);
            }
          }
          try {
            target.remotePlayer.srcObject = e.streams[0];
          } catch(e) {
            try {
              target.remotePlayer.src = URL.createObjectURL(e.streams[0]);
            } catch(e) { }
          }
          //attachMediaStream(target.remotePlayer, e.streams[0]);
          //target.remotePlayer.play();

          function playAudioStream() {
            if(target.remote_node) {
              target.remote_node.disconnect();
            }
            target.remote_node = hmtgSound.ac.createMediaStreamSource(e.streams[0]);
            target.remote_node.connect(target.speaker_gain_node);
          }
          if(!hmtgHelper.isiOS) {
            playAudioStream();
          } else {
            var item = {};
            item['timeout'] = 3600 * 24 * 10;
            item['update'] = function() {
              var username = target.calc_peer_name();

              return $translate.instant('ID_UNMUTE_WEBRTC_AUDIO').replace('#username#', hmtg.util.decodeUtf8(username))
            };
            item['text'] = item['update']();
            item['type'] = 'info';
            item['click'] = function(index) {
              playAudioStream();

              hmtgHelper.inside_angular++;
              hmtgAlert.click_link(index);
              hmtgHelper.inside_angular--;
            };

            hmtgAlert.add_link_item(item);
            if(target.ios_unmute_alert_item) {
              hmtgAlert.remove_link_item(target.ios_unmute_alert_item);
            }
            target.ios_unmute_alert_item = item;
          }
        } else if(e.track.kind == 'video') {
          target.has_video_webrtc = true;
          if(target.remote_video) {
            try {
              target.remote_video.srcObject = e.streams[0];
            } catch(e) {
              try {
                target.remote_video.src = URL.createObjectURL(e.streams[0]);
              } catch(e) { }
            }
          }
          target.update_typing_status(true);
        }
      }

      function handleConnectionStateChange(target, event) {
        hmtg.util.log(5, 'RTC peer connection state change to ' + event.connectionState + '. ' + target.im_id_string());
      }

      function handleIceCandidate(target, event) {
        hmtg.util.log(5, 'found ICE candidate. ' + target.im_id_string() + '\n' + (event.candidate ?
          event.candidate.candidate : '(null)'));
        
        var text = JSON.stringify({
          'webrtc_id': target.webrtc_local_id,
          'candidate': event.candidate
        });
        if(target.webrtc_connected) {
          hmtg.jmkernel.jm_command_SendWebRTCSignal(target.m_param, text, target.peer_userid);
        } else {
          target.ice_candidate_array.push(text);
        }
      }

      function handleDescription(target, desc, with_video) {
        //hmtg.util.log(6, 'Offer from pc. ' + target.im_id_string() + '\n' + desc.sdp);
        target.pc.setLocalDescription(desc).then(
          function() {
            //desc.sdp = forceChosenAudioCodec(desc.sdp);
            var text = JSON.stringify({
              'webrtc_id': target.webrtc_local_id,
              'sdp': target.pc.localDescription,
              'with_video': with_video
            });
            if(text.length >= 10000) {
              // try to reduce the sdp
              var mydesc = hmtgHelper.reduceSdp(target.pc.localDescription);
              hmtg.util.log(2, 'sdp(length=' + text.length + ', too long, need to shorten it):\n' + text);
              text = JSON.stringify({
                'webrtc_id': target.webrtc_local_id,
                'sdp': mydesc,
                'with_video': with_video
              });
              if(text.length < 10000) {
                // only need this log when it is less than 10000
                // otherwise, it will be printed in the below error case
                hmtg.util.log(2, 'sdp(length=' + text.length + ', short version):\n' + text);
              }
            }
            if(text.length >= 10000) {
              target.pc.close();
              target.pc = null;
              hmtg.util.log('cannot start webrtc session: sdp is too long');
              hmtg.util.log(2, 'sdp(length=' + text.length + '):\n' + text);
              hmtgHelper.MessageBox($translate.instant('ID_CANNOT_START_WEBRTC_SESSION'), 0);
            } else {
              hmtg.jmkernel.jm_command_SendWebRTCSignal(target.m_param, text, target.peer_userid);
              hmtg.util.log(5, 'send sdp signal. ' + target.im_id_string() + '\n' + text);
            }
          },
          function() {
            target.pc.close();
            target.pc = null;
            hmtg.util.log('cannot start webrtc session: set session description fails. ' + target.im_id_string());
            hmtgHelper.MessageBox($translate.instant('ID_CANNOT_START_WEBRTC_SESSION'), 0);
          }
        );
      }

      function onCreateSessionDescriptionError(error) {
        hmtg.util.log('Failed to create session description: ' + error.toString());
      }

      im.prototype.stop_webrtc_session = function($scope, target) {
        if(!target) target = this;

        hmtgHelper.OKCancelMessageBox($translate.instant('IDS_STOP_WEBRTC_SESSION_ALERT'), 0, ok);

        function ok() {
          hmtg.util.log('stop webrtc session. ' + target.im_id_string());
          hmtgHelper.inside_angular++;
          target.stopWebRTCSession(true);
          hmtgHelper.inside_angular--;
        }
      }

      im.prototype.stopWebRTCSession = function(to_signal_peer) {
        var target = this;

        if(target.ios_unmute_alert_item) {
          hmtgAlert.remove_link_item(target.ios_unmute_alert_item);
          target.ios_unmute_alert_item = null;
        }

        if(to_signal_peer) {
          if(target.webrtc_connected) {
            var text = JSON.stringify({
              'webrtc_id': target.webrtc_local_id,
              'stop': true
            });
            hmtg.jmkernel.jm_command_SendWebRTCSignal(target.m_param, text, target.peer_userid);
          }
        }
        if(target.local_stream) {
          hmtgSound.stopStream(target.local_stream);
          target.local_stream = null;
        }
        if(target.audio_stream) {
          hmtgSound.stopStream(target.audio_stream);
          target.audio_stream = null;
        }
        if(target.pc) {
          target.pc.close();
          target.pc = null;
        }
        target.webrtc_audio_senders = [];
        target.webrtc_video_senders = [];

        if(target.remotePlayer) {
          target.remotePlayer.pause();
          try {
            target.remotePlayer.srcObject = null;
          } catch(e) {
            try {
              target.remotePlayer.src = null;
            } catch(e) { }
          }
          target.remotePlayer = null;
        }
        if(target.remote_node) {
          target.remote_node.disconnect();
          target.remote_node = null;
        }

        if(target.import_video) {
          target.import_video.src = null;
          target.import_video.removeAttribute('src');
        }
        if(target.microphone_node) {
          target.microphone_node.disconnect();
          target.microphone_node = null;
        }
        target.sinkId = null;
        if(target.webrtc_intervalID) {
          clearInterval(target.webrtc_intervalID);
          target.webrtc_intervalID = null;
        }

        target.reset_import();

        target.ice_candidate_array = [];
        target.webrtc_connected = false;
        if(target.webrtc_wait_timerID) {
          clearTimeout(target.webrtc_wait_timerID);
          target.webrtc_wait_timerID = null;
        }
        target.has_video_webrtc = false;
        target.webrtc_local_id = 0;
        target.webrtc_peer_id = 0;
        target.update_typing_status(true);
      }

      im.prototype.stop_webrtc_video_sending = function($scope, target) {
        if(!target) target = this;

        // remove old video first
        target.webrtc_video_senders.forEach(
          function(sender) {
            try {
              target.pc.removeTrack(sender);
            } catch(e) { }
          }
        );
        target.webrtc_video_senders.length = 0;

        if(target.local_video) {
          try {
            target.local_video.srcObject = null;
          } catch(e) {
            try {
              target.local_video.src = null;
            } catch(e) { }
          }
        }
      }

      im.prototype.OnWebRTCSignal = function(param, text, visitor_name, peer_username) {
        var _im = this;
        var show_name = '';

        if(this.peer_username != peer_username) {
          this.peer_username = peer_username;
          this.SetTitleText();
        }
        show_name = this.peer_username;

        //this.ShowIMMessage(visitor_name, show_name, imStyle.parse(short_message2), short_message, type, message_delay);
        /*
        var f = function() {
          return $translate.instant('IDS_FORMAT_ALERT_WEBRTC_SESSION');
        };
        hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), f());
        */

        var signal = JSON.parse(text);
        if(signal.sdp) {
          /*
          if(!this.visible || $rootScope.nav_item != 'msgr') {
            if(!this.visible) this.msg = true;
  
            //this.update_alert(f);
          }
          */
          hmtg.util.log(6, 'receive sdp signal. ' + _im.im_id_string() + '\n' + signal.sdp.sdp);
          var rsd = new RTCSessionDescription(signal.sdp);
          if(!this.pc) {
            if(rsd.type != 'offer') {
              return;
            }

            hmtg.util.log(5, 'prompt the user. ' + _im.im_id_string());
            // only prompt the user when this is an offer
            var item = {};
            item['timeout'] = 20;
            item['update'] = function() {
              return $translate.instant(signal.with_video ? 'IDS_FORMAT_ALERT_WEBRTC_VIDEO_SESSION' : 'IDS_FORMAT_ALERT_WEBRTC_AUDIO_SESSION')
                .replace('#inviter#', _im.calc_peer_name())
            };
            item['text'] = item['update']();
            item['type'] = 'info';
            item['need_ring'] = true;
            item['click'] = function(index) {
              hmtgAlert.close_notification();
              hmtgHelper.inside_angular++;
              hmtgAlert.click_link(index);
              $rootScope.$broadcast(hmtgHelper.WM_SHOW_IM, _im, true);
              hmtgHelper.inside_angular--;

              hmtg.util.log('the user accept the webrtc call. ' + _im.im_id_string());
              accept_webrtc(signal);
            };
            item['cancel'] = function() {
              hmtgAlert.close_notification();
            }
            item['timeout_action'] = function() {
              missedCall.update_missed_call((signal.with_video ? 'IDS_WEBRTC_VIDEO_CALL' : 'IDS_WEBRTC_AUDIO_CALL'), _im.calc_peer_name());
            }

            hmtgAlert.add_link_item(item);
            hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), item['update']());
          } else {
            if(!this.webrtc_peer_id || signal.webrtc_id == this.webrtc_peer_id) {
              process_received_sdp(signal);
            } else {
              hmtg.util.log('discard sdp signal due to unmatched peer id[ ' + signal.webrtc_id + ' vs. ' + this.webrtc_peer_id + ']. ' + _im.im_id_string());
            }
          }
        } else if(signal.candidate) {
          if(_im.pc && (!this.webrtc_peer_id || signal.webrtc_id == this.webrtc_peer_id)) {
            hmtg.util.log(5, 'receive ice signal. ' + _im.im_id_string() + '\n' + signal.candidate.candidate);
            _im.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            hmtg.util.log(5, 'receive and discard ice signal. ' + _im.im_id_string() + '\n' + signal.candidate.candidate);
          }
        } else if(signal.force_audio_only) {
          if(_im.pc
            && signal.webrtc_id == this.webrtc_peer_id
            && this.webrtc_connected
            && !this.is_webrtc_audio_only
          ) {
            var target = this;
            hmtg.util.log('respond and switch to audio only. ' + _im.im_id_string());
            this.is_webrtc_audio_only = true;
            // video from this stream
            // remove old video first
            target.webrtc_video_senders.forEach(
              function(sender) {
                try {
                  target.pc.removeTrack(sender);
                } catch(e) { }
              }
            );
            target.webrtc_video_senders.length = 0;
            target.has_video_webrtc = false;
            target.update_typing_status(true);
          } else {
            hmtg.util.log(5, 'receive and discard force_audio_only signal. ' + _im.im_id_string());
          }
        } else if(signal.stop) {
          if(_im.pc && (!this.webrtc_peer_id || signal.webrtc_id == this.webrtc_peer_id)) {
            hmtg.util.log('receive stop signal. ' + _im.im_id_string());
            _im.stopWebRTCSession();
          } else {
            hmtg.util.log('receive but discard stop signal. ' + _im.im_id_string());
          }
        } else if(signal.poll) {
          if(_im.pc && (!this.webrtc_peer_id || signal.webrtc_id == this.webrtc_peer_id)) {
            // reset poll status
            _im.open_poll_count = 0;
            _im.last_poll_tick = hmtg.util.GetTickCount();

            // send poll response
            var text = JSON.stringify({
              'webrtc_id': _im.webrtc_local_id,
              'poll_response': 1
            });
            hmtg.jmkernel.jm_command_SendWebRTCSignal(_im.m_param, text, _im.peer_userid);
          }  
        } else if(signal.poll_response) {
          if(_im.pc && (!this.webrtc_peer_id || signal.webrtc_id == this.webrtc_peer_id)) {
            _im.open_poll_count = 0;
          }
        }

        function accept_webrtc(signal) {
          var with_video = signal.with_video ? true : false;
          var promise;
          if(_im.local_stream) {
            promise = Promise.resolve(_im.local_stream);
          } else {
            promise = navigator.mediaDevices.getUserMedia({
              audio: true,
              video: with_video
            })
          }
          promise.then(gotMediaStream2, function(e) {
            if(with_video) {
              // remove video and try again
              hmtg.util.log('getusermedia fails[' + hmtgSound.getUserMediaError(e) + '], skip video and try again. ' + _im.im_id_string());
              return navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
              })
                .then(gotMediaStream2, function(e) {
                  hmtg.util.log('getusermedia fails[' + hmtgSound.getUserMediaError(e) + '], skip video and fails again. ' + _im.im_id_string());
                  gotMediaStream2();
                });
            } else {
              hmtg.util.log('getusermedia fails[' + hmtgSound.getUserMediaError(e) + ']. ' + _im.im_id_string());
              gotMediaStream2();
            }
          })
            .catch(function(e) {
              hmtg.util.log('error occured in getusermedia/gotMediaStream2 fails[' + hmtgSound.getUserMediaError(e) + ']. ' + _im.im_id_string());
              hmtgHelper.MessageBox($translate.instant(with_video ? 'ID_CANNOT_CAPTURE_VIDEO' : 'ID_CANNOT_CAPTURE_AUDIO') + hmtgSound.getUserMediaError(e), 0);
            });
        }

        function gotMediaStream2(stream) {
          mediasoupWebRTC.request_delayed_turn_servers(_im.m_param._turn_server_array(), function(turn_server_array) {
            gotMediaStream2Original(stream, turn_server_array)
          });
        }
        function gotMediaStream2Original(stream, turn_server_array) {
          _im.pinAllElements();
          if(_im.microphone_node) {
            _im.microphone_node.disconnect();
            _im.microphone_node = null;
          }

          _im.webrtc_connected = true;
          _im.open_poll_count = 0;
          _im.last_poll_tick = _im.webrtc_start_tick = hmtg.util.GetTickCount();
          _im.webrtc_duration_str = '';
          if(_im.webrtc_intervalID) {
            clearInterval(_im.webrtc_intervalID);
          }
          _im.webrtc_intervalID = setInterval(webrtc_interval_func, 500);

          if(stream) {
            hmtg.util.log('got local stream(2), accept peer invitation. ' + _im.im_id_string());
            _im.microphone_node = hmtgSound.ac.createMediaStreamSource(stream);
            _im.microphone_node.connect(_im.microphone_gain_node);
          } else {
            hmtg.util.log('no local stream(2), accept peer invitation anyway. ' + _im.im_id_string());
          }
          _im.local_stream = stream;

          if(!_im.pc) {
            if(turn_server_array.length) {
              hmtg.util.log(5, 'use STUN/TURN servers: ' + mediasoupWebRTC.turn_server_array_2_string(turn_server_array));
            }
            hmtg.util.log(5, 'create RTCPeerConnection responding to signal. ' + _im.im_id_string());
            _im.pc = new RTCPeerConnection({ iceServers: turn_server_array });
            _im.is_webrtc_audio_only = signal.with_video ? false : true;
            _im.pc.onicecandidate = function(e) {
              handleIceCandidate(_im, e);
            };
            _im.pc.onconnectionstatechange = function(e) {
              handleConnectionStateChange(_im, e);
            };
            _im.pc.ontrack = gotRemoteStream;
            _im.webrtc_local_id = new Date().getTime();
            hmtg.util.log(5, 'recording webrtc local id as ' + _im.webrtc_local_id + '. ' + _im.im_id_string());
          }
          _im.webrtc_peer_id = signal.webrtc_id;
          hmtg.util.log(5, 'recording webrtc peer id as ' + signal.webrtc_id + '. ' + _im.im_id_string());

          // audio from mixer node
          if(_im.webrtc_audio_senders.length == 0) {
            var mixerStream;
            if(hmtgSound.ac && hmtgSound.can_mix && _im.mixer_node) {
              mixerStream = _im.mixer_node.stream;
            } else {
              mixerStream = _im.local_stream;
            }
            if(mixerStream) {
              mixerStream.getTracks().forEach(
                function(track) {
                  try {
                    var new_sender = _im.pc.addTrack(
                      track,
                      mixerStream
                    );
                    _im.webrtc_audio_senders.push(new_sender);
                  } catch(e) { }
                }
              );
            }
          }

          // video from this stream
          // remove old video first
          _im.webrtc_video_senders.forEach(
            function(sender) {
              try {
                _im.pc.removeTrack(sender);
              } catch(e) { }
            }
          );
          _im.webrtc_video_senders.length = 0;

          if(stream) {
            var has_video = false;
            stream.getTracks().forEach(
              function(track) {
                if(track.kind == 'video') {
                  has_video = true;
                  try {
                    var new_sender = _im.pc.addTrack(
                      track,
                      stream
                    );
                    _im.webrtc_video_senders.push(new_sender);
                  } catch(e) { }
                }
              }
            );

            _im.has_video_webrtc = _im.has_video_webrtc || has_video;
            if(_im.local_video) {
              try {
                _im.local_video.srcObject = stream;
              } catch(e) {
                try {
                  _im.local_video.src = URL.createObjectURL(stream);
                } catch(e) { }
              }
            }
          }

          process_received_sdp(signal);

          _im.update_typing_status(true);
        }

        function process_received_sdp(signal) {
          var max_bw
          if(appSetting.use_max_video_bitrate) {
            max_bw = Math.max(10, Math.min(1000, appSetting.max_video_bitrate));
            signal.sdp.sdp = hmtgHelper.updateBandwidthRestriction(signal.sdp.sdp, 'video', max_bw);
          }
          _im.pc.setRemoteDescription(
            new RTCSessionDescription(signal.sdp)
          ).then(function() {
            // if we received an offer, we need to answer
            if(_im.pc.remoteDescription.type == 'offer') {
              return _im.pc.createAnswer().then(
                function(desc) {
                  hmtg.util.log(6, 'create answer. ' + _im.im_id_string() + '\n' + desc.sdp);
                  handleDescription(_im, desc);
                },
                onCreateSessionDescriptionError
              );
            } else {
              // the peer accept the invitation
              if(_im.webrtc_connected) {
                hmtg.util.log('the peer accept the webrtc invitation, but the status is already connected: this must be an updating. ' + _im.im_id_string());
              } else {
                _im.webrtc_connected = true;
                _im.open_poll_count = 0;
                _im.last_poll_tick = _im.webrtc_start_tick = hmtg.util.GetTickCount();
                _im.webrtc_duration_str = '';
                if(_im.webrtc_intervalID) {
                  clearInterval(_im.webrtc_intervalID);
                }
                _im.webrtc_intervalID = setInterval(webrtc_interval_func, 500);
                _im.webrtc_peer_id = signal.webrtc_id;
                hmtg.util.log(5, 'recording webrtc peer id as ' + signal.webrtc_id + '. ' + _im.im_id_string());
                if(_im.webrtc_wait_timerID) {
                  clearTimeout(_im.webrtc_wait_timerID);
                  _im.webrtc_wait_timerID = null;
                }
                _im.update_typing_status(true);

                hmtg.util.log('the peer accept the webrtc invitation. ' + _im.im_id_string());
                var k;
                for(k = 0; k < _im.ice_candidate_array.length; k++) {
                  hmtg.jmkernel.jm_command_SendWebRTCSignal(_im.m_param, _im.ice_candidate_array[k], _im.peer_userid);
                }
                _im.ice_candidate_array = [];
              }
            }
          }, function() {
            hmtg.util.log('Failed to set remote session description');
          });
        }

        function gotRemoteStream(e) {
          handleRemoteStream(_im, e);
        }

        function webrtc_interval_func() {
          var now = hmtg.util.GetTickCount();
          var t = now - _im.webrtc_start_tick;
          t = (t / 1000) >>> 0;
          var hour = (t / 3600) >>> 0;
          t = t - hour * 3600;
          var minute = (t / 60) >>> 0;
          var second = t - minute * 60;
          if(hour) {
            _im.webrtc_duration_str = '' + hour + ':' + ('00' + minute).slice(-2) + ':' + ('00' + second).slice(-2);
          } else {
            _im.webrtc_duration_str = '' + minute + ':' + ('00' + second).slice(-2);
          }
          _imDlg.delayed_update();

          if(now - _im.last_poll_tick > 20000) {
            _im.last_poll_tick = now;
            if(_im.open_poll_count >= 2) {
              // 60s no response, break the connection
              hmtg.util.log('timeout, stop webrtc session. ' + _im.im_id_string());
              hmtgHelper.MessageBox($translate.instant('ID_WEBRTC_SESSION_TIMEOUT').replace("#username#", _im.calc_peer_name()), 0);
              _im.stopWebRTCSession(true);
            } else {
              _im.open_poll_count++;
              var text = JSON.stringify({
                'webrtc_id': _im.webrtc_local_id,
                'poll': 1
              });
              hmtg.jmkernel.jm_command_SendWebRTCSignal(_im.m_param, text, _im.peer_userid);
            }
          }
        }
      }

      im.prototype.fullscreen1 = function() {
        var fullscreen_element = this.webrtc_video_layout == 3 ? this.local_video : this.remote_video;
        if(!fullscreen_element) return;
        if(!this.request_fullscreen) return;

        if(this.webrtc_video_layout == 2) {
          fullscreen_element = fullscreen_element.parentNode;
          if(!fullscreen_element) return;
        }
        
        hmtgHelper.inside_angular++;
        this.request_fullscreen.call(fullscreen_element);
        hmtgHelper.inside_angular--;

        this.webrtc_fullscreen_element = fullscreen_element;

        var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
          ;
        this.is_webrtc_fullscreen = fullscreenElement == this.webrtc_fullscreen_element;
      }

      im.prototype.import_html5 = function($scope) {
        var _im = this;
        var audio_only = true;
        $ocLazyLoad.load({
          name: 'joinnet',
          files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_import_media' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
        }).then(function() {
          var stream;
          var mediaElm;

          $scope.force_audio_only = _im.is_webrtc_audio_only;
          var modalInstance = $modal.open({
            templateUrl: 'template/ImportMedia.htm' + hmtgHelper.cache_param,
            scope: $scope,
            controller: 'ImportMediaModalCtrl',
            size: 'lg',
            backdrop: 'static',
            resolve: {}
          });

          modalInstance.result.then(function(result) {
            _im.reset_import();
            _im.import_audio.autoplay = _im.import_video.autoplay = result.auto_play ? true : false;
            _im.import_audio.loop = _im.import_video.loop = _im.loop;

            audio_only = result.audio_only || _im.is_webrtc_audio_only;

            if(result.audio_only || _im.is_webrtc_audio_only) {
              mediaElm = _im.import_audio;
              if(mediaElm) {
                mediaElm.src = result.src;
              }
              _im.video_info = '';
              _im.video_error = false;
              _im.audio_only = true;
            } else {
              mediaElm = _im.import_video;
              if(mediaElm) {
                mediaElm.src = result.src;
              }
              _im.video_info = '';
              _im.video_error = false;
              _im.audio_only = false;
            }
            //$scope.start_transcoding();
            if(mediaElm) {
              _im.has_import_media = true;
              mediaElm.oncanplay = maybeCreateStream;
              mediaElm.onended = function() {
                // when ended, the video stream will stop being sent.
                // reset this to resume the video forwarding when the user click 'play' again
                stream = null;
              }
              if(mediaElm.readyState >= 3) {  // HAVE_FUTURE_DATA
                // Video is already ready to play, call maybeCreateStream in case oncanplay
                // fired before we registered the event handler.
                maybeCreateStream();
              }

            }
          }, function() {
          });
          function maybeCreateStream() {
            if(stream) {
              return;
            }
            try {
              if(mediaElm.captureStream) {
                stream = mediaElm.captureStream();
                gotHTML5Stream(stream);
              } else if(mediaElm.mozCaptureStream) {
                stream = mediaElm.mozCaptureStream();
                gotHTML5Stream(stream);
              } else {
                console.log('captureStream() not supported');
              }
            } catch(e) {
              stream = null;
            }  
          }
          function gotHTML5Stream(stream) {
            var target = _im;
            hmtg.util.log('got html5 stream. ' + target.im_id_string());

            // audio from mixer node
            if(target.webrtc_audio_senders.length == 0) {
              var mixerStream;
              if(hmtgSound.ac && hmtgSound.can_mix && target.mixer_node) {
                mixerStream = target.mixer_node.stream;
              } else {
                mixerStream = target.local_stream;
              }
              if(mixerStream) {
                mixerStream.getTracks().forEach(
                  function(track) {
                    try {
                      var new_sender = target.pc.addTrack(
                        track,
                        mixerStream
                      );
                      target.webrtc_audio_senders.push(new_sender);
                    } catch(e) { }
                  }
                );
              }
            }

            // video from this stream
            // remove old video first
            target.webrtc_video_senders.forEach(
              function(sender) {
                try {
                  target.pc.removeTrack(sender);
                } catch(e) { }
              }
            );
            target.webrtc_video_senders.length = 0;

            if(stream && !audio_only) {
              var has_video = false;
              stream.getTracks().forEach(
                function(track) {
                  if(track.kind == 'video') {
                    has_video = true;
                    try {
                      var new_sender = target.pc.addTrack(
                        track,
                        stream
                      );
                      target.webrtc_video_senders.push(new_sender);
                    } catch(e) { }
                  }
                }
              );
            }

            target.has_video_webrtc = target.has_video_webrtc || has_video;
            if(target.local_video) {
              try {
                target.local_video.srcObject = stream;
              } catch(e) {
                try {
                  target.local_video.src = URL.createObjectURL(stream);
                } catch(e) { }
              }
            }

            target.update_typing_status(true);

            target.pc.createOffer(
              target.is_webrtc_audio_only ? _imDlg.webrtcOfferOptionsAudio : _imDlg.webrtcOfferOptions
            ).then(
              function(desc) {
                hmtg.util.log(6, 'update ' + (target.is_webrtc_audio_only ? 'audio' : 'video') + ' offer. ' + target.im_id_string() + '\n' + desc.sdp);
                handleDescription(target, desc, true);
              },
              onCreateSessionDescriptionError
              );
          }
        }, function(e) {
          hmtg.util.log(-1, 'Warning! lazy_loading modal_import_media fails');
        });
      }

      im.prototype.reset_import = function($scope) {
        var _im = this;
        _im.has_import_media = false;

        var target = _im;

        var mediaElm = _im.import_audio;
        if(mediaElm) {
          mediaElm.pause();
          mediaElm.src = null;
          mediaElm.removeAttribute('src');
        }
        mediaElm = _im.import_video;
        if(mediaElm) {
          mediaElm.pause();
          mediaElm.src = null;
          mediaElm.removeAttribute('src');
        }
        var canvas = target.import_forward_canvas;
        if(canvas) {
          var ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }  
      }

      im.prototype.chooseSpeaker = function($scope, target, menu) {
        if(!target) target = this;
        target.sinkId = menu.value;
        if(target.remotePlayer && target.remotePlayer.setSinkId) {
          target.remotePlayer.setSinkId(target.sinkId);
        }
      }

      im.prototype.start_microphone_with_id = function($scope, target, menu) {
        if(!target) target = this;
        target.start_microphone(menu.value);
      }

      im.prototype.start_microphone = function(device_id) {
        var target = this;
        if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          if(!device_id) {
            hmtg.util.log(2, 'try to capture audio without deviceId');
            navigator.mediaDevices.getUserMedia({
              audio: true
            }).then(gotMicrophoneStream, audioStreamError).catch(audioStreamException);
          } else {
            hmtg.util.log(2, 'try to capture audio with deviceId ' + device_id);
            navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: device_id } }
            }).then(gotMicrophoneStream, audioStreamError).catch(audioStreamException);
          }
        }

        function audioStreamError(e) {
          hmtg.util.log('getusermedia fails[' + hmtgSound.getUserMediaError(e) + ']. ' + target.im_id_string());
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_AUDIO') + hmtgSound.getUserMediaError(e) }, 20);
        }

        function audioStreamException(e) {
          hmtg.util.log('error occured in getusermedia/gotMicrohponeStream[' + hmtgSound.getUserMediaError(e) + ']. ' + target.im_id_string());
          hmtgHelper.MessageBox($translate.instant('ID_CANNOT_CAPTURE_AUDIO') + hmtgSound.getUserMediaError(e), 0);
        }

        function gotMicrophoneStream(stream) {
          if(stream) {
            if(target.microphone_node) {
              target.microphone_node.disconnect();
              target.microphone_node = null;
            }
            if(target.audio_stream && target.audio_stream != stream) {
              hmtgSound.stopStream(target.audio_stream);
            }
            hmtg.util.log('got microphone stream. ' + target.im_id_string());
            target.microphone_node = hmtgSound.ac.createMediaStreamSource(stream);
            target.microphone_node.connect(target.microphone_gain_node);
            target.audio_stream = stream;
          } else {
            hmtg.util.log('no microphone stream. no change to current audio stream' + target.im_id_string());
          }
        }
      }

      im.prototype.start_camera_with_id = function($scope, target, menu) {
        if(!target) target = this;
        target.start_camera(menu.value);
      }
      
      im.prototype.start_camera = function(device_id) {
        if(this.is_webrtc_audio_only) return;
        var target = this;

        /*
        navigator.mediaDevices.getUserMedia({
          video: true
        })
          .then(gotCameraStream, videoStreamError).catch(videoStreamException);
        */
        if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          if(!device_id) {
            hmtg.util.log(2, 'try to capture video without deviceId');
            navigator.mediaDevices.getUserMedia({
              video: true
            }).then(gotCameraStream, videoStreamError).catch(videoStreamException);
          } else {
            hmtg.util.log(2, 'try to capture video with deviceId ' + device_id);
            navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: device_id } }
            }).then(gotCameraStream, videoStreamError).catch(videoStreamException);
          }
        }

        function videoStreamError(e) {
          hmtg.util.log('getusermedia fails[' + hmtgSound.getUserMediaError(e) + ']. ' + target.im_id_string());
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_VIDEO') + hmtgSound.getUserMediaError(e) }, 20);
        }

        function videoStreamException(e) {
          hmtg.util.log('error occured in getusermedia/gotCameraStream[' + hmtgSound.getUserMediaError(e) + ']. ' + target.im_id_string());
          hmtgHelper.MessageBox($translate.instant('ID_CANNOT_CAPTURE_VIDEO') + hmtgSound.getUserMediaError(e), 0);
        }

        function gotCameraStream(stream) {
          hmtg.util.log('got camera stream. ' + target.im_id_string());
          target.camera_stream = stream;

          // video from this stream
          // remove old video first
          target.webrtc_video_senders.forEach(
            function(sender) {
              try {
                target.pc.removeTrack(sender);
              } catch(e) { }
            }
          );
          target.webrtc_video_senders.length = 0;

          if(stream) {
            var has_video = false;
            stream.getTracks().forEach(
              function(track) {
                if(track.kind == 'video') {
                  has_video = true;
                  try {
                    var new_sender = target.pc.addTrack(
                      track,
                      stream
                    );
                    target.webrtc_video_senders.push(new_sender);
                  } catch(e) { }
                }
              }
            );

            target.has_video_webrtc = target.has_video_webrtc || has_video;

            if(target.local_video) {
              try {
                target.local_video.srcObject = stream;
              } catch(e) {
                try {
                  target.local_video.src = URL.createObjectURL(stream);
                } catch(e) { }
              }
            }
          }

          target.update_typing_status(true);

          target.pc.createOffer(
            _imDlg.webrtcOfferOptions
          ).then(
            function(desc) {
              hmtg.util.log(6, 'create video offer. ' + target.im_id_string() + '\n' + desc.sdp);
              handleDescription(target, desc, true);
            },
            onCreateSessionDescriptionError
            );
        }
      }

      im.prototype.start_screen = function(window_mode) {
        if(this.is_webrtc_audio_only) return;
        var target = this;

        if(typeof getScreenId != 'function') {
          $ocLazyLoad.load('//cdn.WebRTC-Experiment.com/getScreenId.js').then(function() {
            hmtgHelper.inside_angular++;
            screen_capture();
            hmtgHelper.inside_angular--;
          }, function(e) {
            hmtg.util.log(-1, 'Warning! lazy_loading getScreenId fails');
            hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_SCREEN') }, 20);
          });
        } else {
          screen_capture();
        }

        function screen_capture() {
          getScreenId(function(error, sourceId, screen_constraints) {
            // error    == null || 'permission-denied' || 'not-installed' || 'installed-disabled' || 'not-chrome'
            // sourceId == null || 'string' || 'firefox'
            if(error) {
              hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_SCREEN') + error }, 20);
              return;
            }

            if(!!navigator.mozGetUserMedia && !window_mode) {
              screen_constraints = {
                video: {
                  mozMediaSource: 'screen',
                  mediaSource: 'screen'
                }
              };
            }
            navigator.getUserMedia(screen_constraints, gotScreenStream,
              function(e) {
                hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CANNOT_CAPTURE_SCREEN') + hmtgSound.getUserMediaError(e) }, 20);
              });
          });
        }

        function gotScreenStream(stream) {
          target.screen_stream = stream;

          hmtg.util.log('got screen stream. ' + target.im_id_string());

          // video from this stream
          // remove old video first
          target.webrtc_video_senders.forEach(
            function(sender) {
              try {
                target.pc.removeTrack(sender);
              } catch(e) { }
            }
          );
          target.webrtc_video_senders.length = 0;

          if(stream) {
            var has_video = false;
            stream.getTracks().forEach(
              function(track) {
                if(track.kind == 'video') {
                  has_video = true;
                  try {
                    var new_sender = target.pc.addTrack(
                      track,
                      stream
                    );
                    target.webrtc_video_senders.push(new_sender);
                  } catch(e) { }
                }
              }
            );
          }

          target.has_video_webrtc = target.has_video_webrtc || has_video;
          if(target.local_video) {
            try {
              target.local_video.srcObject = stream;
            } catch(e) {
              try {
                target.local_video.src = URL.createObjectURL(stream);
              } catch(e) { }
            }
          }

          target.update_typing_status(true);

          target.pc.createOffer(
            _imDlg.webrtcOfferOptions
          ).then(
            function(desc) {
              hmtg.util.log(6, 'update video offer. ' + target.im_id_string() + '\n' + desc.sdp);
              handleDescription(target, desc, true);
            },
            onCreateSessionDescriptionError
            );
        }
      }

      im.prototype.start_board = function() {
        if(this.is_webrtc_audio_only) return;
        var target = this;
        if(!board.has_canvas_stream) return;
        var stream = board.canvas.captureStream();
        if(stream) {
          gotBoardStream(stream);
        }

        function gotBoardStream(stream) {
          target.board_stream = stream;

          hmtg.util.log('got board stream. ' + target.im_id_string());

          // video from this stream
          // remove old video first
          target.webrtc_video_senders.forEach(
            function(sender) {
              try {
                target.pc.removeTrack(sender);
              } catch(e) { }
            }
          );
          target.webrtc_video_senders.length = 0;

          if(stream) {
            var has_video = false;
            stream.getTracks().forEach(
              function(track) {
                if(track.kind == 'video') {
                  has_video = true;
                  try {
                    var new_sender = target.pc.addTrack(
                      track,
                      stream
                    );
                    target.webrtc_video_senders.push(new_sender);
                  } catch(e) { }
                }
              }
            );
          }

          target.has_video_webrtc = target.has_video_webrtc || has_video;
          if(target.local_video) {
            try {
              target.local_video.srcObject = stream;
            } catch(e) {
              try {
                target.local_video.src = URL.createObjectURL(stream);
              } catch(e) { }
            }
          }

          target.update_typing_status(true);

          target.pc.createOffer(
            _imDlg.webrtcOfferOptions
          ).then(
            function(desc) {
              hmtg.util.log(6, 'update video offer. ' + target.im_id_string() + '\n' + desc.sdp);
              handleDescription(target, desc, true);
            },
            onCreateSessionDescriptionError
            );
        }
      }

      im.prototype.force_webrtc_audio_only = function() {
        if(this.is_webrtc_audio_only) return;
        var target = this;
        hmtgHelper.OKCancelMessageBox($translate.instant('IDS_WEBRTC_AUDIO_ONLY_ALERT'), 0, ok);
        function ok() {
          hmtg.util.log('switch to audio only. ' + target.im_id_string());
          target.is_webrtc_audio_only = true;

          // video from this stream
          // remove old video first
          target.webrtc_video_senders.forEach(
            function(sender) {
              try {
                target.pc.removeTrack(sender);
              } catch(e) { }
            }
          );
          target.webrtc_video_senders.length = 0;

          target.has_video_webrtc = false;
          if(target.webrtc_connected) {
            var text = JSON.stringify({
              'webrtc_id': target.webrtc_local_id,
              'force_audio_only': true
            });
            hmtg.jmkernel.jm_command_SendWebRTCSignal(target.m_param, text, target.peer_userid);
          }

          target.update_typing_status(true);

          target.pc.createOffer(
            _imDlg.webrtcOfferOptionsAudio
          ).then(
            function(desc) {
              hmtg.util.log(6, 'update audio offer. ' + target.im_id_string() + '\n' + desc.sdp);
              handleDescription(target, desc, true);
            },
            onCreateSessionDescriptionError
            );
        }
      }

      im.prototype.mute_microphone = function(muted) {
        if(this.microphone_gain == 0 && !muted) return;
        this.microphone_muted = !!muted;
        this.microphone_gain_node.gain.value = this.microphone_muted ? 0 : this.microphone_gain / 100.0;

        var canvas = this.microphone_canvas;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      im.prototype.mute_speaker = function(muted) {
        if(this.speaker_gain == 0 && !muted) return;
        this.speaker_muted = !!muted;
        this.speaker_gain_node.gain.value = this.speaker_muted ? 0 : this.speaker_gain / 100.0;
      }

      im.prototype.mute_import_forward = function(muted) {
        if(this.import_forward_gain == 0 && !muted) return;
        this.import_forward_muted = !!muted;
        this.import_forward_gain_node.gain.value = this.import_forward_muted ? 0 : this.import_forward_gain / 100.0;

        var canvas = this.import_forward_canvas;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      im.prototype.mute_import_playback = function(muted) {
        if(this.import_playback_gain == 0 && !muted) return;
        this.import_playback_muted = !!muted;
        this.import_playback_gain_node.gain.value = this.import_playback_muted ? 0 : this.import_playback_gain / 100.0;
      }

      im.prototype.toggle_loop = function() {
        this.import_audio.loop =
          this.import_video.loop =
          this.loop = !this.loop;
      }

      // im members
      im.prototype.im_id_string = function() {
        return "office=" + this.m_param._homepage() + ",peer=" + this.peer_userid;
      }

      im.prototype.init_alert = function() {
        if(this.m_param._server_im_log()) {
          this.update_typing_status();
        }
      }
      im.prototype.update_typing_status = function(to_update) {
        if(this.m_group_id)
          this.ShowGroupTypingStatus();
        else
          this.ShowPeerTypingStatus();
        if(to_update) {
          _imDlg.delayed_update();
        }
      }

      im.prototype.highlight = function() {
        var t = this;
        if(!this.IM0) return;
        if(imContainer.win_count <= 1) return;
        if(imContainer.win_count == 2 && imContainer.is_main_visible) return;
        this.IM0.addClass('im-highlight');
        setTimeout(function() {
          t.IM0.removeClass('im-highlight');
        }, 1000);
      }

      im.prototype.SetTitleText = function(reset) {
        var status = 0;
        var office_status = 0;

        var param = this.m_param;
        var s = '';

        if(this.is_log) {
          s += (this.log_type == hmtg.config.IM_TARGET_TYPE_GUEST ? ($translate.instant('IDS_GUEST') + '(' + hmtg.util.decodeUtf8(this.log_name) + ')') : hmtg.util.decodeUtf8(this.log_name)) + ' - ' + $translate.instant('ID_CONVERSATION_LOG') + ' @ ' + hmtg.util.decodeUtf8(param._name_or_homepage3());
          this.title = s;
          return;
        }
        if(this.m_group_id) {
          var pgc = param._m_pPgcHash()[this.m_group_id];
          if(pgc && !this.m_group_finished) {
            s = hmtg.util.decodeUtf8(pgc._full_name()) + ' - ';
          } else {
            s = '0() - ';
          }
          s += $translate.instant('IDS_GROUP_CONVERSATION');
          s += " @ ";
          s += hmtg.util.decodeUtf8(param._name_or_homepage3());
          this.title = s;
          return;
        }

        if(this.m_b_is_peer_guest) {
          s += $translate.instant('IDS_FORMAT_OFFICE_NAME2').replace("#homepage#", hmtg.util.decodeUtf8(this.guest_office_name)).replace("#userid#", hmtg.util.decodeUtf8(this.guest_user_name));
          s += '(';
          s += $translate.instant('IDS_GUEST');
          s += ') - ';
          s += $translate.instant('IDS_CONVERSATION');
          s += ' @ ';
          s += hmtg.util.decodeUtf8(param._name_or_homepage3());
          this.title = s;
          return;
        }

        if(!param._quit()) {
          var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, this.peer_userid);
          if(this_us) {
            status = this_us._status();
            office_status = this_us._office_status();
          }
        }

        s += hmtg.util.decodeUtf8(this.peer_username);
        if(reset) {
          status = office_status = 0;
          this.m_bOfflineMessageWarningSent = false;
        } else {
          if(status) {
            this.m_bOfflineMessageWarningSent = false;
          }
        }

        s += ' (' + $translate.instant(msgrHelper.userstatus2id(status, office_status, 0)) + ')';
        s += ' - ' + $translate.instant('IDS_CONVERSATION');
        s += " @ ";
        s += hmtg.util.decodeUtf8(param._name_or_homepage3());
        this.title = s;
        return;
      }

      im.prototype.onfocus = function() {
        _imDlg.paste_target = this;
        window.addEventListener("paste", pasteHandler);
      }

      im.prototype.onblur = function() {
        _imDlg.paste_target = null;
        window.removeEventListener("paste", pasteHandler);
      }

      function pasteHandler(e) {
        if(e.clipboardData && _imDlg.paste_target && _imDlg.paste_target.canTransfer()) {
          var items = e.clipboardData.items;
          if(items) {
            for(var i = 0; i < items.length; i++) {
              if(items[i].type.indexOf("image") !== -1) {
                var blob = items[i].getAsFile();
                blob.name = 'paste.png';
                //_imDlg.paste_target.transfer_file(blob, []);
                _imDlg.paste_target.paste_image(blob);
                return;
              }
            }
          }
        }
      }

      im.prototype.paste_image = function(file) {
        var _im = this;
        if(file.size > appSetting.max_blob * 1048576) {
          return;
        }

        var $scope = $rootScope;

        $scope.upload_type = 5;
        $scope.upload_file = file;

        $ocLazyLoad.load({
          name: 'joinnet',
          files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_upload_slide' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
        }).then(function() {
          var modalInstance = $modal.open({
            templateUrl: 'template/UploadSlide.htm' + hmtgHelper.cache_param,
            scope: $scope,
            controller: 'UploadSlideModalCtrl',
            size: 'lg',
            backdrop: 'static',
            resolve: {}
          });

          return modalInstance.result.then(function(result) {
            //board.upload_slide(result.upload_type, board.is_local_slide, result.groupname, result.title, result.file, result.png_blob);
            var file = result.png_blob || result.file;
            file.name = result.title;
            setTimeout(function() {
              _im.im_transfer_file(file, []);
            }, 0);
          }, function() {
          });
        }, function(e) {
          hmtg.util.log(-1, 'Warning! lazy_loading modal_upload_slide fails');
        });
      }

      im.prototype.onkeypress = function(e) {
        if(e.keyCode != 13) return;
        if((!appSetting.is_enter_for_newline && !e.shiftKey) || (appSetting.is_enter_for_newline && e.shiftKey)) {
          e.stopPropagation();
          e.preventDefault();
          this.send();
          return;
        }
      }

      im.prototype.send = function() {
        this.text_input.focus();

        if(!this.input) return;
        if(this.m_param._quit()) return;
        if(this.m_param._guest()) return;
        if(this.m_param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
        if(!this.m_b_is_peer_guest) {
          if(this.m_group_id) {
            if(this.m_group_finished || this.m_group_disconnected) return;
          }
        }
        var text = hmtg.util.encodeUtf8(this.input);
        if(text.length >= 500) {
          hmtgHelper.MessageBox($translate.instant('IDS_SHORT_MESSAGE_TOO_LONG'), 20);
          return;
        }
        hmtg.jmkernel.jm_command_SendMessage(this.m_param, this.m_group_id, text, this.m_param._im_style_flag() ? imStyle.apply(this.input, this.m_param._imstyle()) : "1", this.m_b_is_peer_guest, this.guest_user_name, this.peer_userid, this.guest_office_name);
        this.m_last_im_sent_tick = hmtg.util.GetTickCount();
        this.last_typing_sent_tick = this.m_last_im_sent_tick - 60000;
        this.ShowIMMessage(this.m_param._userid(), this.m_param._username(), this.m_param._imstyle(), text, 0, 0);

        this.input = '';
      }

      im.prototype.update_alert = function(f) {
        // try to find an exisitng alert
        var i;
        var item;
        var found = false;
        for(i = 0; i < hmtgAlert.link_array.length; i++) {
          item = hmtgAlert.link_array[i];
          if(item['im_alert_target'] == this) {
            found = true;
            break;
          }
        }
        if(!found) {
          item = {};
          item['im_alert_target'] = this;
          item['timeout'] = 30;
          item['update'] = f;
          item['text'] = item['update']();
          item['type'] = 'info';
          item['click'] = function(index) {
            hmtgAlert.close_notification();
            hmtgHelper.inside_angular++;
            hmtgAlert.click_link(index);
            $rootScope.$broadcast(hmtgHelper.WM_SHOW_IM, item['im_alert_target'], true);
            hmtgHelper.inside_angular--;
          };
          item['cancel'] = function() {
            hmtgAlert.close_notification();
          }
          hmtgAlert.add_link_item(item);
        } else {
          item['update'] = f;
          item['text'] = item['update']();
          clearTimeout(item.timeout_id);
          item.timeout_id = setTimeout(item.timeout_func, item.timeout * 1000);
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ALERT);
        }
      }

      im.prototype.OnIMMessageIn = function(param, type, short_message, short_message2, visitor_name, visitor_homepage, guest_user_name, message_delay, peer_username) {
        var show_name = '';
        if(!this.m_group_id) {
          this.SetPeerTypingStatus(0);
          this.ShowPeerTypingStatus();
          _imDlg.delayed_update();
        }

        if(this.m_group_id) {
          show_name = peer_username;
        } else if(this.m_b_is_peer_guest) {
          if(this.guest_user_name != guest_user_name || this.guest_office_name != visitor_homepage) {
            this.guest_user_name = guest_user_name;
            this.guest_office_name = visitor_homepage;
            this.SetTitleText();
          }
          show_name = guest_user_name + ' @ ' + visitor_homepage;
        } else {
          if(type == 2) {
            if(this.peer_username != guest_user_name) {
              this.peer_username = guest_user_name;
              this.SetTitleText();
            }
          } else {
            if(this.peer_username != peer_username) {
              this.peer_username = peer_username;
              this.SetTitleText();
            }
          }
          show_name = this.peer_username;
        }

        this.ShowIMMessage(visitor_name, show_name, imStyle.parse(short_message2), short_message, type, message_delay);
        if(appSetting.play_sound) {
          hmtgSound.playTypingSound();
        }
        var f = function() {
          return $translate.instant('IDS_FORMAT_ALERT_SHORT_MESSAGE1').replace('#visitor#', hmtg.util.decodeUtf8(show_name)).replace('#message#', hmtg.util.decodeUtf8(short_message));
        };
        hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), f());

        if(!this.visible || $rootScope.nav_item != 'msgr') {
          if(!this.visible) this.msg = true;

          this.update_alert(f);
        }
      }

      function append_text(node, t, to_indent, color) {
        var text = angular.element('<div></div>');
        var prefix = angular.element('<text></text>');
        prefix.text(t + '\n');
        if(color) prefix.css('color', color);
        text.append(prefix)
        if(to_indent) text.addClass('indent200');
        else text.addClass('im-small');
        node.append(text);
      }

      im.prototype.add_new_message_anchor = function() {
        var _im = this;
        if(!this.is_log && !this.visible && !this.new_message_div && !this.new_message_disappear_intervalID) {
          var n = this.new_message_div = angular.element('<div></div>');
          var t = angular.element('<text></text>').text($translate.instant('ID_NEW_MESSAGE_LINE'));
          t.addClass('im-new-message-text');
          n.append(t);
          n.addClass('im-new-message-div');
          this.IM.append(n);
          this.update_typing_status(true);

          _im.new_message_disappear_count = 0;
          this.new_message_disappear_intervalID = setInterval(function() {
            if(_im.visible) {
              _im.new_message_disappear_count++;
              if(_im.new_message_disappear_count >= 20) {
                clearInterval(_im.new_message_disappear_intervalID);
                _im.new_message_disappear_intervalID = null;
                _im.new_message_div.remove();
                _im.new_message_div = null;
                _im.update_typing_status(true);
              }
            } else {
              _im.new_message_disappear_count = 0;
            }
          }, 1000);
        }
      }

      im.prototype.ShowIMMessage = function(src_id, show_name, style, message, type, delay) {
        var time_str = '';
        // whether this is a one-on-one IM
        var is_peer_im = (!this.is_log && !this.m_group_id) || (this.is_log && this.log_type != hmtg.config.IM_TARGET_TYPE_GROUP);
        var now = hmtg.util.GetTickCount();
        var skip_show_time = false; // show time information or not for realtime IM
        if(this.is_log) {
          time_str = msgrHelper.get_timestring_im2(delay);
        } else if(type == 2) {
          time_str = msgrHelper.get_timestring_im(delay > 0 ? delay : 0);
        } else {
          time_str = msgrHelper.get_timestring(1);
          if(this.last_show_time_id != src_id || this.last_show_time_name != show_name) {
            // always show time when source is changed
          } else if(now - this.last_show_time_tick < 5000 && this.last_show_time_count < 4) {
            // within 5 seconds from last time string display and less than 5 output
            skip_show_time = true;
            this.last_show_time_count++;
          }
          if(!skip_show_time) {
            this.last_show_time_count = 0;
            this.last_show_time_tick = now; // record the last time that time is shown
            this.last_show_time_id = src_id;
            this.last_show_time_name = show_name;
          }
        }

        this.add_new_message_anchor();

        var node = angular.element('<div></div>');
        var prefix = angular.element('<text></text>');
        if(!skip_show_time) {
          prefix.text(time_str + ((!is_peer_im && type) ? '' : '\n'));
          prefix.css('color', type == 0 ? '#cc6666' : '#6666cc');
          prefix.addClass(type == 0 ? 'im-small-self' : 'im-small');
          node.append(prefix);
          if(!is_peer_im && type) {
            prefix = angular.element('<text></text>');
            prefix.text(' ' + hmtg.util.decodeUtf8(show_name) + '\n');
            prefix.css('color', '#333333');
            prefix.addClass('im-small');
            node.append(prefix);
          }
          clear_float(node);
        }
        text = angular.element('<div></div>');
        //text.append(angular.element('<text></text>').text(hmtg.util.decodeUtf8(message) + '\n'))
        hmtgHelper.convertText(text, hmtg.util.decodeUtf8(message));
        text.addClass(type == 0 ? 'im-bubble-right-self' : (type == 1 ? 'im-bubble-left-other' : 'im-bubble-left-offline'));
        if(style.has_color) {
          text.css({ color: '#' + ('00' + (style.red >> 0).toString(16)).slice(-2) + ('00' + (style.green >> 0).toString(16)).slice(-2) + ('00' + (style.blue >> 0).toString(16)).slice(-2) });
        }
        if(style.is_bold) {
          text.addClass('im-bold');
        }
        if(style.is_italic) {
          text.addClass('im-italic');
        }
        if(style.is_underline && style.is_strike) {
          text.addClass('im-ul-strike');
        } else {
          if(style.is_underline) {
            text.addClass('im-ul');
          }
          if(style.is_strike) {
            text.addClass('im-strike');
          }
        }

        node.append(text);
        clear_float(node);

        if(this.insert_mode) {
          this.IM.prepend(node);
        } else {
          this.IM.append(node);
        }

        if(!this.is_log) {
          this.scroll_to_bottom();
        }

      }

      function clear_float(node) {
        node.append(angular.element('<div class="clear-both"></div>'));
      }

      im.prototype.OnIMMessageFailure = function(param, short_message, short_message2, is_normal) {
        var style = imStyle.parse(short_message2);
        var time_str = '*** ';
        time_str += msgrHelper.get_timestring(1);

        var node = angular.element('<div></div>');
        var prefix = angular.element('<text></text>');
        prefix.text(time_str + ' ' + $translate.instant(is_normal ? 'IDS_SHORT_MESSAGE_FAILURE' : 'IDS_ASYMMETRICAL_SHORT_MESSAGE') + '\n');
        prefix.css('color', is_normal ? '#666666' : '#ff3333');
        prefix.addClass('im-small');
        node.append(prefix);
        text = angular.element('<div></div>');
        text.append(angular.element('<text></text>').text(hmtg.util.decodeUtf8(short_message) + '\n'))
        text.addClass('indent200');
        if(style.has_color) {
          text.css({ color: '#' + ('00' + (style.red >> 0).toString(16)).slice(-2) + ('00' + (style.green >> 0).toString(16)).slice(-2) + ('00' + (style.blue >> 0).toString(16)).slice(-2) });
        }
        if(style.is_bold) {
          text.addClass('im-bold');
        }
        if(style.is_italic) {
          text.addClass('im-italic');
        }
        if(style.is_underline && style.is_strike) {
          text.addClass('im-ul-strike');
        } else {
          if(style.is_underline) {
            text.addClass('im-ul');
          }
          if(style.is_strike) {
            text.addClass('im-strike');
          }
        }

        node.append(text);

        this.IM.append(node);

        this.scroll_to_bottom();
      }

      im.prototype.PrintString = function(s, type, tick, delay) {
        var time_str = '';
        if(tick) {
          if(delay > 0)
            time_str = msgrHelper.get_timestring_im2(tick - delay);
          else
            time_str = msgrHelper.get_timestring_im2(tick);
        }
        else if(delay > 0)
          time_str = msgrHelper.get_timestring_im(delay);
        else
          time_str = msgrHelper.get_timestring(1);

        var node = angular.element('<div></div>');
        var text = angular.element('<div></div>');
        var prefix = angular.element('<text></text>');
        prefix.text(time_str + ' ');
        prefix.addClass('im-small');
        text.append(prefix)

        prefix = angular.element('<text></text>');
        prefix.text(s + '\n');
        prefix.css('color', type == 1 ? '#33cc33' : (type == 3 ? '#333399' : '#cc3333'));
        prefix.addClass('im-small');
        text.append(prefix)

        node.append(text);

        if(this.insert_mode) {
          this.IM.prepend(node);
        } else {
          this.IM.append(node);
        }

        if(!this.is_log) {
          this.scroll_to_bottom();
        }
      }

      im.prototype.calc_peer_name = function() {
        return hmtg.util.decodeUtf8(this.m_b_is_peer_guest ? this.guest_user_name : this.peer_username);
      }

      im.prototype.SetGroupTypingStatus = function(userid, status) {
        var pgc = this.m_param._m_pPgcHash()[this.m_group_id];
        if(pgc) {
          var hash = pgc._member_hash()[userid];
          if(typeof hash != 'undefined') {
            var typing_tick = hmtg.util.GetTickCount();
            if(!status)
              typing_tick -= 60000;
            pgc._member_hash()[userid] = typing_tick;
            return true;
          }
        }
      }

      im.prototype.SetPeerTypingStatus = function(status) {
        this.peer_typing_tick = hmtg.util.GetTickCount();
        if(!status)
          this.peer_typing_tick -= 60000;
      }

      im.prototype.ShowGroupTypingStatus = function() {
        var s = '';
        var param = this.m_param;
        var pgc = param._m_pPgcHash()[this.m_group_id];
        if(pgc) {
          var hash = pgc._member_hash();
          var now = hmtg.util.GetTickCount();
          var first = true;
          var count = 0;
          for(var key in hash) {
            if(!hash.hasOwnProperty(key)) continue;
            var peer_typing_tick = hash[key];
            if(now - peer_typing_tick > TYPING_DISAPPEAR_INTERVAL) continue;
            var username = hmtg.jmkernel.jm_info_GetUserName(param, key);
            if(first) {
              first = false;
            } else {
              s += ', ';
            }
            s += hmtg.util.decodeUtf8(username);
            count++;
          }
          if(count == 0) {
            this.stop_typing_interval();
          } else if(count == 1) {
            s = $translate.instant('IDS_USER_IS_TYPING').replace('#user#', s);
          } else {
            s = $translate.instant('IDS_USERS_ARE_TYPING').replace('#users#', s);
          }
        }

        if(this.m_param._server_im_log()) {
          s += (s ? '; ' : '') + $translate.instant('IDS_IM_LOG_WARNING');
        }

        this.alert = s;
      }
      im.prototype.ShowPeerTypingStatus = function() {
        var s = '';
        var num = 0;
        var size = 0;
        var i;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          if(f.file_status == RECV_WAIT) {
            num++;
            size += f.file_size;
          }
        }
        if(num) {
          this.alert_recv = $translate.instant('IDS_FORMAT_FILE_TO_RECEIVE').replace('%d', num) + '(' + hmtgHelper.number2GMK(size) + 'B)';
          //s += this.alert_recv;
        } else {
          this.alert_recv = '';
        }

        num = 0;
        size = 0;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          if(f.file_transfer != 1 && f.file_status == ALL_FINISH && f.data && !f.saved) {
            num++;
            size += f.file_size;
          }
        }
        if(num) {
          this.alert_save = $translate.instant('ID_SAVE_FILE') + ': ' + num + '(' + hmtgHelper.number2GMK(size) + 'B)';
          //s += this.alert_recv;
        } else {
          this.alert_save = '';
        }

        if(this.memory_usage) {
          this.alert_memory = $translate.instant('ID_MEMORY_USAGE') + '(' + hmtgHelper.number2GMK(this.memory_usage) + 'B)';
          //s += (s ? '; ' : '') + this.alert_memory;
        } else {
          this.alert_memory = '';
        }

        if(hmtg.util.GetTickCount() - this.peer_typing_tick > TYPING_DISAPPEAR_INTERVAL) {
          this.stop_typing_interval();
        } else {
          s += (s ? '; ' : '') + $translate.instant('IDS_USER_IS_TYPING').replace('#user#', this.calc_peer_name());
        }

        if(this.pc) {
          if(this.webrtc_connected) {
            s += (s ? '; ' : '') + $translate.instant(this.is_webrtc_audio_only ? 'IDS_WEBRTC_AUDIO_CALL' : 'IDS_WEBRTC_VIDEO_CALL');
          } else if(this.webrtc_wait_timerID) {
            s += (s ? '; ' : '') + $translate.instant('IDS_WEBRTC_WAIT');
          }
        }

        if(this.m_param._server_im_log()) {
          s += (s ? '; ' : '') + $translate.instant('IDS_IM_LOG_WARNING');
        }

        this.alert = s;
      }

      im.prototype.OnSendFileRequest = function(param, unique_id, type, file_size, peer_id, peer_name, file_name, guest_user_name, guest_office_name, index) {
        var im = this;
        var idx = this.FindFileTransferIndex(2, unique_id, type);
        var f;
        if(idx != -1) {
          f = this.fts_array[idx];
          hmtg.util.logUtf8(6, "transfer: got new transfer request while current one is not finished yet. office=" + param._homepage());
          // stop current one and start a new IM dialog box
          f.SendFileAction(SENDFILE_ACTION_CANCEL, 0, 0);
          f.unique_id = 0;
          f.SetError();
        }
        f = new fts(false);
        f.im = this;
        f.type = type;
        f.unique_id = unique_id;
        f.file_name = file_name;
        f.file_size = file_size;
        f.file_status = RECV_WAIT;
        f.init_time = new Date() / 1000;
        f.index = this.fts_array.length;
        this.fts_array.push(f);

        if(appSetting.play_sound) {
          hmtgSound.playTypingSound();
        }
        var func = function() {
          return $translate.instant('IDS_FORMAT_TRANSFER')
            .replace('#peer_name#', im.calc_peer_name())
            .replace('#file_name#', hmtg.util.decodeUtf8(f.file_name))
            .replace('#file_size#', hmtgHelper.number2GMK(file_size) + 'B')
            ;
        };
        hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), func());

        if(!this.visible || $rootScope.nav_item != 'msgr') {
          if(!this.visible) this.msg = true;

          this.update_alert(func);
        }
        this.ShowPeerTypingStatus();

        this.add_new_message_anchor();
        this.ShowTransferProgress(f);
        _imDlg.delayed_update();
      }

      im.prototype.OnSendFileAction = function(param, param1, param2, action, unique_id, type, peer_id, idx) {
        var im = this;
        var f = this.fts_array[idx];
        if(f.file_transfer == 1) {
          switch(action) {
            case SENDFILE_ACTION_ACCEPT:
              if(f.file_status == SEND_WAIT) {
                hmtg.util.logUtf8(2, "transfer: start to transfer file " + f.file_name + ",size " + f.file_size + ". " + f.fts_id_string());
                f.file_status = SEND_SEND;
                f.ack_pointer = 0;
                f.resume_pointer = 0;
                f.StartSending();
                f.len_array.push(0);
                f.tick_array.push(hmtg.util.GetTickCount());
                f.helper_calc_progress();
              } else {
                f.release_image();
                f.release_memory();
                f.SetError();
              }
              break;
            case SENDFILE_ACTION_CANCEL:
              f.release_image();
              f.release_memory();
              if(f.file_status == SEND_LOSE_CONTACT || f.file_status == SEND_SEND || f.file_status == SEND_WAIT) {
                hmtg.util.logUtf8(2, "transfer: receiver cancel transfer. " + f.fts_id_string());
                f.SetError('IDS_TRANSFER_PEER_CANCEL');
              } else {
                f.SetError();
              }
              break;
            case SENDFILE_ACTION_RESUME:
              if(param1 < 0 || param1 >= f.file_size) {
                f.release_image();
                f.release_memory();
                f.SetError();
              } else {
                if(f.file_status == SEND_LOSE_CONTACT || f.file_status == SEND_SEND) {
                  f.file_status = SEND_SEND;
                  f.resume_pointer = param1;
                  if(f.file_pointer != param1) {
                    f.file_pointer = param1;
                  }
                  f.StartSending();
                  f.helper_calc_progress();
                } else {
                  f.release_image();
                  f.release_memory();
                  f.SetError();
                }
              }
              break;
            case SENDFILE_ACTION_ACK:
              if(f.file_status == SEND_SEND) {
                f.UpdateTransferRate(param1 - f.ack_pointer);
                f.ack_pointer = param1;
                if(param1 == f.file_size) {
                  hmtg.util.logUtf8(2, "transfer: finish sending file " + f.file_name + ",size " + f.file_size + ". " + f.fts_id_string());
                  if(!im.m_param._guest()) {
                    hmtg.jmkernel.jm_command_NotifyFileTransfer(im.m_param, 0, (((new Date()) / 1000 - f.init_time) >>> 0),
                      f.file_name, f.file_size, im.peer_userid, im.m_b_is_peer_guest,
                      im.guest_user_name, im.guest_office_name);
                  }
                  f.release_image();
                  f.release_memory();
                  f.file_status = ALL_FINISH;
                  f.stop_transfer_timer();
                } else {
                  im.m_server_queue_size = param2;
                  im.m_server_queue_tick = hmtg.util.GetTickCount();
                }
                f.helper_calc_progress();
              } else {
                f.release_image();
                f.release_memory();
                f.SetError();
              }
              break;
            case SENDFILE_ACTION_NOT_FOUND:
              f.release_image();
              f.release_memory();
              if(f.file_status == SEND_WAIT) {
                f.SetError('IDS_PEER_NOT_FOUND');
              } else {
                f.SetError();
              }
              break;
            case SENDFILE_ACTION_LOW_VERSION:
              f.release_image();
              f.release_memory();
              if(f.file_status == SEND_WAIT) {
                f.SetError('IDS_PEER_LOW_VERSION');
              } else {
                f.SetError();
              }
              break;
            case SENDFILE_ACTION_LOSE_CONTACT:
              if(f.file_status == SEND_SEND) {
                f.file_status = SEND_LOSE_CONTACT;
                if(f.file_pointer != f.ack_pointer) {
                  f.file_pointer = f.ack_pointer;
                  f.stop_transfer_timer();
                  f.helper_calc_progress();
                }
              }
              break;
            default:
              f.release_image();
              f.release_memory();
              f.SetError();
              break;
          }
        } else {
          if(f.file_status == RECV_RECV || f.file_status == RECV_WAIT) {
            hmtg.util.logUtf8(2, "transfer: sender cancel transfer. " + f.fts_id_string());
            f.SetError('IDS_TRANSFER_PEER_CANCEL');
            f.release_memory();
          } else {
            f.SetError();
          }
        }
        _imDlg.delayed_update();
      }

      im.prototype.OnSendFileSend = function(param, flag, pointer, data, unique_id, type, peer_id, idx) {
        var im = this;
        var f = this.fts_array[idx];
        if(pointer < f.file_pointer) {
          return;
        } else if(pointer > f.file_pointer) {
          f.SendFileAction(SENDFILE_ACTION_RESUME, f.file_pointer, 0);
          return;
        }
        var compressed = (flag & 0x20000000) ? 1 : 0;
        var expected_len = 4096;
        if(f.file_size - pointer < 4096)
          expected_len = f.file_size - pointer;
        var data2 = hmtg.util.str2array(data);
        if(compressed) {
          var unzip = new hmtgHelper.decompress('zlib_decompress', data2, function(output) {
            data2 = output;
            if(f.unique_id) {
              process_data2();
            }
            param._unblocking();
          }, function() {
            hmtg.util.logUtf8(6, "transfer: decompress error. " + f.fts_id_string());
            if(f.unique_id) {
              f.SendFileAction(SENDFILE_ACTION_CANCEL, 0, 0);
              f.unique_id = 0;
              f.SetError();
            }
            param._unblocking();
          });
          param._blocking(unzip.stop);
          return;
        } else {
          process_data2();
        }
        function process_data2() {
          if(data2.length != expected_len) {
            hmtg.util.logUtf8(6, "transfer: decompress error2. " + f.fts_id_string());
            f.SendFileAction(SENDFILE_ACTION_CANCEL, 0, 0);
            f.unique_id = 0;
            f.SetError();
          }
          f.data.set(data2, f.file_pointer);
          f.file_pointer += expected_len;
          f.UpdateTransferRate(expected_len);

          f.stop_transfer_timer();
          f.stop_resume_timer();

          var now = hmtg.util.GetTickCount();
          if(f.file_pointer == f.file_size) {
            hmtg.util.logUtf8(2, "transfer: finish receiving file " + f.file_name + ",size " + f.file_size + ". " + f.fts_id_string());
            f.SendFileAction(SENDFILE_ACTION_ACK, f.file_pointer, 0);
            if(!im.m_param._guest()) {
              hmtg.jmkernel.jm_command_NotifyFileTransfer(im.m_param, 1, (((new Date()) / 1000 - f.init_time) >>> 0),
                f.file_name, f.file_size, im.peer_userid, im.m_b_is_peer_guest,
                im.guest_user_name, im.guest_office_name);
            }
            f.unique_id = 0;
            f.file_status = ALL_FINISH;
            f.load_image();

            f.stop_idle_timer();

            f.helper_calc_progress();
            im.ShowPeerTypingStatus();
            _imDlg.delayed_update();
          } else if(now - f.last_send_tick > 500) {
            f.SendFileAction(SENDFILE_ACTION_ACK, f.file_pointer, 0);
            f.last_send_tick = now;
            f.helper_calc_progress();
            f.start_resume_timer(60000);
            _imDlg.delayed_update();
          } else {
            f.start_transfer_timer(1000);
            f.start_resume_timer(60000);
          }
        }
      }

      im.prototype.ShowTransferProgress = function(f) {
        var time_str = '';
        if(this.is_log) {
          time_str = msgrHelper.get_timestring_im2(f.init_time);
        }
        else
          time_str = msgrHelper.get_timestring_im1(f.init_time);

        var node = angular.element('<div></div>');
        var prefix = angular.element('<text></text>');
        var color = f.file_transfer == 1 ? '#cc6666' : '#6666cc';
        prefix.text(time_str);
        prefix.addClass(f.file_transfer == 1 ? 'im-small-self' : 'im-small');
        node.append(prefix);
        prefix = angular.element('<text></text>');
        if(f.file_transfer == 1) {
          prefix.text($translate.instant('IDS_FILE_SENDING') + ' ');
        } else {
          prefix.text(' ' + $translate.instant('IDS_FILE_RECVING'));
        }
        prefix.css('color', color);
        prefix.addClass(f.file_transfer == 1 ? 'im-small-self' : 'im-small');
        node.append(prefix);
        clear_float(node);

        var section0 = angular.element('<span></span>');
        var section = angular.element('<div></div>');
        prefix = angular.element('<text></text>');
        prefix.text(hmtg.util.decodeUtf8(f.file_name) + '\n');
        section.append(prefix);
        prefix = angular.element('<text></text>');
        prefix.text(hmtgHelper.number2GMK(f.file_size) + '(' + hmtgHelper.number2fmt(f.file_size) + ')' + '\n');
        prefix.addClass('im-small');
        prefix.css('color', color);
        section.append(prefix);
        if(this.is_log) {
          prefix = angular.element('<text></text>');
          prefix.text(msgrHelper.get_timestring_im2(f.last_send_tick) + ' ' + $translate.instant('IDS_FILE_TRANSFER_DONE') + '\n');
          section.append(prefix);
        } else {
          var root = angular.element(this.IM);
          var button;

          var text = angular.element('<div></div>');
          f.helper_calc_progress();
          button = $compile('<span>{{im.fts_array[' + f.index + '].progress_str}}</span>')(root.scope());
          text.append(button);
          button = $compile('<button type="button" class="btn btn-link" ng-click="im.recv_fts(' + f.index + ')" ng-show="im.can_recv_fts(' + f.index + ')" translate="IDS_TRANSFER_CMD_RECEIVE"></button>')(root.scope());
          text.append(button);
          button = $compile('<button type="button" class="btn btn-link" ng-click="im.cancel_fts(' + f.index + ')" ng-show="im.can_cancel_fts(' + f.index + ')" translate="IDS_TRANSFER_CMD_CANCEL"></button>')(root.scope());
          text.append(button);


          button = $compile('<button type="button" class="btn btn-link" ng-click="im.save_fts(' + f.index + ')" ng-show="im.can_save_fts(' + f.index + ')" translate="ID_SAVE_FILE"></button>')(root.scope());
          text.append(button);
          button = $compile('<button type="button" class="btn btn-link" ng-click="im.release_fts(' + f.index + ')" ng-show="im.can_save_fts(' + f.index + ')" translate="ID_RELEASE_FILE"></button>')(root.scope());
          text.append(button);
          button = $compile('<span class="im-small inline-block" ng-show="im.can_image_fts(' + f.index + ')"><a target="fts_image" href="{{im.image_fts(' + f.index + ')}}"><img class="thumbnail-img" ng-src="{{im.image_fts(' + f.index + ')}}" alt=""></a> {{im.image_size_str_fts(' + f.index + ')}}</span>')(root.scope());
          text.append(button);

          prefix = angular.element('<text></text>');
          prefix.text('\n');
          text.append(prefix);

          section.append(text);

          if(!this.is_log) {
            f.progress_div = text;
          }
        }
        section.addClass('bubble-embed');
        section0.append(section);
        section0.addClass(f.file_transfer == 1 ? 'im-bubble-right-self' : 'im-bubble-left-other');
        node.append(section0);
        if(f.file_transfer == 1) {
          clear_float(node);
        }

        if(this.insert_mode) {
          this.IM.prepend(node);
        } else {
          this.IM.append(node);
        }

        if(!this.is_log) {
          this.scroll_to_bottom();
        }
      }

      im.prototype.can_recv_fts = function(idx) {
        var f = this.fts_array[idx];
        return f.file_status == RECV_WAIT;
      }

      im.prototype.can_image_fts = function(idx) {
        var f = this.fts_array[idx];
        return !!f.data_url;
      }

      im.prototype.can_save_fts = function(idx) {
        var f = this.fts_array[idx];
        return f.file_status == ALL_FINISH && f.file_transfer == 2 && !f.released;
      }

      im.prototype.can_cancel_fts = function(idx) {
        var f = this.fts_array[idx];
        return f.file_status != SEND_ERROR && f.file_status != RECV_ERROR && f.file_status != ALL_FINISH;
      }

      im.prototype.recv_fts = function(idx) {
        if(!this.can_recv_fts(idx)) return;
        var f = this.fts_array[idx];

        if(this.memory_usage + board.memory_usage + hmtg.jnkernel._memory_usage() + f.file_size > appSetting.max_blob * 1048576) {
          hmtgHelper.MessageBox($translate.instant('IDS_FILE_TOO_LARGE') + '(' + $translate.instant('ID_MEMORY_USAGE') + ',' + hmtgHelper.number2GMK(this.memory_usage + board.memory_usage + hmtg.jnkernel._memory_usage()) + ' + ' + hmtgHelper.number2GMK(f.file_size) + ' > ' + hmtgHelper.number2GMK(appSetting.max_blob * 1048576) + ')', 20);
          return;
        }

        f.data = new Uint8Array(f.file_size);
        this.memory_usage += f.file_size;
        hmtg.util.logUtf8(2, "transfer: start to recv file " + f.file_name + ",size " + f.file_size + ". " + f.fts_id_string());
        f.SendFileAction(SENDFILE_ACTION_ACCEPT, 0, 0);
        f.tick_array.push(hmtg.util.GetTickCount());
        f.len_array.push(0);

        f.file_pointer = 0;

        f.file_status = RECV_RECV;
        f.progress_pos = 0;
        f.helper_calc_progress();

        this.ShowPeerTypingStatus();
      }

      im.prototype.image_fts = function(idx) {
        var f = this.fts_array[idx];
        return f.data_url || '';
      }

      im.prototype.image_size_str_fts = function(idx) {
        var f = this.fts_array[idx];
        return f.size_str || '';
      }

      im.prototype.save_fts = function(idx) {
        if(!this.can_save_fts(idx)) return;
        var f = this.fts_array[idx];
        try {
          if(hmtgHelper.isiOS) {
            hmtgHelper.inside_angular++;
            hmtgAlert.add_blob_download_item(new Blob([f.data]), hmtg.util.decodeUtf8(f.file_name));
            hmtgHelper.inside_angular--;
          } else {
            hmtgHelper.save_file(new Blob([f.data]), hmtg.util.decodeUtf8(f.file_name));
          }
          var old = f.saved;
          f.saved = true;
          if(!old) {
            this.ShowPeerTypingStatus();
          }
        } catch(e) {
        }
      }

      im.prototype.release_fts = function(idx) {
        var im = this;
        if(!this.can_save_fts(idx)) return;
        var f = this.fts_array[idx];

        hmtgHelper.OKCancelMessageBox($translate.instant('ID_RELEASE_FILE_PROMPT'), 0, ok);

        function ok() {
          im.memory_usage -= f.data.length;
          f.release_image();
          f.data = null;
          f.released = true;
          im.ShowPeerTypingStatus();
        }
      }

      im.prototype.cancel_fts = function(idx) {
        if(!this.can_cancel_fts(idx)) return;
        var f = this.fts_array[idx];
        f.StopFileTransfer();
        f.unique_id = 0;
        hmtgHelper.inside_angular++;
        f.SetError('IDS_TRANSFER_CANCEL');
        hmtgHelper.inside_angular--;
        f.release_image();
        f.release_memory();
      }

      im.prototype.FindFileTransferIndex = function(file_transfer, unique_id, type) {
        var i;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          if(f.file_transfer == file_transfer
            && f.unique_id == unique_id
            && f.type == type) {
            return i;
          }
        }
        return -1;
      }

      im.prototype.HaveActiveFileTransfer = function() {
        var i;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          if(f.file_transfer == 1) {
            if(f.file_status == SEND_WAIT ||
              f.file_status == SEND_SEND ||
              f.file_status == SEND_LOSE_CONTACT)
              return true;
          }
          else {
            if(f.file_status == RECV_WAIT || f.file_status == RECV_RECV)
              return true;
          }
        }
        return false;
      }

      im.prototype.HaveUnsavedFileTransfer = function() {
        var i;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          if(f.file_transfer != 1) {
            if(f.file_status == ALL_FINISH && f.data && !f.saved)
              return true;
          }
        }
        return false;
      }

      im.prototype.StopAllFileTransfer = function() {
        var i;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          f.release_image();

          if(f.file_transfer == 1) {
            if(f.file_status == SEND_WAIT ||
              f.file_status == SEND_SEND ||
              f.file_status == SEND_LOSE_CONTACT)
              f.StopFileTransfer();
          }
          else {
            if(f.file_status == RECV_WAIT || f.file_status == RECV_RECV)
              f.StopFileTransfer();
          }
        }
      }

      im.prototype.onRelease = function() {
        this.stop_typing_interval();
        this.StopAllFileTransfer();
        this.stop_group_add_timer();
        this.stop_delayed_scroll_interval();
        this.stop_new_message_disappear_interval();
        this.stopWebRTCSession();
      }

      im.prototype.stop_typing_interval = function() {
        if(this.typing_intervalID) {
          clearInterval(this.typing_intervalID);
          this.typing_intervalID = null;
        }
      }

      im.prototype.start_typing_interval = function(value) {
        var im = this;
        if(this.typing_intervalID) return;
        this.typing_intervalID = setInterval(typing_interval_func, value);
        function typing_interval_func() {
          im.update_typing_status();
        }
      }

      im.prototype.stop_group_add_timer = function() {
        if(this.group_add_timerID) {
          clearTimeout(this.group_add_timerID);
          this.group_add_timerID = null;
        }
      }

      im.prototype.start_group_add_timer = function(value) {
        var im = this;
        im.stop_group_add_timer();
        this.group_add_timerID = setTimeout(group_add_timer_func, value);
        function group_add_timer_func() {
          im.waiting_id = '';
          if(im.canAdd()) {
            im.TryAddPerson();
          } else {
            im.m_request_hash = {};
          }
        }
      }

      im.prototype.stop_delayed_scroll_interval = function() {
        if(this.delayed_scroll_intervalID) {
          clearInterval(this.delayed_scroll_intervalID);
          this.delayed_scroll_intervalID = null;
        }
      }

      im.prototype.stop_new_message_disappear_interval = function() {
        if(this.new_message_disappear_intervalID) {
          clearInterval(this.new_message_disappear_intervalID);
          this.new_message_disappear_intervalID = null;
        }
      }

      im.prototype.onChangeInput = function() {
        if(!this.input) return;
        this.input = hmtgHelper.replaceUnicode(this.input);
        var now = hmtg.util.GetTickCount();
        if(now - this.last_typing_sent_tick < TYPING_SEND_INTERVAL) return;
        if(this.m_param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
        if(this.m_param._us_status() == 0 || this.m_param._us_status() == hmtg.config.ONLINE_STATUS_APPEAROFF) return;
        if(!this.m_b_is_peer_guest) {
          if(this.m_group_id) {
            var pgc = this.m_param._m_pPgcHash()[this.m_group_id];
            if(!pgc || pgc._count() <= 1) return;
            if(this.m_group_finished || this.m_group_disconnected) return;
          }
        }

        if(hmtg.jmkernel.jm_command_Typing(this.m_param, this.m_group_id, this.peer_userid, this.m_b_is_peer_guest))
          this.last_typing_sent_tick = now;
      }

      im.prototype.handleFileSelect = function(evt) {
        if(!this.canTransfer()) return;
        evt.stopPropagation();
        evt.preventDefault();

        var files = evt.dataTransfer.files; // FileList object.
        var file = files[0];
        if(!file) return;
        var a = [];
        var i;
        for(i = 1; i < files.length; i++) {
          a[i - 1] = files[i];
        }
        this.im_transfer_file(file, a);
      }

      im.prototype.handleDragOver = function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = this.canTransfer() ? 'copy' : 'none';
      }

      function can_transfer_to_this_user(param, id) {
        if(param._my_id() == id) return;
        var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, id);
        if(!this_us) return;
        var status = this_us._status();
        if(status == 0 || status == hmtg.config.ONLINE_STATUS_APPEAROFF) return;
        return true;
      }
      im.prototype.canTransfer = function() {
        var param = this.m_param;
        if(!param._file_transfer_cap()) return;
        if(!param._us_status()) return;
        if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;

        if(this.m_group_id) {
          if(this.m_group_finished || this.m_group_disconnected) return;
          var pgc = this.m_param._m_pPgcHash()[this.m_group_id];
          if(!pgc || pgc._count() <= 1) return;
          var hash = pgc._member_hash();
          for(var key in hash) {
            if(!hash.hasOwnProperty(key)) continue;
            //var item = hash[key];
            if(can_transfer_to_this_user(param, key)) return true;
          }
          return;
        } else {
          if(this.m_b_is_peer_guest) return true;
          if(!can_transfer_to_this_user(param, this.peer_userid)) return;
        }
        return true;
      }
      im.prototype.onTransfer = function() {
        if(!this.canTransfer()) return;
        var _im = this;
        var param = _im.m_param;
        _imDlg.file_input = hmtgHelper.file_reset('fileInput');

        _imDlg.file_input.addEventListener("change", _upload, false);
        if(window.navigator.msSaveOrOpenBlob) {
          setTimeout(function() {
            _imDlg.file_input.click();  // use timeout, otherwise, IE will complain error
          }, 0);
        } else {
          // it is necessary to exempt error here
          // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
          window.g_exempted_error++;
          _imDlg.file_input.click();
          window.g_exempted_error--;
        }
        function _upload() {
          _imDlg.file_input.removeEventListener("change", _upload, false);
          var file = _imDlg.file_input.files[0];
          if(!file) return;
          _im.im_transfer_file(file);
        }
      }

      im.prototype.im_transfer_file = function(file, file_array) {
        if(!this.canTransfer()) return;
        var _im = this;
        var param = _im.m_param;
        if(_im.m_group_id) {
          if(_im.m_group_finished || _im.m_group_disconnected) return;
          var pgc = param._m_pPgcHash()[_im.m_group_id];
          if(!pgc || pgc._count() <= 1) return;
          var hash = pgc._member_hash();
          for(var key in hash) {
            if(!hash.hasOwnProperty(key)) continue;
            if(can_transfer_to_this_user(param, key)) {
              var idx;
              var target;
              idx = _imDlg.FindIM(param, key);
              if(idx == -1) {
                target = new im();
                target.m_param = param;
                target.peer_userid = key;
                target.peer_username = hmtg.jmkernel.jm_info_GetUserName(param, key);
                target.init_alert();
                target.SetTitleText();
                target.first_log_download();

                _imDlg.im_array.push(target);
                if(imContainer.win_count < imContainer.max_win) {
                  target.visible = true;
                  target.msg = false;
                  target.minimized = false;
                  imContainer.win_count++;
                }
                if(!target.visible) {
                  target.msg = true;
                }
                _imDlg.fast_update(); // trigger init of the element via directive "<msgr-im></msgr-im>"
              } else {
                target = _imDlg.im_array[idx];
                if(imContainer.win_count < imContainer.max_win && !target.visible) {
                  target.visible = true;
                  target.msg = false;
                  target.minimized = false;
                  imContainer.win_count++;
                }
                if(!target.visible) {
                  target.msg = true;
                }
              }
              target.transfer_file(file, file_array);
              _imDlg.delayed_update();
            }
          }
        } else {
          _im.transfer_file(file, file_array);
        }
      }

      im.prototype.transfer_file = function(file, file_array) {
        var im = this;
        var f;
        f = new fts(true);
        f.im = this;
        f.file = file;
        f.type = this.m_b_is_peer_guest ? 1 : 0;
        f.file_name = hmtg.util.encodeUtf8(file.name);
        f.file_size = file.size;
        f.file_status = SEND_WAIT;
        f.init_time = new Date() / 1000;
        f.index = this.fts_array.length;
        this.fts_array.push(f);

        var end = Math.min(file.size, 20000);

        if(f.file_name.length >= 1000) {
          f.file_status = SEND_ERROR;
          f.strError = $translate.instant('IDS_FILENAME_TOOLONG');
        } else if(end + this.memory_usage + board.memory_usage + hmtg.jnkernel._memory_usage() > appSetting.max_blob * 1048576) {
          f.file_status = SEND_ERROR;
          f.strError = $translate.instant('IDS_FILE_TOO_LARGE') + '(' + $translate.instant('ID_MEMORY_USAGE') + ',' + hmtgHelper.number2GMK(this.memory_usage + board.memory_usage + hmtg.jnkernel._memory_usage()) + ' + ' + hmtgHelper.number2GMK(f.file_size) + ' > ' + hmtgHelper.number2GMK(appSetting.max_blob * 1048576) + ')';
        } else {
          var reader = new FileReader();
          reader.onload = function(e) {
            f.file_pointer = 0;
            f.unique_id = request_unique_id();
            if(hmtg.jmkernel.jm_command_RequestSendFile(im.m_param, f.unique_id, f.type, f.file_size,
              im.peer_userid, f.file_name, im.m_b_is_peer_guest, im.guest_user_name, im.guest_office_name)) {
              f.data = new Uint8Array(e.target.result);
              f.buf_off = 0;
              f.buf_ptr = 0;
              f.buf_end = end;
              f.buf_busy = false;
              f.file_status = SEND_WAIT;
              f.load_image();
              im.memory_usage += end;

              if(file_array && file_array.length) {
                im.transfer_file(file_array[0], file_array.slice(1));
              }
            } else {
              f.data = null;
              f.file_status = SEND_ERROR;
              f.strError = $translate.instant('IDS_DISCONNECT_IM');
            }
            f.helper_calc_progress();
            im.ShowPeerTypingStatus();
            _imDlg.delayed_update();
          }
          reader.onerror = function(e) {
            f.file_status = SEND_ERROR;
            f.strError = $translate.instant('IDS_READ_FILE_ERROR');
          }
          reader.readAsArrayBuffer(file.slice(0, end));
        }
        this.add_new_message_anchor();
        this.ShowTransferProgress(f);
        _imDlg.delayed_update();

        function request_unique_id() {
          var t = (Math.random() * 65536 * hmtg.util.GetTickCount()) >>> 0;
          var k;
          for(k = 0; k < 1000; k++) {
            if(!t) continue;
            var i;
            var found = false;
            for(i = 0; i < im.fts_array.length; i++) {
              var f0 = im.fts_array[i];
              if(f0.unique_id == t) {
                found = true;
                break;
              }
            }
            if(!found) break;
          }
          return t;
        }
      }

      im.prototype.launch_office = function() {
        var param = this.m_param;
        hmtgHelper.inside_angular++;
        hmtg.jmkernel.jm_command_LaunchOffice(param);
        hmtgHelper.inside_angular--;
      }

      im.prototype.first_log_download = function() {
        var target = this;
        if(!target.is_log) {
          if(target.m_group_id) {
            target.log_type = hmtg.config.IM_TARGET_TYPE_GROUP;
            target.log_peer = target.m_group_id;
          } else if(target.m_b_is_peer_guest) {
            var display_name = target.guest_user_name + ' @ ' + target.guest_office_name;
            target.log_type = hmtg.config.IM_TARGET_TYPE_GUEST;
            target.log_peer = hmtg.util.encode64_url(display_name);
          } else {
            target.log_type = hmtg.config.IM_TARGET_TYPE_PEER;
            target.log_peer = target.peer_userid;
          }
        }
        target.first_download_action();
      }
      im.prototype.first_download_action = function() {
        var target = this;
        if(hmtg.jmkernel.jm_command_DownloadServerLog(target.m_param, target.log_type, target.log_peer, 0, 0, "1234567890123456", 0)) {
          target.status_after_download_action();
        }
      }
      im.prototype.status_after_download_action = function() {
        var target = this;
        target.downloading = true;
        target.show_download1 = target.show_download2 = false;
      }

      function calc_div_offset(base, item) {
        var h = 0;
        var p = base.offsetParent;
        while(item.offsetParent && item.offsetParent != base) {
          h += item.offsetTop + item.clientTop;
          if(item.offsetParent == p) {
            h -= (base.offsetTop + base.clientTop);
            break;
          }
          item = item.offsetParent;
        }
        h -= 80;
        if(h < 0) h = 0;
        return h;
      }
      im.prototype.show_fts = function(f) {
        this.IM0[0].scrollTop = calc_div_offset(this.IM0[0], f.progress_div[0]);
        this.show_fts_tick = hmtg.util.GetTickCount();
        f.progress_div.addClass('im-highlight');
        setTimeout(function() {
          f.progress_div.removeClass('im-highlight');
        }, 1000);
      }
      im.prototype.scroll_to_bottom = function() {
        var _im = this;
        if(this.visible) {
          var now = hmtg.util.GetTickCount();
          if(now - this.show_fts_tick < 5000) return;
          this.IM0[0].scrollTop = this.IM0[0].scrollHeight;
        } else {
          if(!this.delayed_scroll_intervalID) {
            this.delayed_scroll_intervalID = setInterval(function() {
              if(_im.visible && _im.IM0[0].scrollHeight) {
                clearInterval(_im.delayed_scroll_intervalID);
                _im.delayed_scroll_intervalID = null;
                _im.IM0[0].scrollTop = _im.IM0[0].scrollHeight;
              }
            }, 1000);
          }
        }
      }
      im.prototype.show_new_message = function() {
        var _im = this;
        this.IM0[0].scrollTop = calc_div_offset(this.IM0[0], this.new_message_div[0]);
        this.new_message_div.addClass('im-highlight');
        setTimeout(function() {
          if(_im.new_message_div) {
            _im.new_message_div.removeClass('im-highlight');
          }
          _im.new_message_disappear_count = 100;
        }, 1000);
      }
      im.prototype.show_fts_memory = function() {
        var i;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          if(f.data && f.progress_div) {
            this.show_fts(f);
            break;
          }
        }
      }
      im.prototype.show_fts_recv = function() {
        var i;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          if(f.file_status == RECV_WAIT && f.progress_div) {
            this.show_fts(f);
            break;
          }
        }
      }
      im.prototype.show_fts_save = function() {
        var i;
        for(i = 0; i < this.fts_array.length; i++) {
          var f = this.fts_array[i];
          if(f.file_transfer != 1 && f.file_status == ALL_FINISH && f.data && !f.saved && f.progress_div) {
            this.show_fts(f);
            break;
          }
        }
      }

      im.prototype.addEM = function(i) {
        this.input += hmtg.customization.emoji_list[i];
      }
      im.prototype.addEM2 = function(i) {
        this.input += hmtg.customization.emoticon_list[i];
      }
      im.prototype.canEmoji = function() {
        var a = hmtg.customization.emoji_list;
        return a && a.length;
      }
      im.prototype.onEmoji = function() {
        if(!this.canEmoji()) return;
        this.show_em = !this.show_em;
        this.show_em2 = false;
        setTimeout(function() {
          _imDlg.fast_update();
        }, 0);
      }
      im.prototype.canEmoticon = function() {
        var a = hmtg.customization.emoticon_list;
        return a && a.length;
      }
      im.prototype.onEmoticon = function() {
        if(!this.canEmoticon()) return;
        this.show_em = false;
        this.show_em2 = !this.show_em2;
        setTimeout(function() {
          _imDlg.fast_update();
        }, 0);
      }

      im.prototype.canAdd = function() {
        var param = this.m_param;
        if(this.m_b_is_peer_guest) return;
        //if(!param._us_status()) return;
        if(!param._group_im_cap()) return;
        if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
        if(this.m_group_id) {
          if(this.m_group_finished || this.m_group_disconnected) return;
        } else {
          var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, this.peer_userid);
          if(this_us && this_us._status()) {
            if(this_us._major() < 1 || (this_us._major() == 1 && this_us._minor() < 20)) return;
          } else {
            if(!hmtg.jmkernel.jm_info_IsContact(param, this.peer_userid)) return;
          }
        }
        return true;
      }

      im.prototype.onAdd = function($scope) {
        if(!this.canAdd()) return;
        var im = this;

        msgrHelper.pickUser($scope, 'add-member', func, im);

        function func(a) {
          if(!im.canAdd()) return;
          var i;
          for(i = 0; i < a.length; i++) {
            im.m_request_hash[a[i]] = 1;
          }
          if(!im.waiting_id)
            im.TryAddPerson();
        }
      }

      im.prototype.canRemove = function() {
        var param = this.m_param;
        if(!this.m_group_id) return;
        //if(!param._us_status()) return;
        if(!param._group_im_cap()) return;
        if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
        if(this.m_group_finished || this.m_group_disconnected) return;
        var pgc = param._m_pPgcHash()[this.m_group_id];
        if(!pgc || param._my_id() != pgc._owner_id()) return;
        if(pgc._count() <= 1) return;
        return true;
      }

      im.prototype.onRemove = function($scope) {
        if(!this.canRemove()) return;
        var im = this;

        msgrHelper.pickUser($scope, 'remove-member', func, im);

        function func(a) {
          if(!im.canRemove()) return;
          var i;
          for(i = 0; i < a.length; i++) {
            hmtg.jmkernel.jm_command_ForceLeaveGroup(im.m_param, im.m_group_id, a[i]);
          }
        }
      }

      im.prototype.TryAddPerson = function() {
        var hash = this.m_request_hash;
        for(var key in hash) {
          if(!hash.hasOwnProperty(key)) continue;
          delete hash[key];

          if(this.m_group_id) {
            var pgc = this.m_param._m_pPgcHash()[this.m_group_id];
            if(!pgc) return;
            if(pgc._member_hash()[key]) continue;
          }

          this.waiting_id = key;
          hmtg.jmkernel.jm_command_AddPerson(this.m_param, this.m_group_id, this.peer_userid, this.waiting_id);
          // wait at most 10s for the request to get response
          this.start_group_add_timer(10000);
          break;
        }
      }

      im.prototype.canStyle = function() {
        var param = this.m_param;
        if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED || !param._client_info_loaded()) return;
        return true;
      }

      im.prototype.canLaunch = function() {
        var param = this.m_param;
        if(param._office_status()) return;
        if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
        return true;
      }

      im.prototype.canVisit = function() {
        var param = this.m_param;
        if(this.m_group_id) return;
        if(this.m_b_is_peer_guest) return;
        if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
        return true;
      }
      im.prototype.onVisit = function($scope, jnagentDlg) {
        if(!this.canVisit()) return;
        msgrHelper.visitUser($scope, this.m_param, this.peer_userid, this.peer_username, jnagentDlg);
      }

      im.prototype.canInvite = function() {
        var param = this.m_param;
        if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
        if(this.m_b_is_peer_guest) return true;
        if(this.m_group_id) {
          if(this.m_group_finished || this.m_group_disconnected) return;
          var pgc = param._m_pPgcHash()[this.m_group_id];
          if(!pgc || pgc._count() <= 1) return;
          var hash = pgc._member_hash();
          for(var key in hash) {
            if(!hash.hasOwnProperty(key)) continue;
            if(param._my_id() == key) continue;
            if(hmtg.jmkernel.jm_info_CanTargetUserAcceptInvitation(param, key)) return true;
          }
        } else {
          if(hmtg.jmkernel.jm_info_CanTargetUserAcceptInvitation(param, this.peer_userid)) return true;
        }
        return;
      }
      im.prototype.onInvite = function(jnagentDlg) {
        if(!this.canInvite()) return;
        var a = [];
        var param = this.m_param;
        var userid = this.peer_userid;
        var username = this.m_b_is_peer_guest ? this.guest_user_name : this.peer_username;
        if(this.m_group_id) {
          var pgc = param._m_pPgcHash()[this.m_group_id];
          if(!pgc || pgc._count() <= 1) return;
          var hash = pgc._member_hash();
          for(var key in hash) {
            if(!hash.hasOwnProperty(key)) continue;
            if(param._my_id() == key) continue;
            if(hmtg.jmkernel.jm_info_CanTargetUserAcceptInvitation(param, key)) {
              a.push(key);
            }
          }
          if(!a.length) return;
          userid = a.shift();
          username = hmtg.jmkernel.jm_info_GetUserName(param, userid);
        }
        hmtgHelper.inside_angular++;
        msgrHelper.inviteUser(jnagentDlg, param, param, this.m_b_is_peer_guest, userid, username, a);
        hmtgHelper.inside_angular--;
      }

      // im members end

      // fts members
      fts.prototype.SendFileAction = function(action, p1, p2) {
        var f = this;
        hmtg.jmkernel.jm_command_SendFileAction(f.im.m_param, f.unique_id, f.type, action, p1, p2, f.im.peer_userid);
      }

      fts.prototype.ResetTransferRate = function() {
        this.tick_array = [];
        this.len_array = [];
        this.rate_data_size = 0;
      }

      fts.prototype.StartSending = function() {
        var f = this;
        var im = f.im;
        f.stop_transfer_timer();
        if(!f.data) return;
        var timer_interval = 0;
        var now = hmtg.util.GetTickCount();
        var data;
        var data_len;
        if(can_send()) {
          data_len = f.file_size - f.file_pointer;
          if(data_len > 4096)
            data_len = 4096;
          data = f.data.subarray(f.buf_ptr, f.buf_ptr + data_len);
          // zlib is too slow by javascript
          // skip it
          /*
          if(0 && data.length > 10) {
          var zip = new hmtgHelper.compress('zlib_compress', data, 0, function(output) {
          f.zip = null;
          adjust_interval();
          send_data(1, output);
          }, function() {
          f.zip = null;
          adjust_interval();
          send_data(0);
          });
          f.zip = zip;
          } else {
          send_data(0);
          }
          */
          send_data();
        } else {
          if(f.file_pointer < f.file_size)
            f.start_transfer_timer(timer_interval);
        }

        /*
        function adjust_interval() {
        var now2 = hmtg.util.GetTickCount();
        console.log(timer_interval + ',' + (now2-now));
        timer_interval = Math.max(0, timer_interval - (now2 - now));
        }
  
        function send_data(compressed, output) {
        var target_buffer = data;
        if(compressed && output.length < data_len) {
        target_buffer = output;
        } else {
        compressed = 0;
        }
        hmtg.jmkernel.jm_command_FileSend(im.m_param, compressed, target_buffer, f.type, f.unique_id, f.file_pointer, im.peer_userid);
        f.last_send_tick = now;
        f.file_pointer += data_len;
        if(f.file_pointer < f.file_size) {
        if(compressed && timer_interval <= 1) {
        f.StartSending();
        } else {
        f.start_transfer_timer(timer_interval);
        }
        }
        }
        */
        function send_data() {
          hmtg.jmkernel.jm_command_FileSend(im.m_param, 0, data, f.type, f.unique_id, f.file_pointer, im.peer_userid);
          f.last_send_tick = now;
          f.file_pointer += data_len;
          f.buf_ptr += data_len;
          if(f.file_pointer < f.file_size) {
            f.start_transfer_timer(timer_interval);
            fill_buffer();
          }
        }
        function can_send() {
          if(f.file_pointer < f.buf_off) {
            f.buf_ptr = f.buf_end = f.data.length;
            f.buf_off = f.file_pointer - f.buf_ptr;
            fill_buffer();
            return false;
          }
          if(f.file_pointer < f.buf_off + f.buf_ptr) {
            f.buf_ptr = f.file_pointer - f.buf_off;
          }
          if(f.buf_end - f.buf_ptr < 4096 && f.buf_end + f.buf_off != f.file_size) {
            fill_buffer();
            return false;
          }
          var r = (Math.random() * 10000 * now) >>> 0;
          // avg send size: 4096B

          // minimal timer interval
          // assume we don't want to send at a rate higher than 1Mbps
          // the minimal timer interval is 4096 * 8 * 1k / 1M = 32ms

          timer_interval = 5 + (r & 0xf);
          // check whether we can send

          // pre-0.
          if(f.zip) return false;

          // 0.
          if(f.resume_pointer != 0 && f.ack_pointer <= f.resume_pointer && f.file_pointer > f.resume_pointer) {
            // need an ack to proceed normally
            if(now - f.last_send_tick < 32000) {
              timer_interval = 100;
              return false;
            }
          }

          // 1. 
          // recv-side flow control (unacked data)
          // assume delay is at worst 5s.
          // and rate of 1Mbps is good to most users.
          // un-acked data size = 1M / 8 * 5 =~ 1MB
          // do not leave 1MB un-acked;
          var unack_size = f.file_pointer - f.ack_pointer;
          if(unack_size >= (1024 * 1024)) {
            timer_interval += 16;
            return false;
          }
          if(unack_size > (1024 * 64)) {
            test = r & ((1 << 20) - 1);
            if(test < unack_size) {
              timer_interval += 16;
              return false;
            }
          }

          // 2.
          // recv-side flow control (server queue size/tick)
          // do not send when serves' estimated queue size is larger than 10
          // estimated queue size assume observed queue size smoothly decrease to zero in max wait time period[32000 ms]
          var est_queue_size = 0;
          var age = (now - im.m_server_queue_tick) >> 10;
          if(im.m_server_queue_size > 10 && age < 32)
            est_queue_size = im.m_server_queue_size - ((im.m_server_queue_size * age) >> 5);
          if(est_queue_size > 10) {
            test = r & (63);
            if(test < (est_queue_size >>> 0)) {
              timer_interval += 16;
              return false;
            }
          }

          return true;
        }

        function fill_buffer() {
          if(f.buf_ptr > 10000 && !f.buf_busy && f.buf_off + f.buf_end < f.file_size) {
            var end = Math.min(f.file_size, f.buf_off + f.buf_ptr + 20000);
            var reader = new FileReader();
            reader.onload = function(e) {
              if(f.data) {
                f.data.set(f.data.slice(f.buf_ptr, f.buf_end));
                f.data.set(new Uint8Array(e.target.result), f.buf_end - f.buf_ptr);
                f.buf_end = f.buf_end - f.buf_ptr + e.target.result.byteLength;
                f.buf_off += f.buf_ptr;
                f.buf_ptr = 0;
                f.buf_busy = false;
                //console.log('onload, end=' + f.buf_end);
              }
            }
            reader.onerror = function(e) {
              if(f.data) {
                f.data = null;
                f.file_status = SEND_ERROR;
                f.strError = $translate.instant('IDS_READ_FILE_ERROR');
              }
            }
            //console.log('request to read [' + (end - (f.buf_off + f.buf_end)) + ']; current, pointer=' + f.buf_ptr + '; end=' + f.buf_end);
            reader.readAsArrayBuffer(f.file.slice(f.buf_off + f.buf_end, end));
            f.buf_busy = true;
          }
        }
      }

      fts.prototype.stop_transfer_timer = function() {
        /*
        if(this.transfer_timerID) {
        clearTimeout(this.transfer_timerID);
        this.transfer_timerID = null;
        }
        */
        if(this.transferWorker) {
          this.transferWorker.terminate();
          this.transferWorker = null;
        }
      }

      fts.prototype.start_transfer_timer = function(value) {
        var f = this;
        this.stop_transfer_timer();
        //this.transfer_timerID = setTimeout(transer_timer_func, value);
        this.transferWorker = new Worker('worker/worker_timeout.js');
        this.transferWorker.onmessage = transer_timer_func;
        this.transferWorker.postMessage({ command: 'set', delay: value });
        function transer_timer_func() {
          //f.transfer_timerID = null;
          f.transferWorker.terminate();
          f.transferWorker = null;
          if(f.file_transfer == 1) {
            f.StartSending();
          } else {
            f.SendFileAction(SENDFILE_ACTION_ACK, f.file_pointer, 0);
            f.last_send_tick = hmtg.util.GetTickCount();
            f.helper_calc_progress();
            _imDlg.delayed_update();
          }
        }
      }

      fts.prototype.stop_idle_timer = function() {
        if(this.idle_timerID) {
          clearTimeout(this.idle_timerID);
          this.idle_timerID = null;
        }
      }

      fts.prototype.start_idle_timer = function(value) {
        var f = this;
        this.stop_idle_timer();
        this.idle_timerID = setTimeout(idle_timer_func, value);
        function idle_timer_func() {
          f.idle_timerID = null;
          f.ResetTransferRate();
          f.helper_calc_progress();
          _imDlg.delayed_update();
        }
      }

      fts.prototype.stop_resume_timer = function() {
        if(this.resume_timerID) {
          clearTimeout(this.resume_timerID);
          this.resume_timerID = null;
        }
      }

      fts.prototype.start_resume_timer = function(value) {
        var f = this;
        this.stop_resume_timer();
        this.resume_timerID = setTimeout(resume_timer_func, value);
        function resume_timer_func() {
          f.resume_timerID = null;
          if(f.file_transer == 2) {
            if(f.file_status == RECV_RECV) {
              f.SendFileAction(SENDFILE_ACTION_RESUME, f.file_pointer, 0);
            }
            start_resume_timer(60000);
          }
        }
      }

      fts.prototype.stop_all_timer = function() {
        this.stop_transfer_timer();
        this.stop_idle_timer();
        this.stop_resume_timer();
      }

      fts.prototype.helper_calc_progress = function() {
        var f = this;
        var im = f.im;
        f.progress_str = msgrHelper.get_timestring(1) + ' ';
        if(f.file_transfer == 1) {
          switch(f.file_status) {
            case SEND_ERROR:
              f.progress_str += f.strError;
              break;
            case SEND_WAIT:
              f.progress_str += $translate.instant('IDS_SEND_WAIT').replace('#peer_name#', im.calc_peer_name());
              break;
            case SEND_LOSE_CONTACT:
              f.progress_str += $translate.instant('IDS_SEND_LOSE_CONTACT');
              break;
            case ALL_FINISH:
              f.progress_str += $translate.instant('IDS_FILE_TRANSFER_DONE');
              break;
            default:
              if(im.m_group_disconnected) {
                f.progress_str += $translate.instant('IDS_TRANSFER_DISCONNECT');
              } else {
                f.progress_str += calcRateString(f, f.ack_pointer);
              }
              break;
          }
        } else {
          switch(f.file_status) {
            case RECV_ERROR:
              f.progress_str += f.strError;
              break;
            case RECV_WAIT:
              f.progress_str += $translate.instant('IDS_RECV_WAIT');
              break;
            case ALL_FINISH:
              f.progress_str += $translate.instant('IDS_FILE_TRANSFER_DONE');
              break;
            default:
              if(im.m_group_disconnected) {
                f.progress_str += $translate.instant('IDS_TRANSFER_DISCONNECT');
              } else {
                f.progress_str += calcRateString(f, f.file_pointer);
              }
              break;
          }
        }

        function calcRateString(f, pos) {
          var s;
          s = hmtgHelper.number2GMK(pos) + 'B';
          if(f.tick_array.length > 1) {
            var interval = f.tick_array[f.tick_array.length - 1] - f.tick_array[0];
            var rate = 1000 * f.rate_data_size / (interval ? interval : 1);
            var rate_str = hmtgHelper.number2GMK(rate) + 'B/s';

            var left_time = (f.file_size - pos) / rate;
            var time_str = hmtgHelper.second2timestr(left_time);
            return $translate.instant('IDS_FORMAT_RATE').replace('#size#', s).replace('#time#', time_str).replace('#rate#', rate_str);
          } else {
            return s;
          }
        }
      }

      fts.prototype.UpdateTransferRate = function(len) {
        var f = this;
        var now = hmtg.util.GetTickCount();
        var size = f.tick_array.length;
        if(size > 5 && now - f.tick_array[size - 2] < 500) {
          f.tick_array[size - 1] = now;
          f.len_array[size - 1] += len;
        } else {
          f.tick_array.push(now);
          f.len_array.push(len);
        }
        f.rate_data_size += len;
        var i;
        var cutoff = -1;
        for(i = f.tick_array.length - 2; i >= 0; i--) {
          var tick = f.tick_array[i];
          if(now - tick > 5000) {
            cutoff = i;
            break;
          }
        }
        if(cutoff == -1) {
          if(size > 50) cutoff = 25;
        }
        if(cutoff != -1) {
          for(i = cutoff; i >= 0; i--) {
            // trick!!
            // use f.len_array[i + 1]
            // not f.len_array[i]
            // otherwise, the estimate rate will be larger than the actual value.
            f.rate_data_size -= f.len_array[i + 1];
          }
        }
        f.len_array.splice(0, cutoff + 1);
        f.tick_array.splice(0, cutoff + 1);

        f.start_idle_timer(10000);
      }
      fts.prototype.fts_id_string = function() {
        var f = this;
        var im = f.im;
        return "office=" + im.m_param._homepage() + ",transfer_id=" + f.unique_id + ",peer=" + im.peer_userid;
      }

      fts.prototype.SetError = function(id) {
        var f = this;
        var im = f.im;
        f.stop_all_timer();
        if(f.file_transfer == 1) {
          if(f.file_status != SEND_ERROR && f.file_status != ALL_FINISH) {
            f.file_status = SEND_ERROR;
            f.progress = 0;
            f.strError = $translate.instant(id ? id : 'IDS_SEND_FAIL');
            if(id == 'IDS_TRANSFER_PEER_CANCEL') {
              f.strError = f.strError.replace("#peer_name#", im.calc_peer_name());
            }
            f.helper_calc_progress();
            _imDlg.delayed_update();
          }
        } else {
          if(f.file_status != RECV_ERROR && f.file_status != ALL_FINISH) {
            if(f.file_status == RECV_WAIT) {
              f.file_status = RECV_ERROR;
              im.ShowPeerTypingStatus();
            } else {
              f.file_status = RECV_ERROR;
            }
            f.progress = 0;
            f.strError = $translate.instant(id ? id : 'IDS_RECV_FAIL');
            if(id == 'IDS_TRANSFER_PEER_CANCEL') {
              f.strError = f.strError.replace("#peer_name#", im.calc_peer_name());
            }
            f.helper_calc_progress();
            _imDlg.delayed_update();
          }
        }

      }

      fts.prototype.StopFileTransfer = function() {
        var f = this;
        f.stop_all_timer();
        if(f.file_transfer == 1) {
          if(f.file_status == SEND_WAIT || f.file_status == SEND_SEND || f.file_status == SEND_LOSE_CONTACT) {
            f.SendFileAction(SENDFILE_ACTION_CANCEL2, 0, 0);
          }
        } else {
          if(f.file_status == RECV_WAIT || f.file_status == RECV_RECV) {
            f.SendFileAction(SENDFILE_ACTION_CANCEL, 0, 0);
          }
        }
      }

      fts.prototype.load_image = function() {
        var f = this;
        var blob;
        var url;
        if(f.file) {
          // send
          url = window.URL.createObjectURL(f.file);
        } else {
          // recv
          try {
            if(f.data.length > appSetting.max_blob * 1048576) {
              return;
            }
            blob = new Blob([f.data], { type: 'image/png' });
            url = window.URL.createObjectURL(blob);
          } catch(e) {
            return;
          }
        }
        var img = new Image();
        function img_onload() {
          f.data_url = url;
          f.size_str = img.naturalWidth + 'x' + img.naturalHeight;
          _imDlg.delayed_update();
        }
        function img_onerror() {
          window.URL.revokeObjectURL(url);
        }

        img.addEventListener("load", img_onload, false);
        img.addEventListener("error", img_onerror, false);
        img.src = url;
      }

      fts.prototype.release_image = function() {
        var f = this;
        if(f.data_url) {
          window.URL.revokeObjectURL(f.data_url);
          f.data_url = null;
          f.size_str = '';
        }
      }

      fts.prototype.FileTransferDisconnectGroup = function() {
        var f = this;
        if(f.file_transfer == 1) {
          if(f.file_pointer != f.ack_pointer) {
            f.file_pointer = f.ack_pointer;
          }
        }
        f.helper_calc_progress();
      }

      fts.prototype.FileTransferReconnectGroup = function() {
        var f = this;
        if(f.file_transfer == 1) {
          if(f.file_status == SEND_SEND || f.file_status == SEND_LOSE_CONTACT)
            f.StartSending();
        }
        else {
          if(f.file_status == RECV_RECV) {
            f.SendFileAction(SENDFILE_ACTION_RESUME, f.file_pointer, 0);
          }
        }
        f.helper_calc_progress();
      }

      fts.prototype.release_memory = function() {
        var f = this;
        var im = f.im;
        if(f.data) {
          im.memory_usage -= f.data.length;
          f.data = null;
          im.ShowPeerTypingStatus();
        }

      }

      // fts members end

      // menu
      im.prototype.ontoggle = function(open) {
        var _im = this;
        this.menu = [];
        if(!open) {
          return;
        }
        var menu = this.menu;

        // prepare the menu
        if(_im.is_log) {
          if(_im.log_type == hmtg.config.IM_TARGET_TYPE_PEER) {
            menu.push({ "text": $translate.instant('IDS_CONVERSATION'), "onclick": _im.conversation });
          } else if(_im.log_type == hmtg.config.IM_TARGET_TYPE_GROUP) {
            var pgc = _im.m_param._m_pPgcHash()[_im.log_peer];
            if(pgc || _imDlg.FindIM2(_im.m_param, _im.log_peer) != -1) {
              menu.push({ "text": $translate.instant('IDS_GROUP_CONVERSATION'), "onclick": _im.conversation });
            }
          } else if(_im.log_type == hmtg.config.IM_TARGET_TYPE_GUEST) {
            var target = imlog2im(_im);
            if(target) {
              menu.push({ "text": $translate.instant('IDS_CONVERSATION'), "onclick": _im.conversation });
            }
          }
          menu.push({ "text": $translate.instant('ID_SAVE_CONVERSATION'), "onclick": _im.save });
        } else {
          if(_im.m_group_id && !_im.m_group_finished
            && _im.m_param._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED
            && _im.m_param._m_pPgcHash()[_im.m_group_id]) {
            menu.push({ "text": $translate.instant('IDS_RENAME_PGC'), "onclick": _im.OnRenamePgc });
            menu.push({ "text": $translate.instant('IDS_LEAVE_PGC'), "onclick": _im.OnLeavePgc });
          }
          menu.push({ "text": $translate.instant('ID_CONVERSATION_LOG'), "onclick": _im.conversation_log });
          menu.push({ "text": $translate.instant('ID_SAVE_CONVERSATION'), "onclick": _im.save });
          if(!_im.m_group_id && !_im.m_b_is_peer_guest
            && hmtgSound.ac
            && _im.m_param._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED
            && !_im.pc) {

            var goodmcu = _im.m_param._server_version_major() > 3
              || (_im.m_param._server_version_major() == 3 && _im.m_param._server_version_minor() >= 25);

            if(goodmcu) {
              var this_us = hmtg.jmkernel.jm_command_ParamFindUser(_im.m_param, _im.peer_userid);
              if(this_us) {
                // either offline/appear offline
                // or the peer's version is 1.23+
                if(!this_us._status() || (this_us._major() > 1 || (this_us._major() == 1 && this_us._minor() >= 23))) {
                  menu.push({ "text": $translate.instant('ID_START_WEBRTC_AUDIO_SESSION'), "onclick": _im.start_webrtc_audio_session });
                  menu.push({ "text": $translate.instant('ID_START_WEBRTC_VIDEO_SESSION'), "onclick": _im.start_webrtc_video_session });
                }
              }
            }
          }
          if(_im.pc) {
            hmtgSound.refresh_device_list();
            menu.push({ "text": $translate.instant('ID_STOP_WEBRTC_SESSION'), "onclick": _im.stop_webrtc_session });
            if(_im.webrtc_video_senders.length) {
              menu.push({ "text": $translate.instant('ID_STOP_VIDEO_SENDING'), "onclick": _im.stop_webrtc_video_sending });
            }
            if(hmtgSound.audio_device_array.length > 1 && !navigator.mozGetUserMedia) {
              var i;
              for(i = 0; i < hmtgSound.audio_device_array.length && i < 20; i++) {
                menu.push({
                  "text": $translate.instant('ID_START_RECORD') + ' @ ' + hmtgSound.audio_device_array[i].name,
                  "onclick": _im.start_microphone_with_id, "value": hmtgSound.audio_device_array[i].id
                });
              }
            }
            if(hmtgSound.video_device_array.length > 1 && !navigator.mozGetUserMedia) {
              var i;
              for(i = 0; i < hmtgSound.video_device_array.length && i < 20; i++) {
                menu.push({
                  "text": $translate.instant('ID_START_VIDEO_CAPTURE') + ' @ ' + hmtgSound.video_device_array[i].name,
                  "onclick": _im.start_camera_with_id, "value": hmtgSound.video_device_array[i].id
                });
              }
            }
            if(hmtgSound.ac
              //&& hmtgSound.ac.setSinkId
              && hmtgSound.audio_output_array.length > 1) {
              var i;
              for(i = 0; i < hmtgSound.audio_output_array.length && i < 20; i++) {
                menu.push({
                  "text": $translate.instant('ID_CHOOSE_SPEAKER') + ' @ ' + hmtgSound.audio_output_array[i].name,
                  "onclick": _im.chooseSpeaker, "value": hmtgSound.audio_output_array[i].id
                });
              }
            }
          }
        }
        if(!menu.length) {
          _im.dropdown_is_open = 0;
        }
      }

      function imlog2im(_im) {
        var i;
        for(i = 0; i < _imDlg.im_array.length; i++) {
          var target = _imDlg.im_array[i];
          if(target.m_b_is_peer_guest) {
            var display_name = target.guest_user_name + ' @ ' + target.guest_office_name;
            if(_im.log_peer == hmtg.util.encode64_url(display_name)) {
              return target;
            }
          }
        }
      }

      // menu command
      im.prototype.conversation = function($scope, target) {
        if(!target) target = this;
        if(target.log_type == hmtg.config.IM_TARGET_TYPE_GROUP) {
          var pgc = target.m_param._m_pPgcHash()[target.log_peer];
          if(pgc || _imDlg.FindIM2(target.m_param, target.log_peer) != -1) {
            _imDlg.showIM2($scope, target.m_param, target.log_peer);
          }
        } else if(target.log_type == hmtg.config.IM_TARGET_TYPE_PEER) {
          _imDlg.showIM($scope, target.m_param, target.log_peer, target.log_name);
        } else if(target.log_type == hmtg.config.IM_TARGET_TYPE_GUEST) {
          var im_target = imlog2im(target);
          if(im_target) {
            $scope.choose_im(im_target);
          }
        }
      }

      im.prototype.OnRenamePgc = function($scope, target) {
        if(!target) target = this;
        var param = target.m_param;
        var group_id = target.m_group_id;
        var pgc = param._m_pPgcHash()[group_id];
        msgrHelper.renamePgc($scope, param, pgc);
      }

      im.prototype.OnLeavePgc = function($scope, target) {
        if(!target) target = this;
        var param = target.m_param;
        var group_id = target.m_group_id;
        var pgc = param._m_pPgcHash()[group_id];
        msgrHelper.removePgc(_imDlg, param, pgc);
      }

      im.prototype.conversation_log = function($scope, target) {
        if(!target) target = this;
        if(target.m_group_id) {
          var pgc = target.m_param._m_pPgcHash()[target.m_group_id];
          _imDlg.showIMLog($scope, target.m_param, hmtg.config.IM_TARGET_TYPE_GROUP, target.m_group_id, pgc ? pgc._full_name() : '0()');
        } else if(target.m_b_is_peer_guest) {
          var display_name = target.guest_user_name + ' @ ' + target.guest_office_name;
          _imDlg.showIMLog($scope, target.m_param, hmtg.config.IM_TARGET_TYPE_GUEST, hmtg.util.encode64_url(display_name), display_name);
        } else {
          _imDlg.showIMLog($scope, target.m_param, hmtg.config.IM_TARGET_TYPE_PEER, target.peer_userid, target.peer_username);
        }
      }

      im.prototype.save = function($scope, target) {
        setTimeout(function() {
          if(hmtgHelper.isiOS) {
            hmtgAlert.add_blob_download_item(new Blob([target.IM0.text()], { type: 'text/plain' }), $translate.instant('ID_SAVED_CONVERSATION_FILENAME'));
          } else {
            hmtgHelper.save_file(new Blob([target.IM0.text()], { type: 'text/plain' }), $translate.instant('ID_SAVED_CONVERSATION_FILENAME'));
          }
        }, 0);
      }

      // menu end

      // members
      this.FindIM = function(param, peer_id) {
        var array = this.im_array;
        var i;
        for(i = 0; i < array.length; i++) {
          var item = array[i];
          if(item.m_param != param) continue;
          if(item.m_group_id) continue;
          if(item.peer_userid == peer_id) return i;
        }
        return -1;
      }

      this.FindIM2 = function(param, group_id) {
        var array = this.im_array;
        var i;
        for(i = 0; i < array.length; i++) {
          var item = array[i];
          if(item.m_param != param) continue;
          if(item.m_group_id == group_id) return i;
        }
        return -1;
      }

      this.FindIMLog = function(param, log_type, log_peer, try_im) {
        var array = try_im ? this.im_array : this.iml_array;
        var i;
        for(i = 0; i < array.length; i++) {
          var item = array[i];
          if(item.m_param != param) continue;
          if(item.has_error) continue;
          if(item.log_type != log_type) continue;
          if(item.log_peer != log_peer) continue;
          return i;
        }
        return -1;
      }

      this.FindIMLogEx = function(param, type, peer, new_offset, data) {
        var target;
        var idx = this.FindIMLog(param, type, peer);
        if(idx == -1) {
          idx = this.FindIMLog(param, type, peer, true);
          if(idx == -1) return;
          target = this.im_array[idx];
          if(!target.downloading) return;
          return target;
        } else {
          target = this.iml_array[idx];
          var idx2 = this.FindIMLog(param, type, peer, true);
          if(idx2 == -1) {
            if(!target.downloading) return;
            return target;
          }
          var target2 = this.im_array[idx2];
          if(target.downloading) {
            if(target2.downloading) {
              // need to check details
              if(typeof new_offset === 'undefined') {
                // this must be an received 'error',
                // ignore it
                return;
              } else {
                // check log window first
                if(target.offset1 == -1) {
                } else if(new_offset < target.offset1) {
                  if(new_offset + data.length != target.offset1) {
                    return target2;
                  }
                } else if(new_offset > target.offset2) {
                } else {
                  return target2;
                }
                // then, check im window
                if(target2.offset1 == -1) {
                } else if(new_offset < target2.offset1) {
                  if(new_offset + data.length != target2.offset1) {
                    return target;
                  }
                } else {
                  return target;
                }

                // reaching here, no window can be determined
                // pick log window
                return target;
              }
            } else {
              return target;
            }
          } else {
            if(target2.downloading) {
              return target2;
            } else {
              return;
            }
          }
        }
      }

      this.OnIMStatusChange = function(param, this_us) {
        var idx = this.FindIM(param, this_us._userid());
        if(idx == -1) return;
        var target = this.im_array[idx];

        target.peer_username = this_us._username();
        if(!this_us.status) {
          target.peer_typing_tick = hmtg.util.GetTickCount() - 60000;
        }
        target.SetTitleText();
        _imDlg.delayed_update();
      }

      this.callback_WebRTCSignal = function(param, text, visitor_name, peer_username) {
        var idx;
        var target;
        try {
          var signal = JSON.parse(text);
        } catch(e) {
          return;
        }

        idx = this.FindIM(param, visitor_name);
        if(idx == -1) {
          // only try to create a new IM if the signal is a sdp
          if(!signal.sdp) {
            hmtg.util.log(5, 'ignore webrtc signal. ' + "office=" + param._homepage() + ",peer=" + visitor_name + '\n' + text);
            return;
          }

          target = new im();
          target.m_param = param;
          target.peer_userid = visitor_name;
          var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, visitor_name);
          target.peer_username = this_us ? this_us.username : (hmtg.util.encodeUtf8Ex('EmptyName_msg2#' + hmtg.util.decodeUtf8(visitor_name), hmtg.config.MAX_USERNAME));
          target.init_alert();
          target.SetTitleText();
          target.first_log_download();

          this.im_array.push(target);
          /*
          if(imContainer.win_count < imContainer.max_win) {
          target.visible = true;
          target.msg = false;
          target.minimized = false;
          imContainer.win_count++;
          }
          */
          _imDlg.fast_update(); // trigger init of the element via directive "<msgr-im></msgr-im>"
        } else {
          target = this.im_array[idx];
          /*
          if(imContainer.win_count < imContainer.max_win && !target.visible) {
          target.visible = true;
          target.msg = false;
          target.minimized = false;
          imContainer.win_count++;
          }
          */
        }
        target.OnWebRTCSignal(param, text, visitor_name, peer_username);
        _imDlg.delayed_update();
      }

      this.callback_ShortMessage = function(param, type, short_message, short_message2, visitor_name, visitor_homepage, guest_user_name, message_delay, peer_username) {
        var idx;
        var target;
        switch(type) {
          case hmtg.config.TYPE_US_SHORT_MESSAGE2:
          case hmtg.config.TYPE_US_SHORT_MESSAGE3:
          case hmtg.config.TYPE_US_OFFLINE_MESSAGE2:
          case hmtg.config.TYPE_US_OFFLINE_MESSAGE3:
            idx = this.FindIM(param, visitor_name);
            if(idx == -1) {
              target = new im();
              target.m_param = param;
              target.peer_userid = visitor_name;
              if(type == hmtg.config.TYPE_US_SHORT_MESSAGE2 || type == hmtg.config.TYPE_US_OFFLINE_MESSAGE2) {
                var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, visitor_name);
                target.peer_username = this_us ? this_us.username : (guest_user_name ? guest_user_name : hmtg.util.encodeUtf8Ex('EmptyName_msg2#' + hmtg.util.decodeUtf8(visitor_name), hmtg.config.MAX_USERNAME));
              } else {
                target.m_b_is_peer_guest = true;
                target.guest_user_name = guest_user_name;
                target.guest_office_name = visitor_homepage;
                target.peer_username = '';
              }
              target.init_alert();
              target.SetTitleText();
              target.first_log_download();

              this.im_array.push(target);
              /*
              if(imContainer.win_count < imContainer.max_win) {
              target.visible = true;
              target.msg = false;
              target.minimized = false;
              imContainer.win_count++;
              }
              */
              _imDlg.fast_update(); // trigger init of the element via directive "<msgr-im></msgr-im>"
            } else {
              target = this.im_array[idx];
              /*
              if(imContainer.win_count < imContainer.max_win && !target.visible) {
              target.visible = true;
              target.msg = false;
              target.minimized = false;
              imContainer.win_count++;
              }
              */
            }
            target.OnIMMessageIn(param, ((type == hmtg.config.TYPE_US_SHORT_MESSAGE2 || type == hmtg.config.TYPE_US_SHORT_MESSAGE3) ? 1 : 2), short_message, short_message2, visitor_name, visitor_homepage, guest_user_name, message_delay, peer_username);
            _imDlg.delayed_update();
            break;
          default:
            hmtgSound.ShowInfoPrompt(function() {
              return hmtg.util.decodeUtf8((guest_user_name ? guest_user_name : peer_username) + ' :\n' + short_message);
            }, 30, true);
            break;
        }
      }

      this.callback_ShortMessageFailure = function(param, target_userid, short_message, short_message2, type) {
        if(type != hmtg.config.TYPE_US_SHORT_MESSAGE_FAILURE && type != hmtg.config.TYPE_US_ASYMMETRICAL_SHORT_MESSAGE) return;
        var idx = this.FindIM(param, target_userid);
        if(idx == -1) return;
        var target = this.im_array[idx];
        target.OnIMMessageFailure(param, short_message, short_message2, type == hmtg.config.TYPE_US_SHORT_MESSAGE_FAILURE);
      }

      this.callback_GroupMessageFail = function(param, group_id, short_message, short_message2, error_code) {
        var idx = _imDlg.FindIM2(param, group_id);
        if(idx == -1) return;
        var target = this.im_array[idx];
        target.OnIMMessageFailure(param, short_message, short_message2, true);
        if(error_code == 1) {
          this.on_pgc_error(param, group_id);
        }
      }

      this.callback_GroupMessage = function(param, group_id, short_message, short_message2, src_id) {
        var target = this.find_or_create_group_im(param, group_id);
        target.OnIMMessageIn(param, 1, short_message, short_message2, src_id, '', '', 0, hmtg.jmkernel.jm_info_GetUserName(param, src_id));
        if(target.SetGroupTypingStatus(src_id, 0)) {
          target.ShowGroupTypingStatus();
        }
        _imDlg.delayed_update();
      }

      this.callback_OfflineGroupMessage = function(param, delay, group_id, name, short_message, short_message2) {
        var target = this.find_or_create_group_im(param, group_id);
        target.OnIMMessageIn(param, 2, short_message, short_message2, '', '', '', delay, name);
        _imDlg.delayed_update();
      }

      this.callback_OfflineJoinLeave = function(param, delay, group_id, name, is_join) {
        var target = this.find_or_create_group_im(param, group_id);
        target.PrintString($translate.instant(is_join ? 'IDS_JOIN_GROUP' : 'IDS_LEAVE_GROUP')
          .replace('#username#', hmtg.util.decodeUtf8(name))
          , is_join ? 1 : 3, 0, delay);
        _imDlg.delayed_update();
      }

      this.callback_OfflinePgcRename = function(param, delay, group_id, name, pgc_name) {
        var target = this.find_or_create_group_im(param, group_id);
        target.PrintString($translate.instant('IDS_RENAME_PGC_DESCR')
          .replace('#username#', hmtg.util.decodeUtf8(name))
          .replace('#text#', hmtg.util.decodeUtf8(pgc_name))
          , 3, 0, delay);
        _imDlg.delayed_update();
      }

      this.callback_RenamePgc = function(param, group_id, pgc_name, src_id) {
        var target = this.find_or_create_group_im(param, group_id);
        target.SetTitleText();
        target.PrintString($translate.instant('IDS_RENAME_PGC_DESCR')
          .replace('#username#', hmtg.util.decodeUtf8(hmtg.jmkernel.jm_info_GetUserName(param, src_id)))
          .replace('#text#', hmtg.util.decodeUtf8(pgc_name))
          , 3);
        _imDlg.delayed_update();
      }

      this.callback_ServerLogError = function(param, type, peer) {
        var target = this.FindIMLogEx(param, type, peer);
        target.downloading = false;

        if(target.offset1 == -1) {
          target.show_download2 = true;
        } else {
          target.has_error = true;
        }
        _imDlg.delayed_update();
      }

      function show_download_link(target) {
        if(target.offset1 > 0) {
          target.show_download1 = true;
        }
        target.show_download2 = true;
        _imDlg.delayed_update();

        if(!target.insert_mode) {
          target.scroll_to_bottom();
        }
      }

      this.callback_ServerLogData = function(param, type, peer, new_offset, data) {
        var target = this.FindIMLogEx(param, type, peer, new_offset, data);
        target.downloading = false;
        if(!data.length) {
          target.download_all = false;
          show_download_link(target);
          return;
        }
        if(data.length < 16 || data.charCodeAt(data.length - 1) != '\n'.charCodeAt(0)) {
          target.has_error = true;
          _imDlg.delayed_update();
          return;
        }
        data = data.slice(0, data.length - 1) + '\0';

        var first_download = false;
        if(target.offset1 == -1) {
          first_download = true;
          target.insert_mode = 1;
          target.offset1 = target.offset2 = new_offset;
          target.fingerprint1 = target.fingerprint2 = data.slice(0, 16);
          target.blocksize2 = data.length;
          target.download_size = hmtgHelper.number2GMK(target.offset1);
        }
        else if(new_offset < target.offset1) {
          // sanity check
          // now IM can also request download, need make sure data is appended to the correct window
          if(new_offset + data.length != target.offset1) {
            target.has_error = true;
            _imDlg.delayed_update();
            return;
          }
          target.insert_mode = 1;
          target.offset1 = new_offset;
          target.fingerprint1 = data.slice(0, 16);
          target.download_size = hmtgHelper.number2GMK(target.offset1);
          if(!new_offset) target.download_all = false;
        }
        else if(new_offset > target.offset2) {
          // sanity check
          // now IM can also request download, need make sure data is appended to the correct window
          if(!target.is_log) {
            target.has_error = true;
            _imDlg.delayed_update();
            return;
          }
          target.offset2 = new_offset;
          target.fingerprint2 = data.slice(0, 16);
          target.blocksize2 = data.length;
        }
        else
          return;

        var idx2;
        var line;
        var old = target.is_log;
        var error_occured = false;
        target.is_log = true;
        while(data) {
          if(target.insert_mode) {
            idx2 = data.lastIndexOf('\n');
            if(idx2 == -1) {
              line = data;
              data = null;
            } else {
              line = data.slice(idx2 + 1);
              data = data.slice(0, idx2);
            }
          } else {
            idx2 = data.indexOf('\n');
            if(idx2 == -1) {
              line = data;
              data = null;
            } else {
              line = data.slice(0, idx2);
              data = data.slice(idx2 + 1);
            }
          }
          var item = hmtg.jmkernel.jm_command_DecodeServerLogLine(line);
          if(!item) {
            error_occured = true;
            break;
          }

          switch(item.text_type) {
            case hmtg.config.IM_TEXT_TYPE_ERROR:
              target.PrintString($translate.instant('IDS_SERVER_LOG_ERROR_TEXT').replace('#text#', hmtg.util.decodeUtf8(item.s3)), 0, item.tick);
              break;
            case hmtg.config.IM_TEXT_TYPE_SEND_FILE:
            case hmtg.config.IM_TEXT_TYPE_RECV_FILE:
              var f = new fts(hmtg.config.IM_TEXT_TYPE_SEND_FILE == item.text_type);
              f.im = target;
              f.file_status = ALL_FINISH;
              f.file_name = item.s3;
              f.last_send_tick = item.tick;
              f.init_time = item.tick - item.delay;
              f.file_size = item.size;
              target.ShowTransferProgress(f);
              break;
            case hmtg.config.IM_TEXT_TYPE_JOIN_GROUP:
              target.PrintString($translate.instant('IDS_JOIN_GROUP').replace('#username#', hmtg.util.decodeUtf8(item.s1)), 1, item.tick);
              break;
            case hmtg.config.IM_TEXT_TYPE_LEAVE_GROUP:
              target.PrintString($translate.instant('IDS_LEAVE_GROUP').replace('#username#', hmtg.util.decodeUtf8(item.s1)), 3, item.tick);
              break;
            case hmtg.config.IM_TEXT_TYPE_OFFLINE_JOIN:
              target.PrintString($translate.instant('IDS_JOIN_GROUP').replace('#username#', hmtg.util.decodeUtf8(item.s1)), 1, item.tick - item.delay);
              break;
            case hmtg.config.IM_TEXT_TYPE_OFFLINE_LEAVE:
              target.PrintString($translate.instant('IDS_LEAVE_GROUP').replace('#username#', hmtg.util.decodeUtf8(item.s1)), 3, item.tick - item.delay);
              break;
            case hmtg.config.IM_TEXT_TYPE_PGC_RENAME:
              target.PrintString($translate.instant('IDS_RENAME_PGC_DESCR').replace('#username#', hmtg.util.decodeUtf8(item.s1)).replace('#text#', hmtg.util.decodeUtf8(item.s2)), 3, item.tick, item.delay);
              break;
            case hmtg.config.IM_TEXT_TYPE_SEND_TEXT:
              target.ShowIMMessage('', item.s1, imStyle.parse(item.s3), item.s2, 0, item.tick);
              break;
            default:
              target.ShowIMMessage('', item.s1, imStyle.parse(item.s3), item.s2, (item.delay ? 2 : 1), item.tick - (item.delay > 0 ? item.delay : 0));
              break;
          }
        }
        target.is_log = old;

        if(!error_occured) {
          if(target.download_all) {
            if(!hmtg.jmkernel.jm_command_DownloadServerLog(target.m_param, target.log_type, target.log_peer, 1, target.offset1, target.fingerprint1, 0)) {
              target.download_all = false;
            } else {
              target.downloading = true;
            }
          } else {
            show_download_link(target);
          }
        }

        target.insert_mode = 0;

        // after the first download, scroll to the bottom
        if(first_download) {
          target.scroll_to_bottom();
        }
      }

      this.showIMLog = function($scope, param, log_type, log_peer, log_name) {
        var target;
        var idx = _imDlg.FindIMLog(param, log_type, log_peer);
        if(idx == -1) {
          target = new im(true);
          target.m_param = param;
          target.log_type = log_type;
          target.log_peer = log_peer;
          target.log_name = log_name;
          target.SetTitleText();
          target.first_log_download();

          _imDlg.iml_array.push(target);
          $scope.choose_iml(target);
        } else {
          target = _imDlg.iml_array[idx];
          if(log_name != target.log_name) {
            target.log_name = log_name;
            target.SetTitleText();
          }
          $scope.choose_iml(target);
        }
      }

      this.showIM = function($scope, param, peer_userid, peer_username) {
        var target;
        var idx = _imDlg.FindIM(param, peer_userid);
        if(idx == -1) {
          target = new im();
          target.m_param = param;
          target.peer_userid = peer_userid;
          target.peer_username = peer_username;
          target.init_alert();
          target.SetTitleText();
          target.first_log_download();

          _imDlg.im_array.push(target);
          $scope.choose_im(target);
        } else {
          target = _imDlg.im_array[idx];
          $scope.choose_im(target);
        }
        return target;
      }

      this.showIM2 = function($scope, param, group_id) {
        var target;
        var idx = _imDlg.FindIM2(param, group_id);
        if(idx == -1) {
          target = new im();
          target.m_param = param;
          target.m_group_id = group_id;
          target.init_alert();
          target.SetTitleText();
          target.first_log_download();

          _imDlg.im_array.push(target);
          $scope.choose_im(target);
        } else {
          target = _imDlg.im_array[idx];
          $scope.choose_im(target);
        }
        return target;
      }

      this.onDisconnect = function(param) {
        var i;
        var to_update = false;
        for(i = 0; i < _imDlg.im_array.length; i++) {
          var im = _imDlg.im_array[i];
          if(im.m_param != param) continue;
          if(im.is_log) continue;
          if(im.m_group_disconnected) continue;
          if(!im.m_group_id || !im.m_group_finished) {
            if(!im.m_group_disconnected) {
              im.m_group_disconnected = true;
              OnDisconnectGroup(im);
              to_update = true;
            }
          }
        }
        if(to_update) {
          _imDlg.delayed_update();
        }

        function OnDisconnectGroup(im) {
          if(im.m_im_reconnect_status != -1) {
            im.m_im_reconnect_status = -1;
            im.PrintString($translate.instant(hmtg.util.GetTickCount() - im.m_last_im_sent_tick < 120000 ? 'IDS_DISCONNECT_IM2' : 'IDS_DISCONNECT_IM'), 2);
          }
          if(!im.m_group_id) {
            var i;
            for(i = 0; i < im.fts_array.length; i++) {
              var f = im.fts_array[i];
              f.stop_transfer_timer();
              f.stop_resume_timer();
              f.FileTransferDisconnectGroup();
            }
            return;
          }
          im.m_request_hash = {};
          im.waiting_id = '';
          //im.PrintString($translate.instant('IDS_DISCONNECT_GROUP'), 2);
        }
      }

      this.onReconnect = function(param) {
        var i;
        var to_update = false;
        for(i = 0; i < _imDlg.im_array.length; i++) {
          var im = _imDlg.im_array[i];
          if(im.m_param != param) continue;
          if(im.is_log) {
            to_update = true;
            if(im.offset1 > 0) {
              im.show_download1 = true;
            }
            im.show_download2 = true;
            continue;
          }
          if(im.offset1 > 0) {
            to_update = true;
            im.show_download1 = true;
          } else if(im.offset1 == -1) {
            im.first_log_download();
          }
          if(im.m_group_disconnected) {
            im.m_group_disconnected = false;
            OnReconnectGroup(im);
            to_update = true;
          }
        }

        if(to_update) {
          _imDlg.delayed_update();
        }

        function OnReconnectGroup(im) {
          if(im.m_im_reconnect_status == -1) {
            im.m_im_reconnect_status = 1;
            im.PrintString($translate.instant('IDS_RECONNECT_IM'), 1);
          }
          if(!im.m_group_id) {
            var i;
            for(i = 0; i < im.fts_array.length; i++) {
              var f = im.fts_array[i];
              f.FileTransferReconnectGroup();
            }
            return;
          }
        }
      }

      this.CheckIMConversationWindow = function(param) {
        return (_imDlg.im_array.length || _imDlg.iml_array.length);
      }

      this.callback_SendFileRequest = function(param, unique_id, type, file_size,
        peer_id, peer_name, file_name, guest_user_name, guest_office_name, index) {
        var target;
        var idx = this.FindIM(param, peer_id);
        if(idx == -1) {
          target = new im();
          target.m_param = param;
          target.peer_userid = peer_id;
          if(type != 2) {
            target.peer_username = peer_name;
          }
          if(type != 0) {
            target.m_b_is_peer_guest = true;
            target.guest_user_name = guest_user_name;
            target.guest_office_name = guest_office_name;
            target.peer_username = '';
          }
          target.init_alert();
          target.SetTitleText();
          target.first_log_download();

          this.im_array.push(target);
          /*
          if(imContainer.win_count < imContainer.max_win) {
          target.visible = true;
          target.msg = false;
          target.minimized = false;
          imContainer.win_count++;
          }
          */
          _imDlg.fast_update(); // trigger init of the element via directive "<msgr-im></msgr-im>"
        } else {
          target = this.im_array[idx];
          /*
          if(imContainer.win_count < imContainer.max_win && !target.visible) {
          target.visible = true;
          target.msg = false;
          target.minimized = false;
          imContainer.win_count++;
          }
          */
        }
        target.OnSendFileRequest(param, unique_id, type, file_size,
          peer_id, peer_name, file_name, guest_user_name, guest_office_name, index);
        _imDlg.delayed_update();
      }

      this.callback_SendFileAction = function(param, param1, param2, action, unique_id, type, peer_id) {
        var target;
        var idx = this.FindIM(param, peer_id);
        if(idx == -1) return;
        target = this.im_array[idx];
        idx = target.FindFileTransferIndex(((action > 200) ? 2 : 1), unique_id, type);
        if(idx == -1) return;
        target.OnSendFileAction(param, param1, param2, action, unique_id, type, peer_id, idx);
      }

      this.callback_SendFileSend = function(param, flag, pointer, data, unique_id, type, peer_id) {
        var target;
        var idx = this.FindIM(param, peer_id);
        if(idx == -1) {
          hmtg.jmkernel.jm_command_SendFileAction(param, unique_id, type, SENDFILE_ACTION_CANCEL, 0, 0, peer_id);
        } else {
          target = this.im_array[idx];
          idx = target.FindFileTransferIndex(2, unique_id, type);
          if(idx == -1) {
            hmtg.jmkernel.jm_command_SendFileAction(param, unique_id, type, SENDFILE_ACTION_CANCEL, 0, 0, peer_id);
          } else {
            target.OnSendFileSend(param, flag, pointer, data, unique_id, type, peer_id, idx);
          }
        }
      }

      this.callback_GroupTyping = function(param, group_id, src_id, size) {
        var target;
        var idx = this.FindIM2(param, group_id);
        if(idx == -1) return;
        target = this.im_array[idx];
        if(target.SetGroupTypingStatus(src_id, 1)) {
          target.start_typing_interval(1000);
        }
      }

      this.callback_TypingIn = function(param, src_id) {
        var target;
        var idx = this.FindIM(param, src_id);
        if(idx == -1) return;
        target = this.im_array[idx];
        target.SetPeerTypingStatus(1);
        target.ShowPeerTypingStatus();
        _imDlg.delayed_update();
        target.start_typing_interval(1000);
      }

      this.find_or_create_group_im = function(param, group_id) {
        var idx = this.FindIM2(param, group_id);
        var target;
        if(idx == -1) {
          target = new im();
          target.m_param = param;
          target.m_group_id = group_id;

          if(!param._m_pPgcHash()[group_id]) {
            target.m_group_finished = true; // init as finished
          }

          target.init_alert();
          target.SetTitleText();
          target.first_log_download();

          this.im_array.push(target);
          /*
          if(imContainer.win_count < imContainer.max_win) {
          target.visible = true;
          target.minimized = false;
          imContainer.win_count++;
          }
          */
          target.msg = !target.visible || $rootScope.nav_item != 'msgr';
          _imDlg.fast_update(); // trigger init of the element via directive "<msgr-im></msgr-im>"
        } else {
          target = this.im_array[idx];
          /*
          if(imContainer.win_count < imContainer.max_win && !target.visible) {
          target.visible = true;
          target.minimized = false;
          imContainer.win_count++;
          }
          */
          target.msg = !target.visible || $rootScope.nav_item != 'msgr';
        }
        return target;
      }

      this.callback_JoinGroup = function(param, group_id, join_id, join_name) {
        var target = this.find_or_create_group_im(param, group_id);

        target.m_group_finished = false;
        target.PrintString($translate.instant('IDS_JOIN_GROUP').replace('#username#', hmtg.util.decodeUtf8(join_name)), 1);
        target.SetTitleText();

        delete target.m_request_hash[join_id];
        if(target.waiting_id == join_id) {
          target.waiting_id = '';
          target.stop_group_add_timer();
          target.TryAddPerson();
        }
        _imDlg.delayed_update();
      }

      this.callback_LeaveGroup = function(param, group_id, left_id) {
        var target = this.find_or_create_group_im(param, group_id);

        target.PrintString($translate.instant('IDS_LEAVE_GROUP').replace('#username#', hmtg.util.decodeUtf8(hmtg.jmkernel.jm_info_GetUserName(param, left_id))), 3);
        target.SetTitleText();
        _imDlg.delayed_update();
      }

      this.callback_StopPgc = function(param, group_id) {
        var idx = this.FindIM2(param, group_id);
        var target;
        if(idx == -1) return;
        target = this.im_array[idx];
        /*
        if(imContainer.win_count < imContainer.max_win && !target.visible) {
        target.visible = true;
        target.minimized = false;
        imContainer.win_count++;
        }
        */
        target.msg = !target.visible || $rootScope.nav_item != 'msgr';

        if(!target.m_group_finished) {
          target.PrintString($translate.instant('IDS_GROUP_FINISH'), 2);
        }
        target.m_group_finished = true;
        target.m_request_hash = {};
        target.waiting_id = '';
        target.SetTitleText();
        _imDlg.delayed_update();
      }

      this.callback_InitPgc = function(param, group_id, peer_id) {
        var target = this.find_or_create_group_im(param, group_id);
        target.m_group_finished = false;

        var pgc = param._m_pPgcHash()[group_id];
        if(param._my_id() == pgc._owner_id()) {
          var idx = this.FindIM(param, peer_id);
          if(idx != -1) {
            var target2 = this.im_array[idx];

            target.m_request_hash = target2.m_request_hash;
            target2.m_request_hash = {};
            target.waiting_id = target2.waiting_id;
            target2.waiting_id = '';
            target2.stop_group_add_timer();
            if(target.waiting_id)
              target.start_group_add_timer(10000);
          }

          $rootScope.$broadcast(hmtgHelper.WM_SHOW_IM, target, false);
        }
      }

      this.callback_UpdatePgc = function(param, group_id) {
        var idx = this.FindIM2(param, group_id);
        var target;
        if(idx == -1) return;
        target = this.im_array[idx];
        if(target.m_group_finished) {
          target.m_group_finished = false;
        }
        target.SetTitleText();
        _imDlg.delayed_update();
      }

      this.callback_CreateGroupFail = function(param, peer_id, third_id, error_code) {
        var idx = this.FindIM(param, peer_id);
        var target;
        if(idx == -1) return;
        target = this.im_array[idx];
        target.PrintString($translate.instant('IDS_JOIN_GROUP_FAIL').replace('#username#', hmtg.util.decodeUtf8(hmtg.jmkernel.jm_info_GetUserName(param, third_id))), 2);
        if(error_code > 100) {
          if(target.waiting_id == third_id) {
            target.waiting_id = '';
            target.stop_group_add_timer();
            target.TryAddPerson();
          }
        } else {
          target.waiting_id = '';
          target.stop_group_add_timer();
          target.m_request_hash = {};
        }
      }

      this.on_pgc_error = function(param, group_id) {
        var pgc = param._m_pPgcHash()[group_id];
        if(pgc) {
          hmtg.jmkernel.jm_command_PgcRemove(param, pgc);
        }
        hmtg.jmkernel.jm_command_LeaveGroup(param, group_id);
        this.callback_StopPgc(param, group_id);
      }

      this.callback_JoinGroupFail = function(param, group_id, join_id, error_code) {
        var idx = this.FindIM2(param, group_id);
        var target;
        if(idx == -1) return;
        target = this.im_array[idx];
        if(error_code == 1) {
          this.on_pgc_error(param, group_id);
        } else {
          target.PrintString($translate.instant('IDS_JOIN_GROUP_FAIL').replace('#username#', hmtg.util.decodeUtf8(hmtg.jmkernel.jm_info_GetUserName(param, join_id))), 2);
          if(target.waiting_id == join_id) {
            target.waiting_id = '';
            target.stop_group_add_timer();
            target.TryAddPerson();
          }
        }
      }

      this.callback_NotifyServerIMLogChange = function(param) {
        var array = this.im_array;
        var i;
        for(i = 0; i < array.length; i++) {
          var item = array[i];
          if(item.m_param != param) continue;
          item.update_typing_status();
        }
        _imDlg.delayed_update();
      }

      // members end

    }
  ])

  .service('imStyle', [
    function() {
      this.parse = function(text2) {
        var s = {};
        var idx = text2.indexOf('\\red');
        if(idx != -1) {
          var end = text2.length;
          if(end > idx + 50) {
            end = idx + 50;
          }
          var found = text2.slice(idx, end).match("\\\\red(\\d+)\\\\green(\\d+)\\\\blue(\\d+)");
          if(found && found.length >= 4) {
            s.has_color = true;
            s.red = found[1];
            s.green = found[2];
            s.blue = found[3];
          }
        }

        if(text2.indexOf('\\b\\') != -1 || text2.indexOf('\\b ') != -1) s.is_bold = true;
        if(text2.indexOf('\\i\\') != -1 || text2.indexOf('\\i ') != -1) s.is_italic = true;
        if(text2.indexOf('\\ul\\') != -1 || text2.indexOf('\\ul ') != -1) s.is_underline = true;
        if(text2.indexOf('\\strike\\') != -1 || text2.indexOf('\\strike ') != -1) s.is_strike = true;
        return s;
      }

      this.style2object = function(style) {
        var s = {};
        if(!style) return s;
        // 3 low bytes: color; high byte: bit 1: is_bold,2: is_italic,3: is_underline,4: is_strike,5: has_color,
        if(style & 0x10000000) {
          s.has_color = true;
          s.red = (style >> 16) & 0xff;
          s.green = (style >> 8) & 0xff;
          s.blue = style & 0xff;
        }
        if(style & 0x1000000) {
          s.is_bold = true;
        }
        if(style & 0x2000000) {
          s.is_italic = true;
        }
        if(style & 0x4000000) {
          s.is_underline = true;
        }
        if(style & 0x8000000) {
          s.is_strike = true;
        }
        return s;
      }

      this.object2style = function(s) {
        var style = 0;
        if(s.is_bold) style |= 0x1000000;
        if(s.is_italic) style |= 0x2000000;
        if(s.is_underline) style |= 0x4000000;
        if(s.is_strike) style |= 0x8000000;
        if(s.has_color) {
          // 3 low bytes: color; high byte: bit 1: is_bold,2: is_italic,3: is_underline,4: is_strike,5: has_color,
          style |= 0x10000000;
          style |= ((s.red & 0xff) << 16)
          style |= ((s.green & 0xff) << 8)
          style |= (s.blue & 0xff);
        }
        return style;
      }

      this.apply = function(text, s) {
        if(!s) return "1";  // no style

        var t = '{\\rtf1\\ansi\\ansicpg1252{\\fonttbl{\\f0\\fcharset0 MS Sans Serif;}{\\f1\\fcharset134}}';
        if(s.has_color) {
          t += '{\\colortbl ;\\red' + s.red + '\\green' + s.green + '\\blue' + s.blue + ';}';
        }
        t += '\\viewkind4\\uc1\\pard\\fs16';
        if(s.has_color) {
          t += '\\cf1';
        }
        if(s.is_bold) t += '\\b';
        if(s.is_italic) t += '\\i';
        if(s.is_strike) t += '\\strike';
        if(s.is_underline) t += '\\ul';
        t += ' ';

        // escape text
        var fonttype = -1;
        var k = 0;
        for(k = 0; k < text.length; k++) {
          if(text.charCodeAt(k) == '\n'.charCodeAt(0)) {
            t += '\\par\n';
          } else if(text.charCodeAt(k) == '\\'.charCodeAt(0) || text.charCodeAt(k) == '{'.charCodeAt(0) || text.charCodeAt(k) == '}'.charCodeAt(0)) {
            if(fonttype != 0) {
              fonttype = 0;
              t += "\\f0 ";
            }
            t += "\\";
            t += text.slice(k, k + 1);
          } else if(text.charCodeAt(k) >= 65536) {
            if(fonttype != 0) {
              fonttype = 0;
              t += "\\f0 ";
            }
            t += "?";
            /*
            } else if(text.charCodeAt(k) >= 32768) {
            if(fonttype != 1) {
            fonttype = 1;
            t += "\\f1 ";
            }
            t += '\\u' + (text.charCodeAt(k) >> 0) + '?';
            */
          } else if(text.charCodeAt(k) >= 128) {
            if(fonttype != 1) {
              fonttype = 1;
              t += "\\f1 ";
            }
            t += '\\u' + (text.charCodeAt(k) >> 0) + '?';
          } else {
            if(fonttype != 0) {
              fonttype = 0;
              t += "\\f0 ";
            }
            t += text.slice(k, k + 1);
          }
        }

        t += '\\par}';
        return t;
      }

      this.ngclass = function(style) {
        // 3 low bytes: color; high byte: bit 1: is_bold,2: is_italic,3: is_underline,4: is_strike,5: has_color,
        if(!style) return '';
        var s = '';
        if(style & 0x1000000) {
          s += ' im-bold';
        }
        if(style & 0x2000000) {
          s += ' im-italic';
        }
        if((style & 0x4000000) && (style & 0x8000000)) {
          s += ' im-ul-strike';
        } else {
          if(style & 0x4000000) {
            s += ' im-ul';
          }
          if(style & 0x8000000) {
            s += ' im-strike';
          }
        }
        return s;
      }

      this.ngstyle = function(style) {
        // 3 low bytes: color; high byte: bit 1: is_bold,2: is_italic,3: is_underline,4: is_strike,5: has_color,
        if(!style) return '';
        if(style & 0x10000000) {
          return { color: '#' + ('00' + ((style >> 16) & 0xff).toString(16)).slice(-2) + ('00' + ((style >> 8) & 0xff).toString(16)).slice(-2) + ('00' + (style & 0xff).toString(16)).slice(-2) };
        }
        return '';
      }
    }
  ])

  .controller('IMCtrl', ['$scope', 'Msgr', '$translate', 'hmtgHelper', 'jnagentDlg', '$modal', 'jnjContent',
    '$rootScope', 'msgrHelper', 'hmtgSound', 'imDlg', 'appSetting', 'board',
    function($scope, Msgr, $translate, hmtgHelper, jnagentDlg, $modal, jnjContent, $rootScope, msgrHelper,
      hmtgSound, imDlg, appSetting, board) {
      $scope.as = appSetting;
      $scope.style_height_send_button = { 'height': '100%' };
      $scope.has_canvas_stream = board.has_canvas_stream;

      var _im = $scope.im;
      _im.request_fullscreen = document.body.requestFullscreen
        || document.body.msRequestFullscreen
        || document.body.mozRequestFullScreen
        || document.body.webkitRequestFullscreen
        ;

      _im.microphone_gain = hmtg.util.parseJSON(hmtg.util.localStorage['webrtc_microphone_gain']);
      if(_im.microphone_gain === 'undefined') _im.microphone_gain = 100.0;
      _im.microphone_gain = Math.max(0.0, Math.min(100.0, _im.microphone_gain));
      _im.microphone_muted = false;
      if(_im.microphone_gain < hmtgSound.MIN_GAIN) {
        _im.microphone_gain = hmtgSound.MIN_GAIN;
      }

      _im.speaker_gain = hmtg.util.parseJSON(hmtg.util.localStorage['webrtc_speaker_gain']);
      if(_im.speaker_gain === 'undefined') _im.speaker_gain = 100.0;
      _im.speaker_gain = Math.max(0.0, Math.min(100.0, _im.speaker_gain));
      _im.speaker_muted = false;
      if(_im.speaker_gain < hmtgSound.MIN_GAIN) {
        _im.speaker_gain = hmtgSound.MIN_GAIN;
      }

      _im.import_forward_gain = hmtg.util.parseJSON(hmtg.util.localStorage['webrtc_import_forward_gain']);
      if(_im.import_forward_gain === 'undefined') _im.import_forward_gain = 100.0;
      _im.import_forward_gain = Math.max(0.0, Math.min(100.0, _im.import_forward_gain));
      _im.import_forward_muted = false;
      if(_im.import_forward_gain < hmtgSound.MIN_GAIN) {
        _im.import_forward_gain = hmtgSound.MIN_GAIN;
      }

      _im.import_playback_gain = hmtg.util.parseJSON(hmtg.util.localStorage['webrtc_import_playback_gain']);
      if(_im.import_playback_gain === 'undefined') _im.import_playback_gain = 100.0;
      _im.import_playback_gain = Math.max(0.0, Math.min(100.0, _im.import_playback_gain));
      _im.import_playback_muted = false;
      if(_im.import_playback_gain < hmtgSound.MIN_GAIN) {
        _im.import_playback_gain = hmtgSound.MIN_GAIN;
      }

      $scope.$watch(
        function() {
          return ($scope.im && $scope.im.text_input) ? $scope.im.text_input.offsetHeight : 100;
        },
        function(newValue, oldValue) {
          if(newValue) {
            $scope.style_height_send_button = { 'height': (newValue) + 'px' };
          }
        }
      );

      var myheight = 100;
      $scope.style_im_height = function() {
        var old = myheight;
        if($scope.im.visible && $rootScope.nav_item == 'msgr') {
          var offset = {};
          hmtg.util.calcOffset($scope.im.IM0[0], offset);
          if(offset.y) {
            var adjust = 0;
            if(!$scope.im.is_log) {
              var offset2 = {};
              hmtg.util.calcOffset($scope.im.text_input, offset2);
              adjust = offset2.y + $scope.im.text_input.offsetHeight - (offset.y + $scope.im.IM0[0].offsetHeight);
            }

            myheight = Math.max((hmtgHelper.view_port_height >> 2), hmtgHelper.view_port_height - adjust - offset.y - 20);
          }
        }

        // this logic can prevent exception caused by too frequent $digest
        // [$rootScope:infdig]
        if(myheight > old && myheight - old < 15) {
          myheight = old;
        }
        return {
          'height': '' + (myheight) + 'px'
        };
      }

      $scope.$watch('im.input', function() {
        $scope.im.onChangeInput();
      });

      $scope.$on(hmtgHelper.WM_FULLSCREEN_CHANGED, function() {
        var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
          ;

        _im.is_webrtc_fullscreen = fullscreenElement == _im.webrtc_fullscreen_element;
        if(!hmtgHelper.inside_angular) $scope.$digest();
      });

      $scope.download1 = function(target) {
        if(target.offset1 == -1) {
          target.first_download_action();
        } else {
          if(hmtg.jmkernel.jm_command_DownloadServerLog(target.m_param, target.log_type, target.log_peer, 1, target.offset1, target.fingerprint1, 0)) {
            target.status_after_download_action();
          }
        }
      }

      $scope.download_all = function(target) {
        if(hmtg.jmkernel.jm_command_DownloadServerLog(target.m_param, target.log_type, target.log_peer, 1, target.offset1, target.fingerprint1, 0)) {
          target.status_after_download_action();
          target.download_all = true;
        }
      }

      $scope.download2 = function(target) {
        if(target.offset1 == -1) {
          target.first_download_action();
        } else {
          if(hmtg.jmkernel.jm_command_DownloadServerLog(target.m_param, target.log_type, target.log_peer, -1, target.offset2, target.fingerprint2, target.blocksize2)) {
            target.status_after_download_action();
          }
        }
      }

      $scope.click_imtitle = function(im, menu) {
        menu.onclick($scope, im, menu);
      }

      $scope.conversation_log = function(im) {
        im.conversation_log($scope, im);
      }

      $scope.visit = function(im) {
        im.onVisit($scope, jnagentDlg);
      }

      $scope.invite = function(im) {
        im.onInvite(jnagentDlg);
      }

      $scope.add = function(im) {
        im.onAdd($scope);
      }

      $scope.remove = function(im) {
        im.onRemove($scope);
      }

      $scope.import_html5 = function(im) {
        im.import_html5($scope);
      }

      $scope.reset_import = function(im) {
        im.reset_import($scope);
      }

      $scope.$watch('im.microphone_gain', function() {
        var im = $scope.im;
        im.microphone_muted = im.microphone_gain == 0;
        hmtg.util.localStorage['webrtc_microphone_gain'] = JSON.stringify(im.microphone_gain);
        if(im.microphone_gain_node) {
          im.microphone_gain_node.gain.value = im.microphone_muted ? 0.0 : im.microphone_gain / 100.0;
        }
      });

      $scope.$watch('im.speaker_gain', function() {
        var im = $scope.im;
        im.speaker_muted = im.speaker_gain == 0;
        hmtg.util.localStorage['webrtc_speaker_gain'] = JSON.stringify(im.speaker_gain);
        if(im.speaker_gain_node) {
          im.speaker_gain_node.gain.value = im.speaker_muted ? 0.0 : im.speaker_gain / 100.0;
        }
      });

      $scope.$watch('im.import_forward_gain', function() {
        var im = $scope.im;
        im.import_forward_muted = im.import_forward_gain == 0;
        hmtg.util.localStorage['webrtc_import_forward_gain'] = JSON.stringify(im.import_forward_gain);
        if(im.import_forward_gain_node) {
          im.import_forward_gain_node.gain.value = im.import_forward_muted ? 0.0 : im.import_forward_gain / 100.0;
        }
      });

      $scope.$watch('im.import_playback_gain', function() {
        var im = $scope.im;
        im.import_playback_muted = im.import_playback_gain == 0;
        hmtg.util.localStorage['webrtc_import_playback_gain'] = JSON.stringify(im.import_playback_gain);
        if(im.import_playback_gain_node) {
          im.import_playback_gain_node.gain.value = im.import_playback_muted ? 0.0 : im.import_playback_gain / 100.0;
        }
      });


      $scope.style = function(im) {
        if(im.m_param._client_info_loaded()) {
          msgrHelper.styleIM($scope, im);
        }
      }

    }
  ])

  .directive('msgrIm', ['imDlg', '$compile',
    function(imDlg, $compile) {
      function link($scope, element, attrs) {

        $scope.im.IM0 = $scope.im.IM = angular.element('<div class="im-main" ng-style="style_im_height()"></div>');
        element.append($compile($scope.im.IM)($scope));

        var node1 = angular.element('<div ng-if="!im.has_error && im.show_download1 && !is_disconnected(im)"><button type="button" class="btn btn-link" ng-click="download1(im)" translate="IDS_DOWNLOAD_MORE"></button><button type="button" class="btn btn-link" ng-click="download_all(im)">{{"IDS_DOWNLOAD_ALL" | translate}}({{im.download_size}})</button></div><div ng-if="im.download_all && !im.has_error && !is_disconnected(im)"><button type="button" class="btn btn-link" ng-click="im.download_all = false;" translate="ID_STOP_DOWNLOAD"></button></div>');
        var n = angular.element('<div></div>');
        $scope.im.IM.append($compile(node1)($scope));
        $scope.im.IM.append(n);
        if($scope.im.is_log) {
          var node2 = angular.element('<div><button type="button" class="btn btn-link" ng-click="download2(im)" ng-if="!im.has_error && im.show_download2 && !is_disconnected(im)" translate="IDS_DOWNLOAD_MORE"></button></div>');
          $scope.im.IM.append($compile(node2)($scope));
          $scope.im.IM = n;
        } else {
          $scope.im.IM = n;
          $scope.im.IM.append(angular.element('<hr/>'));

          $scope.im.IM0[0].addEventListener('dragover', function(e) { $scope.im.handleDragOver(e); }, false);
          $scope.im.IM0[0].addEventListener('drop', function(e) { $scope.im.handleFileSelect(e); }, false);
        }
        $scope.im.im_main = element;
        $scope.im.highlight();
      }

      return {
        link: link
      };
    }
  ])

  .directive('emojiPanel', ['imDlg', '$compile', '$translate', 'appSetting',
    function(imDlg, $compile, $translate, appSetting) {
      function link($scope, element, attrs) {
        var a = hmtg.customization.emoji_list;
        if(a) {
          var base = angular.element('<div class="em-main" ng-show="im.show_em"></div>');
          element.append($compile(base)($scope));

          var i;
          for(i = 0; i < a.length; i++) {
            var s = a[i];
            var node = angular.element('<text class="emoji" ng-click="im.addEM(' + i + ')">' + s + '</text>');
            base.append($compile(node)($scope));
          }
          if(appSetting.show_advanced_function) {
            var node = angular.element('<text>' + $translate.instant('ID_NEW_WORD_PROMPT') + '</text>');
            base.append($compile(node)($scope));
          }  
        }
      }

      return {
        link: link
      };
    }
  ])

  .directive('emoticonPanel', ['imDlg', '$compile',
    function(imDlg, $compile) {
      function link($scope, element, attrs) {
        var a = hmtg.customization.emoticon_list;
        if(a) {
          var base = angular.element('<div class="em-main" ng-show="im.show_em2"></div>');
          element.append($compile(base)($scope));

          var i;
          for(i = 0; i < a.length; i++) {
            var s = a[i];
            var node = angular.element('<a class="emoticon" ng-click="im.addEM2(' + i + ')">' + s + '</a> ');
            base.append($compile(node)($scope));
          }
        }
      }

      return {
        link: link
      };
    }
  ])

  .directive('taFinder', ['imDlg',
    function(imDlg) {
      function link($scope, element, attrs) {
        $scope.im.text_input = element[0];
        $scope.im.text_input.addEventListener('focusin', function(e) {
          $scope.im.show_em = false;
          $scope.im.show_em2 = false;
          setTimeout(function() {
            imDlg.fast_update();
            setTimeout(function() {
              imDlg.fast_update();
            }, 0);
          }, 0);
        }, false);
      }

      return {
        link: link
      };
    }
  ])

  ;