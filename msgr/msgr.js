/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('msgr', ['pascalprecht.translate', 'ui.bootstrap'])

.service('Msgr', ['$rootScope', '$http', '$translate', 'hmtgAlert', 'jnagentDlg', 'msgrHelper', 'hmtgHelper',
  'appSetting', 'JoinNet', 'jnjContent', '$modal', 'hmtgSound', 'imDlg', 'checkIM', 'checkMsg', 'imStyle',
  'missedCall', '$ocLazyLoad',
  function($rootScope, $http, $translate, hmtgAlert, jnagentDlg, msgrHelper, hmtgHelper, appSetting, JoinNet,
    jnjContent, $modal, hmtgSound, imDlg, checkIM, checkMsg, imStyle, missedCall, $ocLazyLoad) {

    var jmkernel = hmtg.jmkernel;
    jmkernel['jm_callback_GetMcuInfo'] = function(tag, param, homepage, callback) {
      var json_homepage = homepage;
      if($rootScope.is_secure && appSetting.auto_https && homepage.toLowerCase().indexOf('http://') == 0) {
        json_homepage = 'https://' + homepage.slice(7);
        var tmp = json_homepage;
        hmtgSound.ShowInfoPrompt(function() {
          return $translate.instant('ID_HTTP_TO_HTTPS').replace('#http#', homepage).replace('#https#', tmp);
        }, 10, false);
      }
      if(homepage.slice(-1) != '/') json_homepage += '/';
      json_homepage += 'getmcuinfo/?callback=JSON_CALLBACK';
      // it is necessary to exempt error here
      // an invalid jsonp response could cause "syntax error" crash
      window.g_exempted_error++;
      $http.jsonp(json_homepage)
      .success(function(data, status) {
        window.g_exempted_error--;
        hmtgHelper.inside_angular++;
        callback(tag, param, data.ip, data.backupip, data.port, data.port2);
        hmtgHelper.inside_angular--;
      })
      .error(function(data, status) {
        window.g_exempted_error--;
        hmtgHelper.inside_angular++;
        callback(tag, param);
        hmtgAlert.prompt_http();
        hmtgHelper.inside_angular--;
      });
    };

    jmkernel['jm_callback_compress'] = function() {
      return hmtgHelper.compress;
    }
    jmkernel['jm_callback_decompress'] = function() {
      return hmtgHelper.decompress;
    }

    jmkernel['jm_callback_UpdateConnectionStatus'] = function(param) {
      var idx = jnagentDlg.find_item(jnagentDlg.data, param);
      var server;
      if(idx == -1) {
        var server = {};
        jnagentDlg.data.push(server);
      } else {
        server = jnagentDlg.data[idx];
      }
      jnagentDlg.prepare_server(server, param);
      imDlg.delayed_update();
    }

    jmkernel['jm_callback_ShowError'] = function(param, error_code) {
      msgrHelper.ShowError($translate.instant, param, error_code);
      if(error_code == hmtg.config.MSGR_ERROR_CAN_NOT_CONNECT_MCU) {
        hmtgAlert.prompt_http();
      }
    }

    jmkernel['jm_callback_ShowMMCError'] = function(param, mmc_error, error_text) {
      msgrHelper.ShowMessageBox($translate.instant, param, msgrHelper.translate_mmc_error($translate.instant, mmc_error, error_text));
    }

    jmkernel['jm_callback_UpdateUser'] = function(param, this_us) {
      jnagentDlg.update_user(param, this_us);
    }

    jmkernel['jm_callback_DeleteConnectionParam'] = function(param) {
      jnagentDlg.delete_param(param);
    }

    jmkernel['jm_callback_LaunchJoinNet'] = function(jnj, try_saved_visitor_name) {
      if(appSetting.use_native) {
        hmtgHelper.save_file(new Blob([hmtg.util.decodeUtf8(jnj)], { type: 'application/joinnet' }), 'joinnet-' + msgrHelper.get_timestring_filename() + '.jnj');
        return;
      }
      if(
        // jnjContent.valid_jnj ||
        hmtg.jnkernel._jn_bConnected() || hmtg.jnkernel._jn_bConnecting()) {
        var text;
        // if(hmtg.jnkernel._jn_bConnecting() || hmtg.jnkernel._jn_bConnected())
          text = $translate.instant('ID_JOINNET_ACTIVE_SESSION') + ' ' + $translate.instant('ID_CONTINUE_PROMPT');
        // else
        //   text = $translate.instant('ID_JOINNET_IDLE_SESSION') + ' ' + $translate.instant('ID_CONTINUE_PROMPT');
        hmtgHelper.OKCancelMessageBox(text, 20, ok);
      } else {
        if(JoinNet.connect(jnj, try_saved_visitor_name)) {
          $rootScope.nav_item = 'joinnet';
          $rootScope.tabs[2].active = true;
          if(!hmtgHelper.inside_angular) $rootScope.$apply();
        } else {
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_INVALID_JNJ') }, 20);
        }
      }
      function ok() {
        hmtgHelper.inside_angular++;
        hmtg.jnkernel.jn_command_QuitConnection();
        if(JoinNet.connect(jnj, try_saved_visitor_name)) {
          $rootScope.nav_item = 'joinnet';
          $rootScope.tabs[2].active = true;
        } else {
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_INVALID_JNJ') }, 20);
        }
        hmtgHelper.inside_angular--;
      }
    }

    jmkernel['jm_callback_ServerShutdown'] = function(param) {
      var office_name = param._office_name();
      var homepage = hmtg.util.decodeUtf8(param._homepage());
      var userid = hmtg.util.decodeUtf8(param._username());
      var guest = param._guest();
      hmtgSound.ShowErrorPrompt(function() {
        var str;
        if(office_name) {
          str = $translate.instant('IDS_FORMAT_ALERT_SHUTDOWN1')
        .replace('#office#', hmtg.util.decodeUtf8(office_name))
        ;
        } else {
          str = $translate.instant(guest ? 'IDS_FORMAT_ALERT_SHUTDOWN3' : 'IDS_FORMAT_ALERT_SHUTDOWN2')
        .replace('#homepage#', homepage)
        ;
          if(userid)
            str = str.replace('#userid#', userid);
        }
        return str;
      }, 60);
    }

    jmkernel['jm_callback_JnjExceedDiskQuota'] = function(param) {
      var office_name = param._office_name();
      var homepage = hmtg.util.decodeUtf8(param._homepage());
      var userid = hmtg.util.decodeUtf8(param._username());
      var guest = param._guest();
      hmtgSound.ShowErrorPrompt(function() {
        var str;
        if(office_name) {
          str = $translate.instant('IDS_FORMAT_ALERT_DISKQUOTA1')
        .replace('#office#', hmtg.util.decodeUtf8(office_name))
        ;
        } else {
          str = $translate.instant('IDS_FORMAT_ALERT_DISKQUOTA2')
        .replace('#homepage#', homepage)
        ;
          if(userid)
            str = str.replace('#userid#', userid);
        }
        return str;
      }, 20);
    }

    jmkernel['jm_callback_WebRTCSignal'] = function(param, text, visitor_name, peer_username) {
      imDlg.callback_WebRTCSignal(param, text, visitor_name, peer_username);
    }

    jmkernel['jm_callback_ShortMessage'] = function(param, type, short_message, short_message2, visitor_name, visitor_homepage, guest_user_name, message_delay, peer_username) {
      imDlg.callback_ShortMessage(param, type, short_message, short_message2, visitor_name, visitor_homepage, guest_user_name, message_delay, peer_username);
    }

    jmkernel['jm_callback_ShortMessageFailure'] = function(param, target_userid, short_message, short_message2, type) {
      imDlg.callback_ShortMessageFailure(param, target_userid, short_message, short_message2, type);
    }

    jmkernel['jm_callback_OfflineGroupMessage'] = function(param, delay, group_id, name, short_message, short_message2) {
      imDlg.callback_OfflineGroupMessage(param, delay, group_id, name, short_message, short_message2);
    }

    jmkernel['jm_callback_GroupMessageFail'] = function(param, group_id, short_message, short_message2, error_code) {
      imDlg.callback_GroupMessageFail(param, group_id, short_message, short_message2, error_code);
    }

    jmkernel['jm_callback_GroupMessage'] = function(param, group_id, short_message, short_message2, src_id) {
      imDlg.callback_GroupMessage(param, group_id, short_message, short_message2, src_id);
    }

    jmkernel['jm_callback_OfflineJoin'] = function(param, delay, group_id, name) {
      imDlg.callback_OfflineJoinLeave(param, delay, group_id, name, true);
    }

    jmkernel['jm_callback_OfflineLeave'] = function(param, delay, group_id, name) {
      imDlg.callback_OfflineJoinLeave(param, delay, group_id, name, false);
    }

    jmkernel['jm_callback_OfflinePgcRename'] = function(param, delay, group_id, name, pgc_name) {
      imDlg.callback_OfflinePgcRename(param, delay, group_id, name, pgc_name);
    }

    jmkernel['jm_callback_RenamePgc'] = function(param, group_id, pgc_name, src_id) {
      imDlg.callback_RenamePgc(param, group_id, pgc_name, src_id);
    }

    jmkernel['jm_callback_JnjInvite'] = function(param, jnj, info_owner_id, info_owner_homepage) {
      hmtg.util.log("invitation, office '" + param._homepage() + "', invitor '" + info_owner_id + "' @ '" + info_owner_homepage + "'");

      var item = {};
      item['timeout'] = 20;
      item['update'] = function() {
        var str = $translate.instant('IDS_FORMAT_ALERT_INVITE');
        var str_guest = $translate.instant('IDS_GUEST');
        if(param._guest()) {
          str = str.replace('#userid#', str_guest);
        } else {
          str = str.replace('#userid#', hmtg.util.decodeUtf8(param._username()));
        }
        str = str.replace('#office#', hmtg.util.decodeUtf8(param._name_or_homepage3()));
        str = str.replace('#inviter_id#', hmtg.util.decodeUtf8(info_owner_id))
          .replace('#inviter_office#', hmtg.util.decodeUtf8(info_owner_homepage));
        return str;
      };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['need_ring'] = true;
      item['click'] = function(index) {
        hmtgAlert.close_notification(item);
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;

        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);

        hmtg.jmkernel.jm_callback_LaunchJoinNet(jnj);
        hmtgHelper.inside_angular--;
      };
      item['item_click'] = function() {
        hmtgAlert.close_notification(item);
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;

        hmtgAlert.click_item_link(item);

        hmtg.jmkernel.jm_callback_LaunchJoinNet(jnj);
      };
      item['cancel'] = function() {
        hmtgAlert.close_notification(item);
      }
      item['timeout_action'] = function() {
        missedCall.update_missed_call('ID_INVITE', hmtg.util.decodeUtf8(info_owner_id) + ' @ ' + hmtg.util.decodeUtf8(info_owner_homepage));
      }

      hmtgAlert.add_link_item(item);
      item['notification'] = hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), item['update'](), false, item['item_click']);
    }

    jmkernel['jm_callback_JnjVisit'] = function(param, jnj, visitor_name) {
      hmtg.util.logUtf8("visit request, office '" + param._homepage() + "', visitor '" + visitor_name + "'");

      var item = {};
      item['timeout'] = 30;
      item['update'] = function() {
        var str;
        if(param._office_name()) {
          str = $translate.instant('IDS_FORMAT_ALERT_VISIT1');
          str = str.replace('#visitor#', hmtg.util.decodeUtf8(visitor_name));
          str = str.replace('#office#', hmtg.util.decodeUtf8(param._office_name()));
        } else {
          str = $translate.instant('IDS_FORMAT_ALERT_VISIT2');
          str = str.replace('#visitor#', hmtg.util.decodeUtf8(visitor_name));
          str = str.replace('#userid#', hmtg.util.decodeUtf8(param._username()));
          str = str.replace('#homepage#', hmtg.util.decodeUtf8(param._homepage()));
        }
        return str;
      };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['need_ring'] = true;
      item['click'] = function(index) {
        hmtgAlert.close_notification(item);
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;

        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);

        hmtg.jmkernel.jm_callback_LaunchJoinNet(jnj);
        hmtgHelper.inside_angular--;
      };
      item['item_click'] = function() {
        hmtgAlert.close_notification(item);
        $rootScope.nav_item = 'joinnet';
        $rootScope.tabs[2].active = true;

        hmtgAlert.click_item_link(item);

        hmtg.jmkernel.jm_callback_LaunchJoinNet(jnj);
      };
      item['cancel'] = function() {
        hmtgAlert.close_notification(item);
      }
      item['timeout_action'] = function() {
        missedCall.update_missed_call('ID_VISIT', hmtg.util.decodeUtf8(visitor_name));
      }

      hmtgAlert.add_link_item(item);
      item['notification'] = hmtgAlert.show_notification($translate.instant('IDS_APP_NAME'), item['update'](), false, item['item_click']);
    }

    jmkernel['jm_callback_JnjNewMessage'] = function(param, visitor_name) {
      hmtg.util.logUtf8("recv new message, office '" + param._homepage() + "', from '" + visitor_name + "'");
      if(!appSetting.alert_newmessage) return;

      var item = {};
      item['timeout'] = 30;
      item['update'] = function() {
        var str;
        if(param._office_name()) {
          str = $translate.instant('IDS_FORMAT_ALERT_NEW_MESSAGE1');
          str = str.replace('#visitor#', hmtg.util.decodeUtf8(visitor_name));
          str = str.replace('#office#', hmtg.util.decodeUtf8(param._office_name()));
        } else {
          str = $translate.instant('IDS_FORMAT_ALERT_NEW_MESSAGE2');
          str = str.replace('#visitor#', hmtg.util.decodeUtf8(visitor_name));
          str = str.replace('#userid#', hmtg.util.decodeUtf8(param._username()));
          str = str.replace('#homepage#', hmtg.util.decodeUtf8(param._homepage()));
        }
        return str;
      };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['click'] = function(index) {
        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);

        $rootScope.$broadcast(hmtgHelper.WM_SHOW_CM, param);
        hmtgHelper.inside_angular--;
      };

      hmtgAlert.add_link_item(item);
      if(appSetting.play_sound) {
        hmtgSound.playAlertSound();
      }
    }

    jmkernel['jm_callback_JnjNewMessageCount'] = function(param, count) {
      if(!appSetting.alert_newmessage) return;

      var item = {};
      item['timeout'] = 30;
      item['update'] = function() {
        var str;
        str = $translate.instant('IDS_FORMAT_ALERT_MESSAGE_COUNT');
        str = str.replace('%d', count);
        str = str.replace('#office#', hmtg.util.decodeUtf8(param._name_or_homepage2()));
        return str;
      };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['click'] = function(index) {
        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);

        $rootScope.$broadcast(hmtgHelper.WM_SHOW_CM, param);
        hmtgHelper.inside_angular--;
      };

      hmtgAlert.add_link_item(item);
      if(appSetting.play_sound) {
        hmtgSound.playAlertSound();
      }
    }

    jmkernel['jm_callback_UserInfoUpdated'] = function(param) {
      var idx = jnagentDlg.find_item(jnagentDlg.data, param);
      var server;
      if(idx != -1) {
        server = jnagentDlg.data[idx];
        jnagentDlg.update_lang_server(server, param);
      }
    }

    /*
    jmkernel['jm_callback_ShowUserInfo'] = function(param) {
    var str;
    var o = param._office_name();
    var e = param._email();
    str = $translate.instant(o ?
    (e ? 'IDS_FORMAT_OFFICE_INFO3' : "IDS_FORMAT_OFFICE_INFO5") :
    (e ? 'IDS_FORMAT_OFFICE_INFO4' : "IDS_FORMAT_OFFICE_INFO6"));

    if(o) {
    str = str.replace('#office#', hmtg.util.decodeUtf8(o));
    }
    if(e) {
    str = str.replace('#email#', hmtg.util.decodeUtf8(e));
    }
    str = str.replace('#userid#', param._userid());
    str = str.replace('#homepage#', hmtg.util.decodeUtf8(param._homepage()));
    str = str.replace('#ip#', hmtg.util.decodeUtf8(param._jnj_ip()));
    str = str.replace('#username#', hmtg.util.decodeUtf8(param._username()));
    str = str.replace('%d', param._port());
    str = str.replace('%d', param._max_outconnection());

    var du = param._disk_usage();
    if(du) {
    str += '\n' + $translate.instant('IDS_FORMAT_DISK_SPACE_USED').replace('%d', du);
    }

    var dq = param._disk_quota();
    if(dq) {
    str += '\n' + $translate.instant('IDS_FORMAT_DISK_QUOTA').replace('%d', dq);
    }

    if(param._mmc_messenger() && !param._guest()) {
    str += '\nInternal ID: ' + param._internal_id();
    }

    hmtgHelper.MessageBox(str, 0);
    }
    */

    jmkernel['jm_callback_InviteJnjGeneration'] = function(param, unique_id, mmc_error, jnj) {
      if(jnagentDlg.g_unique_id != unique_id) return;
      if(jnagentDlg.g_iRequestStatus != 1) return;
      if(mmc_error) {
        jnagentDlg.g_iRequestStatus = 3;
        if(param._mmc_messenger()) {
          if(mmc_error != hmtg.config.US_ERROR_OWNER_NO_RESPONSE)
            hmtg.jmkernel.jm_callback_ShowMMCError(param, mmc_error, jnj);
        } else {
          hmtg.jmkernel.jm_callback_ShowError(param, hmtg.config.MSGR_INVITE_FAILED);
        }
        if(jnagentDlg.g_request_item) {
          hmtgAlert.remove_text_item(jnagentDlg.g_request_item);
          jnagentDlg.g_request_item = null;
        }
      } else {
        jnagentDlg.g_iRequestStatus = 2;
        if(jnagentDlg.g_request_item) {
          jnagentDlg.g_request_item['action'](jnj);
        }
      }
    }

    jmkernel['jm_callback_MMCJnjGeneration'] = function(param, unique_id, mmc_error, jnj) {
      if(jnagentDlg.g_unique_id != unique_id) return;
      if(jnagentDlg.g_iRequestStatus != 1) return;
      if(jnagentDlg.g_request_item) {
        hmtgAlert.remove_text_item(jnagentDlg.g_request_item);
        jnagentDlg.g_request_item = null;
      }
      if(mmc_error) {
        jnagentDlg.g_iRequestStatus = 3;
        if(mmc_error != hmtg.config.US_ERROR_OWNER_NO_RESPONSE)
          hmtg.jmkernel.jm_callback_ShowMMCError(param, mmc_error, jnj);
      } else {
        jnagentDlg.g_iRequestStatus = 2;
        hmtg.jmkernel.jm_callback_LaunchJoinNet(jnj);
      }
    }

    jmkernel['jm_callback_QueryURLMMC'] = function(param, unique_id, mmc_error, jnj) {
      if(jnagentDlg.g_unique_id != unique_id) return;
      if(jnagentDlg.g_iRequestStatus != 1) return;
      if(jnagentDlg.g_request_item) {
        hmtgAlert.remove_text_item(jnagentDlg.g_request_item);
        jnagentDlg.g_request_item = null;
      }
      if(mmc_error) {
        jnagentDlg.g_iRequestStatus = 3;
        if(mmc_error != hmtg.config.US_ERROR_OWNER_NO_RESPONSE)
          hmtg.jmkernel.jm_callback_ShowMMCError(param, mmc_error, jnj);
      } else {
        jnagentDlg.g_iRequestStatus = 2;
        $rootScope.editp_param = param;
        $rootScope.editp_url = jnj;
        $ocLazyLoad.load({
          name: 'msgr',
          files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_edit_profile' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
        }).then(function() {
          var modalInstance = $modal.open({
            templateUrl: 'template/EditProfile.htm' + hmtgHelper.cache_param,
            scope: $rootScope,
            controller: 'EditProfileModalCtrl',
            size: 'lg',
            backdrop: 'static',
            resolve: {}
          });

          modalInstance.result.then(function() {
          }, function() {
          });
        }, function(e) {
          hmtg.util.log(-1, 'Warning! lazy_loading modal_edit_profile fails');
        });
      }
    }

    jmkernel['jm_callback_SendFileRequest'] = function(param, unique_id, type, file_size,
          peer_id, peer_name, file_name, guest_user_name, guest_office_name, index) {
      imDlg.callback_SendFileRequest(param, unique_id, type, file_size,
          peer_id, peer_name, file_name,
          guest_user_name, guest_office_name, index);
    }

    jmkernel['jm_callback_SendFileAction'] = function(param, param1, param2, action, unique_id, type, peer_id) {
      imDlg.callback_SendFileAction(param, param1, param2, action, unique_id, type, peer_id);
    }

    jmkernel['jm_callback_SendFileSend'] = function(param, flag, pointer, data, unique_id, type, peer_id) {
      imDlg.callback_SendFileSend(param, flag, pointer, data, unique_id, type, peer_id);
    }

    jmkernel['jm_callback_JnjShareFile'] = function(param, psf) {
      jnagentDlg.callback_JnjShareFile(param, psf);
    }

    jmkernel['jm_callback_ShowJoinRequestError'] = function(param, userid, username, error_code) {
      msgrHelper.ShowJoinRequestError($translate.instant, param, userid, username, error_code);
    }

    jmkernel['jm_callback_ShowMMCJoinRequestError'] = function(param, userid, username, error_code, unique_id) {
      if(jnagentDlg.g_unique_id != unique_id) return;
      if(jnagentDlg.g_iRequestStatus != 1) return;
      jnagentDlg.g_iRequestStatus = 3;

      if(error_code != hmtg.config.US_ERROR_NOT_READY) {
        msgrHelper.ShowJoinRequestError($translate.instant, param, userid, username, error_code);
      }

      if(jnagentDlg.g_request_item) {
        hmtgAlert.remove_text_item(jnagentDlg.g_request_item);
        jnagentDlg.g_request_item = null;
      }
    }

    jmkernel['jm_callback_InviteFailure'] = function(param, invitee_name) {
      hmtg.util.log("invitation to " + invitee_name + " at office '" + param._homepage() + "' failed.");
      hmtgSound.ShowErrorPrompt(function() {
        return $translate.instant('IDS_FORMAT_INVITE_FALURE').replace('#username#', hmtg.util.decodeUtf8(invitee_name));
      }, 20);
    }

    jmkernel['jm_callback_ShareFileFailure'] = function(param, invitee_name) {
      hmtg.util.log("share file to " + invitee_name + " at office '" + param._homepage() + "' failed.");
      hmtgSound.ShowErrorPrompt(function() {
        return $translate.instant('IDS_FORMAT_SHARE_FILE_FALURE').replace('#username#', hmtg.util.decodeUtf8(invitee_name));
      }, 20);
    }

    jmkernel['jm_callback_NotifyIMStatusChange'] = function(param, this_us) {
      imDlg.OnIMStatusChange(param, this_us);
    }

    jmkernel['jm_callback_ServerLogError'] = function(param, type, peer) {
      imDlg.callback_ServerLogError(param, type, peer);
    }

    jmkernel['jm_callback_ServerLogData'] = function(param, type, peer, new_offset, data) {
      imDlg.callback_ServerLogData(param, type, peer, new_offset, data);
    }

    jmkernel['jm_callback_DisconnectGroupConversationWindow'] = function(param) {
      imDlg.onDisconnect(param);
    }

    jmkernel['jm_callback_ReconnectGroupConversationWindow'] = function(param) {
      imDlg.onReconnect(param);
    }

    jmkernel['jm_callback_IMNewItem'] = function(param, cim_param, type, size, peer_id, display_name, tick, text_type, text) {
      checkIM.callback_IMNewItem(param, cim_param, type, size, peer_id, hmtg.util.decodeUtf8(display_name), tick, text_type, text);
    }

    jmkernel['jm_callback_MsgNewItem'] = function(param, cm_param, is_upload, mmc_file_index, flag, size, view_count, tick, title, web_title, group, meetinginfo) {
      checkMsg.callback_MsgNewItem(param, cm_param, is_upload, mmc_file_index, flag, size, view_count, tick, hmtg.util.decodeUtf8(title), hmtg.util.decodeUtf8(web_title), hmtg.util.decodeUtf8(group), meetinginfo);
    }

    jmkernel['jm_callback_MessageEndOfFile'] = function(param, cm_param) {
      checkMsg.callback_MessageEndOfFile(param, cm_param);
    }

    jmkernel['jm_callback_NotifyPlaybackResult'] = function() {
      hmtgHelper.MessageBox($translate.instant('IDS_PLAYBACK_FAIL'), 0);
    }

    jmkernel['jm_callback_NotifyShareResult'] = function(param, cm_param, url, jnj) {
      checkMsg.callback_NotifyShareResult(param, cm_param, url, jnj);
    }

    jmkernel['jm_callback_NotifyUnshareResult'] = function(param, cm_param, result) {
      checkMsg.callback_NotifyUnshareResult(param, cm_param, result);
    }

    jmkernel['jm_callback_NotifyJeditorResult'] = function(param, cm_param, error_code) {
      if(error_code) {
        msgrHelper.ShowWebOfficeError($translate.instant, error_code);
      }
    }

    jmkernel['jm_callback_NotifyUploadResult'] = function(param, cm_param, error_code) {
      if(error_code) {
        msgrHelper.ShowWebOfficeError($translate.instant, error_code);
      }
    }

    jmkernel['jm_callback_NotifyDownloadResult'] = function(param, cm_param, error_code) {
      cm_param._progress(0);
      hmtgHelper.fast_apply();
      if(error_code) {
        msgrHelper.ShowWebOfficeError2($translate.instant, error_code);
      } else {
        checkMsg.callback_DownloadComplete(param, cm_param);
      }
    }

    jmkernel['jm_callback_NotifyViewRecordResult'] = function() {
      hmtgHelper.MessageBox($translate.instant('IDS_VIEW_RECORD_FAIL'), 0);
    }

    jmkernel['jm_callback_NotifyJnrPasswordResult'] = function(param, cm_param, error_code) {
      checkMsg.callback_NotifyJnrPasswordResult(param, cm_param, error_code);
    }

    jmkernel['jm_callback_NotifyChangeTitleResult'] = function(param, cm_param, error_code) {
      checkMsg.callback_NotifyChangeTitleResult(param, cm_param, error_code);
    }

    jmkernel['jm_callback_NotifyChangeFileProgress'] = function(param, cm_param) {
      $rootScope.$broadcast(hmtgHelper.WM_JNR_PROGRESS, param, cm_param._progress(), cm_param._cache_item());
    }

    jmkernel['jm_callback_ViewRecord'] = function(param, cm_param, data) {
      $rootScope.$broadcast(hmtgHelper.WM_VIEW_RECORD, param, data, cm_param._cache_item());
    }

    jmkernel['jm_callback_UpdateEventList'] = function(param) {
      jnagentDlg.update_event_list(param);
    }

    jmkernel['jm_callback_UpdatePublishFileList'] = function(param) {
      jnagentDlg.update_publish_file_list(param);
    }

    jmkernel['jm_callback_UpdatePgc'] = function(param, group_id) {
      jnagentDlg.update_pgc(param);
      imDlg.callback_UpdatePgc(param, group_id);
    }

    jmkernel['jm_callback_UpdateVisitor'] = function(param) {
      jnagentDlg.update_visitor(param);
    }

    jmkernel['jm_callback_ShowTalkToError'] = function(param, visitor_name, result) {
      msgrHelper.ShowMessageBox($translate.instant, param, $translate.instant(result == 1 ? 'IDS_FORMAT_TALKTO1' : 'IDS_FORMAT_TALKTO2').replace('#username#', hmtg.util.decodeUtf8(visitor_name)));
    }

    jmkernel['jm_callback_VisitorSessionAlert'] = function(param, visitor_name) {
      hmtg.util.logUtf8("visitor '" + visitor_name + "' is leaving message in your office " + param._homepage());
      hmtgSound.ShowInfoPrompt(function() {
        return $translate.instant('IDS_FORMAT_ALERT_VISITOR_SESSION')
        .replace('#visitor#', hmtg.util.decodeUtf8(visitor_name))
        .replace('#office#', hmtg.util.decodeUtf8(param._name_or_homepage2()));
      }, 20, appSetting.play_sound);
    }

    jmkernel['jm_callback_ClientInfoLoaded'] = function(param) {
      param._ngclass(imStyle.ngclass(param._im_style_flag()));
      param._ngstyle(imStyle.ngstyle(param._im_style_flag()));
      param._imstyle(imStyle.style2object(param._im_style_flag()));
      jnagentDlg.update_contact_group(param);
      jnagentDlg.update_psf_list(param);
    }

    jmkernel['jm_callback_GroupTyping'] = function(param, group_id, src_id, size) {
      imDlg.callback_GroupTyping(param, group_id, src_id, size);
    }

    jmkernel['jm_callback_TypingIn'] = function(param, src_id) {
      imDlg.callback_TypingIn(param, src_id);
    }

    function online_alert(param, userid) {
      if(!appSetting.alert_online) return;
      if(!hmtg.jmkernel.jm_info_IsContact(param, userid)) return;
      var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, userid);
      if(!this_us) return;
      hmtgSound.ShowInfoPrompt(function() {
        return $translate.instant('IDS_FORMAT_ALERT_SIGNIN1')
        .replace('#username#', hmtg.util.decodeUtf8(this_us._username()))
        .replace('#office#', hmtg.util.decodeUtf8(param._name_or_homepage3()))
        ;
      }, 20, false);
      if(appSetting.play_sound) {
        hmtgSound.playOnlineSound();
      }
    }
    jmkernel['jm_callback_NotifyOnlineAlertMMC'] = function(param, userid) {
      online_alert(param, userid);
    }
    jmkernel['jm_callback_NotifyOnlineAlert'] = function(param, userid) {
      online_alert(param, userid);
    }

    jmkernel['jm_callback_JoinGroup'] = function(param, group_id, join_id, join_name) {
      imDlg.callback_JoinGroup(param, group_id, join_id, join_name);
    }
    jmkernel['jm_callback_LeaveGroup'] = function(param, group_id, left_id) {
      imDlg.callback_LeaveGroup(param, group_id, left_id);
    }
    jmkernel['jm_callback_StopPgc'] = function(param, group_id) {
      imDlg.callback_StopPgc(param, group_id);
    }
    jmkernel['jm_callback_InitPgc'] = function(param, group_id, peer_id) {
      imDlg.callback_InitPgc(param, group_id, peer_id);
    }

    jmkernel['jm_callback_CreateGroupFail'] = function(param, peer_id, third_id, error_code) {
      imDlg.callback_CreateGroupFail(param, peer_id, third_id, error_code);
    }

    jmkernel['jm_callback_JoinGroupFail'] = function(param, group_id, join_id, error_code) {
      imDlg.callback_JoinGroupFail(param, group_id, join_id, error_code);
    }

    jmkernel['jm_callback_NotifyServerIMLogChange'] = function(param) {
      imDlg.callback_NotifyServerIMLogChange(param);
    }

    jmkernel.jm_command_CallbackReady();
  }
])

