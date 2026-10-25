#!/bin/sh
set -e

echo "Synchronisation du schema public..."
n=0
until npx prisma db push --schema=./prisma/schema/public.prisma --skip-generate; do
  n=$((n + 1))
  if [ "$n" -ge 30 ]; then
    echo "PostgreSQL injoignable apres 30 tentatives."
    exit 1
  fi
  echo "En attente de PostgreSQL... ($n)"
  sleep 2
done

exec node server.js
