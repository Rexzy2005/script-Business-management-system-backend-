# Backend Deployment Checklist

## ⚠️ IMPORTANT: Backend Server Must Be Restarted

The new payment endpoints have been added to the code, but the backend server needs to be **restarted** or **redeployed** for the changes to take effect.

## New Endpoints Added

1. **POST** `/api/auth/register-with-payment`
   - Creates pending user account
   - Initializes Flutterwave payment (500 Naira)
   - Returns payment details for frontend

2. **POST** `/api/auth/verify-signup-payment`
   - Verifies payment with Flutterwave
   - Activates user account
   - Returns JWT tokens

## Steps to Deploy

### If Running Locally:
```bash
cd scriptBackend
npm start
# or
node src/server.js
```

### If Deployed on Render.com:
1. Push your code to GitHub
2. Render will automatically redeploy
3. Or manually trigger a redeploy from Render dashboard

### Verify Deployment:
Test the endpoint:
```bash
curl -X POST https://script-backend-ojlh.onrender.com/api/auth/register-with-payment \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Test","email":"test@example.com","phone":"1234567890","password":"password123"}'
```

Should return:
```json
{
  "success": true,
  "message": "User registered. Please complete payment to activate your account.",
  "data": {
    "user": {...},
    "payment": {
      "tx_ref": "...",
      "amount": 500,
      "currency": "NGN",
      ...
    }
  }
}
```

## Environment Variables Required

Make sure these are set in your `.env` file or Render environment variables:

```env
FLUTTERWAVE_SECRET_KEY=FLWSECK-ea68f56dba2b673271cbd72e2be6814c-19a694da32evt-X
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-f924db2b324104ba75fd9090a1074995-X
FLUTTERWAVE_ENCRYPTION_KEY=ea68f56dba2bdfe855e2d692
FRONTEND_URL=http://localhost:3000
```

## Current Status

- ✅ Code is updated and ready
- ✅ Routes are properly configured
- ✅ Controllers are exported correctly
- ⚠️ **Backend server needs restart/redeploy**

## Troubleshooting

### 404 Error on `/api/auth/register-with-payment`
- **Cause**: Backend server hasn't been restarted
- **Solution**: Restart the backend server or redeploy

### 401 Unauthorized Errors
- **Cause**: Token not stored correctly or expired
- **Solution**: Check token storage in localStorage after payment verification

### Payment Verification Fails
- **Cause**: Flutterwave keys not configured
- **Solution**: Verify environment variables are set correctly

