@echo off
REM Bid360 Local Testing Quick Start Script
REM This script sets up and starts the development environment

echo.
echo ========================================
echo   Bid360 Local Testing Setup
echo ========================================
echo.

REM Check if we're in the right directory
if not exist package.json (
    echo Error: package.json not found!
echo Please run this script from the Bid360 project root directory.
    pause
    exit /b 1
)

echo Step 1: Installing dependencies...
call npm install
if errorlevel 1 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Running database migrations...
call npm run db:migrate:deploy
if errorlevel 1 (
    echo Warning: Migration may have failed. Continuing anyway...
    echo.
)

echo.
echo Step 3: Seeding test data...
call npm run db:seed:test
if errorlevel 1 (
    echo Warning: Test data seeding may have failed. Continuing anyway...
    echo.
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Starting development server...
echo.
echo Access the app at: http://localhost:3000
echo.
echo Test Credentials:
echo   Admin:    admin@bidflow.test / admin123
echo   Manager:  manager@bidflow.test / manager123
echo   Staff:    staff@bidflow.test / staff123
echo.
echo Open TESTING_CHECKLIST.md for the smoke test guide.
echo.
call npm run dev
pause
