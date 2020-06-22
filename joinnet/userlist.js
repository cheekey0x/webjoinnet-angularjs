/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('qlist', [
  function () {
    // General rule set when the questioner's video is preferred:
    // 0) when there is no questioner, everyone display the token holder.
    // 1) when a new questioner start talking, everyone display this new questioner, except that the new questioner has no change.
    // 2) when entering the meeting or the current displayed video source becomes non-questioner, search from the last questioner toward the first questioner and then the token holder, 
    //   display the first one who is not self and is with video capability. 
    //   If no one found, the token holder display the last questioner(or token holder if there is no questioner) and the others display the token holder.

    var _qlist = this;
    this.list = [];
    this.default_ssrc = -1;
    this.removeQ = function (ssrc) {
      var idx = this.list.indexOf(ssrc);
      if(idx != -1) {
        this.list.splice(idx, 1);
      }
    }
    this.addQ = function (ssrc) {
      this.removeQ(ssrc);
      this.list.push(ssrc);
      if(ssrc != hmtg.jnkernel._jn_ssrc_index()) {
        this.default_ssrc = ssrc;
      }

      if(this.list.length > 20) {
        // remove non-questioners
        var i;
        for(i = this.list.length - 1; i >= 0; i--) {
          if(!hmtg.jnkernel.is_questioner(this.list[i])) {
            this.list.splice(i, 1);
          }
        }
      }
    }
    this.resetQ = function () {
      if(this.default_ssrc == -1 || !hmtg.jnkernel.is_questioner(this.default_ssrc)) {
        var i;
        var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
        for(i = this.list.length - 1; i >= 0; i--) {
          if(!hmtg.jnkernel.is_questioner(this.list[i])) {
            this.list.splice(i, 1);
          } else {
            var item = a[this.list[i]];
            if(!item) continue;
            if(item._cap() & 0x2) {
              this.default_ssrc = this.list[i];
              return;
            }
          }
        }
        var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
        if(ssrc_holder != -1) {
          var item = a[ssrc_holder];
          if(item && item._cap() & 0x2) {
            this.default_ssrc = ssrc_holder;
            return;
          }
        }
        if(!this.list.length) {
          this.default_ssrc = ssrc_holder;
          return;
        }
        if(ssrc_holder == hmtg.jnkernel._jn_ssrc_index()) {
          this.default_ssrc = this.list[this.list.length - 1];
          return;
        }
        this.default_ssrc = ssrc_holder;
      }
    }
  }
])

