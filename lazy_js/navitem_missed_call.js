angular.module('msgr')
.controller('MissedCallCtrl', ['$scope', 'hmtgHelper', '$rootScope', '$translate', 'missedCall', 'hmtgAlert',
  function($scope, hmtgHelper, $rootScope, $translate, missedCall, hmtgAlert) {
    $scope.w = missedCall;

    $scope.calc_type = function(item) {
      return $translate.instant(item.tid);
    }

    $scope.remove = function(item) {
      missedCall.delete_missed_call(item);
      if(!missedCall.missed_call_array.length) {
        if($rootScope.hmtg_show_msgr) {
          $rootScope.nav_item = 'msgr';
          $rootScope.tabs[0].active = true;
        } else {
          $rootScope.nav_item = 'joinnet';
          $rootScope.tabs[2].active = true;
        }
      }
    }

    hmtgHelper.inside_angular++;
    if(missedCall.missed_call_array.length && missedCall.to_check_missed_call) {
      missedCall.to_check_missed_call = false;

      var item = {};
      item['timeout'] = 30;
      item['update'] = function() {
        return $translate.instant('IDS_SHOW_MISSED_CALLS')
      };
      item['text'] = item['update']();
      item['type'] = 'info';
      item['click'] = function(index) {
        hmtgHelper.inside_angular++;
        hmtgAlert.click_link(index);
        $rootScope.nav_item = 'missed_call';
        $rootScope.tabs[4].active = true;
        $rootScope.selectTabMissedCall();
        hmtgHelper.inside_angular--;
      };

      hmtgAlert.add_link_item(item);
    }
    hmtgHelper.inside_angular--;
  }
])
;