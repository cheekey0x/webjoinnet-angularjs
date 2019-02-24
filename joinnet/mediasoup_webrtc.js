/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('mediasoupWebRTC', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope', 'hmtgSound', '$modal', 'joinnetHelper',
  'video_recving', 'joinnetTranscoding', '$http', 'hmtgAlert', 'video_capture',
  function($translate, appSetting, hmtgHelper, $rootScope, hmtgSound, $modal, joinnetHelper, 
    video_recving, joinnetTranscoding, $http, hmtgAlert, video_capture) {
    var _mediasoupWebRTC = this;

    this.turn_server_array = read_turn_server();
    this.no_stun = false;
    this.no_turn = false;
    this.no_tcp = false;
    this.no_udp = false;
    this.default_turn_server_array = [
      //{ urls: "stun:stun.l.google.com:19302" },
      //{ urls: "stun:stun.voipzoom.com:3478" },
      //{ urls: "stun:numb.viagenie.ca:3478" },
      //{ urls: "stun:stun.qq.com:3478" },
      { urls: "stun:stunserver.org:3478" }
    ];

    // mediasoup
    this._room = null;
    // to remove all items except version
    // npm install --save package-json-versionify
    // to build browser-ready protoo-client.js
    // ~protoo\client>gulp babel
    // ~protoo\client>browserify lib-es5\index.js -s protooClient -g [ package-json-versionify ] -o protoo-client.js
    this._protoo = null;
    this._peerName = '';
    this.checkAuthTimerID = null;
    this.displayName = '';
    this.webrtcStatus = 0;
    this.device = mediasoupClient.getDeviceInfo();
    this._useSimulcast = true;
    this._activeSpeaker = null;
    this._lastActiveSpeakerTick = hmtg.util.GetTickCount();
    this._activeSpeakerTimerID = null;
    this._maxActiveSwitchDelay = 2000;  // once becoming an active speaker, at least stay at main window for this time period

    // get around receiver video size is 0 issue
    this.keyFrameNewConstraintsTimerID = null;
    this.keyFrameOldConstraintsTimerID = null;
    this.keyFrameFlag = false; // flag to request a new keyframe while there is an ongoing operation

    // Transport for sending.
    this._sendTransport = null;

    // Transport for receiving.
    this._recvTransport = null;
    this._audioProducer = null;
    this._videoProducer = null;
    this.audioStats = null;
    this.videoStats = null;
    this.audioStatsTick = 0;
    this.videoStatsTick = 0;

    // sending
    this.audioStream = (hmtgSound.ac && hmtgSound.can_mix) ? hmtgSound.mixer_node.stream : null;
    this.videoStream = null;  // the video source chosen by the user
    this.activeVideoStream = null;  // the video source that is being sent
    this.localVideoStream = null;
    this.localScreenStream = null;
    this.importedVideoStream = null;
    this.use_screen_as_video = false;
    this.use_imported_as_video = false;

    this.is_send_video = appSetting.auto_send_video;

    this.intervalSpeakerID = null;
    this.lastCanSendAudio = false;
    this.lastCanSendVideo = false;

    // receiving
    this.remoteIsWebRTCAudio = {};
    this.remoteAudioConsumer = {};
    this.remotePlayer = {};
    this.remote_node = {};
    this.remoteAudioStats = {};
    this.remoteAudioStatsTick = {};

    this.remoteIsWebRTCVideo = {};
    this.remoteVideoConsumer = {};
    this.remoteVideoStream = {};
    this.remoteVideoStats = {};
    this.remoteVideoStatsTick = {};

    this.is_main_video_webrtc = false;

    function read_turn_server() {
      var array = [];
      try {
        array = typeof hmtg.util.localStorage['hmtg_turn_server_array'] === 'undefined' ? [] : JSON.parse(hmtg.util.localStorage['hmtg_turn_server_array']);
        if(!hmtg.util.isArray(array)) return [];
        if(array.length > 10) array.length = 10;
      } catch(e) {
        return [];
      }
      return array;
    }

    this.turn_server_array_2_string = function(array) {
      var str = '[';
      var first = true;
      array.forEach(function(item) { 
        var urls = item.urls ? item.urls : item.url;
        if(hmtg.util.isArray(urls)) {
          urls.forEach(function(url) {
            if(first) {
              first = false;
            } else {
              str += ', ';
            }
            str += url;
          });
        } else if(urls) {
          if(first) {
            first = false;
          } else {
            str += ', ';
          }
          str += urls;
        }
      });

      return str + ']';
    }

    function checkMCUItemHttps(item) {
      try {
        if(item.url) {
          return item.url.indexOf('https') == 0 ? item.url : '';
        }
        if(item.urls) {
          if(hmtg.util.isArray(item.urls)) {
            return item.urls[0].indexOf('https') == 0 ? item.urls[0] : '';
          }
          return item.urls.indexOf('https') == 0 ? item.urls : '';
        }
        return '';
      } catch(e) {
        return '';
      }
    }

    function proceedAPIEntry(server, username, password, modifier, array, callback) {
      var auth = username + ':' + password;
      // xirsys
      if(server.indexOf('xirsys.') != -1) {
        hmtg.util.log('webrtc, try to receive TURN server entries from xirsys API' + modifier + '...');
        $http.put(server, '', {
          headers: { "Authorization": "Basic " + hmtg.util.encode64(auth) }
        })
          .success(function(data) {
            if(data.v && data.v.iceServers && data.v.iceServers.length >= 1) {
              hmtg.util.log('webrtc, received ' + data.v.iceServers.length + ' TURN server entries from xirsys API' + modifier + '');
              array = array.concat(data.v.iceServers);
            }
            callback(array);
          })
          .error(function() {
            callback(array);
          });
      } else {
        hmtg.util.log('webrtc, try to receive TURN server entries from https API' + modifier + '...');
        $http.put(server, '', {
          headers: { "Authorization": "Basic " + hmtg.util.encode64(auth) }
        })
          .success(function(data) {
            if(data.v && data.v.iceServers && data.v.iceServers.length >= 1) {
              hmtg.util.log('webrtc, received ' + data.v.iceServers.length + ' TURN server entries from https API' + modifier + '');
              array = array.concat(data.v.iceServers);
            }
            callback(array);
          })
          .error(function() {
            callback(array);
          });
      }
    }

    this.request_delayed_turn_servers = function(mcu_array, callback) {
      if(this.device.flag == 'msedge') {
        hmtg.util.log('webrtc, force not to use stun/turn server for Edge');
        callback([]);
        return;
      }
      // when not using turn server, skip collecting turn servers
      if(this.no_stun) {
        hmtg.util.log('webrtc, not using STUN server');
        // when no_stun is set,
        // the built-in array has been reset in hmtgs.run()
      }
      if(this.no_turn) {
        hmtg.util.log('webrtc, not using TURN server');
        callback(this.default_turn_server_array.slice(0));
        return;
      }

      var array = this.create_turn_server_array_option(mcu_array);
      var i;

      // check api at local array first, then check the one at mcu array

      // check whether there is any API entry in the local turn server array
      for(i = 0; i < this.turn_server_array.length; i++) {
        var this_item = this.turn_server_array[i];
        if(this_item.server.indexOf('https') == 0 && this_item.username && this_item.password) {
          proceedAPIEntry(this_item.server, this_item.username, this_item.password, '(local settings)', array, callback);
          // after any valid https entry, just return
          return;
        }
      }

      // if reaching here, there is no good api entry in the local turn server array
      // check whether there is any API entry in the mcu turn server array
      for(i = 0; i < mcu_array.length; i++) {
        var this_item = mcu_array[i];
        var server = checkMCUItemHttps(this_item);
        if(server && this_item.username && this_item.credential) {
          proceedAPIEntry(server, this_item.username, this_item.credential, '(MCU settings)', array, callback);
          // after any valid https entry, just return
          return;
        }
      }

      // if reaching here, there is no good api entry, use normal array
      callback(array);
    }

    this.create_turn_server_array_option = function(mcu_array) {
      var array = this.default_turn_server_array.slice(0);
      var i;
      for(i = 0; i < this.turn_server_array.length; i++) {
        var this_item = this.turn_server_array[i];
        if(this_item.server.indexOf('https') == 0) {
          continue;
        }
        if(this_item.username) {
          array.push({
            urls: this_item.server,
            username: this_item.username,
            credential: this_item.password
          });
        } else {
          array.push({
            urls: this_item.server
          });
        }
      }

      // mcu_array contains the real turn server, no need to convert
      for(i = 0; i < mcu_array.length; i++) {
        var this_item = mcu_array[i];
        if(checkMCUItemHttps(this_item)) {
          continue;
        }
        array.push(this_item);
      }
      return array;
    }

    this.to_play_webrtc_audio = function(ssrc) {
      if(this.webrtcStatus != 4) return false;
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var item = a[ssrc];
      if(!item) return false;
      if(item._m_iWebRTCStatus() != 4) return false;
      return true;
    }

    this.to_show_webrtc_video = function(ssrc) {
      if(!this.remoteVideoStream[ssrc]) return false;
      if(this.webrtcStatus != 4) return false;
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var item = a[ssrc];
      if(!item) return false;
      if(item._m_iWebRTCStatus() != 4) return false;
      return true;
    }

    this.webrtc_reset_upon_disconnection = function() {
      this.webrtcStatus = 0;
      this._sendTransport = null;
      this._recvTransport = null;
      this._audioProducer = null;
      this._videoProducer = null;
      this.stopKeyFrameOperation();
      this._activeSpeaker = null;
      if(this._activeSpeakerTimerID) {
        clearTimeout(this._activeSpeakerTimerID);
        this._activeSpeakerTimerID = null;
      }

      this.activeVideoStream = null;

      this.remoteVideoStream = {};
      this.remoteIsWebRTCAudio = {};
      this.remoteIsWebRTCVideo = {};
      this.is_main_video_webrtc = false;
    }

    this.net_init_finished = function() {
      this.webrtc_reset_upon_disconnection();

      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {

        this.lastCanSendAudio = hmtg.jnkernel.jn_info_CanSendAudio() && hmtg.jnkernel._jn_bAudioCap();
        this.lastCanSendVideo = hmtg.jnkernel.jn_info_CanSendVideo();

        if(!appSetting.auto_try_webrtc) {
          hmtg.util.log('webrtc, WebRTC is turned off in JoinNet setting');
          return;
        }

        this.displayName = this._peerName = '' + hmtg.jnkernel._jn_ssrc_index();

        try {
          var signalServerUrl = hmtg.jnkernel._jn_webrtc_signal_server_url();
          if(!signalServerUrl) {
            return;
          }
          this.webrtcStatus = 1;
          hmtg.util.log('stat, webrtc status change to 1');
          hmtg.jnkernel.jn_command_WebRTCStatusNotification(1); // WebRTC connecting or error
          this.request_delayed_turn_servers(hmtg.jnkernel._jn_turn_server_array(), startWebRTC);

          function startWebRTC(turn_server_array) {
            var option = {};
            if(_mediasoupWebRTC.no_tcp) {
              option.tcp = false;
              hmtg.util.log('webrtc, not using TCP');
            } else if(_mediasoupWebRTC.no_udp) {
              option.udp = false;
              hmtg.util.log('webrtc, not using UDP');
            }
            if(turn_server_array.length) { 
              hmtg.util.log('webrtc, use STUN/TURN servers: ' + _mediasoupWebRTC.turn_server_array_2_string(turn_server_array));
            }
            _mediasoupWebRTC._room = new mediasoupClient.Room({
              requestTimeout: 10000,
              transportOptions: option,
              turnServers: turn_server_array
            });

            _mediasoupWebRTC.turnOffCheckAuthTimer();

            hmtg.util.log('webrtc, connecting to the signal server...');
            var protooTransport = new protooClient.WebSocketTransport(signalServerUrl);
            _mediasoupWebRTC._protoo = new protooClient.Peer(protooTransport);

            _mediasoupWebRTC.listenRoom();
            _mediasoupWebRTC.listenSignal();
          }
        } catch(e) { 
          hmtg.util.log('webrtc, start connection fails: ' + JSON.stringify(e));
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_WEBRTC_ERROR_CANNOT_CONNECT') + ' Error: ' + hmtgSound.getUserMediaError(e) }, 20);
        }  
      }
    }

    // get around receiver video size is 0 issue
    this.stopKeyFrameOperation = function() {
      if(this.keyFrameNewConstraintsTimerID) {
        clearTimeout(this.keyFrameNewConstraintsTimerID);
        this.keyFrameNewConstraintsTimerID = null;
      }
      if(this.keyFrameOldConstraintsTimerID) {
        clearTimeout(this.keyFrameOldConstraintsTimerID);
        this.keyFrameOldConstraintsTimerID = null;
      }
      this.keyFrameFlag = false;
    }

    this.forceKeyFrame = function() {
      // to get around that some new receive doesn't receive the key frame upon joining
      // manually force the keyframe by changing sender's video Constraints 
      // https://github.com/versatica/mediasoup/issues/206

      // reset the flag as we are processing the request now
      this.keyFrameFlag = false;

      // if no video producer, just return
      // a new video producer will trigger a keyframe as well
      if(!this._videoProducer) {
        return;
      }

      // first check whether there is an ongoing keyframe operation
      if(this.keyFrameNewConstraintsTimerID || this.keyFrameOldConstraintsTimerID) {
        // if there is an ongoing keyframe operation
        // set the flag
        // a new operation will start once the existing operation finish
        this.keyFrameFlag = true;
        return;
      }

      this.keyFrameNewConstraintsTimerID = setTimeout(function() {
        _mediasoupWebRTC.keyFrameNewConstraintsTimerID = null;

        // check whether the video capture size is ready
        var w1 = 352;
        var h1 = 240;
        if(video_capture.stat && video_capture.stat.capture_width && video_capture.stat.capture_height) {
          w1 = video_capture.stat.capture_width - 1;
          h1 = video_capture.stat.capture_height - 1;
        } else {
          // wait capture size and insert a new request
          _mediasoupWebRTC.forceKeyFrame();
          return;
        }

        var w0 = 2000;
        var h0 = 2000;
        try {
          w0 = _mediasoupWebRTC._videoProducer.track.getConstraints().width.max;
          h0 = _mediasoupWebRTC._videoProducer.track.getConstraints().height.max;
        } catch(e) { }
        try {
          var oldConstraints = {
            width: { max: w0 },
            height: { max: h0 }
          }
          var newConstraints = {
            width: { exact: w1 },
            height: { exact: h1 }
          }

          _mediasoupWebRTC._videoProducer.track.applyConstraints(newConstraints)
            .then(function() {
              _mediasoupWebRTC.keyFrameOldConstraintsTimerID = setTimeout(function() {
                _mediasoupWebRTC.keyFrameOldConstraintsTimerID = null;
                try {
                  _mediasoupWebRTC._videoProducer.track.applyConstraints(oldConstraints);
                } catch(e) { }

                // at the end of existing key frame operation
                // if the flag is on
                // start a new key frame request
                if(_mediasoupWebRTC.keyFrameFlag) {
                  _mediasoupWebRTC.forceKeyFrame();
                }
              }, 1500);
            });
        } catch(e) { }
      }, 1500);
    }

    this.add_user = function(ssrc) {
      _mediasoupWebRTC.remoteIsWebRTCAudio[ssrc] = false;
      _mediasoupWebRTC.remoteIsWebRTCVideo[ssrc] = false;

      // get around receiver video size is 0 issue
      this.forceKeyFrame();
    }

    this.event_quit_session = function() {
      this._closeRoom();
      this.clearIntervalSpeaker();
    }

    this.update_bitrate = function() {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) {
        return;
      }
      if(!this._sendTransport || !this._protoo) {
        return;
      }
      this._protoo.send('change-bitrate', { bitrate: appSetting.max_video_bitrate * 1000 })
        .then(function() {
        })
        .catch(function() {
        });
    }

    this.setIntervalSpeaker = function() {
      if(this.intervalSpeakerID) return;
      this.intervalSpeakerID = setInterval(funcIntervalSpeaker, 500);

      function funcIntervalSpeaker() {
        var current;
        current = hmtg.jnkernel.jn_info_CanSendAudio() && hmtg.jnkernel._jn_bAudioCap();
        if(current != _mediasoupWebRTC.lastCanSendAudio) {
          _mediasoupWebRTC.lastCanSendAudio = current;
          if(current) {
            _mediasoupWebRTC.startAudioSource();
          } else {
            _mediasoupWebRTC.stopAudioSource();
          }
        }
        current = hmtg.jnkernel.jn_info_CanSendVideo();
        if(current != _mediasoupWebRTC.lastCanSendVideo) {
          _mediasoupWebRTC.lastCanSendVideo = current;
          if(current) {
            _mediasoupWebRTC.updateVideoSource();
          } else {
            _mediasoupWebRTC.stopVideoSource();
          }
        }
      }
    }

    this.clearIntervalSpeaker = function() {
      if(this.intervalSpeakerID) {
        clearInterval(this.intervalSpeakerID);
        this.intervalSpeakerID = null;
      }
    }

    this.updateWebRTCStatus = function(connectionstate) {
      if(connectionstate == 'connected') {
        if(this.webrtcStatus != 4) {
          this.webrtcStatus = 4;
          hmtg.util.log('stat, webrtc status change to 4');
          hmtg.jnkernel.jn_command_WebRTCStatusNotification(4); // WebRTC connected, good ice
        }
        return;
      }
      if(connectionstate == 'failed' || connectionstate == 'disconnected' || connectionstate == 'closed') {
        //if(this.webrtcStatus == 4) {
          //hmtg.util.log('webrtc, restart ICE');
          //this._room.restartIce();
          //this.webrtcStatus = 2;
          //hmtg.jnkernel.jn_command_WebRTCStatusNotification(2); // WebRTC probing
          //return;
        //}
        if(this.webrtcStatus != 3) {
          this.webrtcStatus = 3;
          hmtg.util.log('stat, webrtc status change to 3');
          hmtg.jnkernel.jn_command_WebRTCStatusNotification(3); // WebRTC connected, failed ice
        }
        return;
      }
    }

    this.listenRoom = function() {
      this._room.removeAllListeners();

      // Event fired when a new remote Peer joins the Room.
      this._room.on('newpeer', function(peer){
        //hmtg.util.log(-2, 'webrtc, a new Peer joined the Room: ' + peer.name);

        // Handle the Peer.
        _mediasoupWebRTC._handlePeer(peer);
      });


      // Be ready to send mediasoup client requests to our remote mediasoup Peer in
      // the server, and also deal with their associated responses.
      this._room.on('request', function(request, callback, errback){
        //console.log('sending mediasoup request [method:%s]:%o', request.method, request);
        _mediasoupWebRTC._protoo.send('mediasoup-request', request)
          .then(callback)
          .catch(errback);
      });


      // Be ready to send mediasoup client notifications to our remote mediasoup
      // Peer in the server
      this._room.on('notify', function(notification){
        //console.log('sending mediasoup notification [method:%s]:%o',notification.method, notification);
        _mediasoupWebRTC._protoo.send('mediasoup-notification', notification)
          .catch(function(error) {
            console.log('could not send mediasoup notification:%o', error);
          });
      });

    }
    this._joinRoom = function() {
      this._room.join(this._peerName, { displayName: this.displayName, device: this.device })
        .then(function() {
          hmtg.util.log('webrtc, join room OK');
          // Create Transport for sending.
          _mediasoupWebRTC._sendTransport =
            _mediasoupWebRTC._room.createTransport('send');

          _mediasoupWebRTC._sendTransport.on('close', function(originator){
            //console.log('Transport "close" event [originator:%s]', originator);
          });

          _mediasoupWebRTC._sendTransport.on('connectionstatechange', function(connectionstate) {
            hmtg.util.log('webrtc, sendTransport status: ' + connectionstate);
            _mediasoupWebRTC.updateWebRTCStatus(connectionstate);
          });

          // Create Transport for receiving.
          _mediasoupWebRTC._recvTransport =
            _mediasoupWebRTC._room.createTransport('recv');

          _mediasoupWebRTC._recvTransport.on('close', function(originator){
            //console.log('receiving Transport "close" event [originator:%s]', originator);
          });

          _mediasoupWebRTC._recvTransport.on('connectionstatechange', function(connectionstate) {
            hmtg.util.log('webrtc, recvTransport status: ' + connectionstate);
            _mediasoupWebRTC.updateWebRTCStatus(connectionstate);
          });

          _mediasoupWebRTC.setIntervalSpeaker();
          
          // start sending audio/video if there is any source
          _mediasoupWebRTC.startAudioSource();
          _mediasoupWebRTC.startVideoSource();

          _mediasoupWebRTC.webrtcStatus = 2;
          hmtg.util.log('stat, webrtc status change to 2');
          hmtg.jnkernel.jn_command_WebRTCStatusNotification(2); // WebRTC probing

          _mediasoupWebRTC.update_bitrate();
        })
        .then(function(){
          var peers = _mediasoupWebRTC._room.peers;

          for(var i = 0; i < peers.length; i++) {
            var peer = peers[i];
            //hmtg.util.log(-2, 'webrtc, found existing peer: ' + peer.name);
            _mediasoupWebRTC._handlePeer(peer, { notify: false });
          }
        })
        .catch(function(error){
          hmtg.util.log('webrtc, join room fails: ', JSON.stringify(error));
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_WEBRTC_ERROR_CANNOT_JOIN') + ' Error: ' + hmtgSound.getUserMediaError(error) }, 20);

          _mediasoupWebRTC._closeRoom();
        });
    }

    this._closeRoom = function() {
      if(!this._room)
        return;

      hmtg.util.log('webrtc, leave room');

      // Leave the mediasoup Room.
      this._room.leave();
      this._room = null;

      // to do
      // may need to send the 'leaveRoom' notification manually here
      // before close the protoo
      this.turnOffCheckAuthTimer();
      if(this._protoo) {
        this._protoo.close();
        this._protoo = null;
      }

      // Close protoo Peer (wait a bit so mediasoup-client can send
      // the 'leaveRoom' notification).
      //setTimeout(function() {
        //oldProtoo.close();
      //}, 250);
    }

    this.turnOffCheckAuthTimer = function() {
      if(this.checkAuthTimerID) {
        clearTimeout(this.checkAuthTimerID);
        this.checkAuthTimerID = null;
      }
    }

    this.listenSignal = function() {
      this._protoo.on('open', function(){
        hmtg.util.log('webrtc, connected, check auth...');

        _mediasoupWebRTC.checkAuthTimerID = setTimeout(function() {
          _mediasoupWebRTC.checkAuthTimerID = null;
          hmtg.util.log('webrtc, auth timeout');
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_WEBRTC_ERROR_NO_AUTH'); }, 20);

          if(_mediasoupWebRTC._room) {
            _mediasoupWebRTC._closeRoom();
          } else {
            _mediasoupWebRTC._protoo.close();
            _mediasoupWebRTC._protoo = null;
          }
         }, 10000)
      });

      this._protoo.on('disconnected', function(){
        hmtg.util.log('webrtc, signal channel disconnected');

        try { _mediasoupWebRTC._room.remoteClose({ cause: 'protoo disconnected' }); }
        catch(error) { }

        _mediasoupWebRTC.turnOffCheckAuthTimer();

        _mediasoupWebRTC.webrtc_reset_upon_disconnection();
        // the protoo will try to reconnect, show the connecting status
        _mediasoupWebRTC.webrtcStatus = 1;
        hmtg.util.log('stat, webrtc status change to 1');
        hmtg.jnkernel.jn_command_WebRTCStatusNotification(1); // WebRTC connecting or error
      });

      this._protoo.on('close', function(){
        hmtg.util.log('webrtc, signal channel closed');

        _mediasoupWebRTC._closeRoom();

        _mediasoupWebRTC.turnOffCheckAuthTimer();

        _mediasoupWebRTC.webrtc_reset_upon_disconnection();
        _mediasoupWebRTC.webrtcStatus = 1;
        hmtg.util.log('stat, webrtc status change to 1');
        hmtg.jnkernel.jn_command_WebRTCStatusNotification(1); // WebRTC connecting or error
      });

      this._protoo.on('request', function(request, accept, reject){
        //console.log('_handleProtooRequest() [method:%s, data:%o]',request.method, request.data);

        switch(request.method) {
          case 'auth':
            {
              _mediasoupWebRTC.turnOffCheckAuthTimer();

              var hash = request.data;
              hash = hash ? hash.hash : '';
              if(hmtg.jnkernel._jn_webrtc_check_auth(hash)) {
                accept();
                hmtg.util.log('webrtc, auth OK, try to join room');
                _mediasoupWebRTC._joinRoom();
              } else {
                reject();
                hmtg.util.log('webrtc, auth fails');
                hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_WEBRTC_ERROR_NO_AUTH') }, 20);

                if(_mediasoupWebRTC._room) {
                  _mediasoupWebRTC._closeRoom();
                } else {
                  _mediasoupWebRTC._protoo.close();
                  _mediasoupWebRTC._protoo = null;
                }
              }

              break;
            }

          case 'mediasoup-notification':
            {
              accept();

              var notification = request.data;

              _mediasoupWebRTC._room.receiveNotification(notification);

              break;
            }

          case 'active-speaker':
            {
              accept();
              var active_speaker = null;
              if(request.data && request.data.peerName) {
                active_speaker = request.data.peerName;
              }
              var now = hmtg.util.GetTickCount();
              if(_mediasoupWebRTC._activeSpeakerTimerID) {
                clearTimeout(_mediasoupWebRTC._activeSpeakerTimerID);
                _mediasoupWebRTC._activeSpeakerTimerID = null;
              }
              // only switch active speaker if it changes
              if(active_speaker != _mediasoupWebRTC._activeSpeaker) {
                if(now - _mediasoupWebRTC._lastActiveSpeakerTick >= _mediasoupWebRTC._maxActiveSwitchDelay) {
                  _mediasoupWebRTC._activeSpeaker = active_speaker;
                  _mediasoupWebRTC._lastActiveSpeakerTick = now;
                  $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ACTIVE_SPEAKER);
                  //console.log('active speaker "%s"', active_speaker);
                } else {
                  _mediasoupWebRTC._activeSpeakerTimerID = setTimeout(function() {
                    _mediasoupWebRTC._activeSpeakerTimerID = null;
                    _mediasoupWebRTC._activeSpeaker = active_speaker;
                    _mediasoupWebRTC._lastActiveSpeakerTick = hmtg.util.GetTickCount();
                    $rootScope.$broadcast(hmtgHelper.WM_UPDATE_ACTIVE_SPEAKER);
                    //console.log('delayed active speaker "%s"', active_speaker);
                  }, _mediasoupWebRTC._maxActiveSwitchDelay - (now - _mediasoupWebRTC._lastActiveSpeakerTick))
                }
              }
              break;
            }

          case 'display-name-changed':
            {
              accept();
              break;
            }

          default:
            {
              console.log('unknown protoo method "%s"', request.method);

              reject(404, 'unknown method');
            }
        }
      });
    }

    this._handlePeer = function(peer)
    {
      // check that the ssrc is legal
      var ssrc = peer.name;
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      if(!a[ssrc]) return;

      _mediasoupWebRTC.remoteVideoConsumer[ssrc] = null;
      _mediasoupWebRTC.remoteAudioConsumer[ssrc] = null;
      _mediasoupWebRTC.remoteVideoStream[ssrc] = null;

      for(var i = 0; i < peer.consumers.length; i++){
        var consumer = peer.consumers[i];
        this._handleConsumer(consumer);
      }

      peer.on('close', function(originator){
        //hmtg.util.log(-2, 'webrtc, peer "close" event [name:"' + peer.name + '", originator:' + originator + ']');
        if(_mediasoupWebRTC.remoteAudioConsumer[ssrc]) {
          _mediasoupWebRTC.remoteAudioConsumer[ssrc].close();
          _mediasoupWebRTC.remoteAudioConsumer[ssrc] = null;
        }
        if(_mediasoupWebRTC.remoteVideoConsumer[ssrc]) {
          _mediasoupWebRTC.remoteVideoConsumer[ssrc].close();
          _mediasoupWebRTC.remoteVideoConsumer[ssrc] = null;
        }
        _mediasoupWebRTC.remoteVideoStream[ssrc] = null;
      });

      peer.on('newconsumer', function(consumer){
        //console.log('peer "newconsumer" event [name:"%s", id:%s, consumer:%o]',peer.name, consumer.id, consumer);

        _mediasoupWebRTC._handleConsumer(consumer);
      });
    }

    this._handleConsumer = function(consumer)
    {
      // get around receiver video size is 0 issue
      this.forceKeyFrame();

      consumer.on('effectiveprofilechange', function(profile){
        //console.log('consumer "effectiveprofilechange" event [id:%s, consumer:%o, profile:%s]',consumer.id, consumer, profile);
      });

      // Receive the consumer (if we can).
      if(consumer.supported) {
        // Pause it if video and we pause receiving video
        if(consumer.kind === 'video' && !video_recving.is_recv_video)
          consumer.pause();
        if(consumer.kind === 'audio' && !hmtg.jnkernel.jn_callback_IsRecvingAudio())
          consumer.pause();
        

        consumer.receive(this._recvTransport)
          .then(function(track) {
            consumer.enableStats(3000);
            var peerId = consumer.peer.name;

            var stream = new MediaStream;
            stream.addTrack(track);

            // Attach the track to a MediaStream and play it.
            if(consumer.kind === 'audio') {
              _mediasoupWebRTC.remoteAudioConsumer[peerId] = consumer;
              _mediasoupWebRTC.remoteIsWebRTCAudio[peerId] = true;

              function playAudioStream() {
                if(_mediasoupWebRTC.remote_node[peerId]) {
                  _mediasoupWebRTC.remote_node[peerId].disconnect();
                }
                _mediasoupWebRTC.remote_node[peerId] = hmtgSound.ac.createMediaStreamSource(stream);
                _mediasoupWebRTC.remote_node[peerId].connect(hmtgSound.create_playback_gain_node());
              }

              // without the remotePlayer, the audio will not work
              if(!_mediasoupWebRTC.remotePlayer[peerId]) {
                _mediasoupWebRTC.remotePlayer[peerId] = new Audio();
              }
              try {
                _mediasoupWebRTC.remotePlayer[peerId].srcObject = stream;
              } catch(e)
              {
                try {
                  _mediasoupWebRTC.remotePlayer[peerId].src = URL.createObjectURL(stream);
                } catch(e) { }
              }

              if(!hmtgHelper.isiOS) {
                playAudioStream();
              } else {
                var item = {};
                item['timeout'] = 3600 * 24 * 10;
                item['update'] = function() {
                  var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
                  var username = 'User';
                  if(a && a[peerId] && a[peerId]._szRealName()) {
                    username = a[peerId]._szRealName();
                  }

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
              }

              var stat_logged = false;
              consumer.on('stats', function(stats) {
                _mediasoupWebRTC.remoteAudioStats[peerId] = stats;
                _mediasoupWebRTC.remoteAudioStatsTick[peerId] = hmtg.util.GetTickCount();
                if(!stat_logged) {
                  if(stats.length && stats[0] && stats[0].bitrate) {
                    stat_logged = true;
                    if(consumer.rtpParameters
                      && consumer.rtpParameters.codecs
                      && consumer.rtpParameters.codecs[0]
                      && consumer.rtpParameters.codecs[0].name
                    ) {
                      hmtg.util.log('stat, webrtc ssrc[' + peerId + '] audio codec ' + consumer.rtpParameters.codecs[0].name);
                    }
                    hmtg.util.log('stat, webrtc ssrc[' + peerId + '] audio recving bitrate ' + stats[0].bitrate);
                  }
                }
              });
              consumer.on('close', function() {
                _mediasoupWebRTC.remoteAudioConsumer[peerId] = null;
                try {
                  _mediasoupWebRTC.remotePlayer[peerId].srcObject = null;
                } catch(e) {
                  try {
                    _mediasoupWebRTC.remotePlayer[peerId].src = null;
                  } catch(e) { }
                }
              });
            }
            if(consumer.kind === 'video') {
              var profile = appSetting.webrtc_bandwidth_profile;
              consumer.setPreferredProfile(profile == 'high' ? 'high' : (profile == 'low'? 'low' : 'medium'));
              consumer_init_resume();

              var old = _mediasoupWebRTC.remoteVideoStream[peerId];
              _mediasoupWebRTC.remoteVideoConsumer[peerId] = consumer;
              _mediasoupWebRTC.remoteVideoStream[peerId] = stream;
              _mediasoupWebRTC.remoteIsWebRTCVideo[peerId] = true;

              if(!old) {
                $rootScope.$broadcast(hmtgHelper.WM_UPDATE_VIDEO_WINDOW); // to update webrtc video or canvas
              }

              var stat_logged = false;
              consumer.on('stats', function(stats) {
                _mediasoupWebRTC.remoteVideoStats[peerId] = stats;
                _mediasoupWebRTC.remoteVideoStatsTick[peerId] = hmtg.util.GetTickCount();
                if(!stat_logged) {
                  if(stats.length && stats[0] && stats[0].bitrate) {
                    stat_logged = true;
                    if(consumer.rtpParameters
                      && consumer.rtpParameters.codecs
                      && consumer.rtpParameters.codecs[0]
                      && consumer.rtpParameters.codecs[0].name
                    ) {
                      hmtg.util.log('stat, webrtc ssrc[' + peerId + '] video codec ' + consumer.rtpParameters.codecs[0].name);
                    }
                    hmtg.util.log('stat, webrtc ssrc[' + peerId + '] video recving bitrate ' + stats[0].bitrate);
                  }
                }
              });
              consumer.on('resume', function() {
                consumer_init_resume();
              });
              function consumer_init_resume() {
                var old = _mediasoupWebRTC.remoteVideoStream[peerId];
                _mediasoupWebRTC.remoteVideoStream[peerId] = stream;

                if(!old) {
                  $rootScope.$broadcast(hmtgHelper.WM_UPDATE_VIDEO_WINDOW); // to update webrtc video or canvas
                }

                var elem = document.getElementById('webrtc-video-' + peerId);
                if(elem) {
                  try {
                    elem.srcObject = stream;
                  } catch(e) {
                    try {
                      elem.src = URL.createObjectURL(stream);
                    } catch(e) { }
                  }
                }
                if(video_recving.main_video_ssrc == peerId) {
                  elem = document.getElementById('webrtc_main_video');
                  if(elem) {
                    try {
                      elem.srcObject = stream;
                    } catch(e) {
                      try {
                        elem.src = URL.createObjectURL(stream);
                      } catch(e) { }
                    }
                    var old = _mediasoupWebRTC.is_main_video_webrtc;
                    _mediasoupWebRTC.is_main_video_webrtc = _mediasoupWebRTC.to_show_webrtc_video(peerId);
                    if(old != _mediasoupWebRTC.is_main_video_webrtc) {
                      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
                    }  
                  }
                }
              }

              consumer.on('pause', function() {
                consumer_pause_close();
              });
              consumer.on('close', function() {
                _mediasoupWebRTC.remoteVideoConsumer[peerId] = null;
                consumer_pause_close();
              });

              function consumer_pause_close() {
                var old;
                old = _mediasoupWebRTC.remoteVideoStream[peerId];
                _mediasoupWebRTC.remoteVideoStream[peerId] = null;
                if(old) {
                  $rootScope.$broadcast(hmtgHelper.WM_UPDATE_VIDEO_WINDOW); // to update webrtc video or canvas
                }
                var elem = document.getElementById('webrtc-video-' + peerId);
                if(elem) {
                  try {
                    elem.srcObject = null;
                  } catch(e) {
                    try {
                      elem.src = null;
                    } catch(e) { }
                  }
                }
                if(video_recving.main_video_ssrc == peerId) {
                  elem = document.getElementById('webrtc_main_video');
                  if(elem) {
                    try {
                      elem.srcObject = null;
                    } catch(e) {
                      try {
                        elem.src = null;
                      } catch(e) { }
                    }
                    old = _mediasoupWebRTC.is_main_video_webrtc;
                    _mediasoupWebRTC.is_main_video_webrtc = false;
                    if(old != _mediasoupWebRTC.is_main_video_webrtc) {
                      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
                    }  
                  }
                }
              }
            }
          })
          .catch(function(error) {
            console.log(
              'unexpected error while receiving a new Consumer:%o', error);
          });
      }
    }

    this.associateVideoStream = function() {
      for(var key in this.remoteVideoStream) {
        if(!this.remoteVideoStream.hasOwnProperty(key)) continue;
        var stream = this.remoteVideoStream[key];
        if(stream) {
          var elem = document.getElementById('webrtc-video-' + key);
          if(elem) {
            try {
              elem.srcObject = stream;
            } catch(e) {
              try {
                elem.src = URL.createObjectURL(stream);
              } catch(e) { }
            }
          }
        }
      }
    }

    this.findMainVideo = function() {
      var old;
      var elem = document.getElementById('webrtc_main_video');
      if(!elem) return;
      old = this.is_main_video_webrtc;
      var targetSsrc = video_recving.main_video_ssrc >> 0;
      for(var key in this.remoteVideoStream) {
        if(!this.remoteVideoStream.hasOwnProperty(key)) continue;
        if(key == targetSsrc) {
          try {
            if(elem.srcObject != this.remoteVideoStream[key]) {
              elem.srcObject = this.remoteVideoStream[key];
            }
          } catch(e) {
            try {
              elem.src = this.remoteVideoStream[key] ? URL.createObjectURL(this.remoteVideoStream[key]) : null;
            } catch(e) { }
          }
          this.is_main_video_webrtc = this.to_show_webrtc_video(key);
          //var stack = new Error().stack;
          //hmtg.util.log('******debug, flashing log, toggle ssrc ' + key + ' ' + this.is_main_video_webrtc + ', 300; stack=' + stack);

          return old != this.is_main_video_webrtc;
        }
      }
      try {
        elem.srcObject = null;
      } catch(e) {
        try {
          elem.src = null;
        } catch(e) { }
      }
      this.is_main_video_webrtc = false;
      return old != this.is_main_video_webrtc;
    }

    this.updateVideoSource = function() {
      var targetStream;
      if(this.use_imported_as_video) {
        targetStream = this.importedVideoStream;
        //hmtg.util.log(-2, 'webrtc, update video source to html5 video ' + (targetStream ? 'true' : "null"));
      } else if(this.use_screen_as_video) {
        targetStream = this.localScreenStream;
        //hmtg.util.log(-2, 'webrtc, update video source to screen video ' + (targetStream ? 'true' : "null"));
      } else {
        targetStream = this.localVideoStream;
        //hmtg.util.log(-2, 'webrtc, update video source to local video ' + (targetStream ? 'true' : "null"));
      }

      this.videoStream = targetStream;

      if(this.videoStream == this.activeVideoStream) {
        //hmtg.util.log(-2, 'webrtc, update video source, already active, skip starting');
        return;
      }
      this.startVideoSource();
    }

    this.startVideoSource = function() {
      if(!hmtg.jnkernel._jn_bConnected()
        || !hmtg.jnkernel.jn_info_CanSendVideo()  
        || !this.is_send_video
        || !this._room
        || !this._sendTransport
        || !this._room.canSend('video')
      ) {
        if(!this.videoStream) {
          if(this._videoProducer) {
            this.stopVideoSource();
          }
        }
        return;
      }
      if(!this.videoStream) {
        if(this._videoProducer) {
          this.stopVideoSource();
        }  
        return;
      }

      var track = this.videoStream.getVideoTracks()[0];
      if(!track) {
        if(this._videoProducer) {
          this.stopVideoSource();
        }  
        return;
      }
      hmtg.util.log('webrtc, start video source');
      _mediasoupWebRTC.lastCanSendVideo = true;
      this.activeVideoStream = this.videoStream;

      if(this.is_send_video) {
        this.video_producer_init_or_resume();
      }

      if(!this._videoProducer) {
        try {
          this._videoProducer = this._room.createProducer(
            track,
            (appSetting.webrtc_bandwidth_profile == 'low' ? null : { simulcast: this._useSimulcast }),
            // source is to be compatible with mediasoup-demo
            { source: 'webcam' }
          );

          // Send it.
          this._videoProducer.send(this._sendTransport);
          this._videoProducer.enableStats(3000);

          var stat_logged = false;
          this._videoProducer.on('stats', function(stats) { 
            _mediasoupWebRTC.videoStats = stats;
            _mediasoupWebRTC.videoStatsTick = hmtg.util.GetTickCount();
            if(!stat_logged) {
              if(stats.length && stats[0] && stats[0].bitrate) {
                stat_logged = true;
                if(_mediasoupWebRTC._videoProducer.rtpParameters
                  && _mediasoupWebRTC._videoProducer.rtpParameters.codecs
                  && _mediasoupWebRTC._videoProducer.rtpParameters.codecs[0]
                  && _mediasoupWebRTC._videoProducer.rtpParameters.codecs[0].name
                ) {
                  hmtg.util.log('stat, webrtc video codec ' + _mediasoupWebRTC._videoProducer.rtpParameters.codecs[0].name);
                }
                hmtg.util.log('stat, webrtc video sending bitrate ' + stats[0].bitrate);
              }
            }
            //console.log('video stats: %o', stats);
          })

          // get around receiver video size is 0 issue
          this.forceKeyFrame();

          //hmtg.util.log(-2, 'webrtc, create video producer ok');
        } catch(e) {
          hmtg.util.log('webrtc, create video producer fails: ' + JSON.stringify(e));
          _mediasoupWebRTC._videoProducer = null;
          _mediasoupWebRTC.stopKeyFrameOperation();
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_WEBRTC_ERROR_VIDEO_PRODUCER') + ' Error: ' + hmtgSound.getUserMediaError(e) }, 20);
        }
      } else {
        this._videoProducer.replaceTrack(track)
      }
    }

    this.stopVideoSource = function() {
      hmtg.util.log('webrtc, stop video source');

      this.activeVideoStream = null;
      this.video_producer_stop_or_pause();

      return Promise.resolve()
        .then(function(){
          _mediasoupWebRTC._videoProducer.close();
          _mediasoupWebRTC._videoProducer = null;
          _mediasoupWebRTC.stopKeyFrameOperation();
        })
        .catch(function(error) {
          console.log('close video producer | failed: %o', error);
        });
    }

    this.video_producer_init_or_resume = function()
    {
      var old = _mediasoupWebRTC.remoteVideoStream[_mediasoupWebRTC.displayName];
      _mediasoupWebRTC.remoteVideoStream[_mediasoupWebRTC.displayName] = this.activeVideoStream;
      _mediasoupWebRTC.remoteIsWebRTCVideo[_mediasoupWebRTC.displayName] = true;
      if(!old) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_VIDEO_WINDOW); // to update webrtc video or canvas
      }
      var elem = document.getElementById('webrtc-video-' + _mediasoupWebRTC.displayName);
      if(elem) {
        try {
          elem.srcObject = _mediasoupWebRTC.activeVideoStream;
        } catch(e) {
          try {
            elem.src = URL.createObjectURL(_mediasoupWebRTC.activeVideoStream);
          } catch(e) { }
        }
        elem.muted = true;
      }
      if(video_recving.main_video_ssrc == _mediasoupWebRTC.displayName) {
        elem = document.getElementById('webrtc_main_video');
        if(elem) {
          elem.muted = true;
          try {
            elem.srcObject = _mediasoupWebRTC.activeVideoStream;
          } catch(e) {
            try {
              elem.src = URL.createObjectURL(_mediasoupWebRTC.activeVideoStream);
            } catch(e) { }
          }
          var old = _mediasoupWebRTC.is_main_video_webrtc;
          _mediasoupWebRTC.is_main_video_webrtc = _mediasoupWebRTC.webrtcStatus == 4;
          if(old != _mediasoupWebRTC.is_main_video_webrtc) {
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
          }
        }
      }
    }

    this.video_producer_stop_or_pause = function() {
      var old;
      old = _mediasoupWebRTC.remoteVideoStream[_mediasoupWebRTC.displayName];
      _mediasoupWebRTC.remoteVideoStream[_mediasoupWebRTC.displayName] = null;
      if(old) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_VIDEO_WINDOW); // to update webrtc video or canvas
      }
      var elem = document.getElementById('webrtc-video-' + _mediasoupWebRTC.displayName);
      if(elem) {
        try {
          elem.srcObject = null;
        } catch(e) {
          try {
            elem.src = null;
          } catch(e) { }
        }
      }
      if(video_recving.main_video_ssrc == _mediasoupWebRTC.displayName) {
        elem = document.getElementById('webrtc_main_video');
        if(elem) {
          try {
            elem.srcObject = null;
          } catch(e) {
            try {
              elem.src = null;
            } catch(e) { }
          }
          old = _mediasoupWebRTC.is_main_video_webrtc;
          _mediasoupWebRTC.is_main_video_webrtc = false;
          if(old != _mediasoupWebRTC.is_main_video_webrtc) {
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
          }
        }
      }
    }

    this.updateVideoSending = function()
    {
      if(this.is_send_video) {
        if(this._videoProducer) {
          if(this._videoProducer.locallyPaused) {
            this._videoProducer.resume();
            hmtg.util.log('stat, webrtc, video sending resume');
            this.video_producer_init_or_resume();

            // get around receiver video size is 0 issue
            this.forceKeyFrame();
          }  
        } else {
          this.startVideoSource();
        }  
      } else {
        if(!this._videoProducer || this._videoProducer.locallyPaused) return;
        this._videoProducer.pause();
        hmtg.util.log('stat, webrtc, video sending pause');
        this.video_producer_stop_or_pause();
      }
    }  

    this.updateVideoRecving = function(isRecv) {
      for(var key in this.remoteVideoConsumer) {
        if(!this.remoteVideoConsumer.hasOwnProperty(key)) continue;
        var consumer = this.remoteVideoConsumer[key];
        if(consumer && consumer.kind === 'video') {
          isRecv ? consumer.resume() : consumer.pause();
        }
      }
    }

    this.startAudioSource = function() {
      if(!hmtg.jnkernel._jn_bConnected()) return;
      if(!hmtg.jnkernel._jn_bAudioCap()) return;
      if(!hmtg.jnkernel.jn_info_CanSendAudio()) return;
      if((!hmtgSound.shadowRecording || hmtgSound.record_muted)
        && (!joinnetTranscoding.audio_transcoding || joinnetTranscoding.transcoding_muted)) {
        return;
      }
      if(!this._room) return;
      if(!this._sendTransport) return;
      if(!this._room.canSend('audio')) return;
      if(!this.audioStream) {
        if(this._audioProducer) {
          this.stopAudioSource();
        }
        return;
      }

      var track = this.audioStream.getAudioTracks()[0];
      if(!track) {
        if(this._audioProducer) {
          this.stopAudioSource();
        }
        return;
      }
      hmtg.util.log('webrtc, start audio source');
      _mediasoupWebRTC.lastCanSendAudio = true;

      if(!this._audioProducer) {
        try {
          this._audioProducer = this._room.createProducer(
            track,
            null,
            // source is to be compatible with mediasoup-demo
            { source: 'mic' }
          );

          // Send it.
          this._audioProducer.send(this._sendTransport);
          this._audioProducer.enableStats(3000);

          var stat_logged = false;
          this._audioProducer.on('stats', function(stats) {
            _mediasoupWebRTC.audioStats = stats;
            _mediasoupWebRTC.audioStatsTick = hmtg.util.GetTickCount();
            if(!stat_logged) {
              if(stats.length && stats[0] && stats[0].bitrate) {
                stat_logged = true;
                if(_mediasoupWebRTC._audioProducer.rtpParameters
                  && _mediasoupWebRTC._audioProducer.rtpParameters.codecs
                  && _mediasoupWebRTC._audioProducer.rtpParameters.codecs[0]
                  && _mediasoupWebRTC._audioProducer.rtpParameters.codecs[0].name
                ) {
                  hmtg.util.log('stat, webrtc audio codec ' + _mediasoupWebRTC._audioProducer.rtpParameters.codecs[0].name);
                }
                hmtg.util.log('stat, webrtc audio sending bitrate ' + stats[0].bitrate);
              }
            }
            //console.log('audio stats: %o', stats);
          })

          //hmtg.util.log(-2, 'webrtc, create audio producer ok');
        } catch(e) {
          hmtg.util.log('webrtc, create audio producer fails: ' + JSON.stringify(e));
          this._audioProducer = null;  
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_WEBRTC_ERROR_AUDIO_PRODUCER') + ' Error: ' + hmtgSound.getUserMediaError(e) }, 20);
        }
      } else {
        this._audioProducer.replaceTrack(track)
      }
    }

    this.stopAudioSource = function() {
      hmtg.util.log('webrtc, stop audio source');

      return Promise.resolve()
        .then(function() {
          _mediasoupWebRTC._audioProducer.close();
          _mediasoupWebRTC._audioProducer = null;
        })
        .catch(function(error) {
          console.log('close audio producer | failed: %o', error);
        });
    }

    this.updateAudioSending = function() {
      if((!hmtgSound.shadowRecording || hmtgSound.record_muted)
        && (!joinnetTranscoding.audio_transcoding || joinnetTranscoding.transcoding_muted)) {
        if(!this._audioProducer || this._audioProducer.locallyPaused) return;
        this._audioProducer.pause();
        hmtg.util.log('stat, webrtc, audio sending pause');
      } else {
        if(this._audioProducer) {
          if(this._audioProducer.locallyPaused) {
            this._audioProducer.resume();
            hmtg.util.log('stat, webrtc, audio sending resume');
          }  
        } else {
          this.startAudioSource();
        }  
      }
    }

  }
])

;
