@echo off
cd /d "%~dp0"
py -3 serve.py
if errorlevel 1 (
  echo Server stopped. Check that Python 3 is installed and port 8000 is available.
  pause
)
