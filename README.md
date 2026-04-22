# Athens Community Facility Tracker

A comprehensive React-based facility management system with activity logging, user authentication, and cloud storage.

## Features

- 🏢 Kanban-style task board (Backlog, In Progress, Done)
- 📊 Activity logging - Track all user actions and task changes
- 👥 User authentication - Email and name-based login
- ☁️ Cloud storage - Persistent data using window.storage API
- 📥 Excel export - Export tasks and activity logs
- ⏰ Overdue task tracking - Visual indicators for due dates
- 🎯 Task prioritization - Low, Medium, High, Critical
- 📝 Task categories - Maintenance, Pool, Landscaping, Security, etc.
- ⏱️ Automatic timestamps - Track start and completion times

## Installation
```bash
npm install
```

## Development
```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Build for Production
```bash
npm run build
```

## Deploy to Vercel
```bash
npm install -g vercel
vercel
```

## Usage

1. Sign in with your name and email
2. Create tasks with title, description, priority, and due date
3. Move tasks through Backlog → In Progress → Done
4. View activity log to see all changes
5. Export data to Excel for reporting
6. All data persists in cloud storage

## Technologies

- React 18
- Lucide React (icons)
- XLSX (Excel export)
- Vite (build tool)
- Cloud storage via window.storage API

## License

MIT
