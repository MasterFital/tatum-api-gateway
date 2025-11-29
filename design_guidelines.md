# Design Guidelines: Tatum API Gateway Dashboard

## Design Approach

**System-Based Design**: Carbon Design System with Linear-inspired data tables and Stripe-level developer clarity. This is an enterprise-grade B2B developer tool requiring maximum information density and operational efficiency.

## Core Design Principles

1. **Information First**: Prioritize data visibility over decorative elements
2. **Developer-Centric**: Technical precision and clarity trump visual flair
3. **Scan-Optimized**: Users need to process large amounts of data quickly
4. **Action-Oriented**: Every screen enables immediate workflow completion

## Typography

**Font Family**: 
- Primary: IBM Plex Sans (system font via CDN)
- Monospace: IBM Plex Mono (for API keys, addresses, hashes)

**Hierarchy**:
- Page Titles: 28px/semibold
- Section Headers: 20px/semibold
- Card Headers: 16px/semibold
- Body Text: 14px/regular
- Captions/Meta: 12px/regular
- Code/Technical: 13px/mono

## Layout System

**Spacing Units**: Tailwind 2, 4, 6, 8, 12, 16 (keep palette tight)
- Component padding: p-4 or p-6
- Section spacing: mb-8 or mb-12
- Card gaps: gap-4
- Dense tables: p-2

**Grid Structure**:
- Sidebar: 240px fixed width
- Main content: max-w-7xl with responsive padding
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Data tables: full-width scrollable containers

## Component Library

### Navigation
- **Sidebar**: Fixed left, full-height, hierarchical nav with icons
- **Top Bar**: Tenant selector dropdown, search, notifications bell, user avatar
- **Breadcrumbs**: Always visible for deep navigation paths

### Data Display
- **Tables**: Stripe-style with alternating row backgrounds, sortable headers, sticky column headers
- **Status Badges**: Small pills with dot indicators (Active: green, Pending: yellow, Failed: red, Inactive: gray)
- **Metric Cards**: Large number (24px/bold), label below (12px/gray), sparkline chart when relevant
- **Code Blocks**: Dark background with syntax highlighting, copy button top-right

### Forms
- **Input Fields**: Label above, helper text below, validation inline
- **Dropdowns**: Native-style selectors with search for long lists
- **Multi-select**: Pill-style selected items with × remove
- **Date Pickers**: Calendar overlay, range selection support

### Overlays
- **Modals**: Centered, max-w-2xl, close button, footer actions right-aligned
- **Toasts**: Top-right corner, auto-dismiss 5s, action buttons when needed
- **Tooltips**: Small, appear on hover, concise technical context

### Charts (Recharts)
- **Line Charts**: Trends over time (requests, costs)
- **Bar Charts**: Endpoint comparison, usage by chain
- **Pie Charts**: Distribution (minimal use)
- All charts: Gridlines subtle, axes labeled, interactive tooltips

### Buttons
- **Primary**: Solid, used for main actions
- **Secondary**: Outlined, for alternative actions  
- **Tertiary**: Text-only, for less important actions
- **Danger**: Red, for destructive actions (delete, suspend)
- Sizes: sm (forms), md (standard), lg (CTAs)

## Layout Patterns

### Dashboard Homepage
- Top: 4-column metric cards (Total Requests, Credits Consumed, Active Webhooks, Estimated Cost)
- Middle: Row with line chart (full-width) showing requests over time
- Bottom: Two-column layout - Recent Transactions table (left) + Activity Log (right)

### List Pages (Tenants, Addresses, Transactions)
- Top bar: Search input (left), Filters button, Create button (right)
- Filter panel: Slides in from right when active
- Table: Full-width, paginated footer, row actions (dropdown menu)

### Detail Pages (Tenant Details, Address Details)
- Three-column layout: Info cards (left sidebar 1/4), Main content (center 2/4), Related items (right 1/4)
- Tab navigation for multiple data views
- Action buttons in header (Edit, Delete, Suspend)

### Analytics Page
- Date range picker top-right
- Grid of filterable charts (2 columns on desktop)
- Export CSV button

### Billing Page  
- Current month summary card (prominent at top)
- Cost breakdown table with expand/collapse rows
- Tier comparison table
- Upgrade CTA card (if applicable)

## Visual Treatment Notes

- **NO color specifications** - handled separately
- Maintain high information density - avoid excessive whitespace
- Tables are primary data display - make them excellent
- Forms should be compact but not cramped
- Charts use consistent styling across app
- Icons from Heroicons (outline style)

## Critical UX Patterns

- **Copy-to-clipboard**: Every API key, address, hash has instant copy button
- **Inline editing**: Click-to-edit for simple fields (labels, tags)
- **Bulk actions**: Select multiple rows for batch operations
- **Smart defaults**: Pre-fill common values, remember user preferences
- **Loading states**: Skeleton screens for tables, spinners for actions
- **Empty states**: Helpful illustrations + CTA to create first item
- **Error states**: Clear error messages with resolution steps

## Accessibility

- All form inputs have visible labels
- Focus states clearly visible on all interactive elements  
- Color not sole indicator of status (use icons + text)
- Keyboard navigation works throughout
- Screen reader-friendly table markup

## Images

**No hero images or marketing visuals.** This is a pure utility dashboard.

Only functional images:
- Empty state illustrations (simple line drawings)
- User avatars (circular, 32px)
- QR codes (generated for addresses)
- Logos (tenant logos in top-bar selector)