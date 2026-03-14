# TennisNoteDashboard

TennisNoteDashboard is a React + TypeScript + Vite application backed by Supabase.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm
- A Supabase project

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create your local environment file from the example.

```bash
cp .env.example .env.local
```

3. Set the following values in `.env.local`.

```bash
VITE_ANDROID_APK_URL=your-public-apk-url
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. In Supabase SQL Editor, run `supabase_schema.sql`.

This script is written to be safe for existing environments. It does not drop tables or delete rows, and only adds missing schema objects, indexes, and policies.

5. In Supabase Auth, enable Email sign-in.

This app uses `signInWithPassword` and `signUp`, so email-based authentication must be available in the Supabase project.

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Production Deployment

This app can be deployed to GitHub Pages from the `main` branch using GitHub Actions.

1. Push this repository to GitHub.
2. In GitHub repository settings, enable Pages and set the source to `GitHub Actions`.
3. Add these repository secrets:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

4. Push to `main` or run the `Deploy to GitHub Pages` workflow manually.
