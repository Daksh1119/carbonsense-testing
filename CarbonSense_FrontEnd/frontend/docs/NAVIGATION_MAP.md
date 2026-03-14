# CarbonSense Navigation Map

## Overview

Complete navigation architecture for the CarbonSense platform with all 17 pages connected through intuitive user flows.

---

## 🏠 Core Navigation Structure

### Landing & Authentication

```
Landing Page (/)
        │
        ├─→ Login (/login)
        └─→ Register (/register)
                │
                ▼
        Dashboard (/dashboard)
```

---

## 📊 Dashboard Hub (Central Navigation Point)

### Primary Actions from Dashboard

#### 1. Add Emission Button

- **Location**: Top-right header
- **Action**: `router.push('/emissions')`
- **Icon**: Plus icon
- **Purpose**: Quick access to log new carbon activity

#### 2. View Detailed Log Button

- **Location**: Below main chart (Carbon Path section)
- **Action**: `router.push('/detailed-log')`
- **Icon**: Eye icon
- **Label**: "View Detailed Log"

#### 3. View Analytics Button

- **Location**: Carbon Path card header
- **Action**: `router.push('/analytics')`
- **Icon**: Eye icon
- **Label**: "View Analytics"

#### 4. View Recommendations Button

- **Location**: Strategy Comparison card header
- **Action**: `router.push('/recommendations')`
- **Icon**: Eye icon
- **Label**: "View All"

#### 5. View Policy Intelligence Button

- **Location**: Policy Snapshot card header
- **Action**: `router.push('/policy-intelligence')`
- **Icon**: External link icon
- **Label**: "View All Policies"

#### 6. Policy Alert Cards (Clickable)

- **Location**: Policy Snapshot section
- **Action**: `router.push('/policy-intelligence')`
- **Purpose**: Quick access to specific policy details

---

## 🎯 Complete Page Navigation Map

### 1. Dashboard (`/dashboard`)

**Navigation Elements:**

- ✅ Breadcrumb: Home → Dashboard
- ✅ Add Emission → `/emissions`
- ✅ View Detailed Log → `/detailed-log`
- ✅ View Analytics → `/analytics`
- ✅ View Recommendations → `/recommendations`
- ✅ View Policies → `/policy-intelligence`

---

### 2. Emissions Entry (`/emissions`)

**Navigation Elements:**

- ✅ Breadcrumb: Dashboard → Emissions
- ✅ Cancel button → `/dashboard`
- ✅ Back button → `/dashboard` (step 1) or Previous Step
- ✅ Save & Complete → Success toast + `/dashboard`

**Form Flow:**

```
Step 1: Transport
Step 2: Energy
Step 3: Food & Waste
Step 4: Review
        │
        ▼
Save + Redirect to Dashboard
```

**Features:**

- Multi-step wizard (4 steps)
- Validation before submission
- Success toast on save
- Error toast on validation failure

---

### 3. Detailed Emissions Log (`/detailed-log`)

**Navigation Elements:**

- ✅ Breadcrumb: Dashboard → Detailed Log
- ✅ Back to Dashboard button
- ✅ Log New Activity → `/emissions`

**Table Actions:**

- View: Shows info toast with activity details
- Edit: Shows info toast (future: navigate to `/emissions/edit/[id]`)
- Delete: Shows error confirmation toast
- Export: Shows success toast

**Features:**

- Category filters (all/transport/energy/food/waste/purchases)
- Search functionality
- Pagination (10 rows per page)
- Sort by any column
- Summary statistics footer

---

### 4. Analytics & Simulation (`/analytics`)

**Navigation Elements:**

- ✅ Breadcrumb: Dashboard → Analytics
- ✅ Back to Dashboard button

**Features:**

- Interactive charts with tooltips
- Stats cards grid
- Category breakdown
- Monthly trend analysis
- Scope-based distribution

---

### 5. Tree Engine (TEME) (`/tree-engine`)

**Navigation Elements:**

- ✅ Breadcrumb: Dashboard → Tree Engine
- ✅ Back button
- NEW PROJECT button (creates tree planting project)

**Features:**

- Time-debt analysis
- Species recommendations
- Survival-weighted calculations
- Cost estimation

