# Flutterwave Setup for Render.com

## Issue: "Invalid authorization key"

This error occurs when the Flutterwave secret key is not properly configured in your Render.com environment variables.

## Solution: Add Environment Variables to Render

### Steps:

1. **Go to Render Dashboard**
   - Navigate to https://dashboard.render.com
   - Select your backend service (`script-backend-ojlh`)

2. **Open Environment Tab**
   - Click on "Environment" in the left sidebar
   - Or go to Settings → Environment

3. **Add Flutterwave Keys**
   Click "Add Environment Variable" and add these three variables:

   ```
   Key: FLUTTERWAVE_SECRET_KEY
   Value: FLWSECK-ea68f56dba2b673271cbd72e2be6814c-19a694da32evt-X
   ```

   ```
   Key: FLUTTERWAVE_PUBLIC_KEY
   Value: FLWPUBK-f924db2b324104ba75fd9090a1074995-X
   ```

   ```
   Key: FLUTTERWAVE_ENCRYPTION_KEY
   Value: ea68f56dba2bdfe855e2d692
   ```

   ```
   Key: FRONTEND_URL
   Value: https://your-frontend-url.vercel.app
   (or http://localhost:8080 for local testing)
   ```

4. **Save and Redeploy**
   - Click "Save Changes"
   - Render will automatically redeploy your service
   - Wait 2-5 minutes for deployment to complete

5. **Verify**
   - Check the deployment logs to ensure no errors
   - Test the payment endpoint again

## Verify Environment Variables

You can verify the keys are set by checking the deployment logs. The backend will log:
- ✅ If the key is configured (shows preview)
- ❌ If the key is missing

## Common Issues

### Key not found after adding
- Make sure you clicked "Save Changes"
- Wait for the service to redeploy
- Check that the variable name is exactly `FLUTTERWAVE_SECRET_KEY` (case-sensitive)

### Still getting "Invalid authorization key"
- Verify the key value is correct (no extra spaces)
- Make sure you're using the **Secret Key** (starts with `FLWSECK-`), not the Public Key
- Check if you're using test keys in production or vice versa

### Test vs Production Keys
- **Test Keys**: Use for development/testing
- **Production Keys**: Use for live payments
- Make sure you're using the correct keys for your environment

## Security Note

⚠️ **Never commit these keys to Git!** They should only be in Render's environment variables.

