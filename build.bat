@rem ============ main modules  =================
@rem dep0.min.js: all the minified libraries together
copy /y/b ^
dep\angular.min.js + ^
dep\empty-line.js + ^
dep\lazy-helper.js + ^
dep\ocLazyLoad.min.js + ^
dep\empty-line.js + ^
dep\angular-translate.min.js + ^
dep\empty-line.js + ^
dep\angular-translate-loader-static-files.min.js + ^
dep\empty-line.js + ^
dep\ui-bootstrap-tpls-0.12.0.min.js + ^
dep\empty-line.js + ^
dep\adapter.min.js + ^
dep\mediasoup-client.min.js + ^
dep\protoo-client.min.js + ^
dep\empty-line.js + ^
dep\hmtg.min.js ^
dep.min.js

@rem hmtgs.js: source codes
copy /y/b ^
joinnet\joinnet.js + ^
joinnet\userlist.js + ^
joinnet\chat.js + ^
joinnet\board.js + ^
joinnet\browser.js + ^
joinnet\dt.js + ^
joinnet\playback.js + ^
joinnet\jhelper.js + ^
joinnet\audio_playback.js + ^
joinnet\audio_capture.js + ^
joinnet\media_control.js + ^
joinnet\audio_codec.js + ^
joinnet\advanced.js + ^
joinnet\video_playback.js + ^
joinnet\video_capture.js + ^
joinnet\video_codec.js + ^
joinnet\reconnect_name.js + ^
joinnet\mypicture.js + ^
joinnet\mediasoup_webrtc.js + ^
msgr\msgr.js + ^
msgr\jnagentDlg.js + ^
msgr\imDlg.js + ^
msgr\checkIM.js + ^
msgr\checkMessage.js + ^
msgr\icon.js + ^
msgr\mhelper.js + ^
msgr\missedCall.js + ^
app\version.js + ^
app\app.js + ^
app\ahelper.js + ^
app\alert.js + ^
app\sound.js + ^
app\translation-en.js ^
hmtgs.js

java -jar compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file sw.min.js ^
--js sw.js

@rem hmtgs.min.js: pretty print(use --formatting PRETTY_PRINT to toggle) minified source codes
@rem --formatting PRETTY_PRINT ^
java -jar compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file hmtgs.min.js --create_source_map hmtgs.min.js.map ^
--js hmtgs.js

@rem  =========== compile lazy modules ============
md lazy_js_min
cd lazy_js_min

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file option_msgr.min.js --create_source_map option_msgr.min.js.map ^
--js ../lazy_js/option_msgr.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file option_webapp.min.js --create_source_map option_webapp.min.js.map ^
--js ../lazy_js/option_webapp.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file option_joinnet.min.js --create_source_map option_joinnet.min.js.map ^
--js ../lazy_js/option_joinnet.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file option_url.min.js --create_source_map option_url.min.js.map ^
--js ../lazy_js/option_url.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file option_webrtc.min.js --create_source_map option_webrtc.min.js.map ^
--js ../lazy_js/option_webrtc.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file option_mypicture.min.js --create_source_map option_mypicture.min.js.map ^
--js ../lazy_js/option_mypicture.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file navitem_reconnect_name.min.js --create_source_map navitem_reconnect_name.min.js.map ^
--js ../lazy_js/navitem_reconnect_name.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file navitem_missed_call.min.js --create_source_map navitem_missed_call.min.js.map ^
--js ../lazy_js/navitem_missed_call.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file navitem_log.min.js --create_source_map navitem_log.min.js.map ^
--js ../lazy_js/navitem_log.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file navitem_jnj.min.js --create_source_map navitem_jnj.min.js.map ^
--js ../lazy_js/navitem_jnj.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file navitem_prompt.min.js --create_source_map navitem_prompt.min.js.map ^
--js ../lazy_js/navitem_prompt.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file joinnet_stat.min.js --create_source_map joinnet_stat.min.js.map ^
--js ../lazy_js/joinnet_stat.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file joinnet_playback.min.js --create_source_map joinnet_playback.min.js.map ^
--js ../lazy_js/joinnet_playback.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file joinnet_jnr.min.js --create_source_map joinnet_jnr.min.js.map ^
--js ../lazy_js/joinnet_jnr.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file joinnet_chat.min.js --create_source_map joinnet_chat.min.js.map ^
--js ../lazy_js/joinnet_chat.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file joinnet_video.min.js --create_source_map joinnet_video.min.js.map ^
--js ../lazy_js/joinnet_video.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file joinnet_browser.min.js --create_source_map joinnet_browser.min.js.map ^
--js ../lazy_js/joinnet_browser.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file joinnet_dt.min.js --create_source_map joinnet_dt.min.js.map ^
--js ../lazy_js/joinnet_dt.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file joinnet_transcoding.min.js --create_source_map joinnet_transcoding.min.js.map ^
--js ../lazy_js/joinnet_transcoding.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_upload_slide.min.js --create_source_map modal_upload_slide.min.js.map ^
--js ../lazy_js/modal_upload_slide.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_change_jnr_password.min.js --create_source_map modal_change_jnr_password.min.js.map ^
--js ../lazy_js/modal_change_jnr_password.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_download_complete.min.js --create_source_map modal_download_complete.min.js.map ^
--js ../lazy_js/modal_download_complete.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_edit_profile.min.js --create_source_map modal_edit_profile.min.js.map ^
--js ../lazy_js/modal_edit_profile.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_jeditor.min.js --create_source_map modal_jeditor.min.js.map ^
--js ../lazy_js/modal_jeditor.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_rename.min.js --create_source_map modal_rename.min.js.map ^
--js ../lazy_js/modal_rename.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_pick_user.min.js --create_source_map modal_pick_user.min.js.map ^
--js ../lazy_js/modal_pick_user.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_view_record.min.js --create_source_map modal_view_record.min.js.map ^
--js ../lazy_js/modal_view_record.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_move_office.min.js --create_source_map modal_move_office.min.js.map ^
--js ../lazy_js/modal_move_office.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_share_jnr.min.js --create_source_map modal_share_jnr.min.js.map ^
--js ../lazy_js/modal_share_jnr.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_style.min.js --create_source_map modal_style.min.js.map ^
--js ../lazy_js/modal_style.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_import_media.min.js --create_source_map modal_import_media.min.js.map ^
--js ../lazy_js/modal_import_media.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_msgr_signin.min.js --create_source_map modal_msgr_signin.min.js.map ^
--js ../lazy_js/modal_msgr_signin.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_snapshot.min.js --create_source_map modal_snapshot.min.js.map ^
--js ../lazy_js/modal_snapshot.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_short_message.min.js --create_source_map modal_short_message.min.js.map ^
--js ../lazy_js/modal_short_message.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file modal_image_mark.min.js --create_source_map modal_image_mark.min.js.map ^
--js ../lazy_js/modal_image_mark.js

