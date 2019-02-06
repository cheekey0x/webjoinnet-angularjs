angular.module('joinnet')
.controller('ChatCtrl', ['$scope', 'chat', 'hmtgHelper', 'JoinNet', 'appSetting', 'userlist', 'msgrHelper', 'playback',
  function($scope, chat, hmtgHelper, JoinNet, appSetting, userlist, msgrHelper, playback) {
    $scope.w = chat;
    $scope.as = appSetting;
    $scope.ul = userlist;
    $scope.w.sendto_ssrc = -1;
    $scope.display_count = 0;

    $scope.self_target = 0;
    $scope.self_count = 10;
    $scope.other_src = -1;
    $scope.other_target = -1;
    $scope.other_count = 10;

    $scope.last_show_time_tick = -3600000;
    $scope.last_show_date_tick = 0;

    $scope.$watch('w.chat_input', function() {
      if($scope.w.chat_input) {
        $scope.w.chat_input = hmtgHelper.replaceUnicode($scope.w.chat_input);
      }
    });

    $scope.style_height_send_button = { 'height': '100%' };
    $scope.$watch(
      function() {
        return $scope.text_input ? $scope.text_input.offsetHeight : 30;
      },
      function(newValue, oldValue) {
        if(newValue)
          $scope.style_height_send_button = { 'height': (newValue) + 'px' };
      }
    );

    function copy_user_list() {
      var first = Math.max(1, // alway skip the first item, which is self
        Math.min(userlist.display_index, userlist.user_list.length - userlist.count));
      var end = Math.min(first + userlist.count, userlist.user_list.length);

      var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
      var t = chat.sendto_ssrc >> 0;
      if(t != -1 && a[t] && a[t]._bLogged()) {
        // sanity check
        var sendto_index = userlist.ssrc2index(t);
        if(sendto_index <= 0) {
          chat.sendto_ssrc = -1;  // not found or self
        } else if(sendto_index < first || sendto_index >= end) {
          // make sure the sendto_ssrc is included
          if(sendto_index < first) {
            first = sendto_index;
          } else {
            first = Math.max(1, sendto_index - (userlist.count - 1));
          }
          end = Math.min(first + userlist.count, userlist.user_list.length);
        }
      } else {
        chat.sendto_ssrc = -1;
      }

      $scope.limit1 = end;
      $scope.limit2 = end - first;
    }

    function reset_display() {
      $scope.display_count = 0;
      $scope.CHAT.empty();

      $scope.self_target = 0;
      $scope.self_count = 10;
      $scope.other_src = -1;
      $scope.other_target = -1;
      $scope.other_count = 10;

      // must reset these
      // otherwise the first item may miss the time because it is within 5 seconds of last showtime of last session
      $scope.last_show_time_tick = -3600000;
      $scope.last_show_date_tick = 0;
    }

    $scope.$on(hmtgHelper.WM_UPDATE_CHAT, function(e, to_scroll) {
      if(!hmtgHelper.inside_angular) $scope.$digest();
      if($scope.display_count > chat.data.length) {
        reset_display();
      }
      var i;
      for(i = $scope.display_count; i < chat.data.length; i++, $scope.display_count++) {
        $scope.appendText(chat.data[i]);
      }
      if(to_scroll) {
        $scope.CHAT[0].scrollTop = $scope.CHAT[0].scrollHeight;
      }
    });
    $scope.appendText = function(item) {
      var node = angular.element('<div></div>');
      var text = angular.element('<div></div>');
      var prefix = angular.element('<text></text>');
      var my_ssrc = hmtg.jnkernel._jn_iWorkMode() == hmtg.config.PLAYBACK ? 0 : hmtg.jnkernel._jn_ssrc_index();
      var idx = item.text.indexOf('\n');
      var text1, text2;
      if(idx == -1) {
        text1 = item.text;
        text2 = '';
      } else {
        text1 = item.text.slice(0, idx);
        text2 = item.text.slice(idx);
      }

      // print time string if exist
      var time_str = '';
      var this_ts = -3600000;
      var this_date = 0;
      if(typeof item.ts !== 'undefined' && item.ts != 0x7fffffff) {
        this_ts = item.ts;
        time_str = playback.calc_tick_str(item.ts);
      }
      if(item.date) {
        this_date = item.date;
        if(time_str) time_str += ' @ ';
        var now = new Date();
        if(Math.abs(item.date - now) >= 12 * 3600 * 1000) {
          time_str += msgrHelper.get_timestring_im2(item.date / 1000);
        } else {
          time_str += msgrHelper.get_timestring_im1(item.date / 1000);
        }
      }
      if(time_str) {
        if(Math.abs($scope.last_show_time_tick - this_ts) > 5000 || Math.abs($scope.last_show_date_tick - this_date) > 5000) {
          prefix.text(time_str);
          prefix.addClass(my_ssrc == item.src ? 'im-small-self' : 'im-small');
          text.append(prefix);

          $scope.last_show_time_tick = this_ts;
          $scope.last_show_date_tick = this_date;
        } else {
          time_str = '';
        }
      }

      var skip_name = false;
      if(item.dst != -1) {
        var pattern = /(.+)>\[(.+)\](.+)/;
        var m = pattern.exec(text1);
        if(m && m[1].length + m[2].length + m[3].length + 3 == text1.length) {
          check_count();
          if(!skip_name) {
            var dm = '';
            if(time_str) {
              // create a new prefix if time_str exists
              prefix = angular.element('<text></text>');
              dm = ' ';
            }
            if(my_ssrc != item.src) {
              prefix.css('color', '#6666cc');
              prefix.text(dm + m[1]);
              prefix.addClass('im-small');
              text.append(prefix);
            }
            prefix = angular.element('<text></text>');
            prefix.css('color', (my_ssrc == item.src ? '#6666cc' : '#cc6666'));
            prefix.text(' [' + m[2] + '] ');
            prefix.addClass(my_ssrc == item.src ? 'im-small-self' : 'im-small');
            text.append(prefix);
          }

          if(my_ssrc == item.src) {
            clear_float();
          }

          var bubble = angular.element('<div></div>');
          hmtgHelper.convertText(bubble, m[3] + text2);
          bubble.addClass(my_ssrc == item.src ? 'im-bubble-right-offline' : 'im-bubble-left-offline');
          text.append(angular.element('<div></div>').append(bubble));
          if(my_ssrc == item.src) {
            clear_float();
          }
        } else {
          if(time_str && my_ssrc == item.src) {
            clear_float();
          }
          var bubble = angular.element('<div></div>');
          hmtgHelper.convertText(bubble, item.text);
          bubble.addClass(my_ssrc == item.src ? 'im-bubble-right-offline' : 'im-bubble-left-offline');
          text.append(angular.element('<div></div>').append(bubble));
          if(my_ssrc == item.src) {
            clear_float();
          }
        }
      } else if(item.src == -1) {
        if(time_str) {
          // create a new prefix if time_str exists
          prefix = angular.element('<text></text>');
        }
        prefix.text(item.text + '\n');
        prefix.css('color', 'red');
        prefix.addClass('im-bold');
        prefix.addClass('im-ul');
        text.append(prefix)
      } else {
        var pattern = /(.+)>(.+)/;
        var m = pattern.exec(text1);
        if(m && m[1].length + m[2].length + 1 == text1.length) {
          check_count();
          if(!skip_name) {
            if(my_ssrc != item.src) {
              var dm = '';
              if(time_str) {
                // create a new prefix if time_str exists
                prefix = angular.element('<text></text>');
                dm = ' ';
              }
              time_str += 'dummy';
              prefix.css('color', '#6666cc');
              prefix.text(dm + m[1]);
              prefix.addClass('im-small');
              text.append(prefix);
            }
          }
          if(time_str && my_ssrc == item.src) {
            clear_float();
          }
          var bubble = angular.element('<div></div>');
          hmtgHelper.convertText(bubble, m[2] + text2);
          bubble.addClass(my_ssrc == item.src ? 'im-bubble-right-self' : 'im-bubble-left-other');
          text.append(angular.element('<div></div>').append(bubble));
          if(my_ssrc == item.src) {
            clear_float();
          }
        } else {
          if(time_str && my_ssrc == item.src) {
            clear_float();
          }
          var bubble = angular.element('<div></div>');
          hmtgHelper.convertText(bubble, item.text);
          bubble.addClass(my_ssrc == item.src ? 'im-bubble-right-self' : 'im-bubble-left-other');
          text.append(angular.element('<div></div>').append(bubble));
          if(my_ssrc == item.src) {
            clear_float();
          }
        }
      }


      node.append(text);
      $scope.CHAT.append(node);

      function clear_float() {
        text.append(angular.element('<div class="clear-both"></div>'));
      }

      function check_count() {
        if(my_ssrc != item.src) {
          $scope.self_count = 10;
          // other
          if($scope.other_src == item.src && $scope.other_target == item.dst) {
            if($scope.other_count < 4) {
              skip_name = true; // do not show name if from same other user/target and not skipped for more than 5 times
              $scope.other_count++;
            }
          } else {
            // record which other user/target
            $scope.other_src = item.src;
            $scope.other_target = item.dst;
          }
          if(!skip_name) {
            $scope.other_count = 0;
          }
        } else {
          $scope.other_count = 10;
          // self
          if($scope.self_target == item.dst) {
            if($scope.self_count < 4) {
              skip_name = true; // do not show name if from same target and not skipped for more than 5 times
              $scope.self_count++;
            }
          } else {
            // record which target
            $scope.self_target = item.dst;
          }
          if(!skip_name) {
            $scope.self_count = 0;
          }
        }
      }

    }
    $scope.$on(hmtgHelper.WM_COPY_USER_LIST, function(e, to_scroll) {
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
      copy_user_list();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });
    $scope.$on(hmtgHelper.WM_NET_INIT_FINISH, function() {
      reset_display();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.can_show_send_button = function() {
      return hmtg.jnkernel._jn_bConnected() && JoinNet.net_init_finished && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL;
    }

    $scope.onkeypress = function(e) {
      if(e.keyCode != 13) return;
      if((!appSetting.is_enter_for_newline && !e.shiftKey) || (appSetting.is_enter_for_newline && e.shiftKey)) {
        e.stopPropagation();
        e.preventDefault();
        $scope.send_textchat();
        return;
      }
    }

    $scope.send_textchat = function() {
      if($scope.w.chat_input) {
        var text = hmtg.util.encodeUtf8($scope.w.chat_input);
        if(text.length >= hmtg.config.MAX_LONG_TEXT_LEN) return;
        var target_ssrc = $scope.w.sendto_ssrc;
        if(target_ssrc != -1) {
          var a = hmtg.jnkernel._jn_UserArray();  // _jn_UserArray return a hash, not array
          var item = a[target_ssrc];
          if(!item) return;
          text = '[To:' + item._szRealName() + ']' + text;
          if(text.length >= hmtg.config.MAX_LONG_TEXT_LEN) return;
        }
        hmtgHelper.inside_angular++;
        if(0 != hmtg.jnkernel.jn_command_SendChatText(target_ssrc, text)) {
          hmtgHelper.inside_angular--;
          return;
        }
        hmtgHelper.inside_angular--;
        $scope.w.chat_input = '';

        if($scope.text_input)
          $scope.text_input.focus();
      }
    }

    $scope.scroll_to_top = function() {
      $scope.CHAT[0].scrollTop = 0;
    }

    $scope.scroll_to_bottom = function() {
      $scope.CHAT[0].scrollTop = $scope.CHAT[0].scrollHeight;
    }
  }
])

.controller('Chat1Ctrl', ['$scope', 'chat', 'hmtgHelper', 'JoinNet', 'appSetting', 'userlist', '$controller',
  function($scope, chat, hmtgHelper, JoinNet, appSetting, userlist, $controller) {
    $controller('ChatCtrl', { $scope: $scope });
    $scope.style_chat_height = function() {
      var myheight = Math.max(240, (hmtgHelper.view_port_height >> 2));
      return {
        'max-height': '' + myheight + 'px'
      };

    }
  }
])

.controller('Chat2Ctrl', ['$scope', 'chat', 'hmtgHelper', 'JoinNet', 'appSetting', 'userlist', '$controller', '$rootScope',
  function($scope, chat, hmtgHelper, JoinNet, appSetting, userlist, $controller, $rootScope) {
    $controller('ChatCtrl', { $scope: $scope });
    var myheight = 100;
    $scope.style_chat_height = function() {
      var old = myheight;
      if($rootScope.nav_item == 'joinnet') {
        var offset = {};
        var adjust = 0;
        hmtg.util.calcOffset($scope.CHAT[0], offset);
        if(offset.y) {
          if($scope.bottom) {
            var offset2 = {};
            hmtg.util.calcOffset($scope.bottom, offset2);
            adjust = offset2.y + $scope.bottom.offsetHeight - (offset.y + $scope.CHAT[0].offsetHeight);
          }
          myheight = Math.max(240, (hmtgHelper.view_port_height >> 1), hmtgHelper.view_port_height - adjust - offset.y);
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
  }
])

.directive('jnChat', ['$compile',
  function($compile) {
    function link($scope, element, attrs) {
      $scope.CHAT = angular.element('<div class="jn-chat" ng-style="style_chat_height()"></div>');
      element.append($compile($scope.CHAT)($scope));
    }

    return {
      link: link
    };
  }
])

.directive('chatFinder', [
  function() {
    function link($scope, element, attrs) {
      $scope.text_input = element[0];
    }

    return {
      link: link
    };
  }
])

.directive('bottomFinder', [
  function() {
    function link($scope, element, attrs) {
      $scope.bottom = element[0];
    }

    return {
      link: link
    };
  }
])


;