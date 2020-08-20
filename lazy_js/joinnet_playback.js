angular.module('joinnet')
.controller('PlaybackCtrl', ['$scope', 'playback', 'hmtgHelper', 'jnjContent', '$rootScope', '$modal', '$translate',
  'hmtgAlert', 'hmtgSound', 'JoinNet', 'video_playback', 'audio_playback',
  function($scope, playback, hmtgHelper, jnjContent, $rootScope, $modal, $translate, hmtgAlert, hmtgSound,
    JoinNet, video_playback, audio_playback) {
    $scope.hmtg = hmtg;
    $scope.w = {};
    $scope.pos_str = '0%';
    $scope.auto_disconnect_threshold = 270 * 1000; // 4.5 minute. cannot be longer, since the MCU will disconnect by 5 minute threshold.
    $scope.now = $scope.last_tick = hmtg.util.GetTickCount();
    $scope.start_tick_str = playback.calc_tick_str(playback.start_tick);
    $scope.end_tick_str = playback.calc_tick_str(playback.end_tick);
    // 5s, 10s, 30s, 1m, 5m, 10m, 1h, 5h, 10h
    var full_interval_list = [
      { value: 0, interval: 5, name: '5s' },
      { value: 1, interval: 10, name: '10s' },
      { value: 2, interval: 30, name: '30s' },
      { value: 3, interval: 60, name: '1m' },
      { value: 4, interval: 300, name: '5m' },
      { value: 5, interval: 600, name: '10m' },
      { value: 6, interval: 3600, name: '1h' },
      { value: 7, interval: 18000, name: '5h' },
      { value: 8, interval: 36000, name: '10h' }
    ];
    $scope.interval_list = [];
    $scope.interval_idx = 2;
    setIntervalList();
    $scope.w.speed_list = [
      { value: 0, speed: 100, name: '1x' },
      { value: 1, speed: 125, name: '1.25x' },
      { value: 2, speed: 150, name: '1.5x' },
      { value: 3, speed: 175, name: '1.75x' },
      { value: 4, speed: 200, name: '2x' },
    ];
    $scope.w.speed_idx = 0;

    $scope.intervalID = setInterval(checkActivity, 5000);

    function setIntervalList() {
      $scope.interval_list = full_interval_list.slice(0);
      var i;
      for(i = $scope.interval_list.length - 1; i > 2; i--) {
        if($scope.interval_list[i].interval * 1000 >= playback.end_tick - playback.start_tick) {
          $scope.interval_list.splice(i, 1);
        } else {
          break;
        }
      }
      if($scope.interval_idx > $scope.interval_list.length - 1) {
        $scope.interval_idx = $scope.interval_list.length - 1;
      }
    }
    function checkActivity() {
      $scope.now = hmtg.util.GetTickCount();
      if(JoinNet.jnr_decryption) {
        $scope.last_tick = hmtg.util.GetTickCount();
      }
      if($scope.now - $scope.last_tick > $scope.auto_disconnect_threshold) {
        clearInterval($scope.intervalID);
        $scope.intervalID = null;

        if(!hmtg.jnkernel._jn_bConnected()) return;

        hmtgHelper.MessageBox($translate.instant('ID_AUTO_DISCONNECTION_PROMPT'), 20, ok);
        function ok(result) {
          if(!result || !result.timeout) {
            $scope.now = $scope.last_tick = hmtg.util.GetTickCount();
            if(!$scope.intervalID) {
              $scope.intervalID = setInterval(checkActivity, 5000);
            }
          } else {
            hmtgHelper.inside_angular++;
            if(hmtg.jnkernel._jn_bConnected()) {
              hmtg.jnkernel.jn_command_QuitConnection();
            }
            hmtgHelper.inside_angular--;
          }
        }
      }
    }

    $scope.$on(hmtgHelper.WM_QUIT_SESSION, function () {
      if($scope.intervalID) {
        clearInterval($scope.intervalID);
        $scope.intervalID = null;
      }
    });

    $scope.$on(hmtgHelper.WM_PLAYBACK_INIT_STAT, function () {
      $scope.start_tick_str = playback.calc_tick_str(playback.start_tick);
      $scope.end_tick_str = playback.calc_tick_str(playback.end_tick);

      setIntervalList();
      if(!hmtg.jnkernel.jn_info_IsPlaybackSpeedSupportedByMCU()) {
        $scope.w.speed_idx = 0;
        audio_playback.update_playback_speed(1.0);
      } else if($scope.w.speed_idx != 0) {
        hmtg.jnkernel.jn_command_PlaybackSetSpeed($scope.w.speed_list[$scope.w.speed_idx].speed);
        audio_playback.update_playback_speed($scope.w.speed_list[$scope.w.speed_idx].speed / 100.0);
      }

      $scope.now = $scope.last_tick = hmtg.util.GetTickCount();
      if(!$scope.intervalID) {
        $scope.intervalID = setInterval(checkActivity, 5000);
      }
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_PLAYBACK_RESTART, function () {
      $scope.last_tick = $scope.now = hmtg.util.GetTickCount();
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    function calc_pos_str(tick) {
      var total = playback.end_tick - playback.start_tick;
      if(!total) return '';
      var pos = ((tick - playback.start_tick) * 100 / total) >>> 0;
      if(pos > 100) pos = 100;
      return '' + pos + '%';
    }

    $scope.$on(hmtgHelper.WM_PLAYBACK_TICK_UPDATE, function (event, tick) {
      $scope.last_tick = $scope.now;
      if(playback.queued_jump) return;

      if(playback.random_access) {
        if(tick >= playback.random_access_tick) {
          playback.random_access = false;
          playback.queue_catchup();
        } else {
          return;
        }
      }

      playback.tick = tick;
      $scope.update_tick_str(tick);
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_PLAYBACK_END_OF_FILE, function() {
      $scope.last_tick = $scope.now;
      if(playback.queued_jump) return;

      if(playback.random_access) {
        playback.random_access = false;
        playback.queue_catchup();
      }
    });

    $scope.$watch('w.speed_idx', function(newValue, oldValue) {
      if(hmtg.jnkernel.jn_info_IsPlaybackSpeedSupportedByMCU()) {
        hmtg.jnkernel.jn_command_PlaybackSetSpeed($scope.w.speed_list[$scope.w.speed_idx].speed);
        audio_playback.update_playback_speed($scope.w.speed_list[$scope.w.speed_idx].speed / 100.0);
      }
    });

    $scope.is_repeat = function () {
      return playback.repeat;
    }

    $scope.repeat = function () {
      playback.repeat = !playback.repeat;
      hmtg.jnkernel.jn_command_PlaybackRequestRepeat(playback.repeat);
    }

    $scope.paused = function () {
      return playback.paused;
    }

    $scope.resume = function () {
      if(!playback.paused) return;

      if(playback.queued_jump) {
        playback.queued_jump = false;

        playback.random_access = true;
        playback.random_access_tick = playback.tick;
        hmtg.jnkernel.jn_command_PlaybackRandomAccess(playback.tick);

        video_playback.on_all_video_interrupted();
        video_playback.clear_all_queue();
      }
      playback.paused = false;
      hmtg.jnkernel.jn_command_PlaybackPlay();
    }

    $scope.pause = function () {
      if(playback.paused) return;

      playback.paused = true;
      hmtg.jnkernel.jn_command_PlaybackPause();
    }

    $scope.stop = function () {
      if(!playback.paused) {
        playback.paused = true;
        hmtg.jnkernel.jn_command_PlaybackPause();
      }
      if(!playback.queued_jump) {
        playback.queued_jump = true;
      }

      var tick = playback.start_tick;

      playback.tick = tick;
      hmtgHelper.inside_angular++;
      $scope.update_tick_str(tick);
      hmtgHelper.inside_angular--;
    }

    $scope.backward = function () {
      var tick = playback.tick;
      if(tick <= playback.start_tick) return;

      video_playback.clear_all_queue();

      if(!playback.paused) {
        playback.paused = true;
        hmtg.jnkernel.jn_command_PlaybackPause();
        hmtgHelper.inside_angular++;
        $scope.show_pause_alert();
        hmtgHelper.inside_angular--;
      }
      if(!playback.queued_jump) {
        playback.queued_jump = true;
      }

      tick -= full_interval_list[$scope.interval_idx].interval * 1000;
      if(tick <= playback.start_tick) tick = playback.start_tick;

      playback.tick = tick;
      hmtgHelper.inside_angular++;
      $scope.update_tick_str(tick);
      hmtgHelper.inside_angular--;
    }

    $scope.forward = function () {
      var tick = playback.tick;
      if(tick >= playback.end_tick) return;
      tick += full_interval_list[$scope.interval_idx].interval * 1000;
      if(tick >= playback.end_tick) tick = playback.end_tick;

      if(playback.paused) {
        if(!playback.queued_jump) {
          playback.queued_jump = true;
        }
      } else {
        playback.random_access = true;
        playback.random_access_tick = tick;
        hmtg.jnkernel.jn_command_PlaybackRandomAccess(tick);

        video_playback.on_all_video_interrupted();
        video_playback.clear_all_queue();
      }

      playback.tick = tick;
      hmtgHelper.inside_angular++;
      $scope.update_tick_str(tick);
      hmtgHelper.inside_angular--;
    }

    $scope.jump = function () {
      var modalInstance = $modal.open({
        templateUrl: 'template/PlaybackJumpTo.htm' + hmtgHelper.cache_param,
        scope: $scope,
        controller: 'PlaybackJumpToModalCtrl',
        size: 'lg',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(function (result) {
        playback.jump(result.tick);
        /*
        var tick = result.tick;
        if(tick != playback.tick) {
        if(tick < playback.tick) {
        if(!playback.paused) {
        playback.paused = true;
        hmtg.jnkernel.jn_command_PlaybackPause();
        hmtgHelper.inside_angular++;
        $scope.show_pause_alert();
        hmtgHelper.inside_angular--;
        }
        if(!playback.queued_jump) {
        playback.queued_jump = true;
        }
        } else {
        if(playback.paused) {
        if(!playback.queued_jump) {
        playback.queued_jump = true;
        }
        } else {
        playback.random_access = true;
        playback.random_access_tick = tick;
        hmtg.jnkernel.jn_command_PlaybackRandomAccess(tick);

        video_playback.on_all_video_interrupted();
        video_playback.clear_all_queue();
        }
        }

        playback.tick = tick;
        hmtgHelper.inside_angular++;
        $scope.update_tick_str(tick);
        hmtgHelper.inside_angular--;
        }
        */
      }, function () {
      });
    }

    $scope.$on(hmtgHelper.WM_PLAYBACK_UPDATE_POS, function () {
      $scope.pos_str = calc_pos_str(playback.tick);
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.update_tick_str = function (tick) {
      playback.pos_str = $scope.pos_str = calc_pos_str(tick);

      playback.tick_str = playback.calc_tick_str(tick);
      $rootScope.$broadcast(hmtgHelper.WM_PLAYBACK_UPDATE_TICK_STR);  // also update the str at title bar
    }

    $scope.show_pause_alert = function () {
      var item = {};
      item['timeout'] = 20;
      item['update'] = function () { return $translate.instant('ID_PLAYBACK_PAUSED') };
      item['text'] = item['update']();
      item['type'] = 'danger';

      hmtgAlert.update_status_item(item);
    }
  }
])

.controller('PlaybackJumpToModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', 'playback',
  function ($scope, $modalInstance, $modal, $translate, playback) {
    $scope.title = $translate.instant('ID_PLAYBACK_RANDOM_ACCESS');
    $scope.start_tick = playback.start_tick;
    $scope.end_tick = playback.end_tick;
    $scope.tick = $scope.base_tick = playback.tick;
    var total = $scope.end_tick - $scope.start_tick;
    if(total <= 0) total = 1;

    var slider_max = 1000;

    $scope.w = {};
    $scope.w.show_ms = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_playback_show_ms']);
    $scope.w.show_ms = $scope.w.show_ms === 'undefined' ? false : !!$scope.w.show_ms;
    $scope.w.show_tooltip = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_jump_show_tooltip']);
    $scope.w.show_tooltip = $scope.w.show_tooltip === 'undefined' ? true : !!$scope.w.show_tooltip;
    $scope.w.tick_str = playback.calc_tick_str($scope.tick, $scope.w.show_ms);
    $scope.start_tick_str = playback.calc_tick_str($scope.start_tick, $scope.w.show_ms);
    $scope.end_tick_str = playback.calc_tick_str($scope.end_tick, $scope.w.show_ms);
    $scope.w.pos = ($scope.tick - $scope.start_tick) * slider_max / total;

    $scope.back_array = [
      { name: '5h', value: 3600000 * 5, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 5 + ' ' + $translate.instant('IDS_TIME_UNIT_HOUR') },
      { name: '1h', value: 3600000, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 1 + ' ' + $translate.instant('IDS_TIME_UNIT_HOUR') },
      { name: '10m', value: 60000 * 10, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 10 + ' ' + $translate.instant('IDS_TIME_UNIT_MINUTE') },
      { name: '5m', value: 60000 * 5, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 5 + ' ' + $translate.instant('IDS_TIME_UNIT_MINUTE') },
      { name: '1m', value: 60000, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 1 + ' ' + $translate.instant('IDS_TIME_UNIT_MINUTE') },
      { name: '10s', value: 10000, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 10 + ' ' + $translate.instant('IDS_TIME_UNIT_SECOND') },
      { name: '5s', value: 5000, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 5 + ' ' + $translate.instant('IDS_TIME_UNIT_SECOND') },
      { name: '1s', value: 1000, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 1 + ' ' + $translate.instant('IDS_TIME_UNIT_SECOND') },
      { name: '500ms', value: 500, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 500 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '100ms', value: 100, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 100 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '50ms', value: 50, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 50 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '10ms', value: 10, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 10 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '5ms', value: 5, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 5 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '1ms', value: 1, tooltip: $translate.instant('ID_PLAYBACK_BACKWARD') + ' ' + 1 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') }
    ];
    $scope.forward_array = [
      { name: '5h', value: 3600000 * 5, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 5 + ' ' + $translate.instant('IDS_TIME_UNIT_HOUR') },
      { name: '1h', value: 3600000, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 1 + ' ' + $translate.instant('IDS_TIME_UNIT_HOUR') },
      { name: '10m', value: 60000 * 10, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 10 + ' ' + $translate.instant('IDS_TIME_UNIT_MINUTE') },
      { name: '5m', value: 60000 * 5, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 5 + ' ' + $translate.instant('IDS_TIME_UNIT_MINUTE') },
      { name: '1m', value: 60000, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 1 + ' ' + $translate.instant('IDS_TIME_UNIT_MINUTE') },
      { name: '10s', value: 10000, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 10 + ' ' + $translate.instant('IDS_TIME_UNIT_SECOND') },
      { name: '5s', value: 5000, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 5 + ' ' + $translate.instant('IDS_TIME_UNIT_SECOND') },
      { name: '1s', value: 1000, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 1 + ' ' + $translate.instant('IDS_TIME_UNIT_SECOND') },
      { name: '500ms', value: 500, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 500 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '100ms', value: 100, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 100 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '50ms', value: 50, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 50 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '10ms', value: 10, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 10 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '5ms', value: 5, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 5 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') },
      { name: '1ms', value: 1, tooltip: $translate.instant('ID_PLAYBACK_FORWARD') + ' ' + 1 + ' ' + $translate.instant('IDS_TIME_UNIT_MS') }
    ];

    $scope.can_backward = function (interval) {
      return ($scope.tick - interval.value >= $scope.start_tick
        && ($scope.w.show_ms || interval.value >= 1000));
    }

    $scope.can_forward = function (interval) {
      return ($scope.tick + interval.value <= $scope.end_tick
        && ($scope.w.show_ms || interval.value >= 1000));
    }

    $scope.backward = function (interval) {
      $scope.tick -= interval.value;
      $scope.w.pos = ($scope.tick - $scope.start_tick) * slider_max / total;
      $scope.w.tick_str = playback.calc_tick_str($scope.tick, $scope.w.show_ms);
    }

    $scope.forward = function (interval) {
      $scope.tick += interval.value;
      $scope.w.pos = ($scope.tick - $scope.start_tick) * slider_max / total;
      $scope.w.tick_str = playback.calc_tick_str($scope.tick, $scope.w.show_ms);
    }

    /*
    $scope.$watch(function () {
    return $scope.w.tick_str;
    }, function () {
    var tick = playback.calc_tick($scope.w.tick_str);
    if(isNaN(tick)) tick = 0;

    if(tick < $scope.start_tick) tick = $scope.start_tick;
    else if(tick > $scope.end_tick) tick = $scope.end_tick;
    $scope.tick = tick;
    $scope.w.pos = ($scope.tick - $scope.start_tick) * slider_max / total;
    });
    */

    $scope.$watch(function () {
      return $scope.w.pos;
    }, function () {
      $scope.tick = ($scope.start_tick + total * $scope.w.pos / slider_max) >> 0;
      $scope.w.tick_str = playback.calc_tick_str($scope.tick, $scope.w.show_ms);
    });

    $scope.$watch(function () {
      return $scope.w.show_ms;
    }, function () {
      hmtg.util.localStorage['hmtg_playback_show_ms'] = JSON.stringify($scope.w.show_ms);
      $scope.w.tick_str = playback.calc_tick_str($scope.tick, $scope.w.show_ms);
      $scope.start_tick_str = playback.calc_tick_str($scope.start_tick, $scope.w.show_ms);
      $scope.end_tick_str = playback.calc_tick_str($scope.end_tick, $scope.w.show_ms);
    });

    $scope.$watch(function () {
      return $scope.w.show_tooltip;
    }, function () {
      hmtg.util.localStorage['hmtg_jump_show_tooltip'] = JSON.stringify($scope.w.show_tooltip);
    });

    $scope.reset = function () {
      $scope.tick = $scope.base_tick;
      $scope.w.tick_str = playback.calc_tick_str($scope.tick, $scope.w.show_ms);
    }

    $scope.ok = function () {
      var tick = $scope.tick;

      if(tick < $scope.start_tick || tick > $scope.end_tick) return;
      $modalInstance.close({
        tick: tick
      });
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }
])

;