---

### 6. Policy Intelligence (`/policy-intelligence`)

**Navigation Elements:**

- ✅ Breadcrumb: Dashboard → Policy Intelligence
- ✅ Back button
- Export Compliance Report button

**Features:**

- Policy alerts with urgency badges
- Funding opportunities
- CCUS eligibility banner
- Completed actions history

---

### 7. Compliance Command (`/compliance`)

**Navigation Elements:**

- ✅ Breadcrumb: Dashboard → Compliance
- ✅ Back button
- Export Audit Trail button

**Features:**

- Compliance task tracking
- Progress bars
- Status badges (overdue/in-progress/completed)
- Deadline countdown

---

### 8. Personalized Recommendations (`/recommendations`)

**Navigation Elements:**

- ✅ Breadcrumb: Dashboard → Recommendations
- ✅ Back to Dashboard button

**Features:**

- AI-ranked recommendations
- Impact analysis
- Certainty scores
- Implementation steps
- Cost-benefit analysis

---

### 9. Settings (`/settings`)

**Navigation Elements:**

- ✅ Breadcrumb: Dashboard → Settings
- ✅ Back to Dashboard button

**Features:**

- Tabbed interface (6 tabs)
- Profile management
- Organization settings
- Notifications preferences
- Security settings
- Integrations
- Data management

---

## 🧭 Sidebar Navigation

All pages accessible via persistent sidebar:

```
Dashboard        → /dashboard
Emissions        → /emissions
Detailed Log     → /detailed-log
Analytics        → /analytics
Tree Engine      → /tree-engine
Policy Intel     → /policy-intelligence
Compliance       → /compliance
Recommendations  → /recommendations
Team             → /team (future)
Settings         → /settings
```

---

## 🍞 Breadcrumb System

### Auto-generated Breadcrumbs

All pages include automatic breadcrumb generation based on route:

```typescript
Dashboard
Dashboard → Emissions
Dashboard → Detailed Log
Dashboard → Analytics
Dashboard → Policy Intelligence
```

### Custom Breadcrumbs

Can be manually overridden with:

```typescript
<Breadcrumb items={[
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Custom Page', href: '/custom' }
]} />
```

---

## ⬅️ Back Button System

### Back Button Component

Reusable component with variants:

```typescript
// Go back to specific route
<BackButton href="/dashboard" label="Back to Dashboard" />

// Use browser history
<BackButton label="Go Back" />

// Different variants
<BackButton variant="outline" />  // Border with transparent bg
<BackButton variant="ghost" />    // No border, transparent bg
<BackButton variant="primary" />  // Filled button
```

### Back Button Locations

- All secondary pages (Analytics, TEME, Policy, etc.)
- Detailed Log page
- Emissions form page
- Settings page

---

## 🎨 Navigation Components

### 1. Breadcrumb Component

**Location:** `components/navigation/Breadcrumb.tsx`

```typescript
<Breadcrumb />  // Auto-generates from URL
<Breadcrumb showHome={false} />  // Hide home icon
<Breadcrumb items={customItems} />  // Custom path
```

### 2. BackButton Component

**Location:** `components/navigation/BackButton.tsx`

```typescript
<BackButton />  // Default: router.back()
<BackButton href="/dashboard" />  // Specific route
<BackButton variant="outline" showIcon={false} />  // No arrow icon
```

---

## 🔄 Common User Journeys

### Journey 1: Log New Emission

```
Dashboard
  → Click "Add Emission"
  → Fill Transport Details (Step 1)
  → Fill Energy Details (Step 2)
  → Fill Food & Waste (Step 3)
  → Review (Step 4)
  → Save & Complete
  → Success Toast
  → Redirect to Dashboard
```

### Journey 2: View Emissions History

```
Dashboard
  → Click "View Detailed Log"
  → Filter by Category (e.g., Transport)
  → Search for specific activity
  → Click "View" action
  → View details in toast
  → Click "Back to Dashboard"
  → Return to Dashboard
```

### Journey 3: Analyze Carbon Footprint

