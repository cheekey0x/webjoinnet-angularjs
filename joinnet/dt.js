/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('sdt', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope',
  function($translate, appSetting, hmtgHelper, $rootScope) {
    var _sdt = this;
  }
])

.service('rdc', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope',
  function($translate, appSetting, hmtgHelper, $rootScope) {
    var _rdc = this;
    this.is_control = false;
  }
])

;
