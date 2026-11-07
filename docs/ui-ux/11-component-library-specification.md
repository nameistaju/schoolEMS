# SchoolEMS — Component Library Specification

**Document Version:** 1.0.0 (Revised)  
**Status:** APPROVED COMPONENT LIBRARY SPECIFICATION  
**Design System Reference:** `docs/ui-ux/05-design-system.md`  
**Accessibility Reference:** `docs/ui-ux/10-accessibility-guidelines.md`  
**Target Platform:** React 18.3.1 / React Router DOM 6.30.6 / Vanilla CSS Design Tokens (Local-First)  

---

## 1. Executive Summary & Component Architecture

The SchoolEMS Component Library is an accessible, high-density component suite engineered for school operations across administrator desktops, teacher tablets, and parent mobile browsers.

### 1.1 Architectural Principles
1. **Semantic HTML First:** Components prioritize native semantic HTML elements (`<button>`, `<input>`, `<table>`, `<dialog>`) ensuring baseline accessibility, predictable tab routing, and zero third-party bundle bloat.
2. **Design-Token Bound:** All component styles consume CSS custom properties defined in `05-design-system.md` (e.g. `var(--color-brand-600)`, `var(--table-row-h-compact)`). Zero hardcoded hex colors or arbitrary pixel values in component files.
3. **Composability:** Complex surfaces (Modals, Dropdowns, Tables) are authored as compound components (`Table`, `Table.Header`, `Table.Row`, `Table.Cell`) to support flexible layout extension.
4. **Current Dependency Baseline:** Uses strictly installed dependencies (`react@18.3.1`, `react-dom@18.3.1`, `react-router-dom@6.30.6`). External UI libraries (such as headless grid or animation packages) must be evaluated on necessity and require approval prior to installation.

---

## 2. Component Taxonomy & Directory Structure

Components reside in `projects/school-management/frontend/src/components/ui/`:

```
frontend/src/components/ui/
├── primitives/
│   ├── Button/           # Action buttons, icon buttons, button groups
│   ├── Input/            # Text, number, password, search inputs
│   ├── Textarea/         # Multi-line text input
│   ├── Select/           # Accessible dropdown selector
│   ├── Checkbox/         # Accessible checkbox
│   ├── Radio/            # Radio button group
│   └── Badge/            # Semantic status and role badges
├── layout/
│   ├── Card/             # Elevation and bordered content containers
│   ├── Modal/            # Trapped-focus accessible dialog window
│   ├── Drawer/           # Slide-over inspection sheet
│   ├── Tabs/             # Accessible tabbed navigation
│   └── Divider/          # Structural separators
├── feedback/
│   ├── Toast/            # Auto-dismissing notifications
│   ├── Alert/            # In-page operational banners
│   ├── Skeleton/         # Shimmer loaders for tables, forms, and cards
│   └── EmptyState/       # Zero-data feedback with actions
├── datatable/
│   ├── DataTable/        # High-density native HTML table engine
│   ├── Pagination/       # Accessible page stepper and size selector
│   ├── TableFilter/      # Column search and active filter pills
│   └── BatchActions/     # Contextual multi-record action bar
└── school-specialized/
    ├── AttendancePill/   # Keyboard-markable P/A/L status pill
    ├── FeeCounterCard/   # Installment ledger summary (Release 2)
    └── StudentAvatar/    # Fallback initials avatar with status indicator
```

---

## 3. Core Component Specifications

### 3.1 Button & IconButton (`ui/primitives/Button`)

