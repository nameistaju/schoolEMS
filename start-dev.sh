#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " Starting Multi-Tenant School Management Platform (Phase 1)"
echo "=========================================================="

echo -e "\n[1/3] Ensuring PostgreSQL is running..."
sudo service postgresql start 2>/dev/null || sudo systemctl start postgresql@18-main 2>/dev/null || true

echo -e "\n[2/3] Checking and applying database migrations..."
cd services
npm run migrate

echo -e "\n[3/3] Launching Gateway (:8080), Auth Service (:4001), and Frontend UI (:5173)..."
echo "----------------------------------------------------------"
echo "Access URLs:"
echo "  * Frontend UI:    http://localhost:5173"
echo "  * API Gateway:    http://localhost:8080/api/health"
echo "  * Auth Service:   http://localhost:4001"
echo ""
echo "Demo Accounts (Seeded):"
echo "  * Platform SuperAdmin: superadmin@schoolsaas.internal / SuperAdmin@2026"
echo "  * Apex SchoolAdmin:    admin@apex.example             / DemoPassword@2026"
echo "  * Horizon SchoolAdmin: admin@horizon.example          / DemoPassword@2026"
echo "  * Apex Teacher:        teacher@apex.example           / DemoPassword@2026"
echo "  * Apex Student:        student@apex.example           / DemoPassword@2026"
echo "----------------------------------------------------------"

npm run dev
