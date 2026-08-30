# Recon Agent - Web Frontend

This directory contains the **Next.js 16** frontend for the Recon Agent platform. It provides a sleek, modern dashboard for users to upload files, map columns, run AI reconciliation, view history, and export reports.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS, Framer Motion (for animations)
- **Components:** Shadcn UI (accessible UI components)
- **Authentication:** Clerk (Multi-tenant B2B Organizations)
- **Charts:** Recharts (for analytics dashboards)

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Environment Variables:
   Ensure you have a `.env.local` file with your Clerk Publishable Key:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000).

## Architecture Highlights
- **Server vs Client Components:** We strictly adhere to the App Router paradigms, utilizing Client Components (`"use client"`) only when interactivity (hooks, state) is needed, optimizing for SSR wherever possible.
- **API Interception:** All calls to the FastAPI backend use our custom `useApi` hook that dynamically injects the Clerk user's authentication JWT to ensure absolute security and tenant isolation.
