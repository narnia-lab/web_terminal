@echo off
:: This script is called by the application to perform an update.

echo Updating Narnia Web Terminal...

:: Arguments:
:: %1 = path to the old (running) executable
:: %2 = path to the new (downloaded) executable

set OLD_EXE=%1
set NEW_EXE=%2

:: Wait for 2 seconds to allow the main application to exit completely
timeout /t 2 /nobreak > NUL

:: Delete the old executable
del /f "%OLD_EXE%"

:: Rename the new executable to the original name
rename "%NEW_EXE%" "%~nx1"

echo Update complete! Starting the new version...

:: Start the newly updated application
start "" "%OLD_EXE%"

:: Clean up the updater script itself
del "%~f0"
