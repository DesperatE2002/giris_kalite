#!/bin/bash
echo "🔧 Running migration on Vercel..."
vercel env pull .env.local
node db/migrate-project-type.js
echo "✅ Migration completed!"
