# CarbonSense - Quick Setup Guide

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

This will install:
- Next.js 14.2.3
- React 18.3.1
- TypeScript 5.4.5
- Tailwind CSS 3.4.3
- Recharts 2.12.7
- Lucide React (icons)
- And all dev dependencies

### 2. Start Development Server
```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

### 3. Build for Production
```bash
npm run build
npm start
```

## Available Routes

After starting the dev server, you can access:

- `/` - Redirects to dashboard
- `/dashboard` - Executive Dashboard
- `/emissions` - Data Entry & Activity Tracking
- `/tree-engine` - TEME (Tree-Emission Matching Engine)
- `/policy-intelligence` - Policy Analysis & Compliance
- `/compliance` - Compliance Command Center
- `/analytics` - Analytics & Simulation
- `/recommendations` - AI Recommendations
- `/settings` - User & Organization Settings

## Project Features

✅ **Fully Responsive** - Works on desktop, tablet, and mobile
✅ **Dark Theme** - Professional dark mode interface
✅ **TypeScript** - Type-safe code throughout
✅ **Reusable Components** - Modular component architecture
✅ **Next.js 14 App Router** - Modern routing with layouts
✅ **Tailwind CSS** - Utility-first styling
✅ **Interactive Charts** - Recharts for data visualization
✅ **Icon System** - Lucide React icons

## Component Library

### Layout Components
- `Sidebar` - Navigation sidebar with active state
- `Navbar` - Top bar with search and user profile
- `DashboardCard` - Container for content sections

### UI Components
- `StatsCard` - Key metrics display
- `Badge` - Status badges (success, warning, danger, info)
- `Button` - Multiple variants (primary, secondary, outline, ghost)
- `ProgressBar` - Visual progress indicators

### Pages
All pages are fully implemented with:
- TypeScript types
- Responsive layouts
- Interactive elements
- Sample data
- Chart visualizations

## Next Steps

1. **Backend Integration**
   - Connect to REST APIs
   - Setup authentication
   - Add data persistence

2. **AI Integration**
   - Connect ML models for recommendations
   - Implement policy NLP analysis
   - Add forecasting algorithms

3. **Database Setup**
   - PostgreSQL for structured data
   - MongoDB for documents
   - Redis for caching

4. **Deployment**
   - Deploy to Vercel (recommended)
   - Or use Docker containers
   - Setup CI/CD pipeline

## Common Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Troubleshooting

### Port 3000 already in use
```bash
# Kill the process using port 3000
npx kill-port 3000

# Or use a different port
PORT=3001 npm run dev
```

### Module not found errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

### TypeScript errors
The project is fully typed. If you see TypeScript errors, make sure you're using TypeScript 5.4+:
```bash
npx tsc --version
```

## Support

For questions or issues with the frontend implementation, refer to:
- Next.js docs: https://nextjs.org/docs
- Tailwind CSS docs: https://tailwindcss.com/docs
- TypeScript docs: https://www.typescriptlang.org/docs

---

**Ready to start?** Run `npm install` followed by `npm run dev`! 🚀
