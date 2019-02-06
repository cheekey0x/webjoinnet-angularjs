/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('playback', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope', 'video_playback', 'hmtgAlert',
  'userlist', 'main_video', 'board', 'video_recving',
  function($translate, appSetting, hmtgHelper, $rootScope, video_playback, hmtgAlert, userlist,
    main_video, board, video_recving) {
    this.queue_flipslide_index = 0;
    this.queue_has_flipslide_index = false;
    this.queue_hint1_index = 0;
    this.queue_has_hint1_index = false;
    this.queue_hint2_index = 0;
    this.queue_has_hint2_index = false;
    this.queue_tab_mode = 0;
    this.queue_has_tab_mode = false;

    this.queue_catchup = function() {
      userlist.refresh_user();
      $rootScope.$broadcast(hmtgHelper.WM_REFRESH_USER);
      main_video.update_user_list();
      main_video.select_video_ssrc(video_recving.main_video_ssrc);

      if(this.queue_has_hint1_index) {
        board.callback_FlipSlide(1, this.queue_hint1_index);
        this.queue_has_hint1_index = false;
      }
      if(this.queue_has_hint2_index) {
        board.callback_FlipSlide(2, this.queue_hint2_index);
        this.queue_has_hint2_index = false;
      }
      if(this.queue_has_flipslide_index) {
        board.callback_FlipSlide(0, this.queue_flipslide_index);
        this.queue_has_flipslide_index = false;
      }
      board.slide_changed();

      if(this.queue_has_tab_mode) {
        $rootScope.$broadcast(hmtgHelper.WM_TAB_MODE, this.queue_tab_mode);
        this.queue_has_tab_mode = false;
      }
    }

    this.queue_reset = function() {
      this.queue_has_flipslide_index = false;
      this.queue_has_hint1_index = false;
      this.queue_has_hint1_index = false;
      this.queue_has_tab_mode = false;
    }

    this.init_stat = function (start_tick, end_tick, bandwidth, start_str) {
      this.ready = true;

      this.start_tick = start_tick;
      this.end_tick = end_tick;
      this.bandwidth = bandwidth;
      this.start_str = start_str;
      this.end_str = this.calc_tick_str(end_tick);
      this.pos_str = '0%';
      this.tick_str = '0:00:00';

      this.tick = start_tick;
      $rootScope.$broadcast(hmtgHelper.WM_PLAYBACK_INIT_STAT);
      $rootScope.$broadcast(hmtgHelper.WM_PLAYBACK_TICK_UPDATE, this.tick);
    }

    this.event_quit_session = function () {
    }

    this.reset = function () {
      this.start_tick = 0;
      this.end_tick = 0;
      this.start_str = '';
      this.bandwidth = 0;
      this.random_access = false;
      this.queue_reset();
      this.random_access_tick = 0;
      this.queued_jump = false;
      this.tick = 0;
      this.tick_str = this.pos_str = '';
      this.repeat = false;
      this.paused = false;

      this.ready = false;

      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_PLAYBACK);
    }

    this.restart = function() {
      // playback restart do not change the status of random access
      //this.random_access = false;

      // playback restart need to reset random access queue regardless the status of random access
      this.queue_reset();
    }

    this.calc_tick = function (str) {
      var h, m, s, ms;
      var sign = 1;
      if(str.charCodeAt(0) == '-'.charCodeAt(0)) {
        sign = -1;
        str = str.slice(1);
      }
      var idx = str.lastIndexOf('.');
      if(-1 == idx) ms = 0;
      else {
        ms = parseInt(str.slice(idx + 1));
        str = str.slice(0, idx);
      }

      idx = str.lastIndexOf(':');
      if(-1 == idx) return (parseInt(str) * 1000 + ms) * sign;
      s = parseInt(str.slice(idx + 1));
      str = str.slice(0, idx);

      idx = str.lastIndexOf(':');
      if(-1 == idx) return ((parseInt(str) * 60 + s) * 1000 + ms) * sign;
      m = parseInt(str.slice(idx + 1));
      str = str.slice(0, idx);

      return ((parseInt(str) * 3600 + m * 60 + s) * 1000 + ms) * sign;
    }

    this.calc_tick_str = function (tick, with_ms) {
      var dwTick = tick >>> 0;
      var abs_tick = dwTick;
      if(dwTick & 0x80000000) abs_tick = (-dwTick) >>> 0;
      var s = (abs_tick / 1000) >>> 0;
      var ms = abs_tick - s * 1000;
      var min = (s / 60) >>> 0;
      s -= min * 60;
      var s_str = ('0000' + s).slice(-2);
      var ms = abs_tick - min * 60 * 1000;
      var hour = (min / 60) >>> 0;
      min -= hour * 60;
      var min_str = ('0000' + min).slice(-2);

      var tick_str;
      var delay = 0;
      if(dwTick & 0x80000000) {
        tick_str = ['-', hour, ':', min_str, ':', s_str].join('');
        delay = ms;
      } else {
        tick_str = ['', hour, ':', min_str, ':', s_str].join('');
        delay = 60000 - ms;
      }

      if(with_ms && ms) tick_str += '.' + (('000000' + ms).slice(-3));
      return tick_str;
    }

    this.jump = function (tick) {
      if(tick != this.tick) {
        if(tick < this.tick) {
          if(!this.paused) {
            this.paused = true;
            hmtg.jnkernel.jn_command_PlaybackPause();
            hmtgHelper.inside_angular++;
            var item = {};
            item['timeout'] = 20;
            item['update'] = function () { return $translate.instant('ID_PLAYBACK_PAUSED') };
            item['text'] = item['update']();
            item['type'] = 'danger';

            hmtgAlert.update_status_item(item);
            hmtgHelper.inside_angular--;
          }
          if(!this.queued_jump) {
            this.queued_jump = true;
          }
        } else {
          if(this.paused) {
            if(!this.queued_jump) {
              this.queued_jump = true;
            }
          } else {
            this.random_access = true;
            this.random_access_tick = tick;
            hmtg.jnkernel.jn_command_PlaybackRandomAccess(tick);

            video_playback.on_all_video_interrupted();
            video_playback.clear_all_queue();
          }
        }

        this.tick = tick;
        hmtgHelper.inside_angular++;
        this.tick_str = this.calc_tick_str(tick);
        $rootScope.$broadcast(hmtgHelper.WM_PLAYBACK_UPDATE_TICK_STR);  // also update the str at title bar
        $rootScope.$broadcast(hmtgHelper.WM_PLAYBACK_UPDATE_POS);  // also update the position at playback control
        hmtgHelper.inside_angular--;
      }
    }

    this.reset();
  }
])

;
