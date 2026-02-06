# Supabase Setup Guide for LuvTALK

This guide will help you configure Supabase for the LuvTALK application to enable user authentication and data persistence.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- Your Supabase project created
- Environment variables configured in `.env` file

## Step 1: Enable Anonymous Sign-ins

Anonymous sign-ins allow users to try the app without providing any credentials.

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Anonymous sign-ins** in the list
4. Toggle it **ON**
5. Configure session duration (default: 7 days is recommended)
6. Click **Save**

## Step 2: Enable Phone Authentication

Phone authentication allows users to sign in using their phone number and OTP (One-Time Password).

1. Go to **Authentication** → **Providers**
2. Find **Phone** in the list
3. Toggle it **ON**
4. Choose an SMS provider:
   - **Twilio** (recommended for production)
   - **MessageBird**
   - **Vonage**
5. Add your SMS provider credentials:
   - Account SID
   - Auth Token
   - Phone Number (for Twilio)
6. Configure phone number format (e.g., international format: +1234567890)
7. Optionally customize SMS templates
8. Click **Save**

### Testing Without SMS Provider

For development/testing without an SMS provider:

- Use Supabase's test phone numbers feature (if available in your plan)
- Or temporarily use email authentication as an alternative

## Step 3: Configure Auth Settings

1. Go to **Authentication** → **Settings**
2. Configure the following:

### Site URL

- **Development**: `http://localhost:5173`
- **Production**: Your deployed frontend URL (e.g., `https://luvtalk.app`)

### Redirect URLs

Add allowed redirect URLs (one per line):

```
http://localhost:5173/**
https://your-production-domain.com/**
```

### JWT Settings

- **JWT expiry**: 3600 seconds (1 hour) - default is fine
- **Refresh token rotation**: Enable for better security

### Email Settings (Optional)

If you want to enable email authentication:

- Configure SMTP settings or use Supabase's built-in email service
- Customize email templates

## Step 4: Seed Database Tables

The application requires several database tables. These should already be created by Prisma migrations, but you need to seed them with initial data.

### Run the Seed SQL

1. Go to **SQL Editor** in your Supabase Dashboard
2. Create a new query
3. Copy the SQL from `docs/supabase-seed.sql.md`
4. Execute the query

This will populate:

- **Achievement** table with 8 achievements
- **LevelDefinition** table with 8 levels

### Verify Tables Exist

Run this query to check all required tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:

- `User`
- `Conversation`
- `Favorite`
- `ReviewQueueItem`
- `ReviewFeedback`
- `Achievement`
- `UserAchievement`
- `LevelDefinition`
- `UserLevel`
- `SessionToken`
- `TranslationRecord`

## Step 5: Configure Row Level Security (RLS) - Optional but Recommended

RLS policies ensure users can only access their own data.

### Enable RLS on Tables

```sql
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Favorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewQueueItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAchievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserLevel" ENABLE ROW LEVEL SECURITY;
```

### Create Basic Policies

```sql
-- Users can view their own profile
CREATE POLICY "Users can view own data" ON "User"
  FOR SELECT USING (auth.uid() = id);

-- Users can manage their own conversations
CREATE POLICY "Users can manage own conversations" ON "Conversation"
  FOR ALL USING (auth.uid() = "userId");

-- Users can manage their own favorites
CREATE POLICY "Users can manage own favorites" ON "Favorite"
  FOR ALL USING (auth.uid() = "userId");

-- Users can manage their own review queue
CREATE POLICY "Users can manage own review queue" ON "ReviewQueueItem"
  FOR ALL USING (auth.uid() = "userId");

-- Users can manage their own review feedback
CREATE POLICY "Users can manage own review feedback" ON "ReviewFeedback"
  FOR ALL USING (auth.uid() = "userId");

-- Users can view their own achievements
CREATE POLICY "Users can view own achievements" ON "UserAchievement"
  FOR SELECT USING (auth.uid() = "userId");

-- Users can view their own level
CREATE POLICY "Users can view own level" ON "UserLevel"
  FOR SELECT USING (auth.uid() = "userId");

-- Everyone can read achievement definitions
CREATE POLICY "Anyone can view achievements" ON "Achievement"
  FOR SELECT USING (true);

-- Everyone can read level definitions
CREATE POLICY "Anyone can view levels" ON "LevelDefinition"
  FOR SELECT USING (true);
```

## Step 6: Verify Environment Variables

Ensure your `.env` file has the correct Supabase credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Frontend (Vite)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in:
**Supabase Dashboard** → **Settings** → **API**

## Testing Checklist

### 1. Guest Mode Login

- [ ] Open the app
- [ ] Click "游客体验" / "Guest Mode" button
- [ ] Should create anonymous session
- [ ] Check Supabase Dashboard → **Authentication** → **Users** for new anonymous user
- [ ] Try creating a conversation - should persist to database
- [ ] Refresh page - session should be maintained

### 2. Phone OTP Login

- [ ] Click "手机号登录" / "Phone Login"
- [ ] Enter a valid phone number
- [ ] Click "发送验证码" / "Send Code"
- [ ] Receive SMS with OTP code
- [ ] Enter the OTP code
- [ ] Should create authenticated session
- [ ] Check Supabase Dashboard → **Authentication** → **Users** for new phone user
- [ ] Try creating data - should persist with user ID

### 3. Data Persistence

- [ ] Create conversations - check `Conversation` table in Supabase
- [ ] Save favorites - check `Favorite` table
- [ ] Complete reviews - check `ReviewQueueItem` and `ReviewFeedback` tables
- [ ] View achievements - check `UserAchievement` table

### 4. Session Management

- [ ] Refresh page - session should persist
- [ ] Logout - session should clear
- [ ] Login again - should restore user data

## Troubleshooting

### Issue: "Supabase 未配置" Error

**Solution**: Check that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env` file

### Issue: SMS Not Sending

**Solution**:

- Verify SMS provider credentials in Supabase Dashboard
- Check SMS provider account balance
- Verify phone number format (use international format with country code)

### Issue: Anonymous Login Not Working

**Solution**: Ensure Anonymous sign-ins are enabled in Supabase Dashboard → Authentication → Providers

### Issue: Data Not Persisting

**Solution**:

- Check that tables exist in Supabase
- Verify RLS policies are not blocking access
- Check browser console for errors
- Verify backend can connect to Supabase (check `DATABASE_URL` in server `.env`)

### Issue: "P1002: Connection timeout" Error

**Solution**:

- Use `DIRECT_URL` for migrations (not pooler URL)
- Check network connectivity to Supabase
- Verify database credentials

## Production Checklist

Before deploying to production:

- [ ] Configure production Site URL and Redirect URLs
- [ ] Enable RLS policies on all tables
- [ ] Set up proper SMS provider with production credentials
- [ ] Configure custom email templates
- [ ] Set up monitoring and alerts
- [ ] Review and adjust JWT expiry settings
- [ ] Enable refresh token rotation
- [ ] Set up database backups
- [ ] Configure rate limiting for auth endpoints

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Phone Auth Guide](https://supabase.com/docs/guides/auth/phone-login)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)

## Support

If you encounter issues:

1. Check the Supabase Dashboard logs
2. Review browser console errors
3. Check server logs for backend errors
4. Consult Supabase documentation
5. Ask in Supabase Discord community
