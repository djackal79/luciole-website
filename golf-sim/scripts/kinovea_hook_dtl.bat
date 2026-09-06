@echo off
REM Kinovea post-recording command -> golf sim backend.
REM DOWN-THE-LINE CAMERA.
REM
REM Right-click the capture screen's viewport background and choose
REM "Post-recording command...". The setting is PER CAPTURE SCREEN, so each
REM camera gets its own -- which is exactly what you want:
REM
REM   face-on screen        this file          (SOURCE=body_swing)
REM   down-the-line screen  kinovea_hook_dtl.bat (SOURCE=body_swing_dtl)
REM
REM If both screens ran the same file, the backend would read the second clip
REM as a SECOND SWING and silently double every shot. SOURCE keeps them apart.
REM
REM Pass the recorded file path as the argument. Check the dialog for the
REM variable Kinovea offers for it, and wrap it in quotes.
REM
REM Every run appends to data\kinovea_hook.log -- Kinovea closes the console
REM instantly, so that file is the only way to see what happened.

setlocal

set BACKEND=http://127.0.0.1:8000
set SOURCE=body_swing_dtl
set CAPTURE_FPS=60
set CONTAINER_FPS=60
set CAMERA=dtl

set LOG=%~dp0..\data\kinovea_hook.log
if not exist "%~dp0..\data" mkdir "%~dp0..\data"

echo. >> "%LOG%"
echo [%date% %time%] %SOURCE% arg=[%~1] >> "%LOG%"

if "%~1"=="" (
  echo   FAILED: no filename argument. Check the variable in the >> "%LOG%"
  echo   post-recording command dialog. >> "%LOG%"
  exit /b 1
)

if not exist "%~1" (
  echo   FAILED: file does not exist: %~f1 >> "%LOG%"
  exit /b 1
)

curl.exe -sS -X POST "%BACKEND%/api/ingest/body_swing" ^
  -F "path=%~f1" ^
  -F "source=%SOURCE%" ^
  -F "capture_fps=%CAPTURE_FPS%" ^
  -F "container_fps=%CONTAINER_FPS%" ^
  -F "camera=%CAMERA%" >> "%LOG%" 2>&1

if errorlevel 1 (
  echo   FAILED: POST error -- is the backend running? >> "%LOG%"
  exit /b 1
)

echo. >> "%LOG%"
endlocal
