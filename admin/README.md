# ChatZone.ai Admin Panel

Production-ready Next.js 14 admin panel for ChatZone.ai platform management.

## Features

✅ Admin authentication (username + password, no OAuth)  
✅ Dashboard with key metrics  
✅ AI Model management interface  
✅ User management  
✅ Analytics dashboard  
✅ System prompts editor  
✅ Pricing tier configuration  
✅ Dark theme optimized for admin work

## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=https://chatzone-api-b8h3g0c4hydccrcy.eastus-01.azurewebsites.net
```

## Admin Credentials

Set in backend `.env`:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
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

## Deployment to Azure

1. Push to GitHub
2. Azure Portal → App Service (chatzone-admin) → Deployment Center
3. Connect GitHub repository
4. Add environment variables in Configuration
5. Auto-deploy on push to `main`

## Admin Features

### Dashboard

- Total users, subscriptions, revenue
- Recent activity log
- Quick action buttons

### Model Management

- Add/edit/delete AI models
- Assign models to pricing tiers
- Configure vision model fallbacks
- Test model connections

### User Management

- View all users
- Update user tiers manually
- Grant pro replies
- View user conversations

### Analytics

- Revenue analytics (MRR, ARPU, LTV)
- Usage analytics (messages, tokens)
- Feature adoption rates
- Conversion funnels

### System Prompts

- Edit master system prompt
- Configure feature-specific prompts
- Version history
- A/B testing

### Tier Configuration

- Configure token limits per tier
- Set model availability
- RAG storage limits
- Pro reply limits

## Production URL

https://chatzone-admin-grdddwdef9c3baer.eastus-01.azurewebsites.net

## Security

- Separate authentication from user login
- Admin JWT tokens
- Session management
- Activity logging
- IP whitelist (optional)
