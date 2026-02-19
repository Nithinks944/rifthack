# QUICK SETUP & LINKING GUIDE

## 🎯 What You Need to Link/Configure

### 1. Environment Variables (REQUIRED)

**Create `.env` file** (copy from `.env.example`):
```bash
cp .env.example .env
```

**Then update with your actual credentials:**

#### GITHUB_TOKEN
- **Where to get**: https://github.com/settings/tokens
- **Steps**:
  1. GitHub → Settings → Developer settings
  2. Personal access tokens → Tokens (classic)
  3. Generate new token
  4. Select scopes: ✓ repo (full control)
  5. Copy token and paste in `.env`

#### OPENAI_API_KEY
- **Where to get**: https://platform.openai.com/api-keys
- **Steps**:
  1. Sign up/login to OpenAI
  2. Navigate to API keys
  3. Create new secret key
  4. Copy and paste in `.env`
- **Cost**: ~$0.01-0.03 per agent run (depends on repo size)

---

### 2. Deployment URLs (After deploy)

**Update [README.md](README.md) with your deployed URLs:**

```markdown
## Live Deployment URL
- Frontend: https://your-frontend.vercel.app
- Backend: https://your-backend.railway.app
```

**How to get:**
- Frontend: Deploy to Vercel → Copy deployment URL
- Backend: Deploy to Railway → Copy public domain

---

### 3. LinkedIn Demo Video (REQUIRED)

**Record and upload:**
1. Screen record your dashboard in action (2-3 minutes)
2. Show:
   - Dashboard UI
   - Running agent on a test repo
   - Fixes being applied
   - Final score and timeline
3. Upload to LinkedIn
4. **Tag @RIFT2026** in the post
5. Copy post URL and add to README.md:

```markdown
## LinkedIn Demo URL
- Public post tagging @RIFT2026: https://linkedin.com/posts/your-username/activity-id
```

---

### 4. Architecture Diagram (REQUIRED)

**Create diagram showing:**

```
┌─────────────────┐
│  React Frontend │
│  (Vercel)       │
└────────┬────────┘
         │ SSE Stream
         ▼
┌─────────────────┐
│  Express API    │
│  (Railway)      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌─────────┐ ┌──────────────┐
│  Docker │ │  Multi-Agent │
│ Sandbox │ │  System      │
└─────────┘ └──────┬───────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐     ┌────────▼─────┐
    │ OpenAI  │     │  Simple-git  │
    │ Fixes   │     │  Push/Commit │
    └─────────┘     └──────────────┘
```

**Tools to create:**
- Excalidraw: https://excalidraw.com (free, online)
- Draw.io: https://draw.io (free, online)
- Figma: https://figma.com (free tier available)

**Save as:** `docs/architecture.png`

**Add to README:**
```markdown
## Architecture Diagram
![Architecture](docs/architecture.png)
```

---

### 5. Team Information (Update README.md)

```markdown
## Team Members
- Team Name: RIFT ORGANISERS
- Team Leader: Saiyam Kumar
- Members: 
  - Member 1 Name - Role
  - Member 2 Name - Role
  - Member 3 Name - Role
```

---

## 🚀 Deployment Steps (Quick)

### Backend (Railway)
```bash
# 1. Push code to GitHub
git add .
git commit -m "Ready for deployment"
git push origin main

# 2. Go to railway.app
# 3. New Project → Deploy from GitHub
# 4. Select your repository
# 5. Add environment variables:
#    - GITHUB_TOKEN
#    - OPENAI_API_KEY
#    - PORT=3000
# 6. Deploy!
# 7. Copy the public URL (e.g., https://xxx.railway.app)
```

### Frontend (Vercel)
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy from frontend folder
cd frontend
vercel --prod

# 4. Add environment variable in Vercel dashboard:
#    VITE_API_BASE_URL = https://your-backend.railway.app

# 5. Redeploy to apply env var
vercel --prod

# 6. Copy the production URL
```

---

## ✅ Pre-Submission Checklist

Before submitting, verify:

- [ ] `.env` file created with real tokens (DON'T commit this!)
- [ ] `.env.example` has placeholder values only
- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Frontend can communicate with backend (no CORS errors)
- [ ] Test the app end-to-end with a sample repo
- [ ] `server/results.json` is generated after a run
- [ ] README.md updated with:
  - [ ] Frontend URL
  - [ ] Backend URL
  - [ ] LinkedIn demo video link
  - [ ] Architecture diagram
  - [ ] Team information
- [ ] Architecture diagram created and saved in `docs/`
- [ ] LinkedIn demo video posted and tagged @RIFT2026
- [ ] All code pushed to GitHub
- [ ] Repository is public (or accessible to judges)

---

## 🧪 Test Your Deployment

1. **Open your deployed frontend URL**
2. **Enter test data:**
   ```
   Repository: https://github.com/Nithin-jain22/ai-agent-test
   Team Name: RIFT ORGANISERS
   Leader Name: Saiyam Kumar
   Retry Limit: 5
   ```
3. **Click "Run Agent"**
4. **Verify:**
   - Loading indicator appears
   - Dashboard updates in real-time
   - Fixes table populates
   - Timeline shows iterations
   - Score displays correctly
   - No console errors

---

## ⚠️ Common Issues

### CORS Error
**Fix:** Update backend `server/index.js`:
```javascript
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-frontend.vercel.app'],
  credentials: true
}));
```

### Environment variable not loading
**Frontend:** Must start with `VITE_`
**Backend:** Restart server after changing `.env`

### OpenAI API error
- Check API key is valid
- Check you have credits: https://platform.openai.com/usage
- Default model is GPT-4 (expensive) - consider switching to GPT-3.5-turbo

### Docker not available on Railway
**Expected!** The app has a local fallback that runs commands directly. This is acceptable.

---

## 📞 Need Help?

- Review [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions
- Check [README.md](README.md) for API documentation
- Test locally first: `npm run dev:all`

---

**You're all set!** Once deployed and linked, your submission is complete. Good luck! 🎉
