# PowerShell script to create .env files for ChatZone project
# Run this script from the project root directory

Write-Host "Setting up environment files for ChatZone..." -ForegroundColor Green

# Create backend .env file
Write-Host "`nCreating backend/.env..." -ForegroundColor Yellow
$backendEnv = @"
NODE_ENV=development
PORT=5001
BACKEND_API_URL=http://localhost:5001
FRONTEND_URL=http://localhost:3002
ADMIN_URL=http://localhost:3003

AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_KEY=your-storage-key
AZURE_STORAGE_CONNECTION_STRING=your-connection-string

MONGODB_CONNECTION_STRING=your-mongodb-uri

JWT_SECRET=your-local-jwt-secret
SESSION_SECRET=your-session-secret

SERPER_API_KEY=your-serper-api-key

EMBEDDING_API_URL=https://api.jina.ai/v1
EMBEDDING_API_KEY=your-jina-ai-api-key

ENABLE_TEST_USERS=true
OPENROUTER_REFERRER=https://localhost:3002
OPENROUTER_APP_TITLE=ChatZone Admin
"@

$backendEnv | Out-File -FilePath "backend\.env" -Encoding utf8 -NoNewline
Write-Host "✅ Created backend/.env" -ForegroundColor Green

# Create frontend .env.local file
Write-Host "`nCreating frontend/.env.local..." -ForegroundColor Yellow
$frontendEnv = @"
NEXT_PUBLIC_API_URL=http://localhost:5001
"@

$frontendEnv | Out-File -FilePath "frontend\.env.local" -Encoding utf8 -NoNewline
Write-Host "✅ Created frontend/.env.local" -ForegroundColor Green

# Create admin .env.local file
Write-Host "`nCreating admin/.env.local..." -ForegroundColor Yellow
$adminEnv = @"
NEXT_PUBLIC_API_URL=http://localhost:5001
"@

$adminEnv | Out-File -FilePath "admin\.env.local" -Encoding utf8 -NoNewline
Write-Host "✅ Created admin/.env.local" -ForegroundColor Green

Write-Host "`n✨ All environment files created successfully!" -ForegroundColor Green
Write-Host "`n⚠️  Remember to update the placeholder values in backend/.env with your actual credentials." -ForegroundColor Yellow
Write-Host "`nYou can now run:" -ForegroundColor Cyan
Write-Host "  Terminal 1: cd backend && npm run dev" -ForegroundColor White
Write-Host "  Terminal 2: cd frontend && npm run dev" -ForegroundColor White
Write-Host "  Terminal 3: cd admin && npm run dev" -ForegroundColor White