#### Props Interface
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}
```

#### Dimensions
| Size | Height | Padding X | Font Size |
| :--- | :--- | :--- | :--- |
| `sm` | 32px | 10px | 13px (0.8125rem) |
| `md` | 38px | 16px | 14px (0.875rem) |
| `lg` | 44px | 20px | 15px (0.9375rem) |

---

### 3.2 Input & FormField (`ui/primitives/Input`)

#### Purpose
Text, phone, email, date, and numerical data entry with inline error binding and accessible labels.

#### DOM & ARIA Structure
```html
<div class="form-field-group">
  <label for="student-admission-no" class="form-label">
    Admission Number <span class="required-mark" aria-hidden="true">*</span>
  </label>
  <div class="input-container">
    <input
      id="student-admission-no"
      type="text"
      class="text-input"
      aria-required="true"
      aria-invalid="false"
      aria-describedby="student-admission-no-help"
      value="ADM-2026-0042"
    />
  </div>
  <p id="student-admission-no-help" class="form-help-text">
    Unique sequential institutional admission number.
  </p>
</div>
```

---

### 3.3 Modal / Dialog (`ui/layout/Modal`)

#### Purpose
Confirmation dialogs and structured sub-task workflows.

#### Compound Architecture
```jsx
<Modal isOpen={isOpen} onClose={handleClose} titleId="modal-title">
  <Modal.Header>
    <Modal.Title id="modal-title">Confirm Attendance Submission</Modal.Title>
    <Modal.CloseButton />
  </Modal.Header>
  <Modal.Body>
    <p>You are submitting attendance for Class 8-A: 38 Present, 2 Absent.</p>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={handleClose}>Back to Edit</Button>
    <Button variant="primary" onClick={handleConfirm}>Confirm & Submit</Button>
  </Modal.Footer>
</Modal>
```

#### Focus & Screen Reader Rules
1. Focus is trapped within modal boundaries while open.
2. Pressing `Escape` triggers `onClose`.
3. Background document scroll is locked (`overflow: hidden`) during modal lifecycle.
4. On unmount, focus returns to the initiating trigger button.

---

### 3.4 StatusBadge (`ui/primitives/Badge`)

#### Purpose
Displays semantic status across student records, attendance, and fee invoices. Adheres strictly to non-color differentiation by pairing colors with typographic labels and SVG icons.

| Status | Background Token | Text Token | Icon Glyph | Text Label |
| :--- | :--- | :--- | :--- | :--- |
| `ACTIVE` | `var(--color-success-bg)` | `var(--color-success-text)` | Check (✓) | `Active` |
| `PRESENT` | `var(--color-success-bg)` | `var(--color-success-text)` | Dot (●) | `Present` |
| `ABSENT` | `var(--color-danger-bg)` | `var(--color-danger-text)` | Ring (○) | `Absent` |
| `LATE` | `var(--color-warning-bg)` | `var(--color-warning-text)` | Clock (◷) | `Late` |
| `PAID` | `var(--color-success-bg)` | `var(--color-success-text)` | Check (✓) | `Paid` |
| `OVERDUE`| `var(--color-danger-bg)` | `var(--color-danger-text)` | Alert (⚠) | `Overdue` |

---

### 3.5 DataTable Engine (`ui/datatable/DataTable`)

#### Purpose
Enterprise operational table engine rendering paginated registers using native HTML `<table>` elements and CSS design tokens.

#### Core Capabilities
1. **Density Switching:** Switches between `compact` (34px), `default` (44px), and `comfortable` (54px) via CSS variables.
2. **Sticky Header & Frozen Columns:** Header remains fixed vertically; primary identification column remains pinned horizontally (`position: sticky; left: 0`).
3. **Sortable Columns:** Tri-state sorting (`asc` -> `desc` -> `none`) with `aria-sort` attributes.
4. **Server-Side Pagination:** Integrated page stepper and page size selector (`25`, `50`, `100`).
5. **Batch Action Bar:** Multi-row selection with indeterminate checkbox state and contextual actions.

#### Props Interface
```typescript
interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  width?: string;
  isPinned?: 'left' | 'right';
  isSortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  density?: 'compact' | 'default' | 'comfortable';
  onDensityChange?: (density: 'compact' | 'default' | 'comfortable') => void;
  isLoading?: boolean;
  totalRecords?: number;
  pagination?: {
    pageIndex: number;
    pageSize: number;
    onPageChange: (newPage: number) => void;
    onPageSizeChange: (newSize: number) => void;
  };
  selection?: {
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
  };
  emptyState?: React.ReactNode;
}
```

---

### 3.6 ImageUpload (`ui/primitives/ImageUpload`) — OD-05

#### Purpose
Handles student photograph acquisition during admissions with file validation and instant client-side preview.

#### Props Interface
```typescript
interface ImageUploadProps {
  value?: string | null; // URL or base64 data preview
  onChange: (file: File | null) => void;
  maxSizeBytes?: number; // Default: 2097152 (2MB)
  allowedTypes?: string[]; // Default: ['image/jpeg', 'image/png']
  aspectRatio?: '3:4' | '1:1'; // Default: '3:4' (Passport photo ratio)
  isDisabled?: boolean;
}
```

#### States & Interactions
- **Empty State:** Dashed border container with upload icon, label *"Upload Student Photo"*, and subtext *"JPEG or PNG up to 2MB"*.
- **Selected State:** Instant preview rendered within the fixed aspect-ratio container with clear `Replace` and `Remove` buttons.
- **Error State:** Red border with inline message when invalid mime type or oversize file is selected.
- **Security:** Plaintext file paths are never exposed; uploaded images are processed via local file storage providers with UUID hashing.

---

### 3.7 OfflineBanner (`ui/feedback/OfflineBanner`) — OD-02

#### Purpose
Provides persistent in-memory offline feedback during network interruptions on attendance and form registers.

#### Props Interface
```typescript
interface OfflineBannerProps {
  isOffline: boolean;
  unsavedCount?: number;
  onRetry: () => void;
  isRetrying?: boolean;
}
```

#### Behavior & DOM Structure
- Appears persistently at the top of the workspace when `navigator.onLine === false` or API calls return network failure.
- Message: *"Network connection lost. Your unsubmitted changes are preserved in memory. Do not close or refresh this tab."*
- Features an explicit `[Retry Submission]` button with loading indicator during retry attempts.

---

### 3.8 ChildSelector (`ui/layout/ChildSelector`) — OD-03

#### Purpose
Persistent multi-child indicator and selector pill placed in the Parent Portal global header.

#### Props Interface
```typescript
interface LinkedChild {
  id: string;
  fullName: string;
  gradeSection: string;
  avatarUrl?: string;
}

