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

pause
