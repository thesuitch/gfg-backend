@echo off
echo 🔧 Fixing PostgreSQL Permissions for gfg_user
echo ===========================================

echo.
echo This script will fix the permissions for gfg_user to allow migrations to run.
echo.

REM Check if .env exists
if not exist .env (
    echo ❌ .env file not found. Please run npm run setup first.
    pause
    exit /b 1
)

REM Read values from .env file
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="DB_HOST" set DB_HOST=%%b
    if "%%a"=="DB_PORT" set DB_PORT=%%b
    if "%%a"=="DB_NAME" set DB_NAME=%%b
    if "%%a"=="DB_USER" set DB_USER=%%b
    if "%%a"=="DB_PASSWORD" set DB_PASSWORD=%%b
)

echo 📊 Database Details:
echo    Host: %DB_HOST%
echo    Port: %DB_PORT%
echo    Database: %DB_NAME%
echo    User: %DB_USER%
echo.

REM Get admin credentials
set /p ADMIN_USER="Enter PostgreSQL admin username (default: postgres): "
if "%ADMIN_USER%"=="" set ADMIN_USER=postgres

set /p ADMIN_PASSWORD="Enter PostgreSQL admin password: "

echo.
echo 🔧 Fixing permissions...

REM Connect as admin and fix permissions
echo Granting schema permissions...
psql -h %DB_HOST% -p %DB_PORT% -U %ADMIN_USER% -d %DB_NAME% -c "GRANT ALL ON SCHEMA public TO %DB_USER%;" 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Schema permission grant failed
) else (
    echo ✅ Schema permissions granted
)

echo Granting table creation permissions...
psql -h %DB_HOST% -p %DB_PORT% -U %ADMIN_USER% -d %DB_NAME% -c "GRANT CREATE ON DATABASE %DB_NAME% TO %DB_USER%;" 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Table creation permission grant failed
) else (
    echo ✅ Table creation permissions granted
)

echo Granting all privileges on future tables...
psql -h %DB_HOST% -p %DB_PORT% -U %ADMIN_USER% -d %DB_NAME% -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO %DB_USER%;" 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Default privileges grant failed
) else (
    echo ✅ Default privileges granted
)

echo Granting all privileges on future sequences...
psql -h %DB_HOST% -p %DB_PORT% -U %ADMIN_USER% -d %DB_NAME% -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO %DB_USER%;" 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Sequence privileges grant failed
) else (
    echo ✅ Sequence privileges granted
)

echo.
echo 🎉 Permissions fixed! Now try running migrations again:
echo    npm run migrate
echo.
pause
