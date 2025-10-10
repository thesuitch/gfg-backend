#!/bin/bash

# GFG Stable Backend - cPanel Deployment Script
# Run this script in your cPanel terminal or via SSH

echo "🚀 Starting GFG Stable Backend Deployment..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed or not in PATH"
    exit 1
fi

# Install production dependencies
echo "📦 Installing production dependencies..."
npm install --production

# Build the application
echo "🔨 Building TypeScript application..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

# Run database migrations
echo "🗄️ Running database migrations..."
npm run migrate

# Check if migrations were successful
if [ $? -ne 0 ]; then
    echo "⚠️ Database migration failed - please check your database connection"
    echo "You may need to run migrations manually: npm run migrate"
fi

# Set proper permissions
echo "🔐 Setting file permissions..."
chmod 755 dist/
chmod 644 dist/*.js
chmod 644 dist/**/*.js

# Create uploads directory if it doesn't exist
mkdir -p uploads/tax-documents
chmod 755 uploads/
chmod 755 uploads/tax-documents/

echo "✅ Deployment completed successfully!"
echo "🌐 Your API should be available at your configured domain"
echo "🔍 Test the health endpoint: curl https://yourdomain.com/api/health"

# Show next steps
echo ""
echo "📋 Next Steps:"
echo "1. Update your .env file with production database credentials"
echo "2. Start your Node.js application in cPanel"
echo "3. Test all API endpoints"
echo "4. Update your frontend to use the production API URL"
