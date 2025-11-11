# Deploy Backend to Render.com

## Current Issue
The production server at `https://script-backend-ojlh.onrender.com` is returning 404 for the new payment endpoints because it hasn't been updated with the latest code.

## Quick Fix: Deploy to Render.com

### Option 1: Automatic Deployment (Recommended)
If your Render service is connected to GitHub:

1. **Commit and push your changes:**
   ```bash
   cd scriptBackend
   git add .
   git commit -m "Add payment gateway endpoints for premium signup"
   git push origin main
   ```

2. **Render will automatically deploy** - Check your Render dashboard for deployment status

3. **Wait for deployment to complete** (usually 2-5 minutes)

4. **Test the endpoint:**
   ```bash
   curl -X POST https://script-backend-ojlh.onrender.com/api/auth/register-with-payment \
     -H "Content-Type: application/json" \
     -d '{"businessName":"Test","email":"test@example.com","phone":"123","password":"password123"}'
   ```

### Option 2: Manual Deploy from Render Dashboard
1. Go to https://dashboard.render.com
2. Select your backend service
3. Click "Manual Deploy" → "Deploy latest commit"

### Option 3: Restart Service
Sometimes a simple restart helps:
1. Go to Render dashboard
2. Click "Manual Deploy" → "Clear build cache & deploy"

## Verify Environment Variables on Render

Make sure these are set in your Render service environment variables:

1. Go to your Render service → Environment
2. Add/verify these variables:
   ```
   FLUTTERWAVE_SECRET_KEY=FLWSECK-ea68f56dba2b673271cbd72e2be6814c-19a694da32evt-X
   FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-f924db2b324104ba75fd9090a1074995-X
   FLUTTERWAVE_ENCRYPTION_KEY=ea68f56dba2bdfe855e2d692
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```

## Test Locally First (Optional)

Before deploying, you can test locally:

1. **Start local backend:**
   ```bash
   cd scriptBackend
   npm start
   ```

2. **Test the endpoint:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/register-with-payment \
     -H "Content-Type: application/json" \
     -d '{"businessName":"Test","email":"test@example.com","phone":"123","password":"password123"}'
   ```

3. **Update frontend to use local backend** (temporarily):
   - Change `API_BASE_URL` in `scriptFrontend/client/lib/apiConfig.js` to `http://localhost:5000`
   - Test the payment flow
   - Change it back to production URL before deploying

## After Deployment

Once deployed, the endpoint should work:
- ✅ `POST /api/auth/register-with-payment` - Should return 201 with payment details
- ✅ `POST /api/auth/verify-signup-payment` - Should return 200 with tokens

## Troubleshooting

### Still getting 404?
1. Check Render deployment logs for errors
2. Verify the route file was included in the deployment
3. Check that `src/routes/authRoutes.js` exists in the deployed code

### Getting 500 errors?
1. Check Render logs for detailed error messages
2. Verify environment variables are set correctly
3. Check MongoDB connection is working

### Deployment fails?
1. Check build logs in Render dashboard
2. Verify all dependencies are in `package.json`
3. Check Node.js version matches your local setup

