@ set TARGET_DIR=%~dp0target\enso-build
@ set TARGET_EXE=%TARGET_DIR%\buildscript\enso-build3.exe
@REM if not exist "%TARGET_EXE%" (
@REM     cargo build --profile buildscript --target-dir "%TARGET_DIR%" --package enso-build3 || exit /b %errorlevel%
@REM )
@REM "%TARGET_EXE%" %*
cargo build --profile buildscript --target-dir "%TARGET_DIR%" --package enso-build3 && "%TARGET_EXE%" %*