.service('userlist', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope', 'audio_capture', '$sce', 'hmtgSound', 'audio_playback',
  'video_bitrate', '$modal', 'hmtgAlert', 'video_recving', 'mediasoupWebRTC',
  function ($translate, appSetting, hmtgHelper, $rootScope, audio_capture, $sce, hmtgSound, audio_playback, video_bitrate,
    $modal, hmtgAlert, video_recving, mediasoupWebRTC) {
    var _userlist = this;
    // when restricted audio decoding is on, the questioner whose audio decoding is on will be shown higher!!
    this.user_list = [];  // user sorting: self, owner, assistant, controller, holder, questioner, pending-quesitioner, others; non-joinnet users immediately follow the base
    this.display_index = 0; // this first index to be displayed
    this.count = (appSetting.max_display_item >> 0);  // the count of items to be displayed
    this.menu_item = null;  // the user item that is showing the active menu
    this.selected_count = 0;
    this.is_meeting_mode = true;
    this.last_poll_tick = hmtg.util.GetTickCount() - 100000;
    this.have_poll_result = false;
    this.pending_count = 0; // how many pending questioner
    //this.has_action_menu = ''; // whether there is any context menu
    this.last_selected_item = null;

    var user_table = document.getElementById('userlist');
    /*
    user_table.addEventListener("scroll", function (evt) {
    hmtg.util.log(-2, '******debug, scroll, top=' + ('' + user_table.scrollTop) +  ',scroll_height=' + ('' + user_table.scrollHeight) + ',clientHeight=' + user_table.clientHeight);
    if(user_table.scrollTop == 0 && _userlist.can_scroll_up) {
    _userlist.scroll_up();
    $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    } else if(user_table.scrollTop + user_table.clientHeight == user_table.scrollHeight && _userlist.can_scroll_down) {
    _userlist.scroll_down();
    $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }
    }, true);
    */

    this.net_init_finished = function () {
      this.is_meeting_mode = hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL;
      if(this.is_meeting_mode) hmtg.jnkernel.jn_command_UpdateVideoSendingStatus(video_bitrate.is_send_video);

      var last_poll_tick = hmtg.util.GetTickCount() - 100000;
      if(last_poll_tick > this.last_poll_tick) this.last_poll_tick = last_poll_tick;
    }

    this.lang_changed = function () {
      this.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", this.selected_count);
      if(this.legend) {
        this.toggle_legend();
        this.toggle_legend();
      }
    }

    this.is_connected = function () {
      return hmtg.jnkernel._jn_bConnected();
    }

    this.reset = function () {
      var i;
      for(i = 0; i < this.user_list.length; i++) {
        if(this.user_list[i].lose_audio_cap_timerID) {
          clearTimeout(this.user_list[i].lose_audio_cap_timerID);
          this.user_list[i].lose_audio_cap_timerID = null;
        }
      }
      this.user_list = [];
      this.display_index = 0;
      this.selected_count = 0;
      this.selection_descr = '';
      this.is_meeting_mode = hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL;

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      if(this.pending_count) {
        this.pending_count = 0;
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
      }
    }

    // selection menu
    this.ontoggle = function (open) {
      _userlist.selection_menu = [];
      if(!open) {
        if(_userlist.has_action_menu == 'ul') _userlist.has_action_menu = '';
        return;
      }
      _userlist.has_action_menu = 'ul';

      var menu = _userlist.selection_menu;
      // prepare the menu for the selection
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      // prepare the menu for this user
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      if(questioner_controller == my_ssrc) {
        if(this.can_allow_selection()) {
          menu.push({ "text": $translate.instant('ID_ALLOW_QUESTION'), "onclick": _userlist.selectionAllowQuestion });
        }
        if(this.can_skip_selection()) {
          menu.push({ "text": $translate.instant('ID_SKIP_QUESTION'), "onclick": _userlist.selectionSkipQuestion });
        }
        if(this.can_end_selection()) {
          menu.push({ "text": $translate.instant('ID_END_QUESTION'), "onclick": _userlist.selectionEndQuestion });
        }
      }
      if(this.can_decode_selection()) {
        menu.push({ "text": $translate.instant('ID_ALLOW_DECODING'), "onclick": _userlist.selectionAllowDecoding });
      }
      if(hmtg.jnkernel._jn_bTokenOwner()) {
        if(this.can_disconnect_selection()) {
          menu.push({ "text": $translate.instant('ID_DISCONNECT_USER'), "onclick": _userlist.selectionDisconnectUser });
          menu.push({ "text": $translate.instant('ID_BAN_USER'), "onclick": _userlist.selectionBanUser });
        }
      }
      menu.push({ "text": $translate.instant('ID_RESET_SELECTION'), "onclick": _userlist.resetSelection });
    }

    // selection menu condition
    this.can_allow_selection = function () {
      // this one is the most difficult one
      // first check how many quesitoners are allowed
      var max = 1 + hmtg.jnkernel._jn_iMaxParticipantAudio();

      // count the selection, how many are questioners, how many are not
      var qc = 0;
      var nqc = 0;
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected) {
          if(user.guest_type) continue;
          if(!user.is_questioner()) {
            if(user.ssrc != my_ssrc) nqc++;
          } else {
            qc++;
          }
        }
      }

      if(!nqc) return false;  // no one to allow
      if(qc >= max) return false; // max are already allowed
      return true;
    }
    this.can_skip_selection = function () {
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected) {
          if(user.guest_type) continue;
          if(user.question_asked) return true;
        }
      }
      return false;
    }
    this.can_end_selection = function () {
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected) {
          if(user.guest_type) continue;
          if(user.is_questioner()) return true;
        }
      }
      return false;
    }
    this.can_disconnect_selection = function () {
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected) {
          if(user.guest_type) return true;
          if(user.ssrc != 0) return true;
        }
      }
      return false;
    }
    this.can_decode_selection = function () {
      if(!appSetting.restrict_audio_decoding) return false;
      if(!appSetting.max_audio_decoding) return false;

      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected) {
          if(user.guest_type) continue;
          if(!user.decoding) return true;
        }
      }
      return false;
    }

    this.can_ask_question = function () {
      var result = hmtg.jnkernel._jn_bConnected()
        && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
        && !hmtg.jnkernel.jn_info_IsTalker()
        && !hmtg.jnkernel._jn_bQuestionRequest()
        ;
      if(!result) return result;
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      return my_ssrc >= 0 && questioner_controller != my_ssrc;
    }

    this.can_end_question = function () {
      return (
        hmtg.jnkernel._jn_bConnected()
        && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
        && hmtg.jnkernel.is_questioner(hmtg.jnkernel._jn_ssrc_index())
        );
    }

    this.can_cancel_question = function () {
      return (
        hmtg.jnkernel._jn_bConnected()
        && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
        && hmtg.jnkernel._jn_bQuestionRequest()
        );
    }

    this.update_question_request_status = function () {
      var old = this.pending_count;
      this.pending_count = 0;
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.question_asked) {
          this.pending_count++;
        }
      }
      if(old != this.pending_count) {
        setTimeout(function () {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
        }, 0);
      }
    }

    this.alert_pending_questioner = function (ssrc, name) {
      var item = {};
      item['timeout'] = 5;
      item['update'] = function () { return $translate.instant('ID_REQUEST_TALK').replace('#name#', name) };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['need_ring'] = true;
      item['click'] = function (index) {
        var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
        var questioner_controller = hmtg.jnkernel._q_ssrc();

        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);

        if(questioner_controller == my_ssrc) {
          var index = _userlist.ssrc2index(ssrc);
          if(index != -1) {
            var user = _userlist.user_list[index];
            if(!user.is_questioner()) {
              _userlist.allowQuestion(user);
            }
          }
        }

        hmtgHelper.inside_angular--;
      };

      hmtgAlert.add_link_item(item);
    }


    // selection action
    this.selectionAllowQuestion = function () {
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      if(questioner_controller != hmtg.jnkernel._jn_ssrc_index()) return;

      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();

      // this one is the most difficult one
      // first check how many quesitoners are allowed
      var max = 1 + hmtg.jnkernel._jn_iMaxParticipantAudio();

      // count the selection, how many are questioners, how many are not
      var q_hash = {};  // hash to note existing selected questioners
      var nq_array = [];  // array to note existing selected non-questioners
      var qc = 0;
      var nqc = 0;
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected) {
          if(user.guest_type) continue;
          if(!user.is_questioner()) {
            if(user.ssrc != my_ssrc) {
              nq_array.push(user.ssrc);
              nqc++;
            }
          } else {
            q_hash[user.ssrc] = 1;
            qc++;
          }
        }
      }

      if(!nqc) return;  // no one to allow
      if(qc >= max) return; // max are already allowed
      if(hmtg.jnkernel._jn_iMaxParticipantAudio() <= 0) {
        // for this case, only one can be allowed
        hmtg.jnkernel.jn_command_AllowQuestion(nq_array[0]);
        return;
      }

      // only (max - qc) can be allowed
      // allow the first one
      var data_sender = hmtg.jnkernel._jn_iDataSender();
      var token_holder = hmtg.jnkernel._jn_iTokenHolder();
      if(data_sender < 0 || data_sender == token_holder) {
        hmtg.jnkernel.jn_command_AllowQuestion(nq_array[0]);
      } else {
        hmtg.jnkernel.jn_command_ParticipantVideoAssignSpeaker(nq_array[0]);
      }

      // allow the following ones, if there are any
      for(i = 1; i < max - qc && i < nqc; i++) {
        hmtg.jnkernel.jn_command_ParticipantVideoAssignSpeaker(nq_array[i]);
      }
    }
    this.selectionSkipQuestion = function () {
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      if(questioner_controller != hmtg.jnkernel._jn_ssrc_index()) return;

      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected && user.question_asked) {
          user.question_asked = false;
          hmtg.jnkernel.jn_command_SkipQuestion(user.ssrc);
        }
      }
      this.update_question_request_status();
    }
    this.selectionEndQuestion = function () {
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      if(questioner_controller != hmtg.jnkernel._jn_ssrc_index()) return;

      // a bit tricky here
      // use a flag to note whether the data sender is to be ended
      var has_data_sender = false;
      // use hash to remember which speaker is stopped
      var stop_hash = {};
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected && user.is_questioner()) {
          if(user.ssrc == hmtg.jnkernel._jn_iDataSender()) {
            has_data_sender = true;
          } else {
            hmtg.jnkernel.jn_command_ParticipantVideoStopSpeaker(user.ssrc)
            stop_hash[user.ssrc] = 1;
          }
        }
      }

      // now handle the data sender
      if(has_data_sender) {
        var done = false;
        var list = hmtg.jnkernel._jn_iParticipantAudioSsrc();
        for(var i = 0; i < list.length; i++) {
          if(list[i] != -1 && !stop_hash[list[i]]) {
            hmtg.jnkernel.jn_command_ParticipantVideoStopSpeaker(list[i]);
            hmtg.jnkernel.jn_command_AllowQuestion(list[i]);
            done = true;
            break;
          }
        }
        if(!done) { // if jn_command_AllowQuestion is called, no need to call endquestion any more
          hmtg.jnkernel.jn_command_EndQuestion();
        }
      }
    }
    this.selectionDisconnectUser = function () {
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected) {
          if(user.guest_type) {
            if(user.guest_type == 1) {
              hmtg.jnkernel.jn_command_sipclient_response(user.ssrc, hmtg.util.encodeUtf8(user.name), 3);  // kick out
            }
          } else if(user.ssrc != 0) {
            hmtg.jnkernel.jn_command_Disconnect(user.ssrc);
          }
        }
      }
    }
    this.selectionBanUser = function () {
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected) {
          if(user.guest_type) {
            if(user.guest_type == 1) {
              hmtg.jnkernel.jn_command_sipclient_response(user.ssrc, hmtg.util.encodeUtf8(user.name), 3);  // kick out
            }
          } else if(user.ssrc != 0) {
            hmtg.jnkernel.jn_command_Disconnect(user.ssrc);
            hmtg.jnkernel.jn_command_BanUserID(user.ssrc);
          }
        }
      }
    }
    this.selectionAllowDecoding = function () {
      if(!appSetting.restrict_audio_decoding) return;
      var now = hmtg.util.GetTickCount();
      for(var i = 0; i < _userlist.user_list.length; i++) {
        var user = _userlist.user_list[i];
        if(user.is_selected && !user.guest_type) {
          user.decoding_request_tick = now;
        }
      }
      _userlist.update_restricted_audio_decoding();
    }
    this.resetSelection = function () {
      for(var i = 0; i < _userlist.user_list.length; i++) {
        _userlist.user_list[i].is_selected = false;
      }
      _userlist.selected_count = 0;
      _userlist.selection_descr = '';
    }
    this.select_all = function () {
      _userlist.all_selected = false;
      for(var i = 0; i < _userlist.user_list.length; i++) {
        _userlist.user_list[i].is_selected = true;
      }
      _userlist.selected_count = _userlist.user_list.length;
      _userlist.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", _userlist.selected_count);
    }

    // user item
    // guest_type:
    // 0: joinnet user
    // 1: SIP user
    // 2: webrtc?
    function UserItem() {
    }

    // user menu
    UserItem.prototype.ontoggle = function (open) {
      var _user = this;
      this.menu = [];
      if(!open) {
        if(_userlist.has_action_menu == 'item') _userlist.has_action_menu = '';
        return;
      }
      var menu = this.menu;
      if(appSetting.restrict_audio_decoding && appSetting.max_audio_decoding && !_user.decoding && !_user.guest_type) {
        menu.push({ "text": $translate.instant('ID_ALLOW_DECODING'), "onclick": _userlist.allowDecoding });
      }
      if(!_userlist.is_meeting_mode) {
        if(!menu.length) {
          _user.dropdown_is_open = 0;
        }
        return;
      }
      // if there are multi-selection and this is a selected item
      // show nothing
      if(_user.is_selected && _userlist.selected_count > 0) {
        _user.dropdown_is_open = 0;
        return;
      }

      _userlist.menu_item = _user;
      _userlist.has_action_menu = 'item';
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      // prepare the menu for this user
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      var poll_controller = hmtg.jnkernel._poll_ssrc();
      var tab_controller = hmtg.jnkernel._tab_ssrc();
      if(questioner_controller == my_ssrc) {
        if(!this.is_questioner()) {
          if(this.ssrc != hmtg.jnkernel._jn_iTokenHolder() && !this.guest_type) {
            menu.push({ "text": $translate.instant('ID_ALLOW_QUESTION'), "onclick": _userlist.allowQuestion });
          }
          if(this.is_pending_questioner()) {
            menu.push({ "text": $translate.instant('ID_SKIP_QUESTION'), "onclick": _userlist.skipQuestion });
          }
        } else {
          menu.push({ "text": $translate.instant('ID_END_QUESTION'), "onclick": _userlist.endQuestion });
        }
      } else if(!hmtg.jnkernel._jn_bTokenHolder()) {
        if(hmtg.jnkernel.is_questioner(my_ssrc)) {
          menu.push({ "text": $translate.instant('ID_END_MY_QUESTION'), "onclick": _userlist.endQuestion });
        } else if(hmtg.jnkernel._jn_bQuestionRequest()) {
          menu.push({ "text": $translate.instant('ID_CANCEL_MY_QUESTION'), "onclick": _userlist.endQuestion });
        } else {
          menu.push({ "text": $translate.instant('ID_ASK_QUESTION'), "onclick": _userlist.askQuestion });
        }
      }
      if(appSetting.remote_monitor_mode && tab_controller == my_ssrc && this.ssrc != my_ssrc && (this.is_questioner() || this.is_holder())) {
        menu.push({ "text": $translate.instant('ID_REMOTE_MONITOR'), "onclick": _userlist.remoteMonitor });
      }
      if(hmtg.customization.support_presenter) {
        if(hmtg.jnkernel._jn_bTokenHolder()
          || my_ssrc == hmtg.jnkernel._jn_iController()
          || hmtg.jnkernel._jn_bTokenOwner()) {
          if(this.ssrc != hmtg.jnkernel._jn_iTokenHolder() && !this.guest_type) {
            menu.push({ "text": $translate.instant('ID_SET_CONTROLLER'), "onclick": _userlist.setController });
          }
          if(hmtg.jnkernel._jn_iController() != -1) {
            menu.push({ "text": $translate.instant('ID_RESET_CONTROLLER'), "onclick": _userlist.resetController });
          }
        }
      }  
      if(hmtg.jnkernel._jn_bTokenHolder()) {
        if(this.ssrc != hmtg.jnkernel._jn_iTokenHolder() && !this.guest_type) {
          menu.push({ "text": $translate.instant('ID_GIVEOUT_TOKEN'), "onclick": _userlist.giveoutToken });
        }
      }
      if(hmtg.jnkernel._jn_bTokenOwner() || my_ssrc == hmtg.jnkernel._jn_iAssistant()) {
        if(this.ssrc != 0 && this.ssrc != hmtg.jnkernel._jn_iAssistant() && !this.guest_type) {
          menu.push({ "text": $translate.instant('ID_ASSIGN_ASSISTANT'), "onclick": _userlist.assignAssistant });
        }
        if(-1 != hmtg.jnkernel._jn_iAssistant()) {
          menu.push({ "text": $translate.instant('ID_RESET_ASSISTANT'), "onclick": _userlist.resetAssistant });
        }
      }
      if(hmtg.jnkernel._jn_bTokenOwner() || my_ssrc == hmtg.jnkernel._jn_iAssistant()) {
        if(!hmtg.jnkernel._jn_bTokenHolder()) {
          menu.push({ "text": $translate.instant('ID_RETRIEVE_TOKEN'), "onclick": _userlist.retrieveToken });
        }
        if((this.ssrc != 0 && this.ssrc != my_ssrc) || this.guest_type) {
          menu.push({ "text": $translate.instant('ID_DISCONNECT_USER'), "onclick": _userlist.disconnectUser });
          menu.push({ "text": $translate.instant('ID_BAN_USER'), "onclick": _userlist.banUser });
        }
        menu.push({ "text": $translate.instant('ID_TERMINATE_MEETING'), "onclick": _userlist.terminateMeeting });
      }
      /*
      var this_user = hmtg.jnkernel._jn_UserArray()[this.ssrc];
      if(this.ssrc != my_ssrc
        && appSetting.show_advanced_function
        && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
        && mediasoupWebRTC.webrtcStatus == 4
        && this_user._m_iWebRTCStatus() == 4
        && mediasoupWebRTC.remoteIsWebRTCVideo[this.ssrc]
      ) {
        menu.push({ "text": "Use non-webrtc video (if WebRTC video doesn't display)", "onclick": _userlist.turnoffWebRTCVideo });
      }
      */
      if(poll_controller == my_ssrc && hmtg.util.GetTickCount() - _userlist.last_poll_tick > 50000) {
        menu.push({ "text": $translate.instant('ID_POLL'), "onclick": _userlist.poll });
      }
      if(hmtg.util.GetTickCount() - _userlist.last_poll_tick > 20000 && _userlist.have_poll_result) {
        menu.push({ "text": $translate.instant('ID_POLL_RESULT'), "onclick": _userlist.pollResult });
      }
      if(!menu.length) {
        _user.dropdown_is_open = 0;
        if(_userlist.has_action_menu == 'item') _userlist.has_action_menu = '';
      }
    }
    UserItem.prototype.is_owner = function () {
      return this.ssrc == 0 && !this.guest_type;
    }
    UserItem.prototype.is_assistant = function () {
      return this.ssrc == hmtg.jnkernel._jn_iAssistant() && !this.guest_type;
    }
    UserItem.prototype.is_controller = function () {
      return this.ssrc == hmtg.jnkernel._jn_iController() && !this.guest_type;
    }
    UserItem.prototype.is_holder = function () {
      return this.ssrc == hmtg.jnkernel._jn_iTokenHolder() && !this.guest_type;
    }
    UserItem.prototype.is_questioner = function () {
      return hmtg.jnkernel.is_questioner(this.ssrc) && !this.guest_type;
    }
    UserItem.prototype.is_pending_questioner = function () {
      return (this.question_asked || (hmtg.jnkernel._jn_bQuestionRequest() && this.ssrc != -1 && this.ssrc == hmtg.jnkernel._jn_ssrc_index())) && !this.guest_type;
    }
    UserItem.prototype.is_guest = function () {
      return !!this.guest_type;
    }

    // menu command
    this.giveoutToken = function (user) {
      //_userlist.menu_item = null;
      if(user.guest_type) return;
      if(user.ssrc == hmtg.jnkernel._jn_iController()) {
        // if the target is a controller, reset controller
        hmtg.jnkernel.jn_command_SetControlFlag(0);
        hmtg.jnkernel.jn_command_SetController(-1);
      }
      hmtg.jnkernel.jn_command_GiveoutToken2(user.ssrc);
    }
    this.retrieveToken = function () {
      //_userlist.menu_item = null;
      hmtg.jnkernel.jn_command_GiveoutToken2(hmtg.jnkernel._jn_ssrc_index());
    }
    this.setController = function (user) {
      //_userlist.menu_item = null;
      if(user.guest_type) return;
      $rootScope.$broadcast(hmtgHelper.WM_MEETING_CONTROL, user.ssrc);
    }
    this.resetController = function () {
      //_userlist.menu_item = null;
      hmtg.jnkernel.jn_command_SetControlFlag(0);
      hmtg.jnkernel.jn_command_SetController(-1);
    }
    this.assignAssistant = function (user) {
      //_userlist.menu_item = null;
      if(user.guest_type) return;
      hmtg.jnkernel.jn_command_AssignAssistant(user.ssrc);
    }
    this.resetAssistant = function () {
      //_userlist.menu_item = null;
      hmtg.jnkernel.jn_command_AssignAssistant(-1);
    }
    /*
    this.turnoffWebRTCVideo = function(user) {
      // turn off webrtc video, switch to mjpg
      mediasoupWebRTC.remoteIsWebRTCVideo[user.ssrc] = false;
      hmtg.jnkernel.jn_command_WebRTCMediaStatusNotification(1, user.ssrc, 0); // (type_video, source_ssrc, status)
    }
    */
    this.disconnectUser = function (user) {
      //_userlist.menu_item = null;
      if(user.guest_type) {
        if(user.guest_type == 1) {
          hmtg.jnkernel.jn_command_sipclient_response(user.ssrc, hmtg.util.encodeUtf8(user.name), 3);  // kick out
        }
      } else {
        hmtg.jnkernel.jn_command_Disconnect(user.ssrc);
      }
    }
    this.banUser = function (user) {
      //_userlist.menu_item = null;
      if(user.guest_type) {
        if(user.guest_type == 1) {
          hmtg.jnkernel.jn_command_sipclient_response(user.ssrc, hmtg.util.encodeUtf8(user.name), 3);  // kick out
        }
      } else {
        hmtg.jnkernel.jn_command_Disconnect(user.ssrc);
        hmtg.jnkernel.jn_command_BanUserID(user.ssrc);
      }
    }
    this.skipQuestion = function (user) {
      //_userlist.menu_item = null;
      if(user.guest_type) return;
      user.question_asked = false;
      hmtg.jnkernel.jn_command_SkipQuestion(user.ssrc);
      _userlist.update_question_request_status();
    }
    this.askQuestion = function () {
      //_userlist.menu_item = null;
      hmtg.jnkernel.jn_command_AskQuestion();
    }
    this.allowQuestion = function (user) {
      //_userlist.menu_item = null;

      if(user.guest_type) return;
      user.question_asked = false;
      _userlist._allow_question(user.ssrc);
      _userlist.update_question_request_status();
    }
    this._allow_question = function (ssrc) {
      if(ssrc == hmtg.jnkernel._jn_iTokenHolder()) return;

      if(hmtg.jnkernel._jn_iMaxParticipantAudio() <= 0) {
        hmtg.jnkernel.jn_command_AllowQuestion(ssrc);
      } else {
        var data_sender = hmtg.jnkernel._jn_iDataSender();
        var token_holder = hmtg.jnkernel._jn_iTokenHolder();
        if(data_sender < 0 || data_sender == token_holder) {
          hmtg.jnkernel.jn_command_AllowQuestion(ssrc);
        } else {
          //hmtg.jnkernel.jn_command_SkipQuestion(ssrc);  // for back compatibility. can be removed in future version
          hmtg.jnkernel.jn_command_ParticipantVideoAssignSpeaker(ssrc);
        }
      }
    }
    this.endQuestion = function (user) {
      //_userlist.menu_item = null;
      if(user.guest_type) return;
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      if(questioner_controller != -1 && questioner_controller == hmtg.jnkernel._jn_ssrc_index()) {
        if(user.is_questioner()) {
          if(user.ssrc == hmtg.jnkernel._jn_iDataSender()) {
            var done = false;
            var list = hmtg.jnkernel._jn_iParticipantAudioSsrc();
            for(var i = 0; i < list.length; i++) {
              if(list[i] != -1) {
                hmtg.jnkernel.jn_command_ParticipantVideoStopSpeaker(list[i]);
                hmtg.jnkernel.jn_command_AllowQuestion(list[i]);
                done = true;
                break;
              }
            }
            if(!done) { // if jn_command_AllowQuestion is called, no need to call endquestion any more
              hmtg.jnkernel.jn_command_EndQuestion();
            }
          } else {
            hmtg.jnkernel.jn_command_ParticipantVideoStopSpeaker(user.ssrc)
          }
        }
      } else {
        _userlist.endMyQuestion();
      }
    }

    this.remoteMonitor = function (user) {
      //_userlist.menu_item = null;
      if(user.guest_type) return;
      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_REMOTE_MONITOR, user.ssrc);
      hmtgHelper.inside_angular--;
    }

    this.endMyQuestion = function () {
      if(hmtg.jnkernel._jn_bQuestionRequest()) {
        hmtg.jnkernel.jn_command_EndQuestionRequest();
      } else if(hmtg.jnkernel.is_questioner(hmtg.jnkernel._jn_ssrc_index())) {
        if(hmtg.jnkernel._jn_ssrc_index() == hmtg.jnkernel._jn_iDataSender()) {
          hmtg.jnkernel.jn_command_EndQuestion();
        } else {
          hmtg.jnkernel.jn_command_ParticipantVideoStopSpeaker(hmtg.jnkernel._jn_ssrc_index())
        }
      }
    }

    this.terminateMeeting = function () {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_TERMINATE_MEETING_PROMPT'), 0, ok);
      function ok() {
        hmtg.jnkernel.jn_command_TerminateSession();
      }
    }

    this.poll = function () {
      var poll_controller = hmtg.jnkernel._poll_ssrc();
      if(poll_controller != -1 && poll_controller == hmtg.jnkernel._jn_ssrc_index() && hmtg.util.GetTickCount() - _userlist.last_poll_tick > 50000) {
        var i;
        for(i = 0; i < _userlist.user_list.length; i++) {
          _userlist.user_list[i].poll_result = '';
        }
        hmtg.jnkernel.jn_command_TokenHolderPoll();
        _userlist.last_poll_tick = hmtg.util.GetTickCount();
        _userlist.have_poll_result = false;
      }
    }

    this.pollResult = function () {
      var user_list = _userlist.user_list;
      var total = user_list.length;
      var responded = 0;
      var void_list = [];
      var result_array = [{ name: 1, count: 0, list: [] }, { name: 2, count: 0, list: [] }, { name: 3, count: 0, list: [] }, { name: 4, count: 0, list: [] }, { name: 5, count: 0, list: []}];
      var i, j;
      for(i = 0; i < user_list.length; i++) {
        if(user_list[i].guest_type) continue;
        if(user_list[i].poll_result) {
          responded++;
          result_array[user_list[i].poll_result - 1].count++;
          add_name(result_array[user_list[i].poll_result - 1].list, user_list[i].name);
        } else {
          add_name(void_list, user_list[i].name);
        }
      }
      if(responded) {
        for(i = 0; i < 5; i++) {
          result_array[i].percent = '' + ((((result_array[i].count / responded) * 1000) >> 0) / 10) + '%';
          result_array[i].text = '';
          for(j = 0; j < result_array[i].list.length; j++) {
            result_array[i].text += (j == 0 ? '' : ', ') + result_array[i].list[j];
          }
        }
      }
      var void_text = '';
      for(j = 0; j < void_list.length; j++) {
        void_text += (j == 0 ? '' : ', ') + void_list[j];
      }
      $rootScope.$broadcast(hmtgHelper.WM_POLL_RESULT, total, responded, result_array, void_text);

      function add_name(list, name) {
        var i;
        for(i = 0; i < list.length; i++) {
          if(name < list[i]) {
            list.splice(i, 0, name);
            return;
          }
        }
        list.push(name);
      }
    }

    this.allowDecoding = function (user) {
      user.decoding_request_tick = hmtg.util.GetTickCount();
      _userlist.update_restricted_audio_decoding();
    }

    this.ssrc2index = function (ssrc) {
      for(var i = 0; i < _userlist.user_list.length; i++) {
        if(_userlist.user_list[i].ssrc == ssrc && !_userlist.user_list[i].guest_type) {
          return i;
        }
      }
      return -1;
    }

    this.item2index = function (item) {
      for(var i = 0; i < _userlist.user_list.length; i++) {
        if(_userlist.user_list[i] == item) {
          return i;
        }
      }
      return -1;
    }

    // update display list
    this.update_display_list = function () {
      var max_item = this.count;
      var menu_index = -1;
      if(this.menu_item) menu_index = this.item2index(this.menu_item);
      // make sure the item with menu is included
      if(menu_index == -1) {
        this.menu_item = null;
      } else {
        var first = Math.max(0, Math.min(this.display_index, this.user_list.length - max_item));
        if(menu_index >= 0 && max_item < this.user_list.length) {
          var end = first + max_item;
          if(menu_index < first) {
            // shift view window upward to include the menu ssrc
            first = this.display_index = menu_index;
          } else if(menu_index >= end) {
            // shift view window downward to include the menu ssrc
            first = this.display_index = menu_index - (max_item - 1);
          }
        }

        if(menu_index >= 0) {
          // make sure the menu ssrc is visible by scrolling the window
          user_table.scrollTop = ((menu_index - first) / Math.max(1, Math.min(max_item, this.user_list.length)) * user_table.scrollHeight) >> 0;
        }
      }

      $rootScope.$broadcast(hmtgHelper.WM_COPY_USER_LIST);
    }

    this.scroll_up = function () {
      this.display_index = Math.min(this.display_index, this.user_list.length - this.count);
      this.display_index -= 1 + (this.count >> 1);
      if(this.display_index < 0) this.display_index = 0;

      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_COPY_USER_LIST);
      hmtgHelper.inside_angular--;
    }

    this.scroll_down = function () {
      this.display_index += 1 + (this.count >> 1);
      if(this.display_index + this.count > this.user_list.length) {
        this.display_index = this.user_list.length - this.count;
      }

      hmtgHelper.inside_angular++;
      $rootScope.$broadcast(hmtgHelper.WM_COPY_USER_LIST);
      hmtgHelper.inside_angular--;
    }

    this.compare_user = function (user1, user2) {
      var ssrc1 = user1.ssrc;
      var ssrc2 = user2.ssrc;

      if(ssrc1 == ssrc2) {
        if(user1.guest_type == user2.guest_type) {
          if(user1.name < user2.name) return -1;
          if(user1.name > user2.name) return 1;
          return 0;
        }
        return user1.guest_type - user2.guest_type;
      }

      if(user1.guest_type) {
        user1 = user1.base;
      }
      if(user2.guest_type) {
        user2 = user2.base;
      }

      // self
      if(ssrc1 == hmtg.jnkernel._jn_ssrc_index()) return -1;
      if(ssrc2 == hmtg.jnkernel._jn_ssrc_index()) return 1;

      // owner
      if(ssrc1 == 0) return -1;
      if(ssrc2 == 0) return 1;

      // assistant
      if(ssrc1 == hmtg.jnkernel._jn_iAssistant()) return -1;
      if(ssrc2 == hmtg.jnkernel._jn_iAssistant()) return 1;

      // controller
      if(ssrc1 == hmtg.jnkernel._jn_iController()) return -1;
      if(ssrc2 == hmtg.jnkernel._jn_iController()) return 1;

      // token holder
      if(ssrc1 == hmtg.jnkernel._jn_iTokenHolder()) return -1;
      if(ssrc2 == hmtg.jnkernel._jn_iTokenHolder()) return 1;

      // questioner
      if(hmtg.jnkernel.is_questioner(ssrc1)) {
        if(hmtg.jnkernel.is_questioner(ssrc2)) {
          if(user1.name < user2.name) return -1;
          if(user1.name > user2.name) return 1;
          return ssrc1 - ssrc2;
        } else {
          return -1;
        }
      } else if(hmtg.jnkernel.is_questioner(ssrc2)) {
        return 1;
      }

      // pending questioner
      if(user1.question_asked) {
        if(user2.question_asked) {
          if(user1.name < user2.name) return -1;
          if(user1.name > user2.name) return 1;
          return ssrc1 - ssrc2;
        } else {
          return -1;
        }
      } else if(user2.question_asked) {
        return 1;
      }

      if(user1.name < user2.name) return -1;
      if(user1.name > user2.name) return 1;
      return ssrc1 - ssrc2;
    }

    this.sort_user = function () {
      // insertion sorting, simple and good for nearly sorted array
      var i, j;
      for(i = 1; i < this.user_list.length; i++) {
        var x = this.user_list[i];
        j = i;
        while(j > 0 && this.compare_user(this.user_list[j - 1], x) > 0) {
          this.user_list[j] = this.user_list[j - 1];
          j--;
        }
        if(i != j) this.user_list[j] = x;
      }
    }

    this.user_status_changed = function () {
      this.sort_user();
      if(_userlist.menu_item) {
        this.update_display_list();
      }
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }

    this.user_selected = function (user, e) {
      if(user.is_selected) {
        this.selected_count++;
        _userlist.menu_item = user;
      } else {
        this.selected_count--;
      }
      if(e.shiftKey && this.last_selected_item && this.last_selected_item != user) {
        var last_idx = this.user_list.indexOf(this.last_selected_item);
        if(last_idx != -1) {
          var i;
          var this_idx = this.user_list.indexOf(user);
          var from = last_idx;
          var to = this_idx;
          if(from > to) {
            to = from;
            from = this_idx;
          }
          var item2;
          for(i = from; i <= to; i++) {
            if(i == this_idx) continue;
            item2 = this.user_list[i];
            if(user.is_selected && !item2.is_selected) {
              item2.is_selected = true;
              this.selected_count++;
            }
            if(!user.is_selected && item2.is_selected) {
              item2.is_selected = false;
              this.selected_count--;
            }
          }
        }
      }
      this.last_selected_item = user;
      this.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", this.selected_count);
    }

    this.refresh_user = function() {
      _userlist.user_list.length = 0;
      var user_list = _userlist.user_list;
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      for(var ssrc in a) {
        if(!a.hasOwnProperty(ssrc)) continue;
        var item = a[ssrc];
        if(!item) continue;
        if(!item._bLogged()) continue;
        var user = new UserItem();
        user.ssrc_str = user.ssrc = ssrc;
        user.name = hmtg.util.decodeUtf8(item._szRealName());
        user.audio = (item._cap() & 0x1) ? true : false;
        user.video = (item._cap() & 0x2) ? true : false;
        user.video_sending = item._m_iVideoSendingStatus();
        user.slide = 0;
        user.webrtc_status = 0;
        user.decoding = true; // for GUI only.

        user_list.push(user);
      }

      this.sort_user();

      this.update_display_list();

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }

    this.add_user = function (ssrc) {
      var user_list = _userlist.user_list;
      var user = new UserItem();
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var item = a[ssrc];
      if(!item) return;
      user.ssrc_str = user.ssrc = ssrc;
      user.name = hmtg.util.decodeUtf8(item._szRealName());
      user.audio = (item._cap() & 0x1) ? true : false;
      user.video = (item._cap() & 0x2) ? true : false;
      user.slide = 0;
      // 0: not used; glyphicon-remove
      // 1: error in connection; glyphicon-warning-sign
      // 2: signal connected with no ice probe yet or probing; glyphicon-search
      // 3: signal connected with failed ice; glyphicon-ban-circle
      // 4: signal connected with good ice; glyphicon-ok
      user.webrtc_status = 0;
      if(this.poll_slide_index != -1
        && (hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_bTokenHolder())) {
        var slide_array = hmtg.jnkernel._jn_SlideArray();
        if(slide_array[this.poll_slide_index] && slide_array[this.poll_slide_index]._is_blank_page()) {
          user.slide = hmtg.config.SLIDE_DOWNLOAD_STATUS_DOWNLOADED;
        }
      }
      user.decoding = true; // for GUI only.

      user_list.push(user);
      this.sort_user();

      this.update_display_list();

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);

      if(hmtg.jnkernel._jn_bTokenOwner() && this.is_meeting_mode && user_list.length == 2 && appSetting.meetintg_idle_mode) {
        $rootScope.$broadcast(hmtgHelper.WM_IDLE_MODE, 2);
      }
    }

    this.delete_user = function (ssrc) {
      var user_list = _userlist.user_list;
      var found = false;
      for(var i = this.user_list.length - 1; i >= 0; i--) {
        if(user_list[i].ssrc == ssrc && user_list[i].guest_type) {
          user_list.splice(i, 1);
          found = true;
        }
      }

      for(var i = 0; i < this.user_list.length; i++) {
        if(user_list[i].ssrc == ssrc) {
          if(user_list[i].is_selected) {
            this.selected_count--;
            this.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", this.selected_count);
          }
          if(user_list[i].question_asked) {
            this.pending_count--;
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_JOINNET);
          }
          if(user_list[i].lose_audio_cap_timerID) {
            clearTimeout(user_list[i].lose_audio_cap_timerID);
            user_list[i].lose_audio_cap_timerID = null;
          }
          user_list.splice(i, 1);
          found = true;

          break;
        }
      }

      if(found) {
        _userlist.update_display_list();
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);

        if(hmtg.jnkernel._jn_bTokenOwner() && this.is_meeting_mode && user_list.length == 1 && appSetting.meetintg_idle_mode) {
          $rootScope.$broadcast(hmtgHelper.WM_IDLE_MODE, 1);
        }
      }
    }

    this.add_sip_user = function (ssrc, uri) {
      var user_list = _userlist.user_list;
      var user = new UserItem();
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var item = a[ssrc];
      if(!item) return;
      var i;
      var base;
      for(i = 0; i < user_list.length; i++) {
        if(user_list[i].ssrc == ssrc && !user_list[i].guest_type) {
          base = user_list[i];
          break;
        }
      }
      if(!base) return;
      user.base = base;
      user.ssrc = ssrc;
      user.ssrc_str = 'SIP';
      user.name = hmtg.util.decodeUtf8(uri);
      user.guest_type = 1;

      user_list.push(user);
      this.sort_user();

      this.update_display_list();

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);

      if(hmtg.jnkernel._jn_bTokenOwner() && this.is_meeting_mode && user_list.length == 2 && appSetting.meetintg_idle_mode) {
        $rootScope.$broadcast(hmtgHelper.WM_IDLE_MODE, 2);
      }
    }

    this.delete_sip_user = function (ssrc, uri) {
      var user_list = _userlist.user_list;
      var found = false;
      var target = hmtg.util.decodeUtf8(uri);
      for(var i = this.user_list.length - 1; i >= 0; i--) {
        if(user_list[i].ssrc == ssrc && user_list[i].guest_type == 1 && user_list[i].name == target) {
          user_list.splice(i, 1);
          found = true;
        }
      }

      if(found) {
        _userlist.update_display_list();
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);

        if(hmtg.jnkernel._jn_bTokenOwner() && this.is_meeting_mode && user_list.length == 1 && appSetting.meetintg_idle_mode) {
          $rootScope.$broadcast(hmtgHelper.WM_IDLE_MODE, 1);
        }
      }
    }

    this.transfer_sip_user = function (ssrc, uri, uri2) {
      var user_list = _userlist.user_list;
      var found = false;
      var target = hmtg.util.decodeUtf8(uri);
      for(var i = this.user_list.length - 1; i >= 0; i--) {
        if(user_list[i].ssrc == ssrc && user_list[i].guest_type == 1 && user_list[i].name == target) {
          user_list[i].name = hmtg.util.decodeUtf8(uri2);
          found = true;
        }
      }

      if(found) {
        _userlist.update_display_list();
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      }
    }

    this.callback_AddQuestion = function (ssrc) {
      var index = this.ssrc2index(ssrc);
      if(index == -1) return;
      var user = this.user_list[index];
      if(user.is_questioner()) return;
      if(appSetting.auto_allow_question) {
        user.question_asked = false;
        this._allow_question(ssrc);
      } else {
        if(user.is_pending_questioner()) return;
        user.question_asked = true;
        this.alert_pending_questioner(ssrc, user.name);
      }
      this.update_question_request_status();
      this.user_status_changed();
    }

    this.callback_CancelQuestion = function (ssrc) {
      var index = this.ssrc2index(ssrc);
      if(index == -1) return;
      var user = this.user_list[index];
      if(user.question_asked) {
        user.question_asked = false;
        this.update_question_request_status();
        this.user_status_changed();
      }
    }

    this.callback_NewTokenHolder = function (old_token_holder, old_data_sender) {
      this.update_restricted_audio_decoding();
      if(!this.is_meeting_mode) return;

      if(hmtg.jnkernel._jn_bTokenHolder() && hmtg.jnkernel._jn_iController() == hmtg.jnkernel._jn_ssrc_index()) {
        // if I am also the controller, reset controller
        hmtg.jnkernel.jn_command_SetControlFlag(0);
        hmtg.jnkernel.jn_command_SetController(-1);
      }

      var new_holder = hmtg.jnkernel._jn_iTokenHolder();

      if(hmtg.jnkernel._jn_bTokenHolder()) {
        // if the new token holder is a speaker, stop it
        if(hmtg.jnkernel.is_speaker(new_holder)) {
          hmtg.util.log('stop speaker ' + new_holder + ', which is the new token holder');
          hmtg.jnkernel.jn_command_ParticipantVideoStopSpeaker(new_holder);
        }
      }

      var questioner_controller = hmtg.jnkernel._q_ssrc();
      if(questioner_controller != hmtg.jnkernel._jn_ssrc_index()) {
        // clear pending questioner
        var changed = false;
        for(var i = 0; i < this.user_list.length; i++) {
          if(this.user_list[i].question_asked) {
            this.user_list[i].question_asked = false;
            changed = true;
          }
        }
        if(changed) this.update_question_request_status();
      } else {
        // if the old token holder is valid and is not the same as the new holder, allow question
        if(old_token_holder >= 0 && old_token_holder != new_holder) {
          hmtg.util.log('set old token holder ' + old_token_holder + ' to data sender');
          hmtg.jnkernel.jn_command_AllowQuestion(old_token_holder);
          // if the old data sender is valid and is not the same as the new and old holder, assign speaker
          if(old_data_sender >= 0 && old_data_sender != old_token_holder && old_data_sender != new_holder) {
            hmtg.util.log('set old data sender ' + old_data_sender + ' to speaker');
            hmtg.jnkernel.jn_command_ParticipantVideoAssignSpeaker(old_data_sender);
          }
        } else if(old_data_sender >= 0 && old_data_sender != new_holder) {
          // old token holder is skipped, but old data sender is valid
          hmtg.util.log('set(old token holder skipped) old data sender ' + old_data_sender + ' to data sender');
          hmtg.jnkernel.jn_command_AllowQuestion(old_data_sender);
        } else {
          // if there is no data sender, but there is speaker, change one of the speakers to datasender
          var ssrc = hmtg.jnkernel._jn_iDataSender();
          if(ssrc < 0 || ssrc == new_holder) {
            var list = hmtg.jnkernel._jn_iParticipantAudioSsrc();
            for(var i = 0; i < list.length; i++) {
              if(list[i] != -1) {
                hmtg.util.log('change speaker ' + list[i] + ' to data sender on token update');
                hmtg.jnkernel.jn_command_ParticipantVideoStopSpeaker(list[i]);
                hmtg.jnkernel.jn_command_AllowQuestion(list[i]);
                break;
              }
            }
          }
        }
      }
    }

    this.callback_ControllerStatusChanged = function () {
      if(!this.is_meeting_mode) return;
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      if(questioner_controller != hmtg.jnkernel._jn_ssrc_index()) {
        // clear pending questioner
        var changed = false;
        for(var i = 0; i < this.user_list.length; i++) {
          if(this.user_list[i].question_asked) {
            this.user_list[i].question_asked = false;
            changed = true;
          }
        }
        if(changed) this.update_question_request_status();
      } else {
        // clear pending question request
        if(hmtg.jnkernel._jn_bQuestionRequest()) {
          hmtg.jnkernel.jn_command_EndQuestionRequest();
        }
      }
    }

    this.callback_NewDataSender = function () {
      this.update_restricted_audio_decoding();
      if(!this.is_meeting_mode) return;

      var ssrc = hmtg.jnkernel._jn_iDataSender();
      var index = this.ssrc2index(ssrc);
      if(index != -1) {
        var user = this.user_list[index];
        if(user.question_asked) {
          user.question_asked = false;
          this.update_question_request_status();
        }
      }

      if(hmtg.jnkernel._jn_bDataSender()) {
        // if the new data sender is a speaker, stop it
        if(!hmtg.jnkernel._jn_bTokenHolder() && hmtg.jnkernel.is_speaker(ssrc)) {
          hmtg.util.log('stop speaker ' + ssrc + ', which is the new data sender');
          hmtg.jnkernel.jn_command_ParticipantVideoStopSpeaker(ssrc);
        }
      }
    }

    this.callback_ParticipantVideoSpeakerStatus = function (ssrc, status, channel) {
      this.update_restricted_audio_decoding();
      if(!this.is_meeting_mode) return;

      if(status) {
        var index = this.ssrc2index(ssrc);
        if(index == -1) return;
        var user = this.user_list[index];
        if(user.question_asked) {
          user.question_asked = false;
          this.update_question_request_status();
        }
      }
    }

    this.update_restricted_audio_decoding = function () {
      if(!appSetting.restrict_audio_decoding) return;
      if(this.update_restricted_audio_decoding_timerID) return;
      this.update_restricted_audio_decoding_timerID = setTimeout(function () {
        _userlist.update_restricted_audio_decoding_timerID = null;
        if(!appSetting.restrict_audio_decoding) return;
        var i;
        for(i = 0; i < _userlist.user_list.length; i++) {
          _userlist.user_list[i].decoding = false;
        }
        for(var ssrc in audio_playback.audio_playback_array) {
          if(audio_playback.audio_playback_array[ssrc]) {
            audio_playback.audio_playback_array[ssrc].decoding = false;
          }
        }
        // sort all the talkers
        var talker_index = [];
        var i;
        for(i = 0; i < _userlist.user_list.length; i++) {
          var user = _userlist.user_list[i];
          var ssrc = user.ssrc;
          if(user.guest_type) continue;
          if(ssrc == hmtg.jnkernel._jn_ssrc_index()
            || !audio_playback.audio_playback_array[ssrc]
            || !audio_playback.audio_playback_array[ssrc].type
            || audio_playback.audio_playback_array[ssrc].type == hmtg.config.AUDIO_G711
            || audio_playback.audio_playback_array[ssrc].type == hmtg.config.AUDIO_G711_11
          ) {
            // this only apply to user_list, but not to audio_playback.
            // it is for control panel display only
            _userlist.user_list[i].decoding = true;
            continue;
          }
          if(ssrc == hmtg.jnkernel._jn_iTokenHolder() || hmtg.jnkernel.is_questioner(ssrc)) {
            // add to talker index
            var j;
            for(j = 0; j < talker_index.length; j++) {
              if(_userlist.compare_decoding_talker(i, talker_index[j]) < 0) {
                break;
              }
            }
            talker_index.splice(j, 0, i);
          } else {
            // this only apply to user_list, but not to audio_playback.
            // it is for control panel display only
            _userlist.user_list[i].decoding = true;
          }
        }

        // set decoding 
        for(i = 0; i < talker_index.length && i < appSetting.max_audio_decoding; i++) {
          _userlist.user_list[talker_index[i]].decoding = true;
          var ssrc = _userlist.user_list[talker_index[i]].ssrc;
          if(audio_playback.audio_playback_array[ssrc]) {
            audio_playback.audio_playback_array[ssrc].decoding = true;
          }
        }

        // update GUI
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      }, 1000);
    }

    this.compare_decoding_talker = function (idx1, idx2) {
      // sorting: ascending
      // if idx1 should appear idx2, return negative
      // otherwise, return positive
      var user1 = this.user_list[idx1];
      var user2 = this.user_list[idx2];

      if(hmtg.customization.restricted_audio_decoding_prefer_controller) {
        // controller
        if(user1.ssrc == hmtg.jnkernel._jn_iController()) return -1;
        if(user2.ssrc == hmtg.jnkernel._jn_iController()) return 1;
      }

      // tick
      if(typeof user1.decoding_request_tick === 'undefined') {
        if(typeof user2.decoding_request_tick === 'undefined') {
        } else {
          return 1;
        }
      } else {
        if(typeof user2.decoding_request_tick === 'undefined') {
          return -1;
        } else if(user1.decoding_request_tick == user2.decoding_request_tick) {
        } else {
          return user2.decoding_request_tick - user1.decoding_request_tick;
        }
      }

      // controller
      if(user1.ssrc == hmtg.jnkernel._jn_iController()) return -1;
      if(user2.ssrc == hmtg.jnkernel._jn_iController()) return 1;

      // token holder
      if(user1.ssrc == hmtg.jnkernel._jn_iTokenHolder()) return -1;
      if(user2.ssrc == hmtg.jnkernel._jn_iTokenHolder()) return 1;

      if(user1.name < user2.name) return -1;
      if(user1.name > user2.name) return 1;

      return user1.ssrc - user2.ssrc;
    }

    this.callback_ChangeCapability = function (ssrc, a, v) {
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var item = a[ssrc];
      if(!item) return;

      var user_list = _userlist.user_list;
      var i;
      for(i = 0; i < user_list.length; i++) {
        if(user_list[i].ssrc == ssrc && !user_list[i].guest_type) {
          var old_audio_cap = user_list[i].audio;
          user_list[i].audio = (item._cap() & 0x1) ? true : false;
          user_list[i].video = (item._cap() & 0x2) ? true : false;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);

          var this_user = user_list[i];
          if(user_list[i].audio) {
            if(user_list[i].lose_audio_cap_timerID) {
              clearTimeout(user_list[i].lose_audio_cap_timerID);
              user_list[i].lose_audio_cap_timerID = null;
            }
          } else if(old_audio_cap
            && ssrc != hmtg.jnkernel._jn_ssrc_index() && hmtg.jnkernel.is_talker(ssrc)) {
            if(user_list[i].lose_audio_cap_timerID) {
              clearTimeout(user_list[i].lose_audio_cap_timerID);
            }
            user_list[i].lose_audio_cap_timerID = setTimeout(function () {
              this_user.lose_audio_cap_timerID = null;
              if(-1 == user_list.indexOf(this_user)) return;
              if(hmtg.jnkernel._jn_bConnected() && !(item._cap() & 0x1) && hmtg.jnkernel.is_talker(ssrc)) {
                var myname = this_user.name;
                hmtgSound.ShowErrorPrompt(function () { return $translate.instant('ID_LOSE_AUDIO_CAP').replace('#user#', myname) }, 20);
              }
            }, 5000);
          }
          break;
        }
      }
    }

    this.callback_VideoSendingStatusNotification = function (ssrc) {
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var item = a[ssrc];
      if(!item) return;

      var user_list = _userlist.user_list;
      var i;
      for(i = 0; i < user_list.length; i++) {
        if(user_list[i].ssrc == ssrc && !user_list[i].guest_type) {
          user_list[i].video_sending = item._m_iVideoSendingStatus();
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
          break;
        }
      }
    }

    this.callback_WebRTCStatusNotification = function(ssrc) {
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var item = a[ssrc];
      if(!item) return;

      var to_update = false;
      if(video_recving.main_video_ssrc >= 0) {
        // the webrtc status may affect which video window to show in the main window
        if(ssrc == video_recving.main_video_ssrc || ssrc == hmtg.jnkernel._jn_ssrc_index()) {
          mediasoupWebRTC.is_main_video_webrtc = mediasoupWebRTC.to_show_webrtc_video(video_recving.main_video_ssrc);
          to_update = true;
        }
      }

      var user_list = _userlist.user_list;
      var i;
      for(i = 0; i < user_list.length; i++) {
        if(user_list[i].ssrc == ssrc && !user_list[i].guest_type) {
          user_list[i].webrtc_status = item._m_iWebRTCStatus();
          to_update = true;
          break;
        }
      }

      if(to_update) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      }

      if(ssrc == hmtg.jnkernel._jn_ssrc_index() || hmtg.jnkernel.jn_info_IsTalker(ssrc)) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_VIDEO_WINDOW); // to update webrtc video or canvas
      }
    }

    this.callback_AddPollResult = function (ssrc, pollResult) {
      var poll_result = pollResult >> 0;
      if(poll_result < 1 || poll_result > 5) return;

      var user_list = _userlist.user_list;
      var i;
      for(i = 0; i < user_list.length; i++) {
        if(user_list[i].ssrc == ssrc && !user_list[i].guest_type) {
          user_list[i].poll_result = '' + poll_result;
          _userlist.have_poll_result = true;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
          break;
        }
      }
    }

    this.callback_ResetSlidePolling = function (index) {
      this.poll_slide_index = index;
      var user_list = _userlist.user_list;
      var i;
      var need_update = false;
      for(i = 0; i < user_list.length; i++) {
        if(user_list[i].slide) need_update = true;
        user_list[i].slide = 0;
      }
      if(need_update) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      }
    }

    this.callback_PollSlideDownloadResult = function (result_ssrc, slide_index, result) {
      if(slide_index != this.poll_slide_index) return;
      var user_list = _userlist.user_list;
      var i;
      for(i = 0; i < user_list.length; i++) {
        if(user_list[i].ssrc == result_ssrc && !user_list[i].guest_type) {
          user_list[i].slide = result;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
          break;
        }
      }
    }

    this.toggle_legend = function () {
      if(this.legend) {
        hmtg.util.localStorage['hmtg_user_legend'] = JSON.stringify(false);
        this.legend = '';
      } else {
        hmtg.util.localStorage['hmtg_user_legend'] = JSON.stringify(true);
        var html = '' + $translate.instant('ID_LEGEND') + ':';
        html += ' <span class="user-owner">' + $translate.instant('ID_LEGEND_OWNER') + '</span>'
        html += ', <span class="user-assistant">' + $translate.instant('ID_LEGEND_ASSISTANT') + '</span>'
        if(hmtg.customization.support_presenter) {
          html += ', <span class="user-controller">' + $translate.instant('ID_LEGEND_CONTROLLER') + '</span>'
        }  
        html += ', <span class="user-holder">' + $translate.instant('ID_LEGEND_HOLDER') + '</span>'
        html += ', <span class="user-questioner">' + $translate.instant('ID_LEGEND_QUESTIONER') + '</span>'
        html += ', <span class="user-pending-questioner">' + $translate.instant('ID_LEGEND_PENDING_QUESTIONER') + '</span>'
        html += ', <span class="user-guest">' + $translate.instant('ID_NON_JOINNET_USER') + '</span>'
        this.legend = $sce.trustAsHtml(html);
      }
    }
    var show_legend = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_user_legend']);
    show_legend = show_legend === 'undefined' ? false : !!show_legend;
    if(show_legend)
      this.toggle_legend();

  }
])

