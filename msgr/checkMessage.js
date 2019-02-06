/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('msgr')

.service('checkMsg', ['$translate', 'msgrHelper', 'appSetting', 'hmtgHelper', '$rootScope', '$ocLazyLoad', 'hmtgAlert',
  'hmtgSound', '$sce', '$compile', 'imStyle', 'imContainer', 'imDlg', '$modal', 'board',
  function($translate, msgrHelper, appSetting, hmtgHelper, $rootScope, $ocLazyLoad, hmtgAlert, hmtgSound, $sce, $compile,
    imStyle, imContainer, imDlg, $modal, board) {
    var _checkMsg = this;
    this.cm_array = [];

    // check Msg item
    function CMItem() {
    }
    // item menu
    CMItem.prototype.ontoggle = function(cm, open) {
      var _item = this;
      this.menu = [];
      if(!open) {
        if(cm.has_action_menu == 'cm') cm.has_action_menu = '';
        return;
      }
      var param = cm.m_param;
      if(param._quit() || param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED) {
        this.dropdown_is_open = 0;
        return;
      }

      var menu = this.menu;

      cm.menu_item = _item;
      cm.has_action_menu = 'cm';
      if(!cm.cm_param._connected()) {
        menu.push({ "text": $translate.instant('IDS_LOG_REFRESH'), "onclick": _checkMsg.refresh });
        return;
      }
      // if there are multi-selection and this is a selected item
      // show nothing
      if(_item.is_selected && cm.selected_count > 0) {
        this.dropdown_is_open = 0;
        return;
      }
      if(cm.cm_param._busy()) {
        if(cm.m_param._mmc_messenger()) {
          this.dropdown_is_open = 0;
          return;
        }
        menu.push({ "text": $translate.instant('ID_PLAYBACK'), "onclick": _checkMsg.playback });
        return;
      }
      menu.push({ "text": $translate.instant('ID_PLAYBACK'), "onclick": _checkMsg.playback });
      menu.push({ "text": $translate.instant('ID_DELETE'), "onclick": _checkMsg.deleteItem });
      if(cm.cm_param._jn_bEnableWebOfficeEx()) {
        menu.push({ "text": $translate.instant('ID_CHANGE_TITLE'), "onclick": _checkMsg.changeTitle });
        if(cm.cm_param._jn_bEnableJNRPassword()) {
          menu.push({ "text": $translate.instant('ID_CHANGE_JNR_PASSWORD'), "onclick": _checkMsg.changePassword });
        }
        menu.push({ "text": $translate.instant('ID_SHARE'), "onclick": _checkMsg.share });
        if((this.flag & 0x20000000) || _item.view_count) {
          menu.push({ "text": $translate.instant('ID_VIEW_RECORD'), "onclick": _checkMsg.viewRecord });
        }
        if(this.flag & 0x20000000) {
          menu.push({ "text": $translate.instant('ID_UNSHARE'), "onclick": _checkMsg.unshare });
        }
        if(!(this.flag & 0x40000000)) {
          menu.push({ "text": $translate.instant('IDD_DIALOG_JEDITOR'), "onclick": _checkMsg.jeditor });
        }
      }
      if(this.flag & 0x80000000) {
        menu.push({ "text": $translate.instant('ID_MARK_UNREAD'), "onclick": _checkMsg.markUnread });
      } else {
        menu.push({ "text": $translate.instant('ID_MARK_READ'), "onclick": _checkMsg.markRead });
      }
      menu.push({ "text": $translate.instant('ID_SET_GROUP'), "onclick": _checkMsg.setGroup });
      if(this.group) {
        menu.push({ "text": $translate.instant('ID_GROUP_TOTAL'), "onclick": _checkMsg.showGroupTotal });
      }
      menu.push({ "text": $translate.instant('ID_DOWNLOAD'), "onclick": _checkMsg.download });
      if(cm.cm_param._jn_bEnableWebOfficeEx()) {
        menu.push({ "text": $translate.instant('ID_UPLOAD'), "onclick": _checkMsg.upload });
      }
    }

    // menu command
    this.refresh = function($scope, cm, item) {
      $scope.refresh_cm(cm);
    }

    this.playback = function($scope, cm, item) {
      if(cm.cm_param._busy() && cm.m_param._mmc_messenger()) return;
      if(cm.m_param._mmc_messenger()) {
        cm.cm_param._thread_status(0);
      }
      hmtg.jmkernel.jm_command_Playback(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);
    }

    this.markRead = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(item.flag & 0x80000000) return;
      item.flag |= 0x80000000;
      item.img = 'img/icon_' + _checkMsg.flag2iconindex(item.flag) + '.png';
      item.alt = '[' + _checkMsg.flag2iconindex(item.flag) + ']';
      cm.new_count--;
      cm.updateDescr();
      hmtg.jmkernel.jm_command_MarkRead(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);
    }

    this.markUnread = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(!(item.flag & 0x80000000)) return;
      item.flag &= 0x7fffffff;
      item.img = 'img/icon_' + _checkMsg.flag2iconindex(item.flag) + '.png';
      item.alt = '[' + _checkMsg.flag2iconindex(item.flag) + ']';
      cm.new_count++;
      cm.updateDescr();
      hmtg.jmkernel.jm_command_MarkUnread(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);
    }

    this.deleteItem = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_WARNING_DELETE_JNR'), 0, ok);
      function ok() {
        if(!(item.flag & 0x80000000)) cm.new_count--;
        if(item.is_selected) {
          cm.selected_count--;
          cm.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", cm.selected_count);
        }
        cm.total_count--;
        cm.total_size -= item.size;
        hmtg.jmkernel.jm_command_Delete(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);

        var idx = cm.list.indexOf(item);
        if(idx != -1) {
          cm.list.splice(idx, 1);
        }
        cm.updateDescr();
      }
    }

    this.share = function($scope, cm, item) {
      share_file($scope, cm, item, false);
    }

    function share_file($scope, cm, item, is_restricted) {
      if(cm.cm_param._busy()) return;
      if(item.flag & 0x40000000) {
        hmtgHelper.OKCancelMessageBox($translate.instant('IDS_SHARE_ENCRYPTED_FILE'), 0, ok);
      } else {
        ok();
      }
      function ok() {
        if(is_restricted) {
        } else {
          ok2();
        }
      }
      function ok2() {
        cm.cm_param._thread_status(0);
        cm.cm_param._cache_item(item);
        hmtg.jmkernel.jm_command_Share(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index, null, '', false, 0, false, '');
      }
    }

    this.unshare = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(!(item.flag & 0x20000000)) return;
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_UNSHARE_PROMPT'), 0, ok);
      function ok() {
        cm.cm_param._thread_status(0);
        cm.cm_param._cache_item(item);
        hmtg.jmkernel.jm_command_Unshare(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);
      }
    }

    this.viewRecord = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(!(item.flag & 0x20000000) && !item.view_count) return;
      cm.cm_param._thread_status(0);
      cm.cm_param._cache_item(item);
      hmtg.jmkernel.jm_command_ViewRecord(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);
    }

    this.changeTitle = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(item.flag & 0x20000000) {
        hmtgHelper.OKCancelMessageBox($translate.instant('IDS_MODIFY_FILE_WARNING'), 0, ok);
      } else {
        ok();
      }
      function ok() {
        hmtgHelper.renameDialog($scope, hmtg.util.decodeUtf8(item.title), $translate.instant('ID_CHANGE_TITLE'), hmtg.util.decodeUtf8(item.tick_str + ' ' + item.title), ok2, 'change_title', []);
      }
      function ok2(new_value) {
        cm.cm_param._thread_status(0);
        cm.cm_param._cache_item(item);
        item.new_title = new_value;
        hmtg.jmkernel.jm_command_ChangeTitle(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index, new_value);
      }
    }

    this.changePassword = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(item.flag & 0x20000000) {
        hmtgHelper.OKCancelMessageBox($translate.instant('IDS_MODIFY_FILE_WARNING'), 0, ok);
      } else {
        ok();
      }
      function ok() {
        $scope.set_password_only = false;
        $scope.item = item;
        $ocLazyLoad.load({
          name: 'hmtgs',
          files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_change_jnr_password' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
        }).then(function() {
          var modalInstance = $modal.open({
            templateUrl: 'template/ChangeJnrPassword.htm' + hmtgHelper.cache_param,
            scope: $scope,
            controller: 'ChangeJnrPasswordModalCtrl',
            size: '',
            backdrop: 'static',
            resolve: {}
          });

          modalInstance.result.then(function(result) {
            cm.cm_param._thread_status(0);
            cm.cm_param._cache_item(item);
            item.has_new_password = !!result.password;
            hmtg.jmkernel.jm_command_ChangeJNRPassword(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index, result.password0, result.password);
          }, function() {
          });
        }, function(e) {
          hmtg.util.log(-1, 'Warning! lazy_loading modal_change_jnr_password fails');
        });
      }
    }

    this.jeditor = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(item.flag & 0x40000000) return;
      $scope.title = item.title;
      $scope.item = item;
      $ocLazyLoad.load({
        name: 'hmtgs',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_jeditor' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/jeditor.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'JeditorModalCtrl',
          size: 'lg',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(cmd) {
          cm.cm_param._thread_status(0);
          cm.cm_param._cache_item(item);
          hmtg.jmkernel.jm_command_Jeditor(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index, cmd);
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_change_jnr_password fails');
      });
    }

    this.download = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(board.memory_usage + hmtg.jnkernel._memory_usage() + item.size > appSetting.max_blob * 1048576) {
        hmtgHelper.MessageBox($translate.instant('IDS_FILE_TOO_LARGE') + '(' + $translate.instant('ID_MEMORY_USAGE') + ',' + hmtgHelper.number2GMK(board.memory_usage + hmtg.jnkernel._memory_usage()) + ' + ' + hmtgHelper.number2GMK(item.size) + ' > ' + hmtgHelper.number2GMK(appSetting.max_blob * 1048576) + ')', 20);
        return;
      }
      cm.cm_param._thread_status(0);
      cm.cm_param._cache_item(item);
      hmtg.jmkernel.jm_command_Download(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);
    }

    this.upload = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      if(cm.cm_param._m_bToArchive()) {
        hmtgHelper.OKCancelMessageBox($translate.instant('IDS_ARCHIVE_WARNING'), 0, ok);
      } else {
        ok();
      }
      function ok() {
        _checkMsg.file_input = hmtgHelper.file_reset('fileInput', '.jnr');

        _checkMsg.file_input.addEventListener("change", _upload, false);
        if(window.navigator.msSaveOrOpenBlob) {
          setTimeout(function() {
            _checkMsg.file_input.click();  // use timeout, otherwise, IE will complain error
          }, 0);
        } else {
          // it is necessary to exempt error here
          // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
          window.g_exempted_error++;
          _checkMsg.file_input.click();
          window.g_exempted_error--;
        }
      }
      function _upload() {
        _checkMsg.file_input.removeEventListener("change", _upload, false);
        var file = _checkMsg.file_input.files[0];
        if(!file) return;
        if(!hmtg.util.endsWith(file.name.toLowerCase(), '.jnr')) return;
        if(!file.size) return;
        if(file.size <= 74) return; // file header size = 74
        var end = Math.min(file.size, 20000);
        var reader = new FileReader();
        reader.onload = function(e) {
          var data = new Uint8Array(e.target.result);
          cm.cm_param._buffer(data);
          cm.cm_param._buffer_offset(0);
          cm.cm_param._buffer_pointer(0);
          cm.cm_param._buffer_end(end);
          cm.cm_param._buffer_busy(false);

          hmtg.jmkernel.jm_command_Upload(cm.m_param, cm.cm_param, file);
        }
        reader.onerror = function(e) {
          cm.cm_param._thread_status(1);
          msgrHelper.ShowWebOfficeError($translate.instant, hmtg.config.WEBOFFICE_EX_ERROR_OPEN_FILE);
        }
        cm.cm_param._thread_status(0);
        reader.readAsArrayBuffer(file.slice(0, end));
      }
    }

    this.setGroup = function($scope, cm, item) {
      if(cm.cm_param._busy()) return;
      hmtgHelper.renameDialog($scope, hmtg.util.decodeUtf8(item.group), $translate.instant('ID_SET_GROUP'), hmtg.util.decodeUtf8(item.tick_str + ' ' + item.title), ok, 'set_group', []);
      function ok(new_value) {
        item.group = new_value;
        if(cm.sort_target == SORT_GROUP) {
          cm.sort();
          cm.menu_item = item;
          $scope.update_display_list();
        }
        hmtg.jmkernel.jm_command_SetGroup(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index, new_value);
      }
    }

    this.showGroupTotal = function($scope, cm, item) {
      if(!item.group) return;
      hmtgHelper.MessageBox(cm.calcGroupData(item.group), 0);
    }

    // check Msg box
    var SORT_TIME = 1;
    var SORT_GROUP = 2;
    var SORT_TITLE = 3;
    var SORT_DURATION = 4;
    var SORT_SIZE = 5;
    var SORT_VIEW_COUNT = 6;
    var SORT_WEB_TITLE = 7;
    function cm() {
      this.hl_count = 0;
      this.title = '';

      this.list = [];
      //this.has_action_menu = ''; // whether there is any context menu
      this.ascending = true;
      this.sort_target = SORT_TIME;
      this.selected_count = 0;

    }

    cm.prototype.highlight = function() {
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

    cm.prototype.SetTitleText = function() {
      var param = this.m_param;
      this.title = $translate.instant('ID_CHECK_MESSAGE') + ' - ' + hmtg.util.decodeUtf8(param._username() + ' @ ' + param._homepage());
    }

    cm.prototype.item2index = function(item) {
      for(var i = 0; i < this.list.length; i++) {
        if(this.list[i] == item) {
          return i;
        }
      }
      return -1;
    }

    cm.prototype.calcGroupData = function(group) {
      var i;
      var tc = 0;
      var td = 0;
      var ts = 0;
      var tv = 0;
      for(i = 0; i < this.list.length; i++) {
        var item = this.list[i];
        if(item.group != group) continue;
        tc++;
        td += item.duration;
        ts += item.size;
        tv += item.view_count;
      }
      return $translate.instant('IDS_FORMAT_GROUP_TOTAL')
        .replace('#group#', hmtg.util.decodeUtf8(group))
        .replace('#size#', hmtgHelper.number2GMK(ts))
        .replace('%d', tc)
        .replace('%d', td)
        .replace('%d', tv)
        ;
    }

    cm.prototype.updateDescr = function() {
      if(this.total_count) {
        this.descr1 = $translate.instant('IDS_FORMAT_FILE_COUNT').replace('%d', this.new_count).replace('%d', this.total_count);
      }
      else {
        this.descr1 = '';
      }
      if(this.cm_param._diskquota()) {
        this.descr2 = $translate.instant('IDS_FORMAT_DISK_USAGE_INFO').replace('#usage#', hmtgHelper.number2GMK(this.total_size)).replace('#quota#', hmtgHelper.number2GMK(this.cm_param._diskquota() * 1024 * 1024));
      } else {
        this.descr2 = '';
      }
    }

    cm.prototype.compare = function(item1, item2) {
      var result = this.compare0(item1, item2);
      if(this.ascending) return -result;
      return result;
    }

    cm.prototype.compare0 = function(item1, item2) {
      var result;
      switch(this.sort_target) {
        case SORT_TIME:
          result = item1.tick - item2.tick;
          if(result != 0) return result;
          break;
        case SORT_GROUP:
          if(item1.group || item2.group) {
            if(!this.ascending) {
              if(!item1.group) return 1;
              if(!item2.group) return -1;
            }
            if(item1.group < item2.group) return -1;
            if(item1.group > item2.group) return 1;
          }
          break;
        case SORT_TITLE:
          if(item1.title < item2.title) return -1;
          if(item1.title > item2.title) return 1;
          break;
        case SORT_DURATION:
          result = item1.duration - item2.duration;
          if(result != 0) return result;
          break;
        case SORT_SIZE:
          result = item1.size - item2.size;
          if(result != 0) return result;
          break;
        case SORT_VIEW_COUNT:
          result = item1.view_count - item2.view_count;
          if(result != 0) return result;
          if(!item1.view_count) {
            if((item1.flag & 0x20000000) && !(item2.flag & 0x20000000)) return 1;
            if(!(item1.flag & 0x20000000) && (item2.flag & 0x20000000)) return -1;
          }
          break;
        case SORT_WEB_TITLE:
          if(item1.web_title < item2.web_title) return -1;
          if(item1.web_title > item2.web_title) return 1;
          break;
        default:
          return -1;
      }
      result = item1.tick - item2.tick;
      if(result != 0) return result;
      if(item1.title < item2.title) return -1;
      if(item1.title > item2.title) return 1;
      result = item1.duration - item2.duration;
      if(result != 0) return result;
      result = item1.size - item2.size;
      if(result != 0) return result;
      return 0;
    }

    cm.prototype.sort = function() {
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



    this.showCM = function($scope, param) {
      var i;
      for(i = 0; i < this.cm_array.length; i++) {
        if(this.cm_array[i].m_param == param) {
          $scope.choose_cim(this.cm_array[i]);
          return;
        }
      }
      var target = new cm();
      target.m_param = param;
      target.wo = !param._mmc_messenger();
      target.SetTitleText();
      target.total_count = 0;
      target.total_size = 0;
      target.new_count = 0;
      _checkMsg.cm_array.push(target);
      $scope.choose_cim(target);

      this.retrieveList($scope, target);
    }

    this.retrieveList = function($scope, target) {
      target.list.length = 0;
      target.selected_count = 0;
      target.selection_descr = ''
      target.total_count = 0;
      target.total_size = 0;
      target.new_count = 0;
      target.descr_tick = hmtg.util.GetTickCount();
      target.descr1 = $translate.instant('IDS_CONNECTION_STATUS_CONNECTTING');
      target.descr2 = '';
      var old = target.cm_param = hmtg.jmkernel.jm_command_CheckMsg(target.m_param, null, function() {
        if(old == target.cm_param) {
          target.updateDescr();
          $scope.$digest();
        }
      });
    }

    this.callback_MsgNewItem = function(param, cm_param, is_upload, mmc_file_index, flag, size, view_count, tick, title, web_title, group, meetinginfo) {
      var target;
      var i;
      for(i = 0; i < this.cm_array.length; i++) {
        if(this.cm_array[i].m_param == param && this.cm_array[i].cm_param == cm_param) {
          target = this.cm_array[i];
          break;
        }
      }
      if(!target) return;
      target.total_count++;
      target.total_size += size;
      if(!(flag & 0x80000000))	// unread
        target.new_count++;

      var now = hmtg.util.GetTickCount();
      if(now - target.descr_tick > 1000) {
        target.descr_tick = now;
        target.descr1 = $translate.instant('ID_FORMAT_LOADING').replace('%d', target.total_count);
        imDlg.fast_update();
      }

      var item = new CMItem();
      item.cm = target;
      item.img = 'img/icon_' + this.flag2iconindex(flag) + '.png';
      item.alt = '[' + this.flag2iconindex(flag) + ']';
      item.flag = flag;
      item.size = size;
      item.size_str = hmtgHelper.number2GMK(size);
      item.tick = tick;
      item.tick_str = msgrHelper.get_timestring_im3(tick);
      item.title = title;
      item.group = group;
      item.web_title = web_title;
      item.duration = flag & 0xfffffff;
      item.view_count = view_count;
      item.view_count_str = (flag & 0x20000000) || view_count ? view_count : '';
      item.meetinginfo = meetinginfo;
      item.mmc_file_index = mmc_file_index;
      target.list.push(item);

      if(is_upload) {
        for(i = 0; i < target.list.length; i++) {
          target.list[i].is_selected = false;
        }
        item.is_selected = true;
        target.selected_count = 1;
        target.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", 1);

        setTimeout(function() {
          target.menu_item = item;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_DISPLAY_CM);  // just to trigger update_display_list
        }, 0);
      }
    }

    this.flag2iconindex = function(flag) {
      // the 1st highest bit show read flag
      // the 2nd highest bit show encryption flag
      // the 3rd highest bit show share flag
      if(flag & 0x80000000)	// read
      {
        if(flag & 0x40000000)	// encryption
        {
          if(flag & 0x20000000)	//share
            return 'file_read_encrypted_shared';
          else
            return 'file_read_encrypted';
        }
        else {
          if(flag & 0x20000000)	//share
            return 'file_read_shared';
          else
            return 'file_read';
        }
      }
      else {
        if(flag & 0x40000000)	// encryption
        {
          if(flag & 0x20000000)	//share
            return 'file_encrypted_shared';
          else
            return 'file_encrypted';
        }
        else {
          if(flag & 0x20000000)	//share
            return 'file_shared';
          else
            return 'file';
        }
      }
    }

    this.callback_MessageEndOfFile = function(param, cm_param) {
      var target;
      var i;
      for(i = 0; i < this.cm_array.length; i++) {
        if(this.cm_array[i].m_param == param && this.cm_array[i].cm_param == cm_param) {
          target = this.cm_array[i];
          break;
        }
      }
      if(!target) return;
      target.sort();
      target.updateDescr();

      imDlg.fast_update();
    }

    this.callback_NotifyShareResult = function(param, cm_param, url, jnj) {
      if(!url) {
        hmtgHelper.MessageBox($translate.instant('IDS_SHARE_FILE_FAILED'), 0);
        return;
      }
      var item = cm_param._cache_item();
      item.flag |= 0x20000000;
      item.share_url = msgrHelper.appendWeb(url);
      item.share_jnj = jnj;
      item.img = 'img/icon_' + this.flag2iconindex(item.flag) + '.png';
      item.view_count_str = (item.flag & 0x20000000) || item.view_count ? item.view_count : '';
      imDlg.delayed_update();

      $rootScope.$broadcast(hmtgHelper.WM_SHARE_JNR, param, item);
    }

    this.callback_NotifyUnshareResult = function(param, cm_param, result) {
      if(!result) {
        hmtgHelper.MessageBox($translate.instant('IDS_UNSHARE_FILE_FAILED'), 0);
        return;
      }
      var item = cm_param._cache_item();
      item.flag &= ~0x20000000;
      item.share_url = '';
      item.share_jnj = '';
      item.img = 'img/icon_' + this.flag2iconindex(item.flag) + '.png';
      item.view_count_str = (item.flag & 0x20000000) || item.view_count ? item.view_count : '';
      imDlg.delayed_update();
    }

    this.callback_NotifyJnrPasswordResult = function(param, cm_param, error_code) {
      cm_param._progress(0);
      hmtgHelper.fast_apply();
      if(error_code) {
        msgrHelper.ShowWebOfficeError($translate.instant, error_code);
        return;
      }
      var item = cm_param._cache_item();
      if(item.has_new_password) {
        item.flag |= 0x40000000;
      } else {
        item.flag &= ~0x40000000;
      }
      item.img = 'img/icon_' + this.flag2iconindex(item.flag) + '.png';
      imDlg.delayed_update();
    }

    this.callback_NotifyChangeTitleResult = function(param, cm_param, error_code) {
      cm_param._progress(0);
      hmtgHelper.fast_apply();
      if(error_code) {
        msgrHelper.ShowWebOfficeError($translate.instant, error_code);
        return;
      }
      var item = cm_param._cache_item();
      item.title = hmtg.util.decodeUtf8(item.new_title);
      if(item.cm.sort_target == SORT_TITLE) {
        item.cm.sort();
        item.cm.menu_item = item;
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_DISPLAY_CM);  // just to trigger update_display_list
      }
    }

    this.callback_DownloadComplete = function(param, cm_param) {
      var item = cm_param._cache_item();
      $rootScope.downloadC_item = item;
      var data = $rootScope.downloadC_data = cm_param._data();
      cm_param._data(null);
      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_download_complete' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/DownloadComplete.htm' + hmtgHelper.cache_param,
          scope: $rootScope,
          controller: 'DownloadCompleteModalCtrl',
          size: '',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_download_complete fails');
        hmtgHelper.inside_angular++;
        var name = hmtg.util.decodeUtf8(item.tick_str + ' ' + item.title + '.jnr');
        var item2 = {};
        item2['timeout'] = 3600 * 24 * 10;
        item2['update'] = function() { return name + '\n' + $translate.instant('ID_DOWNLOAD_COMPLETE'); };
        item2['text'] = item2['update']();
        item2['type'] = 'info';
        item2['click'] = function(index) {
          try {
            if(hmtgHelper.isiOS) {
              hmtgHelper.inside_angular++;
              hmtgAlert.add_blob_download_item(new Blob([data]), name);
              hmtgHelper.inside_angular--;
            } else {
              hmtgHelper.save_file(new Blob([data]), name);
            }
          } catch(e) {
          }
          data = null;

          hmtgHelper.inside_angular++;
          hmtgAlert.click_link(index);
          hmtgHelper.inside_angular--;
        };

        hmtgAlert.add_link_item(item2);
        hmtgHelper.inside_angular--;
      });
    }

  }
])

