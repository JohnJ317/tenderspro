#!/bin/sh
set -eu

if [ "${PRISMA_RESET_ON_START:-false}" = "true" ]; then
  echo "⚠  PRISMA_RESET_ON_START=true → reset complet de la DB"
  npx prisma migrate reset --force --skip-generate --skip-seed
else
  npx prisma migrate deploy
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "🌱 SEED_ON_START=true → lancement du seed..."
  npx ts-node prisma/seed.ts
fi

exec node dist/main