.service('imContainer', ['$rootScope',
  function($rootScope) {
    this.win_count = 1;
    this.max_win = 12;
    this.is_main_visible = true;
    this.is_main_minimized = false;
  }
])

.controller('MsgrCtrl', ['$scope', 'Msgr', '$translate', 'hmtgHelper', 'jnagentDlg', '$modal', 'jnjContent',
        '$rootScope', 'msgrHelper', 'hmtgSound', 'imDlg', 'imContainer', 'appSetting', 'hmtgAlert',
        'checkIM', 'checkMsg', '$ocLazyLoad',
  function($scope, Msgr, $translate, hmtgHelper, jnagentDlg, $modal, jnjContent, $rootScope, msgrHelper,
        hmtgSound, imDlg, imContainer, appSetting, hmtgAlert, checkIM, checkMsg, $ocLazyLoad) {
    $scope.main = jnagentDlg;
    $scope.as = appSetting;
    $scope.ic = imContainer;
    $scope.im_array = imDlg.im_array;
    $scope.iml_array = imDlg.iml_array;
    $scope.cim_array = checkIM.cim_array;
    $scope.cm_array = checkMsg.cm_array;
    $scope.msgr_main = document.getElementById('msgrMain');

    var msgr_root = document.getElementById('msgr');
    $scope.is_fullscreen = false;
    if(msgr_root) {
      $scope.request_fullscreen = msgr_root.requestFullscreen
        || msgr_root.msRequestFullscreen
        || msgr_root.mozRequestFullScreen
        || msgr_root.webkitRequestFullscreen
      ;
    }

    /*
    function adjust_height() {
    $scope.style_height = { 'height': (hmtgHelper.view_port_height * 0.9) + 'px' };
    if(!hmtgHelper.inside_angular) $scope.$digest();
    }
    hmtgHelper.inside_angular++;
    //adjust_height();
    hmtgHelper.inside_angular--;
    */
    $scope.$on(hmtgHelper.WM_HEIGHT_CHANGED, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    var myheight = 100;
    $scope.style_msgr_height = function() {
      var old = myheight;
      if($rootScope.nav_item == 'msgr') {
        var offset = {};
        hmtg.util.calcOffset($scope.msgr_main, offset);
        if(offset.y) {
          myheight = Math.max(((hmtgHelper.view_port_height >> 1) + (hmtgHelper.view_port_height >> 3)), hmtgHelper.view_port_height - offset.y - 1);
          //myheight -= imContainer.win_count <= 1 ? 37 : 67;
        }
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

    $scope.row_fluid = function() {
      if(imContainer.win_count <= 1) return '';
      return 'row-fluid';
    }
    $scope.col_area = function() {
      if(imContainer.win_count <= 1) return '';
      if(imContainer.win_count == 2) return 'col-xs-6';
      if(imContainer.win_count == 3) return 'col-xs-4';
      if(imContainer.win_count == 4) return 'col-xs-3';
      if(imContainer.win_count <= 6) return 'col-xs-2';
      return 'col-xs-1';
    }

    $scope.OnShowMsgr = function() {
      if(!imContainer.is_main_visible) {
        imContainer.is_main_visible = true;
        imContainer.is_main_minimized = false;
        imContainer.win_count++;
        hmtgHelper.inside_angular++;
        adjust_max_win();
        hmtgHelper.inside_angular--;
      }
    };

    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, adjust_max_win);
    $scope.$on(hmtgHelper.WM_MAX_WIN_CHANGED, adjust_max_win);

    function decrease_win_count() {
      var i;

      if(imContainer.win_count <= imContainer.max_win) return;
      for(i = imDlg.iml_array.length - 1; i >= 0; i--) {
        if(imDlg.iml_array[i].visible) {
          imDlg.iml_array[i].visible = false;
          imContainer.win_count--;
          if(imContainer.win_count <= imContainer.max_win) break;
        }
      }

      if(imContainer.win_count <= imContainer.max_win) return;
      for(i = imDlg.im_array.length - 1; i >= 0; i--) {
        if(imDlg.im_array[i].visible) {
          imDlg.im_array[i].visible = false;
          imContainer.win_count--;
          if(imContainer.win_count <= imContainer.max_win) break;
        }
      }

      if(imContainer.win_count <= imContainer.max_win) return;
      for(i = checkIM.cim_array.length - 1; i >= 0; i--) {
        if(checkIM.cim_array[i].visible) {
          checkIM.cim_array[i].visible = false;
          imContainer.win_count--;
          if(imContainer.win_count <= imContainer.max_win) break;
        }
      }

      if(imContainer.win_count <= imContainer.max_win) return;
      for(i = checkMsg.cm_array.length - 1; i >= 0; i--) {
        if(checkMsg.cm_array[i].visible) {
          checkMsg.cm_array[i].visible = false;
          imContainer.win_count--;
          if(imContainer.win_count <= imContainer.max_win) break;
        }
      }

      if(imContainer.win_count <= imContainer.max_win) return;
      if(imContainer.is_main_visible) {
        imContainer.is_main_visible = false;
        imContainer.win_count--;
      }
    }

    function increase_win_count() {
      imDlg.delayed_update(); // to adjust the potential strange IM height, which is brought up from invisible state

      var i;
      if(!imContainer.is_main_visible && !imContainer.is_main_minimized) {
        imContainer.is_main_visible = true;
        imContainer.win_count++;
      }
      if(imContainer.win_count >= imContainer.max_win) return;
      for(i = 0; i < checkMsg.cm_array.length; i++) {
        if(!checkMsg.cm_array[i].visible && !checkMsg.cm_array[i].minimized) {
          checkMsg.cm_array[i].visible = true;
          imContainer.win_count++;
          if(imContainer.win_count >= imContainer.max_win) break;
        }
      }
      if(imContainer.win_count >= imContainer.max_win) return;
      for(i = 0; i < checkIM.cim_array.length; i++) {
        if(!checkIM.cim_array[i].visible && !checkIM.cim_array[i].minimized) {
          checkIM.cim_array[i].visible = true;
          imContainer.win_count++;
          if(imContainer.win_count >= imContainer.max_win) break;
        }
      }
      /*
      if(imContainer.win_count >= imContainer.max_win) return;
      for(i = 0; i < imDlg.im_array.length; i++) {
      if(!imDlg.im_array[i].visible && !imDlg.im_array[i].minimized) {
      imDlg.im_array[i].visible = true;
      imDlg.im_array[i].msg = false;
      imContainer.win_count++;
      if(imContainer.win_count >= imContainer.max_win) break;
      }
      }
      */
      if(imContainer.win_count >= imContainer.max_win) return;
      for(i = 0; i < imDlg.iml_array.length; i++) {
        if(!imDlg.iml_array[i].visible && !imDlg.iml_array[i].minimized) {
          imDlg.iml_array[i].visible = true;
          imContainer.win_count++;
          if(imContainer.win_count >= imContainer.max_win) break;
        }
      }

      if(!imContainer.win_count) {
        imContainer.is_main_visible = true;
        imContainer.is_main_minimized = false;
        imContainer.win_count++;
      }
    }

    function adjust_max_win() {
      // screen resolution statistics
      // http://www.w3schools.com/browsers/browsers_display.asp
      var count = (hmtgHelper.view_port_width / 360) >> 0;  // original iPhone 4: 640 x 960
      if(count < 2) {
        // 280 is necessary for the 144px thumbnail used in file transfer
        count = Math.min(2, ((hmtgHelper.view_port_width / 280) >> 0));
      }
      if(count > appSetting.max_win) count = appSetting.max_win;
      if(count < 1) count = 1;
      imContainer.max_win = count;
      var i;
      var old_count;
      old_count = imContainer.win_count;
      if(imContainer.win_count > imContainer.max_win) {
        decrease_win_count();
      } else if(imContainer.win_count < imContainer.max_win) {
        increase_win_count();
      }
      if(old_count != imContainer.win_count) {
        if(!hmtgHelper.inside_angular) $scope.$digest();
      }
    }

    $scope.scroll_top = function() {
      $scope.msgr_main.scrollTop = 0;
    }
    $scope.scroll_bottom = function() {
      $scope.msgr_main.scrollTop = $scope.msgr_main.scrollHeight;
    }

    $scope.minimize = function() {
      if(imContainer.win_count >= 2 && imContainer.is_main_visible) {
        imContainer.is_main_visible = false;
        imContainer.is_main_minimized = true;
        imContainer.win_count--;

        if(imContainer.win_count < imContainer.max_win) {
          increase_win_count();
        }
      }
    }

    $scope.extend = function() {
      if(imContainer.win_count >= 2 && imContainer.is_main_visible) {
        var i;
        for(i = checkMsg.cm_array.length - 1; i >= 0; i--) {
          if(checkMsg.cm_array[i].visible) {
            checkMsg.cm_array[i].visible = false;
            checkMsg.cm_array[i].minimized = true;
          }
        }
        for(i = checkIM.cim_array.length - 1; i >= 0; i--) {
          if(checkIM.cim_array[i].visible) {
            checkIM.cim_array[i].visible = false;
            checkIM.cim_array[i].minimized = true;
          }
        }
        for(i = imDlg.im_array.length - 1; i >= 0; i--) {
          if(imDlg.im_array[i].visible) {
            imDlg.im_array[i].visible = false;
            imDlg.im_array[i].minimized = true;
          }
        }
        for(i = imDlg.iml_array.length - 1; i >= 0; i--) {
          if(imDlg.iml_array[i].visible) {
            imDlg.iml_array[i].visible = false;
            imDlg.iml_array[i].minimized = true;
          }
        }
        imContainer.win_count = 1;
      }
    }

    $scope.minimize_item = function(target) {
      if(imContainer.win_count >= 2 && target.visible) {
        target.visible = false;
        target.minimized = true;
        imContainer.win_count--;

        increase_win_count();
      }
    }

    $scope.scroll_top_im = function(target) {
      target.IM0[0].scrollTop = 0;
    }
    $scope.scroll_bottom_im = function(target) {
      target.IM0[0].scrollTop = target.IM0[0].scrollHeight;
    }

    $scope.close_im = function(target) {
      var i;
      for(i = imDlg.im_array.length - 1; i >= 0; i--) {
        if(imDlg.im_array[i] == target) {
          if(target.HaveUnsavedFileTransfer()) {
            hmtgHelper.OKCancelMessageBox($translate.instant('IDS_LOSE_FILE_TRANSFER_ALERT'), 0, ok);
          } else if(target.HaveActiveFileTransfer()) {
            hmtgHelper.OKCancelMessageBox($translate.instant('IDS_CANCEL_FILE_TRANSFER_ALERT'), 0, ok);
          } else if(target.pc && target.webrtc_connected) {
            hmtgHelper.OKCancelMessageBox($translate.instant('IDS_CANCEL_WEBRTC_SESSION_ALERT'), 0, ok);
          } else {
            close_this_im(target, i);
          }
          return;
        }
      }
      for(i = imDlg.iml_array.length - 1; i >= 0; i--) {
        if(imDlg.iml_array[i] == target) {
          target.onRelease();
          imDlg.iml_array.splice(i, 1);

          if(target.visible) {
            imContainer.win_count--;
            increase_win_count();
          }

          return;
        }
      }

      function ok() {
        close_this_im(target, i);
      }
      function close_this_im(target, i) {
        target.onRelease();
        hmtgAlert.remove_im_alert(target);
        imDlg.im_array.splice(i, 1);

        if(target.visible) {
          imContainer.win_count--;
          increase_win_count();
        }
      }
    }

    $scope.close_all_im = function() {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_CLOSE_ALL_IM_PROMPT'), 0, ok);
      function ok() {
        var i;
        var changed = false;
        for(i = imDlg.im_array.length - 1; i >= 0; i--) {
          imDlg.im_array[i].onRelease();
          hmtgAlert.remove_im_alert(imDlg.im_array[i]);

          if(imDlg.im_array[i].visible) {
            imContainer.win_count--;
            changed = true;
          }

        }
        imDlg.im_array.length = 0;
        if(changed) increase_win_count();
      }
    }

    $scope.close_all_iml = function() {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_CLOSE_ALL_IML_PROMPT'), 0, ok);
      function ok() {
        var i;
        var changed = false;
        for(i = imDlg.iml_array.length - 1; i >= 0; i--) {
          imDlg.iml_array[i].onRelease();

          if(imDlg.iml_array[i].visible) {
            imContainer.win_count--;
            changed = true;
          }

        }
        imDlg.iml_array.length = 0;
        if(changed) increase_win_count();
      }
    }

    $scope.extend_item = function(target) {
      if(imContainer.win_count >= 2 && target.visible) {
        imContainer.is_main_visible = false;
        imContainer.is_main_minimized = true;
        var i;
        for(i = checkMsg.cm_array.length - 1; i >= 0; i--) {
          if(checkMsg.cm_array[i] == target) continue;
          if(checkMsg.cm_array[i].visible) {
            checkMsg.cm_array[i].visible = false;
            checkMsg.cm_array[i].minimized = true;
          }
        }
        for(i = checkIM.cim_array.length - 1; i >= 0; i--) {
          if(checkIM.cim_array[i] == target) continue;
          if(checkIM.cim_array[i].visible) {
            checkIM.cim_array[i].visible = false;
            checkIM.cim_array[i].minimized = true;
          }
        }
        for(i = imDlg.im_array.length - 1; i >= 0; i--) {
          if(imDlg.im_array[i] == target) continue;
          if(imDlg.im_array[i].visible) {
            imDlg.im_array[i].visible = false;
            imDlg.im_array[i].minimized = true;
          }
        }
        for(i = imDlg.iml_array.length - 1; i >= 0; i--) {
          if(imDlg.iml_array[i] == target) continue;
          if(imDlg.iml_array[i].visible) {
            imDlg.iml_array[i].visible = false;
            imDlg.iml_array[i].minimized = true;
          }
        }
        imContainer.win_count = 1;
      }
    }

    $scope.myim = { 'open': 0 };
    $scope.choose_im = function(im, from_alert) {
      $scope.myim.open = 0;
      if(!from_alert) {
        hmtgAlert.remove_im_alert(im);
      }
      if(im.visible) {
        im.highlight();
        setTimeout(function() { im.text_input.focus(); }, 0);
        return;
      }
      if(imContainer.win_count + 1 > imContainer.max_win) {
        imContainer.max_win--;
        decrease_win_count();
        imContainer.max_win++;
      }
      im.visible = true;
      im.msg = false;
      im.minimized = false;
      imContainer.win_count++;
      im.highlight();
      setTimeout(function() { im.text_input.focus(); }, 0);
    }

    $scope.$on(hmtgHelper.WM_SHOW_IM, function(event, target, from_alert) {
      $rootScope.nav_item = 'msgr';
      $rootScope.tabs[0].active = true;
      $scope.choose_im(target, from_alert);
      setTimeout(function() {
        imDlg.fast_update();

        // this focus is necessary. the one in choose_im could be in-effective in certain situation,
        // such as add a person to group conversation
        target.text_input.focus();

        // the following 2nd timeout is to recalcuate the IM window height,
        // which could be a strange value due to the previous invisible status
        imDlg.delayed_update();
      }, 0);
    });

    $scope.$on(hmtgHelper.WM_SHOW_CM, function(event, param) {
      $rootScope.nav_item = 'msgr';
      $rootScope.tabs[0].active = true;

      checkMsg.showCM($scope, param);
    });

    $scope.$on(hmtgHelper.WM_SHARE_JNR, function(event, param, item) {
      $scope.param = param;
      $scope.share_url = item.share_url;
      $scope.subject = item.title;
      $scope.share_jnj = item.share_jnj;
      $scope.duration = item.duration;
      $scope.item = item;

      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_share_jnr' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/ShareJNR.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'ShareJNRModalCtrl',
          size: 'lg',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function() {
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_share_jnr fails');
      });
    });

    $scope.$on(hmtgHelper.WM_VIEW_RECORD, function(event, param, data, item) {
      $scope.param = param;
      $scope.data = data;
      $scope.item = item;

      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_view_record' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/ViewRecord.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'ViewRecordModalCtrl',
          size: 'lg',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function() {
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_view_record fails');
      });
    });

    $scope.myiml = { 'open': 0 };
    $scope.choose_iml = function(im) {
      $scope.myiml.open = 0;
      if(im.visible) {
        im.highlight();
        return;
      }
      if(imContainer.win_count + 1 > imContainer.max_win) {
        imContainer.max_win--;
        decrease_win_count();
        imContainer.max_win++;
      }
      im.visible = true;
      im.minimized = false;
      imContainer.win_count++;
      im.highlight();
    }

    $scope.is_disconnected = function(im) {
      var param = im.m_param;
      return (param._quit() || param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED);
    }

    $scope.upload = function(cm) {
      var param = cm.m_param;
      if(param._quit() || param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED || !cm.cm_param._connected()) return;
      checkMsg.upload($scope, cm);
    }

    $scope.choose_cim = function(cim) {
      if(cim.visible) {
        cim.highlight();
        return;
      }
      if(imContainer.win_count + 1 > imContainer.max_win) {
        imContainer.max_win--;
        decrease_win_count();
        imContainer.max_win++;
      }
      cim.visible = true;
      cim.minimized = false;
      imContainer.win_count++;
      cim.highlight();
    }

    $scope.close_cim = function(target) {
      var i;
      for(i = checkIM.cim_array.length - 1; i >= 0; i--) {
        if(checkIM.cim_array[i] == target) {
          if(target.visible) {
            imContainer.win_count--;
          }
          if(target.cim_param) {
            target.cim_param.disconnect();
          }
          checkIM.cim_array.splice(i, 1);
          increase_win_count();
          return;
        }
      }
    }

    $scope.refresh_cim = function(target) {
      if(target.cim_param) {
        target.cim_param.disconnect();
      }
      checkIM.retrieveList($scope, target);
    }

    $scope.close_cm = function(target) {
      var i;
      for(i = checkMsg.cm_array.length - 1; i >= 0; i--) {
        if(checkMsg.cm_array[i] == target) {
          if(target.visible) {
            imContainer.win_count--;
          }
          if(target.cm_param) {
            target.cm_param.disconnect();
            var param = target.m_param;
            // get around a bug in MCU 3.23.0 to 3.23.3
            if(param._server_version_major() == 3 && param._server_version_minor() == 23 && param._server_version_subminor() < 4) {
              hmtgHelper.inside_angular++;
              hmtg.jmkernel.jm_command_SignOutOffice(param);
              hmtg.jmkernel.jm_command_ReconnectOffice(param);
              hmtgHelper.inside_angular--;
            }
          }
          checkMsg.cm_array.splice(i, 1);
          increase_win_count();
          return;
        }
      }
    }

    $scope.refresh_cm = function(target) {
      if(target.cm_param) {
        target.cm_param.disconnect();
        var param = target.m_param;
        // get around a bug in MCU 3.23.0 to 3.23.3
        if(param._server_version_major() == 3 && param._server_version_minor() == 23 && param._server_version_subminor() < 4) {
          hmtgHelper.inside_angular++;
          hmtg.jmkernel.jm_command_SignOutOffice(param);
          hmtg.jmkernel.jm_command_ReconnectOffice(param);
          hmtgHelper.inside_angular--;
          setTimeout(function() {
            checkMsg.retrieveList($scope, target);
          }, 1000);
          return;
        }
      }
      checkMsg.retrieveList($scope, target);
    }

    $scope.scroll_top_cim = function(target) {
      target.cim_div.scrollTop = 0;
    }
    $scope.scroll_bottom_cim = function(target) {
      target.cim_div.scrollTop = target.cim_div.scrollHeight;
    }

    $scope.scroll_top_cm = function(target) {
      target.cm_div.scrollTop = 0;
    }
    $scope.scroll_bottom_cm = function(target) {
      target.cm_div.scrollTop = target.cm_div.scrollHeight;
    }

    $scope.fullscreen1 = function() {
      if($scope.request_fullscreen) {
        $scope.request_fullscreen.call(msgr_root);
      }
    }

    $scope.fullscreen0 = function() {
      hmtgHelper.inside_angular++;
      hmtgHelper.exitFullScreen(true);
      hmtgHelper.inside_angular--;
      $scope.is_fullscreen = false;
    }

    $scope.get_servers = function() {
      return jnagentDlg.data;
    }

    $rootScope.$on('$translateChangeEnd', function() {
      var i;
      for(i = 0; i < jnagentDlg.data.length; i++) {
        var server = jnagentDlg.data[i];
        var param = jnagentDlg.data[i].pointer;
        jnagentDlg.update_lang_server(server, param);
        if(server.folders) {
          for(var j = 0; j < server.folders.length; j++) {
            var folder = server.folders[j];
            jnagentDlg.update_lang_folder(folder, param, folder.type, folder.pointer);
            if(folder.items) {
              for(var k = 0; k < folder.items.length; k++) {
                var item = folder.items[k];
                jnagentDlg.update_lang_item(item, param, item.type, item.pointer);
              }
            }
          }
        }
      }
      for(i = imDlg.im_array.length - 1; i >= 0; i--) {
        imDlg.im_array[i].update_typing_status();
        imDlg.im_array[i].SetTitleText();
      }
      for(i = imDlg.iml_array.length - 1; i >= 0; i--) {
        imDlg.iml_array[i].SetTitleText();
      }
    });

    $scope.click_server = function(server, menu, e) {
      if(menu.onclick) menu.onclick($scope, $modal, server, menu, e);
    }

    $scope.click_folder = function(server, folder, menu) {
      if(menu.onclick) menu.onclick($scope, $modal, server, folder, menu);
    }

    $scope.click_item = function(server, folder, item, menu) {
      if(menu.onclick) menu.onclick($scope, $modal, server, folder, item, menu);
    }

    $scope.toggle_fold = function(server, folder) {
      jnagentDlg.toggle_fold($scope, $modal, server, folder);
    }

    $scope.$on(hmtgHelper.WM_UPDATE_MSGR, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_URL_SIGNIN, function(event, param) {
      jnagentDlg.SigninDlg($scope, $modal, false, param);
    });

  }
])

