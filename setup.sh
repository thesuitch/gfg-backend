#!/bin/bash

echo "🚀 GFG Stable Backend Setup"
echo "=========================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔧 Creating .env file..."
    cp env.example .env
    echo "✅ .env file created. Please review and update if needed."
else
    echo "✅ .env file already exists"
fi

# Start PostgreSQL
echo "🐘 Starting PostgreSQL..."
npm run db:up

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Run migrations
echo "🗄️  Running database migrations..."
npm run migrate

# Seed database
echo "🌱 Seeding database..."
npm run seed

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Review .env file and update if needed"
echo "2. Start the development server: npm run dev"
echo "3. API will be available at http://localhost:3001"
echo "4. Admin credentials: admin@gfgstable.com / admin123"
echo ""
echo "🔧 Useful commands:"
echo "- npm run dev          # Start development server"
echo "- npm run db:up        # Start database"
echo "- npm run db:down      # Stop database"
echo "- npm run migrate      # Run migrations"
echo "- npm run seed         # Seed database"
echo ""
