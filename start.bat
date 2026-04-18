@echo off
echo.
echo  WheelDeal NZ - Car Cost Comparator
echo  =====================================
echo.
set /p CARJAM_TEST_KEY="Paste your Carjam API key (or press Enter to skip): "
echo.
echo  Starting server...
echo  Open http://localhost:3001 in your browser
echo  Press Ctrl+C to stop.
echo.
node server.js
pause