cd ..

@rem  ============== worker modules  ====================
cd worker

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/dt_encode.js ^
--js dt_encode.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/dt_decode.js ^
--js dt_decode.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/g711_encode.js ^
--js g711_encode.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/g711_decode.js ^
--js g711_decode.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/gzip_helper.js ^
--js gzip_helper.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/opus_encode.js ^
--js opus_encode.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/opus_decode.js ^
--js opus_decode.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/h264_decode.js ^
--js h264_decode.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/vp8_decode.js ^
--js vp8_decode.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/test_worker.js ^
--js test_worker.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/avc.js ^
--js avc.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/opus.js ^
--js opus.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/worker_timeout.js ^
--js worker_timeout.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT5 ^
--js_output_file min/worker_interval.js ^
--js worker_interval.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT6 ^
--js_output_file min/worklet-playback.js ^
--js worklet-playback.js

java -jar ../compiler/compiler.jar --compilation_level SIMPLE_OPTIMIZATIONS --language_in=ECMASCRIPT6 ^
--js_output_file min/worklet-record.js ^
--js worklet-record.js

cd ..

@rem ============ create the dist folder ============
@echo prepare dist folder
md dist

copy /y cache_detection.js dist >nul 2>nul
copy /y dep.min.js dist >nul 2>nul
copy /y hmtgs.min.js dist >nul 2>nul
copy /y index.htm dist >nul 2>nul
copy /y manifest.json dist >nul 2>nul
copy /y sw.min.js dist\sw.js >nul 2>nul

md dist\css >nul 2>nul
copy /y css\style.css dist\css >nul 2>nul
copy /y css\bootstrap.css dist\css >nul 2>nul
copy /y css\bootstrap-theme.css dist\css >nul 2>nul

md dist\customization >nul 2>nul
xcopy /e/y customization\*.* dist\customization >nul 2>nul

md dist\docs >nul 2>nul
xcopy /e/y docs\*.* dist\docs >nul 2>nul

md dist\fonts >nul 2>nul
xcopy /e/y fonts\*.* dist\fonts >nul 2>nul

md dist\img >nul 2>nul
xcopy /e/y img\*.* dist\img >nul 2>nul

md dist\lang >nul 2>nul
xcopy /e/y lang\*.* dist\lang >nul 2>nul

md dist\lazy_htm >nul 2>nul
xcopy /e/y lazy_htm\*.* dist\lazy_htm >nul 2>nul
del dist\lazy_htm\_*.* >nul 2>nul

md dist\lazy_js_min >nul 2>nul
xcopy /e/y lazy_js_min\*.min.js dist\lazy_js_min >nul 2>nul

md dist\media >nul 2>nul
xcopy /e/y media\*.* dist\media >nul 2>nul

md dist\template >nul 2>nul
xcopy /e/y template\*.* dist\template >nul 2>nul

md dist\worker >nul 2>nul
xcopy /y worker\*.* dist\worker >nul 2>nul
xcopy /y worker\min\*.* dist\worker >nul 2>nul

@echo Done!

pause