.service('main_video_canvas', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope',
  function ($translate, appSetting, hmtgHelper, $rootScope) {
    var _main_video_canvas = this;
    this.canvas = document.getElementById('main_video');
    this.ctx = this.canvas.getContext('2d');
    this.video_ssrc = -1;
    this.video_ssrc2 = -1;
    this.is_video_ssrc_by_user = false;
    this.is_video_ssrc2_by_user = false;
    var parsed;
    parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_video_display_size']);
    this.display_size = parsed === 'undefined' ? 240 : Math.max(160, Math.min(640, parsed));
    this.is_fullscreen = false;
    this.draw_size = []; // w,h, draw size of 1st video
    this.draw_size2 = []; // draw size of 2nd video
    this.draw_x = 0;
    this.draw_y = 0;  // top-left corner of 1st video
    this.draw_x2 = 0;
    this.draw_y2 = 0; // top-left corner of 2nd video

    this.overlap_two_video = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_overlap_two_video']);
    this.overlap_two_video = this.overlap_two_video === 'undefined' ?
    (Math.min(hmtgHelper.view_port_width, hmtgHelper.view_port_height) > 600 ? false : true)
    :
    !!this.overlap_two_video;
    //this.overlap_two_video = false;

    $rootScope.$on('$translateChangeEnd', function () {
      populate_size_list();
    });
    function populate_size_list() {
      _main_video_canvas.size_list = [
        { value: 160, name: $translate.instant('ID_TEXT_SIZE_SMALLEST') },
        { value: 240, name: $translate.instant('ID_TEXT_SIZE_SMALLER') },
        { value: 320, name: $translate.instant('ID_TEXT_SIZE_MEDIUM') },
        { value: 480, name: $translate.instant('ID_TEXT_SIZE_LARGER') },
        { value: 640, name: $translate.instant('ID_TEXT_SIZE_LARGEST') }
      ];
    }
    populate_size_list();

    this.change_display_size = function () {
      this.draw_video();
    }

    this.draw_video = function() {
      if($rootScope.gui_mode == 'concise') {
        this.overlap_two_video = true;
      }
      if(this.overlap_two_video) {
        this.calc_canvas_size();
      } else {
        this.calc_canvas_size2();
      }
      if(this.canvas.width == 0) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if(this.canvas_orig && this.canvas_orig.width)
        this.ctx.drawImage(this.canvas_orig, 0, 0, this.canvas_orig.width, this.canvas_orig.height, this.draw_x, this.draw_y, this.draw_size[0], this.draw_size[1]);
      if(this.canvas_orig2 && this.canvas_orig2.width)
        this.ctx.drawImage(this.canvas_orig2, 0, 0, this.canvas_orig2.width, this.canvas_orig2.height, this.draw_x2, this.draw_y2, this.draw_size2[0], this.draw_size2[1]);
    }

    // overlap video
    this.calc_draw_size = function (video_w, video_h, draw_size, is_alt_video) {
      var w, h;
      if(this.is_fullscreen || $rootScope.gui_mode == 'concise') {
        w = hmtgHelper.view_port_width;
        h = (w * video_h / video_w) >> 0;
        if(h > hmtgHelper.view_port_height) {
          h = hmtgHelper.view_port_height;
          w = (h * video_w / video_h) >> 0;
        }
      } else {
        var display_size = this.display_size >> 0;
        if(video_h > video_w) {
          h = display_size;
          w = (h * video_w / video_h) >> 0;
        } else {
          w = display_size;
          h = (w * video_h / video_w) >> 0;
        }
      }
      if(is_alt_video) {
        w = (w / 5) >> 0;
        h = (h / 5) >> 0;
      }
      if(w < 20) w = 20;
      if(h < 20) h = 20;
      draw_size[0] = w;
      draw_size[1] = h;
    }

    this.calc_canvas_size = function () {
      if(!this.canvas_orig || !this.canvas_orig.width) this.draw_size[0] = 0, this.draw_size[1] = 0;
      else this.calc_draw_size(this.canvas_orig.width, this.canvas_orig.height, this.draw_size, false);

      if(!this.canvas_orig2 || !this.canvas_orig2.width) this.draw_size2[0] = 0, this.draw_size2[1] = 0;
      else this.calc_draw_size(this.canvas_orig2.width, this.canvas_orig2.height, this.draw_size2, true);

      this.draw_x = this.draw_y = 0;

      var w, h;
      if(this.is_fullscreen || $rootScope.gui_mode == 'concise') {
        if(this.draw_size[0] + this.draw_size2[0] >= hmtgHelper.view_port_width) {
          w = hmtgHelper.view_port_width;
          this.draw_x2 = w - this.draw_size2[0];
        } else {
          if(this.draw_size2[0]) {
            this.draw_size2[0] = hmtgHelper.view_port_width - this.draw_size[0];
            this.draw_size2[1] = (this.draw_size2[0] * this.canvas_orig2.height / this.canvas_orig2.width) >> 0;
            if(this.draw_size2[1] > hmtgHelper.view_port_height) {
              this.draw_size2[1] = hmtgHelper.view_port_height;
              this.draw_size2[0] = (this.draw_size2[1] * this.canvas_orig2.width / this.canvas_orig2.height) >> 0;
            }
          }
          w = this.draw_size[0] + this.draw_size2[0];
          this.draw_x2 = this.draw_size[0];
        }

        if(this.draw_size[1] + this.draw_size2[1] >= hmtgHelper.view_port_height) {
          h = hmtgHelper.view_port_height;
          this.draw_y2 = h - this.draw_size2[1];
        } else {
          if(this.draw_size2[1]) {
            this.draw_size2[1] = hmtgHelper.view_port_height - this.draw_size[1];
            this.draw_size2[0] = (this.draw_size2[1] * this.canvas_orig2.width / this.canvas_orig2.height) >> 0;
            if(this.draw_size2[0] > hmtgHelper.view_port_width) {
              this.draw_size2[0] = hmtgHelper.view_port_width;
              this.draw_size2[1] = (this.draw_size2[0] * this.canvas_orig2.height / this.canvas_orig2.width) >> 0;
            }
          }
          h = this.draw_size[1] + this.draw_size2[1];
          this.draw_y2 = this.draw_size[1];
          this.draw_x2 = w - this.draw_size2[0];
        }
      } else {
        var display_size = this.display_size >> 0;
        var view_width = Math.max(this.draw_size[0], this.draw_size2[0], (display_size >> 1));
        if(this.draw_size[0] + this.draw_size2[0] >= view_width) {
          w = view_width;
          this.draw_x2 = w - this.draw_size2[0];
        } else {
          w = this.draw_size[0] + this.draw_size2[0];
          this.draw_x2 = this.draw_size[0];
        }
        var view_height = Math.max(this.draw_size[1], this.draw_size2[1], (display_size >> 1));
        if(this.draw_size[1] + this.draw_size2[1] >= view_height) {
          h = view_height;
          this.draw_y2 = h - this.draw_size2[1];
        } else {
          h = this.draw_size[1] + this.draw_size2[1];
          this.draw_y2 = this.draw_size[1];
        }
      }

      if(this.canvas.width != w || this.canvas.height != h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }

    // equal video size
    this.calc_draw_size2 = function (video_w, video_h, draw_size) {
      var w, h;
      if(this.is_fullscreen || $rootScope.gui_mode == 'concise') {
        w = hmtgHelper.view_port_width;
        h = (w * video_h / video_w) >> 0;
        if(h > hmtgHelper.view_port_height) {
          h = hmtgHelper.view_port_height;
          w = (h * video_w / video_h) >> 0;
        }
      } else {
        var display_size = this.display_size >> 0;
        if(video_h > video_w) {
          h = display_size;
          w = (h * video_w / video_h) >> 0;
        } else {
          w = display_size;
          h = (w * video_h / video_w) >> 0;
        }
      }
      if(w < 20) w = 20;
      if(h < 20) h = 20;
      draw_size[0] = w;
      draw_size[1] = h;
    }

    this.calc_canvas_size2 = function () {
      var w, h;

      this.draw_x = this.draw_y = 0;

      if(!this.canvas_orig || !this.canvas_orig.width) {
        this.draw_size[0] = 0, this.draw_size[1] = 0;
        if(!this.canvas_orig2 || !this.canvas_orig2.width) {
          this.draw_size2[0] = 0, this.draw_size2[1] = 0;
          w = h = 0;
        } else {
          this.calc_draw_size2(this.canvas_orig2.width, this.canvas_orig2.height, this.draw_size2);
          this.draw_x2 = this.draw_y2 = 0;
          w = this.draw_size2[0];
          h = this.draw_size2[1];
        }
        if(this.canvas.width != w || this.canvas.height != h) {
          this.canvas.width = w;
          this.canvas.height = h;
        }
        return;
      } else if(!this.canvas_orig2 || !this.canvas_orig2.width) {
        this.draw_size2[0] = 0, this.draw_size2[1] = 0;
        this.calc_draw_size2(this.canvas_orig.width, this.canvas_orig.height, this.draw_size);
        w = this.draw_size[0];
        h = this.draw_size[1];
        if(this.canvas.width != w || this.canvas.height != h) {
          this.canvas.width = w;
          this.canvas.height = h;
        }
        return;
      }

      var total_w;
      var total_h;
      if(this.is_fullscreen || $rootScope.gui_mode == 'concise') {
        total_w = hmtgHelper.view_port_width;
        total_h = hmtgHelper.view_port_height;
      } else {
        total_w = total_h = this.display_size >> 0;
      }

      var cx1 = this.canvas_orig.width > this.canvas_orig.height ? 1.0 : this.canvas_orig.width / this.canvas_orig.height;
      var cx2 = this.canvas_orig2.width > this.canvas_orig2.height ? 1.0 : this.canvas_orig2.width / this.canvas_orig2.height;
      var cy1 = this.canvas_orig.width > this.canvas_orig.height ? this.canvas_orig.height / this.canvas_orig.width : 1.0;
      var cy2 = this.canvas_orig2.width > this.canvas_orig2.height ? this.canvas_orig2.height / this.canvas_orig2.width : 1.0;
      // side by side horizontally
      // sum_w = x * (cx1 + cx2);
      // sum_h = x * max(cy1, cy2);
      this.calc_draw_size2(cx1 + cx2, Math.max(cy1, cy2), this.draw_size);
      var size_x = (this.draw_size[0] / (cx1 + cx2)) >> 0;

      // side by side vertically
      // sum_w = y * max(cx1, cx2);
      // sum_h = y * (cy1 + cy2);
      this.calc_draw_size2(Math.max(cx1, cx2), cy1 + cy2, this.draw_size2);
      var size_y = (this.draw_size2[1] / (cy1 + cy2)) >> 0;

      if(size_x > size_y || (size_x == size_y && hmtgHelper.view_port_width >= hmtgHelper.view_port_height)) {
        this.draw_size[0] = (size_x * cx1) >> 0;
        this.draw_size[1] = (size_x * cy1) >> 0;
        this.draw_size2[0] = (size_x * cx2) >> 0;
        this.draw_size2[1] = (size_x * cy2) >> 0;
        if(this.draw_size[0] + this.draw_size2[0] >= total_w) {
          w = total_w;
        } else {
          w = this.draw_size[0] + this.draw_size2[0];
        }
        this.draw_x2 = w - this.draw_size2[0];
        h = Math.max(this.draw_size[1], this.draw_size2[1]);
        this.draw_y = (h - this.draw_size[1]) >> 1;
        this.draw_y2 = (h - this.draw_size2[1]) >> 1;
      } else {
        this.draw_size[0] = (size_y * cx1) >> 0;
        this.draw_size[1] = (size_y * cy1) >> 0;
        this.draw_size2[0] = (size_y * cx2) >> 0;
        this.draw_size2[1] = (size_y * cy2) >> 0;
        if(this.draw_size[1] + this.draw_size2[1] >= total_h) {
          h = total_h;
        } else {
          h = this.draw_size[1] + this.draw_size2[1];
        }
        this.draw_y2 = h - this.draw_size2[1];
        w = Math.max(this.draw_size[0], this.draw_size2[0]);
        this.draw_x = (w - this.draw_size[0]) >> 1;
        this.draw_x2 = (w - this.draw_size2[0]) >> 1;
      }

      if(this.canvas.width != w || this.canvas.height != h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }

  }
])

.service('main_video', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope', 'main_video_canvas', 'video_recving', 'board', 'qlist',
  'mediasoupWebRTC',
  function ($translate, appSetting, hmtgHelper, $rootScope, main_video_canvas, video_recving, board, qlist,
    mediasoupWebRTC) {
    var _main_video = this;
    this.video_element = document.getElementById('main_video_container');
    // -1: auto select; -2: do not show; -3: camera view; -4: screen capture; -5: imported video; -6: SIP
    this.main_video_userlist = [{ ssrc: -1, name: $translate.instant('ID_AUTO_SELECT') }, { ssrc: -2, name: $translate.instant('ID_NO_SHOW')}];
    this.main_video_userlist2 = [{ ssrc: -1, name: $translate.instant('ID_AUTO_SELECT') }, { ssrc: -2, name: $translate.instant('ID_NO_SHOW')}];
    this.show_snapshot = function () {
      return mediasoupWebRTC.is_main_video_webrtc
      || (main_video_canvas.canvas_orig && main_video_canvas.canvas_orig.width);
    };
    this.is_fit_page = true;
    this.default_video_ssrc = -1;


    main_video_canvas.is_fullscreen = false;
    this.request_fullscreen = this.video_element.requestFullscreen
      || this.video_element.msRequestFullscreen
      || this.video_element.mozRequestFullScreen
      || this.video_element.webkitRequestFullscreen
      ;
    this.fullscreen_element = null;

    this.fullscreen1 = function() {
      this.fullscreen_element = document.getElementById(mediasoupWebRTC.is_main_video_webrtc ? 'webrtc_main_video' : 'main_video');
      if(this.request_fullscreen) {
        hmtgHelper.inside_angular++;
        this.request_fullscreen.call(this.fullscreen_element);
        hmtgHelper.inside_angular--;
        var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

        main_video_canvas.is_fullscreen = fullscreenElement == this.fullscreen_element;
        main_video_canvas.change_display_size();
      }
    }

    this.fullscreen0 = function () {
      hmtgHelper.inside_angular++;
      hmtgHelper.exitFullScreen();
      hmtgHelper.inside_angular--;
      main_video_canvas.is_fullscreen = false;
      main_video_canvas.change_display_size();
    }

    this.event_quit_session = function () {
      _main_video.update_user_list();

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }

    this.restart = function () {
      _main_video.update_user_list();

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }

    this.delete_user = function (ssrc) {
      var found = false;
      var i;
      for(i = 0; i < this.main_video_userlist.length; i++) {
        if(ssrc == this.main_video_userlist[i].ssrc) {
          found = true;
          break;
        }
      }
      found = false;
      for(i = 0; i < this.main_video_userlist2.length; i++) {
        if(ssrc == this.main_video_userlist2[i].ssrc) {
          found = true;
          break;
        }
      }
    }

    this.is_ssrc_in_list = function (ssrc, userlist) {
      var i;
      for(i = 0; i < userlist.length; i++) {
        if(ssrc == userlist[i].ssrc) return true;
      }
      return false;
    }

    this.update_user_list = function () {
      // whenever the userlist is updated, should make sure the ng-model value (here it is video_recving.main_video_ssrc)
      // is a valid value from the list. 
      // this ng-model value update must be before the digest
      // otherwise, there will appear an empty item, whose id is 'undefined'
      var found = this.calc_main_video_list();
      if(!found[0]) {
        var s = this.get_video_default_ssrc();
        video_recving.main_video_ssrc = main_video_canvas.video_ssrc = this.is_ssrc_in_list(s, this.main_video_userlist) ? s : -1;
        if(video_recving.main_video_ssrc >= 0) {
          mediasoupWebRTC.findMainVideo();
        }        
      }
      var deselect_ssrc2 = -1;
      if(!video_recving.show_2nd_video) video_recving.main_video_ssrc2 = -2;
      else if(video_recving.main_video_ssrc == -2) {
        video_recving.main_video_ssrc2 = -2;
      } else if(!found[1]) {
        var s = this.get_video_default_ssrc2();
        video_recving.main_video_ssrc2 = main_video_canvas.video_ssrc2 = this.is_ssrc_in_list(s, this.main_video_userlist2) ? s : -1;
      }
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
    }

    this.get_video_default_ssrc = function () {
      if(this.default_video_ssrc != -1 && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.PLAYBACK) {
        if(!hmtg.jnkernel.is_talker(this.default_video_ssrc)) {
          this.default_video_ssrc = -1;
        } else {
          return this.default_video_ssrc;
        }
      }
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
      var ssrc_sender = hmtg.jnkernel._jn_iDataSender();
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();

      // to determin which user to show at the main window

      // non-webrtc's choice
      var choice1 = qlist.default_ssrc;
      var choice2 = (questioner_controller != ssrc_holder && hmtg.jnkernel.is_questioner(questioner_controller)) ? questioner_controller : ssrc_holder;
      var old_choice = appSetting.prefer_questioner ? choice1 : choice2;

      // if we are not using webrtc, return the old choice
      if(mediasoupWebRTC.webrtc_status != 4) {
        return old_choice;
      }

      // if the old choice is not using webrtc, return it
      // otherwise, there is no chance this user is to be displayed
      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var item = a[old_choice];
      if(item && item._m_iWebRTCStatus() != 4) {
        return old_choice;
      }

      // obtain the webrtc active speaker
      // if there is an active speaker, and it is not me and it is also a talker
      // return the webrtc active speaker
      if(1
        //|| appSetting.prefer_active_speaker
      ) {
        var active_speaker = parseInt(mediasoupWebRTC._activeSpeaker, 10);
        if(!isNaN(active_speaker) && my_ssrc != active_speaker && hmtg.jnkernel.is_talker(active_speaker)) {
          return active_speaker;
        }
      }

      // if reaching here, just return the old choice
      return old_choice;

      /*
      if(ssrc_sender != -1 && ssrc_sender != ssrc_holder) {
      if(appSetting.prefer_questioner) return ssrc_sender == my_ssrc ? ssrc_holder : ssrc_sender;
      else return ssrc_holder == my_ssrc ? ssrc_sender : ssrc_holder;
      }
      return ssrc_holder;
      */
    }

    this.get_video_default_ssrc2 = function () {
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
      var ssrc_sender = hmtg.jnkernel._jn_iDataSender();
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();

      var choice1 = qlist.default_ssrc;
      var choice2 = (questioner_controller != ssrc_holder && hmtg.jnkernel.is_questioner(questioner_controller)) ? questioner_controller : ssrc_holder;
      if(this.default_video_ssrc != -1 && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.PLAYBACK) {
        if(hmtg.jnkernel.is_talker(this.default_video_ssrc)) {
          if(choice1 != this.default_video_ssrc) return choice1;
          if(choice2 != this.default_video_ssrc) return choice2;
          if(ssrc_sender != this.default_video_ssrc) return ssrc_sender;
          return -1;
        }
      }
      if(choice1 == choice2) {
        if(ssrc_sender != choice1) return ssrc_sender;
        if(my_ssrc != choice1) return my_ssrc;
        return -1;
      }
      return !appSetting.prefer_questioner ? choice1 : choice2;

      /*
      if(ssrc_sender != -1 && ssrc_sender != ssrc_holder) {
      if(appSetting.prefer_questioner) return ssrc_sender == my_ssrc ? ssrc_sender : ssrc_holder;
      else return ssrc_holder == my_ssrc ? ssrc_holder : ssrc_sender;
      }
      return -1;
      */
    }

    this.calc_main_video_list = function () {
      this.main_video_userlist = [{ ssrc: -1, name: $translate.instant('ID_AUTO_SELECT') }, { ssrc: -2, name: $translate.instant('ID_NO_SHOW')}];
      this.main_video_userlist2 = [{ ssrc: -1, name: $translate.instant('ID_AUTO_SELECT') }, { ssrc: -2, name: $translate.instant('ID_NO_SHOW')}];
      var old_ssrc = video_recving.main_video_ssrc >> 0;
      if(!main_video_canvas.is_video_ssrc_by_user) {
        old_ssrc = -1;
      }
      var old_ssrc2 = video_recving.main_video_ssrc2 >> 0;
      if(!main_video_canvas.is_video_ssrc2_by_user) {
        old_ssrc2 = -1;
      }
      var old_ssrc_found = old_ssrc == -2;
      var old_ssrc2_found = old_ssrc2 == -2;
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      var questioner_controller = hmtg.jnkernel._q_ssrc();
      var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
      var ssrc_sender = hmtg.jnkernel._jn_iDataSender();
      var hash = {};
      if(video_recving.has_local_camera) {
        if(-3 == old_ssrc) old_ssrc_found = true;
        this.main_video_userlist.push({ ssrc: -3, name: $translate.instant('ID_CAMERA_VIEW') });
        if(video_recving.show_2nd_video) {
          if(-3 == old_ssrc2) old_ssrc2_found = true;
          this.main_video_userlist2.push({ ssrc: -3, name: $translate.instant('ID_CAMERA_VIEW') });
        }
      }
      if(video_recving.has_local_screen) {
        if(-4 == old_ssrc) old_ssrc_found = true;
        this.main_video_userlist.push({ ssrc: -4, name: $translate.instant('ID_CAPTURED_SCREEN') });
        if(video_recving.show_2nd_video) {
          if(-4 == old_ssrc2) old_ssrc2_found = true;
          this.main_video_userlist2.push({ ssrc: -4, name: $translate.instant('ID_CAPTURED_SCREEN') });
        }
      }
      if(video_recving.has_local_import) {
        if(-5 == old_ssrc) old_ssrc_found = true;
        this.main_video_userlist.push({ ssrc: -5, name: $translate.instant('ID_IMPORTED_VIDEO') });
        if(video_recving.show_2nd_video) {
          if(-5 == old_ssrc2) old_ssrc2_found = true;
          this.main_video_userlist2.push({ ssrc: -5, name: $translate.instant('ID_IMPORTED_VIDEO') });
        }
      }

      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      if(hmtg.jnkernel._jn_bConnected()) {
        if(ssrc_holder != -1) {
          if(ssrc_holder == old_ssrc) old_ssrc_found = true;
          if(ssrc_holder == old_ssrc2) old_ssrc2_found = true;
          this.main_video_userlist.push({ ssrc: '' + ssrc_holder, name: hmtg.util.decodeUtf8(a[ssrc_holder] ? a[ssrc_holder]._szRealName() : ('ssrc' + ssrc_holder)) });
          if(video_recving.show_2nd_video)
            this.main_video_userlist2.push({ ssrc: '' + ssrc_holder, name: hmtg.util.decodeUtf8(a[ssrc_holder] ? a[ssrc_holder]._szRealName() : ('ssrc' + ssrc_holder)) });
          hash[ssrc_holder] = true;
        }

        var start_idx = this.main_video_userlist.length;
        var start_idx2 = this.main_video_userlist2.length;
        if(ssrc_sender != -1 && ssrc_sender != ssrc_holder) {
          if(ssrc_sender == old_ssrc) old_ssrc_found = true;
          if(ssrc_sender == old_ssrc2) old_ssrc2_found = true;
          this.userlist_insert(this.main_video_userlist, start_idx, { ssrc: '' + ssrc_sender, name: hmtg.util.decodeUtf8(a[ssrc_sender] ? a[ssrc_sender]._szRealName() : ('ssrc' + ssrc_sender)) });
          if(video_recving.show_2nd_video)
            this.userlist_insert(this.main_video_userlist2, start_idx2, { ssrc: '' + ssrc_sender, name: hmtg.util.decodeUtf8(a[ssrc_sender] ? a[ssrc_sender]._szRealName() : ('ssrc' + ssrc_sender)) });
          hash[ssrc_sender] = true;
        }

        var list = hmtg.jnkernel._jn_iParticipantAudioSsrc();
        var i;
        for(i = 0; i < list.length; i++) {
          if(list[i] != -1 && !hash[list[i]]) {
            if(list[i] == old_ssrc) old_ssrc_found = true;
            if(list[i] == old_ssrc2) old_ssrc2_found = true;
            this.userlist_insert(this.main_video_userlist, start_idx, { ssrc: '' + list[i], name: hmtg.util.decodeUtf8(a[list[i]] ? a[list[i]]._szRealName() : ('ssrc' + list[i])) });
            if(video_recving.show_2nd_video)
              this.userlist_insert(this.main_video_userlist2, start_idx2, { ssrc: '' + list[i], name: hmtg.util.decodeUtf8(a[list[i]] ? a[list[i]]._szRealName() : ('ssrc' + list[i])) });
            hash[list[i]] = true;
          }
        }
      }
      return [old_ssrc_found, old_ssrc2_found];
    }

    this.userlist_insert = function (userlist, start_idx, item) {
      var i;
      for(i = start_idx; i < userlist.length; i++) {
        if(item.name < userlist[i].name) {
          break;
        }
      }

      userlist.splice(i, 0, item);
    }

    this.main_video_ssrc_changed = function (new_ssrc, old_ssrc) {
      main_video_canvas.video_ssrc = video_recving.main_video_ssrc >> 0;
      var changed = mediasoupWebRTC.findMainVideo();
      main_video_canvas.is_video_ssrc_by_user = video_recving.main_video_ssrc != -1 && video_recving.main_video_ssrc != this.get_video_default_ssrc();
      main_video_canvas.canvas.width = main_video_canvas.canvas.height = 0;
      var old = main_video_canvas.canvas_orig;
      main_video_canvas.canvas_orig = null;
      if(changed || old) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST); // to update ng-show of snapshot button
      }
      if(video_recving.main_video_ssrc == video_recving.main_video_ssrc2) main_video_canvas.canvas_orig2 = null;

      if(video_recving.main_video_ssrc2 != -2 && video_recving.main_video_ssrc == -2) {
        video_recving.main_video_ssrc2 = -2;
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      }
      this.deselect_video_ssrc(old_ssrc >> 0);
      this.select_video_ssrc(new_ssrc >> 0);

      if(main_video_canvas.video_ssrc >= 0 || main_video_canvas.video_ssrc2 >= 0 || video_recving.ssrc_array.length) {
        if(main_video_canvas.turnon_mypicture_interval) main_video_canvas.turnon_mypicture_interval();
      } else {
        if(main_video_canvas.turnoff_mypicture_interval) main_video_canvas.turnoff_mypicture_interval();
      }
    }

    this.main_video_ssrc2_changed = function (new_ssrc, old_ssrc) {
      main_video_canvas.video_ssrc2 = video_recving.main_video_ssrc2 >> 0;
      main_video_canvas.is_video_ssrc2_by_user = video_recving.main_video_ssrc2 != -1 && video_recving.main_video_ssrc2 != this.get_video_default_ssrc2();
      main_video_canvas.canvas.width = main_video_canvas.canvas.height = 0;
      main_video_canvas.canvas_orig2 = null;

      if(video_recving.main_video_ssrc2 != -2 && video_recving.main_video_ssrc == -2) {
        video_recving.main_video_ssrc = video_recving.main_video_ssrc2;
        mediasoupWebRTC.findMainVideo();
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_USERLIST);
      }
      this.deselect_video_ssrc(old_ssrc >> 0);
      this.select_video_ssrc(new_ssrc >> 0);

      if(main_video_canvas.video_ssrc >= 0 || main_video_canvas.video_ssrc2 >= 0 || video_recving.ssrc_array.length) {
        if(main_video_canvas.turnon_mypicture_interval) main_video_canvas.turnon_mypicture_interval();
      } else {
        if(main_video_canvas.turnoff_mypicture_interval) main_video_canvas.turnoff_mypicture_interval();
      }
    }

    this.deselect_video_ssrc = function (ssrc) {
      if(ssrc < 0) return;
      if(!video_recving.is_recv_video) return;

      var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
      var ssrc_sender = hmtg.jnkernel._jn_iDataSender();

      if(ssrc == ssrc_holder || ssrc == ssrc_sender) {
        video_recving.update_holder_sender_video_recv_status();
      } else {
        if(!video_recving.is_selected_video_ssrc(ssrc)) {
          hmtg.jnkernel.jn_command_ParticipantVideoStop(ssrc);
        }
      }
    }

    this.select_video_ssrc = function(ssrc) {
      if(ssrc == -1) {
        // if the user choose auto select, pick the default target immediately
        this.update_user_list();
        return;
      }
      if(ssrc < 0) return;
      if(!video_recving.is_recv_video) return;

      var ssrc_holder = hmtg.jnkernel._jn_iTokenHolder();
      var ssrc_sender = hmtg.jnkernel._jn_iDataSender();

      if(ssrc == ssrc_holder || ssrc == ssrc_sender) {
        video_recving.update_holder_sender_video_recv_status();
      } else if(hmtg.jnkernel.is_speaker(ssrc)) {
        // only request to subscribe video when the user is a speaker
        hmtg.jnkernel.jn_command_ParticipantVideoRequest(ssrc);
      }
    }

    this.lang_changed = function () {
      var i;
      var item;
      for(i = 0; i < this.main_video_userlist.length; i++) {
        item = this.main_video_userlist[i];
        if(item.ssrc == -1) item.name = $translate.instant('ID_AUTO_SELECT');
        else if(item.ssrc == -2) item.name = $translate.instant('ID_NO_SHOW');
        else if(item.ssrc == -3) item.name = $translate.instant('ID_CAMERA_VIEW');
        else if(item.ssrc == -4) item.name = $translate.instant('ID_CAPTURED_SCREEN');
        else break;
      }
      for(i = 0; i < this.main_video_userlist2.length; i++) {
        item = this.main_video_userlist2[i];
        if(item.ssrc == -1) item.name = $translate.instant('ID_AUTO_SELECT');
        else if(item.ssrc == -2) item.name = $translate.instant('ID_NO_SHOW');
        else if(item.ssrc == -3) item.name = $translate.instant('ID_CAMERA_VIEW');
        else if(item.ssrc == -4) item.name = $translate.instant('ID_CAPTURED_SCREEN');
        else break;
      }

    }
  }
])

