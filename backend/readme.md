# ChatZone.ai Backend API

Production-ready backend API for ChatZone.ai platform.

## Deployment to Azure App Service

### Prerequisites

- Azure App Service instance created: `chatzone-api`
- GitHub repository: `chatzone-backend`
- All environment variables configured in Azure App Service

### Environment Variables (Azure App Service Configuration)

Go to Azure Portal → Your App Service → Configuration → Application settings and add:

```
MONGODB_CONNECTION_STRING=your_mongodb_connection_string_here
DATABASE_NAME=chatzone
AZURE_STORAGE_CONNECTION_STRING=your_azure_storage_connection_string_here
AZURE_STORAGE_ACCOUNT_NAME=your_storage_account_name
BACKEND_API_URL=your_backend_api_url
FRONTEND_URL=your_frontend_url
ADMIN_URL=your_admin_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
SERPER_API_KEY=your_serper_api_key
AZURE_COMMUNICATION_CONNECTION_STRING=your_azure_communication_connection_string
JWT_SECRET=your_jwt_secret_key_here
SESSION_SECRET=your_session_secret_key_here
ADMIN_PASSWORD=your_admin_password_here
NODE_ENV=production
```

### Deploy to Azure

1. **Connect GitHub to Azure:**

   - Azure Portal → Your App Service → Deployment Center
   - Source: GitHub
   - Authorize and select repository: `chatzone-backend`
   - Branch: `main`
   - Save

2. **Push to GitHub:**

   ```bash
   git init
   git add .
   git commit -m "Initial backend deployment"
   git remote add origin https://github.com/YOUR_USERNAME/chatzone-backend.git
   git push -u origin main
   ```

3. **Azure auto-deploys on push:**
   - Every push to `main` branch automatically deploys to Azure
   - Build runs: `npm install && npm run build && npm start`

### API Endpoints

#### Authentication

- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/twitter` - Initiate Twitter OAuth
- `GET /api/auth/twitter/callback` - Twitter OAuth callback
- `GET /api/auth/me` - Get current user (requires JWT)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/referral/:code` - Validate referral code

#### Health Check

- `GET /health` - Server health status

### Architecture

```
src/
├── config/
│   ├── database.ts      # Azure Cosmos DB connection
│   └── passport.ts      # OAuth strategies
├── models/
│   ├── User.ts          # User schema with tiers, referrals
│   ├── Conversation.ts  # Conversations with messages, branches
│   ├── Project.ts       # Claude-style workspaces
│   └── Model.ts         # Admin-configured AI models
├── routes/
│   └── auth.ts          # Authentication routes
├── middleware/
│   └── auth.ts          # JWT authentication
├── services/           # Business logic (chat, stripe, RAG, etc.)
├── utils/              # Helper functions
├── app.ts              # Express app configuration
└── server.ts           # Server entry point
```

### Features Implemented

✅ Google OAuth authentication
✅ Twitter OAuth authentication  
✅ JWT-based session management
✅ User model with subscription tiers
✅ Referral system support
✅ Conversation branching support
✅ Project workspaces (Claude-style)
✅ Admin-configurable AI models
✅ Production-ready error handling
✅ CORS configured for Azure URLs
✅ Azure Cosmos DB integration
✅ TypeScript with strict typing

### Next Steps

Continue development:

1. Chat API with streaming responses
2. Stripe subscription integration
3. Pro Replies with Serper.dev
4. RAG implementation with vector search
5. Admin panel API endpoints
6. Affiliate payout system

### Production Notes

- NO localhost references - 100% Azure production URLs
- All credentials from environment variables
- JWT tokens expire in 7 days
- Session cookies are HTTP-only and secure in production
- MongoDB connection with retry logic
- Global error handling and logging
