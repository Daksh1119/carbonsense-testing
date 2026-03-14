# CarbonSense - Carbon Intelligence Platform

A modern Next.js 14 application for tracking, analyzing, and managing carbon emissions with AI-powered recommendations and intelligent policy compliance.

## 🌳 Overview

CarbonSense is an enterprise-grade carbon management platform that helps organizations track their carbon footprint, manage team emissions data, ensure regulatory compliance, and receive AI-powered recommendations for carbon reduction. The platform features a Tree-Emission Matching Engine (TEME) for scientific offset modeling and comprehensive policy intelligence.

## ✨ Core Features

### 🏠 **Executive Dashboard**

- Real-time emissions overview with key performance indicators
- Quick action cards for frequently used features
- Visual trend analysis with interactive charts
- Target tracking and progress monitoring

### 📊 **Emissions Tracking**

Multi-step emissions entry workflow:

- **Step 1: Transport** - Vehicle emissions with fuel type calculations
- **Step 2: Energy** - Electricity and energy consumption tracking
- **Step 3: Waste** - Waste disposal impact measurement
- **Step 4: Review** - Summary and submission with total CO₂ calculations

### 📈 **Analytics & Simulation**

- Deep insights into emissions patterns
- Trend forecasting and scenario modeling
- Comparative analysis by category, department, time period
- Export capabilities for reports

### 🤖 **Personalized Recommendations**

- AI-powered carbon reduction suggestions
- Impact-ranked action plans
- Implementation guides and best practices
- Progress tracking for implemented actions

### 🌳 **Tree-Emission Matching Engine (TEME)**

- Scientific tree species selection for optimal CO₂ absorption
- Time-debt analysis for offset planning
- Geographic suitability matching
- Growth rate and maintenance considerations

### 📜 **Policy Intelligence**

- AI-powered policy analysis and tracking
- Regulatory requirement monitoring
- Deadline management and alerts
- Policy impact assessments

### ⚖️ **Compliance Command**

- Regulatory compliance tracking by region
- Automated deadline reminders
- Documentation management
- Audit trail and reporting

### 👥 **Team Management**

Complete team collaboration features:

- Member invitation and role management
- Bulk CSV import for large teams
- Granular permissions control
- Activity tracking and audit logs

### ⚙️ **Settings & Configuration**

- Organization settings
- User profile management
- SME (Small & Medium Enterprise) settings
- Data management and export
- Integration configurations
- Security and API settings

## 🚀 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Charts:** Recharts
- **Icons:** Lucide React
- **File Upload:** React Dropzone
- **Notifications:** React Hot Toast
- **Font:** Space Grotesk (Google Fonts)

## 📁 Project Structure