```
Dashboard
  → Click "View Analytics"
  → Review monthly trends
  → Check category breakdown
  → Identify high-emission areas
  → Click "Back to Dashboard"
  → Navigate to Recommendations
  → Review AI suggestions
```

### Journey 4: Check Policy Compliance

```
Dashboard
  → See Policy Alerts (2 active)
  → Click "View All Policies"
  → Review urgent deadlines
  → Check funding opportunities
  → Navigate to Compliance Command
  → Track task progress
  → Export audit trail
```

---

## 📱 Responsive Navigation

### Mobile Considerations

- Hamburger menu for sidebar (future enhancement)
- Stacked breadcrumbs on narrow screens
- Floating action button for quick actions
- Bottom navigation bar (alternative)

---

## 🚀 Future Navigation Enhancements

### Planned Features

1. **Global Search**
   - Search bar in navbar
   - Quick jump to any page
   - Search emissions, policies, team members

2. **Keyboard Shortcuts**
   - `Cmd/Ctrl + K` → Quick search
   - `Cmd/Ctrl + B` → Back to dashboard
   - `Cmd/Ctrl + E` → New emission
   - `Esc` → Close modals

3. **Recent Pages**
   - Track last 5 visited pages
   - Quick access dropdown in navbar

4. **Page Transitions**
   - Framer Motion animations
   - Fade in/out effects
   - Smooth route changes

5. **Deep Linking**
   - Share specific emission entries (`/emissions/123`)
   - Link to filtered views (`/detailed-log?category=transport`)
   - Team member detail pages (`/team/[id]`)

---

## ✅ Navigation Checklist

### Completed ✓

- [x] Breadcrumb component created
- [x] BackButton component created
- [x] Dashboard action buttons connected
- [x] Emissions form navigation working
- [x] Detailed Log actions functional
- [x] All secondary pages have breadcrumbs
- [x] All pages have back buttons
- [x] Toast notifications on actions
- [x] Form submission redirects
- [x] Router navigation throughout

### Pending

- [ ] Protected routes (authentication required)
- [ ] Role-based navigation (Manager/SME/Viewer)
- [ ] Global search implementation
- [ ] Keyboard shortcuts
- [ ] Page transitions
- [ ] Deep linking for routes
- [ ] Team management navigation
- [ ] User profile navigation

---

## 🛠️ Technical Implementation

### Router Usage

```typescript
import { useRouter } from "next/navigation";

const router = useRouter();

// Navigate to page
router.push("/dashboard");

// Go back
router.back();

// Replace current page (no history entry)
router.replace("/login");
```

### Toast Notifications

```typescript
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast";

// Success
showSuccessToast("Emission saved successfully!");

// Error
showErrorToast("Please fill all required fields");

// Info
showInfoToast("Viewing details for Transport activity");
```

---

## 📊 Navigation Analytics (Future)

Track user navigation patterns:

- Most visited pages
- Average time per page
- Drop-off points in forms
- Most used navigation paths
- Dead-end pages

---

## 🎯 Best Practices

### Do's ✓

- Always provide breadcrumbs on secondary pages
- Include back buttons for easy navigation
- Show success toasts after actions
- Use loading states during navigation
- Validate forms before navigation
- Clear error states before redirecting

### Don'ts ✗

- Don't navigate without user confirmation on destructive actions
- Don't redirect without showing success/error feedback
- Don't create circular navigation loops
- Don't hide the back button on complex forms
- Don't skip loading states on slow actions

---

## 📝 Navigation Testing Checklist

Test each flow:

- [ ] Click every button and verify navigation
- [ ] Test breadcrumb links work correctly
- [ ] Verify back buttons go to correct pages
- [ ] Check form submissions redirect properly
- [ ] Test cancel buttons return to source
- [ ] Verify table actions show appropriate feedback
- [ ] Test empty state CTAs navigate correctly
- [ ] Check error state retry buttons work
- [ ] Verify deleted items don't navigate to detail pages

---

## 📞 Contact & Support

For navigation issues or questions:

- Review this documentation
- Check browser console for errors
- Verify all imports are correct
- Test in isolated environment

---

**Last Updated:** March 6, 2026
**Version:** 1.0 (Navigation Implementation Complete)
