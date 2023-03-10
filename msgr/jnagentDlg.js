/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('msgr')

.service('jnagentDlg', ['$translate', 'msgrHelper', 'appSetting', 'hmtgHelper', '$rootScope', '$ocLazyLoad', 'hmtgAlert',
  'hmtgSound', 'imDlg', 'checkIM', 'imContainer', 'checkMsg', '$http', 'jnjContent',
  function($translate, msgrHelper, appSetting, hmtgHelper, $rootScope, $ocLazyLoad, hmtgAlert, hmtgSound, imDlg, checkIM,
    imContainer, checkMsg, $http, jnjContent) {
    var _jnagentDlg = this;
    this.data = [];
    //this.has_action_menu = ''; // whether there is any context menu

    this.g_last_short_message_tick = hmtg.util.GetTickCount() - 1000;
    this.MIN_SHORT_MESSAGE_INTERVEL = 100;  // at most 10 short messages per second

    var FOLDER_TYPE_SHARE_FILE = 2;
    var FOLDER_TYPE_PUBLISH_FILE = 3;
    var FOLDER_TYPE_VISITOR = 4;
    var FOLDER_TYPE_EVENT = 5;
    var FOLDER_TYPE_PGC = 6;
    var FOLDER_TYPE_CONTACT = 7;
    var FOLDER_TYPE_OTHER_USER = 8;

    // helper
    this.find_item = function(array, pointer) {
      var i;
      for(i = 0; i < array.length; i++) {
        if(array[i].pointer === pointer) return i;
      }
      return -1;
    }
    this.find_user_item = function(array, this_us) {
      var i;
      for(i = 0; i < array.length; i++) {
        if(array[i].pointer.this_us === this_us) return i;
        if(!array[i].pointer.this_us && array[i].pointer.contact.id == this_us._userid()) {
          array[i].pointer.this_us = this_us;
          return i;
          ;
        }
      }
      return -1;
    }
    this.find_contact_item = function(array, id) {
      var i;
      for(i = 0; i < array.length; i++) {
        if(array[i].pointer.contact && array[i].pointer.contact.id === id) return i;
      }
      return -1;
    }
    function pointer2id(pointer) {
      return pointer.this_us ? pointer.this_us._userid() : pointer.contact.id;
    }
    function pointer2name(pointer) {
      return pointer.this_us ? pointer.this_us._username() : pointer.contact.name;
    }
    /*
    function pointer2pm(pointer) {
    if(pointer.this_us) {
    if(pointer.this_us._status()) {
    return pointer.this_us._personal_info();
    }
    return pointer.this_us._personal_info() | pointer.contact.pm;
    }
    return pointer.contact.pm;
    }
    */
    function find_contact(group, id) {
      var i;
      for(i = 0; i < group.m_pContactArray.length; i++) {
        if(group.m_pContactArray[i].id == id) return true;
      }
      return false;
    }


    this.update_lang_folder = function(folder, param, type, pointer) {
      switch(type) {
        case FOLDER_TYPE_SHARE_FILE:
          this.update_lang_folder_share(folder, param, pointer);
          break;
        case FOLDER_TYPE_PUBLISH_FILE:
          this.update_lang_folder_publish(folder, param, pointer);
          break;
        case FOLDER_TYPE_VISITOR:
          this.update_lang_folder_visitor(folder, param, pointer);
          break;
        case FOLDER_TYPE_EVENT:
          this.update_lang_folder_event(folder, param, pointer);
          break;
        case FOLDER_TYPE_PGC:
          this.update_lang_folder_pgc(folder, param, pointer);
          break;
        case FOLDER_TYPE_CONTACT:
          this.update_lang_folder_contact(folder, param, pointer);
          break;
        case FOLDER_TYPE_OTHER_USER:
          this.update_lang_folder_other_user(folder, param, pointer);
          break;
        default:
          break;
      }
    }
    this.toggle_fold = function($scope, $modal, server, folder) {
      switch(folder.type) {
        case FOLDER_TYPE_SHARE_FILE:
          this.OnToggleShare($scope, $modal, server, folder);
          break;
        case FOLDER_TYPE_PUBLISH_FILE:
          this.OnTogglePublish($scope, $modal, server, folder);
          break;
        case FOLDER_TYPE_VISITOR:
          this.OnToggleVisitor($scope, $modal, server, folder);
          break;
        case FOLDER_TYPE_EVENT:
          this.OnToggleEvent($scope, $modal, server, folder);
          break;
        case FOLDER_TYPE_PGC:
          this.OnTogglePGC($scope, $modal, server, folder);
          break;
        case FOLDER_TYPE_CONTACT:
          this.OnToggleContact($scope, $modal, server, folder);
          break;
        case FOLDER_TYPE_OTHER_USER:
          this.OnToggleOtherUser($scope, $modal, server, folder);
          break;
        default:
          break;
      }
    }
    this.update_lang_item = function(item, param, type, pointer) {
      switch(type) {
        case FOLDER_TYPE_SHARE_FILE:
          this.update_lang_item_share(item, param, pointer);
          break;
        case FOLDER_TYPE_PUBLISH_FILE:
          this.update_lang_item_publish(item, param, pointer);
          break;
        case FOLDER_TYPE_VISITOR:
          this.update_lang_item_visitor(item, param, pointer);
          break;
        case FOLDER_TYPE_EVENT:
          this.update_lang_item_event(item, param, pointer);
          break;
        case FOLDER_TYPE_PGC:
          this.update_lang_item_pgc(item, param, pointer);
          break;
        case FOLDER_TYPE_CONTACT:
        case FOLDER_TYPE_OTHER_USER:
          this.update_lang_item_user(item, param, pointer);
          break;
        default:
          break;
      }
    }

    this.RequestDlg = function(action_f, update_f) {
      var unique_id = hmtg.util.GetTickCount();
      _jnagentDlg.g_unique_id = unique_id;
      _jnagentDlg.g_iRequestStatus = 1; // ready
      if(!action_f()) {
        _jnagentDlg.g_iRequestStatus = 4; // user quit
        return;
      }

      var item = {};
      item['timeout'] = 120;
      item['update'] = update_f;
      item['text'] = item['update']();
      item['type'] = 'success';
      item['jnj'] = '';
      item['timeout_action'] = item['cancel'] = function() {
        _jnagentDlg.g_unique_id--;
        _jnagentDlg.g_iRequestStatus = 4; // user quit
        _jnagentDlg.g_request_item = null;
      }

      _jnagentDlg.set_text_item(item);
    }

    this.set_text_item = function(item) {
      hmtgAlert.add_text_item(item);
      if(_jnagentDlg.g_request_item) {
        hmtgAlert.remove_text_item(_jnagentDlg.g_request_item);
      }
      _jnagentDlg.g_request_item = item;
    }

    function find_target_inviter(param) {
      var i;
      var array = _jnagentDlg.data;
      var target = [];
      for(i = 0; i < array.length; i++) {
        var param2 = array[i].pointer;
        if(!param2._quit()
            && !param2._guest()
            && param2._office_status()
            && param2._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED
            && param2._user_status_inited()
            ) {
          if(param2 == param) {
            target.unshift(param2);
          } else {
            target.push(param2);
          }
          if(target.length >= 100) break;
        }
      }
      if(!target.length && !_jnagentDlg.g_delay_inviter_param) {
        for(i = 0; i < array.length; i++) {
          var param2 = array[i].pointer;
          if(!param2._quit()
                && !param2._guest()
                && param2._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED
                && param2._user_status_inited()
                ) {
            if(param2 == param) {
              target.unshift(param2);
            } else {
              target.push(param2);
            }
            if(target.length >= 100) break;
          }
        }
      }
      return target;
    }

    // server level
    this.update_lang_server = function(server, param) {
      server.text = msgrHelper.CalcOfficeText($translate.instant, param);
      server.tooltip = msgrHelper.CalcOfficeTooltip($translate.instant, param);
    }

    this.prepare_server = function(server, param) {
      server.pointer = param;
      server.img = msgrHelper.CalcOfficeImageType(param);
      this.update_lang_server(server, param);
      server.open = 0;
      server.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_server(server, open); }
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) {
        server.folders = [];
        return;
      }
      // check whether it has any children, if it has, we can return now.
      // otherwise, need to add them all
      if(server.folders && server.folders.length) return;
      server.folders = [];
    }
    this.prepare_context_menu_server = function(server, open) {
      server.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'server') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'server';
      var param = server.pointer;
      if(!param._guest() && param._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED && param._user_status_inited()) {
        server.menu.push({ "text": $translate.instant('IDC_SET_STATUS'), "onclick": _jnagentDlg.OnMyStatus });
        server.menu.push({ "text": $translate.instant('IDS_TOOLTIP_IM_LAUNCH'), "onclick": _jnagentDlg.OnLaunch });
        server.menu.push({ "text": $translate.instant('ID_CHECK_MESSAGE'), "onclick": _jnagentDlg.OnCheckMsg });
        server.menu.push({ "text": $translate.instant('IDS_SERVER_IM_LOG'), "onclick": _jnagentDlg.OnCheckIM });
        if(param._group_im_cap()) {
          server.menu.push({ "text": $translate.instant('IDS_START_GROUP_IM'), "onclick": _jnagentDlg.OnGroupIM });
        }
        // not used
        //server.menu.push({ "text": $translate.instant('ID_VIEW_PROFILE'), "onclick": _jnagentDlg.OnViewProfile });
        server.menu.push({ "text": $translate.instant('ID_EDIT_PROFILE'), "onclick": _jnagentDlg.OnEditProfile });
        if(param._client_info_loaded()) {
          server.menu.push({ "text": $translate.instant('IDS_NEW_CONTACT_GROUP_TITLE'), "onclick": _jnagentDlg.OnNewContactGroup });
          server.menu.push({ "text": $translate.instant('IDD_DIALOG_PERSONAL_INFO'), "onclick": _jnagentDlg.OnPM });
          server.menu.push({ "text": $translate.instant('ID_RENAME'), "onclick": _jnagentDlg.OnRenameOffice });
        }
      }
      if(param._guest()) {
        server.menu.push({ "text": $translate.instant('ID_RENAME'), "onclick": _jnagentDlg.OnRenameOffice });
      }
      if(param._connection_status() >= 10000) {
        server.menu.push({ "text": $translate.instant('ID_RECONNECT'), "onclick": _jnagentDlg.OnReconnect });
        if(!param._guest() && param._ever_connected() && !param._password_error()) {
          var s = $translate.instant('IDC_SET_STATUS') + ': ' + $translate.instant(msgrHelper.userstatus2id(param._us_status(), 0, true));
          server.menu.push({ "text": $translate.instant('ID_QUICK_RECONNECT').replace('#status#', s), "onclick": _jnagentDlg.OnQuickReconnect });
          server.menu.push({ "text": $translate.instant('ID_SIGNOUT'), "onclick": _jnagentDlg.OnQuickReconnect2 });
        }
      }
      if(param._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED) {
        server.menu.push({ "text": $translate.instant('ID_SIGNOUT'), "onclick": _jnagentDlg.OnSignout });
      }
      server.menu.push({ "text": $translate.instant('ID_REMOVE_FILE'), "onclick": _jnagentDlg.OnRemove });
      if(this.data.length > 1) {
        server.menu.push({ "text": $translate.instant('ID_MOVE_OFFICE'), "onclick": _jnagentDlg.OnMoveOffice });
      }
    }
    this.OnReconnect = function($scope, $modal, server) {
      var param = server.pointer;
      if(param._connection_status() < 10000) return;
      if(param._guest()) {
        hmtgHelper.inside_angular++;
        hmtg.jmkernel.jm_command_ReconnectOffice(param);
        hmtgHelper.inside_angular--;
        return;
      }
      _jnagentDlg.SigninDlg($scope, $modal, true, param);
    }
    this.OnQuickReconnect = function($scope, $modal, server) {
      var param = server.pointer;
      if(param._connection_status() < 10000) return;
      if(param._guest()) return;
      hmtgHelper.inside_angular++;
      hmtg.jmkernel.jm_command_ReconnectOffice(param);
      hmtgHelper.inside_angular--;
    }
    this.OnQuickReconnect2 = function($scope, $modal, server) {
      var param = server.pointer;
      if(param._connection_status() < 10000) return;
      if(param._guest()) return;
      param._password_error(1);
    }
    this.OnMyStatus = function($scope, $modal, server, menu, event) {
      var param = server.pointer;
      if(menu.value) {
        hmtgHelper.inside_angular++;
        if(param._us_status() != menu.value)
          hmtg.jmkernel.jm_command_SetStatus(menu.value, param);
        hmtgHelper.inside_angular--;
      } else {
        index = server.menu.indexOf(menu);
        if(index == -1) return;

        // keep the pop up menu visible
        event.stopPropagation();

        server.open = 1;
        if(index == server.menu.length - 1 || !server.menu[index + 1].value) {
          // append
          var c = param._us_status();
          var f = [];
          for(var i = 1; i <= 5; i++) {
            server.menu.splice(++index, 0, { "text": (c != i ? " - " : " - * ") + $translate.instant(msgrHelper.userstatus2id(i, 0, 1)) + (c != i ? "" : " *"), "value": i, "onclick": _jnagentDlg.OnMyStatus });
          }
        } else {
          // remove
          server.menu.splice(index + 1, 5);
        }
      }
    }
    this.OnLaunch = function($scope, $modal, server) {
      hmtgSound.turnOnAudio();
      var param = server.pointer;
      hmtgHelper.inside_angular++;
      hmtg.jmkernel.jm_command_LaunchOffice(param);
      hmtgHelper.inside_angular--;
    }
    this.OnCheckMsg = function($scope, $modal, server) {
      checkMsg.showCM($scope, server.pointer);
    }
    this.OnCheckIM = function($scope, $modal, server) {
      checkIM.showCIM($scope, server.pointer);
    }
    this.OnGroupIM = function($scope, $modal, server) {
      var param = server.pointer;
      hmtg.jmkernel.jm_command_AddPerson(param, "", "\n", "\n"); // self pgc
    }
    /*
    this.OnViewProfile = function($scope, $modal, server) {
    var param = server.pointer;
    var now = hmtg.util.GetTickCount();
    if(!param._profile_up_to_date() || now - param._last_view_tick() >= 120000) {
    hmtg.jmkernel.jm_command_ViewProfile(param, true);
    } else {
    hmtg.jmkernel.jm_callback_ShowUserInfo(param);
    }
    }
    */
    this.OnNewContactGroup = function($scope, $modal, server) {
      var param = server.pointer;
      hmtgHelper.renameDialog($scope, '', $translate.instant('IDS_NEW_CONTACT_GROUP_TITLE'), hmtg.util.decodeUtf8(param._name_or_homepage2()), ok, 'new_contact_group', [param]);
      function ok(new_value) {
        hmtg.jmkernel.jm_command_AddContactGroup(param, new_value);
        _jnagentDlg.update_contact_group(param);
      }
    }
    this.OnPM = function($scope, $modal, server) {
      var param = server.pointer;
      hmtgHelper.renameDialog($scope, hmtg.util.decodeUtf8(param._personal_info()), $translate.instant('IDD_DIALOG_PERSONAL_INFO'), hmtg.util.decodeUtf8(param._name_or_homepage2()), ok, 'pm', [param]);
      function ok(new_value) {
        param._personal_info(new_value);
        server.text = msgrHelper.CalcOfficeText($translate.instant, param);
        hmtg.jmkernel.jm_command_TouchClientInfo(param);
        hmtg.jmkernel.jm_command_UpdatePersonalInfo(param);
      }
    }
    this.OnRenameOffice = function($scope, $modal, server) {
      var param = server.pointer;
      hmtgHelper.renameDialog($scope,
        hmtg.util.decodeUtf8(param._office_name()),
        $translate.instant('ID_RENAME'),
        msgrHelper.CalcOfficeText0($translate.instant, param),
        ok,
        'rename_office',
        [param]);
      function ok(new_value) {
        param._office_name(new_value);
        _jnagentDlg.update_lang_server(server, param);
        if(!param._guest()) {
          hmtg.jmkernel.jm_command_TouchClientInfo(param);
        }
        hmtg.jmkernel.jm_command_UpdateWebOfficeName(param);
        hmtg.jmkernel.jm_command_WriteWBL();
      }
    }
    this.OnSignout = function($scope, $modal, server) {
      var param = server.pointer;
      param._password_error(1);
      hmtgHelper.inside_angular++;
      hmtg.jmkernel.jm_command_SignOutOffice(param);
      hmtgHelper.inside_angular--;
    }
    this.OnEditProfile = function($scope, $modal, server) {
      var param = server.pointer;
      if(param._mmc_messenger()) {
        hmtgHelper.inside_angular++;
        _jnagentDlg.RequestDlg(function() {
          return hmtg.jmkernel.jm_command_MMCEditProfile(param, _jnagentDlg.g_unique_id);
        }, function() {
          return $translate.instant('IDS_PREPARE_EDIT_PROFILE');
        });
        hmtgHelper.inside_angular--;
        return;
      }
      $scope.editp_param = param;
      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_edit_profile' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/EditProfile.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'EditProfileModalCtrl',
          size: '',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function() {
          _jnagentDlg.update_lang_server(server, param);
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_edit_profile fails');
      });
    }
    this.OnMoveOffice = function($scope, $modal, server) {
      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_move_office' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/MoveOffice.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'MoveOfficeModalCtrl',
          size: 'lg',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function() {
        }, function() {
          hmtg.jmkernel.jm_command_ReorderWBL(_jnagentDlg.data);
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_move_office fails');
      });
    }
    this.OnRemove = function($scope, $modal, server) {
      var param = server.pointer;
      var text;
      if(imDlg.CheckIMConversationWindow(param)) {
        text = $translate.instant('IDS_FORMAT_CLOSE_CONVERSATION').replace('#homepage#', hmtg.util.decodeUtf8(param._homepage()));
      } else {
        text = $translate.instant('IDS_FORMAT_CONFIRM_REMOVE_OFFICE').replace('#homepage#', hmtg.util.decodeUtf8(param._homepage()));
      }
      hmtgHelper.OKCancelMessageBox(text, 0, ok);
      function ok() {
        hmtgHelper.inside_angular++;
        _jnagentDlg.remove_office($scope, $modal, param);
        hmtgHelper.inside_angular--;
      }
    }
    this.remove_office = function($scope, $modal, param) {
      var i;
      var changed;
      for(i = checkMsg.cm_array.length - 1; i >= 0; i--) {
        var cm = checkMsg.cm_array[i];
        if(cm.m_param != param) continue;

        if(cm.visible) {
          changed = true;
          imContainer.win_count--;
        }
        if(cm.cm_param) {
          cm.cm_param.disconnect();
        }
        checkMsg.cm_array.splice(i, 1);
      }
      for(i = checkIM.cim_array.length - 1; i >= 0; i--) {
        var cim = checkIM.cim_array[i];
        if(cim.m_param != param) continue;

        if(cim.visible) {
          changed = true;
          imContainer.win_count--;
        }
        if(cim.cim_param) {
          cim.cim_param.disconnect();
        }
        checkIM.cim_array.splice(i, 1);
      }
      for(i = imDlg.im_array.length - 1; i >= 0; i--) {
        var im = imDlg.im_array[i];
        if(im.m_param != param) continue;
        im.onRelease();
        hmtgAlert.remove_im_alert(im);

        if(im.visible) {
          changed = true;
          imContainer.win_count--;
        }
        imDlg.im_array.splice(i, 1);
      }
      for(i = imDlg.iml_array.length - 1; i >= 0; i--) {
        var im = imDlg.iml_array[i];
        if(im.m_param != param) continue;
        im.onRelease();

        if(im.visible) {
          changed = true;
          imContainer.win_count--;
        }
        imDlg.iml_array.splice(i, 1);
      }

      hmtg.jmkernel.jm_command_RemoveOffice(param);
      var wb = hmtg.jmkernel.jm_command_FindWebOffice(param);
      if(wb) {
        hmtg.jmkernel.jm_command_RemoveWebOffice(wb);
        hmtg.jmkernel.jm_command_WriteWBL();
      }

      if(changed) $rootScope.$broadcast(hmtgHelper.WM_MAX_WIN_CHANGED);
    }
    this.remove_all_office = function() {
      var data = _jnagentDlg.data;
      for(var i = data.length - 1; i >= 0; i--) {
        hmtg.jmkernel.jm_command_RemoveOffice(data[i].pointer);
      }
    }
    this.CheckConnection = function() {
      var data = _jnagentDlg.data;
      for(var i = data.length - 1; i >= 0; i--) {
        var param = data[i].pointer;
        if(param._quit()) continue;
        if(param._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED) return true;
      }
    }
    this.SigninDlg = function($scope, $modal, is_reconnect, param, size) {
      if(is_reconnect) {
        $scope.reconnect_flag = true;
        $scope.to_remember_passwd = false;
        var wb = hmtg.jmkernel.jm_command_FindWebOffice(param);
        if(wb) {
          $scope.to_remember_passwd = wb._saved_password();
        }
        if(!$scope.to_remember_passwd) {
          $scope.saved_password = param._password();
          $scope.saved_password_error = param._password_error();
          $scope.need_to_restore_password = 1;

          param._password('');
          param._password_error(1);
        }
        if(param._password_error())
          $scope.password_error = 1;
        $scope.reconnect_password = param._password();
        $scope.m_homepage = param._homepage();
        $scope.m_userid = param._userid();
        //dlg.initial_status = param0->fake_away_status ? ONLINE_STATUS_ONLINE :param0->us_status;
        $scope.initial_status = param._us_status();
      } else {
        $scope.reconnect_flag = false;
        if(param) {
          $scope.m_homepage = param._homepage();
          $scope.m_userid = param._userid();
        } else {
          $scope.m_homepage = '';
          $scope.m_userid = '';
        }
      }
      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_msgr_signin' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/msgrSignin.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'MsgrSigninModalCtrl',
          size: size,
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
          var homepage = hmtg.util.decodeUtf8(result.homepage);
          var userid = hmtg.util.decodeUtf8(result.userid);
          var password;
          hmtgHelper.inside_angular++;
          var LS_list = hmtg.util.localStorage['hmtg_msgr_homepage_list'];
          var list = [];
          if(typeof LS_list == 'string') {
            var a_list = hmtg.util.parseJSON(LS_list);
            if(a_list === 'undefined') a_list = [];
            if(hmtg.util.isArray(a_list)) {
              list = a_list.slice(0, 10);
            }
          }
          var idx = list.indexOf(homepage);
          if(idx != -1) {
            list.splice(idx, 1);
            list.unshift(homepage);
          } else {
            list.unshift(homepage);
            list = list.slice(0, 10);
          }

          hmtg.util.localStorage['hmtg_msgr_homepage_list'] = JSON.stringify(list);

          if(!result.guest) {
            LS_list = hmtg.util.localStorage['hmtg_msgr_userid_list'];
            list = [];
            if(typeof LS_list == 'string') {
              var a_list = hmtg.util.parseJSON(LS_list);
              if(a_list === 'undefined') a_list = [];
              if(hmtg.util.isArray(a_list)) {
                list = a_list.slice(0, 10);
              }
            }
            var idx = list.indexOf(userid);
            if(idx != -1) {
              list.splice(idx, 1);
              list.unshift(userid);
            } else {
              list.unshift(userid);
              list = list.slice(0, 10);
            }

            hmtg.util.localStorage['hmtg_msgr_userid_list'] = JSON.stringify(list);
          }

          var guest = result.guest;
          var saved_password = result.remember_passwd;
          var initial_status;
          if(!guest) {
            userid = result.userid;
            password = result.password;
            initial_status = result.initial_status;
          }
          hmtg.jmkernel.jm_command_AddWebOffice(homepage, guest, saved_password, userid, password);
          hmtg.jmkernel.jm_command_UpdateWebOfficeLastStatus(guest, userid, homepage, initial_status);

          hmtg.jmkernel.jm_command_WriteWBL();
          if($scope.reconnect_flag) {
            hmtg.jmkernel.jm_info_GlobalPointer()._g_us_status(initial_status);
            if(param._password_error()) {
              param._password(password);
            }
            param._us_status(initial_status);
            hmtg.jmkernel.jm_command_ReconnectOffice(param);
          } else {
            hmtg.jmkernel.jm_command_SignInOffice(guest, initial_status, homepage, userid, password);
          }
          hmtgHelper.inside_angular--;
        }, function() {
          if(is_reconnect) {
            if($scope.need_to_restore_password) {
              param._password($scope.saved_password);
              param._password_error($scope.saved_password_error);
            }
          }
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_msgr_signin fails');
      });
    }

    this.UrlSignin = function(userid, homepage) {
      // check whether url signin already in the system
      var param = hmtg.jmkernel.jm_command_CreateDummyOffice(userid, homepage);
      var wb = hmtg.jmkernel.jm_command_FindWebOffice(param);
      if(wb) {
        // if found
        // do nothing
        return;
      }
      setTimeout(function() {
        $rootScope.$broadcast(hmtgHelper.WM_URL_SIGNIN, param);
      }, 0);
    }

    // folder level
    this.add_folder = function(server, folder) {
      var i;
      var folders = server.folders;
      for(i = 0; i < folders.length; i++) {
        if(folder.type < folders[i].type
          || (folder.type == folders[i].type && folder.text < folders[i].text)) {
          folders.splice(i, 0, folder);
          return;
        }
      }
      folders.push(folder);
    }

    // folder, event
    this.update_lang_folder_event = function(folder, param) {
      folder.tooltip = folder.text = $translate.instant('IDS_FORMAT_EVENT').replace('%d', param._mmc_event_array().length);
    }
    this.prepare_folder_event = function(folder, param, pointer) {
      folder.type = FOLDER_TYPE_EVENT;
      folder.param = param;
      folder.img = msgrHelper.CalcFoldedImageType(param._event_folded());
      folder.folded = param._event_folded();
      this.update_lang_folder_event(folder, param);
      folder.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_folder_event(folder, param, pointer, open); }
    }
    this.prepare_context_menu_folder_event = function(folder, param, pointer, open) {
      folder.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'folder_event') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'folder_event';
      folder.menu.push({ "text": $translate.instant(folder.folded ? 'IDS_SHOW_EVENT' : 'IDS_HIDE_EVENT'), "onclick": _jnagentDlg.OnToggleEvent });
    }
    this.OnToggleEvent = function($scope, $modal, server, folder) {
      hmtgHelper.inside_angular++;
      var param = server.pointer;
      param._event_folded(!param._event_folded());
      folder.folded = param._event_folded();
      folder.img = msgrHelper.CalcFoldedImageType(folder.folded);
      hmtg.jmkernel.jm_command_UpdateWebOfficeFoldStatus(param, 3, folder.folded);
      hmtg.jmkernel.jm_command_WriteWBL();
      hmtgHelper.inside_angular--;
    }

    // folder, publish
    this.update_lang_folder_publish = function(folder, param, pointer) {
      var s = ' ' + $translate.instant('IDS_FORMAT_PUBLISH_FILE').replace('%d', pointer.count);
      if(pointer.name) s = pointer.name + ' -' + s;
      folder.tooltip = folder.text = s;
    }
    this.prepare_folder_publish = function(folder, param, pointer) {
      folder.type = FOLDER_TYPE_PUBLISH_FILE;
      folder.pointer = pointer;
      folder.param = param;
      folder.img = msgrHelper.CalcFoldedImageType(pointer.folded);
      folder.folded = pointer.folded;
      this.update_lang_folder_publish(folder, param, pointer);
      folder.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_folder_publish(folder, param, pointer, open); }
    }
    this.prepare_context_menu_folder_publish = function(folder, param, pointer, open) {
      folder.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'folder_publish') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'folder_publish';
      folder.menu.push({ "text": $translate.instant(folder.folded ? 'IDS_SHOW_PUBLISH_FILE' : 'IDS_HIDE_PUBLISH_FILE'), "onclick": _jnagentDlg.OnTogglePublish });
    }
    this.OnTogglePublish = function($scope, $modal, server, folder) {
      hmtgHelper.inside_angular++;
      var param = server.pointer;
      folder.pointer.folded = !folder.pointer.folded;
      param._old_publish_folded()[folder.pointer.name] = folder.pointer.folded;
      folder.folded = folder.pointer.folded;
      folder.img = msgrHelper.CalcFoldedImageType(folder.pointer.folded);
      if(!folder.pointer.name) {
        hmtg.jmkernel.jm_command_UpdateWebOfficeFoldStatus(param, 5, folder.pointer.folded);
        hmtg.jmkernel.jm_command_WriteWBL();
      }
      hmtgHelper.inside_angular--;
    }

    // folder, share
    this.update_lang_folder_share = function(folder, param, pointer) {
      var s = hmtg.util.decodeUtf8(pointer.name2) + ' - ' + $translate.instant('IDS_FORMAT_SHARE_FILE_DESCR').replace('%d', pointer.count);
      folder.tooltip = folder.text = s;
    }
    this.prepare_folder_share = function(folder, param, pointer) {
      folder.type = FOLDER_TYPE_SHARE_FILE;
      folder.pointer = pointer;
      folder.param = param;
      folder.img = msgrHelper.CalcFoldedImageType(pointer.folded);
      folder.folded = pointer.folded;
      this.update_lang_folder_share(folder, param, pointer);
      folder.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_folder_share(folder, param, pointer, open); }
    }
    this.prepare_context_menu_folder_share = function(folder, param, pointer, open) {
      folder.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'folder_share') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'folder_share';
      if(param._client_info_loaded()) {
        folder.menu.push({ "text": $translate.instant('ID_REMOVE_ALL_FILE') + '(' + pointer.count + ')', "onclick": _jnagentDlg.OnRemoveAllShare });
      }
      folder.menu.push({ "text": $translate.instant(folder.folded ? 'IDS_SHOW_SHARE_FILE' : 'IDS_HIDE_SHARE_FILE'), "onclick": _jnagentDlg.OnToggleShare });
    }
    this.OnToggleShare = function($scope, $modal, server, folder) {
      hmtgHelper.inside_angular++;
      var param = server.pointer;
      folder.pointer.folded = !folder.pointer.folded;
      param._old_psf_folded()[folder.pointer.name] = folder.pointer.folded;
      folder.folded = folder.pointer.folded;
      folder.img = msgrHelper.CalcFoldedImageType(folder.pointer.folded);
      hmtg.jmkernel.jm_command_UpdateWebOfficeFoldStatus(param, 4, folder.pointer.folded);
      hmtg.jmkernel.jm_command_WriteWBL();
      hmtgHelper.inside_angular--;
    }
    this.OnRemoveAllShare = function($scope, $modal, server, folder) {
      hmtgHelper.OKCancelMessageBox($translate.instant('IDS_REMOVE_FILE_ALERT') + '(' + folder.pointer.count + ')', 0, ok);
      function ok() {
        var param = server.pointer;
        hmtg.jmkernel.jm_command_RemoveAllShareFile(param, folder.pointer.name);
        hmtgHelper.inside_angular++;
        _jnagentDlg.update_psf_list(param);
        hmtgHelper.inside_angular--;
      }
    }

    // folder, pgc
    this.update_lang_folder_pgc = function(folder, param) {
      folder.tooltip = folder.text = $translate.instant('IDS_FORMAT_PGC_DESCR').replace('%d', param._m_PgcCount());
    }
    this.prepare_folder_pgc = function(folder, param) {
      folder.type = FOLDER_TYPE_PGC;
      folder.param = param;
      folder.folded = param._pgc_folded();
      folder.img = msgrHelper.CalcFoldedImageType(folder.folded);
      this.update_lang_folder_pgc(folder, param);
      folder.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_folder_pgc(folder, param, open); }
    }
    this.prepare_context_menu_folder_pgc = function(folder, param, open) {
      folder.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'folder_pgc') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'folder_pgc';
      folder.menu.push({ "text": $translate.instant(folder.folded ? 'IDS_SHOW_PGC' : 'IDS_HIDE_PGC'), "onclick": _jnagentDlg.OnTogglePGC });
    }
    this.OnTogglePGC = function($scope, $modal, server, folder) {
      hmtgHelper.inside_angular++;
      var param = server.pointer;
      param._pgc_folded(!param._pgc_folded());
      folder.folded = param._pgc_folded();
      folder.img = msgrHelper.CalcFoldedImageType(folder.folded);
      hmtg.jmkernel.jm_command_UpdateWebOfficeFoldStatus(param, 6, folder.folded);
      hmtg.jmkernel.jm_command_WriteWBL();
      hmtgHelper.inside_angular--;
    }

    // folder, visitor
    this.update_lang_folder_visitor = function(folder, param) {
      folder.tooltip = folder.text = $translate.instant('IDS_FORMAT_VISITOR').replace('%d', folder.items.length);
    }
    this.prepare_folder_visitor = function(folder, param) {
      folder.type = FOLDER_TYPE_VISITOR;
      folder.param = param;
      folder.folded = param._visitor_folded();
      folder.img = msgrHelper.CalcFoldedImageType(folder.folded);
      this.update_lang_folder_visitor(folder, param);
      folder.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_folder_visitor(folder, param, open); }
    }
    this.prepare_context_menu_folder_visitor = function(folder, param, open) {
      folder.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'folder_visitor') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'folder_visitor';
      folder.menu.push({ "text": $translate.instant(folder.folded ? 'IDS_SHOW_USER_GROUP' : 'IDS_HIDE_USER_GROUP'), "onclick": _jnagentDlg.OnToggleVisitor });
    }
    this.OnToggleVisitor = function($scope, $modal, server, folder) {
      hmtgHelper.inside_angular++;
      var param = server.pointer;
      param._visitor_folded(!param._visitor_folded());
      folder.folded = param._visitor_folded();
      folder.img = msgrHelper.CalcFoldedImageType(folder.folded);
      hmtg.jmkernel.jm_command_UpdateWebOfficeFoldStatus(param, 0, folder.folded);
      hmtg.jmkernel.jm_command_WriteWBL();
      hmtgHelper.inside_angular--;
    }

    // folder, contact
    this.update_lang_folder_contact = function(folder, param, pointer) {
      folder.tooltip = folder.text = hmtg.util.decodeUtf8(pointer.m_szGroupName) + '(' + (pointer.online_count != pointer.m_pContactArray.length ? (pointer.online_count + '/') : '') + pointer.m_pContactArray.length + ')';
    }
    this.prepare_folder_contact = function(folder, param, pointer) {
      folder.type = FOLDER_TYPE_CONTACT;
      folder.pointer = pointer;
      folder.param = param;
      folder.img = msgrHelper.CalcFoldedImageType(pointer.contact_folded);
      folder.folded = pointer.contact_folded;
      this.update_lang_folder_contact(folder, param, pointer);
      folder.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_folder_contact(folder, param, pointer, open); }
    }
    this.prepare_context_menu_folder_contact = function(folder, param, pointer, open) {
      folder.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'folder_contact') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'folder_contact';

      var array = _jnagentDlg.data;
      if(can_accept_invitation(pointer)) {
        var target = find_target_inviter(param);
        for(i = 0; i < target.length; i++) {
          folder.menu.push({ "text": $translate.instant('IDS_FORMAT_INVITE')
            .replace('#target#', hmtg.util.decodeUtf8(pointer.m_szGroupName))
            .replace('#office#', hmtg.util.decodeUtf8(target[i]._name_or_homepage3()))
            ,
            "param": target[i],
            "onclick": _jnagentDlg.OnInviteGroup
          });
        }
      }
      if(param._client_info_loaded()) {
        folder.menu.push({ "text": $translate.instant('ID_PICKCONTACT'), "onclick": _jnagentDlg.OnAddContact });
        if(pointer.m_pContactArray.length) {
          folder.menu.push({ "text": $translate.instant('ID_DELETECONTACT'), "onclick": _jnagentDlg.OnDeleteContact });
        }
        folder.menu.push({ "text": $translate.instant('ID_RENAMEGROUP'), "onclick": _jnagentDlg.OnRenameContactGroup });
        folder.menu.push({ "text": $translate.instant('ID_DELETEGROUP'), "onclick": _jnagentDlg.OnDeleteContactGroup });
      }
      folder.menu.push({ "text": $translate.instant(folder.folded ? 'IDS_SHOW_USER_GROUP' : 'IDS_HIDE_USER_GROUP'), "onclick": _jnagentDlg.OnToggleContact });

      function can_accept_invitation(group) {
        var j;
        var b = group.m_pContactArray;
        for(j = 0; j < b.length; j++) {
          var contact = b[j];
          var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, contact.id);
          if(!this_us) continue;
          var id = this_us._userid();
          if(hmtg.jmkernel.jm_info_CanTargetUserAcceptInvitation(param, id)) {
            return true;
          }
        }
      }
    }
    this.OnToggleContact = function($scope, $modal, server, folder) {
      hmtgHelper.inside_angular++;
      var param = server.pointer;
      folder.pointer.contact_folded = !folder.pointer.contact_folded;
      folder.folded = folder.pointer.contact_folded;
      folder.img = msgrHelper.CalcFoldedImageType(folder.pointer.contact_folded);
      hmtg.jmkernel.jm_command_TouchClientInfo(param);
      hmtgHelper.inside_angular--;
    }

    this.OnInviteGroup = function($scope, $modal, server, folder, menu) {
      hmtgSound.turnOnAudio();
      var invitee_param = server.pointer;
      var inviter_param = menu.param;
      if(inviter_param._quit() || invitee_param._quit()) return;
      var group = folder.pointer;
      var j;
      var a = [];
      var b = group.m_pContactArray;
      for(j = 0; j < b.length; j++) {
        var contact = b[j];
        var this_us = hmtg.jmkernel.jm_command_ParamFindUser(invitee_param, contact.id);
        if(!this_us) continue;
        var id = this_us._userid();
        if(hmtg.jmkernel.jm_info_CanTargetUserAcceptInvitation(invitee_param, id)) {
          a.push(id);
        }
      }
      if(!a.length) return;
      var userid = a.shift();
      var username = hmtg.jmkernel.jm_info_GetUserName(invitee_param, userid);

      hmtgHelper.inside_angular++;
      msgrHelper.inviteUser(_jnagentDlg, inviter_param, invitee_param, false, userid, username, a);
      hmtgHelper.inside_angular--;
    }

    this.OnAddContact = function($scope, $modal, server, folder, menu) {
      var param = server.pointer;
      var group = folder.pointer;
      msgrHelper.pickUser($scope, 'add-contact', func, param, group);

      function func(a, b) {
        var i;
        for(i = 0; i < a.length; i++) {
          hmtg.jmkernel.jm_command_AddContact(param, group, a[i], b[i]);
        }
        _jnagentDlg.update_contact_group(param);
      }
    }
    this.OnDeleteContact = function($scope, $modal, server, folder, menu) {
      var param = server.pointer;
      var group = folder.pointer;
      msgrHelper.pickUser($scope, 'delete-contact', func, param, group);

      function func(a) {
        var i;
        for(i = 0; i < a.length; i++) {
          hmtg.jmkernel.jm_command_DeleteContact(param, group, a[i]);
        }
        _jnagentDlg.update_contact_group(param);
      }
    }
    this.OnRenameContactGroup = function($scope, $modal, server, folder, menu) {
      var param = server.pointer;
      var group = folder.pointer;
      var n = hmtg.util.decodeUtf8(group.m_szGroupName);
      hmtgHelper.renameDialog($scope, n, $translate.instant('ID_RENAMEGROUP'), hmtg.util.decodeUtf8(param._name_or_homepage2()) + ', ' + n, ok, 'rename_contact_group', [param, group]);
      function ok(new_value) {
        hmtg.jmkernel.jm_command_RenameContactGroup(param, group, new_value);
        _jnagentDlg.update_contact_group(param);
      }
    }
    this.OnDeleteContactGroup = function($scope, $modal, server, folder, menu) {
      var param = server.pointer;
      var group = folder.pointer;
      var n = hmtg.util.decodeUtf8(group.m_szGroupName);
      if(group.m_pContactArray.length) {
        hmtgHelper.OKCancelMessageBox($translate.instant('IDS_DELETE_NONEMPTY_CONTACT_GROUP').replace('#contactgroup#', n), 0, ok);
      } else {
        ok();
      }
      function ok() {
        hmtg.jmkernel.jm_command_DeleteContactGroup(param, group);
        _jnagentDlg.update_contact_group(param);
      }
    }


    // folder, other user
    this.update_lang_folder_other_user = function(folder, param, pointer) {
      folder.tooltip = folder.text = $translate.instant('IDS_FORMAT_OTHER_USERS').replace('%d', folder.items.length);
    }
    this.prepare_folder_other_user = function(folder, param, pointer) {
      folder.type = FOLDER_TYPE_OTHER_USER;
      folder.pointer = pointer;
      folder.param = param;
      folder.img = msgrHelper.CalcFoldedImageType(param._noncontact_folded());
      folder.folded = param._noncontact_folded();
      this.update_lang_folder_other_user(folder, param, pointer);
      folder.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_folder_other_user(folder, param, pointer, open); }
    }
    this.prepare_context_menu_folder_other_user = function(folder, param, pointer, open) {
      folder.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'folder_other') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'folder_other';
      folder.menu.push({ "text": $translate.instant(folder.folded ? 'IDS_SHOW_USER_GROUP' : 'IDS_HIDE_USER_GROUP'), "onclick": _jnagentDlg.OnToggleOtherUser });
    }
    this.OnToggleOtherUser = function($scope, $modal, server, folder) {
      hmtgHelper.inside_angular++;
      var param = server.pointer;
      param._noncontact_folded(!param._noncontact_folded());
      folder.folded = param._noncontact_folded();
      folder.img = msgrHelper.CalcFoldedImageType(param._noncontact_folded());
      hmtg.jmkernel.jm_command_UpdateWebOfficeFoldStatus(param, 2, param._noncontact_folded());
      hmtg.jmkernel.jm_command_WriteWBL();
      hmtgHelper.inside_angular--;
    }

    // item level 
    // item, contact
    // item, other user
    // item user: contact and other user
    this.update_lang_item_user = function(item, param, pointer) {
      item.text = pointer.this_us ? msgrHelper.CalcUserText($translate.instant, param, pointer.this_us, pointer.contact) : msgrHelper.CalcContactText($translate.instant, param, pointer.contact);
      item.tooltip = pointer.this_us ? msgrHelper.CalcUserTooltip($translate.instant, param, pointer.this_us, pointer.contact) : msgrHelper.CalcContactTooltip($translate.instant, param, pointer.contact);
    }
    this.prepare_item_user = function(item, param, pointer) {
      item.type = FOLDER_TYPE_OTHER_USER;
      item.pointer = pointer;
      item.param = param;
      item.img = pointer.this_us ? msgrHelper.CalcUserImageType(pointer.this_us._status(), pointer.this_us._office_status()) : msgrHelper.CalcUserImageType(hmtg.config.ONLINE_STATUS_APPEAROFF, 0);
      this.update_lang_item_user(item, param, pointer);
      item.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_user(item, param, pointer, open); }
    }
    this.prepare_context_menu_user = function(item, param, pointer, open) {
      item.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'user') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'user';
      var array = _jnagentDlg.data;
      var i;
      var now = hmtg.util.GetTickCount();
      var can_send_short_message = false;
      var param2;
      if(!param._guest()) {
        for(i = 0; i < array.length; i++) {
          param2 = array[i].pointer;
          if(!param2._quit()
          && param2._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED
          && param2._user_status_inited()
          && !param2._guest()
          && param2._username()
          ) {
            can_send_short_message = true;
            break;
          }
        }
        if((now - this.g_last_short_message_tick) > this.MIN_SHORT_MESSAGE_INTERVEL
        && can_send_short_message) {
          item.menu.push({ "text": $translate.instant('IDS_CONVERSATION'),
            "param": param,
            "onclick": _jnagentDlg.OnShortMessage
          });
        }
        item.menu.push({ "text": $translate.instant('ID_CONVERSATION_LOG'),
          "param": param,
          "onclick": _jnagentDlg.OnIMLog
        });
      }

      if(pointer.this_us && !param._guest()) {
        if(hmtg.jmkernel.jm_info_CanTargetUserAcceptInvitation(param, pointer.this_us._userid())) {
          item.menu.push({ "text": $translate.instant('ID_TRANSFER'), "onclick": _jnagentDlg.OnTransfer });
        }
      }

      item.menu.push({ "text": $translate.instant('IDS_FORMAT_VISIT').replace('#username#', hmtg.util.decodeUtf8(pointer2name(pointer))), "onclick": _jnagentDlg.OnVisit });
      if(pointer.this_us) {
        if(hmtg.jmkernel.jm_info_CanTargetUserAcceptInvitation(param, pointer.this_us._userid())) {
          var target = find_target_inviter(param);
          for(i = 0; i < target.length; i++) {
            item.menu.push({ "text": $translate.instant('IDS_FORMAT_INVITE')
            .replace('#target#', hmtg.util.decodeUtf8(pointer2name(pointer)))
            .replace('#office#', hmtg.util.decodeUtf8(target[i]._name_or_homepage3()))
            ,
              "param": target[i],
              "onclick": _jnagentDlg.OnInvite
            });
          }
        }
      }
    }

    this.OnShortMessage = function($scope, $modal, server, folder, item, menu) {
      imDlg.showIM($scope, server.pointer, pointer2id(item.pointer), hmtg.util.decodeUtf8(pointer2name(item.pointer)));

      // to do
      /*
      $ocLazyLoad.load({
      name: 'msgr',
      files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_short_message' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function () {
      var modalInstance = $modal.open({
      templateUrl: 'template/ShortMessage.htm' + hmtgHelper.cache_param,
      scope: $scope,
      controller: 'ShortMessageModalCtrl',
      size: '',
      backdrop: 'static',
      resolve: {}
      });

      modalInstance.result.then(function (result) {
      var param = server.pointer;
      var base_param = menu.param;
      if(param._quit()) return;
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
      hmtg.jmkernel.jm_command_SendMessage(param, '', result.text, "1", false, base_param._username(), item.pointer._userid(), base_param._homepage());
      // to do
      hmtgHelper.inside_angular++;
      hmtgSound.ShowInfoPrompt(function () {
      return hmtg.util.decodeUtf8((new Date()).toString().replace(/(GMT.*)/, "") + ' ' + 'Sent Message to ' + item.pointer._username() + ' @ ' + param._homepage() + ': ') + result.text;
      }, 3600 * 24 * 10);
      hmtgHelper.inside_angular--;
      }, function () {
      });
      }, function (e) {
      hmtg.util.log(-1, 'Warning! lazy_loading modal_short_message fails');
      });
      */
    }

    this.OnIMLog = function($scope, $modal, server, folder, item, menu) {
      imDlg.showIMLog($scope, server.pointer, hmtg.config.IM_TARGET_TYPE_PEER, pointer2id(item.pointer), hmtg.util.decodeUtf8(pointer2name(item.pointer)));
    }

    this.OnVisit = function($scope, $modal, server, folder, item) {
      hmtgSound.turnOnAudio();
      var param = server.pointer;
      var userid = pointer2id(item.pointer);
      var username = pointer2name(item.pointer);
      msgrHelper.visitUser($scope, param, userid, username, _jnagentDlg);
    }

    this.OnInvite = function($scope, $modal, server, folder, item, menu) {
      hmtgSound.turnOnAudio();
      var invitee_param = server.pointer;
      var inviter_param = menu.param;
      if(inviter_param._quit() || invitee_param._quit()) return;
      hmtgHelper.inside_angular++;
      msgrHelper.inviteUser(_jnagentDlg, inviter_param, invitee_param, false, pointer2id(item.pointer), pointer2name(item.pointer), null);
      hmtgHelper.inside_angular--;
    }

    this.OnTransfer = function($scope, $modal, server, folder, item, menu) {
      var im = imDlg.showIM($scope, server.pointer, pointer2id(item.pointer), hmtg.util.decodeUtf8(pointer2name(item.pointer)));
      im.onTransfer();
    }

    // item, event
    this.update_lang_item_event = function(item, param, event) {
      var start_time = event.start_time + (param._local_tick() - param._mcu_tick());
      var end_time = start_time + event.duration;
      item.text = (event.title ? hmtg.util.decodeUtf8(event.title) : 'n/a') + ', ' + msgrHelper.get_timestring_im2(start_time) + ' - ' + msgrHelper.get_timestring_im1(end_time);
      item.tooltip = $translate.instant('IDS_FORMAT_EVENT_OWNER_NAME').replace('#ownername#', hmtg.util.decodeUtf8(event.owner_name));
    }
    this.prepare_item_event = function(item, param, event) {
      item.type = FOLDER_TYPE_EVENT;
      item.pointer = event;
      item.param = param;
      item.img = CheckEventStatus(param, event) ? "img/icon_event_ongoing.png" : "img/icon_event_upcoming.png";
      this.update_lang_item_event(item, param, event);
      item.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_event(item, param, event, open); }
    }
    this.prepare_context_menu_event = function(item, param, event, open) {
      item.menu = [];
      var status = CheckEventStatus(param, event);
      item.img = status ? "img/icon_event_ongoing.png" : "img/icon_event_upcoming.png";
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'event') _jnagentDlg.has_action_menu = '';
        return;
      }

      _jnagentDlg.has_action_menu = 'event';
      if(status) {
        item.menu.push({ "text": $translate.instant('ID_JOIN_EVENT'), "onclick": _jnagentDlg.OnJoinEvent });
      }
    }
    function CheckEventStatus(param, event) {
      var t = event.start_time - param._mcu_tick() - event.advance_time;
      if(t < 0) return true;
      t -= hmtg.util.time() - param._local_tick();
      if(t < 0) return true;
      return false;
    }

    this.OnJoinEvent = function($scope, $modal, server, folder, item, menu) {
      var param = server.pointer;
      var event = item.pointer;
      if(param._guest()) {
        $rootScope.WebOfficeVisitor = {};
        $rootScope.WebOfficeVisitor.title = $translate.instant('ID_JOIN_EVENT');
        $rootScope.WebOfficeVisitor.force_type = true;
        $rootScope.WebOfficeVisitor.type = 0; // prompt for user name
        var modalInstance = $modal.open({
          templateUrl: 'template/WebOfficeVisitor.htm' + hmtgHelper.cache_param,
          scope: $rootScope,
          controller: 'WebOfficeVisitorModalCtrl',
          size: '',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
          hmtgHelper.inside_angular++;
          hmtg.util.localStorage['hmtg_visitor_name'] = hmtg.util.decodeUtf8(result.name);
          join_event(false, result.name);
          hmtgHelper.inside_angular--;
        }, function() {
        });
      } else {
        hmtgHelper.inside_angular++;
        join_event(true);
        hmtgHelper.inside_angular--;
      }


      function join_event(bUseID, szName) {
        _jnagentDlg.RequestDlg(function() {
          return hmtg.jmkernel.jm_command_JoinEvent(param, _jnagentDlg.g_unique_id, event.owner_id, event.meeting_id, bUseID, szName);
        }, function() {
          return $translate.instant('IDS_FORMAT_PREPARE_JOIN_EVENT').replace('#event#', hmtg.util.decodeUtf8(event.title));
        });
      }
    }

    // item, publish
    this.update_lang_item_publish = function(item, param, file) {
      item.text = file.title + ', ' + file.duration + ' min';
      item.tooltip = $translate.instant('IDS_FORMAT_PUBLISHED_FILE').replace('#username#', file.owner_name).replace('#title#', file.title).replace('%d', file.duration);
      if(file.group) {
        item.tooltip = $translate.instant('IDS_GROUP_ARE') + ': ' + file.group + '\n' + item.tooltip;
      }
    }
    this.prepare_item_publish = function(item, param, file) {
      item.type = FOLDER_TYPE_PUBLISH_FILE;
      item.pointer = file;
      item.param = param;
      item.img = "img/icon_file.png";
      this.update_lang_item_publish(item, param, file);
      item.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_publish(item, param, file, open); }
    }
    this.prepare_context_menu_publish = function(item, param, file, open) {
      item.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'publish') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'publish';
      item.menu.push({ "text": $translate.instant('ID_PLAYBACK'), "onclick": _jnagentDlg.OnPlaybackPublish });
    }

    this.OnPlaybackPublish = function($scope, $modal, server, folder, item, menu) {
      var param = server.pointer;
      var file = item.pointer;
      hmtgHelper.inside_angular++;
      _jnagentDlg.RequestDlg(function() {
        return hmtg.jmkernel.jm_command_MMCPlaybackSharedFile(param, _jnagentDlg.g_unique_id, file.blackbox_data);
      }, function() {
        return $translate.instant('IDS_PREPARE_PLAYBACK_SHARE_FILE');
      });
      hmtgHelper.inside_angular--;
    }

    // item, share
    this.update_lang_item_share = function(item, param, psf) {
      item.text = hmtg.util.decodeUtf8(psf.name) + ', ' + psf.duration + ' min';
      item.tooltip = $translate.instant(psf.subject ? 'IDS_FORMAT_SHARED_FILE2' : 'IDS_FORMAT_SHARED_FILE')
      .replace('#username#', hmtg.util.decodeUtf8(psf.owner_name))
      .replace('#time#', msgrHelper.get_timestring_im2(psf.recv_tick))
      .replace('#homepage#', hmtg.util.decodeUtf8(psf.owner_homepage))
      .replace('%u', psf.duration)
      ;
      if(psf.subject) {
        item.tooltip = item.tooltip.replace()
        .replace('#subject#', hmtg.util.decodeUtf8(psf.name))
        .replace('#title#', hmtg.util.decodeUtf8(psf.title))
        ;
      } else {
        item.tooltip = item.tooltip.replace()
        .replace('#title#', hmtg.util.decodeUtf8(psf.title))
        ;
      }
    }
    this.prepare_item_share = function(item, param, psf) {
      item.type = FOLDER_TYPE_SHARE_FILE;
      item.pointer = psf;
      item.param = param;
      item.img = psf.read ? "img/icon_file_read_shared.png" : "img/icon_file_shared.png";
      this.update_lang_item_share(item, param, psf);
      item.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_share(item, param, psf, open); }
    }
    this.prepare_context_menu_share = function(item, param, psf, open) {
      item.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'share') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'share';
      item.menu.push({ "text": $translate.instant('ID_PLAYBACK'), "onclick": _jnagentDlg.OnPlaybackShare });
      if(param._client_info_loaded()) {
        item.menu.push({ "text": $translate.instant('ID_REMOVE_FILE'), "onclick": _jnagentDlg.OnRemoveShare });
      }
    }

    this.OnPlaybackShare = function($scope, $modal, server, folder, item, menu) {
      hmtgSound.turnOnAudio();

      var param = server.pointer;
      var psf = item.pointer;
      hmtgHelper.inside_angular++;
      if(!psf.read) {
        psf.read = 1;
        item.img = psf.read ? "img/icon_file_read_shared.png" : "img/icon_file_shared.png";
        hmtg.jmkernel.jm_command_TouchClientInfo(param);
      }

      var new_window = null;
      //var depth = 0;
      //var base_url = '';
      if(psf.share_type == 2) {
        _jnagentDlg.RequestDlg(function() {
          return hmtg.jmkernel.jm_command_MMCPlaybackSharedFile(param, _jnagentDlg.g_unique_id, psf.jnj);
        }, function() {
          return $translate.instant('IDS_PREPARE_PLAYBACK_SHARE_FILE');
        });
      } else if(psf.share_type == 1) {
        psf.jnj = msgrHelper.appendWeb(psf.jnj);
        //psf.jnj = msgrHelper.appendCORS(psf.jnj);
        new_window = window.open(psf.jnj, hmtg.util.app_id + psf.name);
        // https://docs.angularjs.org/api/ng/service/$http
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS#Requests_with_credentials
        //base_url = psf.jnj;
        //$http.get(base_url, { withCredentials: true }).then(ok, error);
        $http.get(psf.jnj).then(ok, error);
      } else {
        run_jnj(psf.jnj);
      }
      hmtgHelper.inside_angular--;

      // alternative
      // web joinnet retrieve the refresh page and append webjoinnet-cors query parameter
      // the MMC site add specific Access-Control-Allow-Origin and add Access-Control-Allow-Credentials
      // so that the jnj can be retrieved via joinnet_launch.php
      // this method has higher requirement for the MMC site.
      /*
      function ok(response) {
      if(jnjContent.validateJnj(response.data)) {
      if(new_window) new_window.close();
      setTimeout(function() {
      run_jnj(response.data);
      }, 0);
      } else if(depth < 3) {
      // try searching refresh meta
      //<META HTTP-EQUIV="Refresh" CONTENT="3;URL=http://www.some.org/some.html">
      //<meta http-equiv=\"refresh\" content=\"0;url=#target#\">");
      var pattern = new RegExp('<meta\\s+http-equiv\\s*=\\s*\\\\?"refresh\\\\?"\\s+content\\s*=\\s*\\\\?"\\s*[0-9;]*\\s*url\\s*=\\s*([^";>\\\\]+)', 'i');
      var m;
      m = pattern.exec(response.data);
      if(!m || !m[1]) {
      if(new_window) new_window.focus();
      } else {
      depth++;
      var a = hmtgHelper.resolveURL(m[1]);
      base_url = hmtgHelper.resolveURL(m[1], base_url);
      base_url = msgrHelper.appendCORS(base_url);
      $http.get(base_url, response.config).then(ok, error);
      }
      } else {
      if(new_window) new_window.focus();
      }
      }
      */

      // try to retrieve the jnj from web joinnet url
      // only require the MMC site to add "Access-Control-Allow-Origin: *"
      function ok(response) {
        var jnj = response.data;
        if(!jnjContent.validateJnj(jnj)) {
          jnj = '';
          // document.write("<br><br><br><br><br><br><a target=\"webapp\" href=\"http://www.homemeeting.com/web/?jnj=IyBpZiB5b3Ugc2VlIHRoaXMgZmlsZSwgcGxlYXNlIGRvd25sb2FkIGFuZCByZWluc3RhbGwgSm9pbk5ldCBzb2Z0d2FyZSBmcm9tIGh0dHA6Ly93d3cuaG9tZW1lZXRpbmcuY29tDQpbZ2VuZXJhbF0NCmNvZGV0eXBlPTEzDQppcD0xOTIuMTY4LjE2OC4yNiANCmRvbWFpbj1Ib21lTWVldGluZw0KcG9ydG09MjMzNA0KYWN0aW9uPTENCmd1aV9yZWNfdmVyPQ0KZ3VpX21pbl92ZXI9DQp1c2VyaW5mbz1rZXlfd2ViX2xvY2FsaG9zdHxueUtLNzIySnZ3UmRIVk9iaW1zem5Cb042RlN2UWVTVHZQVk11QkVqUHowPXxmbmo5UVphcVZ1L2I0RkNJKzloR09aVjdHS004WmE0M01Cb3UxYXRIK05kVzRuclpYeUlGZzhXeVVBQkpGbEEzVXN4RTlldTNlbmJKWi92aWhNZXFKTlZsb3o0Kys1a2FnaXgvekV2N3oyUDBMQThmZHZXbW1NbWVhcXRGdjhtbjRQU0c1a2FjUDY5ekZyNis5VDcvTXNycmZYT3UzVHBxMkJhbDYyVlNheWNEMDBVV3ZMVVJpUWJKTE13cnV3Mjk3RzdCVExYSWNMVXJETWlKS21UNTQvczd4cExTU2xWYVBXYWN0cDVFcjBJWGhTUkRVTkV2Y250VDZ4V3IzYUc3VGdVeDlPYmhya1AxTDFLZHJDU1F2WHZLQ2tkV1Jpc05pSXJXcGw4T1lIVkJXNXFPbVp0WFJYK080Qks3S1NmNUVpcytzc0FlK2pQbW80ckxseThWRnZJejZMWT18TlIzOXNGa2FwSU84UGFIaWc5am10MjMvaDhzPQ0K\"><b>Web JoinNet</b></a>");				
          var pattern = new RegExp(':\\/\\/[^\\s]+\\?jnj=([a-zA-Z0-9\\-_\\/=\\+]+)', 'i');
          var m;
          m = pattern.exec(response.data);
          if(m && m[1]) {
            jnj = hmtg.util.decode64_url(m[1]);
            if(!jnjContent.validateJnj(jnj)) {
              jnj = '';
            }
          }
        }

        if(jnj) {
          if(new_window) new_window.close();
          setTimeout(function() {
            run_jnj(jnj);
          }, 0);
        } else {
          if(new_window) new_window.focus();
        }
      }

      function error(response) {
        if(new_window) new_window.focus();
      }

      function run_jnj(base_jnj) {
        var jnj = hmtg.jmkernel.jm_command_AppendPlayerName(base_jnj, param);
        jnj = hmtg.jmkernel.jm_command_AppendDefaultPassword(jnj, hmtg.jmkernel.jm_command_Base64HashPassword(param));
        hmtg.jmkernel.jm_callback_LaunchJoinNet(jnj);
      }
    }
    this.OnRemoveShare = function($scope, $modal, server, folder, item, menu) {
      hmtgHelper.OKCancelMessageBox($translate.instant('IDS_REMOVE_FILE_ALERT'), 0, ok);
      function ok() {
        var param = server.pointer;
        var psf = item.pointer;
        hmtg.jmkernel.jm_command_RemoveShareFile(param, psf);
        hmtgHelper.inside_angular++;
        _jnagentDlg.update_psf_list(param);
        hmtgHelper.inside_angular--;
      }
    }

    // item, pgc
    this.update_lang_item_pgc = function(item, param, pgc) {
      item.tooltip = item.text = hmtg.util.decodeUtf8(pgc._full_name());
    }
    this.prepare_item_pgc = function(item, param, pgc) {
      item.type = FOLDER_TYPE_PGC;
      item.pointer = pgc;
      item.param = param;
      item.img = "img/icon_im.png";
      this.update_lang_item_pgc(item, param, pgc);
      item.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_pgc(item, param, pgc, open); }
    }
    this.prepare_context_menu_pgc = function(item, param, pgc, open) {
      item.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'pgc') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'pgc';
      item.menu.push({ "text": $translate.instant('IDS_GROUP_CONVERSATION'), "onclick": _jnagentDlg.OnPgcConversation });
      item.menu.push({ "text": $translate.instant('ID_CONVERSATION_LOG'), "onclick": _jnagentDlg.OnPgcLog });
      item.menu.push({ "text": $translate.instant('IDS_RENAME_PGC'), "onclick": _jnagentDlg.OnRenamePgc });
      item.menu.push({ "text": $translate.instant('IDS_LEAVE_PGC'), "onclick": _jnagentDlg.OnLeavePgc });
    }

    this.OnPgcConversation = function($scope, $modal, server, folder, item, menu) {
      var pgc = item.pointer;
      imDlg.showIM2($scope, server.pointer, pgc._group_id());
    }

    this.OnRenamePgc = function($scope, $modal, server, folder, item, menu) {
      var param = server.pointer;
      var pgc = item.pointer;
      msgrHelper.renamePgc($scope, param, pgc);
    }

    this.OnLeavePgc = function($scope, $modal, server, folder, item, menu) {
      var param = server.pointer;
      var pgc = item.pointer;
      var group_id = pgc._group_id();
      msgrHelper.removePgc(imDlg, param, pgc);
    }

    this.OnPgcLog = function($scope, $modal, server, folder, item, menu) {
      var pgc = item.pointer;
      imDlg.showIMLog($scope, server.pointer, hmtg.config.IM_TARGET_TYPE_GROUP, pgc._group_id(), hmtg.util.decodeUtf8(pgc._full_name()));
    }

    // item, visitor
    this.update_lang_item_visitor = function(item, param, visitor) {
      item.tooltip = item.text = hmtg.util.decodeUtf8(visitor.visitor_name);
    }
    this.prepare_item_visitor = function(item, param, visitor) {
      item.type = FOLDER_TYPE_VISITOR;
      item.pointer = visitor;
      item.param = param;
      item.img = "img/icon_user_visitor.png";
      this.update_lang_item_visitor(item, param, visitor);
      item.ontoggle = function(open) { _jnagentDlg.prepare_context_menu_visitor(item, param, visitor, open); }
    }
    this.prepare_context_menu_visitor = function(item, param, visitor, open) {
      item.menu = [];
      if(!open) {
        if(_jnagentDlg.has_action_menu == 'visitor') _jnagentDlg.has_action_menu = '';
        return;
      }
      _jnagentDlg.has_action_menu = 'visitor';
      item.menu.push({ "text": $translate.instant('IDS_FORMAT_TALK_TO').replace('#username#', hmtg.util.decodeUtf8(visitor.visitor_name)), "onclick": _jnagentDlg.OnTalkTo });
    }

    this.OnTalkTo = function($scope, $modal, server, folder, item, menu) {
      var visitor = item.pointer;
      hmtg.jmkernel.jm_command_TalkToVisitor(server.pointer, visitor.iSessionIndex, visitor.start_tick, visitor.visitor_name);
    }

    // actions
    this.update_show_user = function(data) {
      for(var i = 0; i < this.data.length; i++) {
        var server = this.data[i];
        var param = server.pointer;
        this.update_contact_group(param);
      }
    }

    this.update_user = function(param, this_us) {
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
      // do not do anything for self
      if(!param._guest()) {
        if(param._mmc_messenger()) {
          if(param._internal_id() == this_us._userid()) return;
        } else {
          if(param._userid() == this_us._userid()) return;
        }
      }

      var idx = this.find_item(_jnagentDlg.data, param);
      if(idx == -1) return;
      var server = _jnagentDlg.data[idx];
      var folders = server.folders;
      var i, j;
      var item_idx, target_idx, adjust;
      var other_folder_found = false;
      var is_contact = hmtg.jmkernel.jm_info_IsContact(param, this_us._userid());
      var is_offline = this_us._is_offline();
      for(i = 0; i < folders.length; i++) {
        var folder = folders[i];
        if(folder.type == FOLDER_TYPE_OTHER_USER && !is_contact) {
          other_folder_found = true;
          var items = folder.items;
          if(is_offline) {
            item_idx = this.find_user_item(items, this_us);
            // remove it
            if(item_idx != -1) items.splice(item_idx, 1);
          } else {
            // calcualte target index
            item_idx = -1;
            target_idx = -1;
            adjust = 0;
            var myname = hmtg.util.decodeUtf8(this_us._username()).toLowerCase();
            for(j = 0; j < items.length; j++) {
              if(items[j].pointer.this_us == this_us) {
                item_idx = j;
                adjust = 1;
                if(target_idx != -1) break;
              } else if(target_idx == -1) {
                var thisname = hmtg.util.decodeUtf8(items[j].pointer.this_us._username()).toLowerCase();
                if(myname < thisname) {
                  target_idx = j - adjust;
                  if(item_idx != -1) break;
                }
              }
            }
            update_user_item(items, item_idx, target_idx, adjust, is_offline);
          }
          if(!folder.items.length) folders.splice(i, 1); // remove it
          else _jnagentDlg.update_lang_folder_other_user(folder, param);
        } else if(folder.type == FOLDER_TYPE_CONTACT && is_contact) {
          var items = folder.items;
          if(!find_contact(folder.pointer, this_us._userid())) continue;
          if(!appSetting.show_offline_user && is_offline) {
            item_idx = this.find_user_item(items, this_us);
            // remove it
            if(item_idx != -1) {
              folder.pointer.online_count--;
              items.splice(item_idx, 1);
            }
          } else {
            // calcualte target index
            item_idx = -1;
            target_idx = -1;
            adjust = 0;
            var myname = hmtg.util.decodeUtf8(this_us._username()).toLowerCase();
            for(j = 0; j < items.length; j++) {
              if(items[j].pointer.this_us == this_us || (!items[j].pointer.this_us && items[j].pointer.contact.id == this_us._userid())) {
                if(is_offline) {
                  if(items[j].pointer.this_us && !items[j].pointer.is_offline) folder.pointer.online_count--;
                } else {
                  if(!items[j].pointer.this_us || items[j].pointer.is_offline) folder.pointer.online_count++;
                }
                item_idx = j;
                adjust = 1;
                if(target_idx != -1) break;
              } else if(target_idx == -1) {
                var thisname;
                if(is_offline) {
                  if(!items[j].pointer.this_us) {
                    thisname = items[j].pointer.contact.name;
                  } else if(items[j].pointer.this_us._is_offline()) {
                    thisname = items[j].pointer.this_us._username();
                  } else {
                    continue;
                  }
                } else {
                  if(!items[j].pointer.this_us || items[j].pointer.this_us._is_offline()) {
                    target_idx = j - adjust;
                    if(item_idx != -1) break;
                  }
                  thisname = pointer2name(items[j].pointer);
                }
                thisname = hmtg.util.decodeUtf8(thisname).toLowerCase();
                if(myname < thisname) {
                  target_idx = j - adjust;
                  if(item_idx != -1) break;
                }
              }
            }
            if(item_idx == -1 && !is_offline) folder.pointer.online_count++;
            update_user_item(items, item_idx, target_idx, adjust, is_offline);
          }
          _jnagentDlg.update_lang_folder_contact(folder, param, folder.pointer);
        }
      }
      function update_user_item(items, item_idx, target_idx, adjust, is_offline) {
        var item, pointer;
        if(item_idx != -1) {
          item = items[item_idx];
          pointer = item.pointer;
          pointer.this_us = this_us;
        } else {
          item = {};
          pointer = {};
          pointer.this_us = this_us;
        }
        pointer.is_offline = is_offline;
        _jnagentDlg.prepare_item_user(item, param, pointer);
        if(target_idx == -1) target_idx = items.length - adjust;
        if(target_idx != item_idx) {
          if(item_idx != -1) items.splice(item_idx, 1);
          items.splice(target_idx, 0, item);
        }
      }
      if(!is_contact
        && !other_folder_found
        && appSetting.show_other_user
        && !(this_us._is_offline())
        ) {
        var folder = {};
        var item = {};
        var pointer = {};
        pointer.this_us = this_us;
        pointer.is_offline = is_offline;
        _jnagentDlg.prepare_item_user(item, param, pointer);
        folder.items = [item];
        _jnagentDlg.prepare_folder_other_user(folder, param);
        _jnagentDlg.add_folder(server, folder);
      }

      imDlg.delayed_update();
    }

    this.delete_param = function(param) {
      var idx = this.find_item(_jnagentDlg.data, param);
      if(idx == -1) return;
      _jnagentDlg.data.splice(idx, 1);
      imDlg.fast_update();
    }

    this.update_event_list = function(param) {
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;

      var idx = this.find_item(_jnagentDlg.data, param);
      if(idx == -1) return;
      var server = _jnagentDlg.data[idx];
      var folders = server.folders;
      var i;
      var changed = false;
      for(i = folders.length - 1; i >= 0; i--) {
        var folder = folders[i];
        if(folder.type < FOLDER_TYPE_EVENT) break;
        if(folder.type == FOLDER_TYPE_EVENT) {
          folders.splice(i, 1);
          changed = true;
        }
      }
      var a = param._mmc_event_array();
      if(a && a.length) {
      } else {
        if(changed) {
          imDlg.delayed_update();
        }
        return;
      }
      var folder = {};
      folder.items = [];
      var i;
      for(i = 0; i < a.length; i++) {
        var item = {};
        _jnagentDlg.prepare_item_event(item, param, a[i]);
        folder.items.push(item);
      }
      _jnagentDlg.prepare_folder_event(folder, param);
      _jnagentDlg.add_folder(server, folder);

      imDlg.delayed_update();
    }

    this.update_publish_file_list = function(param) {
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;

      var idx = this.find_item(_jnagentDlg.data, param);
      if(idx == -1) return;
      var server = _jnagentDlg.data[idx];
      var folders = server.folders;
      var i;
      var changed = false;
      for(i = folders.length - 1; i >= 0; i--) {
        var folder = folders[i];
        if(folder.type < FOLDER_TYPE_PUBLISH_FILE) break;
        if(folder.type == FOLDER_TYPE_PUBLISH_FILE) {
          folders.splice(i, 1);
          changed = true;
        }
      }

      var a = param._mmc_publish_file_array();
      if(a && a.length) {
      } else {
        if(changed) {
          imDlg.delayed_update();
        } return;
      }
      var i;
      for(i = 0; i < a.length; i++) {
        var group = a[i].group || '';

        var pointer = {};
        var folder = {};
        pointer.name = group;
        pointer.count = 0;
        pointer.folded = (typeof param._old_publish_folded()[group] === 'undefined') ? param._publish_file_folded() : param._old_publish_folded()[group];
        folder.items = [];
        for(; i < a.length; i++) {
          if((group && a[i].group == group) || (!group && !a[i].group)) {
            pointer.count++;
            var item = {};
            _jnagentDlg.prepare_item_publish(item, param, a[i]);
            folder.items.push(item);
          } else {
            i--;
            break;
          }
        }
        _jnagentDlg.prepare_folder_publish(folder, param, pointer);
        _jnagentDlg.add_folder(server, folder);
      }

      imDlg.delayed_update();
    }

    this.update_pgc = function(param) {
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;

      var idx = this.find_item(_jnagentDlg.data, param);
      if(idx == -1) return;
      var server = _jnagentDlg.data[idx];
      var folders = server.folders;
      var i;
      var changed = false;
      for(i = folders.length - 1; i >= 0; i--) {
        var folder = folders[i];
        if(folder.type < FOLDER_TYPE_PGC) break;
        if(folder.type == FOLDER_TYPE_PGC) {
          folders.splice(i, 1);
          changed = true;
        }
      }
      var hash = param._m_pPgcHash();
      if(!hash || !param._m_PgcCount()) {
        if(changed) {
          imDlg.delayed_update();
        }
        return;
      }
      var folder = {};
      folder.items = [];
      for(var key in hash) {
        if(!hash.hasOwnProperty(key)) continue;
        var pgc = hash[key];
        var item = {};
        _jnagentDlg.prepare_item_pgc(item, param, pgc);
        add_item(folder.items, item, pgc._full_name());
      }
      _jnagentDlg.prepare_folder_pgc(folder, param);
      _jnagentDlg.add_folder(server, folder);

      imDlg.delayed_update();

      function add_item(a, item, name) {
        var i;
        for(i = 0; i < a.length; i++) {
          if(name < a[i].pointer._full_name()) {
            a.splice(i, 0, item);
            return;
          }
        }
        a.splice(i, 0, item);
      }
    }

    this.update_visitor = function(param) {
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;

      var idx = this.find_item(_jnagentDlg.data, param);
      if(idx == -1) return;
      var server = _jnagentDlg.data[idx];
      var folders = server.folders;
      var i;
      var changed = false;
      for(i = folders.length - 1; i >= 0; i--) {
        var folder = folders[i];
        if(folder.type < FOLDER_TYPE_VISITOR) break;
        if(folder.type == FOLDER_TYPE_VISITOR) {
          folders.splice(i, 1);
          changed = true;
        }
      }
      var a = param._m_pVisitorArray();
      if(a && a.length) {
      } else {
        if(changed) {
          imDlg.delayed_update();
        }
        return;
      }
      var folder = {};
      folder.items = [];
      var i;
      for(i = 0; i < a.length; i++) {
        var item = {};
        _jnagentDlg.prepare_item_visitor(item, param, a[i]);
        add_item(folder.items, item, item.pointer.visitor_name);
      }
      _jnagentDlg.prepare_folder_visitor(folder, param);
      _jnagentDlg.add_folder(server, folder);

      imDlg.delayed_update();

      function add_item(a, item, name) {
        var i;
        for(i = 0; i < a.length; i++) {
          if(name < a[i].pointer.visitor_name) {
            a.splice(i, 0, item);
            return;
          }
        }
        a.splice(i, 0, item);
      }
    }

    this.update_contact_group = function(param) {
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;

      var idx = this.find_item(_jnagentDlg.data, param);
      if(idx == -1) return;
      var server = _jnagentDlg.data[idx];
      var folders = server.folders;
      var i;
      var j;
      var changed = false;
      for(i = folders.length - 1; i >= 0; i--) {
        var folder = folders[i];
        if(folder.type < FOLDER_TYPE_CONTACT) break;
        if(folder.type >= FOLDER_TYPE_CONTACT) {
          folders.splice(i, 1);
          changed = true;
        }
      }
      var a = param._m_pContactGroupArray();
      if(a && a.length) {
        for(i = 0; i < a.length; i++) {
          var group = a[i];
          var folder = {};
          folder.items = [];
          var items1 = [];
          var items2 = [];
          var j;
          var b = group.m_pContactArray;
          for(j = 0; j < b.length; j++) {
            var contact = b[j];
            var item = {};
            var pointer = {};
            var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, contact.id);
            pointer.contact = contact;
            if(this_us) {
              pointer.this_us = this_us;
              pointer.is_offline = this_us._is_offline();
            }
            _jnagentDlg.prepare_item_user(item, param, pointer);
            if(this_us && !this_us._is_offline()) {
              add_item1(items1, item, contact.name);
            } else if(appSetting.show_offline_user) {
              add_item2(items2, item, contact.name);
            }
          }
          group.online_count = items1.length;
          _jnagentDlg.prepare_folder_contact(folder, param, group);
          if(items1.length > items2.length) {
            var k;
            for(k = 0; k < items2.length; k++) {
              items1.push(items2[k]);
            }
            folder.items = items1;
          } else {
            var k;
            for(k = items1.length - 1; k >= 0; k--) {
              items2.unshift(items1[k]);
            }
            folder.items = items2;
          }
          _jnagentDlg.add_folder(server, folder);
        }
      }

      function add_item1(a, item, name) {
        var i;
        for(i = 0; i < a.length; i++) {
          if(name < a[i].pointer.this_us._username()) {
            a.splice(i, 0, item);
            return;
          }
        }
        a.splice(i, 0, item);
      }
      function add_item2(a, item, name) {
        var i;
        for(i = 0; i < a.length; i++) {
          if(name < pointer2name(a[i].pointer)) {
            a.splice(i, 0, item);
            return;
          }
        }
        a.splice(i, 0, item);
      }

      // other user
      if(appSetting.show_other_user && hmtg.jmkernel.jm_info_HaveNonContact(param)) {
        changed = true;
        var folder = {};
        folder.items = [];
        var items = folder.items;

        var hash = param._mmc_messenger() ? param._m_p_mmc_user_hash() : param._m_User();
        for(var key in hash) {
          if(!hash.hasOwnProperty(key)) continue;
          var this_us = hash[key];
          if(!this_us._status() && !this_us._office_status())
            continue;
          if(this_us._status() == hmtg.config.ONLINE_STATUS_APPEAROFF)
            continue;

          if((param._mmc_messenger() ? param._internal_id() : param._userid()) == this_us._userid())
            continue;

          if(hmtg.jmkernel.jm_info_IsContact(param, this_us._userid()))
            continue;

          // calcualte target index
          target_idx = -1;
          var myname = hmtg.util.decodeUtf8(this_us._username()).toLowerCase();
          for(j = 0; j < items.length; j++) {
            var thisname = hmtg.util.decodeUtf8(items[j].pointer.this_us._username()).toLowerCase();
            if(myname < thisname) {
              target_idx = j;
              break;
            }
          }
          var item = {};
          var pointer = {};
          pointer.this_us = this_us;
          pointer.is_offline = this_us._is_offline();
          _jnagentDlg.prepare_item_user(item, param, pointer);
          if(target_idx == -1) target_idx = items.length;
          items.splice(target_idx, 0, item);
        }
        _jnagentDlg.prepare_folder_other_user(folder, param);
        _jnagentDlg.add_folder(server, folder);
      }
      if(changed) {
        imDlg.delayed_update();
      }
    }

    this.update_psf_list = function(param) {
      if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;

      var idx = this.find_item(_jnagentDlg.data, param);
      if(idx == -1) return;
      var server = _jnagentDlg.data[idx];
      var folders = server.folders;
      var i;
      var changed = false;
      for(i = folders.length - 1; i >= 0; i--) {
        var folder = folders[i];
        if(folder.type < FOLDER_TYPE_SHARE_FILE) break;
        if(folder.type == FOLDER_TYPE_SHARE_FILE) {
          folders.splice(i, 1);
          changed = true;
        }
      }
      var a = param._m_pShareFileArray();
      if(a && a.length) {
      } else {
        if(changed) {
          imDlg.delayed_update();
        }
        return;
      }
      var i;
      for(i = 0; i < a.length; i++) {
        var group = a[i].group;

        var pointer = {};
        var folder = {};
        pointer.name = group;
        pointer.name2 = a[i].group2;
        pointer.count = 0;
        pointer.folded = (typeof param._old_psf_folded()[group] === 'undefined') ? param._share_file_folded() : param._old_psf_folded()[group];
        folder.items = [];
        for(; i < a.length; i++) {
          if(a[i].group == group) {
            pointer.count++;
            var item = {};
            _jnagentDlg.prepare_item_share(item, param, a[i]);
            folder.items.push(item);
          } else {
            i--;
            break;
          }
        }
        _jnagentDlg.prepare_folder_share(folder, param, pointer);
        _jnagentDlg.add_folder(server, folder);
      }

      imDlg.delayed_update();
    }

    this.callback_JnjShareFile = function(param, psf) {
      hmtg.util.log("recv share file, office '" + param._homepage() + "', source '"
      + hmtg.util.decodeUtf8(psf.owner_name) + "' @ '" + hmtg.util.decodeUtf8(psf.owner_homepage)
      + "', title '" + hmtg.util.decodeUtf8(psf.title) + "', subject '"
      + hmtg.util.decodeUtf8(psf.subject) + "', duration " + psf.duration + " min");

      this.update_psf_list(param);
      var item = {};
      item['timeout'] = 20;
      item['update'] = function() {
        var s = $translate.instant(psf.subject ? 'IDS_FORMAT_ALERT_SHARE_FILE2' : 'IDS_FORMAT_ALERT_SHARE_FILE')
        .replace('#username#', hmtg.util.decodeUtf8(psf.owner_name))
        .replace('#homepage#', hmtg.util.decodeUtf8(psf.owner_homepage))
        .replace('%d', psf.duration)
        ;
        if(psf.subject) {
          s = s.replace()
          .replace('#subject#', hmtg.util.decodeUtf8(psf.name))
          .replace('#title#', hmtg.util.decodeUtf8(psf.title))
          ;
        } else {
          s = s.replace()
          .replace('#title#', hmtg.util.decodeUtf8(psf.title))
          ;
        }
        return s;
      };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['click'] = function(index) {
        var server = {};
        server.pointer = param;
        var item = {};
        item.pointer = psf;

        _jnagentDlg.OnPlaybackShare(null, null, server, null, item, null);

        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);
        hmtgHelper.inside_angular--;
      };

      hmtgAlert.add_link_item(item);
    }

  }
])

;
