# Studywell

Studywell is a lightweight student task planner built for the IBM BOB 2.0 Hackathon. Organize coursework, prioritize upcoming work, and keep an eye on progress from one focused workspace. This version intentionally contains seeded logic defects as a test target for a hackathon bug-detection AI.

## Run locally

Requirements: Node.js 18 or later.

```bash
npm install
npm run dev
```

Vite prints a local URL when the development server is ready. To make a production build, run `npm run build`.

## Features

- Dashboard with due-today, overdue, completion, and subject summaries
- Task creation, editing, deletion, completion, search, filtering, sorting, and detail views
- Progress view grouped by subject
- Local browser storage, so tasks stay available on the same device without a backend
- Responsive layout for desktop and mobile

The original standalone JSX screens remain in the repository as project references. Their Base44 client and shared UI modules were not included in the repository, so this runnable version uses a self-contained frontend and local storage instead.