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

pause
