@echo off
echo 🚀 GFG Stable Backend Setup
echo ==========================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Create .env file if it doesn't exist
if not exist .env (
    echo 🔧 Creating .env file...
    copy env.example .env
    echo ✅ .env file created. Please review and update if needed.
) else (
    echo ✅ .env file already exists
)

REM Start PostgreSQL
echo 🐘 Starting PostgreSQL...
npm run db:up

REM Wait for PostgreSQL to be ready
echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak >nul

REM Run migrations
echo 🗄️  Running database migrations...
npm run migrate

REM Seed database
echo 🌱 Seeding database...
npm run seed

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo 1. Review .env file and update if needed
echo 2. Start the development server: npm run dev
echo 3. API will be available at http://localhost:3001
echo 4. Admin credentials: admin@gfgstable.com / admin123
echo.
echo 🔧 Useful commands:
echo - npm run dev          # Start development server
echo - npm run db:up        # Start database
echo - npm run db:down      # Stop database
echo - npm run migrate      # Run migrations
echo - npm run seed         # Seed database
echo.
pause
