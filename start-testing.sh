#!/bin/bash

# Bid360 Local Testing Quick Start Script
# For macOS and Linux systems

set -e  # Exit on error

echo ""
echo "========================================"
echo "  Bid360 Local Testing Setup"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f package.json ]; then
    echo "Error: package.json not found!"
  echo "Please run this script from the Bid360 project root directory."
    exit 1
fi

echo "Step 1: Installing dependencies..."
npm install

echo ""
echo "Step 2: Running database migrations..."
npm run db:migrate:deploy || echo "⚠️  Migration may have failed. Continuing anyway..."

echo ""
echo "Step 3: Seeding test data..."
npm run db:seed:test || echo "⚠️  Test data seeding may have failed. Continuing anyway..."

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Starting development server..."
echo ""
echo "Access the app at: http://localhost:3000"
echo ""
echo "Test Credentials:"
echo "  Admin:    admin@bidflow.test / admin123"
echo "  Manager:  manager@bidflow.test / manager123"
echo "  Staff:    staff@bidflow.test / staff123"
echo ""
echo "Open TESTING_CHECKLIST.md for the smoke test guide."
echo ""

npm run dev
