/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('msgr')

.service('checkIM', ['$translate', 'msgrHelper', 'appSetting', 'hmtgHelper', '$rootScope', '$ocLazyLoad', 'hmtgAlert',
  'hmtgSound', '$sce', '$compile', 'imStyle', 'imContainer', 'imDlg',
  function($translate, msgrHelper, appSetting, hmtgHelper, $rootScope, $ocLazyLoad, hmtgAlert, hmtgSound, $sce, $compile,
    imStyle, imContainer, imDlg) {
    var _checkIM = this;
    this.cim_array = [];

    // check IM item
    function CIMItem() {
    }
    // item menu
    CIMItem.prototype.ontoggle = function(cim, open) {
      var _item = this;
      this.menu = [];
      if(!open) {
        if(cim.has_action_menu == 'cim') cim.has_action_menu = '';
        return;
      }
      var param = cim.m_param;
      if(param._quit() || param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) {
        this.dropdown_is_open = 0;
        return;
      }
      // if there are multi-selection and this is a selected item
      // show nothing
      if(_item.is_selected && cim.selected_count > 0) {
        this.dropdown_is_open = 0;
        return;
      }

      var menu = this.menu;

      cim.menu_item = _item;
      cim.has_action_menu = 'cim';
      menu.push({ "text": $translate.instant('ID_DOWNLOAD'), "onclick": _checkIM.download });
      menu.push({ "text": $translate.instant('ID_DELETE'), "onclick": _checkIM.deleteItem });
    }

    // menu command
    this.download = function($scope, cim, item) {
      imDlg.showIMLog($scope, cim.m_param, item.type, item.peer_id, item.display_name);

    }

    this.deleteItem = function($scope, cim, item) {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_WARNING_DELETE_IM'), 0, ok);
      function ok() {
        if(hmtg.jmkernel.jm_command_DeleteServerLog(cim.m_param, item.type, item.peer_id, 0)) {
          if(item.is_selected) {
            cim.selected_count--;
            cim.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", cim.selected_count);
          }
          cim.total_count--;
          cim.total_size -= item.size;
          cim.updateDescr();

          var idx = cim.list.indexOf(item);
          if(idx != -1) {
            cim.list.splice(idx, 1);
          }
        }
      }
    }

    // check IM box
    var SORT_TIME = 1;
    var SORT_NAME = 2;
    var SORT_TEXT = 3;
    var SORT_SIZE = 4;
    function cim() {
      this.hl_count = 0;
      this.title = '';

      this.list = [];
      //this.has_action_menu = ''; // whether there is any context menu
      this.ascending = true;
      this.sort_target = SORT_TIME;
      this.selected_count = 0;

    }

    cim.prototype.highlight = function() {
      if(imContainer.win_count <= 1) return;
      if(imContainer.win_count == 2 && imContainer.is_main_visible) return;
      var t = this;
      this.hl_count++;
      setTimeout(function() {
        t.hl_count--;
        if(!t.hl_count) {
          imDlg.fast_update();
        }
      }, 1000);
    }

    cim.prototype.SetTitleText = function() {
      var param = this.m_param;
      this.title = $translate.instant('IDS_SERVER_IM_LOG') + ' - ' + hmtg.util.decodeUtf8(param._username() + ' @ ' + param._homepage());
    }

    cim.prototype.item2index = function(item) {
      for(var i = 0; i < this.list.length; i++) {
        if(this.list[i] == item) {
          return i;
        }
      }
      return -1;
    }

    cim.prototype.updateDescr = function() {
      if(this.total_count)
        this.descr = $translate.instant('IDS_FORMAT_IM_TOTAL').replace('%d', this.total_count).replace('%s', hmtgHelper.number2GMK(this.total_size));
      else
        this.descr = '';
    }

    cim.prototype.compare = function(item1, item2) {
      var result = this.compare0(item1, item2);
      if(this.ascending) return -result;
      return result;
    }

    cim.prototype.compare0 = function(item1, item2) {
      var result;
      switch(this.sort_target) {
        case SORT_TIME:
          result = item1.tick - item2.tick;
          if(result != 0) return result;
          break;
        case SORT_NAME:
          if(item1.display_name < item2.display_name) return -1;
          if(item1.display_name > item2.display_name) return 1;
          break;
        case SORT_TEXT:
          if(item1.text < item2.text) return -1;
          if(item1.text > item2.text) return 1;
          break;
        case SORT_SIZE:
          result = item1.size - item2.size;
          if(result != 0) return result;
          break;
        default:
          return -1;
      }
      result = item1.tick - item2.tick;
      if(result != 0) return result;
      if(item1.display_name < item2.display_name) return -1;
      if(item1.display_name > item2.display_name) return 1;
      if(item1.text < item2.text) return -1;
      if(item1.text > item2.text) return 1;
      result = item1.size - item2.size;
      if(result != 0) return result;
      return 0;
    }

    cim.prototype.sort = function() {
      // insertion sorting, simple and good for nearly sorted array
      var i, j;
      for(i = 1; i < this.list.length; i++) {
        var x = this.list[i];
        j = i;
        while(j > 0 && this.compare(this.list[j - 1], x) > 0) {
          this.list[j] = this.list[j - 1];
          j--;
        }
        if(i != j) this.list[j] = x;
      }
    }



    this.showCIM = function($scope, param) {
      var i;
      for(i = 0; i < this.cim_array.length; i++) {
        if(this.cim_array[i].m_param == param) {
          $scope.choose_cim(this.cim_array[i]);
          return;
        }
      }
      var target = new cim();
      target.m_param = param;
      target.SetTitleText();
      target.total_count = 0;
      target.total_size = 0;
      _checkIM.cim_array.push(target);
      $scope.choose_cim(target);

      this.retrieveList($scope, target);
    }

    this.retrieveList = function($scope, target) {
      target.list.length = 0;
      target.selected_count = 0;
      target.selection_descr = ''
      target.total_count = 0;
      target.total_size = 0;
      target.descr = $translate.instant('IDS_CONNECTION_STATUS_CONNECTTING');
      target.descr_tick = hmtg.util.GetTickCount();
      target.cim_param = hmtg.jmkernel.jm_command_CheckIM(target.m_param, done, done);

      function done() {
        target.updateDescr();
        target.sort();

        $scope.$digest();
      }
    }

    this.callback_IMNewItem = function(param, cim_param, type, size, peer_id, display_name, tick, text_type, text) {
      var target;
      var i;
      for(i = 0; i < this.cim_array.length; i++) {
        if(this.cim_array[i].m_param == param && this.cim_array[i].cim_param == cim_param) {
          target = this.cim_array[i];
          break;
        }
      }
      if(!target) return;

      target.total_count++;
      target.total_size += size;
      var now = hmtg.util.GetTickCount();
      if(now - target.descr_tick > 1000) {
        target.descr_tick = now;
        target.descr = $translate.instant('ID_FORMAT_LOADING').replace('%d', target.total_count);
        imDlg.fast_update();
      }
      var item = new CIMItem();
      item.type = type;
      item.img = type == hmtg.config.IM_TARGET_TYPE_PEER ? 'img/icon_user_online.png' : (type == hmtg.config.IM_TARGET_TYPE_GUEST ? 'img/icon_server.png' : 'img/icon_user_inmeeting.png');
      item.alt = type == hmtg.config.IM_TARGET_TYPE_PEER ? '[PEER]' : (type == hmtg.config.IM_TARGET_TYPE_GUEST ? '[GUEST]' : '[GROUP]');
      item.size = size;
      item.size_str = hmtgHelper.number2GMK(size);
      item.peer_id = peer_id;
      item.display_name = display_name;
      item.tick = tick;
      item.tick_str = msgrHelper.get_timestring_im2(tick);
      item.text_type = text_type;
      item.text = hmtg.util.decodeUtf8(text);
      switch(text_type) {
        case hmtg.config.IM_TEXT_TYPE_ERROR:
          item.text = '[' + $translate.instant('IDS_ERROR') + '] - ' + item.text;
          break;
        case hmtg.config.IM_TEXT_TYPE_SEND_FILE:
          item.text = '[' + $translate.instant('IDS_SEND_FILE') + '] - ' + item.text;
          break;
        case hmtg.config.IM_TEXT_TYPE_RECV_FILE:
          item.text = '[' + $translate.instant('IDS_RECV_FILE') + '] - ' + item.text;
          break;
        case hmtg.config.IM_TEXT_TYPE_JOIN_GROUP:
          item.text = '[' + $translate.instant('IDS_JOIN') + '] - ' + item.text;
          break;
        case hmtg.config.IM_TEXT_TYPE_LEAVE_GROUP:
          item.text = '[' + $translate.instant('IDS_LEAVE') + '] - ' + item.text;
          break;
        case hmtg.config.IM_TEXT_TYPE_PGC_RENAME:
          item.text = '[' + $translate.instant('IDS_RENAME_PGC') + '] - ' + item.text;
          break;
        default:
          break;
      }
      target.list.push(item);
    }

  }
])

