@echo off
REM GFG Stable Backend - cPanel Deployment Script (Windows)
REM Run this script in your cPanel terminal or via SSH

echo 🚀 Starting GFG Stable Backend Deployment...

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed or not in PATH
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed or not in PATH
    exit /b 1
)

REM Install production dependencies
echo 📦 Installing production dependencies...
npm install --production

REM Build the application
echo 🔨 Building TypeScript application...
npm run build

REM Check if build was successful
if not exist "dist" (
    echo ❌ Build failed - dist directory not found
    exit /b 1
)

REM Run database migrations
echo 🗄️ Running database migrations...
npm run migrate

REM Check if migrations were successful
if %errorlevel% neq 0 (
    echo ⚠️ Database migration failed - please check your database connection
    echo You may need to run migrations manually: npm run migrate
)

REM Create uploads directory if it doesn't exist
if not exist "uploads\tax-documents" (
    mkdir uploads\tax-documents
)

echo ✅ Deployment completed successfully!
echo 🌐 Your API should be available at your configured domain
echo 🔍 Test the health endpoint: curl https://yourdomain.com/api/health

echo.
echo 📋 Next Steps:
echo 1. Update your .env file with production database credentials
echo 2. Start your Node.js application in cPanel
echo 3. Test all API endpoints
echo 4. Update your frontend to use the production API URL

pause