```
frontend/
├── app/
│   ├── (dashboard)/              # Dashboard routes with shared layout
│   │   ├── layout.tsx            # Shared sidebar + navbar layout
│   │   ├── dashboard/            # Executive dashboard
│   │   ├── emissions/            # Multi-step emissions tracking
│   │   │   ├── page.tsx         # Category selection
│   │   │   ├── transport/       # Step 1: Transport emissions
│   │   │   ├── energy/          # Step 2: Energy emissions
│   │   │   ├── waste/           # Step 3: Waste emissions
│   │   │   └── review/          # Step 4: Review & submit
│   │   ├── analytics/            # Analytics dashboard
│   │   ├── recommendations/      # AI recommendations
│   │   ├── tree-engine/         # TEME interface
│   │   ├── policy-intelligence/ # Policy tracking
│   │   ├── compliance/          # Compliance management
│   │   ├── team-management/     # Team collaboration
│   │   │   ├── page.tsx        # Team member list
│   │   │   ├── add-member/     # Individual invitation
│   │   │   ├── bulk-import/    # CSV bulk import
│   │   │   └── edit-permissions/[id]/ # Permission management
│   │   ├── data-ingestion/      # Bulk data upload
│   │   ├── detailed-log/        # Emissions history log
│   │   └── settings/            # Platform settings
│   ├── test/                    # Phase testing pages
│   ├── phase4-demo/             # Auth demo page
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Root redirect
│   └── globals.css              # Global styles + theme variables
├── components/
│   ├── ui/
│   │   ├── Sidebar.tsx          # 9-item navigation sidebar
│   │   ├── Navbar.tsx           # Top navigation with user menu
│   │   ├── DashboardCard.tsx    # Reusable card component
│   │   ├── StatsCard.tsx        # Metrics display card
│   │   ├── Badge.tsx            # Status/role badges
│   │   ├── Button.tsx           # Primary button component
│   │   ├── ProgressBar.tsx      # Progress indicator
│   │   ├── FileUpload.tsx       # Drag-and-drop file upload
│   │   └── LoadingSpinner.tsx   # Loading states
│   └── navigation/
│       ├── Breadcrumb.tsx       # Breadcrumb navigation
│       └── BackButton.tsx       # Back navigation button
├── store/
│   ├── useUserStore.ts          # User authentication state
│   └── useUIStore.ts            # UI state (sidebar, theme)
├── hooks/
│   ├── useAuth.ts               # Authentication hook
│   └── useLocalStorage.ts       # Local storage hook
├── lib/
│   ├── toast.ts                 # Toast notification utilities
│   ├── utils.ts                 # Helper functions
│   └── types.ts                 # Shared TypeScript types
├── types/
│   └── index.ts                 # Global type definitions
├── services/
│   └── api.ts                   # API service layer (future)
├── docs/
│   └── NAVIGATION_MAP.md        # Navigation structure reference
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
├── next.config.mjs              # Next.js configuration
├── package.json                 # Dependencies
└── README.md                    # This file
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Quick Start

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Amoghiyer31/CarbonSense_FrontEnd.git
   cd CarbonSense_FrontEnd
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Run the development server:**

   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

### Lint Code

```bash
npm run lint
```

## TEME Backend Switch

The TEME module supports two modes so development can continue even when the external backend is unavailable.

- Mock mode (local): Use the internal Next.js route at /api/teme/run
- Real backend mode: Use external POST /teme/run endpoint

Environment variables in .env.local:

- NEXT_PUBLIC_USE_TEME_MOCK=true enables local mock mode
- NEXT_PUBLIC_USE_TEME_MOCK=false disables mock mode
- NEXT_PUBLIC_API_URL=http://localhost:8000 sets the external backend base URL

Recommended flow:

1. Keep NEXT_PUBLIC_USE_TEME_MOCK=true while UI and Supabase integration are being developed.
2. Switch to NEXT_PUBLIC_USE_TEME_MOCK=false when the real backend is live.
3. Restart npm run dev after changing .env.local values.

## GitHub Push Guide

Repository URL:

- https://github.com/Amoghiyer31/CarbonSense_FrontEnd

From the repository root:

```bash
git add .
git commit -m "feat: update CarbonSense frontend"
git push origin main
```

If this is a fresh clone or remote is not configured:

```bash
git init
git remote add origin https://github.com/Amoghiyer31/CarbonSense_FrontEnd.git
git branch -M main
git add .
git commit -m "feat: initial CarbonSense frontend push"
git push -u origin main
```

## 🎨 Design System

### Color Palette

- **Primary (Cyan):** `#0bd5b0` - Main brand color
- **Background (Dark Navy):** `#0a0f18` - Main background
- **Navy Muted:** `#16252d` - Card backgrounds
- **Navy Border:** `#1e3a3a` - Borders and dividers
- **Slate:** `#64748b` - Secondary text
- **White:** `#ffffff` - Primary text

### Typography

- **Font Family:** Space Grotesk (Google Fonts)
- **Font Weights:** 300 (Light), 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

### Component Design

All components follow these principles:

- **Dark theme by default** with glass-morphism effects
- **Consistent spacing** using Tailwind's spacing scale
- **Responsive design** with mobile-first approach
- **TypeScript type safety** for all props and state
- **Accessible** with proper ARIA labels and keyboard navigation

### Badge Variants

- **Success (Green):** Active status, positive metrics
- **Warning (Yellow):** Pending actions, moderate alerts
- **Danger (Red):** Errors, critical warnings
- **Info (Blue):** Informational content
- **Default (Gray):** Neutral status

## 🗺️ Navigation Architecture

### Sidebar (9 Main Modules)

```
🏠 Dashboard
📊 Emissions
📈 Analytics
🤖 Recommendations
🌳 TEME
📜 Policy Intelligence
⚖️ Compliance
👥 Team
⚙️ Settings
```

### Dashboard Quick Actions

Secondary features accessible from dashboard:

- **Data Ingestion** - Bulk CSV/receipt upload
- **Detailed Log** - View emissions history
- **Team Management** - Manage team members

### Secondary Pages (Nested Navigation)

- **Team Management:**
  - `/team-management` - Member list
  - `/team-management/add-member` - Invite individual
  - `/team-management/bulk-import` - CSV bulk import
  - `/team-management/edit-permissions/[id]` - Edit member permissions

- **Emissions:**
  - `/emissions` - Category selection
  - `/emissions/transport` - Transport entry
  - `/emissions/energy` - Energy entry
  - `/emissions/waste` - Waste entry
  - `/emissions/review` - Review & submit

- **Settings:**
  - Organization settings
  - User profile
  - SME settings
  - Notifications
  - Integrations
  - Data management

## 🔑 Key Technologies Explained

### Next.js App Router

- File-based routing with nested layouts
- Server Components by default
- Automatic code splitting
- Built-in optimization