.controller('CIMCtrl', ['$scope', 'Msgr', '$translate', 'hmtgHelper', 'jnagentDlg', '$modal', 'jnjContent',
        '$rootScope', 'msgrHelper', 'hmtgSound', 'checkIM', 'appSetting',
  function($scope, Msgr, $translate, hmtgHelper, jnagentDlg, $modal, jnjContent, $rootScope, msgrHelper,
        hmtgSound, checkIM, appSetting) {
    $scope.as = appSetting;
    $scope.display_index = 0; // this first index to be displayed
    $scope.count = (appSetting.max_display_item >> 0);  // the count of items to be displayed
    $scope.last_selected_item = null;

    var myheight = 100;
    $scope.style_cim_height = function() {
      var old = myheight;
      if($scope.cim.visible && $rootScope.nav_item == 'msgr') {
        var offset = {};
        hmtg.util.calcOffset($scope.cim.cim_div, offset);
        if(offset.y) {
          myheight = Math.max((hmtgHelper.view_port_height >> 1), hmtgHelper.view_port_height - offset.y - 20);
        }
      }

      // this logic can prevent exception caused by too frequent $digest
      // [$rootScope:infdig]
      if(myheight > old && myheight - old < 5) {
        myheight = old;
      }
      return {
        'height': '' + (myheight) + 'px'
      };
    }

    // selection menu
    $scope.ontoggle = function(open) {
      $scope.selection_menu = [];
      if(!open) {
        if($scope.cim.has_action_menu == 'sel') $scope.cim.has_action_menu = '';
        return;
      }
      $scope.cim.has_action_menu = 'sel';

      var menu = $scope.selection_menu;
      // prepare the menu for the selection
      var param = $scope.cim.m_param;
      if(!(param._quit() || param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED)) {
        menu.push({ "text": $translate.instant('IDC_DELETE'), "onclick": $scope.deleteSelection });
      }
      menu.push({ "text": $translate.instant('ID_RESET_SELECTION'), "onclick": $scope.resetSelection });
    }

    // selection action
    $scope.deleteSelection = function() {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_WARNING_DELETE_SELECTED_IM'), 0, ok);
      function ok() {
        var cim = $scope.cim;
        for(var i = $scope.cim.list.length - 1; i >= 0; i--) {
          var item = $scope.cim.list[i];
          if(item.is_selected) {
            if(hmtg.jmkernel.jm_command_DeleteServerLog(cim.m_param, item.type, item.peer_id, 0)) {
              cim.total_count--;
              cim.total_size -= item.size;

              cim.list.splice(i, 1);
            }
          }
        }
        $scope.cim.selected_count = 0;
        $scope.cim.selection_descr = '';
        cim.updateDescr();
      }
    }
    $scope.resetSelection = function() {
      for(var i = 0; i < $scope.cim.list.length; i++) {
        $scope.cim.list[i].is_selected = false;
      }
      $scope.cim.selected_count = 0;
      $scope.cim.selection_descr = '';
    }
    $scope.select_all = function(cim) {
      cim.all_selected = false;
      for(var i = 0; i < $scope.cim.list.length; i++) {
        $scope.cim.list[i].is_selected = true;
      }
      $scope.cim.selected_count = $scope.cim.list.length;
      $scope.cim.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.cim.selected_count);
    }
    $scope.item_selected = function(cim, item, e) {
      if(item.is_selected) {
        $scope.cim.selected_count++;
        $scope.cim.menu_item = item;
      } else {
        $scope.cim.selected_count--;
      }
      if(e.shiftKey && $scope.last_selected_item && $scope.last_selected_item != item) {
        var last_idx = $scope.cim.list.indexOf($scope.last_selected_item);
        if(last_idx != -1) {
          var i;
          var this_idx = $scope.cim.list.indexOf(item);
          var from = last_idx;
          var to = this_idx;
          if(from > to) {
            to = from;
            from = this_idx;
          }
          var item2;
          for(i = from; i <= to; i++) {
            if(i == this_idx) continue;
            item2 = $scope.cim.list[i];
            if(item.is_selected && !item2.is_selected) {
              item2.is_selected = true;
              $scope.cim.selected_count++;
            }
            if(!item.is_selected && item2.is_selected) {
              item2.is_selected = false;
              $scope.cim.selected_count--;
            }
          }
        }
      }
      $scope.last_selected_item = item;
      $scope.cim.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.cim.selected_count);
    }

    // update display list
    $scope.update_display_list = function() {
      var max_item = $scope.count;
      var menu_index = -1;
      if($scope.cim.menu_item) menu_index = $scope.cim.item2index($scope.cim.menu_item);
      // make sure the item with menu is included
      if(menu_index == -1) {
        $scope.cim.menu_item = null;
      } else {
        var first = Math.max(0, Math.min($scope.display_index, $scope.cim.list.length - max_item));
        if(menu_index >= 0 && max_item < $scope.cim.list.length) {
          var end = first + max_item;
          if(menu_index < first) {
            // shift view window upward to include the menu ssrc
            first = $scope.display_index = menu_index;
          } else if(menu_index >= end) {
            // shift view window downward to include the menu ssrc
            first = $scope.display_index = menu_index - (max_item - 1);
          }
        }

        if(menu_index >= 0) {
          // make sure the menu ssrc is visible by scrolling the window
          $scope.cim.cim_div.scrollTop = ((menu_index - first) / Math.max(1, Math.min(max_item, $scope.cim.list.length)) * $scope.cim.cim_div.scrollHeight) >> 0;
        }
      }
    }

    $scope.$on(hmtgHelper.WM_MAX_DISPLAY_ITEM_CHANGED, function() {
      $scope.count = (appSetting.max_display_item >> 0);
      $scope.update_display_list();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.scroll_up = function() {
      $scope.display_index = Math.min($scope.display_index, $scope.cim.list.length - $scope.count);
      $scope.display_index -= 1 + ($scope.count >> 1);
      if($scope.display_index < 0) $scope.display_index = 0;
    }

    $scope.scroll_down = function() {
      $scope.display_index += 1 + ($scope.count >> 1);
      if($scope.display_index + $scope.count > $scope.cim.list.length) {
        $scope.display_index = $scope.cim.list.length - $scope.count;
      }
    }

    $scope.click_item = function(cim, item, menu) {
      menu.onclick($scope, cim, item);
    }

    $scope.resort = function(sort_target) {
      if($scope.cim.sort_target == sort_target) {
        $scope.cim.ascending = !$scope.cim.ascending;
        $scope.cim.list.reverse();
      } else {
        $scope.cim.sort_target = sort_target;
        $scope.cim.sort();
      }
      // do not update display list, to keep the header visible, unless using a fixed header
      //$scope.update_display_list();
    }
  }
])

.directive('cimFinder', [
  function() {
    function link($scope, element, attrs) {
      $scope.cim.cim_div = element[0];
    }

    return {
      link: link
    };
  }
])

;