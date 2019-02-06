angular.module('msgr')
.controller('ViewRecordModalCtrl', ['$scope', '$modalInstance', '$translate', 'hmtgHelper', 'msgrHelper', '$sce', 'appSetting',
  function($scope, $modalInstance, $translate, hmtgHelper, msgrHelper, $sce, appSetting) {
    $scope.as = appSetting;
    $scope.w = {};
    $scope.w.item_list = [];
    $scope.w.sort_target = 1;
    $scope.ascending = true;

    var data = $scope.data;
    $scope.w.item = $scope.item;
    $scope.w.is_mmc = $scope.param._mmc_messenger();

    $scope.style_height = { 'max-height': Math.max(240, (hmtgHelper.view_port_height - 190)) + 'px' };
    $scope.style_height2 = { 'height': Math.max(200, (hmtgHelper.view_port_height - 195)) + 'px' };
    $scope.style_height3 = { 'max-height': Math.max(240, (hmtgHelper.view_port_height - 185)) + 'px' };

    function calcTotalTimeStr(value) {
      if(value >= 3600 * 24) {
        return ((value / 3600 / 24) >>> 0) + ' ' + $translate.instant('IDS_TIME_UNIT_DAY');
      } else if(value >= 3600) {
        return ((value / 3600) >>> 0) + ' ' + $translate.instant('IDS_TIME_UNIT_HOUR');
      } else if(value >= 60) {
        return ((value / 60) >>> 0) + ' ' + $translate.instant('IDS_TIME_UNIT_MINUTE');
      } else {
        return Math.max(1, (value >>> 0)) + ' ' + $translate.instant('IDS_TIME_UNIT_SECOND');
      }
    }
    function init_list() {
      while(data.length >= 16) {
        var r = hmtg.jmkernel.jm_command_ParseViewRecord(data);
        if(!r) break;
        var item = {};
        item.player_name = hmtg.util.decodeUtf8(r[1]);
        item.view_count = r[2];
        item.total_time = r[3];
        item.total_time_str = calcTotalTimeStr(r[3]);
        item.last_playtime = msgrHelper.get_timestring_im3(r[4]);
        item.last_playtime_str = msgrHelper.get_timestring_im3(r[4]);


        var a = $scope.w.item_list;
        a.push(item);
        data = data.slice(r[0] + 16);
      }

      $scope.sort();
    }

    $scope.compare = function(item1, item2) {
      var result = $scope.compare0(item1, item2);
      if($scope.w.ascending) return -result;
      return result;
    }

    $scope.compare0 = function(item1, item2) {
      var result;
      switch($scope.w.sort_target) {
        case 1:
          if(item1.player_name < item2.player_name) return -1;
          if(item1.player_name > item2.player_name) return 1;
          break;
        case 2:
          result = item1.view_count - item2.view_count;
          if(result != 0) return result;
          if(!item1.view_count) {
            if((item1.flag & 0x20000000) && !(item2.flag & 0x20000000)) return 1;
            if(!(item1.flag & 0x20000000) && (item2.flag & 0x20000000)) return -1;
          }
          break;
        case 3:
          result = item1.total_time - item2.total_time;
          if(result != 0) return result;
          break;
        case 4:
          result = item1.last_playtime - item2.last_playtime;
          if(result != 0) return result;
          break;
        default:
          return -1;
      }
      return 0;
    }

    $scope.sort = function() {
      // insertion sorting, simple and good for nearly sorted array
      var i, j;
      for(i = 1; i < $scope.w.item_list.length; i++) {
        var x = $scope.w.item_list[i];
        j = i;
        while(j > 0 && $scope.compare($scope.w.item_list[j - 1], x) > 0) {
          $scope.w.item_list[j] = $scope.w.item_list[j - 1];
          j--;
        }
        if(i != j) $scope.w.item_list[j] = x;
      }
    }

    $scope.resort = function(sort_target) {
      if($scope.w.sort_target == sort_target) {
        $scope.w.ascending = !$scope.w.ascending;
        $scope.w.item_list.reverse();
      } else {
        $scope.w.sort_target = sort_target;
        $scope.sort();
      }
    }

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };

    $scope.open_url = function() {
      window.open($scope.w.url2, hmtg.util.app_id + 'view_record').focus();
    }

    if($scope.w.is_mmc) {
      $scope.w.url2 = $sce.trustAsResourceUrl(data);
    } else {
      init_list();
    }
  }
])

;