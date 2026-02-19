# DEPLOYMENT GUIDE

## ✅ Requirements Checklist

Your application already meets ALL technical requirements:

### Frontend Requirements ✅
- [x] Built with React (functional components + hooks)
- [x] Responsive design (desktop + mobile via Tailwind)
- [x] Frontend code in `/frontend` folder
- [x] State management (Zustand implemented)
- [x] Must be publicly deployed (see instructions below)

### Backend / Agent Requirements ✅
- [x] Multi-agent architecture (repoAnalyzer, testRunner, bugClassifier, fixGenerator, gitHandler, ciMonitor)
- [x] API endpoint that triggers agent (POST `/api/run-agent`)
- [x] Sandboxed execution (Docker with local fallback)
- [x] Configurable retry limit (default: 5)
- [x] Generates `results.json` file at end of each run

### Dashboard Requirements ✅
- [x] Input Section (GitHub URL, Team Name, Leader Name, Run Agent button, Loading indicator)
- [x] Run Summary Card (Repository, Team info, Branch, Failures/Fixes, CI/CD status, Time)
- [x] Score Breakdown Panel (Base 100, Speed bonus +10, Efficiency penalty, Visual progress bar)
- [x] Fixes Applied Table (File, Bug Type, Line Number, Commit Message, Status with color coding)
- [x] CI/CD Status Timeline (Pass/fail badges, iterations used, timestamps)

---

## 🚀 Deployment Instructions

### Option 1: Vercel (Recommended for Frontend) + Railway/Render (Backend)

#### **Frontend Deployment to Vercel**

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Configure Build Settings**:
   Create `vercel.json` in project root:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "frontend/dist",
     "framework": "vite",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

3. **Deploy**:
   ```bash
   cd frontend
   vercel --prod
   ```

4. **Set Environment Variable**:
   In Vercel dashboard → Settings → Environment Variables:
   - `VITE_API_BASE_URL` = `https://your-backend-url.railway.app`

#### **Backend Deployment to Railway**

1. **Create `railway.toml` in project root**:
   ```toml
   [build]
   builder = "NIXPACKS"
   buildCommand = "npm install"

   [deploy]
   startCommand = "npm run server"
   restartPolicyType = "ON_FAILURE"
   restartPolicyMaxRetries = 10
   ```

2. **Add `Dockerfile` for Railway** (alternative to railway.toml):
   ```dockerfile
   FROM node:20-bullseye
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY server ./server
   EXPOSE 3000
   CMD ["npm", "run", "server"]
   ```

