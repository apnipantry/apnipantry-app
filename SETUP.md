# Apni Pantry — Local Setup Guide

## What you need installed
- Node.js (download from nodejs.org if you don't have it)
- A terminal / command prompt

## Steps

### 1. Download this project
Unzip this folder somewhere on your computer.
Open your terminal and navigate into the folder:
```
cd path/to/apnipantry-app
```

### 2. Install dependencies
```
npm install
```
This downloads React, Supabase, and other packages. Takes ~1 minute.

### 3. Add your Supabase credentials
Open the file `.env.local` and replace the placeholder values:
```
$env:VITE_SUPABASE_URL="https://pzizarpxyrysduvukwsf.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6aXphcnB4eXJ5c2R1dnVrd3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTcwOTgsImV4cCI6MjA5MDU5MzA5OH0.My2b9GW1I2uqEfgWC_FLQsb78waiELcmN-QtYye_Qvc"
```
Get these from: Supabase Dashboard → Settings (gear icon) → API

### 4. Run the app locally
```
npm run dev
```
Open http://localhost:5173 in your browser.
You should see the Apni Pantry login screen.

### 5. Create your account
- Click "Sign up" and create an account with your email
- Follow the setup flow to name your household and set your role
- You're in!

### 6. Load seed data (optional)
To pre-load all 56 default items, run `02_seed.sql` in your
Supabase SQL Editor (see the SQL files in the parent folder).

### 7. Deploy to Vercel
```
npm run build
```
Then drag the `dist` folder to Vercel, or connect your GitHub repo.
Point apnipantry.com to Vercel in your domain settings.

## File structure
```
src/
  lib/
    supabase.js     ← all database functions (reads + writes)
  components/
    Login.jsx       ← email login screen
    Setup.jsx       ← first-time household setup
    Main.jsx        ← the actual app (list + cart)
  App.jsx           ← decides which screen to show
  main.jsx          ← entry point
  index.css         ← global styles
```
