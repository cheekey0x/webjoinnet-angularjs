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

pause