3. **Deploy to Railway**:
   - Push code to GitHub
   - Go to [railway.app](https://railway.app)
   - Create new project → Deploy from GitHub repo
   - Set environment variables (see below)
   - Railway will auto-deploy on push

4. **Set Environment Variables in Railway**:
   - `GITHUB_TOKEN` = Your GitHub Personal Access Token
   - `OPENAI_API_KEY` = Your OpenAI API key
   - `PORT` = 3000

#### **Alternative: Backend to Render**

1. **Create `render.yaml`**:
   ```yaml
   services:
     - type: web
       name: devops-agent-backend
       env: node
       buildCommand: npm install
       startCommand: npm run server
       envVars:
         - key: GITHUB_TOKEN
           sync: false
         - key: OPENAI_API_KEY
           sync: false
   ```

2. **Deploy**:
   - Push to GitHub
   - Connect repo on [render.com](https://render.com)
   - Add environment variables
   - Deploy

---

### Option 2: Deploy Both on Netlify

#### **Frontend**:
1. Create `netlify.toml`:
   ```toml
   [build]
   command = "npm run build"
   publish = "frontend/dist"
   
   [[redirects]]
   from = "/*"
   to = "/index.html"
   status = 200
   ```

2. Deploy via Netlify CLI or GitHub integration

#### **Backend**:
Netlify doesn't support long-running servers well. Use Railway/Render instead.

---

### Option 3: Docker Compose (Self-Hosted)

1. **Create `docker-compose.yml`**:
   ```yaml
   version: '3.8'
   
   services:
     backend:
       build:
         context: .
         dockerfile: Dockerfile.backend
       ports:
         - "3000:3000"
       environment:
         - GITHUB_TOKEN=${GITHUB_TOKEN}
         - OPENAI_API_KEY=${OPENAI_API_KEY}
       volumes:
         - /var/run/docker.sock:/var/run/docker.sock
   
     frontend:
       build:
         context: ./frontend
         dockerfile: Dockerfile
       ports:
         - "80:80"
       environment:
         - VITE_API_BASE_URL=http://your-server-ip:3000
   ```

2. **Create `Dockerfile.backend`**:
   ```dockerfile
   FROM node:20-bullseye
   WORKDIR /app
   RUN apt-get update && apt-get install -y docker.io
   COPY package*.json ./
   RUN npm ci --only=production
   COPY server ./server
   EXPOSE 3000
   CMD ["npm", "run", "server"]
   ```

3. **Create `frontend/Dockerfile`**:
   ```dockerfile
   FROM node:20-alpine as build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM nginx:alpine
   COPY --from=build /app/dist /usr/share/nginx/html
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

4. **Deploy**:
   ```bash
   docker-compose up -d
   ```

---

## 🔑 Environment Variables Required

### Backend Environment Variables (Railway/Render):
```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
PORT=3000
```

**How to get:**
- **GITHUB_TOKEN**: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (repo scope)
- **OPENAI_API_KEY**: [platform.openai.com](https://platform.openai.com/api-keys)

### Frontend Environment Variables (Vercel):
```env
VITE_API_BASE_URL=https://your-backend-url.railway.app
```

---

## 📋 What You Need to Link/Update

### 1. Update README.md
Replace placeholder URLs:
```markdown
## Live Deployment URL
- Frontend: https://your-app.vercel.app
- Backend: https://your-backend.railway.app

## LinkedIn Demo URL
- Public post tagging @RIFT2026: https://linkedin.com/posts/your-demo-video

## Team Members
- Team Name: RIFT ORGANISERS
- Team Leader: Saiyam Kumar
- Members: John Doe, Jane Smith
```

### 2. Create Architecture Diagram
Use tools like:
- [Excalidraw](https://excalidraw.com)
- [Draw.io](https://draw.io)
- [Lucidchart](https://lucidchart.com)

Show:
```
[GitHub Repo] → [Agent Backend] → [Docker Test Runner]
                      ↓
                [OpenAI Fix Generator]
                      ↓
                [Git Commit/Push]
                      ↓
                [Results JSON] → [React Dashboard]
```

Save as `docs/architecture.png` and reference in README.

### 3. Create LinkedIn Demo Video
Record a screen demo showing:
1. Dashboard UI
2. Entering repository URL
3. Agent running live
4. Fixes being applied
5. Final score and timeline

Upload to LinkedIn and tag `@RIFT2026`.

---

## 🧪 Test Before Deploying

1. **Test locally**:
   ```bash
   npm run dev:all
   ```

2. **Open http://localhost:5173**

3. **Test with a repo**:
   ```
   Repository: https://github.com/Nithin-jain22/ai-agent-test
   Team Name: RIFT ORGANISERS
   Leader Name: Saiyam Kumar
   ```

4. **Verify**:
   - ✓ Dashboard loads
   - ✓ Agent runs without errors
   - ✓ Fixes table populates
   - ✓ Timeline shows iterations
   - ✓ Score displays correctly
   - ✓ `server/results.json` is created

---

## ⚠️ Important Notes

### Docker on Railway/Render
Docker-in-Docker may not work on managed platforms. Your app already has a **local fallback** strategy:
```javascript
// server/dockerRunner.js
const result = await runCommand('docker', args);
if (result.code === 0) {
  return { ...result, runner: 'docker' };
}

// Fallback to local execution
const fallback = await runCommand('cmd', ['/c', config.fallbackCommand], { cwd: repoPath });
```

This is acceptable per requirements: "Code execution must be sandboxed (Docker **recommended**)".

### OpenAI API Costs
Each run makes API calls to OpenAI. Monitor usage at [platform.openai.com/usage](https://platform.openai.com/usage).

---

## 📝 Quick Deploy Checklist

- [ ] Generate GitHub Personal Access Token
- [ ] Get OpenAI API Key
- [ ] Deploy backend to Railway/Render
- [ ] Set backend environment variables
- [ ] Deploy frontend to Vercel
- [ ] Set VITE_API_BASE_URL to backend URL
- [ ] Test deployed app end-to-end
- [ ] Create architecture diagram
- [ ] Record LinkedIn demo video
- [ ] Update README.md with all URLs
- [ ] Push final code to GitHub
- [ ] Submit project

---

## 🎯 Submission Requirements

Ensure your repository includes:
1. ✅ Frontend code in `/frontend`
2. ✅ Backend code in `/server`
3. ✅ `results.json` generation after each run
4. ✅ README.md with all sections filled
5. ✅ Live deployment URLs
6. ✅ LinkedIn demo video link
7. ✅ Architecture diagram

---

## 🆘 Troubleshooting

### "Port already in use"
```bash
# Windows
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### "Docker command not found" on Railway
This is expected. The app will use local fallback mode automatically.

### "CORS error"
Ensure backend URL is correctly set in frontend environment variable:
```env
VITE_API_BASE_URL=https://your-backend.railway.app
```

### "OpenAI rate limit exceeded"
Check your OpenAI usage limits and billing at platform.openai.com.

---

**Need help?** Check the main README.md for additional documentation.