.controller('MsgrActionHeaderCtrl', ['$scope', '$modal', 'jnagentDlg', '$translate', 'msgrHelper', 'hmtgHelper',
  'appSetting', 'imContainer', 'hmtgAlert',
  function($scope, $modal, jnagentDlg, $translate, msgrHelper, hmtgHelper, appSetting, imContainer, hmtgAlert) {
    $scope.as = appSetting;
    $scope.hmtg = hmtg;
    $scope.OnSignin = function(size) {
      if(hmtg.util.test_error & 1) {
        $scope.$digest();  // trigger an angular error
      }
      jnagentDlg.SigninDlg($scope, $modal);
    };
    $scope.mystatus = { 'open': 0 };
    $scope.click_mystatus = function(menu) {
      $scope.mystatus.open = 0;
      hmtgHelper.inside_angular++;
      hmtg.jmkernel.jm_command_SetStatus(menu.value);
      hmtgHelper.inside_angular--;
    }
    $scope.ontoggle_mystatus = function(open) {
      var c = hmtg.jmkernel.jm_info_GlobalPointer()._g_us_status();
      $scope.status = [];
      if(open) {
        for(var i = 1; i <= 5; i++) {
          $scope.status.push({ "text": (c != i ? "" : "* ") + $translate.instant(msgrHelper.userstatus2id(i, 0, 1)) + (c != i ? "" : " *"), "value": i });
        }
      }
    }
  }
])

