/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('msgr')

.service('msgrHelper', ['hmtgAlert', 'msgrIcon', 'hmtgHelper', 'hmtgSound', '$filter', '$translate', '$modal',
  '$ocLazyLoad', '$rootScope',
  function(hmtgAlert, msgrIcon, hmtgHelper, hmtgSound, $filter, $translate, $modal, $ocLazyLoad, $rootScope) {
    var _msgrHelper = this;
    this.userstatus2id = function(status, office_status, forowner) {
      if(status == hmtg.config.ONLINE_STATUS_APPEAROFF) {
        if(forowner)
          return 'IDS_STATUS_APPEAROFFLINE';
        else
          return 'IDS_STATUS_OFFLINE';
      }
      else if(status == hmtg.config.ONLINE_STATUS_BUSY)
        return 'IDS_STATUS_BUSY';
      else if(status == hmtg.config.ONLINE_STATUS_RIGHTBACK)
        return 'IDS_STATUS_RIGHTBACK';
      else if(status == hmtg.config.ONLINE_STATUS_AWAY)
        return 'IDS_STATUS_AWAY';
      else if(office_status == 2)
        return 'IDS_STATUS_INMEETING';
      else if(office_status)
        return 'IDS_STATUS_OFFICEOPEN';
      else if(status == 0)
        return 'IDS_STATUS_OFFLINE';
      else
        return 'IDS_STATUS_ONLINE';
    }
    this.connectionstatus2id = function(status) {
      var str;
      switch(status) {
        case hmtg.config.CONNECTION_STATUS_INIT:
          str = 'IDS_CONNECTION_STATUS_INIT';
          break;
        case hmtg.config.CONNECTION_STATUS_RESOLVING:
          str = 'IDS_CONNECTION_STATUS_RESOLVING';
          break;
        case hmtg.config.CONNECTION_STATUS_CONNECTTING:
          str = 'IDS_CONNECTION_STATUS_CONNECTTING';
          break;
        case hmtg.config.CONNECTION_STATUS_SIGN_IN:
          str = 'IDS_CONNECTION_STATUS_SIGN_IN';
          break;
        case hmtg.config.CONNECTION_STATUS_CONNECTED:
          str = 'IDS_CONNECTION_STATUS_CONNECTED';
          break;
        case hmtg.config.CONNECTION_STATUS_PREPARE_RECONNECT:
          str = 'IDS_CONNECTION_STATUS_PREPARE_RECONNECT';
          break;
        case hmtg.config.CONNECTION_STATUS_PARSE_HOMEPAGE:
          str = 'IDS_CONNECTION_STATUS_PARSE_HOMEPAGE';
          break;
        case hmtg.config.CONNECTION_STATUS_DOWNLOAD_JNJ:
          str = 'IDS_CONNECTION_STATUS_DOWNLOAD_JNJ';
          break;


        case hmtg.config.CONNECTION_STATUS_E_UNKNOWN_ERROR:
          str = 'IDS_CONNECTION_STATUS_E_UNKNOWN_ERROR';
          break;
        case hmtg.config.CONNECTION_STATUS_E_RESOLVING:
          str = 'IDS_CONNECTION_STATUS_E_RESOLVING';
          break;
        case hmtg.config.CONNECTION_STATUS_E_FAIL_CONNECT:
          str = 'IDS_CONNECTION_STATUS_E_FAIL_CONNECT';
          break;
        case hmtg.config.CONNECTION_STATUS_E_BROKEN_CONNECT:
          str = 'IDS_CONNECTION_STATUS_E_BROKEN_CONNECT';
          break;
        case hmtg.config.CONNECTION_STATUS_E_INVALID_S_STRING:
          str = 'IDS_CONNECTION_STATUS_E_INVALID_S_STRING';
          break;
        case hmtg.config.CONNECTION_STATUS_E_NOT_SUPPORTED:
          str = 'IDS_CONNECTION_STATUS_E_NOT_SUPPORTED';
          break;
        case hmtg.config.CONNECTION_STATUS_E_WRONG_USERID_LEN:
          str = 'IDS_CONNECTION_STATUS_E_WRONG_USERID_LEN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_WRONG_USERNAME_LEN:
          str = 'IDS_CONNECTION_STATUS_E_WRONG_USERNAME_LEN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_WRONG_JNJ_LEN:
          str = 'IDS_CONNECTION_STATUS_E_WRONG_JNJ_LEN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_ERROR_PARAMETER:
          str = 'IDS_CONNECTION_STATUS_E_ERROR_PARAMETER';
          break;
        case hmtg.config.CONNECTION_STATUS_E_BUSY:
          str = 'IDS_CONNECTION_STATUS_E_BUSY';
          break;
        case hmtg.config.CONNECTION_STATUS_E_INVALID_USERID:
          str = 'IDS_CONNECTION_STATUS_E_INVALID_USERID';
          break;
        case hmtg.config.CONNECTION_STATUS_E_INVALID_PASSWORD:
          str = 'IDS_CONNECTION_STATUS_E_INVALID_PASSWORD';
          break;
        case hmtg.config.CONNECTION_STATUS_E_MEMORY_ALLOCATION:
          str = 'IDS_CONNECTION_STATUS_E_MEMORY_ALLOCATION';
          break;
        case hmtg.config.CONNECTION_STATUS_E_ALREADY_LOGGED:
          str = 'IDS_CONNECTION_STATUS_E_ALREADY_LOGGED';
          break;
        case hmtg.config.CONNECTION_STATUS_E_OVERWRITTEN:
          str = 'IDS_CONNECTION_STATUS_E_OVERWRITTEN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_USERID_REMOVED:
          str = 'IDS_CONNECTION_STATUS_E_USERID_REMOVED';
          break;
        case hmtg.config.CONNECTION_STATUS_E_UNKNOWN_COMMAND:
          str = 'IDS_CONNECTION_STATUS_E_UNKNOWN_COMMAND';
          break;
        case hmtg.config.CONNECTION_STATUS_E_WRONG_EMAIL_LEN:
          str = 'IDS_CONNECTION_STATUS_E_WRONG_EMAIL_LEN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_PARSE_HOMEPAGE:
          str = 'IDS_CONNECTION_STATUS_E_PARSE_HOMEPAGE';
          break;
        case hmtg.config.CONNECTION_STATUS_E_DOWNLOAD_JNJ:
          str = 'IDS_CONNECTION_STATUS_E_DOWNLOAD_JNJ';
          break;
        case hmtg.config.CONNECTION_STATUS_E_PARSE_IP_PORT:
          str = 'IDS_CONNECTION_STATUS_E_PARSE_IP_PORT';
          break;
        case hmtg.config.CONNECTION_STATUS_E_BREAK_MAIN_LOOP:
          str = 'IDS_CONNECTION_STATUS_E_BREAK_MAIN_LOOP';
          break;
        case hmtg.config.CONNECTION_STATUS_E_WRONG_HOMEPAGE_LEN:
          str = 'IDS_CONNECTION_STATUS_E_WRONG_HOMEPAGE_LEN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_MULTIPLE_SIGNIN:
          str = 'IDS_CONNECTION_STATUS_E_MULTIPLE_SIGNIN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_MMC_FAILURE:
          str = 'IDS_CONNECTION_STATUS_E_MMC_FAILURE';
          break;
        case hmtg.config.CONNECTION_STATUS_E_NOT_SUPPORTED2:
          str = 'IDS_CONNECTION_STATUS_E_NOT_SUPPORTED2';
          break;
        case hmtg.config.CONNECTION_STATUS_E_NO_MESSENGER:
          str = 'IDS_CONNECTION_STATUS_E_NO_MESSENGER';
          break;
        case hmtg.config.CONNECTION_STATUS_E_NO_LICENSE:
          str = 'IDS_CONNECTION_STATUS_E_NO_LICENSE';
          break;
        case hmtg.config.CONNECTION_STATUS_E_NO_MCU:
          str = 'IDS_CONNECTION_STATUS_E_NO_MCU';
          break;
        case hmtg.config.CONNECTION_STATUS_E_WRONG_URL_LEN:
          str = 'IDS_CONNECTION_STATUS_E_WRONG_URL_LEN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_WRONG_SHORT_MESSAGE_LEN:
          str = 'IDS_CONNECTION_STATUS_E_WRONG_SHORT_MESSAGE_LEN';
          break;
        case hmtg.config.CONNECTION_STATUS_E_SIGNOUT:
          str = 'IDS_CONNECTION_STATUS_E_SIGNOUT';
          break;
        case hmtg.config.CONNECTION_STATUS_E_WRONG_CLIENT_INFO_LEN:
          str = 'IDS_CONNECTION_STATUS_E_WRONG_CLIENT_INFO_LEN';
          break;
        default:
          str = 'IDS_CONNECTION_STATUS_E_DEFAULT';
          break;
      }
      return str;
    }

    this.translate_mmc_error = function(t, mmc_error, error_text) {
      if(error_text) return hmtg.util.decodeUtf8(error_text);
      var str;
      switch(mmc_error) {
        case hmtg.config.US_ERROR_MMC_GENERAL:
          str = 'IDS_ERROR_MMC_GENERAL';

          break;
        case hmtg.config.US_ERROR_MMC_BAD_REQUEST:
          str = 'IDS_ERROR_MMC_BAD_REQUEST';

          break;
        case hmtg.config.US_ERROR_MMC_REQUEST_FAIL:
          str = 'IDS_ERROR_MMC_REQUEST_FAIL';

          break;
        case hmtg.config.US_ERROR_MMC_BAD_RESPONSE:
          str = 'IDS_ERROR_MMC_BAD_RESPONSE';

          break;
        case hmtg.config.US_ERROR_MMC_BAD_KEY:
          str = 'IDS_ERROR_MMC_BAD_KEY';

          break;
        case hmtg.config.US_ERROR_MMC_PARSE_RESPONSE:
          str = 'IDS_ERROR_MMC_PARSE_RESPONSE';

          break;
        default:
          str = 'IDS_ERROR_MMC_UNKNOWN';
          return t(str).replace('%d', mmc_error);
      }
      return t(str);
    }

    this.ShowError = function(t, param, error_code) {
      var str;
      switch(error_code) {
        case hmtg.config.MSGR_ERROR_CAN_NOT_PARSE:
          str = t('IDS_ERROR_CAN_NOT_PARSE');
          break;
        case hmtg.config.MSGR_ERROR_CAN_NOT_CONNECT_HOMEPAGE1:
          str = t('IDS_ERROR_CAN_NOT_CONNECT_HOMEPAGE1');
          break;
        case hmtg.config.MSGR_ERROR_CAN_NOT_DOWNLOAD_JNJ:
          str = t('IDS_ERROR_CAN_NOT_DOWNLOAD_JNJ');
          break;
        case hmtg.config.MSGR_ERROR_CAN_NOT_CONNECT_HOMEPAGE2:
          str = t('IDS_ERROR_CAN_NOT_CONNECT_HOMEPAGE2');
          break;
        case hmtg.config.MSGR_ERROR_CAN_NOT_CONNECT_HOMEPAGE3:
          str = t('IDS_ERROR_CAN_NOT_CONNECT_HOMEPAGE3');
          break;
        case hmtg.config.MSGR_ERROR_NO_MCU_SERVER:
          str = t('IDS_ERROR_NO_MCU_SERVER');
          break;
        case hmtg.config.MSGR_ERROR_CAN_NOT_MULTIPLE_CONNECT:
          str = t('IDS_ERROR_CAN_NOT_MULTIPLE_CONNECT');
          break;
        case hmtg.config.MSGR_ERROR_CAN_NOT_CONNECT_MCU:
          str = t('IDS_ERROR_CAN_NOT_CONNECT_MCU');
          break;
        case hmtg.config.MSGR_ERROR_CONNECTION_BROKEN:
          str = t('IDS_ERROR_CONNECTION_BROKEN');
          break;
        case hmtg.config.MSGR_ERROR_BAD_SERVER_VERSION_STRING:
          str = t('IDS_ERROR_BAD_SERVER_VERSION_STRING');
          break;
        case hmtg.config.MSGR_ERROR_SERVER_NOT_SUPPORT_MSGR:
          str = t('IDS_ERROR_SERVER_NOT_SUPPORT_MSGR');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_USERID_LEN:
          str = t('IDS_ERROR_INVALID_USERID_LEN');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_USERNAME_LEN:
          str = t('IDS_ERROR_INVALID_USERNAME_LEN');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_JNJ_LEN:
          str = t('IDS_ERROR_INVALID_JNJ_LEN');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_HOMEPAGE_LEN:
          str = t('IDS_ERROR_INVALID_HOMEPAGE_LEN');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_PARAMETER:
          str = t('IDS_ERROR_INVALID_PARAMETER');
          break;
        case hmtg.config.MSGR_ERROR_ALL_LINE_BUSY:
          str = t('IDS_ERROR_ALL_LINE_BUSY');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_USERID:
          str = t('IDS_ERROR_INVALID_USERID');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_PASSWORD:
          str = t('IDS_ERROR_INVALID_PASSWORD');
          break;
        case hmtg.config.MSGR_ERROR_MEMORY_ALLOCATION:
          str = t('IDS_ERROR_MEMORY_ALLOCATION');
          break;
        case hmtg.config.MSGR_ERROR_ALREADY_SIGNIN:
          str = t('IDS_ERROR_ALREADY_SIGNIN');
          break;
        case hmtg.config.MSGR_ERROR_MSGR_VERSION_NOT_SUPPORTED:
          str = t('IDS_ERROR_MSGR_VERSION_NOT_SUPPORTED');
          break;
        case hmtg.config.MSGR_ERROR_MSGR_BAD_CONFIGURATION:
          str = t('IDS_ERROR_MSGR_BAD_CONFIGURATION');
          break;
        case hmtg.config.MSGR_ERROR_NO_MSGR_LICENSE:
          str = t('IDS_ERROR_NO_MSGR_LICENSE');
          break;
        case hmtg.config.MSGR_ERROR_OVERWRITTEN:
          str = t('IDS_ERROR_OVERWRITTEN');
          break;
        case hmtg.config.MSGR_ERROR_REMOVED:
          str = t('IDS_ERROR_REMOVED');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_EMAIL_LEN:
          str = t('IDS_ERROR_INVALID_EMAIL_LEN');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_MMCERROR_LEN:
          str = t('IDS_ERROR_INVALID_MMCERROR_LEN');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_INTERNALID_LEN:
          str = t('IDS_ERROR_INVALID_INTERNALID_LEN');
          break;
        case hmtg.config.MSGR_INVITE_FAILED:
          str = t('IDS_INVITE_FAILED');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_URL_LEN:
          str = t('IDS_ERROR_INVALID_URL_LEN');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_SHORT_MESSAGE_LEN:
          str = t('IDS_ERROR_INVALID_SHORT_MESSAGE_LEN');
          break;
        case hmtg.config.MSGR_CONNECTION_STATUS_E_WRONG_HOMEPAGE_LEN:
          str = t('IDS_CONNECTION_STATUS_E_WRONG_HOMEPAGE_LEN');
          break;
        case hmtg.config.MSGR_ERROR_INVALID_CLIENT_INFO_LEN:
          str = t('IDS_ERROR_INVALID_CLIENT_INFO_LEN');
          break;
        case hmtg.config.MSGR_ERROR_UNKNOWN_COMMAND:
          str = t('IDS_ERROR_UNKNOWN_COMMAND');
          break;
        case hmtg.config.MSGR_ERROR_UNKNOWN_ERROR:
          str = t('IDS_ERROR_UNKNOWN_ERROR');
          break;
        default:
          str = t('IDS_ERROR_UNKNOWN_ERROR') + '(' + error_code + ')';
          break;
      }

      _msgrHelper.ShowMessageBox(t, param, str);
    }

    this.ShowWebOfficeError = function(t, error_code) {
      var str;
      switch(error_code) {
        case hmtg.config.WEBOFFICE_EX_ERROR_INVALID_LICENSE:
          str = t('IDS_WEBOFFICE_EX_ERROR_INVALID_LICENSE');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_GENERAL_FAILURE:
          str = t('IDS_WEBOFFICE_EX_ERROR_GENERAL_FAILURE');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_OPEN_FILE:
          str = t('IDS_WEBOFFICE_EX_ERROR_OPEN_FILE');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_INVALID_JNR:
          str = t('IDS_WEBOFFICE_EX_ERROR_INVALID_JNR');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_NOT_ALLOW_EDIT:
          str = t('IDS_WEBOFFICE_EX_ERROR_NOT_ALLOW_EDIT');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_FILE_ACCESS:
          str = t('IDS_WEBOFFICE_EX_ERROR_FILE_ACCESS');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_INVALID_PASSWORD:
          str = t('IDS_ERROR_INVALID_PASSWORD');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_SERVER_SHUTDOWN:
          str = t('IDS_WEBOFFICE_EX_ERROR_SERVER_SHUTDOWN');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_WRITE_ERROR:
          str = t('IDS_WEBOFFICE_EX_ERROR_WRITE_ERROR');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_MEMORY:
          str = t('IDS_ERROR_MEMORY_ALLOCATION');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_NETWORK_ERROR:
          str = t('IDS_WEBOFFICE_EX_ERROR_NETWORK_ERROR');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_EXCEED_QUOTA:
          str = t('IDS_WEBOFFICE_EX_ERROR_EXCEED_QUOTA');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_DATE_TOO_NEW:
          str = t('IDS_WEBOFFICE_EX_DATE_TOO_NEW');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_MMC_ERROR:
          str = t('IDS_WEBOFFICE_EX_MMC_ERROR');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_UNKNOWN_CMD:
          str = t('IDS_WEBOFFICE_EX_UNKNOWN_CMD');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_INVALID_CMD:
          str = t('IDS_WEBOFFICE_EX_INVALID_CMD');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_JNR_TOONEW:
          str = t('IDS_WEBOFFICE_EX_JNR_TOONEW');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_JNR_TOOBIG:
          str = t('IDS_WEBOFFICE_EX_JNR_TOOBIG');
          break;
        case hmtg.config.WEBOFFICE_EX_ERROR_EDIT:
          str = t('IDS_WEBOFFICE_EX_EDIT');
          break;
        default:
          str = t('IDS_ERROR_UNKNOWN_ERROR') + '(' + error_code + ')';
          break;
      }

      hmtgHelper.MessageBox(str, 0);
    }

    this.ShowWebOfficeError2 = function(t, error_code) {
      var str;
      switch(error_code) {
        case hmtg.config.ERROR_MESSAGE_NOT_EXIST:
          str = t('IDS_MESSAGE_NOT_EXIST');
          break;
        case hmtg.config.ERROR_LINE_BUSY:
          str = t('IDS_ERROR_ALL_LINE_BUSY');
          break;
        case hmtg.config.ERROR_FILE_ERROR:
          str = t('IDS_WEBOFFICE_EX_ERROR_OPEN_FILE');
          break;
        case hmtg.config.ERROR_TOOMANY_DOWNLOAD:
          str = t('IDS_ERROR_ALL_LINE_BUSY');
          break;
        default:
          str = t('IDS_ERROR_UNKNOWN_ERROR') + '(' + error_code + ')';
          break;
      }

      hmtgHelper.MessageBox(str, 0);
    }

    this.ShowMessageBox = function(t, param, error) {
      var guest = param._guest();
      var homepage = hmtg.util.decodeUtf8(param._homepage());
      var userid = hmtg.util.decodeUtf8(param._userid());
      hmtgSound.ShowErrorPrompt(function() {
        var str;
        if(guest) {
          str = t('IDS_FORMAT_ERROR_PROMPT1')
        .replace('#error#', error)
        .replace('#homepage#', homepage)
        ;
        } else {
          str = t('IDS_FORMAT_ERROR_PROMPT2')
        .replace('#error#', error)
        .replace('#homepage#', homepage)
        .replace('#userid#', userid)
        ;
        }
        return str;
      });
    }

    this.ShowJoinRequestError = function(t, param, ownerid, ownername, error_code) {
      var str;
      switch(error_code) {
        case hmtg.config.US_ERROR_OWNER_NO_RESPONSE:
          str = t('IDS_NO_RESPONSE_FROM_OWNER');
          break;
        case hmtg.config.US_ERROR_WRONG_USERID:
          str = t('IDS_OWNER_NOT_EXIST');
          break;
        case hmtg.config.US_ERROR_NOT_JOIN_SELF:
          str = t('IDS_CANNOT_JOIN_SELF');
          break;
        case hmtg.config.US_ERROR_NOT_ONLINE:
          str = t('IDS_OWNER_NOT_ONLINE');
          break;
        case hmtg.config.US_ERROR_MEMORY_ALLOCATION:
          str = t('IDS_ERROR_MEMORY_ALLOCATION');
          break;
        default:
          str = t('IDS_ERROR_UNKNOWN_ERROR') + '(' + error_code + ')';
          break;
      }

      _msgrHelper.ShowJoinRequestErrorMessageBox(t, param, ownerid, ownername, str);
    }

    this.ShowJoinRequestErrorMessageBox = function(t, param, ownerid, ownername, error) {
      var is_mmc = param._mmc_messenger();
      hmtgSound.ShowErrorPrompt(function() {
        var str;
        if(is_mmc) {
          str = t('IDS_FORMAT_ERROR_JOIN_REQUEST1')
        .replace('#error#', error)
        .replace('#username#', hmtg.util.decodeUtf8(ownername))
        ;
        } else {
          str = t('IDS_FORMAT_ERROR_JOIN_REQUEST2')
        .replace('#error#', error)
        .replace('#username#', hmtg.util.decodeUtf8(ownername))
        .replace('#userid#', hmtg.util.decodeUtf8(ownerid))
        ;
        }
        return str;
      });
    }

    this.CalcUserImageType = function(status, office_status) {
      if(status == hmtg.config.ONLINE_STATUS_APPEAROFF)
        return msgrIcon.ICON_INDEX_USER_OFFLINE;
      else if(status == hmtg.config.ONLINE_STATUS_BUSY)
        return msgrIcon.ICON_INDEX_USER_BUSY;
      else if(status == hmtg.config.ONLINE_STATUS_RIGHTBACK)
        return msgrIcon.ICON_INDEX_USER_AWAY;
      else if(status == hmtg.config.ONLINE_STATUS_AWAY)
        return msgrIcon.ICON_INDEX_USER_AWAY;
      else if(office_status == 2)
        return msgrIcon.ICON_INDEX_USER_IN_MEETING;
      else if(office_status)
        return msgrIcon.ICON_INDEX_USER_OPEN;
      else if(status == 0)
        return msgrIcon.ICON_INDEX_USER_OFFLINE;
      else if(status == hmtg.config.ONLINE_STATUS_MOBILE)
        return msgrIcon.ICON_INDEX_USER_MOBILE;
      else if(status == hmtg.config.ONLINE_STATUS_WEB)
        return msgrIcon.ICON_INDEX_USER_WEB;
      else
        return msgrIcon.ICON_INDEX_USER_ONLINE;
    }

    this.CalcOfficeImageType = function(param) {
      if(param._connection_status() < 10000) {
        if(!param._guest() && param._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED) {
          var status = param._us_status();
          if(status == hmtg.config.ONLINE_STATUS_ONLINE)
            status = hmtg.config.ONLINE_STATUS_WEB;
          var office_status = param._office_status();
          return _msgrHelper.CalcUserImageType(status, office_status);
        } else
          return param._mmc_messenger() ? msgrIcon.ICON_INDEX_SERVER_MMC : msgrIcon.ICON_INDEX_SERVER;
      }
      else
        return msgrIcon.ICON_INDEX_SERVER2;
    }

    this.CalcFoldedImageType = function(folded) {
      return folded ? msgrIcon.ICON_INDEX_USER_FOLDED : msgrIcon.ICON_INDEX_USER_UNFOLDED;
    }

    this.CalcOfficeFullName = function(t, param) {
      var str = '';
      if(param._guest()) {
        str = t('IDS_FORMAT_OFFICE_NAME1')
        .replace('#homepage#', hmtg.util.decodeUtf8(param._homepage()));
      } else {
        str = t('IDS_FORMAT_OFFICE_NAME2')
        .replace('#homepage#', hmtg.util.decodeUtf8(param._homepage()))
        .replace('#userid#', hmtg.util.decodeUtf8(param._username()))
        ;
      }
      return str;
    }

    this.CalcOfficeText0 = function(t, param) {
      if(param._office_name()) {
        return hmtg.util.decodeUtf8(param._office_name());
      } else {
        return this.CalcOfficeFullName(t, param);
      }
    }

    this.CalcOfficeText1 = function(t, param) {
      if(param._office_name()) {
        return hmtg.util.decodeUtf8(param._office_name()) + ' (' + this.CalcOfficeFullName(t, param) + ')';
      } else {
        return this.CalcOfficeFullName(t, param);
      }
    }

    this.CalcOfficeText = function(t, param) {
      var str = _msgrHelper.CalcOfficeText0(t, param);

      if(!param._guest() &&
		    param._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED) {
        str += ' (' + t(_msgrHelper.userstatus2id(param._us_status(), param._office_status(), 1)) + ')';

        if(param._personal_info()) {
          str += ' - ' + hmtg.util.decodeUtf8(param._personal_info());
        }
      } else if(param._guest()) {
        str += ' (' + t('IDS_GUEST') + ')';
      }
      return str;
    }
    this.CalcOfficeTooltip = function(t, param) {
      var str = _msgrHelper.CalcOfficeText1(t, param);
      str += '\n';

      if(param._guest()) {
        str += t('IDS_FORMAT_SERVER_CONNECTION_STATUS').replace("#status#", t(_msgrHelper.connectionstatus2id(param._connection_status())));
      } else if(param._connection_status() != hmtg.config.CONNECTION_STATUS_CONNECTED ||
				!param._user_info_ever_recvd()) {
        str += t('IDS_FORMAT_SERVER_CONNECTION_STATUS').replace("#status#", t(_msgrHelper.connectionstatus2id(param._connection_status())));
      } else {
        str += t('IDS_FORMAT_SERVER_CONNECTION_STATUS').replace("#status#", t(_msgrHelper.connectionstatus2id(param._connection_status())));
        if(param._disk_usage()) {
          str += '\n';
          str += t('IDS_FORMAT_DISK_SPACE_USED').replace("%d", param._disk_usage());
        }
        if(param._personal_info()) {
          str += '\n';
          str += t('IDS_PERSONAL_INFO');
          str += ': ';
          str += hmtg.util.decodeUtf8(param._personal_info());
        }
        if(param._mmc_messenger() && !param._guest()) {
          str += '\n';
          str += t('ID_INTERNAL_ID');
          str += ': ';
          str += hmtg.util.decodeUtf8(param._internal_id());
        }
      }
      if(param._connection_status() == hmtg.config.CONNECTION_STATUS_CONNECTED) {
        str += '\n' + t('ID_FORMAT_SERVER_VERSION') + ': ' + param._server_version_major() + '.' + param._server_version_minor() + '.' + param._server_version_subminor();
        var info = hmtgHelper.cipher_info(t, param._cipher_name());
        if(info) str += '\n' + t('ID_CIPHER') + ': ' + info;
      }
      return str;
    }
    this.CalcUserText = function(t, param, this_us, contact) {
      var str = hmtg.util.decodeUtf8(this_us._username());

      str += ' (' + t(_msgrHelper.userstatus2id(this_us._status(), this_us._office_status())) + ')';

      var pm = this_us._personal_info();
      if(!this_us._status() && contact) {
        pm = pm || contact.pm;
      }
      if(pm) {
        str += ' - ' + hmtg.util.decodeUtf8(pm);
      }
      return str;
    }
    this.CalcContactText = function(t, param, contact) {
      var str = hmtg.util.decodeUtf8(contact.name);

      str += ' (' + t('IDS_STATUS_OFFLINE') + ')';

      if(contact.pm) {
        str += ' - ' + hmtg.util.decodeUtf8(contact.pm);
      }
      return str;
    }
    this.CalcUserTooltip = function(t, param, this_us, contact) {
      var str = '';
      if(param._mmc_messenger()) {
        str += t('ID_INTERNAL_ID') + ': ' + hmtg.util.decodeUtf8(this_us._userid());
      } else {
        str += t('IDS_COL_USERID') + ': ' + hmtg.util.decodeUtf8(this_us._userid());
      }
      str += '\n';
      str += t('IDC_STATIC_3_USERNAME') + ': ' + hmtg.util.decodeUtf8(this_us._username());
      var pm = this_us._personal_info();
      if(!this_us._status() && contact) {
        pm = pm || contact.pm;
      }
      if(pm) {
        str += '\n';
        str += t('IDS_PERSONAL_INFO') + ' ' + hmtg.util.decodeUtf8(pm);
      }
      var st = this_us._status();
      if(st && st != hmtg.config.ONLINE_STATUS_APPEAROFF) {
        str += '\n' + t('ID_FORMAT_MESSENGER_VERSION') + ': ' + this_us._major() + '.' + this_us._minor();
      }
      return str;
    }
    this.CalcContactTooltip = function(t, param, contact) {
      var str = '';
      if(param._mmc_messenger()) {
        str += t('ID_INTERNAL_ID') + ': ' + hmtg.util.decodeUtf8(contact.id);
      } else {
        str += t('IDS_COL_USERID') + ': ' + hmtg.util.decodeUtf8(contact.id);
      }
      str += '\n';
      str += t('IDC_STATIC_3_USERNAME') + ': ' + hmtg.util.decodeUtf8(contact.name);
      if(contact.pm) {
        str += '\n';
        str += t('IDS_PERSONAL_INFO') + ' ' + hmtg.util.decodeUtf8(contact.pm);
      }
      return str;
    }

    // https://docs.angularjs.org/api/ng/filter/date
    this.get_timestring = function(type) {
      var t = new Date();
      return $filter('date')(t, (type == 1 ? 'HH:mm:ss' : ('MMM dd HH:mm:ss')));
    }
    this.get_timestring_filename = function() {
      var t = new Date();
      return $filter('date')(t, 'yyyy-MM-dd-HH-mm-ss');
    }
    this.get_timestring_im = function(delay) {
      var t = new Date();
      t = new Date(t - delay * 1000);

      return $filter('date')(t, 'yyyy/MM/dd HH:mm:ss');
    }
    this.get_timestring_im1 = function(tick) {
      var t = new Date(tick * 1000);
      return $filter('date')(t, 'HH:mm:ss');
    }
    this.get_timestring_im2 = function(tick) {
      var t = new Date(tick * 1000);
      return $filter('date')(t, 'yyyy/MM/dd HH:mm:ss');
    }
    this.get_timestring_im3 = function(tick) {
      var t = new Date(tick * 1000);
      return $filter('date')(t, 'yyyy/MM/dd HH:mm');
    }

    this.renamePgc = function($scope, param, pgc) {
      hmtgHelper.renameDialog($scope, hmtg.util.decodeUtf8(pgc._pgc_name()), $translate.instant('IDS_RENAME_PGC'), hmtg.util.decodeUtf8(pgc._full_name()), ok, 'rename_pgc', []);
      function ok(new_value) {
        hmtg.jmkernel.jm_command_PgcRename(param, pgc._group_id(), new_value);
      }
    }
    this.removePgc = function(imDlg, param, pgc) {
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_LEAVE_PGC_PROMPT'), 0, ok);
      function ok() {
        var group_id = pgc._group_id();
        hmtg.jmkernel.jm_command_PgcRemove(param, pgc);
        hmtg.jmkernel.jm_command_LeaveGroup(param, group_id);
        imDlg.callback_StopPgc(param, group_id);
      }
    }

    this.visitUser = function($scope, param, userid, username, jnagentDlg) {
      if(param._mmc_messenger()) {
        // do not visit self
        if(param._internal_id() == userid)
          return;

        if(param._guest()) {
          $rootScope.WebOfficeVisitor = {};
          $rootScope.WebOfficeVisitor.userid = username;
          $rootScope.WebOfficeVisitor.force_type = true;
          $rootScope.WebOfficeVisitor.type = 0;
          var modalInstance = $modal.open({
            templateUrl: 'template/WebOfficeVisitor.htm' + hmtgHelper.cache_param,
            scope: $rootScope,
            controller: 'WebOfficeVisitorModalCtrl',
            size: '',
            backdrop: 'static',
            resolve: {}
          });

          modalInstance.result.then(function(result) {
            hmtgHelper.inside_angular++;
            hmtg.util.localStorage['hmtg_visitor_name'] = hmtg.util.decodeUtf8(result.name);
            mmc_visit(param, userid, result.name, false);
            hmtgHelper.inside_angular--;
          }, function() {
          });
        } else {
          hmtgHelper.inside_angular++;
          mmc_visit(param, userid, '', true);
          hmtgHelper.inside_angular--;
        }
      } else {
        // do not visit self
        if(param._userid() == userid)
          return;

        if(param._guest()) {
          hmtg.util.localStorage['hmtg_saved_visitor_name'] = '';
        } else {
          hmtg.util.localStorage['hmtg_saved_visitor_name'] = hmtg.util.decodeUtf8(param._username());
        }
        hmtgHelper.inside_angular++;
        hmtg.jmkernel.jm_command_Visit(param, userid);
        hmtgHelper.inside_angular--;
      }

      function mmc_visit(param, userid, name, b_use_id) {
        jnagentDlg.RequestDlg(function() {
          return hmtg.jmkernel.jm_command_MMCVisit(param, jnagentDlg.g_unique_id, userid, name, b_use_id);
        }, function() {
          return $translate.instant('IDS_FORMAT_PREPARE_VISIT')
          .replace('#username#', hmtg.util.decodeUtf8(username))
          ;
        });
      }
    }

    this.inviteUser = function(jnagentDlg, inviter_param, invitee_param, invite_guest, userid, username, user_array) {
      if(inviter_param._quit() || invitee_param._quit()) return;
      var can_invite;
      var launch_prompt;
      var array = jnagentDlg.data;
      var i;
      for(i = 0; i < array.length; i++) {
        var param = array[i].pointer;
        if(param == inviter_param) {
          if(!param._quit()
            && !param._guest()
            && param._connection_status() < 10000
            ) {
            if(!param._office_status()) {
              launch_prompt = true;
            } else {
              can_invite = true;
            }
          }
          break;
        }
      }

      if(launch_prompt) {
        if(jnagentDlg.g_delay_inviter_param) {
          hmtg.util.log(2, "your office is not open, and there is already a deferred invitation pending. your invitation request is dropped");
          return;
        }
        hmtg.jmkernel.jm_command_LaunchOffice(inviter_param);
        jnagentDlg.g_delay_inviter_param = inviter_param;
        jnagentDlg.g_delay_invitee_param = invitee_param;
        jnagentDlg.g_delay_invite_userid = userid;
        jnagentDlg.g_delay_invite_username = username;
        jnagentDlg.g_delay_invite_guest = invite_guest;
        jnagentDlg.g_delay_invite_user_array = user_array;
        jnagentDlg.g_delay_invite_tick = hmtg.util.GetTickCount();
        jnagentDlg.g_delay_invite_internvalID = setInterval(function() {
          if(!jnagentDlg.g_delay_inviter_param) {
            clearInterval(jnagentDlg.g_delay_invite_internvalID);
            jnagentDlg.g_delay_invite_internvalID = null;
            jnagentDlg.g_delay_invitee_param = 0;
            return;
          }
          if(hmtg.util.GetTickCount() - jnagentDlg.g_delay_invite_tick > 45000) {
            hmtg.util.log(2, "your deferred invitation request is dropped because your office is not open yet after 45 seconds");
            jnagentDlg.g_delay_inviter_param = 0;
            jnagentDlg.g_delay_invitee_param = 0;
            return;
          }
          var param = jnagentDlg.g_delay_inviter_param;
          var param2 = jnagentDlg.g_delay_invitee_param;
          if(param._quit()) {
            jnagentDlg.g_delay_inviter_param = 0;
            jnagentDlg.g_delay_invitee_param = 0;
            return;
          }
          if(param._office_status()) {
            hmtg.util.log(2, "your deferred invitation request is accepted as your office is open now");
            jnagentDlg.g_delay_inviter_param = 0;
            jnagentDlg.g_delay_invitee_param = 0;
            clearInterval(jnagentDlg.g_delay_invite_internvalID);
            jnagentDlg.g_delay_invite_internvalID = null;

            // to do
            // reason to wait 1 second for MMC: MCU will notify the MMC that the meeting has started, this has delay. 
            // without this 1-second wait, the invitation may fail for MMC with error "your office is not open"
            setTimeout(function() {
              _msgrHelper.inviteUser(jnagentDlg, inviter_param, param2,
                jnagentDlg.g_delay_invite_guest, jnagentDlg.g_delay_invite_userid, jnagentDlg.g_delay_invite_username,
                jnagentDlg.g_delay_invite_user_array);
            }, (param._mmc_messenger() ? 1000 : 0));
          }
        }, 2000);
        hmtg.util.log(2, "your office is not open, your invitation request is deferred while sending the request to open your office");
        return;
      }

      if(!can_invite) return;

      if(jnagentDlg.g_delay_inviter_param)
        hmtg.util.log(2, "your deferred invitation request is dropped because of a new invitation request");
      jnagentDlg.g_delay_inviter_param = 0;

      var unique_id = hmtg.util.GetTickCount();
      jnagentDlg.g_unique_id = unique_id;
      jnagentDlg.g_iRequestStatus = 1; // ready
      if(inviter_param._mmc_messenger()) {
        hmtg.jmkernel.jm_command_MMCRequestInviteUserJnj(inviter_param, (invite_guest ? null : invitee_param), unique_id, userid, username);
      } else {
        hmtg.jmkernel.jm_command_RequestInviteUserJnj(inviter_param, invitee_param, unique_id, username);
      }

      var item = {};
      item['timeout'] = 120;
      item['update'] = function() {
        return $translate.instant('IDS_FORMAT_PREPARE_INVITE')
          .replace('#username#', hmtg.util.decodeUtf8(username))
          .replace('#inviter_office#', hmtg.util.decodeUtf8(inviter_param._name_or_homepage3()))
          ;
      };
      item['text'] = item['update']();
      item['type'] = 'success';
      item['jnj'] = '';
      item['timeout_action'] = item['cancel'] = function() {
        jnagentDlg.g_unique_id--;
        jnagentDlg.g_iRequestStatus = 4; // user quit
        jnagentDlg.g_request_item = null;
      }
      item['action'] = function(invite_jnj) {
        hmtgAlert.remove_text_item(item);
        jnagentDlg.g_request_item = null;
        (invite_guest ? hmtg.jmkernel.jm_command_InviteGuest : hmtg.jmkernel.jm_command_InviteUser)
        (inviter_param, invitee_param, invite_jnj, userid, username);

        if(!invite_guest && user_array && user_array.length) {
          userid = user_array.shift();
          username = hmtg.jmkernel.jm_info_GetUserName(invitee_param, userid);
          _msgrHelper.inviteUser(jnagentDlg, inviter_param, invitee_param,
                false, userid, username, user_array);
        }
      };

      jnagentDlg.set_text_item(item);
    }

    this.pickUser = function($scope, type, func, c1, c2) {
      $scope.c1 = c1;
      $scope.c2 = c2;
      $scope.type = type;

      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_pick_user' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/PickUser.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'PickUserModalCtrl',
          size: '',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
          func(result.id, result.name);
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_pick_user fails');
      });
    }

    this.styleIM = function($scope, im) {
      $scope.im = im;

      $ocLazyLoad.load({
        name: 'msgr',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_style' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        var modalInstance = $modal.open({
          templateUrl: 'template/Style.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'StyleModalCtrl',
          size: '',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
        }, function() {
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_style fails');
      });
    }

    this.appendWeb = function(url) {
      var pattern = new RegExp('[\\?\\&]web=1', 'i');
      if(pattern.test(url)) return url;
      if(url.indexOf('?') == -1) {
        return url + '?web=1';
      }
      return url + '&web=1';
    }
    /*
    this.appendCORS = function(url) {
    var pattern = new RegExp('[\\?\\&]webjoinnet-cors=', 'i');
    if(pattern.test(url)) return url;
    var str = encodeURIComponent(window.location.protocol + '//' + window.location.host);
    if(url.indexOf('?') == -1) {
    return url + '?webjoinnet-cors=' + str;
    }
    return url + '&webjoinnet-cors=' + str;
    }
    */
  }
])

;
