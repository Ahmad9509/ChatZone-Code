# ChatZone.ai Frontend

Production-ready Next.js 14 frontend for ChatZone.ai platform.

## Features

✅ Landing page with pricing tiers  
✅ OAuth login (Google + Twitter)  
✅ Real-time chat interface with streaming  
✅ Conversation management (sidebar)  
✅ Zustand state management  
✅ Tailwind CSS styling  
✅ TypeScript + Next.js 14 App Router

## Environment Variables

Create `.env.local` (local testing):

```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51QRjGyDfZhtDpAE117YDhOcRvTwYaPPlfZh6FPkuTgtYH3F0p3UlFTm4vOH6DikhDHBGjV62amU08wtcy3kRktIV00PEaiPsbC
```

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

For Azure App Service set:

```
NEXT_PUBLIC_API_URL=https://chatzone-api-b8h3g0c4hydccrcy.eastus-01.azurewebsites.net
```

## Deployment to Azure

1. Push to GitHub
2. Azure Portal → App Service → Deployment Center
3. Connect GitHub repository
4. Add environment variables in Configuration
5. Auto-deploy on push to `main`

## Pages

- `/` - Landing page
- `/login` - OAuth login
- `/auth/callback` - OAuth callback handler
- `/chat` - Main chat interface

## Production URL

https://chatzone-frontend-gabxa9hrhkf4bfcs.canadacentral-01.azurewebsites.net
