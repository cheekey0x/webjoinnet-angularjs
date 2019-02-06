/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('mypicture', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope', 'hmtgSound', '$modal', 'joinnetHelper',
  function ($translate, appSetting, hmtgHelper, $rootScope, hmtgSound, $modal, joinnetHelper) {
    var _mypicture = this;
    this.data = null;
    this.type = -1;
    this.type_array = ['', 'image/bmp', 'image/gif', 'image/jpeg', 'image/png'];

    try {
      var hmd = typeof hmtg.util.localStorage['hmtg_mypicture_data'] === 'undefined' ? '' : JSON.parse(hmtg.util.localStorage['hmtg_mypicture_data']);
      if(typeof hmd === 'string')
        this.data = hmtg.util.str2array(hmd);
      else
        this.data = null;
      this.type = typeof hmtg.util.localStorage['hmtg_mypicture_type'] === 'undefined' ? -1 : JSON.parse(hmtg.util.localStorage['hmtg_mypicture_type']);
      if(!this.data || !this.data.length || this.data.length > hmtg.config.MAX_MYPICTURE_SIZE
      || this.type <= 0 || this.type >= this.type_array.length)
        this.data = null;
    } catch(e) {
      this.data = null;
    }

    this.net_init_finished = function () {
      if(hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL && this.data) {
        hmtg.jnkernel.jn_command_UploadSelfPicture(this.type, this.data);
      }
    }
  }
])

;
