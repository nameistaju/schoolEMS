# Enterprise School Management SaaS - Local Development Launcher
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting Multi-Tenant School Management Platform (Phase 1)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start PostgreSQL in WSL if needed
Write-Host "`n[1/3] Ensuring PostgreSQL is running..." -ForegroundColor Yellow
try {
    wsl -u root service postgresql start
    Write-Host "PostgreSQL is active on 127.0.0.1:5432" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not start PostgreSQL via WSL. Please ensure PostgreSQL is running on port 5432." -ForegroundColor Red
}

# 2. Run Database Migrations on auth_db
Write-Host "`n[2/3] Checking and applying database migrations..." -ForegroundColor Yellow
Push-Location projects/telugu-pickles/services
try {
    npm run migrate
    Write-Host "Database migrations verified on auth_db." -ForegroundColor Green
} catch {
    Write-Host "Migration check encountered an error: $_" -ForegroundColor Red
}

# 3. Launch Gateway, Auth Service & Frontend Vite UI
Write-Host "`n[3/3] Launching Gateway (:8080), Auth Service (:4001), and Frontend UI (:5173)..." -ForegroundColor Yellow
Write-Host "`n----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Access URLs:" -ForegroundColor White
Write-Host "  * Frontend UI:    http://localhost:5173" -ForegroundColor Green
Write-Host "  * API Gateway:    http://localhost:8080/api/health" -ForegroundColor Green
Write-Host "  * Auth Service:   http://localhost:4001" -ForegroundColor Green
Write-Host "`nDemo Accounts (Seeded):" -ForegroundColor White
Write-Host "  * Apex SchoolAdmin:    admin@apex.example    / DemoPassword@2026" -ForegroundColor Cyan
Write-Host "  * Horizon SchoolAdmin: admin@horizon.example / DemoPassword@2026" -ForegroundColor Cyan
Write-Host "  * Apex Teacher:        teacher@apex.example  / DemoPassword@2026" -ForegroundColor Cyan
Write-Host "  * Apex Student:        student@apex.example  / DemoPassword@2026" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------`n" -ForegroundColor DarkGray

npm run dev
Pop-Location