### Zustand State Management

- Lightweight alternative to Redux
- Simple API with hooks
- Persistent state with localStorage
- TypeScript-first design

### Tailwind CSS

- Utility-first CSS framework
- Custom design system via config
- Responsive design utilities
- Dark mode support

### React Hot Toast

- Beautiful toast notifications
- Customizable styling
- Success, error, info variants
- Auto-dismiss with timing control

## 📊 Features In Detail

### Multi-Step Emissions Form

The emissions tracking uses a 4-step wizard:

1. **Category Selection** - Choose emission type
2. **Data Entry** - Fill in activity details with live CO₂ calculation
3. **Additional Categories** - Add more emission sources
4. **Review & Submit** - Confirm all entries

### Team Permission System

Granular permission levels:

- **Admin** - Full system access
- **Manager** - Team and data management
- **Analyst** - View and export data
- **Data Entry Specialist** - Enter emissions only
- **Viewer** - Read-only access

### Data Ingestion Modes

- **CSV Upload** - Bulk emissions data import
- **Receipt Upload** - OCR extraction from receipts
- **Bank Statement** - Automated transaction analysis

## 🚧 Development Notes

### Known Development Features

- Mock data used for demonstrations
- Authentication system (UI ready, backend pending)
- API integration layer prepared in `/services`
- Real-time calculations use placeholder emission factors

### Future Enhancements

- Backend API integration
- Real-time collaboration features
- Advanced AI recommendations
- Mobile native app
- Export to PDF reports
- Multi-language support

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 👨‍💻 Author

**Amogh Iyer**

- GitHub: [@Amoghiyer31](https://github.com/Amoghiyer31)
- Repository: [CarbonSense_FrontEnd](https://github.com/Amoghiyer31/CarbonSense_FrontEnd)

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

**Built with ❤️ for a sustainable future**

## 🧩 Key Components

### Layout Components

- `Sidebar` - Navigation with active state tracking
- `Navbar` - Search, notifications, and user profile
- `DashboardCard` - Container for content sections

### UI Components

- `StatsCard` - Display key metrics with icons
- `Badge` - Status indicators (success, warning, danger, info)
- `Button` - Styled buttons with variants
- `ProgressBar` - Visual progress indicators

## 📊 Pages Overview

### Dashboard (`/dashboard`)

- Total emissions stats
- Carbon path visualization (2024-2026)
- Strategy comparison (Reduction vs Tree Planting)
- Policy alerts and funding opportunities

### Emissions (`/emissions`)

- Multi-step data entry form
- Activity categories (Transport, Energy, Food, Review)
- Real-time CO₂ impact calculation
- Progress tracking

### Tree Engine (`/tree-engine`)

- Time-debt analysis graph
- Species recommendations with survival rates
- Active planting projects
- Scientific offset modeling

### Policy Intelligence (`/policy-intelligence`)

- CCUS eligibility banner
- Active compliance requirements
- Funding opportunities
- Completed actions audit trail

### Compliance (`/compliance`)

- Compliance task overview
- Deadline tracking
- Progress monitoring
- Audit trail export

### Analytics (`/analytics`)

- Emissions by category (pie chart)
- Scope analysis (bar chart)
- Monthly trend (line chart)
- Statistical insights

### Recommendations (`/recommendations`)

- AI-powered action plans
- Impact and certainty ratings
- Implementation steps
- Cost-benefit analysis

### Settings (`/settings`)

- Profile management
- Organization settings
- Notification preferences
- Security settings
- Integrations

## 🔧 Utility Functions

Located in `lib/utils.ts`:

- `formatNumber()` - Format numbers with commas
- `formatCurrency()` - Format currency in INR
- `formatDate()` - Format dates
- `formatCO2()` - Format CO₂ amounts
- `daysRemaining()` - Calculate days until deadline
- `getUrgencyColor()` - Get color based on urgency

## 📝 Type Definitions

All TypeScript types are defined in `types/index.ts`:

- `EmissionEntry`, `EmissionsSummary`
- `TreeSpecies`, `PlantingProject`, `TimeDebtData`
- `PolicyAlert`, `FundingOpportunity`, `ComplianceTask`
- `Recommendation`, `User`, `Organization`
- `AnalyticsData`, `Notification`

## 🎯 Future Enhancements

- Backend API integration
- Real-time data sync
- User authentication
- Database integration (PostgreSQL/MongoDB)
- AI/ML model integration
- Mobile app (React Native)
- Blockchain audit trail

## 📄 License

Private project - All rights reserved

## 👨‍💻 Developer

Frontend implementation for CarbonSense Carbon Intelligence Platform

---

**Note:** This is a frontend implementation. Backend APIs, AI models, and database integrations need to be developed separately.
