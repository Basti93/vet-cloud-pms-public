#!/bin/sh
set -e

echo "Running database migrations..."
node /app/migrate.mjs

echo "Starting server..."
exec node /app/apps/web/server.js
