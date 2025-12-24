# Port Configuration Setup

The project has been configured to run on ports **5001**, **3002**, and **3003** to avoid conflicts with busy ports.

## Port Assignment
- **Backend**: Port 5001
- **Frontend**: Port 3002  
- **Admin**: Port 3003

## Setup Steps

### 1. Create Backend .env File

Create `backend/.env` file with the following content:

```env
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
```

### 2. Create Frontend .env.local File

Create `frontend/.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

### 3. Create Admin .env.local File

Create `admin/.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

## Running the Application

Open **3 separate terminal windows** and run:

### Terminal 1 - Backend
```bash
cd backend
npm install  # if not already installed
npm run dev
```
Backend will run on: **http://localhost:5001**

### Terminal 2 - Frontend
```bash
cd frontend
npm install  # if not already installed
npm run dev
```
Frontend will run on: **http://localhost:3002**

### Terminal 3 - Admin
```bash
cd admin
npm install  # if not already installed
npm run dev
```
Admin will run on: **http://localhost:3003**

## What Was Changed

1. ✅ Updated `backend/src/app.ts` - CORS now allows ports 3002 and 3003
2. ✅ Updated `frontend/package.json` - dev script uses port 3002
3. ✅ Updated `admin/package.json` - dev script uses port 3003
4. ⚠️ You need to create the `.env` files manually (see steps above)

## Verify It's Working

1. Backend health check: http://localhost:5001/health
2. Frontend: http://localhost:3002
3. Admin: http://localhost:3003

