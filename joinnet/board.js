/*
 * Web JoinNet
 * Copyright © 2019, John Liu <john@homemeeting.com>
 * HomeMeeting Inc.
 */

angular.module('joinnet')

.service('board', ['$translate', 'appSetting', 'hmtgHelper', '$rootScope', 'hmtgSound', '$modal',
  'joinnetHelper', '$ocLazyLoad', 'hmtgAlert',
  function($translate, appSetting, hmtgHelper, $rootScope, hmtgSound, $modal, 
    joinnetHelper, $ocLazyLoad, hmtgAlert) {
    var _board = this;

    this.slide_list = []; // sorted slide list including all viewable slides, 'group_index' is the index of this list
    this.title_list = []; // sorted title list
    this.page_hash = {};  // group title -> active slide index, which flip to a certain group, use this hash to find the active page
    this.page_list = [];  // sorted page list
    this.slide_index = -1;  // index in jnkernel slide list
    this.title_id = '';  // id in board's title list, 3 special types: 'index', '<scroll', '>scroll', '~group'
    this.page_id = '';  // id in board's page list, 2 special types: 'page', '<scroll', '>scroll'
    this.container = document.getElementById('board_container');
    this.board0 = document.getElementById('board0');
    this.board_container2 = document.getElementById('board_container2');
    this.board_image = null;  // backgroud image
    this.canvas = document.getElementById('board'); // final board, stretched
    this.canvas2 = document.createElement("canvas");  // background image, original size for text slide only
    this.canvas3 = document.createElement("canvas");  // stretched board, without focus pointer
    this.canvas4 = document.createElement("canvas");  // stamp, original size
    this.canvas_temp = document.createElement("canvas");  // used for short-term temporary usage
    this.has_canvas_stream = !!this.canvas.captureStream;
    //this.has_action_menu = ''; // whether there is any context menu
    this.MIN_SIZE = 160;
    this.DEFAULT_SIZE = 1024;
    this.MAX_SIZE = hmtgHelper.isiOS ? 2048 : 4096;
    this.board_width = 1; // the board width on screen
    this.board_height = 1; // the board height on screen
    this.board_width_height_ratio = 1.0; // the width over height ratio of board screen area
    this.img_width = this.img_height = 1; // original image size
    this.mywidth = this.myheight = 1; // original mark size
    this.actual_width = this.actual_height = 1; // the real size of the image plus marks
    this.zoomed_width = this.zoomed_height = 1; // content zoomed size
    this.scale = 1; // scale is set only for pdf slide. it will be normally 1.0, but could be larger than 1.0 if the ratio is larger than 100%
    this.ctx = this.canvas.getContext('2d');
    this.ctx2 = this.canvas2.getContext('2d');
    this.ctx3 = this.canvas3.getContext('2d');
    this.ctx4 = this.canvas4.getContext('2d');
    this.ctx_temp = this.canvas_temp.getContext('2d');
    this.canvas2.width = this.canvas2.height = 0; // means no text
    this.canvas3.width = this.canvas3.height = this.MAX_SIZE;
    this.two_touch_last_tick = hmtg.util.GetTickCount();

    // pdf.js related
    this.pdf_stopped = false;  // whether the pdf rendering is stopped
    this.pdf_busy = false;  // whether the pdf.js is in a rendering session
    this.pdf_data = null; // the data of current render
    this.pdf_pdf = null;  // the pdf object
    this.pdf_page = null; // the page object
    this.pdf_pending_data = null; // the data of the pending render

    this.pointer_img = new Image();
    this.pointer_img.src = "img/pointer.png";
    this.draw_thread = null;
    this.img_ready = false;
    this.ratio = 1.0; // ratio displayed in GUI
    this.draw_ratio = 1.0;  // ratio used in finalDraw
    this.file_input = document.getElementById('fileInput');
    this.mark_array = [];
    this.colors = [
    // in windows, it is BGR
    // in browser, it is RGB
	    '#000000', //black
	    '#dddddd', //white
	    '#ff0000', //red
	    '#00ff00', //green
	    '#0000ff', //blue
	    '#7f0000',
	    '#007f00',
	    '#00007f',
	    '#00ffff',
	    '#ff00ff',
	    '#ffff00',
	    '#007f7f',
	    '#7f007f',
	    '#7f7f00',
	    '#ff7f7f',
	    '#7fff7f',
	    '#7f7fff',
	    '#d0d000'
    ];
    this.color_values = [
    // in windows, it is BGR
    // in browser, it is RGB
	    0x000000, //black
	    0xdddddd, //white
	    0x0000ff, //red
	    0x00ff00, //green
	    0xff0000, //blue
	    0x000007f,
	    0x007f00,
	    0x7f0000,
	    0xffff00,
	    0xff00ff,
	    0x00ffff,
	    0x7f7f00,
	    0x7f007f,
	    0x007f7f,
	    0x7f7fff,
	    0x7fff7f,
	    0xff7f7f,
	    0x00d0d0
    ];
    this.color2value = function(color) {
      var value = parseInt(color.slice(1), 16);
      if(isNaN(value)) value = 0xff0000;
      // RGB -> BGR
      var r = (value >> 16) & 0xff;
      var g = (value >> 8) & 0xff;
      var b = value & 0xff;
      return b << 16 ^ g << 8 ^ r;
    }
    // how should the mark be scaled when different pen widths are selected
    this.mark_scale = {
      1: 16,
      2: 24,
      5: 58,
      8: 84,
      12: 110,
      20: 150
    };
    // text mark height
    this.text_height = {
      1: 16,
      2: 24,
      5: 58,
      8: 84,
      12: 110,
      20: 150
    };
    this.max_single_mark_size = 100000;  // single mark upper limit, 100kB
    this.HANDLE_WIDTH = hmtgHelper.isMobile ? 20 : 8;
    this.HANDLE_HALF_WIDTH = this.HANDLE_WIDTH >> 1;
    this.HANDLE_CLOSE_SIZE = 25;

    // private note
    this.privateNote = [];  // include private marks, per-slide zoom level per-slide auto-zoom
    this.privateNoteOld = [];  // the old private note when a reconnection(or restart in playback) occurs 
    // private note entry
    function PrivateNoteEntry() {
      this.mark_array = [];
      this.ratio_pos = 100;
      this.is_auto_fit = true;
      this.nextMarkID = 1;

      // used to detect wrong cache
      this.m_iSource = -1;
      this.m_szName = '';
    }

    // local slide
    this.memory_usage = 0;
    this.local_slide_list = []; // sorted slide list including all viewable slides, 'group_index' is the index of this list
    this.local_title_list = []; // sorted title list
    this.local_page_hash = {};  // group title -> active slide index, which flip to a certain group, use this hash to find the active page
    this.local_page_list = [];  // sorted page list
    this.local_slide_index = -1;  // index in local slide list
    this.is_private = this.is_local_slide = false;
    this.jnkernel_slide_index = -1;
    this.local_slide_index = -1;
    this.localSlideArray = [];

    // _board.redownload_count should be reset when 
    // slide downloaded
    this.redownload_count = 0;

    // slide entry
    /**
     * @constructor
     */
    function SlideEntry() {
      this.m_szOwnerName = '';
      this.mark_array = [];
      this.downloaded = 0;
      this.nextMarkID = 1;
    }
    // getter
    SlideEntry.prototype['_m_iSource'] = SlideEntry.prototype._m_iSource = function() { return this.m_iSource; }
    SlideEntry.prototype['_index'] = SlideEntry.prototype._index = function() { return this.index; }
    SlideEntry.prototype['_m_szName'] = SlideEntry.prototype._m_szName = function() { return this.m_szName; }
    SlideEntry.prototype['_is_blank_page'] = SlideEntry.prototype._is_blank_page = function() { return this.is_blank_page; }
    SlideEntry.prototype['_m_bDeleted'] = SlideEntry.prototype._m_bDeleted = function() { return this.m_bDeleted; }
    SlideEntry.prototype['_downloaded'] = SlideEntry.prototype._downloaded = function() { return this.downloaded; }
    SlideEntry.prototype['_data'] = SlideEntry.prototype._data = function() { return this.data; }
    SlideEntry.prototype['_mark_array'] = SlideEntry.prototype._mark_array = function() { return this.mark_array; }
    SlideEntry.prototype['_m_szGroup'] = SlideEntry.prototype._m_szGroup = function() { return this.m_szGroup; }
    SlideEntry.prototype['_m_iGroupIndex'] = SlideEntry.prototype._m_iGroupIndex = function() { return this.m_iGroupIndex; }
    SlideEntry.prototype['_m_szOwnerName'] = SlideEntry.prototype._m_szOwnerName = function() { return this.m_szOwnerName; }
    SlideEntry.prototype['_group_id'] = SlideEntry.prototype._group_id = function() { return '' + this.m_szGroup + this.m_szOwnerName + this.m_iSource; }
    SlideEntry.prototype['_is_active'] = SlideEntry.prototype._is_active = function() { return false; }

    this.create_SendNewStroke = function(index, color, width, shape, ax, ay) {
      var mark = new MarkEntry();
      mark.m_iColor = color;
      mark.m_iIndex = index;
      mark.m_iSource = -1;
      mark.m_nPenWidth = width;
      mark.m_iShape = shape;
      mark.m_codepage = hmtg.config.UTF8_CODEPAGE;
      mark.m_byMarkType = hmtg.config.MARK_STROKE2;
      var size = ax.length;
      mark.ax = new Int32Array(size);
      mark.ay = new Int32Array(size);
      var i;
      for(i = 0; i < size; i++) {
        mark.ax[i] = ax[i];
        mark.ay[i] = ay[i];
      }
      mark.m_zoom = 100;
      mark.m_offset_x = mark.m_offset_y = 0;
      return mark;
    }

    this.private_SendNewStroke = function(index, color, width, shape, ax, ay) {
      var mark = this.create_SendNewStroke(index, color, width, shape, ax, ay);
      if(this.is_local_slide) {
        mark.m_iID = this.localSlideArray[index].nextMarkID++;
      } else {
        mark.m_iID = this.privateNote[index].nextMarkID++;
      }
      var _mark_array = this.is_local_slide ? this.localSlideArray[index].mark_array : this.privateNote[index].mark_array;
      _mark_array.push(mark);
      if(_mark_array.length == 1) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    // idArray: the array sent to MCU
    // idArray0: the original array, which will be used for local mark move
    this.create_SendMarkMove = function(index, offset_x, offset_y, move_type, idArray, idArray0) {
      var mark = new MarkEntry();
      mark.m_iIndex = index;
      mark.m_iSource = -1;
      mark.m_offset_x = offset_x;
      mark.m_offset_y = offset_y;
      mark.m_move_type = move_type;
      mark.m_zoom = 100;
      mark.m_byMarkType = hmtg.config.MARK_MOVE;
      var size = idArray.length;
      mark.id_array = new Int32Array(size);
      var i;
      for(i = 0; i < size; i++) {
        mark.id_array[i] = idArray[i];
      }
      var size0 = idArray0.length;
      mark.id_array0 = new Int32Array(size0);
      for(i = 0; i < size0; i++) {
        mark.id_array0[i] = idArray0[i];
      }
      return mark;
    }

    this.private_SendMarkMove = function(index, offset_x, offset_y, move_type, idArray) {
      var mark = new MarkEntry();
      mark.m_iIndex = index;
      mark.m_iSource = -1;
      mark.m_offset_x = offset_x;
      mark.m_offset_y = offset_y;
      mark.m_move_type = move_type;
      mark.m_zoom = 100;
      if(this.is_local_slide) {
        mark.m_iID = this.localSlideArray[index].nextMarkID++;
      } else {
        mark.m_iID = this.privateNote[index].nextMarkID++;
      }
      mark.m_codepage = hmtg.config.UTF8_CODEPAGE;
      mark.m_byMarkType = hmtg.config.MARK_MOVE;
      var size = idArray.length;
      mark.id_array = new Int32Array(size);
      var i;
      for(i = 0; i < size; i++) {
        mark.id_array[i] = idArray[i];
      }
      var _mark_array = this.is_local_slide ? this.localSlideArray[index].mark_array : this.privateNote[index].mark_array;
      _mark_array.push(mark);
      if(_mark_array.length == 1) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    this.create_SendImageMark = function(index, image_type, x, y, cx, cy, zoom, png, orig_size) {
      var header_size = image_type == 1 ? 8 : 4;
      if(header_size + png.length > 500000) {
        return null;
      }

      var mark = new MarkEntry();

      // for wait list mark
      mark.internal_point_x = x + cx;
      mark.internal_point_y = y + cy;
      mark.internal_unzipped_data = png;

      mark.m_iIndex = index;
      mark.m_iSource = -1;
      mark.m_offset_x = x;
      mark.m_offset_y = y;
      mark.m_zoom = zoom;
      mark.m_iCustomizedMarkType = image_type;
      var size = header_size + png.length;
      mark.m_iCustomizedMarkSize = size;
      mark.m_codepage = hmtg.config.UTF8_CODEPAGE;
      mark.m_byMarkType = hmtg.config.MARK_CUSTOMIZED;
      mark.m_pCustomizedMarkData = hmtg.jnkernel.jn_command_ConvertCustomizedData(image_type, x, y, cx, cy, png, orig_size);
      return mark;
    }

    this.private_SendImageMark = function(index, image_type, x, y, cx, cy, zoom, png, orig_size) {
      var header_size = image_type == 1 ? 8 : 4;
      if(header_size + png.length > 500000) {
        return 1;
      }
      var mark = this.create_SendImageMark(index, image_type, x, y, cx, cy, zoom, png, orig_size);
      if(this.is_local_slide) {
        mark.m_iID = this.localSlideArray[index].nextMarkID++;
      } else {
        mark.m_iID = this.privateNote[index].nextMarkID++;
      }
      var _mark_array = this.is_local_slide ? this.localSlideArray[index].mark_array : this.privateNote[index].mark_array;
      _mark_array.push(mark);

      // change to select mode and select this mark
      this.shape = 'select';
      setTimeout(function() {
        _board.local_mark.select_mode = false;
        _board.local_mark.select_toggle_mode = false;
        _board.local_mark.hit_type = 8;
        _board.local_mark.id_array0 = [];
        _board.local_mark.id_array = [mark.m_iID];
      }, 0);

      // change shape to select, need to update the board
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);

      // if(_mark_array.length == 1) {
      //   $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      // }
    }

    this.create_SendNewText = function(index, color, width, x, y, cx, cy, textEx) {
      if(textEx.length >= 2048) return null;
      var mark = new MarkEntry();
      mark.m_iColor = color;
      mark.m_iIndex = index;
      mark.m_iSource = -1;
      mark.m_nPenWidth = width;
      mark.m_rect_left = x;
      mark.m_rect_top = y;
      mark.m_rect_right = x + cx;
      mark.m_rect_bottom = y + cy;
      mark.m_codepage = hmtg.config.UTF8_CODEPAGE;
      mark.m_byMarkType = hmtg.config.MARK_TEXT2;
      mark.m_szContent = textEx;
      mark.m_zoom = 100;
      mark.m_offset_x = mark.m_offset_y = 0;
      return mark;
    }

    this.private_SendNewText = function(index, color, width, x, y, cx, cy, textEx) {
      if(textEx.length >= 2048) return;
      var mark = this.create_SendNewText(index, color, width, x, y, cx, cy, textEx);
      if(this.is_local_slide) {
        mark.m_iID = this.localSlideArray[index].nextMarkID++;
      } else {
        mark.m_iID = this.privateNote[index].nextMarkID++;
      }
      var _mark_array = this.is_local_slide ? this.localSlideArray[index].mark_array : this.privateNote[index].mark_array;
      _mark_array.push(mark);
      if(_mark_array.length == 1) {
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    // mark
    this.is_eraser_selectable = false;
    // shape: LINE, RECTANGLE, ELLIPSE, FREEHAND, TEXT, POLYGON, POINTER, IMAGE, HIGH_LIGHT, RECT_ERASER, MOVE, RECT_MOVEABLE_ERASER, STAMP
    this.LINE = 0;
    this.RECTANGLE = 1;
    this.ELLIPSE = 2;
    this.FREEHAND = 3;
    this.TEXT = 4;
    this.POLYGON = 5;
    this.POINTER = 6;
    this.IMAGE = 7;
    this.HIGH_LIGHT = 8;
    this.RECT_ERASER = 9;
    this.MOVE = 10;
    this.RECT_MOVEABLE_ERASER = 11;
    this.STAMP = 12;
    // mark entry
    /**
     * @constructor
     */
    function MarkEntry() {
    }
    // getter
    MarkEntry.prototype['_m_iColor'] = MarkEntry.prototype._m_iColor = function() { return this.m_iColor; }
    MarkEntry.prototype['_m_iIndex'] = MarkEntry.prototype._m_iIndex = function() { return this.m_iIndex; }
    MarkEntry.prototype['_m_iSource'] = MarkEntry.prototype._m_iSource = function() { return this.m_iSource; }
    MarkEntry.prototype['_m_nPenWidth'] = MarkEntry.prototype._m_nPenWidth = function() { return this.m_nPenWidth; }
    MarkEntry.prototype['_m_iShape'] = MarkEntry.prototype._m_iShape = function() { return this.m_iShape; }
    MarkEntry.prototype['_m_codepage'] = MarkEntry.prototype._m_codepage = function() { return this.m_codepage; }
    MarkEntry.prototype['_m_byMarkType'] = MarkEntry.prototype._m_byMarkType = function() { return this.m_byMarkType; }
    MarkEntry.prototype['_ax'] = MarkEntry.prototype._ax = function() { return this.ax; }
    MarkEntry.prototype['_ay'] = MarkEntry.prototype._ay = function() { return this.ay; }
    MarkEntry.prototype['_m_zoom'] = MarkEntry.prototype._m_zoom = function() { return this.m_zoom; }
    MarkEntry.prototype['_m_iID'] = MarkEntry.prototype._m_iID = function() { return this.m_iID; }
    MarkEntry.prototype['_m_offset_x'] = MarkEntry.prototype._m_offset_x = function() { return this.m_offset_x; }
    MarkEntry.prototype['_m_offset_y'] = MarkEntry.prototype._m_offset_y = function() { return this.m_offset_y; }
    MarkEntry.prototype['_m_rect_left'] = MarkEntry.prototype._m_rect_left = function() { return this.m_rect_left; }
    MarkEntry.prototype['_m_rect_top'] = MarkEntry.prototype._m_rect_top = function() { return this.m_rect_top; }
    MarkEntry.prototype['_m_rect_right'] = MarkEntry.prototype._m_rect_right = function() { return this.m_rect_right; }
    MarkEntry.prototype['_m_rect_bottom'] = MarkEntry.prototype._m_rect_bottom = function() { return this.m_rect_bottom; }
    MarkEntry.prototype['_m_szContent'] = MarkEntry.prototype._m_szContent = function() { return this.m_szContent; }
    MarkEntry.prototype['_m_move_type'] = MarkEntry.prototype._m_move_type = function() { return this.m_move_type; }
    MarkEntry.prototype['_id_array'] = MarkEntry.prototype._id_array = function() { return this.id_array; }
    MarkEntry.prototype['_m_iCustomizedMarkType'] = MarkEntry.prototype._m_iCustomizedMarkType = function() { return this.m_iCustomizedMarkType; }
    MarkEntry.prototype['_m_pCustomizedMarkData'] = MarkEntry.prototype._m_pCustomizedMarkData = function() { return this.m_pCustomizedMarkData; }

    /*
    data structure:
    jnkernel mark array,
    wait list mark array, these marks are sent out but not received yet. the item in the wait list mark array exist at most 20s.
    wait list undo id array, these undo ids are sent out but not received yet. the item number in the wait list undo id array has a limit of 100. more items will be discarded.

    1. normal mark.
    sending: append to wait list mark array. 
    rendering: standard rendering
    recving: if the received mark find a matching one in the wait list mark array, remove it from the wait list 

    2. 1st mark move.
    sending: append to wait list mark array.
    rendering: standard rendering
    recving: if the received mark move find a matching one in the wait list mark array, remove it from the wait list 

    3. 2nd or more mark move
    sending: use relative move and append to wait list mark array.
    rendering: relative move
    recving: if the received mark find a matching one in the wait list mark array, remove it from the wait list 

    4. undo (when there is any item in the wait list mark array)
    sending: use jn_command_UndoMark, remove the newest item from the wait list mark array

    5. undo (when there is no item in the wait list mark array)
    sending: use jn_command_GlobalUndoMark to remove the newest valid mark(not undone yet) from the mark array, append the id to the wait list undo id array
    rendering: if a mark in the mark array matches the id in the wait list undo id array, assume it has been removed, do not render it.
    recving: 
    if an undo is received, update the undo items in the wait list undo id array - the undo id should be removed from the wait list
    if a normal mark is received, clear wait list undo id array, because all the undo in the wait list will be ignored by the MCU
  
    6. status of clear/undo mark
    if there is any item in the wait list mark array; or if there is any mark in the mark array minus the wait list undo id count 
    The status should now be updated when adding mark, undo mark, receiving mark from MCU
    */

    // wait list mark
    // these marks are sent to the MCU but not received them yet
    // there are two types of wait list mark:
    // 1) new real marks, such as stroke, text, image, etc.
    // 2) mark move
    this.wait_list_mark_array = [];
    // wait list undo id
    // this id are undone but not received from MCU yet
    this.wait_list_undo_id_array = [];
    this.WAIT_LIST_TIMEOUT = 20000;

    // local mark
    // this mark is the mark being added
    this.local_mark = new MarkEntry();
    this.local_mark.m_zoom = 100;
    this.local_mark.id_array = [];
    this.local_mark2 = { link: this.local_mark, move_x: 0, move_y: 0, move_cx: 0, move_cy: 0, local_move_x: 0, local_move_y: 0, local_move_cx: 0, local_move_cy: 0 };

    this.is_fullscreen = false;
    this.request_fullscreen = this.container.requestFullscreen
      || this.container.msRequestFullscreen
      || this.container.mozRequestFullScreen
      || this.container.webkitRequestFullscreen
    ;
    // fit page auto select variables
    // is_auto_fit is set by default and when the user click the "auto select"
    // is_auto_fit is reset when the user toggle fitting, change fitting, change ratio
    this.is_auto_fit = true;  // whether current slide is using auto fit
    this.auto_fit_page = true;  // whether auto select turns on fit page
    this.auto_fit_mode = 1; // when fit page, what fit mode is used by auto select
    this.auto_ratio_pos = 100;  // when not fit page, what ratio pos is used by auto select
    this.is_fit_page = true;  // whether is fitting for current slide
    this.fit_mode = 1;  // 0: fit width; 1: fit page, which fit mode for current slide
    this.ratio_pos = 100; // current ratio pos for current slide
    this.ratio_percent = 100;
    this.min_ratio = 0.01;
    this.max_ratio = 8; // this should be consistent with the dynamic command fitxxx, such as fit800
    this.show_next_slide = false;
    this.show_prev_slide = false;
    this.show_next_group = false;
    this.show_prev_group = false;
    this.upload_finished = true;
    this.dummy_conversion = false;
    this.dummy_conversion_timerID = null;
    this.new_upload = false;
    this.support_sync_mode = hmtg.customization.support_sync_mode;
    this.is_sync = true;

    this.container.addEventListener('dragover', handleDragOver, false);
    this.container.addEventListener('drop', handleFileSelect, false);

    this.stop_dummy_conversion_timer = function() {
      if(this.dummy_conversion_timerID) {
        clearTimeout(this.dummy_conversion_timerID);
        this.dummy_conversion_timerID = null;
      }
    }

    this.net_init_finished = function() {
      this.upload_finished = true;
      this.dummy_conversion = false;
      this.stop_dummy_conversion_timer();
      this.new_upload = false;
      this.unknown_mark_warned = false;
    }

    // is_local_slide,
    // true: the slide is for local slide
    // false: the slide is for normal slide
    // this.is_local_slide,
    // true: current GUI is at local slide mode
    // false: current GUI is not at local slide mode
    this.add_slide = function(slide, is_local_slide) {
      if(slide._m_bDeleted()) return;

      var data = is_local_slide ? _board.local_slide_list : _board.slide_list;

      var target = {};
      target.ssrc = slide._m_iSource();
      // ngoptions compare this index to "", when using number, an empty item will appear.
      // force the index as string will fix the problem
      target.index = '' + slide._index();
      target.name = _board.calc_slide_name(slide);
      target.group_name = '    (' + hmtg.util.decodeUtf8(slide._m_szOwnerName()) + ')' + hmtg.util.decodeUtf8(slide._m_szGroup());
      target.width = target.height = this.DEFAULT_SIZE;
      if(!is_local_slide) {
        // for normal slide, try to pick up old per-slide zoom level and private marks
        if(this.privateNoteOld[target.index]) {
          // check whether the old info can be used.
          var szDeleted = "[Deleted]";
          var prefix_len = szDeleted.length;
          var old = this.privateNoteOld[target.index];
          var bWrong = false;

          if(old.m_iSource == target.ssrc) {
            if(old.m_szName == slide._m_szName() ||
              (old.m_szName && old.m_szName.indexOf(szDeleted) == 0 && old.m_szName.slice(prefix_len) == slide._m_szName())
            ) {
            } else {
              bWrong = true;
            }
          } else {
            bWrong = true;
          }
          if(bWrong) {
            this.privateNoteOld = [];
          }
        }
        if(this.privateNoteOld[target.index]) {
          this.privateNote[target.index] = this.privateNoteOld[target.index];
        } else {
          this.privateNote[target.index] = new PrivateNoteEntry();
        }
        this.privateNote[target.index].m_iSource = target.ssrc;
        this.privateNote[target.index].m_szName = slide._m_szName();

        target.is_auto_fit = this.privateNote[target.index].is_auto_fit;
        if(target.is_auto_fit) {
          target.is_fit_page = this.auto_fit_page;
          target.fit_mode = this.auto_fit_mode;
          target.ratio_pos = this.auto_ratio_pos;
        } else {
          target.is_fit_page = this.privateNote[target.index].is_fit_page;
          target.fit_mode = this.privateNote[target.index].fit_mode;
          target.ratio_pos = this.privateNote[target.index].ratio_pos;
        }
      } else {
        target.is_auto_fit = true;
        //target.is_fit_page = true;
        //target.ratio_pos = 100;
        target.is_fit_page = this.auto_fit_page;
        target.fit_mode = this.auto_fit_mode;
        target.ratio_pos = this.auto_ratio_pos;
      }

      // file or slide?
      var slide_type = hmtg.util.endsWith(slide._m_szName(), '.jzf') ? 1 : 0;

      if(slide_type) {
        // file
        data.push(target);
      } else {
        // slide
        var done = 0;
        if(slide._m_szGroup()) {
          var i;
          // search for existing group
          for(i = data.length - 1; i >= 0; i--) {
            if(_board.isSlideSameGroup(data[i].index, target.index, is_local_slide)) {
              // found, insert here
              done = true;
              data.splice(i + 1, 0, target);
              break;
            }
          }
        }

        if(!done) {
          // new group
          var i;
          var slide_array = is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
          // skip those files, which should always be at the end
          for(i = data.length - 1; i >= 0; i--) {
            var slide0 = slide_array[data[i].index];
            var slide0_type = hmtg.util.endsWith(slide0._m_szName(), '.jzf') ? 1 : 0;
            if(!slide0_type) break;
          }
          data.splice(i + 1, 0, target);
          var page_hash = is_local_slide ? this.local_page_hash : this.page_hash;
          page_hash[slide._group_id()] = target.index; // init the page hash
        }
      }

      // if this is the first slide, select it
      if(is_local_slide && this.is_local_slide) {
        // add slide in local slide mode
        if(this.slide_index < 0) {
          this.slide_index = target.index;
          this.local_slide_index = this.slide_index;
        }
      } else if(!is_local_slide && !this.is_local_slide) {
        // add slide in normal slide mode
        if(this.slide_index < 0) {
          this.slide_index = target.index;
          this.jnkernel_slide_index = this.slide_index;
        }
      } else if(!is_local_slide && this.is_local_slide) {
        // copy to white board
        if(this.jnkernel_slide_index < 0) {
          this.jnkernel_slide_index = target.index;
        }
      } else {
        // copy to local slide
        if(this.local_slide_index < 0) {
          this.local_slide_index = target.index;
        }
      }

      if(is_local_slide) {
        if(!slide_type // only auto flip slide for slide, not for files
          ) {
          // if this is slide of a group
          if(slide._m_szGroup()
          && this.local_slide_index >= 0
          && _board.isSlideSameGroup(this.local_slide_index, target.index, is_local_slide)
          && !this.new_upload // if new upload, allow auto flip even for slide of same group
          ) {
            // do not auto flip if the new slide is of the same group of current slide
          } else {
            this.local_slide_index = target.index;
            if(this.is_local_slide) {
              _board.local_mark.id_array = [];  // reset local mark's id array
            }
            if(slide._m_szGroup()) {
              this.local_page_hash[slide._group_id()] = target.index;
            }
            if(this.is_local_slide) {
              this.privateFlipSlide(this.local_slide_index);
              this.slide_changed(); // redraw content
            }
            this.new_upload = false;
          }
        }
      }

      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      if(!slide_type // only auto flip slide for slide, not for files
      && !this.is_local_slide
      && my_ssrc == target.ssrc
      && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        if(hmtg.jnkernel._sync_ssrc() == my_ssrc) {
          // if this is slide of a group
          if(slide._m_szGroup()
            && this.jnkernel_slide_index >= 0
            && _board.isSlideSameGroup(this.slide_index, target.index)
            && !this.new_upload // if new upload, allow auto flip even for slide of same group
            ) {
            // do not auto flip if the new slide is of the same group of current slide
          } else {
            this.jnkernel_slide_index = this.slide_index = target.index;
            _board.local_mark.id_array = [];  // reset local mark's id array
            _board.wait_list_mark_array = [];
            _board.wait_list_undo_id_array = [];
            if(slide._m_szGroup()) {
              this.page_hash[slide._group_id()] = target.index;
            }
            hmtg.jnkernel.jn_command_FlipSlide(this.slide_index);
            this.new_upload = false;
          }
        }
      }

      if(!is_local_slide) {
        // test whether this is a result of copy to board
        if(_board.copy_to_board_mark_array && target.ssrc == hmtg.jnkernel._jn_ssrc_index()) {
          if(hmtg.util.endsWith(slide._m_szName(), _board.copy_to_board_title)) {
            _board.copyMarkToBoard(target.index, _board.copy_to_board_mark_array);
            _board.copy_to_board_mark_array = null;

            if(_board.is_private) {
              _board.is_private = false;
              _board.is_local_slide = false;
            }

            if(_board.slide_index != target.index) {
              this.jnkernel_slide_index = this.slide_index = target.index;
              _board.local_mark.id_array = [];  // reset local mark's id array
              _board.wait_list_mark_array = [];
              _board.wait_list_undo_id_array = [];
              if(slide._m_szGroup()) {
                this.page_hash[slide._group_id()] = target.index;
              }
            }

            this.slide_type = -1;
            this.slide_status = 0;
            this.update_title_list();
            this.update_page_list();
            this.slide_changed();
          }
        }
      }

      if(!is_local_slide && _board.auto_download_all) {
        if(!slide._is_blank_page() && slide._downloaded() <= 0 && !hmtg.util.endsWith(slide._m_szName(), '.jzf')) {
          if(!hmtg.jnkernel.jn_info_IsSlideDownloading()) {
            //hmtg.util.log(9, '******debug, try download slide in add_slide, slide_index=' + target.index);
            _board.download_slide(target.index);
          }
        }
      }

      if((is_local_slide && this.is_local_slide) || (!is_local_slide && !this.is_local_slide)) {
        // prev/next status may change due to new slide
        _board.update_prev_next_slide_status();

        // title/page view may change due to new slide
        this.update_title_list();
        this.update_page_list();

        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    this.ssrc_get_group_title_list = function(ssrc) {
      var mylist = [];

      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      // if no slide, just return
      if(!data.length) return [];

      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var index = 0;
      while(1) {
        if(data[index].ssrc == ssrc) {
          var group = slide_array[data[index].index]._m_szGroup();
          if(group) {
            mylist.push(hmtg.util.decodeUtf8(group));
            if(mylist.length > 500) break;
          }
        }
        index = this.next_title_index(index);
        if(index == -1) break;
      }
      return mylist;
    }

    this.ssrc_get_current_groupname = function(ssrc) {
      var slide_index = this.slide_index >> 0;
      var index = slide_index2group_index(slide_index);
      if(index == -1) return '';
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(data[index].ssrc == ssrc) {
        var group = slide_array[data[index].index]._m_szGroup();
        if(group) {
          return hmtg.util.decodeUtf8(group);
        }
      }
      return '';
    }

    this.update_title_list = function() {
      // reset it first
      var title_list = [];
      this.local_title_list = this.title_list = [];

      var slide_list = this.is_local_slide ? this.local_slide_list : this.slide_list;

      // if no slide, just return
      if(!slide_list.length) return;
      var slide_index = this.slide_index >> 0;
      var base_group_index = slide_index2group_index(slide_index);
      if(base_group_index == -1) {
        base_group_index = 0;  // if not found, assume it is the first one
      }
      var data = slide_list;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var is_group = false;
      var id;
      var title_name;
      // from the current slide
      is_group = slide_array[data[base_group_index].index]._m_szGroup();
      id = (is_group ? '~' : '') + data[base_group_index].index;
      title_name = is_group ? data[base_group_index].group_name : data[base_group_index].name;
      title_list.push({ id: id, name: title_name });
      this.title_id = id; // title show this id

      // fill more from both sides
      var i;
      var prev_index = base_group_index;
      var next_index = base_group_index;
      for(i = 1; i < appSetting.max_display_item; ) {
        if(prev_index == -1 && next_index == -1) break; // no more to add
        if(prev_index != -1) {
          prev_index = this.prev_title_index(prev_index); // find previous title
          if(prev_index != -1) {
            is_group = slide_array[data[prev_index].index]._m_szGroup();
            id = (is_group ? '~' : '') + data[prev_index].index;
            title_name = is_group ? data[prev_index].group_name : data[prev_index].name;
            title_list.unshift({ id: id, name: title_name });
            i++;
            if(i >= appSetting.max_display_item) break;
          }
        }
        if(next_index != -1) {
          next_index = this.next_title_index(next_index); // find next title
          if(next_index != -1) {
            is_group = slide_array[data[next_index].index]._m_szGroup();
            id = (is_group ? '~' : '') + data[next_index].index;
            title_name = is_group ? data[next_index].group_name : data[next_index].name;
            title_list.push({ id: id, name: title_name });
            i++;
            if(i >= appSetting.max_display_item) break;
          }
        }
      }

      // check scroll
      if(prev_index != -1 && -1 != (prev_index = this.prev_title_index(prev_index))) {
        title_list.unshift({ id: '<' + data[prev_index].index, name: '...' });
      }
      if(next_index != -1 && -1 != (next_index = this.next_title_index(next_index))) {
        title_list.push({ id: '>' + data[next_index].index, name: '...' });
      }
      if(this.is_local_slide) {
        this.local_title_list = title_list;
      } else {
        this.title_list = title_list;
      }
    }

    this.update_page_list = function() {
      // reset it first
      var page_list = [];
      this.local_page_list = this.page_list = [];

      var slide_list = this.is_local_slide ? this.local_slide_list : this.slide_list;

      // if no slide, just return
      if(!slide_list.length) return;
      var slide_index = this.slide_index >> 0;
      var base_group_index = slide_index2group_index(slide_index);
      if(base_group_index == -1) {
        base_group_index = 0;  // if not found, assume it is the first one
      }
      var data = slide_list;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(!slide_array[data[base_group_index].index]._m_szGroup()) return;
      // from the current page
      var base_page = slide_array[data[base_group_index].index]._m_iGroupIndex() + 1;
      page_list.push({ id: data[base_group_index].index, name: data[base_group_index].name });
      this.page_id = data[base_group_index].index;  // page show this id

      // fill more from both sides
      var i;
      var prev_index = base_group_index;
      var next_index = base_group_index;
      for(i = 1; i < appSetting.max_display_item; ) {
        if(prev_index == -1 && next_index == -1) break;
        if(prev_index != -1) {
          prev_index = this.prev_page_index(prev_index);  // find previous page
          if(prev_index != -1) {
            page_list.unshift({ id: data[prev_index].index, name: data[prev_index].name });
            i++;
            if(i >= appSetting.max_display_item) break;
          }
        }
        if(next_index != -1) {
          next_index = this.next_page_index(next_index);  // find next page
          if(next_index != -1) {
            page_list.push({ id: data[next_index].index, name: data[next_index].name });
            i++;
            if(i >= appSetting.max_display_item) break;
          }
        }
      }

      // check scroll
      if(prev_index != -1 && -1 != (prev_index = this.prev_page_index(prev_index))) {
        page_list.unshift({ id: '<' + data[prev_index].index, name: '...' });
      }
      if(next_index != -1 && -1 != (next_index = this.next_page_index(next_index))) {
        page_list.push({ id: '>' + data[next_index].index, name: '...' });
      }
      if(this.is_local_slide) {
        this.local_page_list = page_list;
      } else {
        this.page_list = page_list;
      }
    }

    this.get_group_slide_list = function(slide_index) {
      var array = [];
      var group_index = slide_index2group_index(slide_index);
      if(group_index == -1) {
        return [];
      }
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var i;
      for(i = group_index - 1; i >= 0; i--) {
        if(!_board.isSlideSameGroup(data[i].index, slide_index)) break;
        array.push(data[i].index);
      }
      for(i = group_index + 1; i < data.length; i++) {
        if(!_board.isSlideSameGroup(data[i].index, slide_index)) break;
        array.push(data[i].index);
      }
      array.push(slide_index);
      return array;
    }

    this.prev_title_index = function(group_index) {
      if(group_index <= 0) return -1;
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var slide_index = data[group_index].index >> 0;
      var is_group = slide_array[slide_index]._m_szGroup();
      var candidate_group_index;
      var candidate_slide_index;
      if(!is_group) {
        // the previous one is also a normal title
        if(!slide_array[data[group_index - 1].index]._m_szGroup()) return group_index - 1;
        // the previous one is a group, set it as the candidate
        candidate_group_index = group_index - 1;
        candidate_slide_index = data[candidate_group_index].index;
      } else {
        // search the head of the group
        var i;
        for(i = group_index - 1; i >= 0; i--) {
          if(!slide_array[data[i].index]._m_szGroup()) return i;  // found a normal title, just return it

          if(!_board.isSlideSameGroup(data[i].index, slide_index)) {
            // found a different group, set it as the candidate
            candidate_group_index = i; ;
            candidate_slide_index = data[candidate_group_index].index;
            break;
          }
        }
        if(i < 0) return -1;  // not found
      }

      // try to find the head of the candidate group
      for(i = candidate_group_index - 1; i >= 0; i--) {
        if(!slide_array[data[i].index]._m_szGroup()
            || !_board.isSlideSameGroup(data[i].index, candidate_slide_index)) {
          return i + 1; // found
        }
      }
      return i + 1; // not found, return 0 (i must be -1)
    }

    this.next_title_index = function(group_index) {
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      if(group_index >= data.length - 1) return -1;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var slide_index = data[group_index].index >> 0;
      var is_group = slide_array[slide_index]._m_szGroup();
      if(!is_group) return group_index + 1; // for normal title, just return the next one

      // seartch the tail of the group
      var i;
      for(i = group_index + 1; i < data.length; i++) {
        if(!slide_array[data[i].index]._m_szGroup()
        || !_board.isSlideSameGroup(data[i].index, slide_index)) {
          return i; // found one, return it
        }
      }
      return -1; // not found
    }

    this.prev_page_index = function(group_index) {
      if(group_index <= 0) return -1;
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var slide_index = data[group_index].index >> 0;
      var is_group = slide_array[data[group_index - 1].index]._m_szGroup();
      if(!is_group) return -1;
      if(!_board.isSlideSameGroup(data[group_index - 1].index, slide_index)) return -1;
      return group_index - 1;
    }

    this.next_page_index = function(group_index) {
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      if(group_index >= data.length - 1) return -1;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var slide_index = data[group_index].index >> 0;
      var is_group = slide_array[data[group_index + 1].index]._m_szGroup();
      if(!is_group) return -1;
      if(!_board.isSlideSameGroup(data[group_index + 1].index, slide_index)) return -1;
      return group_index + 1;
    }

    function is_slide_compressed(name) {
      if(hmtg.util.endsWith(name, '.jcz')) return true;
      else if(hmtg.util.endsWith(name, '.jzf')) return true;
      else if(hmtg.util.endsWith(name, '.jcf')) return true;
      else if(hmtg.util.endsWith(name, '.zip')) return true;
      else if(hmtg.util.endsWith(name, '.gz')) return true;
      return false;
    }

    function calc_original_name(name) {
      if(hmtg.util.endsWith(name, '.jcz')) name = name.slice(0, name.length - 4);
      else if(hmtg.util.endsWith(name, '.jzf')) name = name.slice(0, name.length - 4);
      else if(hmtg.util.endsWith(name, '.jcf')) name = name.slice(0, name.length - 4);
      else if(hmtg.util.endsWith(name, '.zip')) name = name.slice(0, name.length - 4);
      else if(hmtg.util.endsWith(name, '.gz')) name = name.slice(0, name.length - 3);
      return name;
    }

    this.calc_slide_name = function(slide, is_active) {
      var name = hmtg.util.decodeUtf8(slide._m_szName());
      name = calc_original_name(name);

      var slide_type = hmtg.util.endsWith(slide._m_szName(), '.jzf') ? 1 : 0;

      var status = slide._downloaded();
      if(typeof is_active === 'undefined') is_active = slide._is_active();
      // * means active slide
      // = means downloaded
      // ! means download error
      if(slide._m_szGroup()) {
        // important
        // ngOptions pitfall, make sure the names are not the same with any value(e.g., slide page name use "<3>" instead of "3"). otherwise, a name change may cause ngoption to create empty item.
        name = (is_active ? '*' : '') + (status == 1 ? '=' : (status > 1 ? '!' : '')) + '<' + (slide._m_iGroupIndex() + 1) + '>';
      } else {
        name = (is_active ? '*' : '') + (status == 1 ? '=' : (status > 1 ? '!' : '')) + (slide_type ? '[' : '<') + (slide._index() + 1) + (slide_type ? ']' : '>') + name;
      }
      return name;
    }

    this.reset = function(bJoinNetLevelReset) {
      if(!this.is_local_slide) {
        this.stop_slide_drawing();
      }

      if(bJoinNetLevelReset) {
        _board.privateNoteOld = [];

        _board.is_auto_fit = true;
        _board.auto_fit_page = true;
        _board.auto_fit_mode = 1;
        _board.auto_ratio_pos = 100;
        _board.is_fit_page = true;
        _board.fit_mode = 1;
        _board.ratio_pos = 100;
      } else {
        var i;
        for(i = 0; i < _board.privateNote.length; i++) {
          _board.privateNoteOld[i] = _board.privateNote[i];
        }
      }
      _board.privateNote = [];
      _board.slide_list = [];
      _board.title_list = [];
      _board.page_list = [];
      _board.page_hash = {};
      _board.jnkernel_slide_index = -1;

      if(!this.is_local_slide) {
        _board.slide_index = -1;
        _board.title_id = '';
        _board.page_id = '';

        _board.slide_status = 0;
        _board.slide_type = -1;
        _board.show_prev_slide = false;
        _board.show_next_slide = false;
        _board.show_next_group = false;
        _board.show_prev_group = false;
        _board.show_save0 = false;
        _board.show_save = false;
        _board.show_upload_progress = false;
        _board.show_download_progress = false;
        _board.ratio_pos = 100;
        _board.ratio_percent = 100;
        _board.local_mark.id_array = [];  // reset local mark's id array
        _board.wait_list_mark_array = [];
        _board.wait_list_undo_id_array = [];

        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);

        _board.canvas.width = _board.MIN_SIZE;
        _board.canvas.height = _board.MIN_SIZE;

        _board.canvas3_ready = false; // reset the board image cache
      }
    }

    this.privateReset = function() {
      if(this.is_local_slide) {
        this.stop_slide_drawing();
      }

      _board.local_slide_list = [];
      _board.local_title_list = [];
      _board.local_page_list = [];
      _board.local_page_hash = {};
      _board.local_slide_index = -1;

      if(this.is_local_slide) {
        _board.slide_index = -1;
        _board.title_id = '';
        _board.page_id = '';

        _board.slide_status = 0;
        _board.slide_type = -1;
        _board.show_prev_slide = false;
        _board.show_next_slide = false;
        _board.show_next_group = false;
        _board.show_prev_group = false;
        _board.show_save0 = false;
        _board.show_save = false;
        _board.show_upload_progress = false;
        _board.show_download_progress = false;
        _board.ratio_pos = 100;
        _board.ratio_percent = 100;
        _board.local_mark.id_array = [];  // reset local mark's id array

        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);

        _board.canvas.width = _board.MIN_SIZE;
        _board.canvas.height = _board.MIN_SIZE;
      }
    }

    this.event_quit_session = function() {
      if(_board.upload_thread && !_board.upload_thread.is_local_slide) {
        _board.stop_upload();
      }
      _board.show_download_progress = false;
      _board.show_refresh = false;
      _board.local_mark.id_array = [];  // reset local mark's id array
      _board.wait_list_mark_array = [];
      _board.wait_list_undo_id_array = [];
      _board.copy_to_board_mark_array = null;
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
    }

    // from id to slide index
    // strict = true: scroll items return -1
    // strict = false: all items return slide index
    function id2index(id, strict) {
      if(!id) return -1;  // sanity check
      var type = id.charCodeAt(0);
      if(type == '<'.charCodeAt(0)) { // scroll
        return strict ? -1 : (id.slice(1) >> 0);
      } else if(type == '>'.charCodeAt(0)) { // scroll
        return strict ? -1 : (id.slice(1) >> 0);
      } else if(type == '~'.charCodeAt(0)) {  // group
        return id.slice(1) >> 0;
      } else {
        return id >> 0;
      }
    }

    this.slide_name_changed = function(slide_index, group_index) {
      var data = _board.slide_list;
      var slide_array = hmtg.jnkernel._jn_SlideArray();
      var is_group = slide_array[slide_index]._m_szGroup();
      var i;
      if(is_group) {
        // for group, slide name change occurs in page list
        if(!this.page_list.length) return;
        // strict = false: need slide index for all items
        if(!hmtg.jnkernel.jn_info_IsSlideSameGroup(id2index(this.page_list[0].id, false), slide_index)) return;

        for(i = 0; i < this.page_list.length; i++) {
          // strict = true, skip scroll items
          var index = id2index(this.page_list[i].id, true);
          if(-1 == index) continue; // skip scroll items
          if(slide_index < index) return; // out of range
          if(slide_index == index) {
            this.page_list[i].name = data[group_index].name;
            return;
          }
        }
      } else {
        // for normal slide, slide name change occurs in title list
        for(i = 0; i < this.title_list.length; i++) {
          // strict = true, skip scroll items
          var index = id2index(this.title_list[i].id, true);
          if(-1 == index) continue; // skip scroll items
          if(slide_index < index) return; // out of range
          if(slide_index == index) {
            this.title_list[i].name = data[group_index].name;
            return;
          }
        }
      }
    }

    // from slide index (jnkernel raw slide list) to the index of the sorted slide list
    function slide_index2group_index(slide_index) {
      if(slide_index < 0) return -1;

      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      if(data.length == 0) return -1;

      var i;
      var estimate = Math.min(slide_index, data.length - 1);
      for(i = estimate; i >= 0; i--) {
        if(data[i].index == slide_index) return i;
      }

      for(i = estimate + 1; i < data.length; i++) {
        if(data[i].index == slide_index) return i;
      }
      return -1;
    }

    //	hint :	0 change slide; 1 erase the "*"; 2 put a "*"
    this.callback_FlipSlide = function(hint, slide_index, is_local_flip) {
      var old_is_local_slide = this.is_local_slide;
      this.is_local_slide = false;
      var group_index = slide_index2group_index(slide_index);
      this.is_local_slide = old_is_local_slide;

      var data = _board.slide_list;
      var slide_array = hmtg.jnkernel._jn_SlideArray();
      if(hint) {
        if(group_index != -1) {
          data[group_index].name = _board.calc_slide_name(slide_array[slide_index], (hint == 1 ? false : true));
          this.slide_name_changed(slide_index, group_index);
          if(!this.is_local_slide) {
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
          }
        }
        return;
      }
      if(this.is_private) {
        if(slide_index >= 0 && slide_index < slide_array.length) {
          _board.jnkernel_slide_index = slide_index;
        }
        return;
      }
      if(group_index == -1) return;
      if(slide_index == _board.slide_index) return;

      if(hmtg.customization.support_sync_mode && !is_local_flip) {
        if(!this.is_sync && !this.can_force_sync()) return;
      }

      if(slide_index >= 0 && slide_index < slide_array.length) {
        // the reason to set slide index to -1 first
        // due to strange angular behavior:
        // during a playback, slide is flipped as 1 -> 2 -> 3
        // now manually flip back to 2, the slide name will show 2, but the content is still 3.
        // for this manual flip, w.slide_index is expected to change, but it doesn't occur.
        // this set slide index to -1 can get around this problem

        // seems using ng-opitons in stead of ng-repeat can fix this problem without flipping to -1 first
        //_board.slide_index = -1;
        //$rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        _board.jnkernel_slide_index = _board.slide_index = slide_index;
        _board.local_mark.id_array = [];  // reset local mark's id array
        _board.wait_list_mark_array = [];
        _board.wait_list_undo_id_array = [];
        _board.update_selected_slide();
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    this.privateFlipSlide = function(slide_index) {
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= 0 && slide_index < slide_array.length) {
        // the reason to set slide index to -1 first
        // due to strange angular behavior:
        // during a playback, slide is flipped as 1 -> 2 -> 3
        // now manually flip back to 2, the slide name will show 2, but the content is still 3.
        // for this manual flip, w.slide_index is expected to change, but it doesn't occur.
        // this set slide index to -1 can get around this problem

        // seems using ng-opitons in stead of ng-repeat can fix this problem without flipping to -1 first
        //_board.slide_index = -1;
        //$rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        this.slide_index = slide_index;
        if(this.is_local_slide) {
          this.local_slide_index = this.slide_index;
        } else {
          this.jnkernel_slide_index = this.slide_index;
        }
        this.local_mark.id_array = [];  // reset local mark's id array
        this.update_selected_slide();
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    // update title/page view from the slide_index
    this.update_selected_slide = function() {
      var slide_index = this.slide_index;
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var title_list = this.is_local_slide ? this.local_title_list : this.title_list;
      var page_list = this.is_local_slide ? this.local_page_list : this.page_list;
      var page_hash = this.is_local_slide ? this.local_page_hash : this.page_hash;
      var is_group = slide_array[slide_index]._m_szGroup();
      var i;
      // try to find existing ones
      if(is_group) {
        // for group
        page_hash[slide_array[slide_index]._group_id()] = slide_index;
        // strict = false: need slide index for all items
        if(page_list.length && _board.isSlideSameGroup(id2index(page_list[0].id, false), slide_index)) {
          // current page is the group, only need to update the page
          for(i = 0; i < page_list.length; i++) {
            // strict = true, skip scroll items
            var index = id2index(page_list[i].id, true);
            if(-1 == index) continue; // skip scroll items
            if(slide_index < index) break;  // out of range
            if(slide_index == index) {
              this.page_id = page_list[i].id;
              return;
            }
          }
        } else {
          // current page is not the same group, need to update the title first
          for(i = 0; i < title_list.length; i++) {
            // strict = true, skip scroll items
            var index = id2index(title_list[i].id, true);
            if(-1 == index) continue; // skip scroll items
            if(slide_index < index) break; // out of range
            if(slide_array[index]._m_szGroup() && _board.isSlideSameGroup(index, slide_index)) {
              this.title_id = title_list[i].id;  // update the title
              this.update_page_list();  // redraw the page
              return;
            }
          }
        }
      } else {
        // for normal slide, always update the title
        for(i = 0; i < title_list.length; i++) {
          // strict = true, skip scroll items
          var index = id2index(title_list[i].id, true);
          if(-1 == index) continue; // skip scroll items
          if(slide_index < index) break; // out of range
          if(slide_index == index) {
            this.title_id = title_list[i].id;  // update the title
            if(page_list.length) {
              if(this.is_local_list) {
                this.local_page_list = [];  // reset the page list
              } else {
                this.page_list = [];  // reset the page list
              }
            }
            return;
          }
        }
      }
      // not found
      // strict = false: need slide index for all items
      if(is_group && page_list.length && _board.isSlideSameGroup(id2index(page_list[0].id, false), slide_index)) {
        // current page is the group, only need to update the page
        this.update_page_list();
      } else {
        // update both title and page
        this.update_title_list();
        this.update_page_list();
      }
    }

    // respond to slide change
    this.slide_changed = function() {
      var slide_index = _board.slide_index >> 0;
      _board.local_mark.id_array = [];  // reset local mark's id array
      _board.wait_list_mark_array = [];
      _board.wait_list_undo_id_array = [];

      // prev/next status may change due to current slide index change
      _board.update_prev_next_slide_status();

      _board.show_save = _board.show_save0 = _board.show_refresh = false;
      _board.stop_importing();  // must stop mark importing before reset mark array
      _board.mark_array = [];
      _board.img_ready = false;

      if(_board.delay_slide_change_timerID) {
        clearTimeout(_board.delay_slide_change_timerID);  // cancel scheduled drawing
      }
      // schedule the drawing 1s later
      _board.delay_slide_change_timerID = setTimeout(function() {
        _board.delay_slide_change_timerID = null;
        action();
      }, 200);

      function action() {
        var group_index = slide_index2group_index(_board.slide_index);
        if(group_index == -1) {
          _board.canvas.width = _board.MIN_SIZE;
          _board.canvas.height = _board.MIN_SIZE;
          _board.draw_slide();
          return;
        }
        if(!_board.is_private && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
          if(hmtg.jnkernel._is_sync_ssrc()) {
            hmtg.jnkernel.jn_command_FlipSlide(slide_index);
          }
        }

        var slide_list = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
        var slide_array = _board.is_local_slide ? _board.localSlideArray : hmtg.jnkernel._jn_SlideArray();

        _board.is_auto_fit = slide_list[group_index].is_auto_fit;
        var old = _board.ratio_pos;
        if(_board.is_auto_fit) {
          _board.is_fit_page = _board.auto_fit_page;
          _board.fit_mode = _board.auto_fit_mode;
          _board.ratio_pos = _board.auto_ratio_pos;
        } else {
          _board.is_fit_page = slide_list[group_index].is_fit_page;
          _board.fit_mode = slide_list[group_index].fit_mode;
          _board.ratio_pos = slide_list[group_index].ratio_pos;
        }
        _board.ratio = _board.ratio_pos / 100;

        _board.draw_slide();

        _board.slide_type = -1;
        _board.slide_status = 0;
        if(slide_index < 0) return;
        if(slide_index >= slide_array.length) return;
        var slide = slide_array[slide_index];
        _board.slide_type = hmtg.util.endsWith(slide._m_szName(), '.jzf') ? 1 : 0;
        _board.show_save = (_board.is_local_slide || !hmtg.jnkernel._jn_disable_save_slide()) && (_board.slide_type == 0);

        if(!slide._is_blank_page() && !slide._m_bDeleted()) {
          if(slide._downloaded() == 1) {
            _board.show_save0 = _board.is_local_slide || !hmtg.jnkernel._jn_disable_save_slide();
          }
          if(appSetting.show_advanced_function && !_board.is_local_slide && hmtg.jnkernel._jn_bConnected()) _board.show_refresh = true;
        }

        if(!_board.is_local_slide) {
          if(slide._is_blank_page() || slide._m_bDeleted() || slide._downloaded() > 0) {
            _board.slide_status = slide._downloaded();

            //hmtg.util.log(9, '******debug, try auto download in slide_changed, slide_index=' + slide_index + ',group_index=' + group_index);
            if(_board.memory_usage + hmtg.jnkernel._memory_usage() < appSetting.max_blob * 1048576) {
              _board.auto_download(group_index, group_index);
            }
          } else {
            //hmtg.util.log(9, '******debug, try download slide in slide_changed, slide_index=' + slide_index);
            _board.download_slide(slide_index);
          }
        }

        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    this.title_selection_changed = function() {
      var id = this.title_id;
      if(!id) return; // sanity check
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var page_hash = this.is_local_slide ? this.local_page_hash : this.page_hash;
      var type = id.charCodeAt(0);
      if(type == '<'.charCodeAt(0)) { // scroll
        this.slide_index = id.slice(1) >> 0;
        if(slide_array[this.slide_index]._m_szGroup()) {
          this.slide_index = page_hash[slide_array[this.slide_index]._group_id()];
        }
        this.update_title_list(); // for scroll, need to redraw title
      } else if(type == '>'.charCodeAt(0)) { // scroll
        this.slide_index = id.slice(1) >> 0;
        if(slide_array[this.slide_index]._m_szGroup()) {
          this.slide_index = page_hash[slide_array[this.slide_index]._group_id()];
        }
        this.update_title_list(); // for scroll, need to redraw title
      } else if(type == '~'.charCodeAt(0)) {  // group
        this.slide_index = id.slice(1) >> 0;
        this.slide_index = page_hash[slide_array[this.slide_index]._group_id()];
      } else {
        this.slide_index = id >> 0;
      }
      if(this.is_local_slide) {
        this.local_slide_index = this.slide_index;
      } else {
        this.jnkernel_slide_index = this.slide_index;
      }
      _board.update_page_list();  // when title changes, must redraw page
      _board.slide_changed(); // redraw content
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
    }

    this.page_selection_changed = function() {
      var id = this.page_id;
      if(!id) return; // sanity check
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var page_hash = this.is_local_slide ? this.local_page_hash : this.page_hash;
      var type = id.charCodeAt(0);
      if(type == '<'.charCodeAt(0)) { // scroll
        this.slide_index = id.slice(1) >> 0;
        page_hash[slide_array[this.slide_index]._group_id()] = this.slide_index;
        this.update_page_list();  // for scroll, need to redraw page
      } else if(type == '>'.charCodeAt(0)) { // scroll
        this.slide_index = id.slice(1) >> 0;
        page_hash[slide_array[this.slide_index]._group_id()] = this.slide_index;
        this.update_page_list();  // for scroll, need to redraw page
      } else {
        this.slide_index = id >> 0;
        if(this.is_local_slide) {
          this.local_slide_index = this.slide_index;
        } else {
          this.jnkernel_slide_index = this.slide_index;
        }
        page_hash[slide_array[this.slide_index]._group_id()] = this.slide_index;
        this.slide_changed(); // redraw content
        // no need to redraw other parts, just return
        return;
      }
      if(this.is_local_slide) {
        this.local_slide_index = this.slide_index;
      } else {
        this.jnkernel_slide_index = this.slide_index;
      }
      this.slide_changed(); // redraw content
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
    }

    // group_index is the one that just finished downloading
    // current_group_index is the one that board is viewing
    this.auto_download = function(group_index, current_group_index) {
      if(_board.is_local_slide) return;
      var slide_array = hmtg.jnkernel._jn_SlideArray();
      if(_board.auto_download_all) {
        if(group_index == -1) group_index = 0;  // start from beginning if necessary
        var i;
        for(i = 0; i < _board.slide_list.length; i++) { // check every slide
          var new_group_index = group_index + i;
          if(new_group_index >= _board.slide_list.length) new_group_index -= _board.slide_list.length;
          slide_index = _board.slide_list[new_group_index].index;
          if(slide_index >= slide_array.length) continue;
          slide = slide_array[slide_index];
          if(slide._is_blank_page() || slide._m_bDeleted() || slide._downloaded() > 0 || hmtg.util.endsWith(slide._m_szName(), '.jzf')) continue;
          //hmtg.util.log(9, '******debug, try download slide in auto_download(all), slide_index=' + slide_index);
          _board.download_slide(slide_index);
          return;
        }
      } else if(hmtg.jnkernel._jn_auto_download_next()) {
        if(group_index == -1) return;
        group_index++;  // move to next slide of the one that just finished downloading
        if(group_index >= _board.slide_list.length) return;
        if(group_index != current_group_index && group_index != (current_group_index + 1)) return;  // if not current or next one, return
        slide_index = _board.slide_list[group_index].index;
        if(slide_index >= slide_array.length) return;
        slide = slide_array[slide_index];
        if(slide._is_blank_page() || slide._m_bDeleted() || slide._downloaded() > 0 || hmtg.util.endsWith(slide._m_szName(), '.jzf')) return;
        //hmtg.util.log(9, '******debug, try download slide in auto_download(next), slide_index=' + slide_index);
        _board.download_slide(slide_index);
      }
    }

    this.download_slide = function(slide_index) {
      if(_board.is_local_slide) return;
      if(!hmtg.jnkernel._jn_bConnected()) return;
      var data = _board.slide_list;
      var slide_array = hmtg.jnkernel._jn_SlideArray();
      var slide = slide_array[slide_index];
      // at the beginning of the download
      // reset download error to not downloaded
      if(slide._downloaded() == -1) {
        _board.slide_status = 0;
      }
      var func = slide_index == (_board.slide_index >> 0) ? hmtg.jnkernel.jn_command_DownloadSlideEx : hmtg.jnkernel.jn_command_DownloadSlide;
      func(slide_index, function() {
        var old_is_local_slide = _board.is_local_slide;
        _board.is_local_slide = false;
        var current_index = _board.slide_index >> 0;
        var current_group_index = slide_index2group_index(current_index);
        var group_index = slide_index2group_index(slide_index);
        //hmtg.util.log(9, '******debug, download slide OK, slide_index=' + slide_index + ',group_index=' + group_index);
        if(group_index != -1) {
          data[group_index].name = _board.calc_slide_name(slide); // put "=" to the slide name
          _board.slide_name_changed(slide_index, group_index);
        }
        _board.redownload_count = 0;
        _board.is_local_slide = old_is_local_slide;

        //hmtg.util.log(-1, '******debug, download success for slide index ' + slide_index);
        _board.show_download_progress = false;
        if(!_board.is_local_slide && slide_index == current_index) {  // if this is the current slide, update button and draw the content
          _board.slide_status = slide._downloaded();
          _board.show_save0 = !hmtg.jnkernel._jn_disable_save_slide();
          if(appSetting.show_advanced_function) _board.show_refresh = true;

          _board.draw_slide();
        }
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);

        if(!_board.is_local_slide) {
          //hmtg.util.log(9, '******debug, try auto download in download complete, slide_index=' + slide_index + ',group_index=' + group_index + ',current_slide_index=' + current_index + ',current_group_index=' + current_group_index);
          if(_board.memory_usage + hmtg.jnkernel._memory_usage() < appSetting.max_blob * 1048576) {
            _board.auto_download(group_index, current_group_index);
          }
        }
      }, function(pos) {
        //hmtg.util.log(-1, '******debug, download pos for slide index ' + slide_index + ': ' + pos);
        _board.show_download_progress = true;
        var p = (pos * 1000) >>> 0;
        _board.download_pos = '' + (p / 10) + '%';
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }, function() {
        var old_is_local_slide = _board.is_local_slide;
        _board.is_local_slide = false;
        var current_index = _board.slide_index >> 0;
        var group_index = slide_index2group_index(slide_index);
        //hmtg.util.log(9, '******debug, download slide fails, slide_index=' + slide_index + ',group_index=' + group_index);
        if(group_index != -1) {
          data[group_index].name = _board.calc_slide_name(slide); // put "!" to slide name
          _board.slide_name_changed(slide_index, group_index);
        }
        _board.show_download_progress = false;
        if(slide_index == current_index) {  // if this is the current slide, update button status
          _board.slide_status = slide._downloaded();
          if(appSetting.show_advanced_function) _board.show_refresh = true;
        }
        //hmtg.util.log(-1, '******debug, download fail for slide index ' + slide_index);
        //hmtg.util.log(-1, (new Error('******debug, jn_command_DownloadSlide stack trace')).stack);
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);

        // if still connected, and there is less than 100 tries,
        // auto-redownload the slide
        // but only auto-redownload when this is the current slide
        if(hmtg.jnkernel._jn_bConnected() && slide_index == current_index) {
          // _board.redownload_count should be reset when 
          // slide downloaded
          if(_board.redownload_count < 10) {
            _board.redownload_count++;
            _board.download_slide(slide_index);
          } else {
            hmtg.util.log('downloading slide ' + slide_index + ' fails 10 times, stop trying.');
          }
        }
        _board.is_local_slide = old_is_local_slide;
      });
    }

    this.stop_download = function() {
      _board.show_download_progress = false;
      //hmtg.util.log(9, '******debug, stop slide downloading');
      hmtg.jnkernel.jn_command_StopSlideDownload();
    }

    this.decide_min_size = function() {
      var offsetWidth;
      var offsetHeight;
      // the following assumes that board0's offset parent is container or that board0 and container share the same offset parent
      var board0_offset_left = _board.board0.offsetLeft;
      if(_board.board0.offsetParent != _board.container) {
        board0_offset_left = _board.board0.offsetLeft - _board.container.offsetLeft;
      }
      offsetWidth = Math.max((hmtgHelper.view_port_width >> 3), Math.min(hmtgHelper.view_port_width, _board.container.clientWidth) - board0_offset_left - 40); // leave at lease 40px space at right

      /*
      var board0_offset_top = _board.board0.offsetTop;
      if(_board.board0.offsetParent != _board.container) {
      board0_offset_top = _board.board0.offsetTop - _board.container.offsetTop;
      }
      // not used
      offsetHeight = Math.max((hmtgHelper.view_port_height >> 3), Math.min(hmtgHelper.view_port_height, _board.container.clientHeight) - board0_offset_top - 203);  // should be consistent with style_max_height
      */

      var board0_offset_bottom = 0;
      /*
      var bar = document.getElementById('bottom_bar');
      if(bar) {
      board0_offset_bottom = bar.offsetHeight + 12; // adjustment of 12 is from testing
      } else {
      board0_offset_bottom = 0;
      }
      */
      /*
      if(_board.board0.offsetParent != _board.container) {
      board0_offset_bottom = _board.container.offsetTop + _board.container.clientHeight - (_board.board0.offsetTop + _board.board0.clientHeight);
      } else {
      board0_offset_bottom = _board.container.clientHeight - (_board.board0.offsetTop + _board.board0.clientHeight);
      }
      board0_offset_bottom = Math.max(0, board0_offset_bottom);
      */
      // restricted_height is defined in JoinNetCtrl->adjust_height(). should use the same parameters
      var restricted_height = _board.is_fullscreen ?
        hmtgHelper.view_port_height
        :
        Math.max(hmtgHelper.view_port_height * 0.5, hmtgHelper.view_port_height - 203);
      // need leave enough space to make bottom image bar visible (for blank page)
      var offsetHeight2 = Math.max((hmtgHelper.view_port_height >> 2),
        restricted_height - (board0.offsetTop + board0.clientTop) - board0_offset_bottom -
        60  // reserve ~1.5 line of bar at the bottom
      );

      //return { w: offsetWidth, h: Math.max(offsetHeight, offsetHeight2) };
      return { w: offsetWidth, h: offsetHeight2 };
    }

    var myheight = 100;
    var mywidth = 100;
    this.decide_min_size2 = function() {
      // the following assumes that board0's offset parent is container or that board0 and container share the same offset parent
      var board0_offset_left = _board.board0.offsetLeft;
      var board0_offset_top = _board.board0.offsetTop;
      if(_board.board0.offsetParent != _board.container) {
        board0_offset_left = _board.board0.offsetLeft - _board.container.offsetLeft;
        board0_offset_top = _board.board0.offsetTop - _board.container.offsetTop;
      }
      var bottom_space = 0;
      if(!appSetting.board_hide_toolbar && appSetting.can_show_bottom_image_bar && _board.shape == 'image') {
        bottom_space = 40;
      }
      var right_space = 0;
      if(!appSetting.board_hide_toolbar && !appSetting.has_type_color) right_space = 40;

      if(_board.is_fullscreen) {
        myheight = hmtgHelper.view_port_height - board0_offset_top - bottom_space - 1;
        mywidth = hmtgHelper.view_port_width - board0_offset_left - right_space - 1;
      } else {
        var offset = {};
        hmtg.util.calcOffset(_board.board0, offset);
        if(offset.y) {
          myheight = Math.max(((hmtgHelper.view_port_height >> 1) + (hmtgHelper.view_port_height >> 3)), hmtgHelper.view_port_height - offset.y - bottom_space - 1);
          mywidth = Math.max((hmtgHelper.view_port_width >> 3), Math.min(hmtgHelper.view_port_width, _board.container.clientWidth) - board0_offset_left - right_space - 1);
        }
      }
      return { w: mywidth, h: myheight };
    }

    this.stop_importing = function() {
      if(_board.mark_importing_thread) {
        _board.mark_importing_thread.stop();  // stop current drawing thread
        _board.mark_importing_thread = null;
      }
    }
    this.stop_slide_drawing = function() {
      if(_board.draw_thread) {
        _board.draw_thread.stop();  // stop current drawing thread
        _board.draw_thread = null;
      }
      if(_board.delay_draw_timerID) {
        clearTimeout(_board.delay_draw_timerID);  // cancel scheduled drawing
        _board.delay_draw_timerID = null;
      }
    }

    this.draw_threadid = 0;
    this.inside_draw_slide = 0; // to avoid draw slide re-entry
    this.draw_slide = function(quick_draw) {
      if(this.inside_draw_slide) return;
      if(_board.draw_thread) {
        // if this is a quick draw and canvas3 is not ready and there is an existing drawing thread
        // no need to stop and schedue another drawing:
        // because the current drawing will cover the quick draw request later in finalDraw
        if(quick_draw && !_board.canvas3_ready) return;

        _board.draw_thread.stop();  // stop current drawing thread
        _board.draw_thread = null;
      }
      if(!quick_draw) {
        _board.canvas3_ready = false;
      }
      if(_board.delay_draw_timerID) {
        clearTimeout(_board.delay_draw_timerID);  // cancel scheduled drawing
      }
      // schedule the drawing 10ms later
      // many events may trigger slide drawing, to avoid CPU waste by consecutive drawing,
      // scheduled drawing is used here
      _board.delay_draw_timerID = setTimeout(function() {
        _board.delay_draw_timerID = null;
        // this thread use synchronuous assignment, 
        // must move the assignment of draw_thread to the start of constructor function
        //_board.draw_thread =
        new draw(_board.slide_index >> 0, quick_draw);
      }, 10);
    }

    // quick_draw: if true, only call finalDraw if canvas3 is ready.
    function draw(slide_index, quick_draw) {
      var _draw = this;
      // assign draw_thread at the start of the constructor function
      _board.draw_thread = this;

      // board drawing procedure:
      // load image and get image size if necessary
      // startDraw: clear canvas3
      // calcMark: convert jnkernel mark array to local array, apply mark move, get mark initial position and max point, 
      //           for text mark, calc char width array
      //           for customized mark, unzip data
      // sizeMark: get the total max point for the after-move marks, determine temp_ratio
      // drawMark: draw marks on canvas3, stretch marks using temp_ratio
      // finishDraw: stretch image under marks on canvas3, draw edge if necessary
      // finalDraw: set board draw_ratio and ratio using temp_ratio; copy image from canvas3 to final canvas; draw focuspointer, local eraser, local focus pointer, local hover image/text etc. on final canvas
      // note, 
      // 1) ratio change in sizeMark should be in drawing only until reaching finalDraw, where it is set to board ratio
      // 2) finalDraw operate on the final canvas, should not be interrupted to avoid flashing in GUI
      // 3) when there is no change on marks, no change on ratio, and canvas3 is ready, should start a quick draw using finalDraw

      // unit
      // there are three units for coordinate used in drawing
      // protocol level, used in sending and receiving
      // image level, the original non-stretched image level unit: image_level = protocol_level * 100 / zoom
      // canvas level, may be stretched: canvas_level = image_level * ratio = protocol_level * 100 / zoom * ratio

      // temp_ratio is the ratio used between sizeMark and finalDraw
      // it is set to _board.draw_ratio and _board.ratio in finalDraw.
      var temp_ratio = _board.ratio;

      _draw.id = _board.draw_threadid++;
      //hmtg.util.log(-2, '******debug, start draw thread ' + _draw.id);
      if(!quick_draw) {
        _board.canvas3_ready = false;
      } else if(_board.canvas3_ready) {
        finalDraw();
        return;
      }

      var canvas = _board.canvas;
      var ctx = _board.ctx;
      var canvas2 = _board.canvas2;
      var ctx2 = _board.ctx2;
      var canvas3 = _board.canvas3;
      var ctx3 = _board.ctx3;
      var slide_list = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var slide_array = _board.is_local_slide ? _board.localSlideArray : hmtg.jnkernel._jn_SlideArray();

      _draw.stop = function() {
      }  // nothing to stop at first

      var group_index = slide_index2group_index(slide_index);
      if(group_index == -1) {
        canvas.width = _board.MIN_SIZE;
        canvas.height = _board.MIN_SIZE;
        _board.draw_thread = null;
        return;
      }

      if(slide_index < 0 || slide_index >= slide_array.length) {
        canvas.width = _board.MIN_SIZE;
        canvas.height = _board.MIN_SIZE;
        _board.draw_thread = null;
        return;
      }

      var target = slide_list[group_index];
      var slide = slide_array[slide_index];
      var _mark_array = slide._mark_array();  // raw mark array from jnkernel
      if(!_board.is_local_slide && _board.is_private) _mark_array = _board.privateNote[slide_index].mark_array;

      var min_size = _board.decide_min_size2();
      min_size.w -= 40;
      min_size.h -= 40;
      //_board.mywidth = Math.min(_board.MAX_SIZE, min_size.w);
      //_board.myheight = Math.min(_board.MAX_SIZE, min_size.h);
      _board.mywidth = _board.myheight = 1;
      _board.actual_width = _board.actual_height = 1;

      if(!_board.is_local_slide) {
        if(!slide._is_blank_page() && slide._downloaded() == 1 && !hmtg.util.endsWith(slide._m_szName(), '.jzf')) {
          var name = slide._m_szName().toLowerCase();
          if(hmtg.util.endsWith(name, '.pdf')) {
            if(_board.is_fit_page || _board.scale != _board.ratio) {
              // if the pdf scale need to be changed, redraw the image
              // or, if fitting page, always redraw
              _board.img_ready = false;
            }
          }
        }
      }

      // is image ready(loaded)?
      if(_board.img_ready) {
        startDraw();  // start drawing immediately
      } else {
        // need to load image
        _board.canvas2.width = _board.canvas2.height = 0;
        _board.board_image = null;

        var img_data = slide._data(); // image data
        // only need to load image for downloaded non-blank slides
        if(!slide._is_blank_page() && slide._downloaded() == 1 && !hmtg.util.endsWith(slide._m_szName(), '.jzf')) {
          var name = slide._m_szName().toLowerCase();
          var type;
          if(hmtg.util.endsWith(name, '.jpg') || hmtg.util.endsWith(name, '.jpeg')) {
            type = 'image/jpeg';
          } else if(hmtg.util.endsWith(name, '.gif')) {
            type = 'image/gif';
          } else if(hmtg.util.endsWith(name, '.svg')) {
            type = 'image/svg+xml';
          } else if(hmtg.util.endsWith(name, '.png')) {
            type = 'image/png';
          } else if(hmtg.util.endsWith(name, '.pdf')) {
            draw_pdf_slide(img_data, true);
            return;
          } else if(hmtg.util.endsWith(name, '.txt')) {
            draw_text_slide(img_data, true);
            return;
          } else if(hmtg.util.endsWith(name, '.txt.jcz')) {
            // need unzip first
            var unzip = new hmtgHelper.decompress('unzip', img_data, function(output) {
              draw_text_slide(output, true);
            }, function() {
              _board.slide_status = 999;
              _board.inside_draw_slide++;
              $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
              _board.inside_draw_slide--;

              hmtg.util.log(-2, '******debug, txt slide unzip fails for slide index ' + slide_index + ',zipped_len=' + img_data.length + ',first_byte=' + img_data[0] + ',last_byte=' + img_data[img_data.length - 1]);
              _draw.stop = function() {
              }
              _board.img_width = 0; // _board.MIN_SIZE;
              _board.img_height = 0; // _board.MIN_SIZE;

              _board.img_ready = true;

              startDraw();
            });
            // the following line require that the above thread MUST take asynchronous onfinish
            _draw.stop = function() {
              unzip.stop();
              _draw.stop = function() {
              }
            }
            return;
          } else if(hmtg.util.endsWith(name, '.jcz')) {
            type = 'image'; // zipped image, let browser auto detect
            // jcz images need unzip first
            var unzip = new hmtgHelper.decompress('unzip', img_data, function(output) {
              draw_image(output, type);
            }, function() {
              _board.slide_status = 999;
              _board.inside_draw_slide++;
              $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
              _board.inside_draw_slide--;

              hmtg.util.log(-2, '******debug, bmp slide unzip fails for slide index ' + slide_index + ',zipped_len=' + img_data.length + ',first_byte=' + img_data[0] + ',last_byte=' + img_data[img_data.length - 1]);
              _draw.stop = function() {
              }  // nothing to stop as the unzip thread finished
              _board.img_width = 0; // _board.MIN_SIZE;
              _board.img_height = 0; // _board.MIN_SIZE;

              _board.img_ready = true;  // although failed to unzip, still need to set the flag so that further drawing can skip unziping.

              startDraw();
            });
            // the following line require that the above thread MUST take asynchronous onfinish
            _draw.stop = function() {
              unzip.stop(); // how to stop drawing
              _draw.stop = function() {
              }  // reset, do not stop unzip twice
            }
            return;
          } else {
            type = 'image'; // unknown type, let browser auto detect
          }

          if(type) {
            draw_image(img_data, type);
            return;
          }
        }

        var defaultWidth;
        var defaultHeight;
        // in function draw()
        // the width and height is adjusted off 40 from the return value of decide_min_size2()
        // here, we also need to adjust off 40 to reach 100% ratio under fitpage setting
        var scrollbar_adjustment = 40;
        if(_board.board_width >= _board.board_height) {
          defaultWidth = Math.min(_board.board_width - scrollbar_adjustment, _board.MAX_SIZE * 0.6);
          defaultHeight = Math.min(_board.board_height - scrollbar_adjustment, defaultWidth * _board.board_height / _board.board_width);
        } else {
          defaultHeight = Math.min(_board.board_height - scrollbar_adjustment, _board.MAX_SIZE * 0.6);
          defaultWidth = Math.min(_board.board_width - scrollbar_adjustment, defaultHeight * _board.board_width / _board.board_height);
        }
        defaultWidth = Math.max(_board.MIN_SIZE, defaultWidth);
        defaultHeight = Math.max(_board.MIN_SIZE, defaultHeight);
        _board.img_width = defaultWidth >> 1 << 1;
        _board.img_height = defaultHeight >> 1 << 1;

        // max 1024
        _board.img_width = Math.min(_board.img_width, _board.DEFAULT_SIZE);
        _board.img_height = Math.min(_board.img_height, _board.DEFAULT_SIZE);
        startDraw();
      }

      // draw image to canvas2
      function draw_image(img_data, type) {
        var blob;
        var url;
        try {
          if(img_data.length > appSetting.max_blob * 1048576) {
            onerror();
            return;
          }
          blob = new Blob([img_data], { type: type });
          url = window.URL.createObjectURL(blob);
        } catch(e) {
          onerror();
          return;
        }
        function onerror() {
          _board.img_width = 0; // _board.MIN_SIZE;
          _board.img_height = 0; // _board.MIN_SIZE;
          _board.img_ready = true;

          startDraw();
        }
        var img = new Image();
        var aborted = false;
        function img_onload() {
          window.URL.revokeObjectURL(url);
          if(aborted) return;
          _board.board_image = img;
          _board.img_width = img.width;
          _board.img_height = img.height;

          _board.img_ready = true;

          startDraw();
        }
        function img_onerror() {
          window.URL.revokeObjectURL(url);
          if(aborted) return;

          onerror();
        }

        img.addEventListener("load", img_onload, false);
        img.addEventListener("error", img_onerror, false);
        img.src = url;

        _draw.stop = function() {
          aborted = true;
          window.URL.revokeObjectURL(url);  // how to stop drawing
          //img.removeEventListener("load", img_onload, false);
          //img.removeEventListener("error", img_onerror, false);
          _draw.stop = function() {
          }  // do not stop twice
        }
      }

      // find target from data array from position 'pos'
      function indexOfChar(data, target, pos) {
        var i;
        for(i = pos; i < data.length; i++) {
          if(data[i] == target) return i;
        }
        return -1;
      }

      // draw text
      function draw_text_slide(text_data0, try_load_encoding) {
        var text_slide_stopped = false;
        // https://github.com/polygonplanet/encoding.js
        if(try_load_encoding && !(window.Encoding && Encoding.detect && typeof Encoding.detect == 'function')) {
          $ocLazyLoad.load('lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/_codepage_encoding' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param).then(function() {
            if(!text_slide_stopped) draw_text_slide(text_data0);
          }, function(e) {
            hmtg.util.log(-1, 'Warning! lazy_loading _codepage_encoding fails');
            if(!text_slide_stopped) draw_text_slide(text_data0);
          });
          _draw.stop = function() {
            text_slide_stopped = true;
            _draw.stop = function() {
            }  // reset, do not stop unzip twice
          }
          return;
        }

        _board.canvas2.width = _board.canvas2.height = _board.MAX_SIZE; // indicate text slide

        // there are two possible encoding in the text data
        // one is utf8 encoding
        // the other is utf16 encoding
        var need_decodeUtf8 = true;
        var text_data = text_data0;
        var detected = Encoding.detect(text_data);
        if(detected != 'UTF8' && detected != 'UTF16') {
          text_data = Encoding.convert(text_data0, { to: 'UTF8', type: 'arraybuffer' });
        } else {
          if(text_data0.length >= 2) {
            if(((text_data0[0] == 0xff && text_data[1] == 0xfe) || detected == 'UTF16') // utf16 encoding
              && !(text_data0.length % 2)) {
              text_data = new Int16Array(text_data0.buffer);
              need_decodeUtf8 = false;
            }
          }
        }

        var text;
        var ft_height = 17;
        ctx2.font = '' + (ft_height * 0.838) + "px 'Microsoft Sans Serif','Verdana','YuGothic','Hiragino Kaku Gothic ProN','Meiryo','Sans Serif'";  // choose the font

        var compensate_y = -0.23; // compensate the ascent of the first line
        var line = 1;
        var newline = '\n'.charCodeAt(0);
        var idx;
        var width, height;
        var max = 0;
        var pos = 0;
        var MAX_CHAR_PER_LINE = 4096;
        while(pos < text_data.length && ft_height * (line - 1) <= _board.MAX_SIZE) {
          idx = indexOfChar(text_data, newline, pos);
          if(idx == -1) {
            text = hmtg.util.array2str(text_data.subarray(pos, pos + Math.min(text_data.length - pos, MAX_CHAR_PER_LINE)));
            if(need_decodeUtf8) text = hmtg.util.decodeUtf8(text);
            width = ctx2.measureText(text).width;
            max = Math.max(max, width);
            ctx2.fillText(text, 0, ft_height * (line + compensate_y));
            break;
          } else {
            if(idx != pos) {
              text = hmtg.util.array2str(text_data.subarray(pos, pos + Math.min(idx - pos, MAX_CHAR_PER_LINE)));
              if(need_decodeUtf8) text = hmtg.util.decodeUtf8(text);
              width = ctx2.measureText(text).width;
              max = Math.max(max, width);
              ctx2.fillText(text, 0, ft_height * (line + compensate_y));
            }
            pos = idx + 1;
            line++;
          }
        }

        _board.img_width = Math.ceil(max);

        max = ft_height * (line + 0.5);
        _board.img_height = Math.ceil(max);

        if(_board.img_width > _board.MAX_SIZE) {
          hmtgHelper.drawEdge(ctx2, '#000000', _board.MAX_SIZE - 3, 0, _board.MAX_SIZE - 3, _board.MAX_SIZE);
        }
        if(_board.img_height > _board.MAX_SIZE) {
          hmtgHelper.drawEdge(ctx2, '#000000', 0, _board.MAX_SIZE - 3, _board.MAX_SIZE, _board.MAX_SIZE - 3);
        }

        _board.img_ready = true;

        startDraw();
      }

      function draw_pdf_slide(pdf_data0, try_load_pdf) {
        var pdf_slide_stopped = false;
        // https://mozilla.github.io/pdf.js/
        if(try_load_pdf && !(window.PDFJS && PDFJS.getDocument && typeof PDFJS.getDocument == 'function')) {
          $ocLazyLoad.load('lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/_pdf' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param).then(function() {
            PDFJS.workerSrc = 'worker/pdf.worker.js';
            if(!pdf_slide_stopped) draw_pdf_slide(pdf_data0);
          }, function(e) {
            hmtg.util.log(-1, 'Warning! lazy_loading _pdf fails');
            _board.img_width = 0; // _board.MIN_SIZE;
            _board.img_height = 0; // _board.MIN_SIZE;
            _board.img_ready = true;

            startDraw();
          });
          _draw.stop = function() {
            pdf_slide_stopped = true;
            _draw.stop = function() {
            }  // reset, do not stop unzip twice
          }
          return;
        }

        if(!(window.PDFJS && PDFJS.getDocument && typeof PDFJS.getDocument == 'function')) {
          _board.img_width = 0; // _board.MIN_SIZE;
          _board.img_height = 0; // _board.MIN_SIZE;
          _board.img_ready = true;

          startDraw();
          return;
        }

        // any new request will clear the stopped flag
        //console.log('new pdf request, stopped to false');
        _board.pdf_stopped = false;
        if(_board.pdf_busy) {
          //console.log('new pdf request, busy, set pdf_pending_data');
          _board.pdf_pending_data = pdf_data0;
          _board.draw_thread = null;
          return;
        }

        _board.pdf_busy = true;
        //console.log('new pdf request, set busy flag');
        _draw.stop = function() {
          //console.log('stop pdf');
          _board.pdf_stopped = true;
          _board.pdf_pending_data = null;
          _draw.stop = function() {
          }
        }
        if(pdf_data0 !== _board.pdf_data) {
          _board.pdf_data = pdf_data0;
          _board.pdf_pdf = null;
          _board.pdf_page = null;
        }

        if(_board.pdf_page) {
          //console.log('use cache page');
          handle_page(_board.pdf_page);
        } else if(_board.pdf_pdf) {
          //console.log('use cache pdf');
          handle_pdf(_board.pdf_pdf);
        } else {
          //console.log('load doc');
          PDFJS.getDocument({ data: pdf_data0 }).then(handle_pdf).catch(handle_error);
        }

        function handle_pdf(pdf) {
          _board.pdf_pdf = pdf;
          //console.log('handle pdf');
          if(_board.pdf_stopped) {
            // this session must have been stopped
            _board.pdf_busy = false;
            //console.log('handle pdf, clear busy');
            return;
          }
          if(_board.pdf_pending_data) {
            _board.pdf_busy = false;
            //console.log('handle pdf, fast forward to pending pdf');
            _board.pdf_pending_data = null;
            _board.draw_thread = null;
            _board.draw_slide();
          } else {
            // continue
            pdf.getPage(1).then(handle_page).catch(handle_error);
          }
        }

        function handle_page(page) {
          _board.pdf_page = page;
          //console.log('handle page');
          if(_board.pdf_stopped) {
            // this session must have been stopped
            _board.pdf_busy = false;
            //console.log('handle page, clear busy');
            return;
          }
          if(_board.pdf_pending_data) {
            _board.pdf_busy = false;
            //console.log('handle page, fast forward to pending pdf');
            _board.pdf_pending_data = null;
            _board.draw_thread = null;
            _board.draw_slide();
          } else {
            // continue
            var viewport = page.getViewport(1);
            _board.img_height = viewport.height >>> 0;
            _board.img_width = viewport.width >>> 0;
            var scale = _board.ratio;
            _board.scale = scale;
            viewport = page.getViewport(scale);

            // Prepare canvas using PDF page dimensions
            var canvas = _board.canvas2;
            var context = _board.ctx2;
            canvas.height = viewport.height >>> 0;
            canvas.width = viewport.width >>> 0;

            // Render PDF page into canvas context
            var renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            var renderTask = page.render(renderContext);
            //console.log('record render task');
            renderTask.then(function() {
              _board.pdf_busy = false;
              //console.log('render task done');

              if(_board.pdf_stopped) {
                // this session must have been stopped
                //console.log('render task done, stopped');
                return;
              }
              
              if(_board.pdf_pending_data) {
                //console.log('render task done, fast forward to pending pdf');
                _board.pdf_pending_data = null;
                _board.draw_thread = null;
                _board.draw_slide();
              } else {
                _board.img_ready = true;

                startDraw();
              }
            }).catch(handle_error);
          }
        }

        function handle_error() {
          _board.pdf_busy = false;
          //console.log('clear render task in error handling');

          if(_board.pdf_stopped) {
            // this session must have been stopped
            //console.log('stopped in error handling');
            return;
          }


          if(_board.pdf_pending_data) {
            //console.log('fast forward pdf in error handling');
            _board.pdf_pending_data = null;
            _board.draw_thread = null;
          }
          // render an empty image
          _board.img_width = 0; // _board.MIN_SIZE;
          _board.img_height = 0; // _board.MIN_SIZE;
          _board.img_ready = true;
          startDraw();
        }
      }

      function startDraw() {
        // clear canvas3
        ctx3.clearRect(0, 0, _board.MAX_SIZE, _board.MAX_SIZE);

        // calculate marks
        var calc_mark_thread = new calcMark(function() {
          sizeMark(); // what is the next action
        });
        // the following line require that the above thread MUST take asynchronous onfinish
        _draw.stop = function() {
          calc_mark_thread.stop();  // how to stop drawing
          _draw.stop = function() {
          }  // do not stop twice
        }
      }

      function calcMark(onfinish) {
        var _calcMark = this;
        var i = 0;
        var k = 0;
        var calc_intervalID = setInterval(convert_mark, 0);

        // how to stop drawing
        function normal_stop() {
          clearInterval(calc_intervalID);
          _calcMark.stop = function() {
          }
        }

        _calcMark.stop = normal_stop;

        function convert_mark() {
          var start_tick = hmtg.util.GetTickCount();
          // go through each mark
          for(; i < _mark_array.length; i++) {
            if(hmtg.util.GetTickCount() - start_tick >= 10) return; // yield CPU to browser
            var _mark = _mark_array[i];
            var type = _mark._m_byMarkType();
            if(_board.wait_list_undo_id_array.length && _board.wait_list_undo_id_array.indexOf(_mark._m_iID()) != -1) continue;
            if(i < _board.mark_array.length) {
              if(_board.mark_array[i].link == _mark) {
                // there is already existing local mark.
                // check whether the customized mark has unzipped data
                // if not, unzip it now
                var mark = _board.mark_array[i];
                if(type != hmtg.config.MARK_MOVE) {
                  mark.local_move_x = mark.local_move_y = mark.local_move_cx = mark.local_move_cy = 0;
                }
                if(type == hmtg.config.MARK_CUSTOMIZED) {
                  var type2 = _mark._m_iCustomizedMarkType();
                  if((type2 == 1 || type2 == 4 || type2 == 5) && !mark.unzipped_data) {
                    request_unzip_customized_mark(mark, type2);
                    return;
                  }
                }
                continue;
              }
              else {
                _board.stop_importing();  // must stop mark importing before remove items from the mark array
                _board.mark_array.splice(i, _board.mark_array.length);  // not match, discard all following local mark data
              }
            }
            var mark = { move_x: 0, move_y: 0, move_cx: 0, move_cy: 0, local_move_x: 0, local_move_y: 0, local_move_cx: 0, local_move_cy: 0 };
            mark.link = _mark;
            _board.mark_array.push(mark); // create a new local mark and append to the local mark array

            var zoom = _mark._m_zoom();

            if(type == hmtg.config.MARK_MOVE) { // mark move
              var x = _mark._m_offset_x();
              var y = _mark._m_offset_y();
              var move_type = _mark._m_move_type();
              //hmtg.util.log(-2, '******debug, x=' + x + ',y=' + y + ',zoom=' + zoom + ',type=' + move_type);

              var relative_move = false;
              if(move_type >= 100) {
                move_type -= 100;
                relative_move = true;
              }
              if(move_type >= 0 && move_type <= 8) {
                x *= 100 / zoom;
                y *= 100 / zoom;
                var j;
                var id_array = _mark._id_array();
                for(j = 0; j < id_array.length; j++) {
                  if(relative_move) {
                    relative_move_mark(id_array[j], move_type, x, y);  // relative move each mark
                  } else {
                    move_mark(id_array[j], id_array[j + 1], i, move_type, x, y);  // move each mark
                  }
                }
              }

              continue;
            }

            if(type == hmtg.config.MARK_STROKE || type == hmtg.config.MARK_STROKE2) {
              var ax = _mark._ax();
              if(ax.length) {
                var ay = _mark._ay();

                var max_x = Math.max.apply(null, ax) * 100 / zoom;
                var max_y = Math.max.apply(null, ay) * 100 / zoom;
                var min_x = Math.min.apply(null, ax) * 100 / zoom;
                var min_y = Math.min.apply(null, ay) * 100 / zoom;

                // mark region
                mark.x = min_x;
                mark.y = min_y;
                mark.cx = max_x - min_x;
                mark.cy = max_y - min_y;

                // max x and y
                var pw = _mark._m_nPenWidth();
                var half_pw = (pw + 1) >> 1;

                if(_board.ensure_visible && _board.ensure_visible.mark == _mark) {
                  _board.ensure_visible.mark = null;
                  _board.ensure_visible.x = min_x - half_pw;
                  _board.ensure_visible.y = min_y - half_pw;
                  _board.ensure_visible.cx = max_x + half_pw - _board.ensure_visible.x;
                  _board.ensure_visible.cy = max_y + half_pw - _board.ensure_visible.y;
                }

                mark.max_x = max_x + Math.max(_board.HANDLE_HALF_WIDTH, half_pw);
                mark.max_y = max_y + Math.max(_board.HANDLE_HALF_WIDTH, half_pw);
              }
            } else if(type == hmtg.config.MARK_TEXT || type == hmtg.config.MARK_TEXT2) {
              var x = _mark._m_rect_left();
              var y = _mark._m_rect_top();
              var x2 = _mark._m_rect_right();
              var y2 = _mark._m_rect_bottom();
              //mark.x = x * 100 / zoom;
              //mark.y = y * 100 / zoom;
              //mark.cx = (x2 - x) * 100 / zoom;
              //mark.cy = (y2 - y) * 100 / zoom;

              if(_board.ensure_visible && _board.ensure_visible.mark == _mark) {
                _board.ensure_visible.mark = null;
                _board.ensure_visible.x = x * 100 / zoom;
                _board.ensure_visible.y = y * 100 / zoom;
                _board.ensure_visible.cx = x2 * 100 / zoom - _board.ensure_visible.x;
                _board.ensure_visible.cy = y2 * 100 / zoom - _board.ensure_visible.y;
              }

              // max x and y
              mark.max_x = x2 * 100 / zoom + _board.HANDLE_HALF_WIDTH;
              mark.max_y = y2 * 100 / zoom + _board.HANDLE_HALF_WIDTH;

              var text = _mark._m_szContent();
              var i2;
              for(i2 = 0; i2 < text.length; i2++) {
                if(!text.charCodeAt(i2)) {
                  break;
                }
              }
              if(i2 == text.length) {  // char width info not found
                mark.text = hmtg.util.decodeUtf8(text);
              } else {
                mark.text = hmtg.util.decodeUtf8(text.slice(0, i2));
                // extract char width info
                try {
                  var width = [];
                  var len = text.length - i2 - 1;
                  var data = new Uint8Array(text.length - i2 - 1);
                  var j;
                  for(j = 0; j < len; j++) {
                    data[j] = text.charCodeAt(i2 + 1 + j);
                  }

                  var height_buffer = new Float32Array(1);
                  var height_view = new Uint8Array(height_buffer.buffer);
                  for(j = 0; j < 4; j++) {
                    height_view[j] = data[j];
                  }
                  var height = height_buffer[0];
                  for(j = 4; j < len; j++) {
                    if(data[j] == 255) {
                      var t = 0;
                      t |= data[j + 1];
                      t |= (data[j + 2] << 8);
                      width.push(data[j] + t);
                      j += 2;
                    } else {
                      width.push(data[j]);
                    }
                  }
                  mark.height = height;
                  mark.width_array = width;

                  //hmtg.util.log(-2, '******debug, text=' + mark.text + ',len=' + mark.text.length + ',height=' + mark.height + ',width_size=' + width.length);
                } catch(e) {
                }
              }

            } else if(type == hmtg.config.MARK_CUSTOMIZED) {
              var type2 = _mark._m_iCustomizedMarkType();
              if((type2 == 1 || type2 == 4 || type2 == 5) && !mark.unzipped_data) {
                request_unzip_customized_mark(mark, type2);
                return;
              }
            }
          }

          // if there are more local mark than jnkernel marks, delete them (there must a undo or clear mark event)
          if(i < _board.mark_array.length) {
            _board.stop_importing();  // must stop mark importing before remove items from the mark array
            _board.mark_array.splice(i, _board.mark_array.length);
          }

          if(!board.is_private) {
            for(; k < _board.wait_list_mark_array.length; k++) {
              if(hmtg.util.GetTickCount() - start_tick >= 10) return; // yield CPU to browser
              var _mark = _board.wait_list_mark_array[k];
              var type = _mark._m_byMarkType();
              if(type == hmtg.config.MARK_MOVE) { // mark move
                var x = _mark._m_offset_x();
                var y = _mark._m_offset_y();
                var move_type = _mark._m_move_type();
                //hmtg.util.log(-2, '******debug, x=' + x + ',y=' + y + ',zoom=' + zoom + ',type=' + move_type);

                if(move_type >= 100) move_type -= 100;
                if(move_type >= 0 && move_type <= 8) {
                  var j;
                  var id_array = _mark.id_array0;
                  for(j = 0; j < id_array.length; j++) {
                    local_move_mark(id_array[j], move_type, x, y);  // local move each mark
                  }
                }
                continue;
              }
            }
          }

          // converting is done, clear the interval
          clearInterval(calc_intervalID);
          applyLocalMove();
          onfinish();

          function applyLocalMove() {
            if(_board.drag_idx == -1) return;
            if(_board.drag_idx != _board.slide_index) return;
            if(_board.shape != 'select') return;
            var mark = _board.local_mark;
            if(mark.select_mode) return;

            var x = (mark.ax[1] - mark.ax[0]) >> 0;
            var y = (mark.ay[1] - mark.ay[0]) >> 0;
            if(!x && !y) return;

            var j;
            var id_array = mark.id_array;
            for(j = 0; j < id_array.length; j++) {
              local_move_mark(id_array[j], mark.hit_type, x, y);  // local move each mark
            }
          }

          function request_unzip_customized_mark(mark, type2) {
            i++;  // keep index valid
            clearInterval(calc_intervalID); // stop converting
            var unzip_thread = new unzip_customized_mark(mark, type2, function() {
              calc_intervalID = setInterval(convert_mark, 0); // restart converting
              _calcMark.stop = normal_stop; // restore stop action
            });
            // the following line require that the above thread MUST take asynchronous onfinish
            _calcMark.stop = function() {
              unzip_thread.stop();  // how to stop drawing
              _calcMark.stop = function() {
              }
            }
          }
        }

        // id: the mark id of the target mark to be moved
        // id0: the mark id of the reference move
        // _idx: the index of the jnkernel raw mark array item that is being processed
        // move_type: move type of the move
        // x,y: the value of the move
        function move_mark(id, id0, _idx, move_type, x, y) {
          var i;
          // find the mark to move using id
          for(i = 0; i < _board.mark_array.length; i++) {
            var mark = _board.mark_array[i];
            if(mark.link._m_iID() == id) {
              var type = mark.link._m_byMarkType();
              // if the target is a mark move, ignore the action
              if(type == hmtg.config.MARK_MOVE) return;

              if(id0) {
                check_reference_move(mark);
              } else {
                // without reference move, move from origin
                mark.move_x = mark.move_y = mark.move_cx = mark.move_cy = 0;
              }
              move_single_mark(mark, move_type, x, y);
            }
          }

          function move_single_mark(mark, move_type, x, y) {
            // 0 4 1
            // 7 8 5
            // 3 6 2
            // 825613470
            if(move_type == 8) {
              mark.move_x += x;
              mark.move_y += y;
            } else if(move_type == 2) { // bottom right
              mark.move_cx += x;
              mark.move_cy += y;
            } else if(move_type == 5) { // right
              mark.move_cx += x;
            } else if(move_type == 6) { // bottom
              mark.move_cy += y;
            } else if(move_type == 1) { // top right
              mark.move_y += y;
              mark.move_cx += x;
              mark.move_cy -= y;
            } else if(move_type == 3) { // bottom left
              mark.move_x += x;
              mark.move_cx -= x;
              mark.move_cy += y;
            } else if(move_type == 4) { // top
              mark.move_y += y;
              mark.move_cy -= y;
            } else if(move_type == 7) { // left
              mark.move_x += x;
              mark.move_cx -= x;
            } else if(move_type == 0) { // top left
              mark.move_x += x;
              mark.move_y += y;
              mark.move_cx -= x;
              mark.move_cy -= y;
            }
          }

          // check reference move
          function check_reference_move(mark) {
            var i;
            // search from the previous raw mark of current raw mark array item
            for(i = _idx - 1; i >= 0; i--) {
              var _mark = _mark_array[i];
              var this_id = _mark._m_iID();
              if(this_id < id0) {
                // reference move not found, move from origin
                mark.move_x = mark.move_y = mark.move_cx = mark.move_cy = 0;
                break;
              }
              if(this_id == id0) {
                var type = _mark._m_byMarkType();
                if(type == hmtg.config.MARK_MOVE) {
                  // reference move found
                  // try to reverse move if necessary
                  var j;
                  // search from the previous raw mark of current raw mark array item
                  // until the reference move
                  for(j = _idx - 1; j >= 0; j--) {
                    _mark = _mark_array[j];
                    this_id = _mark._m_iID();
                    if(this_id <= id0) break; // reverse move finish when reference move is reached
                    var type = _mark._m_byMarkType();
                    if(type != hmtg.config.MARK_MOVE) continue; // ignore the marks that are not move
                    var id_array = _mark._id_array();
                    var found = false;
                    var k;
                    for(k = 0; k < id_array.length; k++) {
                      if(id_array[k] == id) {
                        found = true;
                        break;
                      }
                    }
                    if(!found) continue;  // ignore mark move that doesn't apply to the target mark
                    var reverse_x = _mark._m_offset_x();
                    var reverse_y = _mark._m_offset_y();
                    var reverse_move_type = _mark._m_move_type();
                    // reverse the move that occurs after the reference move
                    move_single_mark(mark, reverse_move_type, -reverse_x, -reverse_y);
                  }
                } else {
                  // reference move found, but not a mark move, this should never occur
                  // move from origin
                  mark.move_x = mark.move_y = mark.move_cx = mark.move_cy = 0;
                }
                break;
              }
            }
          }
        }

        function relative_move_mark(id, relative_move_type, x, y) {
          var i;
          // find the mark to relative_move using id
          for(i = 0; i < _board.mark_array.length; i++) {
            var mark = _board.mark_array[i];
            if(mark.link._m_iID() == id) {
              // 0 4 1
              // 7 8 5
              // 3 6 2
              // 825613470
              if(relative_move_type == 8) {
                mark.move_x += x;
                mark.move_y += y;
              } else if(relative_move_type == 2) { // bottom right
                mark.move_cx += x;
                mark.move_cy += y;
              } else if(relative_move_type == 5) { // right
                mark.move_cx += x;
              } else if(relative_move_type == 6) { // bottom
                mark.move_cy += y;
              } else if(relative_move_type == 1) { // top right
                mark.move_y += y;
                mark.move_cx += x;
                mark.move_cy -= y;
              } else if(relative_move_type == 3) { // bottom left
                mark.move_x += x;
                mark.move_cx -= x;
                mark.move_cy += y;
              } else if(relative_move_type == 4) { // top
                mark.move_y += y;
                mark.move_cy -= y;
              } else if(relative_move_type == 7) { // left
                mark.move_x += x;
                mark.move_cx -= x;
              } else if(relative_move_type == 0) { // top left
                mark.move_x += x;
                mark.move_y += y;
                mark.move_cx -= x;
                mark.move_cy -= y;
              }
            }
          }
        }

        function local_move_mark(id, local_move_type, x, y) {
          var i;
          // find the mark to local_move using id
          for(i = 0; i < _board.mark_array.length; i++) {
            var mark = _board.mark_array[i];
            if(mark.link._m_iID() == id) {
              // 0 4 1
              // 7 8 5
              // 3 6 2
              // 825613470
              if(local_move_type == 8) {
                mark.local_move_x += x;
                mark.local_move_y += y;
              } else if(local_move_type == 2) { // bottom right
                mark.local_move_cx += x;
                mark.local_move_cy += y;
              } else if(local_move_type == 5) { // right
                mark.local_move_cx += x;
              } else if(local_move_type == 6) { // bottom
                mark.local_move_cy += y;
              } else if(local_move_type == 1) { // top right
                mark.local_move_y += y;
                mark.local_move_cx += x;
                mark.local_move_cy -= y;
              } else if(local_move_type == 3) { // bottom left
                mark.local_move_x += x;
                mark.local_move_cx -= x;
                mark.local_move_cy += y;
              } else if(local_move_type == 4) { // top
                mark.local_move_y += y;
                mark.local_move_cy -= y;
              } else if(local_move_type == 7) { // left
                mark.local_move_x += x;
                mark.local_move_cx -= x;
              } else if(local_move_type == 0) { // top left
                mark.local_move_x += x;
                mark.local_move_y += y;
                mark.local_move_cx -= x;
                mark.local_move_cy -= y;
              }
            }
          }
        }

        function unzip_customized_mark(mark, type2, onfinish) {
          //var tick = hmtg.util.GetTickCount();
          var _unzip_customized_mark = this;
          var _mark = mark.link;
          var len = _mark._m_pCustomizedMarkData().length;
          var header_size = (type2 == 1) ? 8 : 4;
          if(len <= header_size) {
            // asynchronously call is necessary here
            hmtgHelper.async_finish(_unzip_customized_mark, onfinish);
            return;
          }

          var data = new Uint8Array(len);
          for(var i = 0; i < len; ++i) {
            data[i] = _mark._m_pCustomizedMarkData().charCodeAt(i);
          }

          if(type2 == 1 || type2 == 5) {  // get position information
            var t = 0;
            t |= data[0];
            t |= (data[1] << 8);
            mark.point_x = t;
            t = 0;
            t |= data[2];
            t |= (data[3] << 8);
            mark.point_y = t;
          }
          if(type2 == 5) {
            mark.unzipped_data = data.subarray(header_size); // point to png data directly
            // asynchronously call is necessary here
            hmtgHelper.async_finish(_unzip_customized_mark, onfinish);
            //tick = hmtg.util.GetTickCount() - tick;
            //hmtg.util.log(-1, '******debug, tick3=' + tick);
            return;
          }

          var thread = new hmtgHelper.decompress('unzip', data.subarray(header_size), function(output) {
            if(output.length < 4) {
              onfinish();
              return;
            }
            mark.is_32bit_bmp = false;
            // construct a bmp file from the unzippped data
            var bmp = new Uint8Array(14 + output.length);
            bmp.set(output, 14);
            bmp[0] = 'B'.charCodeAt(0);
            bmp[1] = 'M'.charCodeAt(0);

            var file_size = 14 + output.length;
            bmp[2] = file_size & 0xff;
            bmp[3] = (file_size >> 8) & 0xff;
            bmp[4] = (file_size >> 16) & 0xff;
            bmp[5] = (file_size >> 24) & 0xff;

            // figure the offset
            var bitmap_header_size = output[0] ^ output[1] << 8 ^ output[2] << 16 ^ output[3] << 24;
            var offset = bitmap_header_size + 14;
            if(bitmap_header_size >= 40) {
              var bitcount = output[14] ^ output[15] << 8;
              mark.is_32bit_bmp = bitcount == 32; // 32bit bmp contain alpha channel
              if(bitcount <= 8) {
                var color_count = output[32] ^ output[33] << 8 ^ output[34] << 16 ^ output[35] << 24;
                if(color_count == 0) color_count = 1 << bitcount;
                offset += color_count * 4;
              }
            }
            bmp[10] = offset & 0xff;
            bmp[11] = (offset >> 8) & 0xff;
            bmp[12] = (offset >> 16) & 0xff;
            bmp[13] = (offset >> 24) & 0xff;

            mark.bmp_data_offset = offset;
            mark.unzipped_data = bmp; // the unzipped data now contain a bmp file
            //tick = hmtg.util.GetTickCount() - tick;
            //hmtg.util.log(-1, '******debug, tick2=' + tick);
            onfinish();
          }, function() {
            onfinish();
          });

          _unzip_customized_mark.stop = function() {
            thread.stop();
            _unzip_customized_mark.stop = function() {
            }
          }
        }
      }

      // measure the slide/mark's max_x and max_y by each mark
      function sizeMark() {
        var size_mark_thread = new sizeMarkThread(function() {
          if(slide._is_blank_page()) {
            if(_board.myheight && _board.mywidth
              && (_board.mywidth > _board.img_width || _board.myheight > _board.img_height)) {
              var myratio = _board.mywidth / _board.myheight;
              if(myratio > _board.board_width_height_ratio) {
                _board.myheight = (_board.mywidth / _board.board_width_height_ratio) >>> 0;
              } else {
                _board.mywidth = (_board.myheight * _board.board_width_height_ratio) >>> 0;
              }
            }
          }

          // at most grow to 1024x1024
          _board.mywidth = Math.max(_board.img_width, Math.min(_board.mywidth, _board.DEFAULT_SIZE));
          _board.myheight = Math.max(_board.img_height, Math.min(_board.myheight, _board.DEFAULT_SIZE));

          // calc temp_ratio
          _board.actual_width = Math.max(_board.actual_width, _board.mywidth, _board.img_width);
          _board.actual_height = Math.max(_board.actual_height, _board.myheight, _board.img_height);

          _board.mywidth = Math.max(_board.mywidth, _board.img_width);
          _board.myheight = Math.max(_board.myheight, _board.img_height);

          // calculate display area
          /*
          var offsetWidth = hmtgHelper.view_port_width >> 1;
          var offsetHeight = hmtgHelper.view_port_height >> 1;
          if(_board.board0.offsetWidth && _board.board0.offsetHeight) {
          if(_board.is_fullscreen) {
          offsetWidth = Math.min(hmtgHelper.view_port_width, Math.max(hmtgHelper.view_port_width - 110, _board.board0.offsetWidth));
          offsetHeight = Math.min(hmtgHelper.view_port_height, Math.max(hmtgHelper.view_port_height - 60, _board.board0.offsetHeight));
          } else {
          offsetWidth = Math.min(hmtgHelper.view_port_width, Math.max(hmtgHelper.view_port_width * .1, _board.board0.offsetWidth * .9));
          offsetHeight = Math.min(hmtgHelper.view_port_height, Math.max(hmtgHelper.view_port_height * .8, _board.board0.offsetHeight * .9));
          }
          offsetWidth = Math.min(_board.MAX_SIZE, offsetWidth);
          offsetHeight = Math.min(_board.MAX_SIZE, offsetHeight);
          }
          */
          var offsetWidth = min_size.w;
          var offsetHeight = min_size.h;

          var ratio = _board.max_ratio;

          ratio = Math.min(ratio, offsetWidth / _board.mywidth);
          if(_board.fit_mode) {
            ratio = Math.min(ratio, offsetHeight / _board.myheight);
            ratio = Math.max(ratio, _board.fit_mode / 100);
          }
          //hmtg.util.log(-2, '******debug, mywidth=' + _board.mywidth + ',myheight=' + _board.myheight + ',offsetwidth=' + offsetWidth + ',offsetheight=' + offsetHeight);

          if(_board.is_fit_page) {
            var new_ratio;
            new_ratio = ((ratio * 100) >> 0) / 100;
            if(new_ratio < _board.min_ratio) new_ratio = _board.min_ratio;
            if(_board.mywidth == _board.last_width && _board.myheight == _board.last_height) {
              if(new_ratio > _board.ratio) {
                // re-calculate ratio after we minus potential scroll bar area
                ratio = _board.max_ratio;
                ratio = Math.min(ratio, (offsetWidth - 30) / _board.mywidth);
                if(_board.fit_mode) {
                  ratio = Math.min(ratio, offsetHeight / _board.myheight);
                  ratio = Math.max(ratio, _board.fit_mode / 100);
                }
                ratio = ((ratio * 100) >> 0) / 100;
                if(ratio > _board.ratio) {
                  temp_ratio = ratio;
                }
              } else {
                temp_ratio = new_ratio;
              }
            } else {
              temp_ratio = new_ratio;
              _board.last_width = _board.mywidth;
              _board.last_height = _board.myheight;
            }
          } else {
            ratio = Math.min(0.1, offsetWidth / _board.mywidth, offsetHeight / _board.myheight);
            // if the manual temp_ratio is too small(50% of fitting ratio), make it larger
            if(temp_ratio < ratio * 0.5) {
              temp_ratio = ((ratio * 50) >> 0) / 100;
            }
          }
          // during active adding mark, do not change ratio
          if(_board.drag_idx != -1) {
            temp_ratio = _board.ratio;
          }

          drawMark(); // the next action
        });
        // the following line require that the above thread MUST take asynchronous onfinish
        _draw.stop = function() {
          size_mark_thread.stop();
          _draw.stop = function() {
          }
        }
      }

      function sizeMarkThread(onfinish) {
        var _sizeMarkThread = this;
        var i = 0;
        var size_intervalID = setInterval(size_mark, 0);

        function normal_stop() {
          clearInterval(size_intervalID);
          _sizeMarkThread.stop = function() {
          }
        }

        _sizeMarkThread.stop = normal_stop;

        function size_mark() {
          var start_tick = hmtg.util.GetTickCount();
          for(; i < _board.mark_array.length; i++) {
            if(hmtg.util.GetTickCount() - start_tick >= 10) return; // yield CPU to browser
            var mark = _board.mark_array[i];
            var _mark = mark.link;
            if(_mark._m_byMarkType() == hmtg.config.MARK_STROKE) size_stroke2(mark);
            else if(_mark._m_byMarkType() == hmtg.config.MARK_STROKE2) size_stroke2(mark);
            else if(_mark._m_byMarkType() == hmtg.config.MARK_TEXT) size_text2(mark);
            else if(_mark._m_byMarkType() == hmtg.config.MARK_TEXT2) size_text2(mark);
            else if(_mark._m_byMarkType() == hmtg.config.MARK_CUSTOMIZED) {
              var type2 = _mark._m_iCustomizedMarkType();
              if(!(type2 == 1 || type2 == 4 || type2 == 5)) {
                if(!_board.unknown_mark_warned) {
                  _board.unknown_mark_warned = true;
                  setTimeout(function() {
                    hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_UNKNOWN_MARK_TYPE') }, 20);
                  }, 0);
                }
              } else if(mark.unzipped_data) {
                i++;  // keep index valid
                clearInterval(size_intervalID); // need to stop interval
                var thread = new size_stamp(mark, type2, function() {
                  size_intervalID = setInterval(size_mark, 0);  // restore interval
                  _sizeMarkThread.stop = normal_stop;
                });
                // the following line require that the above thread MUST take asynchronous onfinish
                _sizeMarkThread.stop = function() {
                  thread.stop();
                  _sizeMarkThread.stop = function() {
                  }
                }
                return;
              }
            }
          }
          clearInterval(size_intervalID);
          _sizeMarkThread.stop = function() {
          }

          size_focus_pointer();
          size_local_mark();

          onfinish();
        }

        function size_focus_pointer() {
          if(target.pointer) {
            var p = target.pointer;
            var size = _board.calcFocusPointerSize(p);
            _board.mywidth = Math.max(size.x, _board.mywidth);
            _board.myheight = Math.max(size.y, _board.myheight);
            /*
            if(p.cx >= 16 || p.cy >= 16) {
              var pw = p.width;
              var half_pw = (pw + 1) >> 1;
              _board.mywidth = Math.max(p.x - p.cx + half_pw, p.x + p.cx + half_pw, _board.mywidth);
              _board.myheight = Math.max(p.y - p.cy + half_pw, p.y + p.cy + half_pw, _board.myheight);
            } else {
              _board.mywidth = Math.max(p.x + ((_board.pointer_img.width + 1) >> 1), _board.mywidth);
              _board.myheight = Math.max(p.y + ((_board.pointer_img.height + 1) >> 1), _board.myheight);
            }
            */
          }
        }

        function size_local_mark() {
          if(_board.drag_idx == -1) {
            // do not size floating image/text/eraser
            // only size them when mousedown occurs, i.e., when it is to be drawn
            return;
          }
          if(_board.drag_idx != _board.slide_index) return;

          var mark = _board.local_mark;
          if(_board.shape == 'pointer'
            || _board.shape == 'line'
            || _board.shape == 'rect'
            || _board.shape == 'rect2'
            || _board.shape == 'ellipse'
            || _board.shape == 'ellipse2'
            || _board.shape == 'freehand'
            || _board.shape == 'highlight'
            || _board.shape == 'eraser'
            ) {
            var pw = _board.text_width;
            var half_pw = (pw + 1) >> 1;
            var max_x = Math.max.apply(null, mark.ax) + Math.max(_board.HANDLE_HALF_WIDTH, half_pw);
            var max_y = Math.max.apply(null, mark.ay) + Math.max(_board.HANDLE_HALF_WIDTH, half_pw);
            _board.mywidth = Math.max(max_x, _board.mywidth);
            _board.myheight = Math.max(max_y, _board.myheight);
          } else if(_board.shape == 'image' && _board.selected_mark) {
            var w = Math.abs(mark.ax[0] - mark.ax[1]);
            var h = Math.abs(mark.ay[0] - mark.ay[1]);
            var imk = get_image_mark();
            var scale = get_image_mark_scale();

            if(w + h >= 24 || w + h >= ((imk.width + imk.height) >> 1)) {
              scale = Math.max((w + w) / imk.width, (h + h) / imk.height);
              var max_x = mark.ax[0] + ((imk.width * scale / 2) >> 0) + _board.HANDLE_HALF_WIDTH;
              var max_y = mark.ay[0] + ((imk.height * scale / 2) >> 0) + _board.HANDLE_HALF_WIDTH;
            } else {
              var max_x = mark.ax[1] + ((imk.width * scale / 2) >> 0) + _board.HANDLE_HALF_WIDTH;
              var max_y = mark.ay[1] + ((imk.height * scale / 2) >> 0) + _board.HANDLE_HALF_WIDTH;
            }
            _board.mywidth = Math.max(max_x, _board.mywidth);
            _board.myheight = Math.max(max_y, _board.myheight);
          }
        }

        function size_stamp(mark, type2, onfinish) {
          var _size_stamp = this;
          var _mark = mark.link;
          var x = _mark._m_offset_x();
          var y = _mark._m_offset_y();
          var cx = mark.point_x - x;
          var cy = mark.point_y - y;
          var zoom = _mark._m_zoom();

          if(type2 == 1 || type2 == 5) {
            var max_x = Math.max(x, x + cx) * 100 / zoom + _board.HANDLE_HALF_WIDTH;
            var max_y = Math.max(y, y + cy) * 100 / zoom + _board.HANDLE_HALF_WIDTH;

            if(_board.ensure_visible && _board.ensure_visible.mark == _mark) {
              _board.ensure_visible.mark = null;
              _board.ensure_visible.x = Math.min(x, x + cx) * 100 / zoom;
              _board.ensure_visible.y = Math.min(y, y + cy) * 100 / zoom;
              _board.ensure_visible.cx = max_x - _board.ensure_visible.x;
              _board.ensure_visible.cy = max_y - _board.ensure_visible.y;
            }

            adjust_size_by_mark(max_x, max_y, mark);
            // asynchronously call is necessary here
            hmtgHelper.async_finish(_size_stamp, onfinish);
            return;
          }
          var data = mark.unzipped_data;
          var blob;
          var url;
          try {
            if(data.length > appSetting.max_blob * 1048576) {
              if(_board.ensure_visible && _board.ensure_visible.mark == _mark) {
                _board.ensure_visible = null;
              }
              // asynchronously call is necessary here
              hmtgHelper.async_finish(_size_stamp, onfinish);
              return;
            }
            blob = new Blob([data], { type: 'image/bmp' });
            url = window.URL.createObjectURL(blob);
          } catch(e) {
            if(_board.ensure_visible && _board.ensure_visible.mark == _mark) {
              _board.ensure_visible = null;
            }
            // asynchronously call is necessary here
            hmtgHelper.async_finish(_size_stamp, onfinish);
            return;
          }
          function onerror() {
            // assume the stamp is 60x60
            mark.point_x = mark.point_y = 60;
            var max_x = (x + 60 / 2) * 100 / zoom + _board.HANDLE_HALF_WIDTH;
            var max_y = (y + 60 / 2) * 100 / zoom + _board.HANDLE_HALF_WIDTH;
            if(_board.ensure_visible && _board.ensure_visible.mark == _mark) {
              _board.ensure_visible.mark = null;
              _board.ensure_visible.x = max_x - 60;
              _board.ensure_visible.y = max_y - 60;
              _board.ensure_visible.cx = 60;
              _board.ensure_visible.cy = 60;
            }

            adjust_size_by_mark(max_x, max_y, mark);
            hmtg.util.log(-2, '******debug stamp load error in sizing');
            onfinish();
          }
          var img = new Image();
          var aborted = false;
          function img_onload() {
            window.URL.revokeObjectURL(url);
            if(aborted) return;

            mark.point_x = img.width;
            mark.point_y = img.height;
            var max_x = (x + img.width / 2) * 100 / zoom + _board.HANDLE_HALF_WIDTH;
            var max_y = (y + img.height / 2) * 100 / zoom + _board.HANDLE_HALF_WIDTH;

            if(_board.ensure_visible && _board.ensure_visible.mark == _mark) {
              _board.ensure_visible.mark = null;
              _board.ensure_visible.x = max_x - img.width;
              _board.ensure_visible.y = max_y - img.height;
              _board.ensure_visible.cx = img.width;
              _board.ensure_visible.cy = img.height;
            }

            adjust_size_by_mark(max_x, max_y, mark);
            onfinish();
          }
          function img_onerror() {
            window.URL.revokeObjectURL(url);
            if(aborted) return;

            onerror();
          }

          img.addEventListener("load", img_onload, false);
          img.addEventListener("error", img_onerror, false);
          img.src = url;

          _size_stamp.stop = function() {
            aborted = true;
            window.URL.revokeObjectURL(url);
            //img.removeEventListener("load", img_onload, false);
            //img.removeEventListener("error", img_onerror, false);
            _size_stamp.stop = function() {
            }
          }
        }
      }

      function size_stroke2(mark) {
        var max_x = mark.max_x;
        var max_y = mark.max_y;
        adjust_size_by_mark(max_x, max_y, mark);
      }

      function size_text2(mark) {
        var max_x = mark.max_x;
        var max_y = mark.max_y;
        adjust_size_by_mark(max_x, max_y, mark);
      }

      function drawMark() {
        var draw_mark_thread = new drawMarkThread(function() {
          finishDraw(); // the next action
        });
        // the following line require that the above thread MUST take asynchronous onfinish
        _draw.stop = function() {
          draw_mark_thread.stop();
          _draw.stop = function() {
          }
        }
      }

      function drawMarkThread(onfinish) {
        var _drawMarkThread = this;
        var i = 0;
        var j = 0;
        var mark0 = { move_x: 0, move_y: 0, move_cx: 0, move_cy: 0, local_move_x: 0, local_move_y: 0, local_move_cx: 0, local_move_cy: 0 };
        var draw_intervalID = setInterval(draw_mark, 0);

        function normal_stop() {
          clearInterval(draw_intervalID);
          _drawMarkThread.stop = function() {
          }
        }

        _drawMarkThread.stop = normal_stop;

        function draw_mark() {
          var start_tick = hmtg.util.GetTickCount();
          for(; i < _board.mark_array.length; i++) {
            if(hmtg.util.GetTickCount() - start_tick >= 10) return;
            var mark = _board.mark_array[i];
            var _mark = mark.link;
            if(_mark._m_byMarkType() == hmtg.config.MARK_STROKE) draw_stroke2(_board.ctx3, temp_ratio, mark, _board.color_values[_mark._m_iColor()], 100);
            else if(_mark._m_byMarkType() == hmtg.config.MARK_STROKE2) draw_stroke2(_board.ctx3, temp_ratio, mark, _mark._m_iColor(), _mark._m_zoom());
            else if(_mark._m_byMarkType() == hmtg.config.MARK_TEXT) {
              (mark.width_array ? draw_text2 : draw_text3)
              (_board.ctx3, temp_ratio, mark, _board.color_values[_mark._m_iColor()], 100);
            } else if(_mark._m_byMarkType() == hmtg.config.MARK_TEXT2) {
              (mark.width_array ? draw_text2 : draw_text3)
              (_board.ctx3, temp_ratio, mark, _mark._m_iColor(), _mark._m_zoom());
            } else if(_mark._m_byMarkType() == hmtg.config.MARK_CUSTOMIZED) {
              var type2 = _mark._m_iCustomizedMarkType();
              if((type2 == 1 || type2 == 4 || type2 == 5) && mark.unzipped_data) {
                i++;  // keep index valid
                clearInterval(draw_intervalID);
                var thread = new draw_stamp(mark, type2, function() {
                  draw_intervalID = setInterval(draw_mark, 0);
                  _drawMarkThread.stop = normal_stop;
                });
                // the following line require that the above thread MUST take asynchronous onfinish
                _drawMarkThread.stop = function() {
                  thread.stop();
                  _drawMarkThread.stop = function() {
                  }
                }
                return;
              } else {
                //draw_customized(mark);
              }
            }
          }
          if(!_board.is_private) {
            for(; j < _board.wait_list_mark_array.length; j++) {
              var mark = mark0;
              var _mark = mark.link = _board.wait_list_mark_array[j];
              if(_mark.m_iIndex != slide_index) break;  // wrong wait list
              if(_mark._m_byMarkType() == hmtg.config.MARK_STROKE2) draw_stroke2(_board.ctx3, temp_ratio, mark, _mark._m_iColor(), _mark._m_zoom());
              else if(_mark._m_byMarkType() == hmtg.config.MARK_TEXT2) {
                mark.text = _mark.internal_text;
                mark.height = _mark.internal_height;
                mark.width_array = _mark.internal_width_array;
                draw_text2(_board.ctx3, temp_ratio, mark, _mark._m_iColor(), _mark._m_zoom());
              } else if(_mark._m_byMarkType() == hmtg.config.MARK_CUSTOMIZED) {
                var type2 = _mark._m_iCustomizedMarkType();
                if(type2 == 5) {
                  j++;  // keep index valid
                  clearInterval(draw_intervalID);

                  mark.point_x = _mark.internal_point_x;
                  mark.point_y = _mark.internal_point_y;
                  mark.unzipped_data = _mark.internal_unzipped_data;
                  var thread = new draw_stamp(mark, type2, function() {
                    draw_intervalID = setInterval(draw_mark, 0);
                    _drawMarkThread.stop = normal_stop;
                  });
                  // the following line require that the above thread MUST take asynchronous onfinish
                  _drawMarkThread.stop = function() {
                    thread.stop();
                    _drawMarkThread.stop = function() {
                    }
                  }
                  return;
                } else {
                  //draw_customized(mark);
                }
              }
            }
          }
          clearInterval(draw_intervalID);
          drawLocalMark();
          _drawMarkThread.stop = function() {
          }

          onfinish();
        }

        function drawLocalMark() {
          if(_board.shape == 'select') {
            drawHoverSelect(temp_ratio, _board.ctx3);
            return;
          }
          if(_board.drag_idx == -1) return;
          if(_board.drag_idx != _board.slide_index) return;
          if(_board.shape == 'eraser') {
            var mark = _board.local_mark;
            mark.m_nPenWidth = _board.text_width;
            draw_stroke2(_board.ctx3, temp_ratio, _board.local_mark2, _board.color_value, 100);
          }

          /*
          if(_board.shape == 'line'
          || _board.shape == 'rect'
          || _board.shape == 'rect2'
          || _board.shape == 'ellipse'
          || _board.shape == 'ellipse2'
          || _board.shape == 'freehand'
          || _board.shape == 'eraser'
          || _board.shape == 'highlight'
          ) {
          var mark = _board.local_mark;
          mark.m_nPenWidth = _board.text_width;
          if(_board.shape == 'rect2' || _board.shape == 'ellipse2') {
          mark.ax[2] = mark.ax[1];
          mark.ay[2] = mark.ay[1];
          }
          draw_stroke2(_board.ctx3, temp_ratio, _board.local_mark2, _board.color_value, 100);
          } else if(_board.shape == 'image') {
          drawHoverImage(temp_ratio, _board.ctx3);
          } else if(_board.shape == 'text') {
          drawHoverText(temp_ratio, _board.ctx3);
          }
          */
        }

        function draw_stamp(mark, type2, onfinish) {
          var _draw_stamp = this;
          var _mark = mark.link;
          var data = mark.unzipped_data;
          var blob;
          var url;
          var img = new Image();
          var ratio = temp_ratio;
          var x = _mark._m_offset_x();
          var y = _mark._m_offset_y();
          var cx = mark.point_x - x;
          var cy = mark.point_y - y;
          var zoom = _mark._m_zoom();
          //mark.x = x * 100 / zoom;
          //mark.y = y * 100 / zoom;
          //mark.cx = cx * 100 / zoom;
          //mark.cy = cy * 100 / zoom;
          try {
            if(data.length > appSetting.max_blob * 1048576) {
              // asynchronously call is necessary here
              hmtgHelper.async_finish(_draw_stamp, onerror);
              return;
            }
            blob = new Blob([data], { type: (type2 == 5 ? 'image/png' : 'image/bmp') });
            url = window.URL.createObjectURL(blob);
          } catch(e) {
            // asynchronously call is necessary here
            hmtgHelper.async_finish(_draw_stamp, onerror);
            return;
          }
          function onerror() {
            hmtg.util.log(-2, '******debug stamp load error in drawing');
            // use solid gray box to cover the area
            _board.ctx3.fillStyle = "rgb(128,128,128)";
            if(type2 == 1 || type2 == 5) {
              _board.ctx3.fillRect(x * 100 / zoom * ratio, y * 100 / zoom * ratio, (cx * 100 / zoom + mark.local_move_cx + mark.move_cx) * ratio, (cy * 100 / zoom + mark.local_move_cy + mark.move_cy) * ratio);
            } else {
              // assume stamp size is 60x60
              img.width = img.height = 60;
              _board.ctx3.fillRect((x - img.width / 2) * 100 / zoom * ratio, (y - img.height / 2) * 100 / zoom * ratio,
                (img.width * 100 / zoom + mark.local_move_cx + mark.move_cx) * ratio, (img.height * 100 / zoom + mark.local_move_cy + mark.move_cy) * ratio);
            }
            onfinish();
          }
          var aborted = false;
          function img_onload() {
            window.URL.revokeObjectURL(url);
            if(aborted) return;

            ctx3.save();
            apply_mark_move(ctx3, mark, ratio);

            if(type2 == 1 || type2 == 5) {
              /*
              try {
              _board.ctx3.drawImage(img, 0, 0, img.width, img.height,
              x * 100 / zoom * ratio, y * 100 / zoom * ratio, (cx * 100 / zoom + mark.local_move_cx + mark.move_cx) * ratio, (cy * 100 / zoom + mark.local_move_cy + mark.move_cy) * ratio);
              } catch(e) {
              }
              */
              var draw_image_thread = new hmtgHelper.drawImageThread(_board.ctx3, img, 0, 0, img.width, img.height,
                  x * 100 / zoom * ratio, y * 100 / zoom * ratio, (cx * 100 / zoom + mark.local_move_cx + mark.move_cx) * ratio, (cy * 100 / zoom + mark.local_move_cy + mark.move_cy) * ratio, after_draw_image, _board.MAX_SIZE);
              _draw_stamp.stop = function() {
                ctx3.restore();
                draw_image_thread.stop();
                _draw_stamp.stop = function() {
                }
              }
              return;
            } else {
              var img_error = false;
              _board.canvas4.width = img.width;
              _board.canvas4.height = img.height;
              try {
                _board.ctx4.drawImage(img, 0, 0);
              } catch(e) {
                img_error = true;
              }

              if(!img_error) {
                try {
                  // copy alpha value if neccessary
                  if(mark.is_32bit_bmp) {
                    var pixels = _board.ctx4.getImageData(0, 0, img.width, img.height);
                    var i, j;
                    for(i = 0; i < img.height; i++) {
                      var src = mark.bmp_data_offset + (img.height - 1 - i) * img.width * 4;
                      var dst = i * img.width * 4;
                      for(j = 0; j < img.width; j++, src += 4, dst += 4) {
                        pixels.data[dst + 3] = mark.unzipped_data[src + 3];
                      }
                    }
                    _board.ctx4.putImageData(pixels, 0, 0);
                  }

                  //_board.ctx3.drawImage(_board.canvas4, 0, 0, img.width, img.height,
                  //(x - (img.width >> 1)) * 100 / zoom * ratio, (y - (img.height >> 1)) * 100 / zoom * ratio,
                  //(img.width * 100 / zoom + mark.local_move_cx + mark.move_cx) * ratio, (img.height * 100 / zoom + mark.local_move_cy + mark.move_cy) * ratio);
                  var draw_image_thread = new hmtgHelper.drawImageThread(_board.ctx3, _board.canvas4, 0, 0, img.width, img.height,
                    (x - (img.width >> 1)) * 100 / zoom * ratio, (y - (img.height >> 1)) * 100 / zoom * ratio,
                    (img.width * 100 / zoom + mark.local_move_cx + mark.move_cx) * ratio, (img.height * 100 / zoom + mark.local_move_cy + mark.move_cy) * ratio, after_draw_image, _board.MAX_SIZE);
                  _draw_stamp.stop = function() {
                    ctx3.restore();
                    draw_image_thread.stop();
                    _draw_stamp.stop = function() {
                    }
                  }
                  return;
                } catch(e) {
                }
              }
            }
            after_draw_image();
          }

          function after_draw_image() {
            ctx3.restore();
            onfinish();
          }

          function img_onerror() {
            window.URL.revokeObjectURL(url);
            if(aborted) return;

            onerror();
          }
          img.addEventListener("load", img_onload, false);
          img.addEventListener("error", img_onerror, false);
          img.src = url;

          _draw_stamp.stop = function() {
            aborted = true;
            window.URL.revokeObjectURL(url);
            //img.removeEventListener("load", img_onload, false);
            //img.removeEventListener("error", img_onerror, false);
            _draw_stamp.stop = function() {
            }
          }
        }
      }

      function draw_customized(mark) {
      }

      // adjust the marks' max_x and max_y due to mark move
      function adjust_size_by_mark(max_x, max_y, mark) {
        var adjust;
        adjust = Math.max(0, mark.local_move_x + mark.move_x) + Math.max(0, mark.local_move_cx + mark.move_cx);
        if(adjust > 0) max_x = max_x + adjust;

        adjust = Math.max(0, mark.local_move_y + mark.move_y) + Math.max(0, mark.local_move_cy + mark.move_cy);
        if(adjust > 0) max_y = max_y + adjust;

        _board.mywidth = Math.max(max_x, _board.mywidth);
        _board.myheight = Math.max(max_y, _board.myheight);
      }

      function finishDraw() {
        // if the actual size exceed the max allowed on canvas
        // draw lines at edges
        var ratio = temp_ratio;
        if(_board.actual_width * ratio > _board.MAX_SIZE) {
          hmtgHelper.drawEdge(ctx3, '#FF0000', _board.MAX_SIZE - 3, 0, _board.MAX_SIZE - 3, _board.MAX_SIZE);
        }
        if(_board.actual_height * ratio > _board.MAX_SIZE) {
          hmtgHelper.drawEdge(ctx3, '#FF0000', 0, _board.MAX_SIZE - 3, _board.MAX_SIZE, _board.MAX_SIZE - 3);
        }
        // draw the image under the marks
        ctx3.save();
        ctx3.globalCompositeOperation = 'destination-over';
        if(_board.board_image) {  // normal slide
          var img = _board.board_image;
          var draw_image_thread = new hmtgHelper.drawImageThread(ctx3, img, 0, 0, img.width, img.height, 0, 0, img.width * ratio, img.height * ratio, after_image_draw, _board.MAX_SIZE);
          _draw.stop = function() {
            ctx3.restore();
            draw_image_thread.stop();
            _draw.stop = function() {
            }
          }
          return;

          /*
          try {
          ctx3.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * ratio, img.height * ratio);
          } catch(e) {
          }
          */
        } else if(canvas2.width) {  // text slide
          //var width = Math.min(_board.MAX_SIZE, _board.img_width);
          //var height = Math.min(_board.MAX_SIZE, _board.img_height);
          var width = _board.img_width;
          var height = _board.img_height;
          var canvas_width = canvas2.width;
          var canvas_height = canvas2.height;
          var draw_image_thread = new hmtgHelper.drawImageThread(ctx3, canvas2, 0, 0, canvas_width, canvas_height, 0, 0, width * ratio, height * ratio, after_image_draw, _board.MAX_SIZE);
          _draw.stop = function() {
            ctx3.restore();
            draw_image_thread.stop();
            _draw.stop = function() {
            }
          }
          return;
          //ctx3.drawImage(canvas2, 0, 0, width, height, 0, 0, width * ratio, height * ratio);
        }
        after_image_draw();

        function after_image_draw() {
          ctx3.restore();
          _board.canvas3_ready = true;

          var old_size_descr = _board.size_descr;
          var mywidth = _board.mywidth >> 0;
          var myheight = _board.myheight >> 0;
          _board.size_descr = '';
          if(_board.slide_type == 0) {
            var name = slide._m_szName().toLowerCase();
            var type = '';
            if(hmtg.util.endsWith(name, '.jpg') || hmtg.util.endsWith(name, '.jpeg')) {
              type = '(JPG)';
            } else if(hmtg.util.endsWith(name, '.gif')) {
              type = '(GIF)';
            } else if(hmtg.util.endsWith(name, '.svg')) {
              type = '(SVG)';
            } else if(hmtg.util.endsWith(name, '.png')) {
              type = '(PNG)';
            } else if(hmtg.util.endsWith(name, '.pdf')) {
              type = '(PDF)';
            } else if(hmtg.util.endsWith(name, '.txt')) {
              type = '(TXT)';
            } else if(hmtg.util.endsWith(name, '.txt.jcz')) {
              type = '(TXT)';
            }
            _board.size_descr += type;
          }
          if(!hmtg.util.endsWith(slide._m_szName(), '.jzf')) {
            _board.size_descr += ' ' + _board.img_width + ' x ' + _board.img_height;
            if(mywidth && myheight && (mywidth != _board.img_width || myheight != _board.img_height)) {
              _board.size_descr += ' [' + mywidth + ' x ' + myheight + ']';
            }
          }
          if(slide._data()) {
            var name = slide._m_szName().toLowerCase();
            var prefix = '';
            if(is_slide_compressed(name)) prefix = $translate.instant('ID_COMPRESSED') + ' ';
            _board.size_descr += ' {' + prefix + hmtgHelper.number2GMK(slide._data().length) + 'B}';
          }

          _board.zoomed_width = Math.min(_board.MAX_SIZE, _board.mywidth * temp_ratio);
          _board.zoomed_height = Math.min(_board.MAX_SIZE, _board.myheight * temp_ratio);

          // set temp_ratio to draw_ratio and ratio
          var old_ratio = _board.ratio;
          _board.draw_ratio = _board.ratio = temp_ratio;
          _board.ratio_percent = Math.round(_board.ratio * 100);
          target.ratio_pos = _board.ratio_pos = _board.ratio * 100;

          // if this is a pdf slide, and the ratio changes
          // redraw the slide
          if(_board.is_fit_page && _board.scale != _board.ratio && !_board.is_local_slide) {
            if(!slide._is_blank_page() && slide._downloaded() == 1 && !hmtg.util.endsWith(slide._m_szName(), '.jzf')) {
              var name = slide._m_szName().toLowerCase();
              // if the img_width is 0, the pdf loading fails; do not redraw
              if(hmtg.util.endsWith(name, '.pdf') && _board.img_width) {
                setTimeout(function() {
                  _board.draw_slide();
                }, 0);
              }
            }
          }

          finalDraw();

          if(old_size_descr != _board.size_descr || old_ratio != _board.ratio) {
            _board.inside_draw_slide++;
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
            _board.inside_draw_slide--;
          }
        }
      }

      function finalDraw() {
        // copy image from canvas3 to canvas
        var w = _board.canvas.width = _board.zoomed_width;
        var h = _board.canvas.height = _board.zoomed_height;
        _board.ctx.drawImage(_board.canvas3, 0, 0, w, h, 0, 0, w, h);
        finalDraw2();
        // asynchronuous method cause flash when hovering with image or text
        /*
        var draw_image_thread = new hmtgHelper.drawImageThread(_board.ctx, _board.canvas3, 0, 0, w, h, 0, 0, w, h, finalDraw2);
        _draw.stop = function() {
        draw_image_thread.stop();
        _draw.stop = function () {
        }
        }
        */
      }

      function finalDraw2() {
        var ratio = temp_ratio;

        drawQuickLocalMark();
        drawMouseMoveItems(); // hover items
        drawLocalEraser();  // display a solid block to indicate the eraser
        // draw focus pointer if necessary
        drawFocusPointer(slide_index);
        drawLocalFocusPointer();  // display the active focus pointer being input locally
        if(_board.is_private) {
          drawPrivateShade();
        }

        if(_board.ensure_visible && !_board.is_private) {
          if(_board.ensure_visible.index == _board.slide_index
            && _board.ensure_visible.mark == null // is pointer, or the mark's size has been processed
          //&& !_board.is_fit_page
            && _board.drag_idx == -1) {
            // current box
            // the following assumes that board0's offset parent is container or that board0 and container share the same offset parent
            var board0_offset_left = _board.board0.offsetLeft;
            var board0_offset_top = _board.board0.offsetTop;
            if(_board.board0.offsetParent != _board.container) {
              board0_offset_left = _board.board0.offsetLeft - _board.container.offsetLeft;
              board0_offset_top = _board.board0.offsetTop - _board.container.offsetTop;
            }
            var x0 = Math.max(0, _board.container.scrollLeft + _board.board_container2.scrollLeft - board0_offset_left);
            var cx0 = _board.container.clientWidth - Math.max(0, board0_offset_left - _board.container.scrollLeft - _board.board_container2.scrollLeft);
            var y0 = Math.max(0, _board.container.scrollTop + _board.board_container2.scrollTop - board0_offset_top);
            var cy0 = _board.container.clientHeight - Math.max(0, board0_offset_top - _board.container.scrollTop - _board.board_container2.scrollTop);

            var x = _board.ensure_visible.x * ratio;
            var y = _board.ensure_visible.y * ratio;
            var cx = _board.ensure_visible.cx * ratio;
            var cy = _board.ensure_visible.cy * ratio;

            x--; cx++; cx++;  // increase size one pixel
            if(x < 0) {
              cx += x;
              x = 0;
              if(cx < 0) cx = 0;
            }
            y--; cy++; cy++; // increase size one pixel
            if(y < 0) {
              cy += y;
              y = 0;
              if(cy < 0) cy = 0;
            }

            // x
            var delta_x = 0;
            if(x >= x0 && x + cx <= x0 + cx0) {
              // do nothing
            } else if(x + cx / 2 >= x0 + cx0 / 2) {
              // pan right/down, to show left/top edge
              if(x <= x0) {
                // do nothing
              } else if(cx >= cx0) {
                delta_x = x - x0;
              } else {
                delta_x = x + cx - (x0 + cx0);
              }
            } else {
              // pan left/up, to show right/bottom edge
              if(x + cx >= x0 + cx0) {
              } else if(cx >= cx0) {
                delta_x = x + cx - (x0 + cx0);
              } else {
                delta_x = x - x0;
              }
            }
            if(delta_x) {
              _board.board_container2.scrollLeft = Math.max(0, _board.board_container2.scrollLeft + delta_x);
            }

            // y
            var delta_y = 0;
            if(y >= y0 && y + cy <= y0 + cy0) {
              // do nothing
            } else if(y + cy / 2 >= y0 + cy0 / 2) {
              // pan right/down, to show left/top edge
              if(y <= y0) {
                // do nothing
              } else if(cy >= cy0) {
                delta_y = y - y0;
              } else {
                delta_y = y + cy - (y0 + cy0);
              }
            } else {
              // pan left/up, to show right/bottom edge
              if(y + cy >= y0 + cy0) {
              } else if(cy >= cy0) {
                delta_y = y + cy - (y0 + cy0);
              } else {
                delta_y = y - y0;
              }
            }
            if(delta_y) {
              _board.board_container2.scrollTop = Math.max(0, _board.board_container2.scrollTop + delta_y);
            }

            //hmtg.util.log(-2, '******debug, 0=' + x0 + ',' + y0 + ',' + cx0 + ',' + cy0);
            //hmtg.util.log(-2, '******debug, target=' + x + ',' + y + ',' + cx + ',' + cy);
          }
          _board.ensure_visible = null;
        }

        // done!
        _draw.stop = function() {
        }
        _board.draw_thread = null;

      }

    }

    function calcStrokeRegion(mark, zoom) {
      return {
        x: (mark.x + mark.local_move_x + mark.move_x),
        y: (mark.y + mark.local_move_y + mark.move_y),
        w: (mark.cx + mark.local_move_cx + mark.move_cx),
        h: (mark.cy + mark.local_move_cy + mark.move_cy)
      };
    }

    function calcTextRegion(mark, zoom) {
      var _mark = mark.link;

      var x = _mark._m_rect_left() * 100 / zoom;
      var y = _mark._m_rect_top() * 100 / zoom;
      var x2 = _mark._m_rect_right() * 100 / zoom;
      var y2 = _mark._m_rect_bottom() * 100 / zoom;
      x2 += mark.local_move_cx + mark.move_cx;
      y2 += mark.local_move_cy + mark.move_cy;
      x += mark.local_move_x + mark.move_x;
      y += mark.local_move_y + mark.move_y;
      x2 += mark.local_move_x + mark.move_x;
      y2 += mark.local_move_y + mark.move_y;
      return { x: x, y: y, w: x2 - x, h: y2 - y };
    }

    function calcImageRegion(mark) {
      var _mark = mark.link;
      var type2 = _mark._m_iCustomizedMarkType();
      var zoom = _mark._m_zoom();
      var x = _mark._m_offset_x();
      var y = _mark._m_offset_y();
      if(type2 == 1 || type2 == 5) {
        var cx = mark.point_x - x;
        var cy = mark.point_y - y;
        return {
          x: (x * 100 / zoom + mark.local_move_x + mark.move_x),
          y: (y * 100 / zoom + mark.local_move_y + mark.move_y),
          w: (cx * 100 / zoom + mark.local_move_cx + mark.move_cx),
          h: (cy * 100 / zoom + mark.local_move_cy + mark.move_cy)
        };
      } else {
        return {
          x: ((x - (mark.point_x >> 1)) * 100 / zoom + mark.local_move_x + mark.move_x),
          y: ((y - (mark.point_y >> 1)) * 100 / zoom + mark.local_move_y + mark.move_y),
          w: (mark.point_x * 100 / zoom + mark.local_move_cx + mark.move_cx),
          h: (mark.point_y * 100 / zoom + mark.local_move_cy + mark.move_cy)
        };
      }
    }

    function normalizeRegion(r) {
      var r2 = {};
      if(r.w < 0) {
        r2.x2 = r.x;
        r2.x1 = r.x + r.w;
      } else {
        r2.x1 = r.x;
        r2.x2 = r.x + r.w;
      }
      if(r.h < 0) {
        r2.y2 = r.y;
        r2.y1 = r.y + r.h;
      } else {
        r2.y1 = r.y;
        r2.y2 = r.y + r.h;
      }
      return r2;
    }

    // hit test when the mouse select a region
    this.regionTestSingleMark = function(x1, y1, x2, y2, mark) {
      var _mark = mark.link;
      var type = _mark._m_byMarkType();
      var r, r2;

      if(type == hmtg.config.MARK_STROKE || type == hmtg.config.MARK_STROKE2) {
        if(!_board.is_eraser_selectable) {
          var shape = _mark._m_iShape();
          if(shape == _board.RECT_ERASER) {
            return false;
          }
        }
        r = calcStrokeRegion(mark, type == hmtg.config.MARK_STROKE ? 100 : _mark._m_zoom());
        r2 = normalizeRegion(r);
        return (x1 <= r2.x1 && y1 <= r2.y1 && x2 >= r2.x2 && y2 >= r2.y2);
      } else if(type == hmtg.config.MARK_TEXT || type == hmtg.config.MARK_TEXT2) {
        r = calcTextRegion(mark, type == hmtg.config.MARK_TEXT ? 100 : _mark._m_zoom());
        r2 = normalizeRegion(r);
        return (x1 <= r2.x1 && y1 <= r2.y1 && x2 >= r2.x2 && y2 >= r2.y2);
      } else if(type == hmtg.config.MARK_CUSTOMIZED) {
        var type2 = _mark._m_iCustomizedMarkType();
        if((type2 == 1 || type2 == 4 || type2 == 5) && mark.unzipped_data) {
          r = calcImageRegion(mark);
          r2 = normalizeRegion(r);
          return (x1 <= r2.x1 && y1 <= r2.y1 && x2 >= r2.x2 && y2 >= r2.y2);
        }
      }
      return false;
    }

    this.hitTest = function(x, y, single_test_only) {
      var local_mark = _board.local_mark;
      if(x > _board.mywidth || y > _board.myheight) return;
      var i;
      if(local_mark.id_array.length && !single_test_only) {
        var type;
        for(i = _board.mark_array.length - 1; i >= 0; i--) {
          var mark = _board.mark_array[i];
          if(local_mark.id_array.indexOf(mark.link._m_iID()) == -1) continue;
          var hit_type = _board.hitTestSingleSelectedMark(x, y, mark);
          if(hit_type < 0) continue;
          // 0 4 1
          // 7 8 5
          // 3 6 2
          // 825613470
          var cursor = '';
          if(hit_type == 0 || hit_type == 2) cursor = 'nwse-resize';
          else if(hit_type == 1 || hit_type == 3) cursor = 'nesw-resize';
          else if(hit_type == 5 || hit_type == 7) cursor = 'ew-resize';
          else if(hit_type == 4 || hit_type == 6) cursor = 'ns-resize';
          else if(hit_type == 9) cursor = 'pointer';
          else cursor = 'move';
          return { hit_type: hit_type, cursor: cursor, mark: mark };
        }
      } else {
        for(i = _board.mark_array.length - 1; i >= 0; i--) {
          var mark = _board.mark_array[i];
          if(_board.hitTestSingleMark(x, y, mark)) {
            return { hit_type: 8, cursor: 'move', mark: mark };
          }
        }
      }
    }

    this.updateSelectedMark = function() {
      var local_mark = _board.local_mark;
      var x1 = Math.min(local_mark.ax[0], local_mark.ax[1]);
      var x2 = Math.max(local_mark.ax[0], local_mark.ax[1]);
      var y1 = Math.min(local_mark.ay[0], local_mark.ay[1]);
      var y2 = Math.max(local_mark.ay[0], local_mark.ay[1]);

      if(local_mark.select_mode && local_mark.select_toggle_mode) {
        local_mark.id_array = local_mark.id_array0.slice(0);
      } else {
        local_mark.id_array = [];
      }
      var i;
      var type;
      for(i = _board.mark_array.length - 1; i >= 0; i--) {
        var mark = _board.mark_array[i];
        var _mark = mark.link;
        var type = _mark._m_byMarkType();
        var r, r2;
        var ratio = _board.ratio;

        if(type == hmtg.config.MARK_STROKE || type == hmtg.config.MARK_STROKE2) { }
        else if(type == hmtg.config.MARK_TEXT || type == hmtg.config.MARK_TEXT2) { }
        else if(type == hmtg.config.MARK_CUSTOMIZED) { }
        else continue;
        if(_board.regionTestSingleMark(x1, y1, x2, y2, mark)) {
          var id = mark.link._m_iID();
          if(local_mark.select_mode && local_mark.select_toggle_mode) {
            var idx = local_mark.id_array.indexOf(id);
            if(idx == -1) {
              local_mark.id_array.push(id);
            } else {
              local_mark.id_array.splice(idx, 1);
            }
          } else {
            local_mark.id_array.push(id);
          }
        }
      }
    }

    // hit test when the mouse select a point
    this.hitTestSingleMark = function(x, y, mark) {
      var _mark = mark.link;
      var type = _mark._m_byMarkType();
      var r, r2;
      var ratio = _board.ratio;

      if(type == hmtg.config.MARK_STROKE || type == hmtg.config.MARK_STROKE2) {
        var i = 0;
        var ax = _mark._ax();
        if(!ax.length) return false;
        var ay = _mark._ay();
        var shape = _mark._m_iShape();
        var ctx3 = _board.ctx_temp;
        var pw = _mark._m_nPenWidth();
        var zoom = type == hmtg.config.MARK_STROKE ? 100 : _mark._m_zoom();
        x -= mark.local_move_x + mark.move_x;
        y -= mark.local_move_y + mark.move_y;
        ax = scaleStrokeX(mark, zoom, ax);
        ay = scaleStrokeY(mark, zoom, ay);
        if(shape == _board.RECTANGLE || shape == _board.ELLIPSE) {
          if(ax.length < 2) return false;
          r2 = {};
          r2.x1 = Math.min(ax[0], ax[1]) * 100 / zoom - (pw >> 1);
          r2.x2 = Math.max(ax[0], ax[1]) * 100 / zoom - (pw >> 1) + pw;
          r2.y1 = Math.min(ay[0], ay[1]) * 100 / zoom - (pw >> 1);
          r2.y2 = Math.max(ay[0], ay[1]) * 100 / zoom - (pw >> 1) + pw;
          return (x >= r2.x1 && y >= r2.y1 && x <= r2.x2 && y <= r2.y2);
        } else if(shape == _board.RECT_ERASER) {
          if(!_board.is_eraser_selectable) return false;
          var r = _mark._m_nPenWidth() * 4;
          var r2 = r * 2;
          i = 0;
          if(x >= (ax[i] * 100 / zoom - r) && y >= (ay[i] * 100 / zoom - r) && x <= (ax[i] * 100 / zoom + r) && y <= (ay[i] * 100 / zoom + r)) return true;
          for(i = 1; i < ax.length; i++) {
            var shift_x = ax[i] * 100 / zoom - ax[i - 1] * 100 / zoom;
            var shift_y = ay[i] * 100 / zoom - ay[i - 1] * 100 / zoom;
            var dis_x = Math.abs(shift_x) >> 0;
            var dis_y = Math.abs(shift_y) >> 0;
            var j, x0, y0;
            if(dis_x >= dis_y && dis_x > 1) {
              for(j = 0; j < dis_x; j++) {
                x0 = ax[i] * 100 / zoom - j * shift_x / dis_x;
                y0 = ay[i] * 100 / zoom - j * shift_y / dis_x;
                if(x >= (x0 - r) && y >= (y0 - r) && x <= (x0 + r) && y <= (y0 + r)) return true;
              }
            } else if(dis_y >= dis_x && dis_y > 1) {
              for(j = 0; j < dis_y; j++) {
                x0 = ax[i] * 100 / zoom - j * shift_x / dis_y;
                y0 = ay[i] * 100 / zoom - j * shift_y / dis_y;
                if(x >= (x0 - r) && y >= (y0 - r) && x <= (x0 + r) && y <= (y0 + r)) return true;
              }
            } else {
              if(x >= (ax[i] * 100 / zoom - r) && y >= (ay[i] * 100 / zoom - r) && x <= (ax[i] * 100 / zoom + r) && y <= (ay[i] * 100 / zoom + r)) return true;
            }
          }
          return false;
        } else {
          if(ctx3.isPointInStroke) {
            var adjusted_ratio = 100 / zoom;
            ctx3.lineWidth = _mark._m_nPenWidth() + 2;  // relaxed 2 pixels for detection
            ctx3.beginPath();
            ctx3.moveTo(ax[i], ay[i]);
            if(shape == _board.FREEHAND && ax.length == 1) {// free hand
              ctx3.lineTo((ax[i]) + 0.1, ay[i]);
            } else if(shape == _board.LINE && ax.length == 2 && ax[i] == ax[1] && ay[i] == ay[1]) {//line
              ctx3.lineTo((ax[i]) + 0.1, ay[i]);
            } else {
              for(i = 1; i < ax.length; i++) {
                ctx3.lineTo(ax[i], ay[i]);
              }
            }
            return ctx3.isPointInStroke(x / adjusted_ratio, y / adjusted_ratio);
          } else {
            r = calcStrokeRegion(mark, type == hmtg.config.MARK_STROKE ? 100 : _mark._m_zoom());
            r2 = normalizeRegion(r);
            r2.x1 -= (pw >> 1);
            r2.x2 += pw - (pw >> 1);
            r2.y1 -= (pw >> 1);
            r2.y2 += pw - (pw >> 1);
            return (x >= r2.x1 && y >= r2.y1 && x <= r2.x2 && y <= r2.y2);
          }
        }
      } else if(type == hmtg.config.MARK_TEXT || type == hmtg.config.MARK_TEXT2) {
        r = calcTextRegion(mark, type == hmtg.config.MARK_TEXT ? 100 : _mark._m_zoom());
        //hmtg.util.log(-2, '******debug, hitTestSingleMark textmark, r(x,w,y,h)=' + r.x + ',' + r.w + ',' + r.y + ',' + r.h);
        r2 = normalizeRegion(r);
        //hmtg.util.log(-2, '******debug, hitTestSingleMark textmark, r2(x1,x2,y1,y2)=' + r2.x1 + ',' + r2.x2 + ',' + r2.y1 + ',' + r2.y2);
        return (x >= r2.x1 && y >= r2.y1 && x <= r2.x2 && y <= r2.y2);
      } else if(type == hmtg.config.MARK_CUSTOMIZED) {
        var type2 = _mark._m_iCustomizedMarkType();
        if((type2 == 1 || type2 == 4 || type2 == 5) && mark.unzipped_data) {
          r = calcImageRegion(mark);
          r2 = normalizeRegion(r);
          return (x >= r2.x1 && y >= r2.y1 && x <= r2.x2 && y <= r2.y2);
        }
      }
      return false;
    }

    // hit test when there are one or more selected marks
    this.hitTestSingleSelectedMark = function(x, y, mark) {
      var _mark = mark.link;
      var type = _mark._m_byMarkType();
      var r, r2;

      if(type == hmtg.config.MARK_STROKE || type == hmtg.config.MARK_STROKE2) {
        r = calcStrokeRegion(mark, type == hmtg.config.MARK_STROKE ? 100 : _mark._m_zoom());
      } else if(type == hmtg.config.MARK_TEXT || type == hmtg.config.MARK_TEXT2) {
        r = calcTextRegion(mark, type == hmtg.config.MARK_TEXT ? 100 : _mark._m_zoom());
      } else if(type == hmtg.config.MARK_CUSTOMIZED) {
        var type2 = _mark._m_iCustomizedMarkType();
        if((type2 == 1 || type2 == 4 || type2 == 5) && mark.unzipped_data) {
          r = calcImageRegion(mark);
        } else return -1;
      } else return -1;
      // 0 4 1
      // 7 8 5
      // 3 6 2
      // 825613470
      if(hitTestHandle(r.x + r.w, r.y + r.h, x, y)) return 2;
      if(hitTestHandle(r.x + r.w, r.y + r.h / 2, x, y)) return 5;
      if(hitTestHandle(r.x + r.w / 2, r.y + r.h, x, y)) return 6;
      if(hitTestHandle(r.x + r.w, r.y, x, y)) return 1;
      if(hitTestHandle(r.x, r.y + r.h, x, y)) return 3;
      if(hitTestHandle(r.x + r.w / 2, r.y, x, y)) return 4;
      if(hitTestHandle(r.x, r.y + r.h / 2, x, y)) return 7;
      if(hitTestHandle(r.x, r.y, x, y)) return 0;

      // test delete button (9)
      var bw = _board.HANDLE_CLOSE_SIZE / _board.ratio;
      var dis = _board.HANDLE_HALF_WIDTH / _board.ratio;
      var hx = r.x - dis - bw;
      var hy = r.y - dis - bw;
      if(x >= hx && x <= hx + bw && y >= hy && y <= hy + bw) return 9;

      r2 = normalizeRegion(r);
      if(x >= r2.x1 && y >= r2.y1 && x <= r2.x2 && y <= r2.y2) return 8;

      // for stroke, if the point can hitTest the stroke, also return 'move'
      if(type == hmtg.config.MARK_STROKE || type == hmtg.config.MARK_STROKE2) {
        if(this.hitTestSingleMark(x, y, mark)) return 8;
      }
      return -1;
    }

    function hitTestHandle(hx, hy, x, y) {
      var dis = _board.HANDLE_HALF_WIDTH / _board.ratio;
      return (x >= hx - dis && x <= hx + dis && y >= hy - dis && y <= hy + dis);
    }

    function scaleStrokeX(mark, zoom, ax) {
      var _mark = mark.link;
      if((mark.local_move_cx + mark.move_cx) && mark.cx) {
        if(mark.ax2_link != _mark || mark.ax2_move != (mark.local_move_cx + mark.move_cx)) {
          mark.ax2_link = _mark;
          mark.ax2_move = mark.local_move_cx + mark.move_cx;

          if(!mark.ax2 || mark.ax2.length != ax.length) {
            mark.ax2 = new Int32Array(ax.length);
          }
          var factor = (mark.cx + mark.local_move_cx + mark.move_cx) / mark.cx;
          var orig_x = mark.x * zoom / 100;
          for(i = 0; i < ax.length; i++) {
            mark.ax2[i] = orig_x + (ax[i] - orig_x) * factor;
          }
        }
        ax = mark.ax2;
      }
      return ax;
    }

    function scaleStrokeY(mark, zoom, ay) {
      var _mark = mark.link;
      if((mark.local_move_cy + mark.move_cy) && mark.cy) {
        if(mark.ay2_link != _mark || mark.ay2_move != (mark.local_move_cy + mark.move_cy)) {
          mark.ay2_link = _mark;
          mark.ay2_move = mark.local_move_cy + mark.move_cy;

          if(!mark.ay2 || mark.ay2.length != ay.length) {
            mark.ay2 = new Int32Array(ay.length);
          }
          var factor = (mark.cy + mark.local_move_cy + mark.move_cy) / mark.cy;
          var orig_y = mark.y * zoom / 100;
          for(i = 0; i < ay.length; i++) {
            mark.ay2[i] = orig_y + (ay[i] - orig_y) * factor;
          }
        }
        ay = mark.ay2;
      }
      return ay;
    }

    // shape: LINE, RECTANGLE, ELLIPSE, FREEHAND, TEXT, POLYGON, POINTER, IMAGE, HIGH_LIGHT, RECT_ERASER, MOVE, RECT_MOVEABLE_ERASER, STAMP

    function draw_stroke2(ctx3, ratio, mark, color, zoom) {
      var _mark = mark.link;
      //var ctx3 = _board.ctx3;
      var i;

      var ax = _mark._ax();
      if(!ax.length) return;
      var ay = _mark._ay();
      var shape = _mark._m_iShape();

      ctx3.lineWidth = _mark._m_nPenWidth() * ratio;
      ctx3.strokeStyle = color2style(color);

      //hmtg.util.log(-1, '******debug, stroke2, x=' + ax[i] + ',y=' + ay[i] + ',zoom=' + _mark._m_zoom());
      //hmtg.util.log(-1, '******debug, stroke2, shape=' + _mark._m_iShape());
      ctx3.beginPath();
      ctx3.save();
      ctx3.lineCap = "round";
      ctx3.lineJoin = "round";
      apply_mark_move(ctx3, mark, ratio);
      ax = scaleStrokeX(mark, zoom, ax);
      ay = scaleStrokeY(mark, zoom, ay);

      var adjusted_ratio = 100 / zoom * ratio;

      i = 0;
      if(shape == _board.RECTANGLE) {  // rectangle
        if(ax.length >= 2) {
          if(ax.length != 2) {
            ctx3.moveTo(ax[i] * adjusted_ratio, ay[i] * adjusted_ratio);
            ctx3.lineTo(ax[i + 1] * adjusted_ratio, ay[i] * adjusted_ratio);
            ctx3.lineTo(ax[i + 1] * adjusted_ratio, ay[i + 1] * adjusted_ratio);
            ctx3.lineTo(ax[i] * adjusted_ratio, ay[i + 1] * adjusted_ratio);
            ctx3.fillStyle = ctx3.strokeStyle;
            ctx3.fill();
          } else {
            ctx3.save();
            ctx3.lineCap = "square";
            ctx3.moveTo(ax[i] * adjusted_ratio, ay[i] * adjusted_ratio);
            ctx3.lineTo(ax[i + 1] * adjusted_ratio, ay[i] * adjusted_ratio);
            ctx3.stroke();

            ctx3.beginPath();
            ctx3.moveTo(ax[i + 1] * adjusted_ratio, ay[i] * adjusted_ratio);
            ctx3.lineTo(ax[i + 1] * adjusted_ratio, ay[i + 1] * adjusted_ratio);
            ctx3.stroke();

            ctx3.beginPath();
            ctx3.moveTo(ax[i + 1] * adjusted_ratio, ay[i + 1] * adjusted_ratio);
            ctx3.lineTo(ax[i] * adjusted_ratio, ay[i + 1] * adjusted_ratio);
            ctx3.stroke();

            ctx3.beginPath();
            ctx3.moveTo(ax[i] * adjusted_ratio, ay[i + 1] * adjusted_ratio);
            ctx3.lineTo(ax[i] * adjusted_ratio, ay[i] * adjusted_ratio);
            ctx3.stroke();
            ctx3.restore();
          }
        }
      } else if(shape == _board.ELLIPSE) {  // ellipse
        if(ax.length >= 2) {
          drawEllipse(ctx3, ax[i] * adjusted_ratio, ay[i] * adjusted_ratio,
              ax[i + 1] * adjusted_ratio - ax[i] * adjusted_ratio,
              ay[i + 1] * adjusted_ratio - ay[i] * adjusted_ratio);
          if(ax.length != 2) {
            ctx3.closePath();
            ctx3.fillStyle = ctx3.strokeStyle;
            ctx3.fill();
          } else {
            ctx3.stroke();
          }
        }
      } else if(shape == _board.RECT_ERASER) { // eraser
        ctx3.save();
        ctx3.globalCompositeOperation = 'destination-out';
        ctx3.fillStyle = 'rgba(0,0,0,1)';
        ctx3.strokeStyle = 'rgba(0,0,0,1)';
        var r = _mark._m_nPenWidth() * 4;
        var r2 = r * 2;

        i = 0;
        ctx3.rect((ax[i] * 100 / zoom - r) * ratio, (ay[i] * 100 / zoom - r) * ratio,
            r2 * ratio, r2 * ratio);

        for(i = 1; i < ax.length; i++) {
          var shift_x = ax[i] * 100 / zoom - ax[i - 1] * 100 / zoom;
          var shift_y = ay[i] * 100 / zoom - ay[i - 1] * 100 / zoom;
          var dis_x = Math.abs(shift_x) >> 0;
          var dis_y = Math.abs(shift_y) >> 0;
          var j, x, y;
          if(dis_x >= dis_y && dis_x > 1) {
            for(j = 0; j < dis_x; j++) {
              x = ax[i] * 100 / zoom - j * shift_x / dis_x;
              y = ay[i] * 100 / zoom - j * shift_y / dis_x;
              ctx3.rect((x - r) * ratio, (y - r) * ratio, r2 * ratio, r2 * ratio);
            }
          } else if(dis_y >= dis_x && dis_y > 1) {
            for(j = 0; j < dis_y; j++) {
              x = ax[i] * 100 / zoom - j * shift_x / dis_y;
              y = ay[i] * 100 / zoom - j * shift_y / dis_y;
              ctx3.rect((x - r) * ratio, (y - r) * ratio, r2 * ratio, r2 * ratio);
            }
          } else {
            ctx3.rect((ax[i] * 100 / zoom - r) * ratio, (ay[i] * 100 / zoom - r) * ratio, r2 * ratio, r2 * ratio);
          }
        }

        ctx3.fill();
        ctx3.restore();
      } else {
        if(shape == _board.HIGH_LIGHT) {  // highlight
          ctx3.save();
          ctx3.globalAlpha = 0.5;
        }

        ctx3.moveTo(ax[i] * adjusted_ratio, ay[i] * adjusted_ratio);
        if(shape == _board.FREEHAND && ax.length == 1) {// free hand
          ctx3.lineTo((ax[i] * adjusted_ratio) + 0.1, ay[i] * adjusted_ratio);
        } else if(shape == _board.LINE && ax.length == 2 && ax[i] == ax[1] && ay[i] == ay[1]) {//line
          ctx3.lineTo((ax[i] * adjusted_ratio) + 0.1, ay[i] * adjusted_ratio);
        } else if(shape == _board.HIGH_LIGHT) {
          for(i = 1; i < ax.length; i++) {
            ctx3.lineTo(ax[i] * adjusted_ratio, ay[i] * adjusted_ratio);
          }
        } else if(ax.length >= 3 && ax[ax.length - 1] == ax[ax.length - 2] && ay[ax.length - 1] == ay[ax.length - 2]) {
          for(i = 1; i < ax.length - 1; i++) {
            ctx3.lineTo(ax[i] * adjusted_ratio, ay[i] * adjusted_ratio);
          }
        } else {
          for(i = 1; i < ax.length; i++) {
            ctx3.lineTo(ax[i] * adjusted_ratio, ay[i] * adjusted_ratio);
            ctx3.stroke();
            ctx3.beginPath();
            ctx3.moveTo(ax[i] * adjusted_ratio, ay[i] * adjusted_ratio);
          }
        }

        if(shape == _board.HIGH_LIGHT) {  // highlight
          ctx3.stroke();
          ctx3.restore();
        } else if(ax.length >= 3 && ax[ax.length - 1] == ax[ax.length - 2] && ay[ax.length - 1] == ay[ax.length - 2]) {
          ctx3.closePath();
          ctx3.fillStyle = ctx3.strokeStyle;
          ctx3.fill();
        } else {
          ctx3.stroke();
        }
      }

      ctx3.restore();
    }

    function is_high_surrogate(code) {
      return (code & 0xfc00) == 0xd800;
    }

    function draw_text2(ctx, ratio, mark, color, zoom) {
      var _mark = mark.link;
      var ctx3 = ctx;
      var i;

      var temp = calcTextRegion(mark, zoom);
      var x = temp.x * zoom / 100;
      var y = temp.y * zoom / 100;
      var x2 = x + temp.w * zoom / 100;
      var y2 = y + temp.h * zoom / 100;
      var swap;
      if(x2 < x) {
        swap = x2;
        x2 = x;
        x = swap;
      }
      if(y2 < y) {
        swap = y2;
        y2 = y;
        y = swap;
      }

      ctx3.save();

      var adjusted_ratio = 100 / zoom * ratio;
      var text = mark.text;
      var line_height = mark.height || _mark._m_nPenWidth() * 10 * zoom / 100;  // line height
      var ft_height = line_height * adjusted_ratio; // convert to font height
      var width = mark.width_array || [];
      ctx3.font = '' + (ft_height * 0.71) + "px 'Verdana','YuGothic','Hiragino Kaku Gothic ProN','Meiryo','Microsoft Sans Serif','Sans Serif'";
      ctx3.lineWidth = 1;
      ctx3.fillStyle = color2style(color);

      //hmtg.util.log(-1, '******debug, zoom=' + zoom + ',x=' + x + ',x2=' + x2 + ',y=' + y + ',y2=' + y2);
      x = Math.round(x); // round is used in PC JoinNet, so we have to do the same
      x2 = Math.round(x2);
      y = Math.round(y);
      y2 = Math.round(y2);
      var region_width = x2 - x;
      var region_height = y2 - y;
      //hmtg.util.log(-1, '******debug, region_width=' + region_width + ',region_height=' + region_height);

      // y2 - y + 6, why + 6? some how, PC JoinNet show ~6 pixels beyond the bottom boundary, just try to be the same
      ctx3.beginPath();
      ctx3.rect(x * adjusted_ratio, y * adjusted_ratio, (x2 - x) * adjusted_ratio, (y2 - y + 6) * adjusted_ratio);
      ctx3.clip();

      var compensate_y = -0.23; // compensate the ascent of the first line
      var line = 1; // current line number
      var pos = 0;  // current position at the original text
      var width_pos = 0;  // current position of the character width array
      var newline = '\n'.charCodeAt(0);
      var space = ' '.charCodeAt(0);
      var my_x = 0; // the render position of current character
      var line_count = 0; // how many characters are rendered at current line
      var draw_width = 0; // used to calculate the actual width/height of the drawn text
      while(pos < text.length) {
        if(width_pos >= width.length) break; // running out of character width information (should not occur, really)

        var text_code = text.charCodeAt(pos);
        if(text_code == newline) { // move to next line for newline
          drawLine(text, pos, line_count, x * adjusted_ratio, ft_height * (line + compensate_y) + y * adjusted_ratio, my_x * adjusted_ratio);
          line++;
          pos++;
          line_count = 0;
          my_x = 0;
          if(Math.floor(line_height * (line - 1) + 0.5) > region_height) break;
          continue;
        }

        if(line_count != 0 && my_x + width[width_pos] > region_width) { // the next character exceed width
          text_code = text.charCodeAt(pos);
          if(text_code == space) {  // for space, PC JoinNet move past it, we have to do the same
            drawLine(text, pos, line_count, x * adjusted_ratio, ft_height * (line + compensate_y) + y * adjusted_ratio, my_x * adjusted_ratio);
            width_pos++;
            pos++;
            line_count++;
          } else {
            drawLine(text, pos, line_count, x * adjusted_ratio, ft_height * (line + compensate_y) + y * adjusted_ratio, my_x * adjusted_ratio);
          }
          //hmtg.util.log(-1, '******debug, pos=' + pos + '(' + line_count + '),my_x=' + my_x + ',width=' + width[width_pos]);
          my_x = 0;
          line_count = 0;
          line++;
          if(Math.floor(line_height * (line - 1) + 0.5) > region_height) break;
        } else {  // always render at least one character per line
          //ctx3.fillText(text.slice(pos, pos + 1), (x + my_x) * adjusted_ratio, ft_height * (line + compensate_y) + y * adjusted_ratio);
          my_x += width[width_pos];
          line_count++;
          pos++;
          if(is_high_surrogate(text_code)) {
            line_count++;
            pos++;
          }
          width_pos++;
        }
      }
      if(line_count) {
        drawLine(text, pos, line_count, x * adjusted_ratio, ft_height * (line + compensate_y) + y * adjusted_ratio, my_x * adjusted_ratio);
      }

      ctx3.restore();

      return { w: draw_width, h: ft_height * (line + 0.5) };

      function drawLine(text, end, num, x, y, width) {
        var adjust = 0;
        if(!num) return;
        draw_width = Math.max(draw_width, width);
        var text2 = text.slice(end - num, end);
        var width0 = ctx3.measureText(text2).width;
        if(width0 >= width) {
          // squeeze the text using the 4th parameter
          ctx3.fillText(text2, x, y, width);
        } else {
          // expand the space between adjacent characters
          var z = width / width0;
          var i;
          for(i = 0; i < num; i++) {
            adjust = 0;
            var text_code = text2.charCodeAt(i);
            if(is_high_surrogate(text_code)) adjust = 1;
            var text3 = text2.slice(i, i + 1 + adjust);
            width0 = ctx3.measureText(text3).width;
            ctx3.fillText(text3, x, y);
            x += width0 * z;
            i += adjust;
          }
        }
      }
    }

    // draw text natually, ignore the width info
    function draw_text3(ctx, ratio, mark, color, zoom) {
      zoom = zoom || 100;
      var _mark = mark.link;
      var ctx3 = ctx;
      var i;

      var temp = calcTextRegion(mark, zoom);
      var x = temp.x * zoom / 100;
      var y = temp.y * zoom / 100;
      var x2 = x + temp.w * zoom / 100;
      var y2 = y + temp.h * zoom / 100;
      /*
      var x = _mark._m_rect_left();
      var y = _mark._m_rect_top();
      var x2 = _mark._m_rect_right();
      var y2 = _mark._m_rect_bottom();
      */
      var swap;
      if(x2 < x) {
        swap = x2;
        x2 = x;
        x = swap;
      }
      if(y2 < y) {
        swap = y2;
        y2 = y;
        y = swap;
      }

      ctx3.save();

      var adjusted_ratio = 100 / zoom * ratio;
      var text = mark.text;
      var line_height = mark.height || _mark._m_nPenWidth() * 10 * zoom / 100;  // line height
      var ft_height = line_height * adjusted_ratio; // convert to font height
      ctx3.font = (appSetting.is_bold_text ? 'bold ' : '') + (appSetting.is_italic_text ? 'italic ' : '')
        + (ft_height * 0.71) + 'px '
        + (appSetting.text_font ? "'" + appSetting.text_font + "'" : "'Verdana','YuGothic','Hiragino Kaku Gothic ProN','Meiryo','Microsoft Sans Serif','Sans Serif'");
      ctx3.lineWidth = 1;
      ctx3.fillStyle = color2style(color);

      var region_width = (x2 - x) * adjusted_ratio;
      var region_height = y2 - y;
      //hmtg.util.log(-1, '******debug, region_width=' + region_width + ',region_height=' + region_height);

      ctx3.translate(x * adjusted_ratio, y * adjusted_ratio);
      if(appSetting.text_rotate == 90) {
        ctx3.rotate(Math.PI * 0.5);
      } else if(appSetting.text_rotate == 270) {
        ctx3.rotate(Math.PI * 1.5);
      }

      ctx3.beginPath();
      ctx3.rect(0, 0, (x2 - x) * adjusted_ratio, (y2 - y) * adjusted_ratio);
      ctx3.clip();

      var line = 1; // current line number
      var pos = 0;  // current position at the original text
      var newline = '\n'.charCodeAt(0);
      var space = ' '.charCodeAt(0);
      var line_count = 0; // how many characters are rendered at current line
      var draw_width = 0; // used to calculate the actual width/height of the drawn text
      while(pos < text.length) {
        var adjust = 0;
        var text_code = text.charCodeAt(pos);
        if(text_code == newline) { // move to next line for newline
          drawLine(text, pos, line_count, 0, ft_height * line);
          line++;
          pos++;
          line_count = 0;
          if(Math.floor(line_height * (line - 1) + 0.5) > region_height) break;
          continue;
        }

        if(is_high_surrogate(text_code)) adjust = 1;
        if(line_count != 0 && ctx3.measureText(text.slice(pos - line_count, pos + 1 + adjust)).width > region_width) { // the next character exceed width
          text_code = text.charCodeAt(pos);
          if(text_code == space) {  // for space, PC JoinNet move past it, we have to do the same
            drawLine(text, pos, line_count, 0, ft_height * line);
            pos++;
            line_count++;
          } else {
            drawLine(text, pos, line_count, 0, ft_height * line);
          }
          line_count = 0;
          line++;
          if(Math.floor(line_height * (line - 1) + 0.5) > region_height) break;
        } else {  // always render at least one character per line
          line_count++;
          pos++;
          if(adjust) {
            line_count++;
            pos++;
          }
        }
      }
      if(line_count) {
        drawLine(text, pos, line_count, 0, ft_height * line);
      }

      ctx3.restore();

      return { w: draw_width, h: ft_height * (line + 0.5), h2: ft_height * (line + 0.5 + (pos < text.length ? 1 : 0)) };

      function drawLine(text, end, num, x, y) {
        if(!num) return;
        var text2 = text.slice(end - num, end);
        var width = ctx3.measureText(text2).width;
        draw_width = Math.max(draw_width, width);
        ctx3.fillText(text2, x, y);
      }
    }

    function drawEllipseByCenter(ctx, cx, cy, w, h) {
      drawEllipse(ctx, cx - w / 2.0, cy - h / 2.0, w, h);
    }

    function drawEllipse(ctx, x, y, w, h) {
      var kappa = .5522848,
        ox = (w / 2) * kappa, // control point offset horizontal
        oy = (h / 2) * kappa, // control point offset vertical
        xe = x + w,           // x-end
        ye = y + h,           // y-end
        xm = x + w / 2,       // x-middle
        ym = y + h / 2;       // y-middle

      //ctx.beginPath();
      ctx.moveTo(x, ym);
      ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
      ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
      ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
      ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
      //ctx.closePath(); // not used correctly, see comments (use to close off open path)
      //ctx.stroke();
    }

    function apply_mark_move(ctx3, mark, ratio) {
      ctx3.translate((mark.local_move_x + mark.move_x) * ratio, (mark.local_move_y + mark.move_y) * ratio);
    }

    function roundRect(ctx, x, y, width, height) {
      var radius_x = Math.min(ctx.lineWidth << 1, width >> 1);
      var radius_y = Math.min(ctx.lineWidth << 1, height >> 1);
      ctx.beginPath();
      ctx.moveTo(x + radius_x, y);
      ctx.lineTo(x + width - radius_x, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius_y);
      ctx.lineTo(x + width, y + height - radius_y);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius_x, y + height);
      ctx.lineTo(x + radius_x, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius_y);
      ctx.lineTo(x, y + radius_y);
      ctx.quadraticCurveTo(x, y, x + radius_x, y);
      ctx.closePath();
      ctx.stroke();
    }

    function drawFocusPointer(slide_index) {
      if(_board.is_private) return;
      if(slide_index != hmtg.jnkernel._jn_iActiveSlideIndex()) return;
      var group_index = slide_index2group_index(slide_index);
      if(group_index == -1) return;

      var slide_list = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var ctx = _board.ctx;
      var ratio = _board.draw_ratio;
      var target = slide_list[group_index];
      if(target.pointer) {
        var p = target.pointer;
        if(p.cx >= 16 || p.cy >= 16) {
          ctx.beginPath();
          ctx.lineWidth = p.width;
          ctx.strokeStyle = color2style(p.color);
          roundRect(ctx, p.x * ratio, p.y * ratio, p.cx * ratio, p.cy * ratio);
        } else {
          ctx.drawImage(_board.pointer_img, (p.x + p.cx / 2) * ratio - (_board.pointer_img.width >> 1), (p.y + p.cy / 2) * ratio - (_board.pointer_img.height >> 1));
        }
      }
    }

    function drawHoverSelect(ratio, ctx) {
      var local_mark = _board.local_mark;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1;
      ctx.strokeStyle = ctx.fillStyle = '#000000';

      var i;
      for(i = 0; i < _board.mark_array.length; i++) {
        var mark = _board.mark_array[i];
        if(local_mark.id_array.indexOf(mark.link._m_iID()) == -1) continue;
        var _mark = mark.link;
        var type = _mark._m_byMarkType();
        var r = null;
        if(type == hmtg.config.MARK_STROKE || type == hmtg.config.MARK_STROKE2) {
          r = calcStrokeRegion(mark, type == hmtg.config.MARK_STROKE ? 100 : _mark._m_zoom());
        } else if(type == hmtg.config.MARK_TEXT || type == hmtg.config.MARK_TEXT2) {
          r = calcTextRegion(mark, type == hmtg.config.MARK_TEXT ? 100 : _mark._m_zoom());
        } else if(type == hmtg.config.MARK_CUSTOMIZED) {
          var type2 = _mark._m_iCustomizedMarkType();
          if((type2 == 1 || type2 == 4 || type2 == 5) && mark.unzipped_data) {
            r = calcImageRegion(mark);
          }
        }
        if(r) {
          drawSingleHoverSelect(r.x * ratio, r.y * ratio, r.w * ratio, r.h * ratio);
        }
      }

      if(local_mark.select_mode && _board.drag_idx != -1) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#808080';
        ctx.strokeRect(local_mark.ax[0] * ratio, local_mark.ay[0] * ratio,
        (local_mark.ax[1] - local_mark.ax[0]) * ratio, (local_mark.ay[1] - local_mark.ay[0]) * ratio);
      }

      ctx.restore();

      function drawSingleHoverSelect(x, y, w, h) {
        ctx.strokeRect(x, y, w, h);
        var R = _board.HANDLE_HALF_WIDTH;
        var D = _board.HANDLE_WIDTH;
        var C = _board.HANDLE_CLOSE_SIZE;
        ctx.fillRect(x + w - R, y + h - R, D, D);
        ctx.fillRect(x + w - R, y + h / 2 - R, D, D);
        ctx.fillRect(x + w / 2 - R, y + h - R, D, D);
        ctx.fillRect(x + w - R, y - R, D, D);
        ctx.fillRect(x - R, y + h - R, D, D);
        ctx.fillRect(x + w / 2 - R, y - R, D, D);
        ctx.fillRect(x - R, y + h / 2 - R, D, D);
        ctx.fillRect(x - R, y - R, D, D);

        // delete button
        ctx.save();
        ctx.fillRect(x - R - C, y - R - C, C, C);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = 'rgb(255,255,255)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - R - C + ctx.lineWidth, y - R - C + ctx.lineWidth);
        ctx.lineTo(x - R - ctx.lineWidth, y - R - ctx.lineWidth);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - R - C + ctx.lineWidth, y - R - ctx.lineWidth);
        ctx.lineTo(x - R - ctx.lineWidth, y - R - C + ctx.lineWidth);
        ctx.stroke();
        ctx.restore();
      }
    }

    function appendTextWidth(text, ft_height) {
      var canvas = _board.canvas_temp;
      var ctx = _board.ctx_temp;
      ctx.font = '' + (ft_height * 0.71) + "px 'Verdana','YuGothic','Hiragino Kaku Gothic ProN','Meiryo','Microsoft Sans Serif','Sans Serif'";

      var utf8 = '';
      var data = new Uint8Array(2048);
      var data_len = 0;
      var i;
      for(i = 0; i < text.length; i++) {
        var adjust = 0;
        var text_code = text.charCodeAt(i);
        if(is_high_surrogate(text_code)) adjust = 1;
        var target = text.slice(i, i + 1 + adjust);
        if(target == '\n' || target == '\t') {
          utf8 += target;
          continue;
        }
        var target_utf8 = hmtg.util.encodeUtf8(target);
        var width = ctx.measureText(target).width >> 0;
        if(width < 255) {
          if(utf8.length + target_utf8.length + 1 + 4 + data_len + 1 >= 2048) {
            return textWithWidth(i - 1);
          }
          data[data_len] = width;
          data_len++;
        } else {
          width = Math.min(width - 255, 65535);
          if(utf8.length + target_utf8.length + 1 + 4 + data_len + 3 >= 2048) {
            return textWithWidth(i - 1);
          }

          data[data_len] = 255;
          data[data_len + 1] = width & 0xff;
          data[data_len + 2] = (width >> 8) & 0xff;
          data_len += 3;
        }
        utf8 += target_utf8;
        i += adjust;
      }
      if(i == 0) return { textEx: '', text: '', height: 20, width_array: [] };
      return textWithWidth(i);

      function textWithWidth(i) {
        var text0 = text.slice(0, i);
        var text2 = utf8;
        text2 += '\0';
        var height_buffer = new Float32Array(1);
        var height_view = new Uint8Array(height_buffer.buffer);
        height_buffer[0] = ft_height;

        text2 += hmtg.util.array2str(height_view);
        text2 += hmtg.util.array2str(data.subarray(0, data_len));
        return { textEx: text2, text: text0, height: ft_height, width_array: data.subarray(0, data_len) };
      }
    }

    function calcActualTextSize() {
      var mark = _board.local_mark;
      mark.m_rect_left = 0;
      mark.m_rect_top = 0;
      mark.m_rect_right = 320;
      mark.m_rect_bottom = 4096;
      var actual_size = draw_text2(_board.ctx_temp, 1.0, _board.local_mark2, _board.color_value, 100);
      if(actual_size.w < mark.m_rect_right * 0.9) {
        mark.m_rect_right = actual_size.w + 5;
        actual_size = draw_text2(_board.ctx_temp, 1.0, _board.local_mark2, _board.color_value, 100);
      }
      mark.m_rect_bottom = actual_size.h;
    }

    function calcActualTextSize2() {
      var mark = _board.local_mark;
      mark.m_rect_left = 0;
      mark.m_rect_top = 0;
      mark.m_rect_right = 320;
      mark.m_rect_bottom = 4096;
      var actual_size = draw_text3(_board.ctx_temp, 1.0, _board.local_mark2, _board.color_value);
      if(actual_size.w < mark.m_rect_right * 0.9) {
        mark.m_rect_right = actual_size.w + 5;
        actual_size = draw_text3(_board.ctx_temp, 1.0, _board.local_mark2, _board.color_value);
      }
      mark.m_rect_bottom = actual_size.h2;
    }

    function drawHoverText(ratio, ctx) {
      if(!_board.text_mark) return;
      var mark = _board.local_mark;
      var text_info = appendTextWidth(_board.text_mark, _board.text_height[_board.text_width]);
      _board.local_mark2.text = text_info.text;
      _board.local_mark2.height = text_info.height;
      _board.local_mark2.width_array = text_info.width_array;
      if(appSetting.text_mark_as_image) {
        calcActualTextSize2();
      } else {
        calcActualTextSize();
      }

      var x, y;
      var default_w = mark.m_rect_right;
      var default_h = mark.m_rect_bottom;
      var w = default_w, h = default_h;
      if(_board.drag_idx == -1) {
        var pos = getMouseMovePos();
        x = pos.x;
        y = pos.y;
        w = default_w, h = default_h;
      } else {
        w = Math.abs(mark.ax[0] - mark.ax[1]);
        h = Math.abs(mark.ay[0] - mark.ay[1]);

        if(w >= 10 && h >= (_board.text_height[_board.text_width] >> 1)) {
          x = Math.min.apply(null, mark.ax);
          y = Math.min.apply(null, mark.ay);
          if(appSetting.text_mark_as_image) {
            if(appSetting.text_rotate == 90) {
              x += w;
              var swap;
              swap = w;
              w = h;
              h = swap;
            } else if(appSetting.text_rotate == 270) {
              y += h;
              var swap;
              swap = w;
              w = h;
              h = swap;
            }
          }
        } else {
          x = mark.ax[1];
          y = mark.ay[1];
          w = default_w, h = default_h;
        }
      }
      mark.m_rect_left = x;
      mark.m_rect_top = y;
      mark.m_rect_right = x + w;
      mark.m_rect_bottom = y + h;

      ctx.save();
      if(_board.drag_idx == -1) {
        ctx.globalAlpha = 0.5;
      }
      if(appSetting.text_mark_as_image) {
        draw_text3(ctx, ratio, _board.local_mark2, _board.color_value);
      } else {
        draw_text2(ctx, ratio, _board.local_mark2, _board.color_value, 100);
      }
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#808080';
      var ratio = _board.ratio;
      ctx.translate(x * ratio, y * ratio);
      if(appSetting.text_mark_as_image && appSetting.text_rotate == 90) {
        ctx.rotate(Math.PI * 0.5);
      } else if(appSetting.text_mark_as_image && appSetting.text_rotate == 270) {
        ctx.rotate(Math.PI * 1.5);
      }
      ctx.strokeRect(0, 0, w * ratio, h * ratio);
      ctx.restore();
    }

    this.draw_stroke3 = function() {
      if(_board.drag_idx == -1) return;
      if(_board.drag_idx != _board.slide_index) return;
      var mark = _board.local_mark;
      if(mark.ax.length < 2) return;

      var ctx3 = _board.ctx;
      var ratio = _board.draw_ratio;
      var color = _board.color_value;
      var ax = mark.ax;
      var ay = mark.ay;

      ctx3.beginPath();
      ctx3.save();

      var i = mark.ax.length - 2;
      if(_board.shape == 'eraser') { // eraser
        //ctx3.save();
        ctx3.lineWidth = 1;
        ctx3.fillStyle = "#333333";
        var r = _board.text_width * 4;
        var r2 = r * 2;

        ctx3.rect((ax[i] - r) * ratio, (ay[i] - r) * ratio,
            r2 * ratio, r2 * ratio);

        i++;
        var shift_x = ax[i] - ax[i - 1];
        var shift_y = ay[i] - ay[i - 1];
        var dis_x = Math.abs(shift_x) >> 0;
        var dis_y = Math.abs(shift_y) >> 0;
        var j, x, y;
        if(dis_x >= dis_y && dis_x > 1) {
          for(j = 0; j < dis_x; j++) {
            x = ax[i] - j * shift_x / dis_x;
            y = ay[i] - j * shift_y / dis_x;
            ctx3.rect((x - r) * ratio, (y - r) * ratio, r2 * ratio, r2 * ratio);
          }
        } else if(dis_y >= dis_x && dis_y > 1) {
          for(j = 0; j < dis_y; j++) {
            x = ax[i] - j * shift_x / dis_y;
            y = ay[i] - j * shift_y / dis_y;
            ctx3.rect((x - r) * ratio, (y - r) * ratio, r2 * ratio, r2 * ratio);
          }
        } else {
          ctx3.rect((ax[i] - r) * ratio, (ay[i] - r) * ratio, r2 * ratio, r2 * ratio);
        }

        ctx3.fill();
        //ctx3.restore();
      } else {
        ctx3.lineCap = "round";
        ctx3.lineJoin = "round";
        ctx3.lineWidth = _board.text_width * ratio;
        ctx3.strokeStyle = color2style(color);

        //if(_board.shape == 'highlight') {  // highlight
        //ctx3.save();
        //ctx3.globalAlpha = 0.5;
        //}

        ctx3.moveTo(ax[i] * ratio, ay[i] * ratio);
        i++;
        ctx3.lineTo(ax[i] * ratio, ay[i] * ratio);

        ctx3.stroke();
        //if(_board.shape == 'highlight') ctx3.restore();
      }

      ctx3.restore();
    }

    this.remove_wait_list_mark = function(new_mark) {
      var idx = _board.wait_list_mark_array.indexOf(new_mark);
      if(idx != -1) {
        if(new_mark.timeout_id) {
          clearTimeout(new_mark.timeout_id);
          new_mark.timeout_id = null;
        }
        _board.wait_list_mark_array.splice(idx, 1);
        _board.draw_slide();
      }
    }

    this.match_wait_list = function(_mark0) {
      var i;
      for(i = 0; i < _board.wait_list_mark_array.length; i++) {
        var _mark = _board.wait_list_mark_array[i];
        if(is_same_mark(_mark, _mark0)) {
          return _mark;
        }
      }
      return null;

      function is_same_mark(mark1, mark2) {
        if(mark1._m_byMarkType() != mark2._m_byMarkType()) return false;
        if(mark1._m_byMarkType() == hmtg.config.MARK_STROKE2) {
          if(mark1._m_iShape() != mark2._m_iShape()) return false;
          if(mark1._m_nPenWidth() != mark2._m_nPenWidth()) return false;
          if(mark1._m_iColor() != mark2._m_iColor()) return false;
          if(mark1._ax().length != mark2._ax().length) return false;
          var i;
          for(i = 0; i < mark1._ax().length; i++) {
            if(mark1._ax()[i] != mark2._ax()[i]) return false;
            if(mark1._ay()[i] != mark2._ay()[i]) return false;
          }
          return true;
        } else if(mark1._m_byMarkType() == hmtg.config.MARK_TEXT2) {
          if(mark1._m_nPenWidth() != mark2._m_nPenWidth()) return false;
          if(mark1._m_iColor() != mark2._m_iColor()) return false;
          if(mark1._m_rect_left() != mark2._m_rect_left()) return false;
          if(mark1._m_rect_top() != mark2._m_rect_top()) return false;
          if(mark1._m_rect_right() != mark2._m_rect_right()) return false;
          if(mark1._m_rect_bottom() != mark2._m_rect_bottom()) return false;
          if(mark1._m_szContent() != mark2._m_szContent()) return false;
          return true;
        } else if(mark1._m_byMarkType() == hmtg.config.MARK_CUSTOMIZED) {
          var size1 = mark1.internal_bmp_size ? mark1.internal_bmp_size : mark1._m_pCustomizedMarkData().length;
          var size2 = mark2.internal_bmp_size ? mark2.internal_bmp_size : mark2._m_pCustomizedMarkData().length;
          if(size1 != size2) return false;
          return true;
        } else if(mark1._m_byMarkType() == hmtg.config.MARK_MOVE) {
          if(mark1._m_offset_x() != mark2._m_offset_x()) return false;
          if(mark1._m_offset_y() != mark2._m_offset_y()) return false;
          if(mark1._m_move_type() != mark2._m_move_type()) {
            // special case
            // mark1 is relative move in wait list; while mark2 is received from MCU, which convert the relative move to referenced move
            if(mark1._m_move_type() - 100 == mark2._m_move_type()) {
              var a1 = mark1._id_array();
              var a2 = mark2._id_array();
              // a2 could be longer due to that MCU insert reference to a1
              if(a1.length > a2.length) return false;
              if(a1.length == 0) return false;
              if(a1[0] != a2[0]) return false;
              var ii;
              var jj;
              for(ii = 1, jj = 1; ii < a1.length; ii++, jj++) {
                if(jj >= a2.length) return false; // run out of items
                if(a1[ii] == a2[jj]) {
                } else {
                  jj++; // the previous item may insert a reference ID, skip it and try again for the next item
                  if(jj >= a2.length) return false; // run out of items
                  if(a1[ii] != a2[jj]) return false;  // this pair must be the same
                }
              }
              if(jj != a2.length && jj + 1 != a2.length) return false;  // the a2 should be used up or only the last reference ID left
              return true;
            } else {
              return false;
            }
          }
          var a1 = mark1._id_array();
          var a2 = mark2._id_array();
          if(a1.length != a2.length) return false;
          var ii;
          for(ii = 0; ii < a1.length; ii++) {
            if(a1[ii] != a2[ii]) return false;
          }
          return true;
        }
        return false;
      }
    }

    this.send_text_mark = function() {
      if(!_board.text_mark) return;
      var slide_index = _board.slide_index >> 0;
      if(_board.drag_idx != slide_index) return;
      var mark = _board.local_mark;
      var text_info = appendTextWidth(_board.text_mark, _board.text_height[_board.text_width]);
      if(!appSetting.text_mark_as_image && text_info.textEx.length >= 2048) {
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_ADD_MARK_FAILED').replace('#error#', $translate.instant('ID_TEXT_MARK_TOO_LONG')) }, 20);
        return;
      }
      _board.local_mark2.text = text_info.text;
      _board.local_mark2.height = text_info.height;
      _board.local_mark2.width_array = text_info.width_array;
      if(appSetting.text_mark_as_image) {
        calcActualTextSize2();
      } else {
        calcActualTextSize();
      }

      var x, y;
      var default_w = mark.m_rect_right;
      var default_h = mark.m_rect_bottom;
      var w = default_w, h = default_h;
      var mark = _board.local_mark;
      w = Math.abs(mark.ax[0] - mark.ax[1]);
      h = Math.abs(mark.ay[0] - mark.ay[1]);

      if(w >= 10 && h >= (_board.text_height[_board.text_width] >> 1)) {
        x = Math.min.apply(null, mark.ax);
        y = Math.min.apply(null, mark.ay);
        if(appSetting.text_mark_as_image) {
          if(appSetting.text_rotate == 90) {
            x += w;
            var swap;
            swap = w;
            w = h;
            h = swap;
          } else if(appSetting.text_rotate == 270) {
            y += h;
            var swap;
            swap = w;
            w = h;
            h = swap;
          }
        }
      } else {
        x = mark.ax[1];
        y = mark.ay[1];
        w = default_w, h = default_h;
      }

      if(appSetting.text_mark_as_image) {
        var canvas = _board.canvas_temp;
        if(appSetting.text_rotate == 90 || appSetting.text_rotate == 270) {
          canvas.width = h;
          canvas.height = w;
        } else {
          canvas.width = w;
          canvas.height = h;
        }
        var mark = _board.local_mark;
        if(appSetting.text_rotate == 90) {
          mark.m_rect_left = h;
          mark.m_rect_top = 0;
          mark.m_rect_right = h + w;
          mark.m_rect_bottom = h;
          x -= h;
        } else if(appSetting.text_rotate == 270) {
          mark.m_rect_left = 0;
          mark.m_rect_top = w;
          mark.m_rect_right = w;
          mark.m_rect_bottom = w + h;
          y -= w;
        } else {
          mark.m_rect_left = 0;
          mark.m_rect_top = 0;
          mark.m_rect_right = w;
          mark.m_rect_bottom = h;
        }
        draw_text3(_board.ctx_temp, 1.0, _board.local_mark2, _board.color_value);

        var url = canvas.toDataURL();
        var parts = url.split(',');
        var byteString;
        if(parts[0].indexOf('base64') >= 0)
          byteString = hmtg.util.decode64(parts[1]);
        else
          byteString = unescape(parts[1]);

        if(byteString.length > 500000 - 4) {
          hmtg.util.log(-1, 'Warning, converted text mark too large, size=' + byteString.length
            + ', imgWidth=' + w
            + ', imgHeight=' + h
            + ', text=' + text_info.text
            + ', boardTextWidth=' + _board.text_width
            + ', boardTextHeight=' + _board.text_height[_board.text_width]
            );
          hmtgSound.ShowErrorPrompt(function() {
            return $translate.instant('ID_ADD_MARK_FAILED')
              .replace('#error#', $translate.instant('ID_TEXT_MARK_TOO_LARGE'))
          }, 20);
          return;
        }
        var png = hmtg.util.str2array(byteString);
        //hmtg.util.log(-1, '******debug, converted png size=' + png.length);

        var new_mark;
        if(!_board.is_private) {
          new_mark = _board.create_SendImageMark(slide_index, 5, x, y, canvas.width, canvas.height, 100, png, 0);
          if(new_mark) {
            _board.wait_list_mark_array.push(new_mark);
            if(_board.wait_list_mark_array.length == 1) {
              $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
            }
          }
        }

        if(1 || appSetting.use_png_mark) {
          send_action(slide_index, 5, x, y, canvas.width, canvas.height, 100, png, 0);
          if(!_board.is_private && new_mark) {
            new_mark.timeout_id = setTimeout(function() {
              _board.remove_wait_list_mark(new_mark);
            }, _board.WAIT_LIST_TIMEOUT);
          }
          return;
        }

        /*
        hmtgHelper.img2BMP32bit(canvas, 0, function(output, orig_size) {
          if(output.length > 500000 - 4) {
            hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_ADD_MARK_FAILED').replace('#error#', $translate.instant('ID_TEXT_MARK_TOO_LONG')) }, 20);
            remove_wait_list_mark();
          } else {
            send_action(slide_index, 4,
              x + (canvas.width >> 1), y + (canvas.height >> 1), 0, 0,
              100, output, orig_size);
            if(_board.is_private) _board.draw_slide();
          }
        }, function() {
          hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_ADD_MARK_FAILED').replace('#error#', $translate.instant('ID_IMAGE_MARK_CONVERSION_ERROR')) }, 20);
          remove_wait_list_mark();
        });
        */
      } else {
        if(_board.is_private) {
          _board.private_SendNewText(slide_index, _board.color_value, _board.text_width,
          x, y, w, h, text_info.textEx
          );
        } else {
          var new_mark = _board.create_SendNewText(slide_index, _board.color_value, _board.text_width,
          x, y, w, h, text_info.textEx
          );
          if(new_mark) {
            // for wait list mark
            new_mark.internal_text = text_info.text;
            new_mark.internal_height = text_info.height;
            new_mark.internal_width_array = text_info.width_array;

            _board.wait_list_mark_array.push(new_mark);
            if(_board.wait_list_mark_array.length == 1) {
              $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
            }
            new_mark.timeout_id = setTimeout(function() {
              _board.remove_wait_list_mark(new_mark);
            }, _board.WAIT_LIST_TIMEOUT);
          }
          hmtg.jnkernel.jn_command_SendNewText(slide_index, _board.color_value, _board.text_width,
          x, y, w, h, text_info.textEx
          );
        }
      }
      function remove_wait_list_mark() {
        if(!new_mark) return;
        var idx = _board.wait_list_mark_array.indexOf(new_mark);
        if(idx != -1) {
          _board.wait_list_mark_array.splice(idx, 1);
        }
      }

      function send_action(index, image_type, x, y, cx, cy, zoom, png, orig_size) {
        if(_board.is_private) {
          _board.private_SendImageMark(index, image_type, x, y, cx, cy, zoom, png, orig_size);
        } else {
          if(image_type == 4 && new_mark) {
            new_mark.internal_bmp_size = 4 + png.length; // indicate that this mark is converted to bmp format
            new_mark.timeout_id = setTimeout(function() {
              _board.remove_wait_list_mark(new_mark);
            }, _board.WAIT_LIST_TIMEOUT);
          }
          hmtg.jnkernel.jn_command_SendImageMark(index, image_type, x, y, cx, cy, zoom, png, orig_size);
        }
      }
    }

    function get_image_mark_scale() {
      return 1;
    }

    function get_image_mark() {
      return _board.selected_mark;
    }

    function drawHoverImage(ratio, ctx) {
      if(!_board.selected_mark) return;
      var imk = get_image_mark();
      var scale = get_image_mark_scale();
      var x, y;
      if(_board.drag_idx == -1) {
        var pos = getMouseMovePos();
        x = pos.x;
        y = pos.y;
      } else {
        var mark = _board.local_mark;
        var w = Math.abs(mark.ax[0] - mark.ax[1]);
        var h = Math.abs(mark.ay[0] - mark.ay[1]);

        if(_board.multi_touch) {
          scale = Math.max(w / imk.width, h / imk.height);
          x = (mark.ax[0] + mark.ax[1]) >> 1;
          y = (mark.ay[0] + mark.ay[1]) >> 1;
        } else if(w + h >= 24 || w + h >= ((imk.width + imk.height) >> 1)) {
          scale = Math.max((w + w) / imk.width, (h + h) / imk.height);
          x = mark.ax[0];
          y = mark.ay[0];
        } else {
          x = mark.ax[1];
          y = mark.ay[1];
        }
      }

      x = (x - (imk.width * scale >> 1)) * ratio;
      y = (y - (imk.height * scale >> 1)) * ratio;
      var w = imk.width * scale * ratio;
      var h = imk.height * scale * ratio;
      ctx.save();
      if(imk.img && imk.img.width) {
        if(_board.drag_idx == -1) {
          ctx.globalAlpha = 0.5;
        }
        ctx.drawImage(imk.img, 0, 0, imk.width, imk.height, x, y, w, h);
      } else {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#FF0000";
        ctx.fillRect(x, y, w, h);
      }
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#808080';
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    this.send_image_mark = function() {
      if(!_board.selected_mark) return;
      var imk = get_image_mark();
      var scale = get_image_mark_scale();
      var x, y;
      var slide_index = _board.slide_index >> 0;
      if(_board.drag_idx != slide_index) return;
      var mark = _board.local_mark;
      var w = Math.abs(mark.ax[0] - mark.ax[1]);
      var h = Math.abs(mark.ay[0] - mark.ay[1]);

      if(_board.multi_touch) {
        scale = Math.max(w / imk.width, h / imk.height);
        x = (mark.ax[0] + mark.ax[1]) >> 1;
        y = (mark.ay[0] + mark.ay[1]) >> 1;
      } else if(w + h >= 24 || w + h >= ((imk.width + imk.height) >> 1)) {
        scale = Math.max((w + w) / imk.width, (h + h) / imk.height);
        x = mark.ax[0];
        y = mark.ay[0];
      } else {
        x = mark.ax[1];
        y = mark.ay[1];
      }

      var new_mark;
      if(!_board.is_private) {
        new_mark = _board.create_SendImageMark(slide_index, 5,
          (x - (imk.width * scale >> 1)), (y - (imk.height * scale >> 1)),
          (imk.width * scale >> 0), (imk.height * scale >> 0),
          100,
          imk.data, 0);
        if(new_mark) {
          _board.wait_list_mark_array.push(new_mark);
          if(_board.wait_list_mark_array.length == 1) {
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
          }
        }
      }

      if(1 || appSetting.use_png_mark) {
        send_action(slide_index, 5,
          (x - (imk.width * scale >> 1)), (y - (imk.height * scale >> 1)),
          (imk.width * scale >> 0), (imk.height * scale >> 0),
          100,
          imk.data, 0);
        if(!_board.is_private && new_mark) {
          new_mark.timeout_id = setTimeout(function() {
            _board.remove_wait_list_mark(new_mark);
          }, _board.WAIT_LIST_TIMEOUT);
        }
        return;
      }

      /*
      if(!imk.img || !imk.img.width) {
        remove_wait_list_mark();
        return;
      }
      hmtgHelper.img2BMP32bit(imk.img, 0, function(output, orig_size) {
        if(output.length > _board.max_single_mark_size) {
          scale *= imk.width / (imk.width >> 1);
          hmtgHelper.img2BMP32bit(imk.img, 1, function(output, orig_size) {
            if(output.length > _board.max_single_mark_size) {
              scale *= (imk.width >> 1) / (imk.width >> 2);
              hmtgHelper.img2BMP32bit(imk.img, 2, function(output, orig_size) {
                if(output.length > 500000 - 4) {
                  // give up
                  hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_ADD_MARK_FAILED').replace('#error#', $translate.instant('ID_IMAGE_MARK_TOO_LARGE')) }, 20);
                  remove_wait_list_mark();
                } else {
                  send_action(slide_index, 4,
                    (x / scale >> 0), (y / scale >> 0), 0, 0,
                    (100 / scale >> 0),
                    output, orig_size);
                  if(_board.is_private) _board.draw_slide();
                }
              }, function() {
                hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_ADD_MARK_FAILED').replace('#error#', $translate.instant('ID_IMAGE_MARK_CONVERSION_ERROR')) }, 20);
                remove_wait_list_mark();
              });
            } else {
              send_action(slide_index, 4,
                (x / scale >> 0), (y / scale >> 0), 0, 0,
                (100 / scale >> 0),
                output, orig_size);
              if(_board.is_private) _board.draw_slide();
            }
          }, function() {
            hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_ADD_MARK_FAILED').replace('#error#', $translate.instant('ID_IMAGE_MARK_CONVERSION_ERROR')) }, 20);
            remove_wait_list_mark();
          });
        } else {
          send_action(slide_index, 4,
            (x / scale >> 0), (y / scale >> 0), 0, 0,
            (100 / scale >> 0),
            output, orig_size);
          if(_board.is_private) _board.draw_slide();
        }
      }, function() {
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_ADD_MARK_FAILED').replace('#error#', $translate.instant('ID_IMAGE_MARK_CONVERSION_ERROR')) }, 20);
        remove_wait_list_mark();
      });
      */

      function remove_wait_list_mark() {
        if(!new_mark) return;
        var idx = _board.wait_list_mark_array.indexOf(new_mark);
        if(idx != -1) {
          _board.wait_list_mark_array.splice(idx, 1);
        }
      }

      function send_action(index, image_type, x, y, cx, cy, zoom, png, orig_size) {
        if(_board.is_private) {
          _board.private_SendImageMark(index, image_type, x, y, cx, cy, zoom, png, orig_size);
        } else {
          if(image_type == 4 && new_mark) {
            new_mark.internal_bmp_size = 4 + png.length; // indicate that this mark is converted to bmp format
            new_mark.timeout_id = setTimeout(function() {
              _board.remove_wait_list_mark(new_mark);
            }, _board.WAIT_LIST_TIMEOUT);
          }
          hmtg.jnkernel.jn_command_SendImageMark(index, image_type, x, y, cx, cy, zoom, png, orig_size);
        }
      }
    }

    function getMouseMovePos() {
      // get the visible image area coordinates (origin is the top-left corner of board0!)
      // the following assumes that board0's offset parent is container or that board0 and container share the same offset parent
      var board0_offset_left = _board.board0.offsetLeft;
      var board0_offset_top = _board.board0.offsetTop;
      if(_board.board0.offsetParent != _board.container) {
        board0_offset_left = _board.board0.offsetLeft - _board.container.offsetLeft;
        board0_offset_top = _board.board0.offsetTop - _board.container.offsetTop;
      }
      var boundary_adjust_x = Math.min(board0_offset_left, _board.container.scrollLeft + _board.board_container2.scrollLeft);
      var boundary_adjust_y = Math.min(board0_offset_top, _board.container.scrollTop + _board.board_container2.scrollTop);
      var x;
      var y;
      if(!_board.mousemove_detected
      //|| _board.mousemove_x + boundary_adjust_x < 0 || _board.mousemove_y + boundary_adjust_y < 0
      ) {
        var x0 = -boundary_adjust_x;
        var w0 = _board.container.clientWidth - Math.max(0, board0_offset_left - _board.container.scrollLeft - _board.board_container2.scrollLeft);
        var y0 = -boundary_adjust_y;
        var h0 = _board.container.clientHeight - Math.max(0, board0_offset_top - _board.container.scrollTop - _board.board_container2.scrollTop);
        w0 = Math.max(0, Math.min(w0, _board.mywidth * _board.ratio - Math.max(0, _board.container.scrollLeft + _board.board_container2.scrollLeft - board0_offset_left)));
        h0 = Math.max(0, Math.min(h0, _board.myheight * _board.ratio - Math.max(0, _board.container.scrollTop + _board.board_container2.scrollTop - board0_offset_top)));
        x = x0 + w0 / 2;
        y = y0 + h0 / 2;
      } else {
        x = _board.mousemove_x;
        y = _board.mousemove_y;
      }
      x = _board.transformX(x);
      y = _board.transformY(y);
      x = Math.min(x, _board.mywidth);
      y = Math.min(y, _board.myheight);

      return { x: x, y: y };
    }

    function drawQuickLocalMark() {
      if(_board.drag_idx == -1) return;
      if(_board.drag_idx != _board.slide_index) return;
      if(_board.shape == 'line'
            || _board.shape == 'rect'
            || _board.shape == 'rect2'
            || _board.shape == 'ellipse'
            || _board.shape == 'ellipse2'
            || _board.shape == 'freehand'
      //|| _board.shape == 'eraser'
            || _board.shape == 'highlight'
            ) {
        var mark = _board.local_mark;
        mark.m_nPenWidth = _board.text_width;
        if(_board.shape == 'rect2' || _board.shape == 'ellipse2') {
          mark.ax[2] = mark.ax[1];
          mark.ay[2] = mark.ay[1];
        }
        draw_stroke2(_board.ctx, _board.draw_ratio, _board.local_mark2, _board.color_value, 100);
      } else if(_board.shape == 'image') {
        drawHoverImage(_board.draw_ratio, _board.ctx);
      } else if(_board.shape == 'text') {
        drawHoverText(_board.draw_ratio, _board.ctx);
      }
    }

    function drawMouseMoveItems() {
      if(_board.drag_idx != -1) return;
      if(!_board.is_private) {
        if(!hmtg.jnkernel._jn_bConnected()) return;
        if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
        if(!hmtg.jnkernel.jn_info_CanAddMark()) return;
      }

      var slide_index = _board.slide_index >> 0;
      if(slide_index < 0) return;
      var slide_array = _board.is_local_slide ? _board.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= slide_array.length) return;
      if(_board.slide_type != 0) return;

      if(!_board.is_private) {
        // is controller or on the active slide
        if(!(hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_iActiveSlideIndex() == slide_index)) return;
      }
      //if(_board.shape == 'eraser') {  // draw the eraser hover image }
      if(_board.shape == 'image') {
        drawHoverImage(_board.draw_ratio, _board.ctx);
      } else if(_board.shape == 'text') {
        drawHoverText(_board.draw_ratio, _board.ctx);
      } else if(_board.shape == 'eraser') {
        drawHoverEraser();
      }
    }

    function drawHoverEraser() {
      var x, y;
      if(_board.drag_idx != -1) return;
      var pos = getMouseMovePos();
      x = pos.x;
      y = pos.y;

      var ctx = _board.ctx;
      var ratio = _board.draw_ratio;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.fillStyle = "#333333";
      ctx.beginPath();
      var r = _board.text_width * 4;
      var r2 = _board.text_width * 8;
      ctx.rect((x - r) * ratio,
        (y - r) * ratio,
        r2 * ratio, r2 * ratio);
      ctx.fill();
      ctx.restore();
    }

    function drawLocalEraser() {
      if(!(_board.drag_idx != -1 && _board.drag_idx == _board.slide_index)) return;
      if(_board.shape != 'eraser') return;
      if(!_board.local_mark.ax) return;
      if(!_board.local_mark.ax.length) return;
      var ctx = _board.ctx;
      var ratio = _board.draw_ratio;
      ctx.lineWidth = 1;
      ctx.fillStyle = "#333333";
      ctx.beginPath();
      var r = _board.text_width * 4;
      var r2 = _board.text_width * 8;
      ctx.rect((_board.local_mark.ax[_board.local_mark.ax.length - 1] - r) * ratio,
        (_board.local_mark.ay[_board.local_mark.ay.length - 1] - r) * ratio,
        r2 * ratio, r2 * ratio);
      ctx.fill();
    }

    function drawLocalFocusPointer() {
      if(_board.drag_idx == -1) return;
      if(_board.drag_idx != _board.slide_index) return;
      if(_board.shape != 'pointer') return;
      var ctx = _board.ctx;
      var ratio = _board.draw_ratio;
      var mark = _board.local_mark;
      var x1 = Math.min(mark.ax[0], mark.ax[1]);
      var y1 = Math.min(mark.ay[0], mark.ay[1]);
      var x2 = Math.max(mark.ax[0], mark.ax[1]);
      var y2 = Math.max(mark.ay[0], mark.ay[1]);
      var cx = x2 - x1;
      var cy = y2 - y1;

      if(cx >= 16 || cy >= 16) {
        ctx.beginPath();
        ctx.lineWidth = _board.text_width;
        ctx.strokeStyle = color2style(_board.color_value);
        roundRect(ctx, x1 * ratio, y1 * ratio, cx * ratio, cy * ratio);
      } else {
        ctx.drawImage(_board.pointer_img, (x1 + cx / 2) * ratio - (_board.pointer_img.width >> 1), (y1 + cy / 2) * ratio - (_board.pointer_img.height >> 1));
      }
    }

    function drawPrivateShade() {
      var ctx = _board.ctx;
      ctx.fillStyle = _board.is_local_slide ? "rgba(255,128,0,0.1)" : "rgba(128,255,0,0.1)";
      ctx.fillRect(0, 0, _board.canvas.width, _board.canvas.height);
      ctx.fillStyle = "rgba(128,128,255,0.5)";
      ctx.font = "48px 'Verdana','YuGothic','Hiragino Kaku Gothic ProN','Meiryo','Microsoft Sans Serif','Sans Serif'";
      ctx.lineWidth = 1;
      ctx.fillText($translate.instant(_board.is_local_slide ? 'ID_TOGGLE_LOCAL_SLIDE' : 'ID_TOGGLE_PRIVATE_NOTE'), 10, 50);
    }

    function color2style(color) {
      // in windows, it is BGR
      // in browser, it is RGB
      var b = (color >> 16) & 0xff;
      var g = (color >> 8) & 0xff;
      var r = color & 0xff;
      var style = 'rgb(' + r + ',' + g + ',' + b + ')';
      return style;
    }

    function calc_mime_type(name) {
      var name = name.toLowerCase();
      var type = 'application/octet-stream';
      if(hmtg.util.endsWith(name, '.jpg') || hmtg.util.endsWith(name, '.jpeg')) {
        type = 'image/jpeg';
      } else if(hmtg.util.endsWith(name, '.gif')) {
        type = 'image/gif';
      } else if(hmtg.util.endsWith(name, '.svg')) {
        type = 'image/svg+xml';
      } else if(hmtg.util.endsWith(name, '.png')) {
        type = 'image/png';
      } else if(hmtg.util.endsWith(name, '.bmp')) {
        type = 'image/bmp';
      }
      return hmtgHelper.isiOS ? 'text/plain' : type;
    }

    this.save0 = function() {
      var slide_index = _board.slide_index >> 0;
      if(slide_index < 0) return;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= slide_array.length) return;
      var slide = slide_array[slide_index];
      if(slide._is_blank_page() || slide._m_bDeleted() || slide._downloaded() != 1) return;
      var name = hmtg.util.decodeUtf8(slide._m_szName());
      var orig_name = calc_original_name(name);
      var mime_type = calc_mime_type(orig_name);

      if(is_slide_compressed(name)) {
        var unzip = new hmtgHelper.decompress('unzip', slide._data(), function(output) {
          try {
            if(hmtgHelper.isiOS) {
              hmtgAlert.add_blob_download_item(new Blob([output], { type: mime_type }), orig_name);
            } else {
              hmtgHelper.save_file(new Blob([output], { type: mime_type }), orig_name);
            }
          } catch(e) {
            hmtg.util.log('Warning! error occurs when saving slide');
          }
        }, function() {
        });
        return;
      } else {
        try {
          if(hmtgHelper.isiOS) {
            hmtgHelper.inside_angular++;
            hmtgAlert.add_blob_download_item(new Blob([slide._data()], { type: mime_type }), orig_name);
            hmtgHelper.inside_angular--;
          } else {
            hmtgHelper.save_file(new Blob([slide._data()], { type: mime_type }), orig_name);
          }
        } catch(e) {
          hmtg.util.log('Warning! error occurs when saving slide');
        }
      }
    }

    this.save = function() {
      var slide_index = _board.slide_index >> 0;
      if(slide_index < 0) return;
      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= slide_array.length) return;
      if(!_board.canvas3_ready) return;

      var slide = slide_array[slide_index];
      var name = hmtg.util.decodeUtf8(slide._m_szName());
      name = calc_original_name(name) + '-snapshot.png';

      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext('2d');
      var w = canvas.width = _board.zoomed_width;
      var h = canvas.height = _board.zoomed_height;
      ctx.drawImage(_board.canvas3, 0, 0, w, h, 0, 0, w, h);

      try {
        if(canvas.toBlob) {
          canvas.toBlob(function(blob) {
            if(hmtgHelper.isiOS) {
              hmtgAlert.add_blob_download_item(blob, name);
            } else {
              hmtgHelper.save_file(blob, name);
            }
          });
        } else {
          var url = canvas.toDataURL();
          if(hmtgHelper.isiOS) {
            hmtgHelper.inside_angular++;
            hmtgAlert.add_blob_download_item(hmtgHelper.url2blob(url), name);
            hmtgHelper.inside_angular--;
          } else {
            hmtgHelper.save_file(hmtgHelper.url2blob(url), name);
          }
        }
      } catch(e) {
        hmtg.util.log('Warning! error occurs when saving slide');
      }
    }

    this.fullscreen1 = function() {
      hmtgHelper.inside_angular++;
      this.turnon_fullscreen();
      this.is_passive_fullscreen = false;
      joinnetHelper.change_fullscreen_mode(1, hmtg.config.TAB_VIEW_BOARD);
      hmtgHelper.inside_angular--;
    }
    this.turnon_fullscreen = function() {
      if(this.request_fullscreen) {
        this.request_fullscreen.call(this.container);
        var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

        this.is_fullscreen = fullscreenElement == this.container;
      }
    }

    this.fullscreen0 = function() {
      hmtgHelper.inside_angular++;
      this.turnoff_fullscreen();
      joinnetHelper.change_fullscreen_mode(0, hmtg.config.TAB_VIEW_BOARD);
      hmtgHelper.inside_angular--;
    }
    this.turnoff_fullscreen = function() {
      hmtgHelper.exitFullScreen();
      this.is_fullscreen = false;
      this.is_passive_fullscreen = false;
    }

    function handleFileSelect(evt) {
      if(!_board.can_upload()) return;
      evt.stopPropagation();
      evt.preventDefault();

      var files = evt.dataTransfer.files; // FileList object.
      var file = files[0];
      if(!file) return;
      $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_SLIDE, 2, file);
    }

    function handleDragOver(evt) {
      evt.stopPropagation();
      evt.preventDefault();
      evt.dataTransfer.dropEffect = _board.can_upload() ? 'copy' : 'none';
    }

    this.can_force_sync = function() {
      if(hmtg.jnkernel._jn_bConnected() && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL) {
        if(hmtg.jnkernel._is_sync_ssrc()) return true;
      }
      return false;
    }

    this.toggle_sync_mode = function() {
      this.is_sync = !this.is_sync;
      if(this.is_sync && !this.is_private) {
        if(this.slide_index != hmtg.jnkernel._jn_iActiveSlideIndex()) {
          hmtgHelper.inside_angular++;
          this.callback_FlipSlide(0, hmtg.jnkernel._jn_iActiveSlideIndex(), true);
          hmtgHelper.inside_angular--;
        }
      }
    }

    this.force_sync = function() {
      if(!hmtg.jnkernel._is_sync_ssrc()) return;
      if(this.is_private) return;
      hmtg.jnkernel.jn_command_ForceSync();
    }

    this.callback_ForceSync = function() {
      if(!this.is_sync) {
        this.is_sync = true;
        if(this.slide_index != hmtg.jnkernel._jn_iActiveSlideIndex()) {
          this.callback_FlipSlide(0, hmtg.jnkernel._jn_iActiveSlideIndex(), true);
        }
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    this.can_upload = function(ignore_local_slide) {
      if(!ignore_local_slide && this.is_local_slide) {
        return _board.upload_finished;
      }

      return hmtg.jnkernel._jn_bConnected()
      && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
      && !hmtg.jnkernel._jn_disable_upload_file()
      && (hmtg.jnkernel.jn_info_IsTalker() || hmtg.jnkernel._jn_bTokenOwner())
      && _board.upload_finished
      && !this.dummy_conversion
      && !hmtg.jnkernel._jn_conversion_count();
    }

    this.show_converting = function() {
      return hmtg.jnkernel._jn_conversion_count() || this.dummy_conversion;
    }

    this.stop_upload = function() {
      if(_board.upload_thread) {
        hmtgHelper.inside_angular++;
        _board.upload_thread.stop();
        hmtgHelper.inside_angular--;
        _board.upload_thread = null;
      }
    }

    this.upload_slide = function(upload_type, groupname, title, file, png_blob) {
      hmtgHelper.inside_angular++;
      _board.upload_thread = new upload(upload_type, groupname, title, file, png_blob);
      hmtgHelper.inside_angular--;
    }

    function upload(upload_type, groupname, title, file, png_blob) {
      var _upload = this;
      _upload.is_local_slide = _board.is_local_slide;
      _upload.stop = function() { }

      var need_zip = false;
      var compression_type = 2;
      var cf_ext_array = [
			'.acp', '.aif', '.aiff', '.arc', '.arj',
			'.b64', '.bhx', '.cab', '.chm', '.gif',
			'.gz', '.gzip', '.hqx', '.jpe', '.jpeg',
			'.jpg', '.lzh', '.m1v', '.m2v', '.mim',
			'.mov', '.mp2v', '.mp3', '.mp4', '.mpe',
			'.mpeg', '.mpg', '.mpga', '.mps', '.mpv',
			'.mpv2', '.png', '.ra', '.rar', '.rm',
			'.taz', '.tgz', '.tz', '.z', '.zip'
      ];
      if(upload_type == 2) {
        var name = file.name.toLowerCase();
        if(png_blob) {
        } else if(hmtg.util.endsWith(name, '.jpg')
          || hmtg.util.endsWith(name, '.jpeg')
          || hmtg.util.endsWith(name, '.gif')
          || hmtg.util.endsWith(name, '.svg')
          || hmtg.util.endsWith(name, '.png')
        ) {
        } else if(hmtg.util.endsWith(name, '.bmp')
        ) {
          need_zip = true;
        } else {
          need_zip = true;
          var old_ext = hmtg.util.getExt(file.name).toLowerCase();
          if(old_ext && cf_ext_array.indexOf(old_ext) != -1) {
            compression_type = 0;
          }
        }
      } else if(upload_type == 3) {
        need_zip = true;
        var old_ext = hmtg.util.getExt(file.name).toLowerCase();
        if(old_ext && cf_ext_array.indexOf(old_ext) != -1) {
          compression_type = 0;
        }
      }

      if(upload_type != 1) {
        var reader = new FileReader();

        reader.onload = function(e) {
          if(need_zip) {
            if(e.target.result.byteLength > appSetting.max_zip_size * 1000000) compression_type = 0;
            var zip = new hmtgHelper.compress('zip', new Uint8Array(e.target.result), compression_type, function(output) {
              //hmtg.util.log(-2, '******debug, gzip type ' + compression_type + ', input=' + e.target.result.byteLength + ',output=' + output.length);
              upload_data(upload_type, groupname, title, output);
            }, function() {
              _board.upload_finished = true;
              _upload.stop = function() { }
              _board.show_upload_progress = false;
              $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
            });
            // the following line require that the above thread MUST take asynchronous onfinish
            _board.upload_pos = $translate.instant('ID_UPLOAD_COMPRESSING');
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
            _upload.stop = function() {
              zip.stop();
              _board.upload_finished = true;
              _upload.stop = function() { }
              _board.show_upload_progress = false;
              $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
            }
            return;
          }
          upload_data(upload_type, groupname, title, new Uint8Array(e.target.result));
        };
        reader.onerror = function(e) {
          _board.upload_finished = true;
          _upload.stop = function() { }
          _board.show_upload_progress = false;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        };

        reader.readAsArrayBuffer(png_blob ? png_blob : file);
        _board.show_upload_progress = true;
        _board.upload_pos = $translate.instant('ID_UPLOAD_READING');
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);

        _upload.stop = function() {
          reader.abort();
          _board.upload_finished = true;
          _upload.stop = function() { }
          _board.show_upload_progress = false;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        }
      } else {
        upload_data(upload_type, groupname, title, null);
      }

      function upload_data(upload_type, groupname, title, data) {
        if(_upload.is_local_slide) {
          var slide = new SlideEntry();
          slide.m_iSource = -1;
          slide.m_szName = title;
          slide.m_bDeleted = 0;
          slide.m_szGroup = groupname;
          slide.m_szOwnerName = '';
          slide.downloaded = 1;
          slide.data = data;
          if(data) {
            _board.memory_usage += data.length;
          }

          if(hmtg.util.endsWith(slide.m_szName, 'blank page')) {
            slide.is_blank_page = true;
          }

          slide.index = _board.localSlideArray.length;
          _board.localSlideArray.push(slide);

          slide.m_iGroupIndex = 0;
          if(slide.m_szGroup) {
            for(var i = _board.localSlideArray.length - 2; i >= 0; i--) {
              var slide0 = _board.localSlideArray[i];
              if(slide0.m_szGroup == slide.m_szGroup
                && slide0.m_szOwnerName == slide.m_szOwnerName
                && slide0.m_iSource == slide.m_iSource) {
                slide.m_iGroupIndex = slide0.m_iGroupIndex + 1;
                break;
              }
            }
          }
          _board.upload_finished = true;
          _board.show_upload_progress = false;
          _board.add_slide(slide, true);
          return;
        }

        _board.new_upload = true;
        hmtg.jnkernel.jn_command_UploadSlide(upload_type, groupname, title, data, function() {
          _board.show_upload_progress = false;
          _board.upload_finished = true;
          _upload.stop = function() { }
          // if this is a conversion, setup dummy converison timer
          if(upload_type == 2 && hmtg.util.endsWith(title, '.jzf')) {
            _board.stop_dummy_conversion_timer();
            _board.dummy_conversion = true;
            _board.dummy_conversion_timerID = setTimeout(function() {
              _board.dummy_conversion_timerID = null;
              _board.dummy_conversion = false;
              $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
            }, 60000);
          }
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        }, function(pos) {
          _board.show_upload_progress = true;
          var p = (pos * 1000) >>> 0;
          _board.upload_pos = '' + (p / 10) + '%';
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        }, function() {
          _board.show_upload_progress = false;
          _board.upload_finished = true;
          _upload.stop = function() { }
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        });
        _board.upload_pos = '0%';
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        _upload.stop = function() {
          hmtg.jnkernel.jn_command_StopSlideUpload();
          _board.upload_finished = true;
          _board.show_upload_progress = false;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
          _upload.stop = function() { }
        }
      }
    }

    // blank page
    this.upload1 = function() {
      $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_SLIDE, 1);
    }

    // slide
    this.upload2 = function() {
      // mobile browser cannot change type. 
      // must use all files to be able to choose non-image files
      //_board.file_input = hmtgHelper.file_reset('fileInput', 'image/*');
      _board.file_input = hmtgHelper.file_reset('fileInput');

      _board.file_input.addEventListener("change", _upload, false);
      if(window.navigator.msSaveOrOpenBlob) {
        setTimeout(function() {
          _board.file_input.click();  // use timeout, otherwise, IE will complain error
        }, 0);
      } else {
        // it is necessary to exempt error here
        // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
        window.g_exempted_error++;
        _board.file_input.click();
        window.g_exempted_error--;
      }
      function _upload() {
        _board.file_input.removeEventListener("change", _upload, false);
        var file = _board.file_input.files[0];
        if(!file) return;
        $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_SLIDE, 2, file);
      }
    }

    // file
    this.upload3 = function() {
      _board.file_input = hmtgHelper.file_reset('fileInput');

      _board.file_input.addEventListener("change", _upload0, false);
      if(window.navigator.msSaveOrOpenBlob) {
        setTimeout(function() {
          _board.file_input.click();  // use timeout, otherwise, IE will complain error
        }, 0);
      } else {
        // it is necessary to exempt error here
        // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
        window.g_exempted_error++;
        _board.file_input.click();
        window.g_exempted_error--;
      }
      function _upload0() {
        _board.file_input.removeEventListener("change", _upload0, false);
        var file = _board.file_input.files[0];
        if(!file) return;
        $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_SLIDE, 3, file);
      }
    }

    this.can_delete = function() {
      if(this.is_local_slide) {
        return (this.slide_index >> 0) >= 0;
      }
      return hmtg.jnkernel._jn_bConnected()
      && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
      && (hmtg.jnkernel._jn_bTokenHolder() || hmtg.jnkernel._jn_bTokenOwner())
      && (this.slide_index >> 0) >= 0
      ;
    }

    this.delete_slide = function() {
      if(!this.can_delete()) return;
      var slide_index = this.slide_index >> 0;
      if(slide_index < 0) return;

      var slide_array = this.is_local_slide ? this.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var is_group = slide_array[slide_index]._m_szGroup();
      if(is_group) {
        var array = this.get_group_slide_list(slide_index);
        if(array.length > 1) {
          hmtgHelper.inside_angular++;
          $rootScope.$broadcast(hmtgHelper.WM_DELETE_SLIDE, slide_index, array);
          hmtgHelper.inside_angular--;
          return;
        }
      }

      hmtgHelper.inside_angular++;
      _board.turnoff_fullscreen();
      hmtgHelper.inside_angular--;
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_DELETE_SLIDE_PROMPT'), 0, ok);
      function ok() {
        if(_board.is_local_slide) {
          _board.localSlideArray[slide_index].m_bDeleted = true;
          if(_board.localSlideArray[slide_index].data) {
            _board.memory_usage -= _board.localSlideArray[slide_index].data.length;
          }
          _board.localSlideArray[slide_index].data = null;
          hmtgHelper.inside_angular++;
          _board.privateUpdateDeletedSlideTitle(slide_index);
          hmtgHelper.inside_angular--;
        } else {
          hmtg.jnkernel.jn_command_DeleteSlide(slide_index);
        }
      }
    }

    this.can_clear_mark = function() {
      var slide_index = this.slide_index >> 0;
      if(slide_index < 0) return false;

      if(_board.is_local_slide) {
        var _mark_array = this.localSlideArray[slide_index].mark_array;
        return !!_mark_array.length;
      } else if(_board.is_private) {
        _mark_array = _board.privateNote[slide_index].mark_array;
        return !!_mark_array.length;
      } else if(hmtg.jnkernel._jn_bConnected()
      && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
      && hmtg.jnkernel._jn_bTokenHolder()
      ) {
        var slide_array = hmtg.jnkernel._jn_SlideArray();
        var slide = slide_array[slide_index];
        var _mark_array = slide._mark_array();  // raw mark array from jnkernel
        if(_board.wait_list_mark_array.length || (_mark_array.length - _board.wait_list_undo_id_array.length) > 0) return true;
      }
      return false;
    }

    this.clear_mark = function() {
      if(!this.can_clear_mark()) return;
      var slide_index = this.slide_index >> 0;
      if(slide_index < 0) return;

      hmtgHelper.inside_angular++;
      _board.turnoff_fullscreen();
      hmtgHelper.inside_angular--;
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_CLEAR_MARK_PROMPT'), 0, ok);
      function ok() {
        if(_board.is_local_slide) {
          _board.localSlideArray[slide_index].mark_array = [];
          _board.localSlideArray[slide_index].nextMarkID = 1;
          _board.stop_importing();  // must stop mark importing before reset mark array
          _board.mark_array = []; // reset the local mark array
          _board.local_mark.id_array = [];  // reset local mark's id array
          _board.draw_slide();
        } else if(_board.is_private) {
          _board.privateNote[slide_index].mark_array = [];
          _board.privateNote[slide_index].nextMarkID = 1;
          _board.stop_importing();  // must stop mark importing before reset mark array
          _board.mark_array = []; // reset the local mark array
          _board.local_mark.id_array = [];  // reset local mark's id array
          _board.draw_slide();
        } else {
          hmtg.jnkernel.jn_command_SendClearMarking(slide_index);
          if(_board.wait_list_mark_array.length) {
            _board.wait_list_mark_array = [];
            _board.draw_slide();
          }
        }
      }
    }

    this.can_undo_mark = function() {
      var slide_index = this.slide_index >> 0;
      if(slide_index < 0) return false;
      if(this.is_local_slide) {
        var _mark_array = this.localSlideArray[slide_index].mark_array;
        return !!_mark_array.length;
      } else if(_board.is_private) {
        _mark_array = _board.privateNote[slide_index].mark_array;
        return !!_mark_array.length;
      } else if(hmtg.jnkernel._jn_bConnected()
      && hmtg.jnkernel._jn_iWorkMode() == hmtg.config.NORMAL
      && hmtg.jnkernel.jn_info_CanAddMark()
      ) {
        // is controller or on the active slide
        if(!(hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_iActiveSlideIndex() == slide_index)) return false;

        var slide_array = hmtg.jnkernel._jn_SlideArray();
        var slide = slide_array[slide_index];
        var _mark_array = slide._mark_array();  // raw mark array from jnkernel
        if(_board.wait_list_mark_array.length || (_mark_array.length - _board.wait_list_undo_id_array.length) > 0) return true;
      }
      return false;
    }

    this.undo_mark = function() {
      if(!this.can_undo_mark()) return;
      var slide_index = this.slide_index >> 0;
      if(_board.is_local_slide) {
        var _mark_array = _board.localSlideArray[slide_index].mark_array;
        _mark_array.splice(_mark_array.length - 1, 1);
        _board.localSlideArray[slide_index].nextMarkID--;
        _board.stop_importing();  // must stop mark importing before reset mark array
        _board.mark_array = []; // reset the local mark array
        _board.draw_slide();
      } else if(_board.is_private) {
        _mark_array = _board.privateNote[slide_index].mark_array;
        _mark_array.splice(_mark_array.length - 1, 1);
        _board.privateNote[slide_index].nextMarkID--;
        _board.stop_importing();  // must stop mark importing before reset mark array
        _board.mark_array = []; // reset the local mark array
        _board.draw_slide();
      } else {
        var slide_array = hmtg.jnkernel._jn_SlideArray();
        var slide = slide_array[slide_index];
        var _mark_array = slide._mark_array();  // raw mark array from jnkernel

        if(_board.wait_list_mark_array.length) {
          _board.wait_list_mark_array.splice(_board.wait_list_mark_array.length - 1, 1);
          hmtg.jnkernel.jn_command_UndoMark(slide_index);
          _board.stop_importing();  // must stop mark importing before reset mark array
          _board.mark_array = []; // reset the local mark array
          _board.draw_slide();
        } else {
          var i;
          for(i = _mark_array.length - 1; i >= 0; i--) {
            var id = _mark_array[i]._m_iID();
            if(_board.wait_list_undo_id_array.indexOf(id) == -1) {
              hmtg.jnkernel.jn_command_GlobalUndoMark(slide_index, id);
              _board.wait_list_undo_id_array.push(id);
              if(_board.wait_list_undo_id_array.length > 100) {
                wait_list_undo_id_array.splice(0, 1);
              }
              _board.stop_importing();  // must stop mark importing before reset mark array
              _board.mark_array = []; // reset the local mark array
              _board.draw_slide();
              break;
            }
          }

        }
      }
    }

    //0 add,1 clear,2 undo,3, reset
    this.callback_mark_event = function(event, slide_index, mark) {
      if(this.is_private) return;
      var group_index = slide_index2group_index(slide_index);
      if(group_index == -1) return;
      var target = _board.slide_list[group_index];
      // keep focus pointer intact for undo and mark move
      if(event == 2 || (event == 0 && mark._m_byMarkType() == hmtg.config.MARK_MOVE)) {
      } else {
        target.pointer = null;
      }

      if(slide_index == _board.slide_index) {
        if(event != 0) {
          if(event == 2 && mark && _board.wait_list_undo_id_array.length) {
            var id = mark._m_iID();
            var idx = _board.wait_list_undo_id_array.indexOf(id);
            if(idx != -1) {
              _board.wait_list_undo_id_array.splice(idx, 1);
            }
          }
          _board.stop_importing();  // must stop mark importing before reset mark array
          _board.mark_array = []; // reset the local mark array
        } else {
          if(_board.wait_list_undo_id_array.length) _board.wait_list_undo_id_array = [];

          _board.ensure_visible = { index: slide_index, mark: mark };
          if(mark._m_iSource() == hmtg.jnkernel._jn_ssrc_index()) {
            var wait_mark = _board.match_wait_list(mark);
            if(wait_mark) {
              _board.remove_wait_list_mark(wait_mark);
            }
            // if this is an image mark and it is from self, and we are at image or text shape, select it
            if((_board.shape == 'image' || _board.shape == 'text')
              && mark._m_byMarkType() == hmtg.config.MARK_CUSTOMIZED
            ) {
              var type2 = mark._m_iCustomizedMarkType();
              if(type2 == 1 || type2 == 4 || type2 == 5) {
                // change to select mode and select this mark
                this.shape = 'select';
                setTimeout(function() {
                  _board.local_mark.select_mode = false;
                  _board.local_mark.select_toggle_mode = false;
                  _board.local_mark.hit_type = 8;
                  _board.local_mark.id_array0 = [];
                  _board.local_mark.id_array = [mark._m_iID()];
                }, 0);

                // change shape to select, need to update the board
                $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
              }
            }
          }
        }
        if(event == 1) { // clear
          _board.local_mark.id_array = [];  // reset local mark's id array
        }

        _board.draw_slide();

        var slide_array = hmtg.jnkernel._jn_SlideArray();
        var slide = slide_array[slide_index];
        var _mark_array = slide._mark_array();  // raw mark array from jnkernel
        var item_count = _board.wait_list_mark_array.length + (_mark_array.length - _board.wait_list_undo_id_array.length);
        if(item_count <= 1) {
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        }
      }
    }

    this.callback_FocusPointer = function(index, x, y, cx, cy, color, width) {
      if(this.is_private) return;
      var group_index = slide_index2group_index(index);
      if(group_index == -1) return;
      var target = _board.slide_list[group_index];
      var old_size = _board.calcFocusPointerSize(target.pointer);
      target.pointer = target.pointer || {};
      var p = target.pointer;
      p.x = x;
      p.y = y;
      p.cx = cx;
      p.cy = cy;
      p.color = color;
      p.width = width;
      if(index == _board.slide_index) {
        var ratio = _board.ratio;
        if(p.cx >= 16 || p.cy >= 16) {
          _board.ensure_visible = { index: index, x: x, y: y, cx: cx, cy: cy };
        } else {
          _board.ensure_visible = { index: index,
            x: (p.x + p.cx / 2) - (_board.pointer_img.width >> 1) / ratio,
            y: (p.y + p.cy / 2) - (_board.pointer_img.height >> 1) / ratio,
            cx: _board.pointer_img.width / ratio, cy: _board.pointer_img.height / ratio
          };
        }
      }
      if(index == _board.slide_index) {
        var canQuickDraw = true;
        if(old_size.x > _board.img_width || old_size.y > _board.img_height) {
          canQuickDraw = false;
        } else {
          var new_size = _board.calcFocusPointerSize(target.pointer);
          if(new_size.x > _board.img_width || new_size.y > _board.img_height) {
            canQuickDraw = false;
          }
        }
        // quick draw may not be good
        // may need standard draw to recalculate board size just in case that the focus pointer stretch to outside area
        _board.draw_slide(canQuickDraw);
      }
    }

    this.calcFocusPointerSize = function(p) {
      var x = 0;
      var y = 0;
      if(p) {
        if(p.cx >= 16 || p.cy >= 16) {
          var pw = p.width;
          var half_pw = (pw + 1) >> 1;
          x = Math.max(p.x - p.cx + half_pw, p.x + p.cx + half_pw);
          y = Math.max(p.y - p.cy + half_pw, p.y + p.cy + half_pw);
        } else {
          x = Math.max(p.x + ((_board.pointer_img.width + 1) >> 1));
          y = Math.max(p.y + ((_board.pointer_img.height + 1) >> 1));
        }
      }
      return { x: x, y: y };
    }


    this.callback_UpdateReleasedSlideTitle = function(slide_index) {
      var data = _board.slide_list;
      var group_index = slide_index2group_index(slide_index);
      if(group_index != -1) {
        var slide_array = hmtg.jnkernel._jn_SlideArray();
        var slide = slide_array[slide_index];
        data[group_index].name = _board.calc_slide_name(slide);
        this.slide_name_changed(slide_index, group_index);
      }
    }

    // if no slide left, return true
    this.callback_UpdateDeletedSlideTitle = function(index) {
      var old_is_local_slide = this.is_local_slide;
      this.is_local_slide = false;
      var group_index = slide_index2group_index(index);
      this.is_local_slide = old_is_local_slide;
      if(group_index == -1) return false;
      if(_board.slide_list.length <= 1) {
        _board.reset();
        return true;
      } else {
        if(!_board.is_local_slide && _board.slide_index == index) {
          if(group_index == _board.slide_list.length - 1) {
            _board.slide_index = _board.slide_list[group_index - 1].index;
            _board.local_mark.id_array = [];  // reset local mark's id array
          } else {
            _board.slide_index = _board.slide_list[group_index + 1].index;
            _board.local_mark.id_array = [];  // reset local mark's id array
          }
          _board.jnkernel_slide_index = _board.slide_index;
          var slide_array = hmtg.jnkernel._jn_SlideArray();
          if(slide_array[_board.slide_index]._m_szGroup()) {
            _board.page_hash[slide_array[_board.slide_index]._group_id()] = _board.slide_index;
          }
        }

        update_group_id_for_deleted_slide(index, group_index);

        _board.slide_list.splice(group_index, 1);
        if(!_board.is_local_slide) {
          // need to redraw title/page
          _board.update_title_list();
          _board.update_page_list();
          if(_board.slide_index == index) _board.slide_changed();
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        }
      }
      return false;

      function update_group_id_for_deleted_slide(index, group_index) {
        var slide_array = hmtg.jnkernel._jn_SlideArray();
        if(!slide_array[index]._m_szGroup()) return;  // no need to update for normal slide

        var data = _board.slide_list;
        // search afterward first
        var i;
        i = group_index + 1;
        if(i < data.length) {
          if(slide_array[data[i].index]._m_szGroup()
            && hmtg.jnkernel.jn_info_IsSlideSameGroup(data[i].index, index)) {
            // slide of same group found 
            _board.page_hash[slide_array[index]._group_id()] = data[i].index;
            return;
          }
        }

        // search backward
        i = group_index - 1;
        if(i >= 0) {
          if(slide_array[data[i].index]._m_szGroup()
            && hmtg.jnkernel.jn_info_IsSlideSameGroup(data[i].index, index)) {
            // slide of same group found 
            _board.page_hash[slide_array[index]._group_id()] = data[i].index;
            return;
          }
        }
      }
    }

    this.privateUpdateDeletedSlideTitle = function(index) {
      var group_index = slide_index2group_index(index);
      if(group_index == -1) return false;
      if(_board.local_slide_list.length <= 1) {
        _board.privateReset();
        return true;
      } else {
        if(_board.slide_index == index) {
          if(group_index == _board.local_slide_list.length - 1) {
            _board.slide_index = _board.local_slide_list[group_index - 1].index;
            _board.local_mark.id_array = [];  // reset local mark's id array
          } else {
            _board.slide_index = _board.local_slide_list[group_index + 1].index;
            _board.local_mark.id_array = [];  // reset local mark's id array
          }
          _board.local_slide_index = _board.slide_index;
          var slide_array = _board.localSlideArray;
          if(slide_array[_board.slide_index]._m_szGroup()) {
            _board.page_hash[slide_array[_board.slide_index]._group_id()] = _board.slide_index;
          }
        }

        update_group_id_for_deleted_slide(index, group_index);

        _board.local_slide_list.splice(group_index, 1);
        // need to redraw title/page
        _board.update_title_list();
        _board.update_page_list();
        if(_board.slide_index == index) _board.slide_changed();
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
      return false;

      function update_group_id_for_deleted_slide(index, group_index) {
        var slide_array = _board.localSlideArray;
        if(!slide_array[index]._m_szGroup()) return;  // no need to update for normal slide

        var data = _board.local_slide_list;
        // search afterward first
        var i;
        i = group_index + 1;
        if(i < data.length) {
          if(slide_array[data[i].index]._m_szGroup()
            && _board.isSlideSameGroup(data[i].index, index)) {
            // slide of same group found 
            _board.page_hash[slide_array[index]._group_id()] = data[i].index;
            return;
          }
        }

        // search backward
        i = group_index - 1;
        if(i >= 0) {
          if(slide_array[data[i].index]._m_szGroup()
            && _board.isSlideSameGroup(data[i].index, index)) {
            // slide of same group found 
            _board.page_hash[slide_array[index]._group_id()] = data[i].index;
            return;
          }
        }
      }
    }

    this.isSlideSameGroup = function(index1, index2, is_local_slide) {
      var is_local = is_local_slide;
      if(typeof is_local_slide === 'undefined') {
        is_local = this.is_local_slide;
      }

      if(is_local) {
        var slide0 = this.localSlideArray[index1];
        var slide = this.localSlideArray[index2];
        return (slide0.m_szGroup == slide.m_szGroup
        && slide0.m_szOwnerName == slide.m_szOwnerName
        && slide0.m_iSource == slide.m_iSource);
      } else {
        return hmtg.jnkernel.jn_info_IsSlideSameGroup(index1, index2);
      }
    }

    this.refresh = function() {
      if(this.is_local_slide) return;
      var slide_index = _board.slide_index >> 0;
      if(slide_index < 0) return;
      var slide_array = hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= slide_array.length) return;

      _board.stop_importing();  // must stop mark importing before reset mark array
      _board.mark_array = [];
      _board.img_ready = false;

      _board.slide_status = 0;
      _board.show_save0 = false;

      hmtg.jnkernel.jn_command_RefreshSlide(slide_index);

      _board.draw_slide();

      var data = _board.slide_list;
      var group_index = slide_index2group_index(slide_index);
      if(group_index != -1) {
        var slide = slide_array[slide_index];
        data[group_index].name = _board.calc_slide_name(slide);
        this.slide_name_changed(slide_index, group_index);
      }

      _board.download_slide(slide_index);
    }

    this.board0.addEventListener('selectstart', function(e) { e.preventDefault(); return false; }, false);

    this.updateAutoFit = function() {
      var slide_index = this.slide_index >> 0;
      var group_index = slide_index2group_index(slide_index);
      if(group_index == -1) return;

      var slide_list = this.is_local_slide ? this.local_slide_list : this.slide_list;
      slide_list[group_index].is_auto_fit = this.is_auto_fit;
      if(!this.is_local_slide) {
        if(slide_index != -1) {
          this.privateNote[slide_index].is_auto_fit = this.is_auto_fit;
        }
      }
    }

    this.save_per_slide_fit_info = function() {
      var slide_index = _board.slide_index >> 0;
      var group_index = slide_index2group_index(slide_index);
      if(group_index == -1) return;
      var slide_list = this.is_local_slide ? this.local_slide_list : this.slide_list;
      slide_list[group_index].is_fit_page = this.is_fit_page;
      slide_list[group_index].fit_mode = this.fit_mode;
      slide_list[group_index].ratio_pos = this.ratio_pos;
      if(!this.is_local_slide) {
        if(slide_index != -1) {
          this.privateNote[slide_index].is_fit_page = this.is_fit_page;
          this.privateNote[slide_index].fit_mode = this.fit_mode;
          this.privateNote[slide_index].ratio_pos = this.ratio_pos;
        }
      }
    }
    this.fit_page = function() {
      this.is_fit_page = !this.is_fit_page;
      if(this.is_auto_fit) {
        if(this.is_fit_page) {
          this.auto_fit_mode = this.fit_mode;
        } else {
          this.auto_ratio_pos = this.ratio_pos;
        }
        this.auto_fit_page = this.is_fit_page;
        //this.is_auto_fit = false;
        //this.updateAutoFit();
      }
      _board.save_per_slide_fit_info();
      _board.draw_slide();
    }

    this.change_ratio = function() {
      if(!this.is_fit_page) {
        if(this.is_auto_fit) {
          this.auto_fit_page = false;
          this.auto_ratio_pos = this.ratio_pos;
          //this.is_auto_fit = false;
          //this.updateAutoFit();
        }
      }

      var slide_index = _board.slide_index >> 0;
      if(!this.is_local_slide) {
        if(slide_index != -1) {
          this.privateNote[slide_index].ratio_pos = this.ratio_pos;
        }
      }
      this.ratio = this.ratio_pos / 100;
      this.ratio_percent = Math.round(this.ratio_pos);
      if(this.ratio != this.draw_ratio) {
        // only request to draw slide if the new ratio is different with draw_ratio
        _board.draw_slide();
      }
    }

    this.prev_slide = function() {
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var slide_index = _board.slide_index >> 0;
      var group_index = slide_index2group_index(slide_index);
      if(group_index <= 0) return;
      group_index--;
      if(group_index < 0 || group_index >= data.length) return;

      hmtgHelper.inside_angular++;
      if(this.is_private) {
        this.privateFlipSlide(data[group_index].index);
      } else {
        this.callback_FlipSlide(0, data[group_index].index, true);
      }
      hmtgHelper.inside_angular--;
    }

    this.next_slide = function() {
      var data = _board.is_local_slide ? _board.local_slide_list : _board.slide_list;
      var slide_index = _board.slide_index >> 0;
      var group_index = slide_index2group_index(slide_index);
      if(group_index >= data.length - 1) return;
      group_index++;
      if(group_index < 0 || group_index >= data.length) return;

      hmtgHelper.inside_angular++;
      if(this.is_private) {
        this.privateFlipSlide(data[group_index].index);
      } else {
        this.callback_FlipSlide(0, data[group_index].index, true);
      }
      hmtgHelper.inside_angular--;
    }

    this.prev_group = function() {
      var slide_index = _board.slide_index >> 0;
      var group_index = slide_index2group_index(slide_index);
      if(group_index == -1) return;
      group_index = this.prev_title_index(group_index);
      if(group_index == -1) return;

      var slide_list = this.is_local_slide ? this.local_slide_list : this.slide_list;
      hmtgHelper.inside_angular++;
      if(this.is_private) {
        this.privateFlipSlide(slide_list[group_index].index);
      } else {
        this.callback_FlipSlide(0, slide_list[group_index].index, true);
      }
      hmtgHelper.inside_angular--;
    }

    this.next_group = function() {
      var slide_index = _board.slide_index >> 0;
      var group_index = slide_index2group_index(slide_index);
      if(group_index == -1) return;
      group_index = this.next_title_index(group_index);
      if(group_index == -1) return;

      var slide_list = this.is_local_slide ? this.local_slide_list : this.slide_list;
      hmtgHelper.inside_angular++;
      if(this.is_private) {
        this.privateFlipSlide(slide_list[group_index].index);
      } else {
        this.callback_FlipSlide(0, slide_list[group_index].index, true);
      }
      hmtgHelper.inside_angular--;
    }

    this.update_prev_next_slide_status = function() {
      var slide_index = _board.slide_index >> 0;
      var group_index = slide_index2group_index(slide_index);
      if(slide_index < 0 || group_index < 0) {
        _board.show_prev_slide = _board.show_next_slide = _board.show_prev_group = _board.show_next_group = false;
        return;
      }
      var slide_list = this.is_local_slide ? this.local_slide_list : this.slide_list;
      // slide
      _board.show_prev_slide = group_index > 0;
      _board.show_next_slide = group_index != -1 && (group_index < slide_list.length - 1);

      // group
      var t = this.prev_title_index(group_index)
      //_board.show_prev_group = -1 != t && t != (group_index - 1);
      _board.show_prev_group = -1 != t;
      t = this.next_title_index(group_index)
      //_board.show_next_group = -1 != t && t != (group_index + 1);
      _board.show_next_group = -1 != t;
    }

    this.callback_ConversionCount = function() {
      this.dummy_conversion = false;
      this.stop_dummy_conversion_timer();
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
    }

    this.callback_ConversionResult = function(filename, error) {
      this.dummy_conversion = false;
      this.stop_dummy_conversion_timer();
      $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      if(error) {
        hmtgSound.ShowErrorPrompt(function() { return $translate.instant('ID_CONVERSION_FAILED').replace('#file#', '"' + hmtg.util.decodeUtf8(filename) + '"') }, 30);
      }
    }

    this.transformX = function(x) {
      return Math.min(parseInt((_board.container.scrollLeft + _board.board_container2.scrollLeft + x) / _board.ratio), Math.max(32767, _board.img_width));
    }

    this.transformY = function(y) {
      return Math.min(parseInt((_board.container.scrollTop + _board.board_container2.scrollTop + y) / _board.ratio), Math.max(32767, _board.img_height));
    }

    this.switchWhiteBoard = function() {
      if(!_board.is_private) return;
      _board.is_private = false;
      _board.is_local_slide = false;
      _board.slide_index = _board.jnkernel_slide_index;

      _board.slide_type = -1;
      _board.slide_status = 0;
      _board.update_title_list();
      _board.update_page_list();
      _board.slide_changed();
    }

    this.switchPrivate = function() {
      if(_board.is_private && !_board.is_local_slide) return;
      _board.is_private = true;
      _board.is_local_slide = false;
      _board.slide_index = _board.jnkernel_slide_index;

      _board.slide_type = -1;
      _board.slide_status = 0;
      _board.update_title_list();
      _board.update_page_list();
      _board.slide_changed();
    }

    this.switchLocal = function() {
      if(_board.is_local_slide) return;
      _board.is_local_slide = true;
      _board.is_private = true;
      _board.slide_index = _board.local_slide_index;

      _board.slide_type = -1;
      _board.slide_status = 0;
      _board.update_title_list();
      _board.update_page_list();
      _board.slide_changed();
    }

    this.copyToLocal = function() {
      if(_board.is_local_slide) return;

      var slide_index = _board.slide_index >> 0;
      if(slide_index == -1) return;
      var slide_array = hmtg.jnkernel._jn_SlideArray();
      var slide0 = slide_array[slide_index];
      if(slide0._m_bDeleted()) return;
      if(!(slide0._is_blank_page() || slide0._downloaded() == 1)) return;

      var slide = new SlideEntry();
      slide.m_iSource = slide0._m_iSource();
      slide.m_szName = slide0._m_szName();
      slide.m_bDeleted = 0;
      slide.m_szGroup = slide0._m_szGroup();
      slide.m_szOwnerName = slide0._m_szOwnerName();
      slide.downloaded = 1;
      slide.data = slide0._data();

      if(hmtg.util.endsWith(slide.m_szName, 'blank page')) {
        slide.is_blank_page = true;
      }

      slide.index = _board.localSlideArray.length;
      // copy marks
      var adjust_array = [];
      var current_adjust = 0;
      function adjust_mark_id(old_id) {
        var i;
        for(i = adjust_array.length - 1; i >= 0; i--) {
          var item = adjust_array[i];
          if(old_id >= item[0]) {
            return old_id - item[1];
          }
        }
        return old_id;
      }
      var i;
      if(_board.is_private) {
        var _mark_array = _board.privateNote[slide_index].mark_array;
        for(i = 0; i < _mark_array.length; i++) {
          var _mark = _mark_array[i];
          slide.mark_array.push(_mark);
          slide.nextMarkID++;
        }
      } else {
        var _mark_array = slide0._mark_array();  // raw mark array from jnkernel
        for(i = 0; i < _mark_array.length; i++) {
          var _mark = _mark_array[i];
          var type = _mark._m_byMarkType();
          var mark_id = _mark._m_iID();
          if(_board.wait_list_undo_id_array.length && _board.wait_list_undo_id_array.indexOf(mark_id) != -1) continue;
          if(mark_id - current_adjust < slide.nextMarkID) break; // should not occur. error case
          if(mark_id - current_adjust > slide.nextMarkID) {
            current_adjust += mark_id - current_adjust - slide.nextMarkID;
            adjust_array.push([mark_id, current_adjust]);
          }
          if(type == hmtg.config.MARK_STROKE2) {
            if(current_adjust) {
              var mark = new MarkEntry();
              mark.m_iColor = _mark._m_iColor();
              mark.m_iIndex = _mark._m_iIndex();
              mark.m_iSource = _mark._m_iSource();
              mark.m_nPenWidth = _mark._m_nPenWidth();
              mark.m_iShape = _mark._m_iShape();
              mark.m_codepage = _mark._m_codepage();
              mark.m_byMarkType = type;
              mark.ax = _mark._ax();
              mark.ay = _mark._ay();
              mark.m_zoom = _mark._m_zoom();
              mark.m_iID = _mark._m_iID() - current_adjust;
              mark.m_offset_x = _mark._m_offset_x();
              mark.m_offset_y = _mark._m_offset_y();
              slide.mark_array.push(mark);
            } else {
              slide.mark_array.push(_mark);
            }
          } else if(type == hmtg.config.MARK_TEXT2) {
            if(current_adjust) {
              var mark = new MarkEntry();
              mark.m_iColor = _mark._m_iColor();
              mark.m_iIndex = _mark._m_iIndex();
              mark.m_iSource = _mark._m_iSource();
              mark.m_nPenWidth = _mark._m_nPenWidth();
              mark.m_rect_left = _mark._m_rect_left();
              mark.m_rect_top = _mark._m_rect_top();
              mark.m_rect_right = _mark._m_rect_right();
              mark.m_rect_bottom = _mark._m_rect_bottom();
              mark.m_codepage = _mark._m_codepage();
              mark.m_byMarkType = type;
              mark.m_szContent = _mark._m_szContent();
              mark.m_zoom = _mark._m_zoom();
              mark.m_iID = _mark._m_iID() - current_adjust;
              mark.m_offset_x = _mark._m_offset_x();
              mark.m_offset_y = _mark._m_offset_y();
              slide.mark_array.push(mark);
            } else {
              slide.mark_array.push(_mark);
            }
          } else if(type == hmtg.config.MARK_MOVE) {
            if(current_adjust) {
              var mark = new MarkEntry();
              mark.m_iIndex = _mark._m_iIndex();
              mark.m_iSource = _mark._m_iSource();
              mark.m_codepage = _mark._m_codepage();
              mark.m_byMarkType = type;
              mark.m_zoom = _mark._m_zoom();
              mark.m_iID = _mark._m_iID() - current_adjust;
              mark.m_offset_x = _mark._m_offset_x();
              mark.m_offset_y = _mark._m_offset_y();
              mark.m_move_type = _mark._m_move_type();
              var old_id_array = _mark._id_array();
              var size = old_id_array.length;
              mark.id_array = new Int32Array(size);
              var j;
              for(j = 0; j < size; j++) {
                mark.id_array[j] = adjust_mark_id(old_id_array[j]);
              }
              slide.mark_array.push(mark);
            } else {
              slide.mark_array.push(_mark);
            }
          } else if(type == hmtg.config.MARK_CUSTOMIZED) {
            if(current_adjust) {
              var mark = new MarkEntry();
              mark.m_iIndex = _mark._m_iIndex();
              mark.m_iSource = _mark._m_iSource();
              mark.m_offset_x = _mark._m_offset_x();
              mark.m_offset_y = _mark._m_offset_y();
              mark.m_codepage = _mark._m_codepage();
              mark.m_byMarkType = type;
              mark.m_iCustomizedMarkType = _mark._m_iCustomizedMarkType();
              mark.m_pCustomizedMarkData = _mark._m_pCustomizedMarkData();
              mark.m_zoom = _mark._m_zoom();
              mark.m_iID = _mark._m_iID() - current_adjust;
              slide.mark_array.push(mark);
            } else {
              slide.mark_array.push(_mark);
            }
          } else {
            // unknown mark,
            // skip it
            continue;
          }
          slide.nextMarkID++;
        }
        /*
        // copy marks
        var _mark_array = slide0._mark_array();  // raw mark array from jnkernel
        var i;
        for(i=0;i<_mark_array.length;i++) {
        var _mark = _mark_array[i];
        var type = _mark._m_byMarkType();
        var mark_id = _mark._m_iID();
        if(mark_id < slide.nextMarkID) break;
        while(mark_id > slide.nextMarkID) {
        // insert a dummy mark move
        var mark = new MarkEntry();
        mark.m_iIndex = slide.index;
        mark.m_iSource = -1;
        mark.m_offset_x = 0;
        mark.m_offset_y = 0;
        mark.m_move_type = 999; // dummy move
        mark.m_zoom = 100;
        mark.m_iID = slide.nextMarkID++;
        mark.m_codepage = hmtg.config.UTF8_CODEPAGE;
        mark.m_byMarkType = hmtg.config.MARK_MOVE;
        mark.id_array = new Int32Array(1);
        mark.id_array[0] = mark.m_iID;
        slide.mark_array.push(mark);
        }
        slide.mark_array.push(_mark);
        slide.nextMarkID++;
        }
        */
      }
      if(slide.data) {
        _board.memory_usage += slide.data.length;
      }
      _board.localSlideArray.push(slide);

      slide.m_iGroupIndex = 0;
      if(slide.m_szGroup) {
        for(var i = _board.localSlideArray.length - 2; i >= 0; i--) {
          var slide0 = _board.localSlideArray[i];
          if(slide0.m_szGroup == slide.m_szGroup
            && slide0.m_szOwnerName == slide.m_szOwnerName
            && slide0.m_iSource == slide.m_iSource) {
            slide.m_iGroupIndex = slide0.m_iGroupIndex + 1;
            break;
          }
        }
      }

      hmtgHelper.inside_angular++;
      _board.add_slide(slide, true);
      hmtgHelper.inside_angular--;

      _board.is_private = true;
      _board.is_local_slide = true;
      _board.slide_index = _board.local_slide_index;
      _board.slide_type = -1;
      _board.slide_status = 0;
      _board.update_title_list();
      _board.update_page_list();
      _board.slide_changed();
    }

    this.resetLocal = function() {
      hmtgHelper.inside_angular++;
      _board.turnoff_fullscreen();
      hmtgHelper.inside_angular--;
      hmtgHelper.OKCancelMessageBox($translate.instant('ID_RESET_LOCAL_BOARD_PROMPT'), 0, ok);
      function ok() {
        _board.memory_usage = 0;
        _board.localSlideArray = [];
        hmtgHelper.inside_angular++;
        _board.privateReset();
        hmtgHelper.inside_angular--;
      }
    }

    this.dupLocal = function() {
      if(!_board.is_local_slide) return;
      var slide_index = _board.slide_index >> 0;
      if(slide_index == -1) return;
      var slide = _board.localSlideArray[slide_index];
      if(!slide._is_blank_page() && !slide._m_bDeleted() && !hmtg.util.endsWith(slide._m_szName(), '.jzf') && !hmtg.util.endsWith(slide._m_szName(), '.txt.jcz')) {
        var title = _board.getSlideTitle(slide);
        if(hmtg.util.endsWith(title, '.jcz')) {
          title = title.slice(0, title.length - 4);
          // jcz images need unzip first
          var unzip = new hmtgHelper.decompress('unzip', slide.data, function(output) {
            var file = new Blob([output]);
            file.name = hmtg.util.decodeUtf8(title);
            $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_SLIDE, 2, file);
          }, function() {
          });
        } else {
          var file = new Blob([slide.data]);
          file.name = hmtg.util.decodeUtf8(title);
          $rootScope.$broadcast(hmtgHelper.WM_UPLOAD_SLIDE, 2, file);
        }
      }
    }

    this.getSlideTitle = function(slide) {
      var title = slide._m_szName();
      if(slide._m_iSource() != -1) {
        var ownername_str = '(' + slide._m_szOwnerName() + ')';
        if(title.indexOf(ownername_str) == 0) {
          title = title.slice(ownername_str.length);
        } else if(title.indexOf('(') == 0) {
          var title2 = title.slice(1);
          var idx = title2.indexOf(')');
          if(idx != -1) {
            title = title2.slice(idx + 1);
          }
        }
      }
      return title;
    }

    this.copyToBoard = function() {
      if(!_board.is_private) return;
      if(!_board.can_upload(true)) return;
      var slide_index = _board.slide_index >> 0;
      if(slide_index == -1) return;
      if(!_board.is_local_slide) {
        var slide = hmtg.jnkernel._jn_SlideArray()[slide_index];
        if(slide._m_bDeleted()) return;
        if(!(slide._is_blank_page() || slide._downloaded() == 1)) return;
      }
      hmtgHelper.inside_angular++;
      _board.upload_thread = new copy_to_board_thread();
      hmtgHelper.inside_angular--;

      function copy_to_board_thread() {
        var _upload = this;
        _upload.stop = function() { }

        var slide_array = _board.is_local_slide ? _board.localSlideArray : hmtg.jnkernel._jn_SlideArray();
        var slide0 = slide_array[slide_index];
        if(slide0._downloaded() != 1) return;

        var upload_type;
        if(slide0._is_blank_page()) upload_type = 1;
        else if(hmtg.util.endsWith(slide0._m_szName(), '.jzf')) upload_type = 3;
        else upload_type = 2;

        var title = _board.getSlideTitle(slide0);

        if(upload_type != 3) {
          // for slide, turn on flag to copy marks after the slide is uploaded
          _board.copy_to_board_mark_array = _board.is_local_slide ? _board.localSlideArray[slide_index].mark_array : _board.privateNote[slide_index].mark_array;
          _board.copy_to_board_title = title;
        }

        _board.upload_finished = false;
        _board.new_upload = true;
        hmtg.jnkernel.jn_command_UploadSlide(upload_type, slide0._m_szGroup(), title, slide0._data(), function() {
          _board.show_upload_progress = false;
          _board.upload_finished = true;
          _upload.stop = function() { }
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        }, function(pos) {
          _board.show_upload_progress = true;
          var p = (pos * 1000) >>> 0;
          _board.upload_pos = '' + (p / 10) + '%';
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        }, function() {
          _board.show_upload_progress = false;
          _board.upload_finished = true;
          _upload.stop = function() { }
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
          _board.copy_to_board_mark_array = null;
        });
        _board.upload_pos = '0%';
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        _upload.stop = function() {
          hmtg.jnkernel.jn_command_StopSlideUpload();
          _board.upload_finished = true;
          _board.show_upload_progress = false;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
          _upload.stop = function() { }
          _board.copy_to_board_mark_array = null;
        }
      }
    }

    this.copyMarkToBoard = function(index, _mark_array) {
      var i;
      for(i = 0; i < _mark_array.length; i++) {
        var _mark = _mark_array[i];
        var type = _mark._m_byMarkType();
        if(type == hmtg.config.MARK_STROKE2) {
          hmtg.jnkernel.jn_command_SendNewStroke(index, _mark._m_iColor(), _mark._m_nPenWidth(),
            _mark._m_iShape(), _mark._ax(), _mark._ay());
        } else if(type == hmtg.config.MARK_TEXT2) {
          hmtg.jnkernel.jn_command_SendNewText(index, _mark._m_iColor(), _mark._m_nPenWidth(),
            _mark._m_rect_left(), _mark._m_rect_top(), _mark._m_rect_right(), _mark._m_rect_bottom(),
            _mark._m_szContent()
            );
        } else if(type == hmtg.config.MARK_MOVE) {
          hmtg.jnkernel.jn_command_SendMarkMove(index, _mark._m_offset_x(), _mark._m_offset_y(),
            _mark._m_move_type(), _mark._id_array());
        } else if(type == hmtg.config.MARK_CUSTOMIZED) {
          var type2 = _mark._m_iCustomizedMarkType();
          var len = _mark._m_pCustomizedMarkData().length;
          var header_size = (type2 == 1) ? 8 : 4;
          var data = new Uint8Array(len);
          for(var j = 0; j < len; ++j) {
            data[j] = _mark._m_pCustomizedMarkData().charCodeAt(j);
          }
          var point_x, point_y, cx, cy, orig_size;

          if(type2 == 1 || type2 == 5) {  // get position information
            var t = 0;
            t |= data[0];
            t |= (data[1] << 8);
            point_x = t;
            t = 0;
            t |= data[2];
            t |= (data[3] << 8);
            point_y = t;
            cx = point_x - _mark._m_offset_x();
            cy = point_y - _mark._m_offset_y();
          }
          if(type2 != 5) {
            var t = 0;
            t |= data[0];
            t |= (data[1] << 8);
            t |= (data[2] << 16);
            t |= (data[3] << 24);
            orig_size = t;
          }
          hmtg.jnkernel.jn_command_SendImageMark(index, type2,
            _mark._m_offset_x(), _mark._m_offset_y(),
            cx, cy, _mark._m_zoom(), data.subarray(header_size), orig_size);
        } else {
          // unknown mark,
          // send dummy mark move
          var id_array = new Int32Array(1);
          id_array[0] = 0x7fffffff;
          hmtg.jnkernel.jn_command_SendMarkMove(index, 0, 0, 999, id_array);
        }
      }
    }

    this.text_as_image = function() {
      appSetting.text_mark_as_image = !appSetting.text_mark_as_image;
      hmtg.util.localStorage['hmtg_text_mark_as_image'] = JSON.stringify(appSetting.text_mark_as_image);
    }
    this.bold_text = function() {
      appSetting.is_bold_text = !appSetting.is_bold_text;
      hmtg.util.localStorage['hmtg_is_bold_text'] = JSON.stringify(appSetting.is_bold_text);
      _board.draw_slide(true);  // quick draw
    }
    this.italic_text = function() {
      appSetting.is_italic_text = !appSetting.is_italic_text;
      hmtg.util.localStorage['hmtg_is_italic_text'] = JSON.stringify(appSetting.is_italic_text);
      _board.draw_slide(true);  // quick draw
    }
    this.rotate_text = function(value) {
      appSetting.text_rotate = appSetting.text_rotate == value ? 0 : value;
      _board.draw_slide(true);  // quick draw
    }

    this.addUnicodeText = function(i) {
      if(!this.text_mark) this.text_mark = '';
      this.text_mark += hmtg.customization.unicode_text_list[i];
    }
  }
])

.controller('BoardCtrl', ['$scope', 'board', 'hmtgHelper', '$rootScope', '$modal', '$translate', 'hmtgAlert', 'joinnetHelper',
  '$ocLazyLoad', 'appSetting', 'layout',
  function($scope, board, hmtgHelper, $rootScope, $modal, $translate, hmtgAlert, joinnetHelper, $ocLazyLoad, appSetting,
    layout) {
    $scope.w = board;
    $scope.hh = hmtgHelper;
    $scope.as = appSetting;

    // mark-related stuff
    board.shape = 'pointer';
    board.drag_idx = -1;  // which slide index the drag occurs

    window.addEventListener("paste", pasteHandler);
    function pasteHandler(e) {
      // if white board is visible and shape is image and can add image mark
      if(board.to_block_paste_image_mark) return;
      if($rootScope.nav_item != 'joinnet') return;
      if(board.shape != 'image') return;
      if($rootScope.gui_mode == 'concise') {
        if(!layout.is_board_visible) return;
      } else {
        if(!$scope.is_area_visible('white_board')) return;
      }
      if(e.clipboardData) {
        var items = e.clipboardData.items;
        if(items) {
          for(var i = 0; i < items.length; i++) {
            if(items[i].type.indexOf("image") !== -1) {
              var blob = items[i].getAsFile();
              open_manage_mark_dialog(blob);  // pass the file to the dialog box
              break;
            }
          }
        }
      }
    }

    $scope.$on(hmtgHelper.WM_UPDATE_BOARD, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_HEIGHT_CHANGED, adjust_size);
    $scope.$on(hmtgHelper.WM_WIDTH_CHANGED, adjust_size);

    var myheight = 100;    
    var mywidth = 100;    
    $scope.style_max_size = function() {
      var old_h = myheight;
      var old_w = mywidth;
      var size = board.decide_min_size2();
      myheight = size.h;
      mywidth = size.w;

      // this logic can prevent exception caused by too frequent $digest
      // [$rootScope:infdig]
      if(myheight > old_h && myheight - old_h < 15) {
        myheight = old_h;
      }
      if(mywidth > old_w && mywidth - old_w < 15) {
        mywidth = old_w;
      }
      board.board_width_height_ratio = myheight > 0 ? mywidth / myheight : 1.0;
      board.board_width = mywidth;
      board.board_height = myheight;
      return {
        'max-height': '' + (myheight) + 'px',
        'max-width': '' + (mywidth) + 'px'
      };
    }
    
    function adjust_size() {
      var size = board.decide_min_size2();
      board.board_width_height_ratio = size.h > 0 ? size.w / size.h : 1.0;
      board.board_width = size.w;
      board.board_height = size.h;
      if(board.is_fit_page) {
        board.draw_slide();
      } else {
        // if this is a blank page, standard draw because the width height ratio may have changed
        var idx = board.slide_index >> 0;
        if(idx >= 0) {
          var slide;
          if(board.is_local_slide) {
            slide = board.localSlideArray[idx];
          } else {
            slide = hmtg.jnkernel._jn_SlideArray()[idx];  
          }
          if(slide._is_blank_page()) {
            board.draw_slide();
          }
        }
      }
    }

    $scope.toggle_toolbar = function() {
      appSetting.board_hide_toolbar = !appSetting.board_hide_toolbar;
      hmtg.util.localStorage['hmtg_board_hide_toolbar'] = JSON.stringify(appSetting.board_hide_toolbar);
      setTimeout(function() { 
        adjust_size();
      }, 0);
    }

    //$scope.$on(hmtgHelper.WM_UPDATE_LAYOUT_MODE, function() {
    //});

    $scope.$on(hmtgHelper.WM_MAX_DISPLAY_ITEM_CHANGED, function() {
      // title/page view may need to change due to setting change
      board.update_title_list();
      board.update_page_list();

      if(!hmtgHelper.inside_angular) $scope.$digest();
    });

    $scope.$on(hmtgHelper.WM_MY_TALKER_STATUS_CHANGED, function() {
      if(!hmtgHelper.inside_angular) $scope.$digest();
      if(!board.is_private) {
        if(!hmtg.jnkernel.jn_info_CanAddMark()) {
          board.local_mark.id_array = [];  // reset local mark's id array
        }
        if(board.is_fit_page) {
          board.draw_slide(); // when fitting page, need a complete draw to re-calculate the ratio
        }
      }
    });

    $scope.$on(hmtgHelper.WM_FULLSCREEN_CHANGED, function() {
      var fullscreenElement = document.fullscreenElement
          || document.mozFullScreenElement
          || document.webkitFullscreenElement
          || document.msFullscreenElement
        ;

      var old_status = board.is_fullscreen;
      board.is_fullscreen = fullscreenElement == board.container;
      if(!hmtgHelper.inside_angular) $scope.$digest();
      if(old_status && !board.is_fullscreen) {
        joinnetHelper.change_fullscreen_mode(0, hmtg.config.TAB_VIEW_BOARD);
      }
    });

    $scope.$on(hmtgHelper.WM_SYNC_FULLSCREEN, function(event, is_fullscreen, view) {
      if(view != 0) return;
      if($rootScope.nav_item != 'joinnet') return;

      var sync_fullscreen_controller = hmtg.jnkernel._fullscreen_ssrc();
      var my_ssrc = hmtg.jnkernel._jn_ssrc_index();
      if(sync_fullscreen_controller != my_ssrc) {
        if(is_fullscreen) {
          if(!board.is_fullscreen) {
            board.turnon_fullscreen();

            if(!board.is_fullscreen) {
              if(board.request_fullscreen) {
                board.prompt_sync_fullscreen_alert_item = joinnetHelper.prompt_sync_fullscreen(function() {
                  if(!board.is_fullscreen) {
                    board.turnon_fullscreen();
                    board.is_passive_fullscreen = true;
                  }
                });
              }
            } else {
              board.is_passive_fullscreen = true;
            }
          }
        } else {
          if(board.prompt_sync_fullscreen_alert_item) {
            hmtgAlert.remove_link_item(board.prompt_sync_fullscreen_alert_item);
            board.prompt_sync_fullscreen_alert_item = null;
          }
          if(board.is_fullscreen && board.is_passive_fullscreen) {
            board.turnoff_fullscreen();
          }
        }
      }
    });

    $scope.can_show_board_bar = function() {
      var slide_index = board.slide_index >> 0;
      if(slide_index < 0) return false;
      if(board.slide_type != 0) return false;

      if(board.is_private) return true;

      if(!hmtg.jnkernel._jn_bConnected()) return false;
      if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return false;
      if(!hmtg.jnkernel.jn_info_CanAddMark()) return false;
      // is controller or on the active slide
      if(!(hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_iActiveSlideIndex() == slide_index)) return false;
      return true;
    }

    board.text_width = 5;
    board.color_idx = 2;
    board.color = board.colors[2];
    board.color_value = board.color2value(board.color);
    $scope.style_color = function(idx) {
      return { 'color': board.colors[idx], 'background-color': board.colors[idx] }
    }
    $scope.choose_color = function(idx) {
      board.color_idx = idx;
      board.color = board.colors[idx];
      board.color_value = board.color2value(board.color);
      if(board.shape == 'text') {
        board.draw_slide(true); // quick draw
      }
    }
    $scope.text_color = function(idx) {
      return board.color_idx == idx ? '-' : '';
    }

    $scope.$watch('w.color', function(newValue, oldValue) {
      board.color_value = board.color2value(board.color);
      if(board.shape == 'text') {
        board.draw_slide(true); // quick draw
      }
    });

    $scope.$watch('w.title_id', function(newValue, oldValue) {
      setTimeout(function() {
        board.title_selection_changed();
      }, 0);
    });

    $scope.$watch('w.page_id', function(newValue, oldValue) {
      setTimeout(function() {
        board.page_selection_changed();
      }, 0);
    });

    $scope.$watch('w.ratio_pos', function(newValue, oldValue) {
      board.change_ratio();
    });

    $scope.$watch('w.text_mark', function() {
      if($scope.w.text_mark) {
        $scope.w.text_mark = hmtgHelper.replaceUnicode($scope.w.text_mark);
      }
      if(board.shape == 'text') {
        board.draw_slide(true); // quick draw
      }
    });

    $scope.$watch('w.text_width', function() {
      if(board.shape == 'image' || board.shape == 'text' || board.shape == 'eraser') {
        board.draw_slide(true); // quick draw
      }
    });

    $scope.$watch('as.text_font', function() {
      hmtg.util.localStorage['hmtg_text_font'] = JSON.stringify(appSetting.text_font);
      board.draw_slide(true);  // quick draw
    });

    $scope.$on(hmtgHelper.WM_UPLOAD_SLIDE, function(event, upload_type, file) {
      $scope.upload_type = upload_type;
      $scope.upload_file = file;

      if(!board.upload_finished) return;
      if(!board.is_local_slide && hmtg.jnkernel._jn_conversion_count()) return;

      board.upload_finished = false;

      board.turnoff_fullscreen();

      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_upload_slide' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        // when upload slide dialog is on, should paste image slide instead of image mark
        board.to_block_paste_image_mark = true;
        var modalInstance = $modal.open({
          templateUrl: 'template/UploadSlide.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'UploadSlideModalCtrl',
          size: 'lg',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
          board.to_block_paste_image_mark = false;
          board.upload_slide(result.upload_type, result.groupname, result.title, result.file, result.png_blob);
        }, function() {
          board.to_block_paste_image_mark = false;
          board.upload_finished = true;
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_upload_slide fails');
      });
    });

    $scope.$on(hmtgHelper.WM_DELETE_SLIDE, function(event, slide_index, array) {
      board.turnoff_fullscreen();
      var modalInstance = $modal.open({
        templateUrl: 'template/DeleteSlide.htm' + hmtgHelper.cache_param,
        scope: $scope,
        controller: 'DeleteSlideModalCtrl',
        size: '',
        backdrop: 'static',
        resolve: {}
      });

      modalInstance.result.then(function(result) {
        if(result.delete_group) {
          var i;
          for(i = 0; i < array.length; i++) {
            if(board.is_local_slide) {
              board.localSlideArray[array[i]].m_bDeleted = true;
              if(board.localSlideArray[array[i]].data) {
                board.memory_usage -= board.localSlideArray[array[i]].data.length;
              }
              board.localSlideArray[array[i]].data = null;
              hmtgHelper.inside_angular++;
              board.privateUpdateDeletedSlideTitle(array[i]);
              hmtgHelper.inside_angular--;
            } else {
              hmtg.jnkernel.jn_command_DeleteSlide(array[i]);
            }
          }
        } else {
          if(board.is_local_slide) {
            board.localSlideArray[slide_index].m_bDeleted = true;
            if(board.localSlideArray[slide_index].data) {
              board.memory_usage -= board.localSlideArray[slide_index].data.length;
            }
            board.localSlideArray[slide_index].data = null;
            hmtgHelper.inside_angular++;
            board.privateUpdateDeletedSlideTitle(slide_index);
            hmtgHelper.inside_angular--;
          } else {
            hmtg.jnkernel.jn_command_DeleteSlide(slide_index);
          }
        }
      }, function() {
      });
    });


    // Creates an object with x and y defined, set to the mouse position relative to the state's canvas
    // If you wanna be super-correct this can be tricky, we have to worry about padding and borders
    /*
    function getMouse(e, element) {
    var offsetX = 0, offsetY = 0, mx, my;

    // Compute the total offset
    if(typeof element.offsetParent !== 'undefined') {
    do {
    //offsetX += element.offsetLeft + element.clientLeft - element.scrollLeft;
    //offsetY += element.offsetTop + element.clientTop - element.scrollTop;
    offsetX += element.offsetLeft + element.clientLeft;
    offsetY += element.offsetTop + element.clientTop;
    } while((element = element.offsetParent));
    }

    // Add padding and border style widths to offset
    // Also add the <html> offsets in case there's a position:fixed bar
    //offsetX += this.stylePaddingLeft + this.styleBorderLeft + this.htmlLeft;
    //offsetY += this.stylePaddingTop + this.styleBorderTop + this.htmlTop;

    if(e.type == 'touchstart' || e.type == 'touchmove') {
    mx = e.touches[0].pageX - offsetX;
    my = e.touches[0].pageY - offsetY;
    } else if(e.type == 'touchend') {
    mx = e.changedTouches[0].pageX - offsetX;
    my = e.changedTouches[0].pageY - offsetY;
    } else {
    mx = e.pageX - offsetX;
    my = e.pageY - offsetY;
    }

    // We return a simple javascript object (a hash) with x and y defined
    return { x: mx, y: my };
    }
    */

    function setup_two_touch_zoom(is_two_touch, abs_x, abs_y, abs_x2, abs_y2) {
      var last_tick = board.two_touch_last_tick;
      var now = hmtg.util.GetTickCount();
      board.two_touch_last_tick = now;
      if(is_two_touch) {
        board.two_touch_vertical_zoom_mode = false;
        board.two_touch_is_active = true;
        board.two_touch_dis_base = Math.sqrt((abs_x2 - abs_x) * (abs_x2 - abs_x) + (abs_y2 - abs_y) * (abs_y2 - abs_y));
        board.two_touch_dis_base = Math.max(1, board.two_touch_dis_base);
      } else {
        board.two_touch_vertical_zoom_mode = now - last_tick < 1000;
        if(board.two_touch_vertical_zoom_mode) {
          board.two_touch_is_active = true;
          board.two_touch_pos_base = abs_y;
        } else {
          board.two_touch_is_active = false;
        }
      }
      board.two_touch_zoom_base = board.ratio_pos;
    }
    var onMouseDown = function(e) {
      board.board0.style.cursor = 'not-allowed';
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('touchmove', onMouseMove, true);
      document.addEventListener('mouseup', onMouseUp, true);
      document.addEventListener('touchend', onMouseUp, true);

      var offset = {};
      var offset_calculated = false;

      // check whether the point is on a scroll bar
      if(board.board_container2.offsetHeight > board.board_container2.clientHeight ||
        board.board_container2.offsetWidth > board.board_container2.clientWidth) {
        hmtg.util.calcOffset(board.board0, offset);
        offset_calculated = true;

        var in_scrollbar = false;
        if(e.type == 'touchstart') {
          if(e.touches[0].pageX - offset.x > board.board_container2.clientWidth) {
            in_scrollbar = true;
          } else if(e.touches[0].pageY - offset.y > board.board_container2.clientHeight) {
            in_scrollbar = true;
          }
        } else {
          if(e.pageX - offset.x > board.board_container2.clientWidth) {
            in_scrollbar = true;
          } else if(e.pageY - offset.y > board.board_container2.clientHeight) {
            in_scrollbar = true;
          }
        }
        if(in_scrollbar) {
          board.board0.style.cursor = 'auto';
          return;
        }
      }

      if(board.drag_idx != -1) {
        return;
      }
      if(!board.is_private) {
        if(!hmtg.jnkernel._jn_bConnected()) return;
        if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
        if(!hmtg.jnkernel.jn_info_CanAddMark()) return;
      }

      var slide_index = board.slide_index >> 0;
      if(slide_index < 0) return;
      var slide_array = board.is_local_slide ? board.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= slide_array.length) return;
      if(board.slide_type != 0) return;

      if(!board.is_private) {
        // is controller or on the active slide
        if(!(hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_iActiveSlideIndex() == slide_index)) return;
      }
      //var ratio = board.ratio;
      //var mouse = getMouse(e, board.board0);
      if(!offset_calculated) {
        hmtg.util.calcOffset(board.board0, offset);
      }

      //var aaa = board.board_container2.offsetHeight - board.board_container2.clientHeight;
      //hmtg.util.log(-2, 'e.pageY - offset.y = ' + (e.pageY - offset.y) + '; clientheight = ' + board.board_container2.clientHeight + '; scrollbar height = ' + aaa);

      var mark = board.local_mark;
      if(board.shape == 'pointer'
        || board.shape == 'line'
        || board.shape == 'rect'
        || board.shape == 'rect2'
        || board.shape == 'ellipse'
        || board.shape == 'ellipse2'
        || board.shape == 'image'
        || board.shape == 'text'
        || board.shape == 'select'
        || board.shape == 'scroll'
        ) {
        if(board.shape == 'pointer' && board.is_private) return;
        if(board.shape == 'image' && !board.selected_mark) return;
        if(board.shape == 'text' && !board.text_mark) return;
        if(board.shape == 'select' && !board.mark_array.length) return;
        board.drag_idx = slide_index;
        //if(board.board0.setCapture) board.board0.setCapture();
        if(board.shape == 'pointer') mark.m_iShape = board.POINTER;
        else if(board.shape == 'line') mark.m_iShape = board.LINE;
        else if(board.shape == 'rect' || board.shape == 'rect2') mark.m_iShape = board.RECTANGLE;
        else if(board.shape == 'ellipse' || board.shape == 'ellipse2') mark.m_iShape = board.ELLIPSE;
        mark.ax = [];
        mark.ay = [];
        mark.select_mode = false; // for select, either select or drag
        mark.select_toggle_mode = false;  // for select mode, either toggle or not
        mark.id_array0 = [];
        board.multi_touch = false;
        board.board0.style.cursor = 'crosshair';
        if(e.type == 'touchstart') {
          var abs_x = e.touches[0].pageX - offset.x;
          var abs_y = e.touches[0].pageY - offset.y;
          if(appSetting.board_hide_toolbar && e.touches.length <= 1) {
            if(abs_x >= 0 && abs_x <= 40 && abs_y >= 0 && abs_y <= 33) {
              board.drag_idx = -1;
              return;
            }
          }
          if(board.shape != 'scroll') {
            // scroll has its own rule
            e.preventDefault();
          }
          if(e.touches.length > 1) {
            var x = board.transformX(abs_x);
            var y = board.transformY(abs_y);
            var abs_x2 = e.touches[1].pageX - offset.x;
            var abs_y2 = e.touches[1].pageY - offset.y;
            var x2 = board.transformX(abs_x2);
            var y2 = board.transformY(abs_y2);
            if(board.shape == 'scroll') {
              setup_two_touch_zoom(true, abs_x, abs_y, abs_x2, abs_y2);
              if(board.two_touch_is_active) {
                // once become active, use zoom rule
                e.preventDefault();
                return;
              }
            }
            mark.ax.push(x, x2);
            mark.ay.push(y, y2);
            board.multi_touch = true;
            if(board.shape == 'select') {
              mark.select_mode = true;
              mark.select_toggle_mode = e.ctrlKey;
              if(e.ctrlKey) mark.id_array0 = mark.id_array.slice(0);
              board.updateSelectedMark();
            }
          } else {
            var x = board.transformX(abs_x);
            var y = board.transformY(abs_y);
            if(board.shape == 'scroll') {
              setup_two_touch_zoom(false, abs_x, abs_y);
              if(board.two_touch_is_active) {
                // once become active, use zoom rule
                e.preventDefault();
                return;
              }
            }
            mark.ax.push(x, x);
            mark.ay.push(y, y);
            select_single_touch(e.ctrlKey);
          }
        } else {
          var abs_x = e.pageX - offset.x;
          var abs_y = e.pageY - offset.y;
          if(appSetting.board_hide_toolbar) {
            if(abs_x >= 0 && abs_x <= 40 && abs_y >= 0 && abs_y <= 33) {
              board.drag_idx = -1;
              return;
            }
          }
          var x = board.transformX(abs_x);
          var y = board.transformY(abs_y);
          if(board.shape == 'scroll') {
            setup_two_touch_zoom(false, abs_x, abs_y);
            if(board.two_touch_is_active) {
              // once become active, use zoom rule
              e.preventDefault();
              return;
            }
          }
          mark.ax.push(x, x);
          mark.ay.push(y, y);
          select_single_touch(e.ctrlKey);
        }
        board.draw_slide();
      } else if(board.shape == 'freehand'
        || board.shape == 'eraser'
        || board.shape == 'highlight'
        ) {
        board.drag_idx = slide_index;
        //if(board.board0.setCapture) board.board0.setCapture();
        if(board.shape == 'freehand') mark.m_iShape = board.FREEHAND;
        else if(board.shape == 'eraser') mark.m_iShape = board.RECT_ERASER;
        else if(board.shape == 'highlight') mark.m_iShape = board.HIGH_LIGHT;
        mark.ax = [];
        mark.ay = [];
        board.board0.style.cursor = 'crosshair';
        if(e.type == 'touchstart') {
          var abs_x = e.touches[0].pageX - offset.x;
          var abs_y = e.touches[0].pageY - offset.y;
          if(appSetting.board_hide_toolbar) {
            if(abs_x >= 0 && abs_x <= 40 && abs_y >= 0 && abs_y <= 33) {
              board.drag_idx = -1;
              return;
            }
          }
          e.preventDefault();
          var x = board.transformX(abs_x);
          var y = board.transformY(abs_y);
          mark.ax.push(x);
          mark.ay.push(y);
        } else {
          var abs_x = e.pageX - offset.x;
          var abs_y = e.pageY - offset.y;
          if(appSetting.board_hide_toolbar) {
            if(abs_x >= 0 && abs_x <= 40 && abs_y >= 0 && abs_y <= 33) {
              board.drag_idx = -1;
              return;
            }
          }
          var x = board.transformX(abs_x);
          var y = board.transformY(abs_y);
          mark.ax.push(x);
          mark.ay.push(y);
        }
        board.draw_slide();
      }
      function select_single_touch(ctrl_pressed) {
        if(board.shape == 'select') {
          if(ctrl_pressed) {
            var hit = board.hitTest(x, y, true);
            if(hit) {
              //board.drag_idx = -1;
              var id = hit.mark.link._m_iID();
              var idx = mark.id_array.indexOf(id);
              if(idx != -1) {
                mark.id_array.splice(idx, 1);
              } else {
                mark.id_array.push(id);
              }
            }
            mark.select_mode = true;
            mark.select_toggle_mode = ctrl_pressed;
            if(ctrl_pressed) mark.id_array0 = mark.id_array.slice(0);
            board.updateSelectedMark();
          } else {
            var hit = board.hitTest(x, y);
            if(mark.id_array.length && !hit) {
              mark.id_array = [];
              hit = board.hitTest(x, y);
            }
            if(hit) {
              if(hit.hit_type == 9) {
                board.drag_idx = -1;
                $scope.hide_mark();
              } else {
                mark.hit_type = hit.hit_type;
                if(!mark.id_array.length) {
                  mark.id_array.push(hit.mark.link._m_iID());
                }
              }
            } else {
              mark.select_mode = true;
              board.updateSelectedMark();
            }
          }
        }
      }
    }
    var onMouseHover = function(e) {
      if(board.drag_idx != -1) {
        board.mousemove_detected = false;
        return;
      }
      if(board.shape != 'image'
      && board.shape != 'text'
      && board.shape != 'eraser'
      && board.shape != 'select'
      ) {
        board.board0.removeEventListener('mousemove', onMouseHover, true);
        return;
      }
      // this flag is used to detect whether a device support mouse move
      // if mouse move is not supported, the floating image/text mark will be drawn at
      // the center of the VISIBLE image area.
      board.mousemove_detected = true;
      var offset = {};
      hmtg.util.calcOffset(board.board0, offset);
      board.mousemove_x = e.pageX - offset.x;
      board.mousemove_y = e.pageY - offset.y;
      if(board.shape == 'select') {
        decideSelectCursor(e.ctrlKey);
      } else {
        board.draw_slide(true); // quick draw
      }
    }

    var onMouseMove = function(e) {
      if(board.drag_idx == -1) return;
      board.board0.style.cursor = board.drag_idx == -1 ? 'auto' : 'not-allowed';
      if(!board.is_private) {
        if(!hmtg.jnkernel._jn_bConnected()) return;
        if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
        if(!hmtg.jnkernel.jn_info_CanAddMark()) return;
      }

      var slide_index = board.slide_index >> 0;
      if(slide_index < 0) return;
      var slide_array = board.is_local_slide ? board.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= slide_array.length) return;
      if(board.slide_type != 0) return;

      if(!board.is_private) {
        // is controller or on the active slide
        if(!(hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_iActiveSlideIndex() == slide_index)) return;
      }

      if(board.drag_idx != slide_index) {
        board.drag_idx = -1;
        board.board0.style.cursor = 'auto';
        return;
      }

      var ratio = board.ratio;
      //var mouse = getMouse(e, board.board0);
      var offset = {};
      hmtg.util.calcOffset(board.board0, offset);
      var mark = board.local_mark;
      if(board.shape == 'pointer'
        || board.shape == 'line'
        || board.shape == 'rect'
        || board.shape == 'rect2'
        || board.shape == 'ellipse'
        || board.shape == 'ellipse2'
        || board.shape == 'image'
        || board.shape == 'text'
        || board.shape == 'scroll'
        || (board.shape == 'select' && mark.select_mode)
        ) {
        board.board0.style.cursor = 'crosshair';
        if(e.type == 'touchmove') {
          if(board.shape != 'scroll') {
            // scroll has its own rule
            e.preventDefault();
          }
          if(e.touches.length > 1) {
            var abs_x = e.touches[0].pageX - offset.x;
            var abs_y = e.touches[0].pageY - offset.y;
            var abs_x2 = e.touches[1].pageX - offset.x;
            var abs_y2 = e.touches[1].pageY - offset.y;
            var x = board.transformX(abs_x);
            var y = board.transformY(abs_y);
            var x2 = board.transformX(abs_x2);
            var y2 = board.transformY(abs_y2);
            if(board.shape == 'scroll') {
              if(board.two_touch_is_active) {
                if(board.two_touch_vertical_zoom_mode) {
                  // vertial zoom
                  two_touch_zoom(abs_x, abs_y);
                } else {
                  // if two touch zoom is active, execute it
                  two_touch_zoom(abs_x, abs_y, abs_x2, abs_y2);
                }
              } else {
                // if not in active zooming yet, setup two touch zoom
                setup_two_touch_zoom(true, abs_x, abs_y, abs_x2, abs_y2);
              }
              if(board.two_touch_is_active) {
                // once become active, use zoom rule
                e.preventDefault();
                return;
              }
            }
            mark.ax[0] = x;
            mark.ay[0] = y;
            mark.ax[1] = x2;
            mark.ay[1] = y2;
            board.multi_touch = true;
          } else if(board.multi_touch && e.changedTouches.length > 0) {
            var abs_x = e.changedTouches[0].pageX - offset.x;
            var abs_y = e.changedTouches[0].pageY - offset.y;
            var abs_x2 = e.touches[0].pageX - offset.x;
            var abs_y2 = e.touches[0].pageY - offset.y;
            var x = board.transformX(abs_x);
            var y = board.transformY(abs_y);
            var x2 = board.transformX(abs_x2);
            var y2 = board.transformY(abs_y2);
            if(board.shape == 'scroll' && board.two_touch_is_active) {
              if(board.two_touch_vertical_zoom_mode) {
                // vertical zoom
                two_touch_zoom(abs_x, abs_y);
              } else {
                // two touch zoom
                two_touch_zoom(abs_x, abs_y, abs_x2, abs_y2);
              }
              e.preventDefault();
              return;
            }
            if(board.shape == 'image') {
              mark.ax[0] = (x + x2) >> 1;
              mark.ay[0] = (y + y2) >> 1;
            } else {
              mark.ax[0] = x;
              mark.ay[0] = y;
            }
            mark.ax[1] = x2;
            mark.ay[1] = y2;
            board.multi_touch = false;
          } else {
            var abs_x = e.touches[0].pageX - offset.x;
            var abs_y = e.touches[0].pageY - offset.y;
            var x = board.transformX(abs_x);
            var y = board.transformY(abs_y);
            if(board.shape == 'scroll' && board.two_touch_is_active) {
              if(board.two_touch_vertical_zoom_mode) {
                // vertical zoom
                two_touch_zoom(abs_x, abs_y);
              }
              e.preventDefault();
              return;
            }
            mark.ax[1] = x;
            mark.ay[1] = y;
            board.multi_touch = false;
          }
        } else {
          var abs_x = e.pageX - offset.x;
          var abs_y = e.pageY - offset.y;
          var x = board.transformX(abs_x);
          var y = board.transformY(abs_y);
          if(board.shape == 'scroll' && board.two_touch_is_active) {
            if(board.two_touch_vertical_zoom_mode) {
              // vertical zoom
              two_touch_zoom(abs_x, abs_y);
            }
            e.preventDefault();
            return;
          }
          mark.ax[1] = x;
          mark.ay[1] = y;
        }
        if(board.shape == 'select') {
          board.updateSelectedMark();
          board.draw_slide();
        } else {
          board.draw_slide(true); // quick draw
        }
      } else if(board.shape == 'select' && !mark.select_mode) {
        board.board0.style.cursor = 'crosshair';
        var x, y;
        if(e.type == 'touchmove') {
          e.preventDefault();
          x = board.transformX(e.touches[0].pageX - offset.x);
          y = board.transformY(e.touches[0].pageY - offset.y);
        } else {
          x = board.transformX(e.pageX - offset.x);
          y = board.transformY(e.pageY - offset.y);
        }
        mark.ax[1] = x;
        mark.ay[1] = y;
        board.draw_slide();
        if(!mark.id_array.length) {
          // the selected marks are all deleted by other pariticipants
          board.drag_idx = -1;
          board.board0.style.cursor = 'auto';
        }
      } else if(board.shape == 'freehand'
        || board.shape == 'eraser'
        || board.shape == 'highlight'
        ) {
        board.board0.style.cursor = 'crosshair';
        var x, y;
        if(e.type == 'touchmove') {
          e.preventDefault();
          x = board.transformX(e.touches[0].pageX - offset.x);
          y = board.transformY(e.touches[0].pageY - offset.y);
        } else {
          x = board.transformX(e.pageX - offset.x);
          y = board.transformY(e.pageY - offset.y);
        }
        if(mark.ax[mark.ax.length - 1] != x || mark.ay[mark.ay.length - 1] != y) {
          mark.ax.push(x);
          mark.ay.push(y);
          board.draw_stroke3(mark); // fast drawing
          board.draw_slide(board.shape != 'eraser'); // quick draw
        }
      }

      function two_touch_zoom(abs_x, abs_y, abs_x2, abs_y2) {
        if(board.is_fit_page) {
          board.is_fit_page = false;
          $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
        }
        if(board.two_touch_vertical_zoom_mode) {
          // vertical zoom
          var dis = abs_y - board.two_touch_pos_base
          var zoom_speed_base = 50;
          if(dis > 0) {
            board.ratio_pos = (zoom_speed_base + dis) / zoom_speed_base * board.two_touch_zoom_base;
          } else {
            board.ratio_pos = zoom_speed_base / (zoom_speed_base - dis) * board.two_touch_zoom_base;
          }
        } else {
          // two touch zoom
          var dis = Math.sqrt((abs_x2 - abs_x) * (abs_x2 - abs_x) + (abs_y2 - abs_y) * (abs_y2 - abs_y));
          dis = Math.max(1, dis);
          board.ratio_pos = dis / board.two_touch_dis_base * board.two_touch_zoom_base;
        }
        board.ratio_pos = Math.min(800, board.ratio_pos);
        board.ratio_pos = Math.max(1, board.ratio_pos);
        board.change_ratio();
      }
    }
    var onMouseUp = function(e) {
      board.board0.style.cursor = 'auto';
      board.two_touch_is_active = false;
      if(board.drag_idx == -1) {
        document.removeEventListener('mouseup', onMouseUp, true);
        document.removeEventListener('touchend', onMouseUp, true);
        return;
      }
      if(!board.is_private) {
        if(!hmtg.jnkernel._jn_bConnected()) {
          return;
        }
        if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
        if(!hmtg.jnkernel.jn_info_CanAddMark()) {
          return;
        }
      }

      var slide_index = board.slide_index >> 0;
      if(slide_index < 0) {
        return;
      }
      var slide_array = board.is_local_slide ? board.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= slide_array.length) {
        return;
      }
      if(board.slide_type != 0) {
        return;
      }

      if(!board.is_private) {
        // is controller or on the active slide
        if(!(hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_iActiveSlideIndex() == slide_index)) {
          return;
        }
      }

      if(board.drag_idx != slide_index) {
        board.drag_idx = -1;
        return;
      }

      //var ratio = board.ratio;
      //var mouse = getMouse(e, board.board0);
      var offset = {};
      hmtg.util.calcOffset(board.board0, offset);
      var mark = board.local_mark;
      if(board.shape == 'pointer'
        || board.shape == 'line'
        || board.shape == 'rect'
        || board.shape == 'rect2'
        || board.shape == 'ellipse'
        || board.shape == 'ellipse2'
        || board.shape == 'image'
        || board.shape == 'text'
        || (board.shape == 'select' && mark.select_mode)
        ) {
        var x, y;
        if(e.type == 'touchend') {
          e.preventDefault();
          if(e.touches.length > 1) {
            var x = board.transformX(e.touches[0].pageX - offset.x);
            var y = board.transformY(e.touches[0].pageY - offset.y);
            var x2 = board.transformX(e.touches[1].pageX - offset.x);
            var y2 = board.transformY(e.touches[1].pageY - offset.y);
            mark.ax[0] = x;
            mark.ay[0] = y;
            mark.ax[1] = x2;
            mark.ay[1] = y2;
            board.multi_touch = true;
            board.draw_slide();
            board.board0.style.cursor = 'crosshair';
            return;
          } else if(e.touches.length && board.multi_touch && e.changedTouches.length > 0) {
            var x = board.transformX(e.changedTouches[0].pageX - offset.x);
            var y = board.transformY(e.changedTouches[0].pageY - offset.y);
            var x2 = board.transformX(e.touches[0].pageX - offset.x);
            var y2 = board.transformY(e.touches[0].pageY - offset.y);
            if(board.shape == 'image') {
              mark.ax[0] = (x + x2) >> 1;
              mark.ay[0] = (y + y2) >> 1;
            } else {
              mark.ax[0] = x;
              mark.ay[0] = y;
            }
            mark.ax[1] = x2;
            mark.ay[1] = y2;
            board.multi_touch = false;
            board.draw_slide();
            board.board0.style.cursor = 'crosshair';
            return;
          } else if(e.changedTouches.length > 1) {
            mark.ax[0] = board.transformX(e.changedTouches[0].pageX - offset.x);
            mark.ay[0] = board.transformY(e.changedTouches[0].pageY - offset.y);
            x = board.transformX(e.changedTouches[1].pageX - offset.x);
            y = board.transformY(e.changedTouches[1].pageY - offset.y);
          } else {
            x = board.transformX(e.changedTouches[0].pageX - offset.x);
            y = board.transformY(e.changedTouches[0].pageY - offset.y);
          }
        } else {
          x = board.transformX(e.pageX - offset.x);
          y = board.transformY(e.pageY - offset.y);
        }
        if(board.shape == 'pointer') {
          var x1 = Math.min(x, mark.ax[0]);
          var x2 = Math.max(x, mark.ax[0]);
          var y1 = Math.min(y, mark.ay[0]);
          var y2 = Math.max(y, mark.ay[0]);
          var cx = x2 - x1;
          var cy = y2 - y1;
          if(!board.is_private)
            hmtg.jnkernel.jn_command_FocusPointer(slide_index, x1, y1, cx, cy, board.color_value, board.text_width);
        } else if(board.shape == 'line' || board.shape == 'rect' || board.shape == 'rect2' || board.shape == 'ellipse' || board.shape == 'ellipse2') {
          if(board.shape == 'rect2' || board.shape == 'ellipse2') {
            mark.ax[2] = mark.ax[1];
            mark.ay[2] = mark.ay[1];
          }
          if(mark.ax[0] != mark.ax[1] || mark.ay[0] != mark.ay[1]) {
            if(board.is_private) {
              board.private_SendNewStroke(slide_index, board.color_value, board.text_width,
                mark.m_iShape, mark.ax, mark.ay);
            } else {
              var new_mark = board.create_SendNewStroke(slide_index, board.color_value, board.text_width,
                mark.m_iShape, mark.ax, mark.ay);
              if(new_mark) {
                board.wait_list_mark_array.push(new_mark);
                if(board.wait_list_mark_array.length == 1) {
                  $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
                }
                new_mark.timeout_id = setTimeout(function() {
                  board.remove_wait_list_mark(new_mark);
                }, board.WAIT_LIST_TIMEOUT);
              }
              hmtg.jnkernel.jn_command_SendNewStroke(slide_index, board.color_value, board.text_width,
                mark.m_iShape, mark.ax, mark.ay);
            }
          }
        } else if(board.shape == 'image' || board.shape == 'text') {
          mark.ax[1] = x;
          mark.ay[1] = y;
          if(board.shape == 'image') {
            board.send_image_mark();
          } else {
            board.send_text_mark();
          }
        }
        if(board.shape == 'select') board.updateSelectedMark();
        board.drag_idx = -1;
        board.draw_slide();
      } else if(board.shape == 'select' && !mark.select_mode) {
        var x, y;
        if(e.type == 'touchend') {
          e.preventDefault();
          x = board.transformX(e.changedTouches[0].pageX - offset.x);
          y = board.transformY(e.changedTouches[0].pageY - offset.y);
        } else {
          x = board.transformX(e.pageX - offset.x);
          y = board.transformY(e.pageY - offset.y);
        }
        mark.ax[1] = x;
        mark.ay[1] = y;
        var offset_x = (mark.ax[1] - mark.ax[0]) >> 0;
        var offset_y = (mark.ay[1] - mark.ay[0]) >> 0;
        if(offset_x || offset_y) {
          if(mark.id_array.length) {
            mark_move(mark, slide_index, offset_x, offset_y);
          }
        }
        board.drag_idx = -1;
        board.draw_slide();
      } else if(board.shape == 'freehand'
        || board.shape == 'eraser'
        || board.shape == 'highlight'
        ) {
        var x, y;
        if(e.type == 'touchend') {
          e.preventDefault();
          x = board.transformX(e.changedTouches[0].pageX - offset.x);
          y = board.transformY(e.changedTouches[0].pageY - offset.y);
        } else {
          x = board.transformX(e.pageX - offset.x);
          y = board.transformY(e.pageY - offset.y);
        }
        if(mark.ax[mark.ax.length - 1] != x || mark.ay[mark.ay.length - 1] != y) {
          mark.ax.push(x);
          mark.ay.push(y);
        }
        if(mark.ax.length > 0) {
          if(board.is_private) {
            board.private_SendNewStroke(slide_index, board.color_value, board.text_width,
              mark.m_iShape, mark.ax, mark.ay);
          } else {
            var new_mark = board.create_SendNewStroke(slide_index, board.color_value, board.text_width,
              mark.m_iShape, mark.ax, mark.ay);
            if(new_mark) {
              board.wait_list_mark_array.push(new_mark);
              if(board.wait_list_mark_array.length == 1) {
                $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
              }
              new_mark.timeout_id = setTimeout(function() {
                board.remove_wait_list_mark(new_mark);
              }, board.WAIT_LIST_TIMEOUT);
            }
            hmtg.jnkernel.jn_command_SendNewStroke(slide_index, board.color_value, board.text_width,
              mark.m_iShape, mark.ax, mark.ay);
          }
        }
        board.drag_idx = -1;
        board.draw_slide();
      } else if(board.shape == 'scroll') {
        board.drag_idx = -1;
        $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
      }
    }

    board.board0.addEventListener('mousedown', onMouseDown, true);
    board.board0.addEventListener('touchstart', onMouseDown, true);

    $scope.hide_mark = function() {
      if(board.drag_idx != -1) {
        return;
      }
      if(!board.is_private) {
        if(!hmtg.jnkernel._jn_bConnected()) return;
        if(hmtg.jnkernel._jn_iWorkMode() != hmtg.config.NORMAL) return;
        if(!hmtg.jnkernel.jn_info_CanAddMark()) return;
      }

      var slide_index = board.slide_index >> 0;
      if(slide_index < 0) return;
      var slide_array = board.is_local_slide ? board.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      if(slide_index >= slide_array.length) return;
      if(board.slide_type != 0) return;

      if(!board.is_private) {
        // is controller or on the active slide
        if(!(hmtg.jnkernel._is_sync_ssrc() || hmtg.jnkernel._jn_iActiveSlideIndex() == slide_index)) return;
      }

      var mark = board.local_mark;
      if(board.shape == 'select' && mark.id_array.length) {
        var offset_x = -0x1fffffff;
        var offset_y = -0x1fffffff;
        mark.hit_type = 8;

        mark_move(mark, slide_index, offset_x, offset_y);

        mark.id_array = [];
        board.draw_slide();
      }
    }

    function mark_move(mark, slide_index, offset_x, offset_y) {
      if(board.wait_list_mark_array.length) {
        var id_array_with_reference = mark.id_array;
        mark.hit_type += 100; // relative mark move
      } else {
        // id_array_with_reference is not necessary for web app, but just have to be compatible with native JoinNet
        var id_array_with_reference = searchReferenceID(mark.id_array);
      }
      if(board.is_private) {
        board.private_SendMarkMove(slide_index, offset_x, offset_y, mark.hit_type, id_array_with_reference);
      } else {
        var new_mark = board.create_SendMarkMove(slide_index, offset_x, offset_y, mark.hit_type, id_array_with_reference, mark.id_array);
        if(new_mark) {
          board.wait_list_mark_array.push(new_mark);
          if(board.wait_list_mark_array.length == 1) {
            $rootScope.$broadcast(hmtgHelper.WM_UPDATE_BOARD);
          }
          new_mark.timeout_id = setTimeout(function() {
            board.remove_wait_list_mark(new_mark);
          }, board.WAIT_LIST_TIMEOUT);
        }
        hmtg.jnkernel.jn_command_SendMarkMove(slide_index, offset_x, offset_y, mark.hit_type, id_array_with_reference);
      }
    }

    function decideSelectCursor(ctrl_pressed) {
      board.board0.style.cursor = 'auto';
      var local_mark = board.local_mark;
      var x = board.mousemove_x;
      var y = board.mousemove_y;
      x = board.transformX(x);
      y = board.transformY(y);
      var hit = board.hitTest(x, y, ctrl_pressed);
      if(!hit) return;
      board.board0.style.cursor = hit.cursor;
    }

    function searchReferenceID(id_array) {
      var slide_index = board.slide_index >> 0;
      var slide_array = board.is_local_slide ? board.localSlideArray : hmtg.jnkernel._jn_SlideArray();
      var slide = slide_array[slide_index];
      var i;
      var id2 = [];
      for(i = 0; i < id_array.length; i++) {
        var id = singleSearch(id_array[i]);
        id2.push(id_array[i]);
        if(id >= 0) {
          id2.push(id);
        }
      }
      function singleSearch(id) {
        var j;
        var _mark_array = slide._mark_array();  // raw mark array from jnkernel
        if(!board.is_local_slide && board.is_private) _mark_array = board.privateNote[slide_index].mark_array;
        for(j = _mark_array.length - 1; j >= 0; j--) {
          var _mark = _mark_array[j];
          var type = _mark._m_byMarkType();
          if(type != hmtg.config.MARK_MOVE) continue;
          var id_array = _mark._id_array();
          var found = false;
          var k;
          for(k = 0; k < id_array.length; k++) {
            if(id_array[k] == id) {
              found = true;
              break;
            }
          }
          if(found) {
            return _mark._m_iID();
          }
        }
        return -1;
      }
      return id2;
    }

    $scope.$on('$includeContentError', function(e, param) {
      if(param == 'lazy_htm/joinnet_image_bar.htm' + hmtgHelper.cache_param) $scope.partialImageBar = '';
    });
    $scope.set_shape = function(shape) {
      if(shape == 'image'
       || shape == 'text'
       || shape == 'eraser'
       || shape == 'select'
       ) {
        board.board0.addEventListener('mousemove', onMouseHover, true);
        board.mousemove_detected = false;
      }
      if(shape == 'image') {
        // if shape is already 'image', always show the manage mark dialog
        //$scope.manage_mark(board.shape == shape);
        $scope.manage_mark(true);  // do not show the manage mark dialog from this button. force the user to use the toolbar button.
      }
      if(board.shape == shape) return;
      var can_quick_draw = !board.local_mark.id_array.length;
      board.shape = shape;
      board.local_mark.id_array = [];  // reset local mark's id array
      board.draw_slide(can_quick_draw);
    }
    $scope.manage_mark = function(show_dialog) {
      if(show_dialog) {
        // open a file, and pass it to the manage mark dialog box
        hmtgHelper.inside_angular++;
        board.turnoff_fullscreen();
        hmtgHelper.inside_angular--;

        var myinput = hmtgHelper.file_reset('fileInput', 'image/*');

        myinput.addEventListener("change", handleFile, false);
        if(window.navigator.msSaveOrOpenBlob) {
          setTimeout(function() {
            myinput.click();  // use timeout, otherwise, IE will complain error
          }, 0);
        } else {
          // it is necessary to exempt error here
          // when there is an active dropdown menu, a direct click will cause "$apply already in progress" error
          window.g_exempted_error++;
          myinput.click();
          window.g_exempted_error--;
        }
        return;

        function handleFile() {
          myinput.removeEventListener("change", handleFile, false);
          var file = myinput.files[0];

          if(!file) {
            return;
          }
          open_manage_mark_dialog(file);  // pass the file to the dialog box
        }
      } else {
        open_manage_mark_dialog();
      }

    }
    function open_manage_mark_dialog(orig_file) {
      $ocLazyLoad.load({
        name: 'joinnet',
        files: ['lazy_js' + (hmtg.lazy_min ? '_min' : '') + '/modal_image_mark' + (hmtg.lazy_min ? '.min' : '') + '.js' + hmtgHelper.cache_param]
      }).then(function() {
        if(typeof appSetting.can_show_image_bar == 'undefined') {
          var parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_can_show_image_bar']);
          appSetting.can_show_image_bar = parsed === 'undefined' ? false : !!parsed;
        }
        if(typeof appSetting.can_show_bottom_image_bar == 'undefined') {
          var parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_can_show_bottom_image_bar']);
          appSetting.can_show_bottom_image_bar = parsed === 'undefined' ? false : !!parsed;
        }
        if(!appSetting.can_show_image_bar && !appSetting.can_show_bottom_image_bar) {
          appSetting.can_show_image_bar = true;
        }
        if(typeof appSetting.image_bar_item_size == 'undefined') {
          var parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_image_bar_item_size']);
          appSetting.image_bar_item_size = parsed === 'undefined' ? (hmtgHelper.isMobile ? 24 : 16) : parsed;
          if(appSetting.image_bar_item_size != 12 && appSetting.image_bar_item_size != 16 && appSetting.image_bar_item_size != 24 && appSetting.image_bar_item_size != 32) {
            appSetting.image_bar_item_size = 24;
          }
        }
        //if(typeof appSetting.use_png_mark == 'undefined') {
        //var parsed = hmtg.util.parseJSON(hmtg.util.localStorage['hmtg_use_png_mark']);
        //appSetting.use_png_mark = parsed === 'undefined' ? false : !!parsed;
        //}

        if(!$scope.partialImageBar) {
          $scope.partialImageBar = 'lazy_htm/joinnet_image_bar.htm' + hmtgHelper.cache_param;
          hmtgHelper.fast_apply();
        }

        hmtgHelper.inside_angular++;
        board.turnoff_fullscreen();
        hmtgHelper.inside_angular--;

        // $modalInstance.close({ src: window.URL.createObjectURL(file), auto_play: $scope.w.auto_play, audio_only: $scope.w.audio_only });
        $scope.orig_file = orig_file;  // pass the file to the dialog box
        var modalInstance = $modal.open({
          templateUrl: 'template/ImageMark.htm' + hmtgHelper.cache_param,
          scope: $scope,
          controller: 'ImageMarkCtrl',
          size: 'lg',
          backdrop: 'static',
          resolve: {}
        });

        modalInstance.result.then(function(result) {
        }, function() {
          setTimeout(function() {
            // if(board.selected_mark) {
            //   var mark = board.local_mark;
            //   mark.ax = [0, 0];
            //   mark.ay = [0, 0];
            //   board.drag_idx = board.slide_index >> 0;
            //   if(board.drag_idx != -1) {
            //     board.send_image_mark();
            //   }
            // }
            board.draw_slide();
          }, 0)
        });
      }, function(e) {
        hmtg.util.log(-1, 'Warning! lazy_loading modal_image_mark fails');
      });
    }

    // note menu
    $scope.note_menu = [];
    $scope.note_ontoggle = function(open) {
      $scope.note_menu = [];

      if(!open) {
        if(board.has_action_menu == 'note') board.has_action_menu = '';
        return;
      }

      board.has_action_menu = 'note';
      var menu = $scope.note_menu;
      // prepare the menu
      if(board.is_private) {
        menu.push({ "text": $translate.instant('ID_WHITE_BOARD'), "onclick": board.switchWhiteBoard });
      }
      if(!board.is_private || board.is_local_slide) {
        menu.push({ "text": $translate.instant('ID_TOGGLE_PRIVATE_NOTE'), "onclick": board.switchPrivate });
      }
      if(!board.is_local_slide) {
        menu.push({ "text": $translate.instant('ID_TOGGLE_LOCAL_SLIDE'), "onclick": board.switchLocal });
      }

      // white board case
      if(!board.is_private && (board.slide_index >> 0) >= 0) {
        var slide = hmtg.jnkernel._jn_SlideArray()[board.slide_index >> 0];
        if(!slide._m_bDeleted()) {
          if(slide._is_blank_page() || slide._downloaded() == 1) {
            menu.push({ "text": $translate.instant('ID_COPY_SLIDE_TO_LOCAL'), "onclick": board.copyToLocal });
          }
        }
      }
      // private note case
      if(board.is_private && !board.is_local_slide && (board.slide_index >> 0) >= 0) {
        var slide = hmtg.jnkernel._jn_SlideArray()[board.slide_index >> 0];
        if(!slide._m_bDeleted()) {
          if(slide._is_blank_page() || slide._downloaded() == 1) {
            if(board.can_upload(true)) {
              menu.push({ "text": $translate.instant('ID_COPY_SLIDE_TO_BOARD'), "onclick": board.copyToBoard });
            }
            menu.push({ "text": $translate.instant('ID_COPY_SLIDE_TO_LOCAL'), "onclick": board.copyToLocal });
          }
        }
      }
      // local board case
      if(board.is_local_slide && (board.slide_index >> 0) >= 0) {
        if(board.can_upload(true)) {
          menu.push({ "text": $translate.instant('ID_COPY_SLIDE_TO_BOARD'), "onclick": board.copyToBoard });
        }
        menu.push({ "text": $translate.instant('ID_RESET_LOCAL_BOARD'), "onclick": board.resetLocal });
        var slide = board.localSlideArray[board.slide_index >> 0];
        if(!slide._is_blank_page() && !slide._m_bDeleted() && !hmtg.util.endsWith(slide._m_szName(), '.jzf') && !hmtg.util.endsWith(slide._m_szName(), '.txt.jcz')) {
          menu.push({ "text": $translate.instant('ID_DUPLICATE_SLIDE'), "onclick": board.dupLocal });
        }
      }

      /*
      if(!menu.length) {
      $scope.w.is_note_menu_open = 0;
      if(board.has_action_menu == 'note') board.has_action_menu = '';
      }
      */
    }

    // fit menu
    $scope.fit_menu = [];
    $scope.fit_ontoggle = function(open) {
      $scope.fit_menu = [];

      if(!open) {
        if(board.has_action_menu == 'fit') board.has_action_menu = '';
        return;
      }

      board.has_action_menu = 'fit';
      var menu = $scope.fit_menu;
      var prefix = board.is_auto_fit ? '* ' : '# ';
      // prepare the menu
      menu.push({ "text": ((board.is_auto_fit) ? '= ' : '') + $translate.instant('ID_AUTO_SELECT'), "onclick": autoFit });
      menu.push({ "text": ((board.is_fit_page && !board.fit_mode) ? prefix : '') + $translate.instant('ID_FIT_WIDTH'), "onclick": fitWidth });
      menu.push({ "text": ((board.is_fit_page && board.fit_mode == 1) ? prefix : '') + $translate.instant('ID_FIT_PAGE'), "onclick": fitPage1 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 100) ? prefix : '') + '100%', "onclick": fit100 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 25) ? prefix : '') + '25%', "onclick": fit25 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 50) ? prefix : '') + '50%', "onclick": fit50 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 75) ? prefix : '') + '75%', "onclick": fit75 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 100) ? prefix : '') + '100%', "onclick": fit100 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 150) ? prefix : '') + '150%', "onclick": fit150 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 200) ? prefix : '') + '200%', "onclick": fit200 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 400) ? prefix : '') + '400%', "onclick": fit400 });
      menu.push({ "text": ((!board.is_fit_page && board.ratio_pos == 800) ? prefix : '') + '800%', "onclick": fit800 });

      function autoFit() {
        if(!board.is_auto_fit) {
          board.is_auto_fit = true;

          board.is_fit_page = board.auto_fit_page;
          board.fit_mode = board.auto_fit_mode;
          board.ratio_pos = board.auto_ratio_pos;
          board.draw_slide();
        } else {
          board.is_auto_fit = false;
          board.save_per_slide_fit_info();
        }
        board.updateAutoFit();
      }

      function fitPage(value) {
        board.fit_mode = value;
        //hmtg.util.localStorage['hmtg_fit_mode'] = JSON.stringify(appSetting.fit_mode);
        if(!board.is_fit_page) {
          board.fit_page();
        } else {
          board.save_per_slide_fit_info();
          board.draw_slide();
        }
        if(board.is_auto_fit) {
          board.auto_fit_page = true;
          board.auto_fit_mode = value;
          //board.is_auto_fit = false;
          //board.updateAutoFit();
        }
      }
      function fitPage1() { fitPage(1) }

      function fitWidth() {
        board.fit_mode = 0;
        //hmtg.util.localStorage['hmtg_fit_mode'] = JSON.stringify(appSetting.fit_mode);
        if(!board.is_fit_page) {
          board.fit_page();
        } else {
          board.save_per_slide_fit_info();
          board.draw_slide();
        }
        if(board.is_auto_fit) {
          board.auto_fit_page = true;
          board.auto_fit_mode = 0;
          //board.is_auto_fit = false;
          //board.updateAutoFit();
        }
      }

      function fit(value) {
        board.ratio_pos = value;
        if(board.is_fit_page) {
          board.fit_page();
        } else {
          board.save_per_slide_fit_info();
          board.change_ratio();
        }
        if(board.is_auto_fit) {
          board.auto_fit_page = false;
          board.auto_ratio_pos = board.ratio_pos;
          //board.is_auto_fit = false;
          //board.updateAutoFit();
        }
      }
      function fit25() { fit(25) }
      function fit50() { fit(50) }
      function fit75() { fit(75) }
      function fit100() { fit(100) }
      function fit150() { fit(150) }
      function fit200() { fit(200) }
      function fit400() { fit(400) }
      function fit800() { fit(800) }
    }

  }
])

.directive('unicodePanel', ['board', '$compile', '$translate', 'appSetting',
  function(board, $compile, $translate, appSetting) {
    function link($scope, element, attrs) {
      var a = hmtg.customization.unicode_text_list;
      if(a) {
        var base = angular.element('<div class="em-main" ng-show="w.showTextSample"></div>');
        element.append($compile(base)($scope));

        var i;
        for(i = 0; i < a.length; i++) {
          var s = a[i];
          var node = angular.element('<text class="emoji" ng-click="w.addUnicodeText(' + i + ')">' + s + '</text>');
          base.append($compile(node)($scope));
        }
        if(appSetting.show_advanced_function) {
          var node = angular.element('<text>' + $translate.instant('ID_NEW_WORD_PROMPT') + '</text>');
          base.append($compile(node)($scope));
        }  
      }
    }

    return {
      link: link
    };
  }
])

.controller('DeleteSlideModalCtrl', ['$scope', '$modalInstance', '$modal', '$translate', 'hmtgHelper', 'board', '$rootScope',
  function($scope, $modalInstance, $modal, $translate, hmtgHelper, board, $rootScope) {
    $scope.w = {};
    $scope.w.delete_group = false;
    $scope.w.prompt = $translate.instant('ID_DELETE_SLIDE_PROMPT');

    $scope.$watch('w.delete_group', function() {
      $scope.w.prompt = $translate.instant($scope.w.delete_group ? 'ID_DELETE_GROUP_PROMPT' : 'ID_DELETE_SLIDE_PROMPT');
    });

    $scope.ok = function() {
      $modalInstance.close({ delete_group: $scope.w.delete_group });
    };

    $scope.cancel = function() {
      $modalInstance.dismiss('cancel');
    };
  }
])

;
