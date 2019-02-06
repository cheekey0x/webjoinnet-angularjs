angular.module('msgr')
.controller('PickUserModalCtrl', ['$scope', '$modalInstance', 'imDlg', '$translate', 'checkIM', 'hmtgHelper',
  function($scope, $modalInstance, imDlg, $translate, checkIM, hmtgHelper) {
    $scope.w = {};
    $scope.w.user_list = [];
    $scope.w.hint = '';
    $scope.w.can_add_new = false;
    $scope.w.userid = '';
    $scope.w.username = '';
    $scope.w.add_new = false;
    var user_table = document.getElementById('pickuserlist');

    var flag = {};

    $scope.style_height = { 'max-height': Math.max(240, (hmtgHelper.view_port_height >> 1)) + 'px' };

    init_list();

    function init_list() {
      if($scope.type == 'add-member') {
        init_list_add_member();
        $scope.w.title = $translate.instant('ID_ADD');
        var im = $scope.c1;
        var param = im.m_param;
        var pgc;
        if(im.m_group_id) {
          pgc = param._m_pPgcHash()[im.m_group_id];
          $scope.w.subtitle = hmtg.util.decodeUtf8(pgc._full_name());
        }
        $scope.w.can_add_new = true;
      } else if($scope.type == 'remove-member') {
        init_list_remove_member();
        $scope.w.title = $translate.instant('ID_REMOVE');
        var im = $scope.c1;
        var param = im.m_param;
        var pgc;
        if(im.m_group_id) {
          pgc = param._m_pPgcHash()[im.m_group_id];
          $scope.w.subtitle = hmtg.util.decodeUtf8(pgc._full_name());
        }
      } else if($scope.type == 'add-contact') {
        init_list_add_contact();
        $scope.w.title = $translate.instant('ID_PICKCONTACT');
        var group = $scope.c2;
        $scope.w.subtitle = hmtg.util.decodeUtf8(group.m_szGroupName);
        $scope.w.can_add_new = true;
      } else if($scope.type == 'delete-contact') {
        init_list_delete_contact();
        $scope.w.title = $translate.instant('ID_DELETECONTACT');
        var group = $scope.c2;
        $scope.w.subtitle = hmtg.util.decodeUtf8(group.m_szGroupName);
      }
    }

    $scope.add_user = function() {
      var id = hmtg.util.encodeUtf8($scope.w.userid);
      if(!id) return;
      var name = hmtg.util.encodeUtf8($scope.w.username) || id;
      if(flag[id]) return;
      flag[id] = 1;
      if(!check_id(id)) return;
      var item = add_list(id, name, true);

      var a = $scope.w.user_list;
      var idx = a.indexOf(item);
      if(idx != -1) {
        if(!user_table) {
          user_table = document.getElementById('pickuserlist');
        }
        if(user_table) {
          // make sure the newly added item is visible by scrolling the window
          user_table.scrollTop = ((idx / a.length) * user_table.scrollHeight) >> 0;
        }
      }

      $scope.w.userid = '';
      $scope.w.username = '';
      $scope.w.add_new = false;
    }

    function check_id(id) {
      if($scope.type == 'add-member') {
        return check_id_add_member(id);
      } else if($scope.type == 'add-contact') {
        return check_id_add_contact(id);
      }
    }
    function check_id_add_member(id) {
      var im = $scope.c1;
      var param = im.m_param;
      var pgc;
      var member_hash;
      if(im.m_group_id) {
        pgc = param._m_pPgcHash()[im.m_group_id];
        member_hash = pgc._member_hash();
      }
      if(param._my_id() == id) return;
      if(im.m_group_id) {
        if(typeof member_hash[id] !== 'undefined') return;
      } else {
        if(im.peer_userid == id) return;
      }
      if(im.m_request_hash[id]) return;
      if(im.waiting_id && im.waiting_id == id) return;
      return true;
    }
    function check_id_add_contact(id) {
      var param = $scope.c1;
      var group = $scope.c2;

      if(param._my_id() == id) return;
      var j;
      var b = group.m_pContactArray;
      for(j = 0; j < b.length; j++) {
        var contact = b[j];
        if(id == contact.id) return;
      }
      return true;
    }

    function add_list(id, name0, is_selected) {
      var i;
      var name = hmtg.util.decodeUtf8(name0);
      var item = {};
      item.id = id;
      item.name = name;

      var h = $scope.w.hint.toLowerCase();
      item.matched = (!h || item.name.toLowerCase().indexOf(h) != -1);

      item.is_selected = is_selected;
      if(is_selected) {
        $scope.w.selected_count++;
        if(item.matched) {
          $scope.w.matched_selection++;
        }
        $scope.w.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.w.matched_selection);
      }

      var a = $scope.w.user_list;
      for(i = 0; i < a.length; i++) {
        if(name < a[i].name) {
          a.splice(i, 0, item);
          return item;
        }
      }
      a.splice(i, 0, item);
      return item;
    }

    function init_list_add_member() {
      var i;
      var im = $scope.c1;
      var param = im.m_param;

      // users in memory
      var hash = param._mmc_messenger() ? param._m_p_mmc_user_hash() : param._m_User();
      for(var key in hash) {
        if(!hash.hasOwnProperty(key)) continue;
        var this_us = hash[key];
        if(!check_id(this_us._userid())) continue;
        if(!this_us._status())
          continue;
        if(this_us._major() < 1 || (this_us._major() == 1 && this_us._minor() < 20))
          continue;
        flag[this_us._userid()] = 1;
        add_list(this_us._userid(), this_us._username());
      }

      // users in contact group
      var a = param._m_pContactGroupArray();
      if(a && a.length) {
        for(i = 0; i < a.length; i++) {
          var group = a[i];
          var j;
          var b = group.m_pContactArray;
          for(j = 0; j < b.length; j++) {
            var contact = b[j];
            if(flag[contact.id]) continue;
            flag[contact.id] = 1;
            var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, contact.id);
            if(!check_id(contact.id)) continue;
            if(!this_us) {
              add_list(contact.id, contact.name);
            } else {
              add_list(this_us._userid(), this_us._username());
            }
          }
        }
      }

      // users as im/iml peers
      for(i = 0; i < imDlg.im_array.length; i++) {
        var this_im = imDlg.im_array[i];
        if(this_im.m_param != param) continue;
        if(this_im.m_group_id) continue;
        if(this_im.m_b_is_peer_guest) continue;
        var id = this_im.peer_userid;
        if(flag[id]) continue;
        flag[id] = 1;
        if(!check_id(id)) continue;
        add_list(id, this_im.peer_username);
      }
      for(i = 0; i < imDlg.iml_array.length; i++) {
        var this_iml = imDlg.iml_array[i];
        if(this_iml.m_param != param) continue;
        if(this_iml.log_type != hmtg.config.IM_TARGET_TYPE_PEER) continue;
        var id = this_iml.log_peer;
        if(flag[id]) continue;
        flag[id] = 1;
        if(!check_id(id)) continue;
        add_list(id, this_iml.log_name);
      }

      // users in conversation log list
      for(i = 0; i < checkIM.cim_array.length; i++) {
        var this_cim = checkIM.cim_array[i];
        if(this_cim.m_param != param) continue;
        var j;
        for(j = 0; j < this_cim.list.length; j++) {
          var item = this_cim.list[j];
          if(item.type != hmtg.config.IM_TARGET_TYPE_PEER) continue;
          var id = item.peer_id;
          if(flag[id]) continue;
          flag[id] = 1;
          if(!check_id(id)) continue;
          add_list(id, item.display_name);
        }
        break;
      }
    }

    function init_list_remove_member() {
      var im = $scope.c1;
      var param = im.m_param;
      var pgc;
      var member_hash;
      if(!im.m_group_id) return;
      pgc = param._m_pPgcHash()[im.m_group_id];
      member_hash = pgc._member_hash();

      var hash = member_hash;
      for(var key in hash) {
        if(!hash.hasOwnProperty(key)) continue;
        var id = key;
        if(param._my_id() == id) continue;
        var username = hmtg.jmkernel.jm_info_GetUserName(param, id);
        add_list(id, username);
      }
    }


    function init_list_add_contact() {
      var i;
      var param = $scope.c1;
      var group0 = $scope.c2;

      // users in memory
      var hash = param._mmc_messenger() ? param._m_p_mmc_user_hash() : param._m_User();
      for(var key in hash) {
        if(!hash.hasOwnProperty(key)) continue;
        var this_us = hash[key];
        if(!check_id(this_us._userid())) continue;
        flag[this_us._userid()] = 1;
        add_list(this_us._userid(), this_us._username());
      }

      // users in contact group
      var a = param._m_pContactGroupArray();
      if(a && a.length) {
        for(i = 0; i < a.length; i++) {
          var group = a[i];
          if(group == group0) continue;
          var j;
          var b = group.m_pContactArray;
          for(j = 0; j < b.length; j++) {
            var contact = b[j];
            if(flag[contact.id]) continue;
            flag[contact.id] = 1;
            var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, contact.id);
            if(!check_id(contact.id)) continue;
            if(!this_us) {
              add_list(contact.id, contact.name);
            } else {
              add_list(this_us._userid(), this_us._username());
            }
          }
        }
      }

      // users as im/iml peers
      for(i = 0; i < imDlg.im_array.length; i++) {
        var this_im = imDlg.im_array[i];
        if(this_im.m_param != param) continue;
        if(this_im.m_group_id) continue;
        if(this_im.m_b_is_peer_guest) continue;
        var id = this_im.peer_userid;
        if(flag[id]) continue;
        flag[id] = 1;
        if(!check_id(id)) continue;
        add_list(id, this_im.peer_username);
      }
      for(i = 0; i < imDlg.iml_array.length; i++) {
        var this_iml = imDlg.iml_array[i];
        if(this_iml.m_param != param) continue;
        if(this_iml.log_type != hmtg.config.IM_TARGET_TYPE_PEER) continue;
        var id = this_iml.log_peer;
        if(flag[id]) continue;
        flag[id] = 1;
        if(!check_id(id)) continue;
        add_list(id, this_iml.log_name);
      }

      // users in conversation log list
      for(i = 0; i < checkIM.cim_array.length; i++) {
        var this_cim = checkIM.cim_array[i];
        if(this_cim.m_param != param) continue;
        var j;
        for(j = 0; j < this_cim.list.length; j++) {
          var item = this_cim.list[j];
          if(item.type != hmtg.config.IM_TARGET_TYPE_PEER) continue;
          var id = item.peer_id;
          if(flag[id]) continue;
          flag[id] = 1;
          if(!check_id(id)) continue;
          add_list(id, item.display_name);
        }
        break;
      }
    }

    function init_list_delete_contact() {
      var i;
      var param = $scope.c1;
      var group0 = $scope.c2;

      // users in contact group
      var a = param._m_pContactGroupArray();
      if(a && a.length) {
        for(i = 0; i < a.length; i++) {
          var group = a[i];
          if(group == group0) {
            var j;
            var b = group.m_pContactArray;
            for(j = 0; j < b.length; j++) {
              var contact = b[j];
              if(flag[contact.id]) continue;
              flag[contact.id] = 1;
              var this_us = hmtg.jmkernel.jm_command_ParamFindUser(param, contact.id);
              if(!this_us) {
                add_list(contact.id, contact.name);
              } else {
                add_list(this_us._userid(), this_us._username());
              }
            }
            break;
          }
        }
      }
    }

    $scope.user_selected = function(user) {
      if(user.is_selected) {
        $scope.w.selected_count++;
        $scope.w.matched_selection++;
      } else {
        $scope.w.selected_count--;
        $scope.w.matched_selection--;
      }
      $scope.w.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.w.matched_selection);
    }

    $scope.select_all = function() {
      $scope.w.all_selected = false;
      for(var i = 0; i < $scope.w.user_list.length; i++) {
        var item = $scope.w.user_list[i];
        if(!item.matched) continue;
        if(!item.is_selected) {
          item.is_selected = true;
          $scope.w.selected_count++;
          $scope.w.matched_selection++;
        }
      }
      $scope.w.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.w.matched_selection);
    }

    $scope.resetSelection = function() {
      for(var i = 0; i < $scope.w.user_list.length; i++) {
        var item = $scope.w.user_list[i];
        if(!item.matched) continue;
        if(item.is_selected) {
          item.is_selected = false;
          $scope.w.selected_count--;
          $scope.w.matched_selection--;
        }
      }
      $scope.w.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.w.matched_selection);
    }

    // selection menu
    $scope.ontoggle = function(open) {
      $scope.w.selection_menu = [];
      if(!open) {
        if($scope.w.has_action_menu == 'sel') $scope.w.has_action_menu = '';
        return;
      }
      $scope.w.has_action_menu = 'sel';

      var menu = $scope.w.selection_menu;
      // prepare the menu for the selection
      menu.push({ "text": $translate.instant('ID_RESET_SELECTION'), "onclick": $scope.resetSelection });
    }

    $scope.$watch('w.hint', function() {
      var matched_selection = 0;
      var h = $scope.w.hint.toLowerCase();
      for(var i = 0; i < $scope.w.user_list.length; i++) {
        var item = $scope.w.user_list[i];
        if(!h || item.name.toLowerCase().indexOf(h) != -1) {
          item.matched = true;
          if(item.is_selected) {
            matched_selection++;
          }
        } else {
          item.matched = false;
        }
      }
      $scope.w.matched_selection = matched_selection;
      $scope.w.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.w.matched_selection);
    });

    $scope.ok = function() {
      if(!$scope.w.matched_selection) return;
      if($scope.type == 'remove-member') {
        hmtgHelper.OKCancelMessageBox($translate.instant('ID_REMOVE_MEMBER_PROMPT'), 0, ok);
      } else if($scope.type == 'delete-contact') {
        hmtgHelper.OKCancelMessageBox($translate.instant('ID_DELETE_CONTACT_PROMPT'), 0, ok);
      } else {
        ok();
      }
      function ok() {
        var a = [];
        var b = [];
        for(var i = 0; i < $scope.w.user_list.length; i++) {
          var item = $scope.w.user_list[i];
          if(item.is_selected && item.matched) {
            a.push(item.id);
            if($scope.type == 'add-contact') {
              b.push(hmtg.util.encodeUtf8(item.name));
            }
          }
        }
        $modalInstance.close({ id: a, name: b });
      }
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
])

;