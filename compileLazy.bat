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

pause
