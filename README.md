# Timetable App

School timetable management app — React frontend + Node.js/Express backend + Supabase (PostgreSQL).

## Project Structure

```
├── src/                  # React frontend (Vite)
│   ├── components/       # UI components
│   ├── context/          # TimetableContext (state management)
│   └── services/api.js   # REST client → calls Node.js backend
├── server/               # Node.js Express backend
│   ├── index.js          # API routes (Express)
│   ├── supabase.js       # Supabase admin client
│   └── schema.sql        # Database schema (run in Supabase SQL Editor)
├── .env                  # Environment variables (not committed)
└── .env.example          # Template for .env
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run the contents of `server/schema.sql`
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **service_role** secret key

### 2. Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Install & Run

```bash
npm install
npm run dev
```

This starts both the Vite dev server (port 5173) and the Express API (port 3001). Vite proxies `/api` requests to Express.

### Individual commands

```bash
npm run dev:client   # Vite only
npm run dev:server   # Express only
npm run build        # Production build (frontend)
npm start            # Production server
```
# timetable
