@echo off
chcp 65001 > nul
title Pilote Olfacode - Assistant CEO
cd /d "%~dp0"
echo.
echo  Lancement du Pilote Olfacode...
echo.
node launch.js
pause