.controller('AppMessageBoxModalCtrl', ['$scope', '$modalInstance', '$modal', 'Msgr', '$interval', '$translate',
  function($scope, $modalInstance, $modal, Msgr, $interval, $translate) {
    // hide_cancel is passed from parent,
    // assign it to local_hide_cancel will keep it local
    $scope.local_msgbox_text = $scope.msgbox_text;
    $scope.local_hide_cancel = $scope.hide_cancel;
    $scope.local_timeout = $scope.timeout;
    if($scope.local_timeout) $scope.local_timeout = $scope.local_timeout >>> 0;
    $scope.ok_value0 = $scope.ok_value = $translate.instant('ID_OK');
    if($scope.local_timeout) {
      $scope.ok_value = $scope.ok_value0 + '(' + $scope.local_timeout + ')';
      $scope.auto_ok_timerID = $interval(auto_ok_timer, 1000);
    }

    function auto_ok_timer() {
      $scope.local_timeout--;
      $scope.ok_value = $scope.ok_value0 + '(' + $scope.local_timeout + ')';

      if(!$scope.local_timeout) {
        $interval.cancel($scope.auto_ok_timerID);
        $scope.auto_ok_timerID = null;
        $modalInstance.close({ timeout: true });
      }
    }

    $scope.ok = function() {
      if($scope.auto_ok_timerID) {
        $interval.cancel($scope.auto_ok_timerID);
        $scope.auto_ok_timerID = null;
      }
      $modalInstance.close();
    };

    $scope.cancel = function() {
      if($scope.auto_ok_timerID) {
        $interval.cancel($scope.auto_ok_timerID);
        $scope.auto_ok_timerID = null;
      }
      $modalInstance.dismiss();
    };
  }
])

;
