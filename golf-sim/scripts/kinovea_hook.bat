@echo off
REM Kinovea post-recording command -> golf sim backend.
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
REM This runs AFTER Kinovea has recorded and saved. What starts the recording
REM is Kinovea's own capture trigger (audio level), configured separately on
REM the capture screen. Set its delay buffer so the clip starts before the
REM takeaway -- a trigger firing on impact with no buffer records only the
REM follow-through.
REM
REM IMPACT_MS is where the strike lands inside the clip, which follows from
REM that buffer: buffer 3 seconds before the trigger and impact sits ~3000ms
REM in. The player aligns both cameras on this rather than on file start.
REM
REM REQUIRED FOR 3D. Two capture screens start recording independently, so
REM impact is the only clock the two clips share. Without it on BOTH cameras
REM the backend will not triangulate -- shoulder turn, pelvis rotation and
REM X-factor stay blank however well the rig is calibrated, because guessing
REM the offset produces a clean-looking answer that is tens of degrees wrong.
REM Leave it blank and 2D still works exactly as before; the calibration
REM slider in the UI covers the gap for playback alignment.
REM
REM Every run appends to data\kinovea_hook.log -- Kinovea closes the console
REM instantly, so that file is the only way to see what happened.

setlocal

set BACKEND=http://127.0.0.1:8000
set SOURCE=body_swing
set CAPTURE_FPS=30
set CONTAINER_FPS=30
set CAMERA=face_on
set IMPACT_MS=

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

set IMPACT_ARG=
if not "%IMPACT_MS%"=="" set IMPACT_ARG=-F "impact_ms=%IMPACT_MS%"

curl.exe -sS -X POST "%BACKEND%/api/ingest/body_swing" ^
  -F "path=%~f1" ^
  -F "source=%SOURCE%" ^
  -F "capture_fps=%CAPTURE_FPS%" ^
  -F "container_fps=%CONTAINER_FPS%" ^
  -F "camera=%CAMERA%" %IMPACT_ARG% >> "%LOG%" 2>&1

if errorlevel 1 (
  echo   FAILED: POST error -- is the backend running? >> "%LOG%"
  exit /b 1
)

echo. >> "%LOG%"
endlocal
