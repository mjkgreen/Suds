# Resend Email Integration Setup

You now have Resend integrated for signup emails! Here's what was set up and what you need to do:

## What's Been Created

### 1. **Supabase Edge Function** (`supabase/functions/send-signup-email/index.ts`)
   - Listens for signup requests
   - Sends a welcome email via Resend API
   - Customizable with your branding

### 2. **Email Utility** (`src/lib/email.ts`)
   - `sendSignupEmail()` function that calls the Edge Function
   - Non-blocking (doesn't delay signup if email fails)

### 3. **Updated Auth Hook** (`src/hooks/useAuth.ts`)
   - Now calls `sendSignupEmail()` after successful signup
   - Automatically captures username and email

## Deployment Steps

### Step 1: Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### Step 2: Link Your Project

From the project root:

```bash
supabase link --project-ref gbenibgytweskljxneup
```

When prompted, enter your Supabase database password.

### Step 3: Set Environment Variables

Add your Resend API key to Supabase secrets:

```bash
supabase secrets set RESEND_API_KEY=re_XjZvRdFu_KcAb8vkbq2Bzq76fdRrpdr9z
```

Optionally, set a custom from email:

```bash
supabase secrets set RESEND_FROM_EMAIL=noreply@drink-with-suds.com
```

### Step 4: Deploy the Edge Function

```bash
supabase functions deploy send-signup-email
```

### Step 5: Run Migrations (if using database trigger)

```bash
supabase migration up
```

## Testing

### Test the Email Function Directly

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Functions** → **send-signup-email**
3. Click the **Invoke** button
4. Use this test payload:

```json
{
  "record": {
    "id": "test-user-id",
    "email": "your-email@example.com",
    "raw_user_meta_data": {
      "username": "testuser"
    }
  }
}
```

### Test via Signup

1. Open your app
2. Try signing up with a test account
3. Check the email inbox for the welcome email

## Configuration

### Customize Email Template

Edit `supabase/functions/send-signup-email/index.ts` and modify the `html` section:

```typescript
html: `
  <div>
    <!-- Your custom HTML email template -->
  </div>
`
```

### Change From Email

Update the default in your code or set the `RESEND_FROM_EMAIL` secret:

```typescript
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@suds.app";
```

## Monitoring

### Check Logs

View function execution logs in Supabase Dashboard:
- **Edge Functions** → **send-signup-email** → **Logs**

### Monitor Email Delivery

Check email delivery status in Resend Dashboard:
- [Resend Dashboard](https://resend.com/emails)

## Troubleshooting

### Email Not Sending

1. **Check API Key**: Ensure `RESEND_API_KEY` is correctly set in Supabase secrets
2. **Check From Email**: Verify the sender email is verified in Resend dashboard
3. **Check Logs**: View function logs in Supabase Dashboard for error details
4. **Check Status Code**: Resend returns non-2xx for invalid emails or missing verification

### Function Deployment Failed

1. Ensure you're logged in: `supabase projects list`
2. Check syntax errors in TypeScript
3. Ensure all imports are available

### Still Not Working?

You can manually invoke the function from your client:

```typescript
const { data, error } = await supabase.functions.invoke('send-signup-email', {
  body: {
    record: {
      id: 'user-id',
      email: 'user@example.com',
      raw_user_meta_data: { username: 'username' }
    }
  }
});
```

## Next Steps

1. **Verify Sender Email**: Ensure your from email is verified in Resend
2. **Customize Email**: Update the email template with your branding
3. **Test Thoroughly**: Sign up with a test account and verify receipt
4. **Monitor**: Check logs periodically for delivery issues

## Database Trigger (Optional)

If you want emails to send automatically via database triggers instead of from the client, uncomment and deploy the migration:

```bash
supabase migration up
```

However, the current client-side approach is simpler and more reliable. Use the trigger if you want server-side control over when emails are sent.

---

**Questions?** Check the Resend documentation: https://resend.com/docs
