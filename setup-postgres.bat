@echo off
echo 🐘 GFG Stable PostgreSQL Setup
echo =============================

echo.
echo This script will help you set up PostgreSQL manually.
echo.

REM Check if psql is available
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL is not installed or not in PATH.
    echo.
    echo Please install PostgreSQL 15+ from: https://www.postgresql.org/download/windows/
    echo Make sure to add PostgreSQL to your PATH during installation.
    echo.
    pause
    exit /b 1
)

echo ✅ PostgreSQL found!
echo.

REM Get database connection details
set /p DB_HOST="Enter PostgreSQL host (default: localhost): "
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT="Enter PostgreSQL port (default: 5433): "
if "%DB_PORT%"=="" set DB_PORT=5433

set /p DB_USER="Enter PostgreSQL username (default: postgres): "
if "%DB_USER%"=="" set DB_USER=postgres

set /p DB_PASSWORD="Enter PostgreSQL password: "

echo.
echo 🔍 Testing connection to PostgreSQL...
echo Testing connection as %DB_USER% to %DB_HOST%:%DB_PORT%...

REM Test connection first
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Connection failed! Please check:
    echo    - PostgreSQL is running
    echo    - Username and password are correct
    echo    - Port number is correct
    echo    - PostgreSQL service is started
    echo.
    pause
    exit /b 1
)

echo ✅ Connection successful!
echo.
echo 🔧 Setting up database...

REM Create database and user
echo Creating database 'gfg_stable'...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE gfg_stable;" 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Database creation failed. Checking if it already exists...
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -lqt | findstr gfg_stable >nul
    if %errorlevel% equ 0 (
        echo ✅ Database 'gfg_stable' already exists
    ) else (
        echo ❌ Database creation failed. Please check PostgreSQL logs.
        pause
        exit /b 1
    )
) else (
    echo ✅ Database 'gfg_stable' created successfully
)

echo Creating user 'gfg_user'...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE USER gfg_user WITH PASSWORD '%DB_PASSWORD%';" 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  User creation failed. Checking if it already exists...
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "\du" | findstr gfg_user >nul
    if %errorlevel% equ 0 (
        echo ✅ User 'gfg_user' already exists
    ) else (
        echo ❌ User creation failed. Please check PostgreSQL logs.
        pause
        exit /b 1
    )
) else (
    echo ✅ User 'gfg_user' created successfully
)

echo Granting privileges...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "GRANT ALL PRIVILEGES ON DATABASE gfg_stable TO gfg_user;" 2>nul
if %errorlevel% neq 0 (
    echo ❌ Failed to grant privileges. Please check PostgreSQL logs.
    pause
    exit /b 1
) else (
    echo ✅ Privileges granted successfully
)

echo.
echo 📝 Creating .env file...

REM Create .env file
(
echo # Database Configuration
echo DB_HOST=%DB_HOST%
echo DB_PORT=%DB_PORT%
echo DB_NAME=gfg_stable
echo DB_USER=gfg_user
echo DB_PASSWORD=%DB_PASSWORD%
echo.
echo # JWT Configuration
echo JWT_SECRET=your-super-secret-jwt-key-change-in-production
echo JWT_EXPIRES_IN=24h
echo.
echo # Server Configuration
echo PORT=3001
echo NODE_ENV=development
echo.
echo # Rate Limiting
echo RATE_LIMIT_WINDOW_MS=900000
echo RATE_LIMIT_MAX_REQUESTS=100
) > .env

echo ✅ .env file created successfully!
echo.
echo 🎉 PostgreSQL setup completed!
echo.
echo 📋 Next steps:
echo 1. Install dependencies: npm install
echo 2. Run migrations: npm run migrate
echo 3. Seed database: npm run seed
echo 4. Start server: npm run dev
echo.
pause
