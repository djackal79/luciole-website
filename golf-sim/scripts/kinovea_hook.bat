@echo off
REM Kinovea Automation hook -> golf sim backend.
REM
REM Options -> Preferences -> Capture -> Automation, "command after capture".
REM Point it at this file and pass the recorded filename as the argument. The
REM macro name for the filename varies by Kinovea version -- check the hint text
REM next to the field in your build.
REM
REM Kinovea runs on this PC, so the hook hands over a PATH rather than uploading
REM the file. The backend copies it into the shot folder and leaves your
REM original where Kinovea put it.

setlocal

set BACKEND=http://127.0.0.1:8000
set CAPTURE_FPS=30
set CONTAINER_FPS=30
set CAMERA=face_on

if "%~1"=="" (
  echo [kinovea_hook] no filename argument supplied
  exit /b 1
)

curl.exe -sS -X POST "%BACKEND%/api/ingest/body_swing" ^
  -F "path=%~f1" ^
  -F "capture_fps=%CAPTURE_FPS%" ^
  -F "container_fps=%CONTAINER_FPS%" ^
  -F "camera=%CAMERA%"

if errorlevel 1 (
  echo [kinovea_hook] POST failed -- is the backend running?
  exit /b 1
)

endlocal
