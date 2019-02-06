angular.module('msgr')
.controller('ShareJNRModalCtrl', ['$scope', '$modalInstance', 'imDlg', '$translate', 'checkIM', 'hmtgHelper', 'jnagentDlg',
  'hmtgSound',
  function($scope, $modalInstance, imDlg, $translate, checkIM, hmtgHelper, jnagentDlg, hmtgSound) {
    $scope.w = {};
    $scope.w.user_list = [];
    $scope.w.hint = '';
    $scope.w.userid = '';
    $scope.w.username = '';
    $scope.w.add_new = false;
    $scope.w.share_url = $scope.share_url;
    $scope.w.can_copy = true;
    var user_table = document.getElementById('sharejnruserlist');

    var base_param = $scope.param;
    $scope.w.item = $scope.item;
    var flag = {};

    var a = [{ param: base_param, name: hmtg.util.decodeUtf8(base_param._name_or_homepage2())}];
    var i;
    for(i = 0; i < jnagentDlg.data.length; i++) {
      var t = jnagentDlg.data[i].pointer;
      if(t == base_param) continue;
      if(!t._quit()
          && !t._guest()
          && t._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED
          && t._user_status_inited()
          ) {
        a.push({ param: t, name: hmtg.util.decodeUtf8(t._name_or_homepage2()) });
      }
    }
    $scope.w.array = a;
    $scope.w.param = base_param;
    $scope.w.subject = hmtg.util.decodeUtf8($scope.subject);
    var title = $scope.subject;

    $scope.style_height = { 'max-height': Math.max(240, (hmtgHelper.view_port_height >> 1)) + 'px' };

    init_list();

    function init_list() {
      init_add_list();
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
          user_table = document.getElementById('sharejnruserlist');
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
      var param = $scope.w.param;
      if(param._my_id() == id) return;
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

    function init_add_list() {
      var i;
      var param = $scope.w.param;

      $scope.w.user_list = [];
      flag = {};
      $scope.w.selected_count = 0;
      $scope.w.matched_selection = 0;
      $scope.w.all_selected = false;
      $scope.w.hint = '';

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

    $scope.$watch('w.param', function() {
      init_add_list();
    });

    $scope.share = function() {
      if(!$scope.w.matched_selection) return;
      if(hmtg.util.encodeUtf8($scope.w.subject).length >= hmtg.config.MAX_USERNAME) return;
      if($scope.w.param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) return;
      for(var i = 0; i < $scope.w.user_list.length; i++) {
        var item = $scope.w.user_list[i];
        if(item.is_selected && item.matched) {
          var is_mmc = base_param._mmc_messenger();
          hmtg.jmkernel.jm_command_ShareFileToUser(base_param, $scope.w.param, item.id, hmtg.util.encodeUtf8(item.name),
            base_param._username(), base_param._homepage(), hmtg.util.encodeUtf8(title), hmtg.util.encodeUtf8($scope.w.subject),
            $scope.duration, (is_mmc ? $scope.share_url : $scope.share_jnj), (is_mmc ? 1 : 0));
        }
      }

      $scope.w.via_msgr = false;

      hmtgHelper.inside_angular++;
      hmtgSound.ShowInfoPrompt(function() {
        return $translate.instant('ID_SHARE_DONE');
      }, 5);
      hmtgHelper.inside_angular--;
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };

    $scope.copy = function() {
      var target = document.getElementById("share_url");
      if(!target) {
        $scope.w.can_copy = false;
        return;
      }
      hmtg.util.selectText(target);
      try {
        document.execCommand('copy');
      } catch(e) {
        $scope.w.can_copy = false;
      }
    }
  }
])

;