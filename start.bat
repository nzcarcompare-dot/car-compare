@echo off
echo.
echo  NZ Car Comparator - Test Mode
echo  ==============================
echo.
set /p CARJAM_TEST_KEY="Paste your Carjam test API key and press Enter: "
echo.
echo  Starting server... Open http://localhost:3001 in your browser.
echo  Press Ctrl+C to stop.
echo.
node server.js
pause