.controller('CMCtrl', ['$scope', 'Msgr', '$translate', 'hmtgHelper', 'jnagentDlg', '$modal', 'jnjContent',
        '$rootScope', 'msgrHelper', 'hmtgSound', 'checkMsg', 'appSetting',
  function($scope, Msgr, $translate, hmtgHelper, jnagentDlg, $modal, jnjContent, $rootScope, msgrHelper,
        hmtgSound, checkMsg, appSetting) {
    $scope.as = appSetting;
    $scope.display_index = 0; // this first index to be displayed
    $scope.count = (appSetting.max_display_item >> 0);  // the count of items to be displayed
    $scope.last_selected_item = null; // used to select a range

    var myheight = 100;
    $scope.style_cm_height = function() {
      var old = myheight;
      if($scope.cm.visible) {
        var offset = {};
        hmtg.util.calcOffset($scope.cm.cm_div, offset);
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
        if($scope.cm.has_action_menu == 'sel') $scope.cm.has_action_menu = '';
        return;
      }
      $scope.cm.has_action_menu = 'sel';

      var menu = $scope.selection_menu;
      // prepare the menu for the selection
      var param = $scope.cm.m_param;
      var cm_param = $scope.cm.cm_param;
      if(cm_param._connected()) {
        if(!cm_param._busy()) {
          if(can_markread_selection()) {
            menu.push({ "text": $translate.instant('ID_MARK_READ'), "onclick": $scope.markReadSelection });
          }
          if(can_markunread_selection()) {
            menu.push({ "text": $translate.instant('ID_MARK_UNREAD'), "onclick": $scope.markUnreadSelection });
          }
          menu.push({ "text": $translate.instant('ID_SET_GROUP'), "onclick": $scope.groupSelection });
          // to do
          // upload should be put to top menu
          menu.push({ "text": $translate.instant('IDC_DELETE'), "onclick": $scope.deleteSelection });
        }
      } else {
        if(!(param._quit() || param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED)) {
          menu.push({ "text": $translate.instant('IDS_LOG_REFRESH'), "onclick": $scope.refresh });
        }
      }
      menu.push({ "text": $translate.instant('ID_RESET_SELECTION'), "onclick": $scope.resetSelection });
    }

    // selection menu condition
    function can_markread_selection() {
      var i;
      for(i = $scope.cm.list.length - 1; i >= 0; i--) {
        if($scope.cm.list[i].is_selected) {
          if(!($scope.cm.list[i].flag & 0x80000000)) return true;
        }
      }
    }

    function can_markunread_selection() {
      var i;
      for(i = $scope.cm.list.length - 1; i >= 0; i--) {
        if($scope.cm.list[i].is_selected) {
          if($scope.cm.list[i].flag & 0x80000000) return true;
        }
      }
    }

    // selection action
    $scope.refresh = function() {
      $scope.refresh_cm($scope.cm);
    }

    $scope.markReadSelection = function() {
      var i;
      var cm = $scope.cm;
      for(i = $scope.cm.list.length - 1; i >= 0; i--) {
        var item = $scope.cm.list[i];
        if(item.is_selected) {
          if(!(item.flag & 0x80000000)) {
            item.flag |= 0x80000000;
            item.img = 'img/icon_' + checkMsg.flag2iconindex(item.flag) + '.png';
            item.alt = '[' + checkMsg.flag2iconindex(item.flag) + ']';
            cm.new_count--;
            hmtg.jmkernel.jm_command_MarkRead(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);
          }
        }
      }
      cm.updateDescr();
    }

    $scope.markUnreadSelection = function() {
      var i;
      var cm = $scope.cm;
      for(i = $scope.cm.list.length - 1; i >= 0; i--) {
        var item = $scope.cm.list[i];
        if(item.is_selected) {
          if(item.flag & 0x80000000) {
            item.flag &= 0x7fffffff;
            item.img = 'img/icon_' + checkMsg.flag2iconindex(item.flag) + '.png';
            item.alt = '[' + checkMsg.flag2iconindex(item.flag) + ']';
            cm.new_count++;
            hmtg.jmkernel.jm_command_MarkUnread(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);
          }
        }
      }
      cm.updateDescr();
    }

    $scope.groupSelection = function() {
      var i;
      var cm = $scope.cm;
      var cm_param = cm.cm_param;
      if(cm_param._busy()) return;
      var old = '';
      for(i = 0; i < $scope.cm.list.length; i++) {
        var item = $scope.cm.list[i];
        if(item.is_selected && item.group) {
          old = item.group;
          break;
        }
      }
      hmtgHelper.renameDialog($scope, hmtg.util.decodeUtf8(old), $translate.instant('ID_SET_GROUP'), cm.selection_descr, ok, 'set_group', []);
      function ok(new_value) {
        var changed = false;
        for(i = $scope.cm.list.length - 1; i >= 0; i--) {
          var item = $scope.cm.list[i];
          if(item.is_selected) {
            if(item.group != new_value) {
              item.group = new_value;
              hmtg.jmkernel.jm_command_SetGroup(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index, new_value);
              changed = true;
            }
          }
        }

        if(changed) {
          $scope.cm.sort();
          $scope.update_display_list();
        }
      }
    }

    $scope.deleteSelection = function() {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_WARNING_DELETE_SELECTED_JNR'), 0, ok);
      function ok() {
        var cm = $scope.cm;
        for(var i = $scope.cm.list.length - 1; i >= 0; i--) {
          var item = $scope.cm.list[i];
          if(item.is_selected) {
            if(!(item.flag & 0x80000000)) cm.new_count--;
            cm.total_count--;
            cm.total_size -= item.size;
            hmtg.jmkernel.jm_command_Delete(cm.m_param, cm.cm_param, item.meetinginfo, item.mmc_file_index);

            cm.list.splice(i, 1);
          }
        }
        $scope.cm.selected_count = 0;
        $scope.cm.selection_descr = '';
        cm.updateDescr();
      }
    }
    $scope.resetSelection = function() {
      for(var i = 0; i < $scope.cm.list.length; i++) {
        $scope.cm.list[i].is_selected = false;
      }
      $scope.cm.selected_count = 0;
      $scope.cm.selection_descr = '';
    }
    $scope.select_all = function(cm) {
      cm.all_selected = false;
      for(var i = 0; i < $scope.cm.list.length; i++) {
        $scope.cm.list[i].is_selected = true;
      }
      $scope.cm.selected_count = $scope.cm.list.length;
      $scope.cm.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.cm.selected_count);
    }
    $scope.item_selected = function(cm, item, e) {
      if(item.is_selected) {
        $scope.cm.selected_count++;
        $scope.cm.menu_item = item;
      } else {
        $scope.cm.selected_count--;
      }
      if(e.shiftKey && $scope.last_selected_item && $scope.last_selected_item != item) {
        var last_idx = $scope.cm.list.indexOf($scope.last_selected_item);
        if(last_idx != -1) {
          var i;
          var this_idx = $scope.cm.list.indexOf(item);
          var from = last_idx;
          var to = this_idx;
          if(from > to) {
            to = from;
            from = this_idx;
          }
          var item2;
          for(i = from; i <= to; i++) {
            if(i == this_idx) continue;
            item2 = $scope.cm.list[i];
            if(item.is_selected && !item2.is_selected) {
              item2.is_selected = true;
              $scope.cm.selected_count++;
            }
            if(!item.is_selected && item2.is_selected) {
              item2.is_selected = false;
              $scope.cm.selected_count--;
            }
          }
        }  
      }  
      $scope.last_selected_item = item;
      $scope.cm.selection_descr = $translate.instant('ID_FORMAT_SELECTED_COUNT').replace("%d", $scope.cm.selected_count);
    }

    // update display list
    $scope.update_display_list = function() {
      var max_item = $scope.count;
      var menu_index = -1;
      if($scope.cm.menu_item) menu_index = $scope.cm.item2index($scope.cm.menu_item);
      // make sure the item with menu is included
      if(menu_index == -1) {
        $scope.cm.menu_item = null;
      } else {
        var first = Math.max(0, Math.min($scope.display_index, $scope.cm.list.length - max_item));
        if(menu_index >= 0 && max_item < $scope.cm.list.length) {
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
          $scope.cm.cm_div.scrollTop = ((menu_index - first) / Math.max(1, Math.min(max_item, $scope.cm.list.length)) * $scope.cm.cm_div.scrollHeight) >> 0;
        }
      }
    }

    $scope.$on(hmtgHelper.WM_MAX_DISPLAY_ITEM_CHANGED, function() {
      $scope.count = (appSetting.max_display_item >> 0);
      $scope.update_display_list();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_UPDATE_DISPLAY_CM, function() {
      $scope.update_display_list();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.scroll_up = function() {
      $scope.display_index = Math.min($scope.display_index, $scope.cm.list.length - $scope.count);
      $scope.display_index -= 1 + ($scope.count >> 1);
      if($scope.display_index < 0) $scope.display_index = 0;
    }

    $scope.scroll_down = function() {
      $scope.display_index += 1 + ($scope.count >> 1);
      if($scope.display_index + $scope.count > $scope.cm.list.length) {
        $scope.display_index = $scope.cm.list.length - $scope.count;
      }
    }

    $scope.click_item = function(cm, item, menu) {
      menu.onclick($scope, cm, item);
    }

    $scope.resort = function(sort_target) {
      if($scope.cm.sort_target == sort_target) {
        $scope.cm.ascending = !$scope.cm.ascending;
        if(sort_target == 2) $scope.cm.sort();  // group sorting is special
        else $scope.cm.list.reverse();
      } else {
        $scope.cm.sort_target = sort_target;
        $scope.cm.sort();
      }
      // do not update display list, to keep the header visible, unless using a fixed header
      //$scope.update_display_list();
    }

    $scope.$on(hmtgHelper.WM_JNR_PROGRESS, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
  }
])

.directive('cmFinder', [
  function() {
    function link($scope, element, attrs) {
      $scope.cm.cm_div = element[0];
    }

    return {
      link: link
    };
  }
])

;