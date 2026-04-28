# Deploy TennisTrack to Azure App Service

## Prerequisites
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- Azure account (free tier works)
- GitHub repo: `https://github.com/mohantechai-sudo/tennistrack-app`

---

## Option A — Deploy via Azure Portal (recommended for first-time)

### Step 1: Create an App Service

1. Go to [portal.azure.com](https://portal.azure.com)
2. Click **Create a resource → Web App**
3. Fill in:
   - **Subscription:** your subscription
   - **Resource Group:** create new → `tennistrack-rg`
   - **Name:** `tennistrack-app` (must be globally unique)
   - **Publish:** Code
   - **Runtime stack:** Node 20 LTS
   - **OS:** Linux
   - **Region:** East US (or nearest)
   - **Pricing plan:** Free F1 (or B1 for production)
4. Click **Review + Create → Create**

---

### Step 2: Connect GitHub for Continuous Deployment

1. In your App Service → **Deployment Center**
2. **Source:** GitHub
3. Authorize and select:
   - Organization: `mohantechai-sudo`
   - Repository: `tennistrack-app`
   - Branch: `main`
4. Click **Save** — Azure will auto-deploy on every push to `main`

---

### Step 3: Set Environment Variables

In App Service → **Configuration → Application Settings**, add:

| Name | Value |
|------|-------|
| `SESSION_SECRET` | a long random string |
| `EMAIL_USER` | your Gmail address |
| `EMAIL_PASS` | your Gmail App Password |
| `TWILIO_SID` | your Twilio Account SID |
| `TWILIO_TOKEN` | your Twilio Auth Token |
| `TWILIO_FROM_SMS` | your Twilio phone number |

> Update `config.js` to read these from `process.env` before going live.

Click **Save** after adding all settings.

---

### Step 4: Set Startup Command

In App Service → **Configuration → General settings**:

- **Startup Command:** `npm start`

Click **Save**.

---

### Step 5: Verify Deployment

Go to: `https://tennistrack-app.azurewebsites.net`

Check logs at: App Service → **Log stream**

---

## Option B — Deploy via Azure CLI

```bash
# 1. Login
az login

# 2. Create resource group
az group create --name tennistrack-rg --location eastus

# 3. Create App Service plan (free tier)
az appservice plan create \
  --name tennistrack-plan \
  --resource-group tennistrack-rg \
  --sku FREE \
  --is-linux

# 4. Create web app
az webapp create \
  --resource-group tennistrack-rg \
  --plan tennistrack-plan \
  --name tennistrack-app \
  --runtime "NODE:20-lts"

# 5. Set startup command
az webapp config set \
  --resource-group tennistrack-rg \
  --name tennistrack-app \
  --startup-file "npm start"

# 6. Deploy from GitHub
az webapp deployment source config \
  --resource-group tennistrack-rg \
  --name tennistrack-app \
  --repo-url https://github.com/mohantechai-sudo/tennistrack-app \
  --branch main \
  --manual-integration

# 7. Set environment variables
az webapp config appsettings set \
  --resource-group tennistrack-rg \
  --name tennistrack-app \
  --settings \
    SESSION_SECRET="change-me-to-a-long-random-string" \
    EMAIL_USER="your_email@gmail.com" \
    EMAIL_PASS="your_app_password" \
    TWILIO_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
    TWILIO_TOKEN="your_auth_token"

# 8. Open the app
az webapp browse --resource-group tennistrack-rg --name tennistrack-app
```

---

## Important Notes

### SQLite in Production
SQLite stores data in a single file (`tennis.db`). On Azure App Service Linux, the app directory (`/home/site/wwwroot`) is persistent across restarts. However:
- **Do not scale beyond 1 instance** — multiple instances cannot share one SQLite file
- For multi-instance scaling, migrate to **Azure SQL Database** or **PostgreSQL**

### HTTPS
Azure App Service provides a free `*.azurewebsites.net` SSL certificate automatically. For a custom domain, add it under App Service → **Custom domains**.

### Cost Estimate
| Plan | Cost | Use case |
|------|------|----------|
| F1 Free | $0/mo | Testing only (60 CPU min/day) |
| B1 Basic | ~$13/mo | Small production app |
| B2 Basic | ~$26/mo | Moderate traffic |