.controller('UserListCtrl', ['$scope', 'userlist', 'hmtgHelper', '$translate', 'JoinNet', 'audio_codec',
  'audio_capture', 'main_video', 'main_video_canvas',
  'video_codec', 'video_bitrate', 'video_capture', 'video_recving', '$modal', 'appSetting', '$rootScope',
  'joinnetTranscoding', 'joinnetVideo', 'playback', 'mediasoupWebRTC', 'layout',
  function ($scope, userlist, hmtgHelper, $translate, JoinNet, audio_codec,
    audio_capture, main_video, main_video_canvas, video_codec, video_bitrate,
    video_capture, video_recving, $modal, appSetting, $rootScope, joinnetTranscoding, joinnetVideo,
    playback, mediasoupWebRTC, layout) {
    $scope.a = audio_codec;
    $scope.m = main_video;
    $scope.m2 = main_video_canvas;
    $scope.v = video_codec;
    $scope.v2 = video_bitrate;
    $scope.vr = video_recving;
    $scope.ul = userlist;
    $scope.as = appSetting;
    $scope.jt = joinnetTranscoding;
    $scope.jv = joinnetVideo;
    $scope.jn = JoinNet;
    $scope.rtc = mediasoupWebRTC;
    $scope.lo = layout;
    $scope.jnk = hmtg.jnkernel;


    $scope.is_concise_mode = function() {
      return $rootScope.gui_mode == 'concise';
    }

    $scope.style_main_video_container = function() {
      return $rootScope.gui_mode == 'concise' ? {'overflow': 'hidden'} : {'padding-top': '1px'};
    }

    $scope.class_main_canvas = function() {
      return $rootScope.gui_mode == 'concise' ? 'center' : '';
    }

    $scope.update_webrtc_main_video_size = function() {
      if($rootScope.gui_mode == 'concise') {
        $scope.style_webrtc_main_video =
          {
            'overflow': 'hidden',
            'width': '' + hmtgHelper.view_port_width + 'px',
            'height': '' + hmtgHelper.view_port_height + 'px'
          };
      } else {
        $scope.style_webrtc_main_video =
          {
            'max-width': '' + main_video_canvas.display_size + 'px',
            'max-height': '' + main_video_canvas.display_size + 'px'
          };
      }
    }

    $scope.class_concise_float = function() {
      return $rootScope.gui_mode == 'concise' ? 'concise_float' : '';
    }

    $scope.to_hide_userlist = function() {
      if($rootScope.gui_mode == 'concise') {
        return !layout.is_userlist_visible;

      } else {
        return false;
      }
    }

    $scope.to_hide_textchat = function() {
      if($rootScope.gui_mode == 'concise') {
        return !layout.is_textchat_visible;

      } else {
        return !appSetting.show_control_panel_textchat || $scope.is_area_visible('chat');
      }
    }

    $rootScope.$watch('gui_mode', function() {
      $scope.update_webrtc_main_video_size();
    });

    $scope.$on(hmtgHelper.WM_MAX_DISPLAY_ITEM_CHANGED, function () {
      userlist.count = (appSetting.max_display_item >> 0);
      userlist.update_display_list();
      $rootScope.$broadcast(hmtgHelper.WM_COPY_USER_LIST);
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_FULLSCREEN_CHANGED, function () {
      var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

      main_video_canvas.is_fullscreen = main_video.fullscreen_element && fullscreenElement == main_video.fullscreen_element;
      main_video_canvas.change_display_size();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_HEIGHT_CHANGED, adjust_size);
    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, adjust_size);

    function adjust_size() {
      if(main_video_canvas.is_fullscreen) main_video_canvas.change_display_size();
      if($rootScope.gui_mode == 'concise') {
        $scope.update_webrtc_main_video_size();
        if(!hmtgHelper.inside_angular) $scope.$digest();
      }
    }

    $scope.$on(hmtgHelper.WM_UPDATE_USERLIST, function () {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_UPDATE_AUDIO_DECODING, function () {
      userlist.update_restricted_audio_decoding();
    });

    $scope.$on(hmtgHelper.WM_UPDATE_ACTIVE_SPEAKER, function() {
      main_video.update_user_list();
    });

    $rootScope.$on('$translateChangeEnd', function () {
      main_video.lang_changed();
      userlist.lang_changed();
    });

    $scope.$on(hmtgHelper.WM_MEETING_CONTROL, function (event, ssrc) {
      var modalInstance = $modal.open({
        templateUrl: 'template/MeetingControl.htm' + hmtgHelper.cache_param,
        scope: $scope,
        controller: 'MeetingControlModalCtrl',
        size: '',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(function (result) {
        var flag = hmtg.jnkernel._jn_iControlFlag();
        if(result.question) flag |= hmtg.config.CONTROLLER_QUESTION_CONTROL;
        else flag &= ~hmtg.config.CONTROLLER_QUESTION_CONTROL;
        if(result.poll) flag |= hmtg.config.CONTROLLER_POLL;
        else flag &= ~hmtg.config.CONTROLLER_POLL;
        if(result.sync) flag |= hmtg.config.CONTROLLER_SYNC;
        else flag &= ~hmtg.config.CONTROLLER_SYNC;
        if(result.sync_tab) flag |= hmtg.config.CONTROLLER_SYNC_TAB;
        else flag &= ~hmtg.config.CONTROLLER_SYNC_TAB;

        hmtg.jnkernel.jn_command_SetController(ssrc);
        hmtg.jnkernel.jn_command_SetControlFlag(flag);
      }, function () {
      });
    });

    function set_snapshot_tail() {
      $scope.snapshot_tail = (appSetting.snapshot_delay ? '(' : '') + (appSetting.snapshot_delay ? appSetting.snapshot_delay : '') + (appSetting.snapshot_delay ? ')' : '');
    }
    $scope.$on(hmtgHelper.WM_SNAPSHOT_DELAY_CHANGED, function () {
      if(!$scope.snapshot_intervalID) {
        set_snapshot_tail();
      }
    });

    set_snapshot_tail();
    $scope.snapshot = function() {
      if($rootScope.snapshot_busy) {
        if($scope.snapshot_intervalID) {
          clearInterval($scope.snapshot_intervalID);
          $scope.snapshot_intervalID = null;
          $rootScope.snapshot_busy = false;
          set_snapshot_tail();
        }
        return;
      }
      var elem;
      if(mediasoupWebRTC.is_main_video_webrtc) {
        elem = document.getElementById('webrtc_main_video');
        if(!elem || !elem.videoWidth) return;
      } else {
        if(!(main_video_canvas.canvas_orig && main_video_canvas.canvas_orig.width)) return;
      }  

      $rootScope.snapshot_busy = true;
      $scope.snapshot_delay_count = appSetting.snapshot_delay;

      if(appSetting.snapshot_delay) {
        $scope.snapshot_intervalID = setInterval(function() {
          var to_break;
          if(mediasoupWebRTC.is_main_video_webrtc) {
            elem = document.getElementById('webrtc_main_video');
            if(!elem) to_break = true;
          } else {
            if(!(main_video_canvas.canvas_orig && main_video_canvas.canvas_orig.width)) to_break = true;
          }  
          if(to_break) {
            clearInterval($scope.snapshot_intervalID);
            $scope.snapshot_intervalID = null;
            $rootScope.snapshot_busy = false;
            set_snapshot_tail();
            $scope.$digest();
            return;
          }
          $scope.snapshot_delay_count--;
          $scope.snapshot_tail = ($scope.snapshot_delay_count ? '(' : '') + ($scope.snapshot_delay_count ? $scope.snapshot_delay_count : '') + ($scope.snapshot_delay_count ? ')' : '');
          if($scope.snapshot_delay_count <= 0) {
            clearInterval($scope.snapshot_intervalID);
            $scope.snapshot_intervalID = null;
            snapshot_canvas();
            set_snapshot_tail();
          }
          $scope.$digest();
        }, 1000);
      } else {
        snapshot_canvas();
      }

      function snapshot_canvas() {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext('2d');
        if(elem) {
          canvas.width = elem.videoWidth;
          canvas.height = elem.videoHeight;
          ctx.drawImage(elem, 0, 0);
        } else {
          canvas.width = main_video_canvas.canvas_orig.width;
          canvas.height = main_video_canvas.canvas_orig.height;
          ctx.drawImage(main_video_canvas.canvas_orig, 0, 0);
        }  

        hmtgHelper.process_snapshot(canvas);
      }
    }

    $scope.jump_bm = function (bm) {
      playback.jump(bm.tick);
    }

    $scope.$on(hmtgHelper.WM_POLL_REQUEST, function (event, poll_type) {
      var modalInstance = $modal.open({
        templateUrl: 'template/PollRequest.htm' + hmtgHelper.cache_param,
        scope: $scope,
        controller: 'PollRequestModalCtrl',
        size: '',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(function (result) {
        hmtg.jnkernel.jn_command_PollResult(poll_type, result.poll_result);
      }, function () {
      });
    });

    $scope.$on(hmtgHelper.WM_POLL_RESULT, function (event, total, responded, result_array, void_text) {
      $scope.total = total;
      $scope.responded = responded;
      $scope.result_list = result_array;
      $scope.void_text = void_text;

      var modalInstance = $modal.open({
        templateUrl: 'template/PollResult.htm' + hmtgHelper.cache_param,
        scope: $scope,
        controller: 'PollResultModalCtrl',
        size: 'lg',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(function (result) {
      }, function () {
      });
    });

    $scope.$on(hmtgHelper.WM_PROMPT_PASSWORD, function (event, type) {
      $scope.password_type = type;
      var modalInstance = $modal.open({
        templateUrl: 'template/PromptPassword.htm' + hmtgHelper.cache_param,
        scope: $scope,
        controller: 'PromptPasswordModalCtrl',
        size: '',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(function (result) {
        hmtg.jnkernel.jn_command_ProvidePassword(result.password);
      }, function () {
        hmtgHelper.inside_angular++;
        hmtg.jnkernel.jn_command_UserCancel();
        hmtgHelper.inside_angular--;
      });
    });

    $scope.show_userlist_title = function () { return JoinNet.net_init_finished && hmtg.jnkernel._jn_bConnected(); }
    $scope.show_codec_info = function() {
      return appSetting.show_advanced_function && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL;
    }
    $scope.get_cipher_info = function () {
      if(!appSetting.show_advanced_function) return '';
      var info = hmtgHelper.cipher_info($translate.instant, hmtg.jnkernel._cipher_name());
      if(info) return $translate.instant('ID_CIPHER') + ': ' + info;
      return '';
    }
    $scope.get_userlist_title = function () {
      return $translate.instant('IDS_CONTROL_PANEL_TITLE').replace('%d', userlist.user_list.length);
    }
    $scope.$on(hmtgHelper.WM_NET_INIT_FINISH, function () {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$watch('a.opus_bitrate_pos', function () {
      audio_codec.opus_bitrate = audio_codec.min_opus_bitrate + (audio_codec.max_opus_bitrate - audio_codec.min_opus_bitrate) * audio_codec.opus_bitrate_pos / 100.0;
      //audio_codec.audio_bitrate_str = audio_codec.opus_bitrate_str = '' + ((audio_codec.opus_bitrate / 1000) >>> 0) + 'kbps';
      audio_codec.audio_bitrate_str = audio_codec.opus_bitrate_str = '' + hmtgHelper.number2gmk(audio_codec.opus_bitrate) + 'bps';
      hmtgHelper.inside_angular++;
      audio_capture.change_opus_bitrate();
      hmtgHelper.inside_angular--;
      /*
      if(audio_codec.change_opus_bitrate_timerID) {
      clearTimeout(audio_codec.change_opus_bitrate_timerID);
      }
      audio_codec.change_opus_bitrate_timerID = setTimeout(function () {
      audio_codec.change_opus_bitrate_timerID = null;
      audio_capture.change_opus_bitrate();
      }, 2000);
      */
    });

    $scope.$watch('a.audio_codec', function () {
      audio_codec.is_opus_audio = audio_codec.audio_codec == hmtg.config.AUDIO_OPUS;
      if(audio_codec.audio_codec == hmtg.config.AUDIO_OPUS) {
        audio_codec.audio_bitrate_str = audio_codec.opus_bitrate_str;
      } else if(audio_codec.audio_codec == hmtg.config.AUDIO_G711) {
        audio_codec.audio_bitrate_str = audio_codec.g711_bitrate_str;
      } else {
        audio_codec.audio_bitrate_str = '';
      }

      hmtgHelper.inside_angular++;
      audio_capture.change_audio_codec();
      hmtgHelper.inside_angular--;
      /*
      if(audio_codec.change_audio_codec_timerID) {
      clearTimeout(audio_codec.change_audio_codec_timerID);
      }
      audio_codec.change_audio_codec_timerID = setTimeout(function () {
      audio_codec.change_audio_codec_timerID = null;
      audio_capture.change_audio_codec();
      }, 2000);
      */
    });

    $scope.$watch('v2.bitrate_pos', function() {
      var old_rate = hmtg.jnkernel._jn_targetrate();
      var new_rate = (video_bitrate.min_bitrate + (video_bitrate.max_bitrate - video_bitrate.min_bitrate) * video_bitrate.bitrate_pos / 100.0);
      new_rate = (new_rate + 0.5) >> 0;
      if(old_rate != new_rate) {
        hmtg.util.log("Control Panel, the user adjust target rate to " + new_rate)
        hmtgHelper.inside_angular++;
        hmtg.jnkernel._jn_targetrate(new_rate);
        hmtgHelper.inside_angular--;
      }  
      //video_bitrate.bitrate_str = '' + ((hmtg.jnkernel._jn_targetrate() / 1000) >>> 0) + 'kbps';
      video_bitrate.bitrate_str = '' + hmtgHelper.number2gmk(hmtg.jnkernel._jn_targetrate()) + 'bps';
    });

    $scope.$watch('v.video_codec', function () {
      hmtgHelper.inside_angular++;
      video_capture.change_video_codec();
      hmtgHelper.inside_angular--;
      /*
      if(video_codec.change_video_codec_timerID) {
      clearTimeout(video_codec.change_video_codec_timerID);
      }
      video_codec.change_video_codec_timerID = setTimeout(function () {
      video_codec.change_video_codec_timerID = null;
      video_capture.change_video_codec();
      }, 2000);
      */
    });

    $scope.$watch('as.video_fps', function () {
      hmtg.util.localStorage['hmtg_video_fps'] = JSON.stringify($scope.as.video_fps);
      video_codec.fps = appSetting.video_fps ? appSetting.video_fps : 15;
    });

    $scope.$watch('vr.main_video_ssrc', function (newValue, oldValue) {
      setTimeout(function () {
        main_video.main_video_ssrc_changed(newValue, oldValue);
      }, 0);
    });

    $scope.$watch('vr.main_video_ssrc2', function (newValue, oldValue) {
      setTimeout(function () {
        main_video.main_video_ssrc2_changed(newValue, oldValue);
      }, 0);
    });

    $scope.$watch('m2.display_size', function () {
      hmtg.util.localStorage['hmtg_video_display_size'] = JSON.stringify(main_video_canvas.display_size);
      $scope.update_webrtc_main_video_size();
      main_video_canvas.change_display_size();
      setTimeout(function () {
        $rootScope.$broadcast(hmtgHelper.WM_WIDTH_CHANGED);
      }, 0);
    });

    $scope.$watch('vr.show_2nd_video', function () {
      hmtg.util.localStorage['hmtg_show_2nd_video'] = JSON.stringify(video_recving.show_2nd_video);
      setTimeout(function () {
        main_video.update_user_list();
      }, 0);
    });

    $scope.$watch('m2.overlap_two_video', function() {
      hmtg.util.localStorage['hmtg_overlap_two_video'] = JSON.stringify(main_video_canvas.overlap_two_video);
      main_video_canvas.draw_video();
    });

    $scope.toggle_bookmark = function () {
      $scope.hide_bm = !$scope.hide_bm;
    }
  }
])

.controller('MeetingControlModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate',
  function ($scope, $modalInstance, $modal, $translate) {
    $scope.w = {};

    var flag = hmtg.jnkernel._jn_iControlFlag();
    $scope.w.question = !!(flag & hmtg.config.CONTROLLER_QUESTION_CONTROL);
    $scope.w.poll = !!(flag & hmtg.config.CONTROLLER_POLL);
    $scope.w.sync = !!(flag & hmtg.config.CONTROLLER_SYNC);
    $scope.w.sync_tab = !!(flag & hmtg.config.CONTROLLER_SYNC_TAB);

    $scope.ok = function () {
      $modalInstance.close({
        question: $scope.w.question,
        poll: $scope.w.poll,
        sync: $scope.w.sync,
        sync_tab: $scope.w.sync_tab
      });
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
])

.controller('PollRequestModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', '$interval',
  function ($scope, $modalInstance, $modal, $translate, $interval) {
    $scope.w = {};
    $scope.w.poll_result = 1 + ((Math.random() * 5) >> 0);
    $scope.local_timeout = 30;
    $scope.cancel_value0 = $scope.cancel_value = $translate.instant('ID_CANCEL');
    $scope.cancel_value = $scope.cancel_value0 + '(' + $scope.local_timeout + ')';
    $scope.auto_timerID = $interval(auto_timer, 1000);

    function auto_timer() {
      $scope.local_timeout--;
      $scope.cancel_value = $scope.cancel_value0 + '(' + $scope.local_timeout + ')';

      if(!$scope.local_timeout) {
        $interval.cancel($scope.auto_timerID);
        $scope.auto_timerID = null;
        $modalInstance.dismiss();
      }
    }

    $scope.ok = function () {
      if($scope.auto_timerID) {
        $interval.cancel($scope.auto_timerID);
        $scope.auto_timerID = null;
      }
      $modalInstance.close({
        poll_result: $scope.w.poll_result
      });
    };

    $scope.cancel = function () {
      if($scope.auto_timerID) {
        $interval.cancel($scope.auto_timerID);
        $scope.auto_timerID = null;
      }
      $modalInstance.dismiss();
    };
  }
])

.controller('PollResultModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', '$rootScope', 'hmtgHelper', '$ocLazyLoad',
  'appSetting', 'board', 'hmtgSound',
  function($scope, $modalInstance, $modal, $translate, $rootScope, hmtgHelper, $ocLazyLoad, appSetting,
    board, hmtgSound) {
    $scope.w = {};
    $scope.as = appSetting;
    $scope.w.show_text = false;
    $scope.toggle_text = function (to_show) {
      $scope.w.show_text = to_show;
      if(!$scope.w.show_text) {
        $scope.descr = $translate.instant('IDS_POLL_RESULT_FORMAT').replace('%1$d', $scope.total).replace('%2$d', $scope.total - $scope.responded);
      } else {
        $scope.descr = $translate.instant('IDS_POLL_RESULT_FORMAT').replace('%1$d', $scope.total).replace('%2$d',
          (($scope.total - $scope.responded) && $scope.void_text) ? ('' + ($scope.total - $scope.responded) + '(' + $scope.void_text + ')') : '0');
      }
    }
    $scope.toggle_text($scope.w.show_text);
    $scope.can_upload = function()
    {
      if(!board.can_upload()) return false;
      if(!board.upload_finished) return false;
      if(!board.is_local_slide && hmtg.jnkernel._jn_conversion_count()) return false;
      return true;
    }

    $scope.upload = function () {
      if($rootScope.snapshot_busy) {
        return;
      }
      $ocLazyLoad.load('lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/_html2canvas' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param).then(function () {
        $rootScope.snapshot_busy = true;
        html2canvas(document.getElementById('poll_result'), { onrendered: mysnapshot });
      }, function (e) {
        hmtg.util.log(-1, 'Warning! lazy_loading _html2canvas fails');
      });
    }

    function mysnapshot(canvas) {
      // hmtgHelper.process_snapshot(canvas);
      $rootScope.snapshot_busy = false;
      if(!$scope.can_upload()) return;

      var c = canvas;
      try {
        if(c.toBlob) {
          c.toBlob(function(blob) {
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
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant(e.code == 18 ? 'ID_ERROR_TAINTED_CANVAS' : 'ID_ERROR_EXPORT_CANVAS_DATA') }, 20);
        hmtgHelper.inside_angular--;
        return;
      }
      $modalInstance.dismiss();
    }

    function upload_slide() {
      var name = $translate.instant('ID_SNAPSHOT') + hmtgHelper.snapshot_count + '.png';
      hmtgHelper.snapshot_count++;
      $scope.upload_file.name = name;

      board.upload_finished = false;

      board.upload_slide(2, board.is_local_slide, '', hmtg.util.encodeUtf8(name), $scope.upload_file);
      $modalInstance.dismiss('cancel');
    }

    $scope.ok = function () {
      $modalInstance.close();
    };

    $scope.cancel = function () {
      $modalInstance.dismiss();
    };
  }
])

.controller('PromptPasswordModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', '$rootScope', 'hmtgHelper', '$interval',
  function ($scope, $modalInstance, $modal, $translate, $rootScope, hmtgHelper, $interval) {
    $scope.w = {};
    $scope.prompt = $scope.password_type == 0 ?
    $translate.instant('ID_THIRDPARTY_PASSWORD') : ($scope.password_type == 1 ? $translate.instant('ID_JNR_SHARING_PASSWORD') : $translate.instant('ID_JNR_PASSWORD'));
    $scope.local_timeout = 45;
    $scope.text_value0 = $translate.instant('ID_CANCEL');
    $scope.text_value = $scope.text_value0 + '(' + $scope.local_timeout + ')';
    $scope.auto_cancel_intervalID = $interval(auto_cancel_interval, 1000);

    function auto_cancel_interval() {
      $scope.local_timeout--;
      $scope.text_value = $scope.text_value0 + '(' + $scope.local_timeout + ')';

      if(!$scope.local_timeout) {
        $interval.cancel($scope.auto_cancel_intervalID);
        $scope.auto_cancel_intervalID = null;
        $modalInstance.dismiss();
      }
    }

    $scope.ok = function () {
      $modalInstance.close({ password: hmtg.util.encodeUtf8($scope.w.password) });
    };

    $scope.cancel = function () {
      $modalInstance.dismiss();
    };
  }
])

;