interface ChildSelectorProps {
  childrenList: LinkedChild[];
  selectedChildId: string;
  onChildChange: (newChildId: string) => void;
}
```

#### Behavior
- Renders as a compact pill in the header: `[👤 Aarav Sharma (Grade 8-A) ▾]`.
- Dropdown lists only explicitly linked children returned by the backend.
- Switching children invokes `onChildChange`, purging cached views and triggering fresh queries for the selected child.

---

### 3.9 ConcessionSelector (`ui/school-specialized/ConcessionSelector`) — OD-04

#### Purpose
Controlled selector for applying predefined fee concessions and submitting exceptional waiver requests at the cashier counter desk.

#### Props Interface
```typescript
interface ConcessionCategory {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
}

interface ConcessionSelectorProps {
  categories: ConcessionCategory[];
  selectedCategoryId?: string;
  onSelectCategory: (categoryId: string) => void;
  onRequestManualWaiver: () => void;
  isCashierRestricted: boolean;
}
```

---

## 4. Verification Standard

1. **Zero External CDN Dependencies:** All SVGs, fonts, and styles are bundled within the repository.
2. **Contrast Targets:** All text states target $\ge 4.5:1$; interactive boundaries target $\ge 3.0:1$.
3. **Keyboard Accessibility:** All interactive components are reachable and operable via keyboard (`Tab`, `Space`, `Enter`, `Escape`, arrow keys).
4. **Token Consistency:** Components bind exclusively to CSS variables in `05-design-system.md`.
