---
design-reference: PAGE-BY-PAGE FEATURE SUGGESTIONS (user findings)
estimated-tasks: 85
estimated-duration: 3-4 weeks
execution-method: executing-plans (batch) or subagent-driven-development (parallel)
---

# InfinityMix Page-by-Page Feature Implementation Plan

## Overview

This plan implements the comprehensive feature suggestions across all InfinityMix pages. Based on the priority matrix provided by the user, we build from the top 5 critical features outward, then address remaining pages and cross-cutting infrastructure.

## Priority Summary

| Priority | Feature | Page | Impact |
|----------|---------|------|--------|
| 1 | Wire profile to real data | /profile | Credibility killer - users see fake data |
| 2 | Wire player to real audio | /player | Broken share links - broken experience |
| 3 | Forgot password + OAuth | /login, /register | Friction at front door |
| 4 | Search + pagination | /mashups | Power users hit 25 mashup wall |
| 5 | Experiment detail/new pages | /admin/experiments | Half-built feature |

## Tasks

### Phase 1: Critical Wire-Ups (Priority 1-5)

#### Task 1: Wire Profile to Real Data (/profile)

**Files affected:**
- `src/app/profile/page.tsx` (modify)
- `src/app/api/users/me/route.ts` (verify)
- `src/lib/db/schema.ts` (reference)

**Steps:**

### Step 1: Update Profile Page to Fetch Real User Data

Replace hardcoded mock data with API call:

```typescript
// src/app/profile/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function getUserProfile() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  
  const user = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    image: users.image,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, session.user.id)).then(r => r[0]);
  
  // Get real mashup counts
  const { mashups } = await import('@/lib/db/schema');
  const mashupCounts = await db.select({
    count: mashups.id,
  }).from(mashups).where(eq(mashups.userId, session.user.id));
  
  return { user, mashupCount: mashupCounts.length };
}
```

### Step 2: Add Statistics Queries

Add to profile page:

```typescript
// Get real stats
const mashupsData = await db.select({
    totalMashups: count(mashups.id),
    publicMashups: count(mashups.id),
    totalPlays: sum(mashups.playCount),
  }).from(mashups)
  .where(and(
    eq(mashups.userId, session.user.id),
    eq(mashups.isPublic, true)
  ));
```

**Verification:** Load /profile - should show real user name, email, join date, actual mashup count from database.

---

#### Task 2: Wire Player to Real Audio (/player)

**Files affected:**
- `src/app/player/page.tsx` (modify)
- `src/app/api/mashups/[id]/route.ts` (verify)
- `src/lib/audio/streaming-service.ts` (create if missing)

**Steps:**

### Step 1: Accept mashupId Query Parameter

```typescript
// src/app/player/page.tsx
import { searchParams } from 'next/navigation';

export default function PlayerPage({ searchParams }: { searchParams: { mashupId?: string } }) {
  const mashupId = searchParams.mashupId;
  // If no mashupId, show empty player or redirect
}
```

### Step 2: Fetch Mashup Details

```typescript
async function getMashupData(mashupId: string) {
  const { mashups } = await import('@/lib/db/schema');
  const mashup = await db.select().from(mashups)
    .where(eq(mashups.id, mashupId)).then(r => r[0]);
  
  if (!mashup) return null;
  
  // Get streamable URL
  const streamUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/mashups/${mashupId}/download?stream=true`;
  
  return { mashup, streamUrl };
}
```

### Step 3: Wire Audio Player

```typescript
// Replace mock audio source
<audio src={streamUrl} controls />
// Or use existing audio player component
<AudioPlayer src={streamUrl} title={mashup.title} artist={mashup.artist} />
```

**Verification:** Visit /player?mashupId=xxx - should play real mashup audio.

---

#### Task 3: Implement Forgot Password + OAuth (/login, /register)

**Files affected:**
- `src/lib/auth/config.ts` (modify - enable OAuth)
- `src/app/login/page.tsx` (modify)
- `src/app/register/page.tsx` (modify)
- `src/app/forgot-password/page.tsx` (create)
- `src/app/reset-password/page.tsx` (create)

**Steps:**

### Step 1: Enable OAuth Providers in Better Auth Config

Check `src/lib/auth/` for existing config, add GitHub/Google:

```typescript
// In your better-auth config
export const authConfig = {
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
};
```

### Step 2: Make Login/Social Buttons Functional

```typescript
// src/app/login/page.tsx
// Replace non-functional buttons with:
<signInButton provider="github" />
<signInButton provider="google" />
```

### Step 3: Create Forgot Password Flow

Create `/src/app/forgot-password/page.tsx`:

```typescript
// Form with email input
// POST to /api/auth/forgot-password
```

Create `/src/app/reset-password/page.tsx`:

```typescript
// Form with new password input
// POST to /api/auth/reset-password?token=xxx
```

**Verification:** 
- Login page shows working GitHub/Google buttons
- Forgot password sends email with reset link
- Reset password page accepts new password

---

#### Task 4: Search + Pagination (/mashups)

**Files affected:**
- `src/app/mashups/page.tsx` (modify)
- `src/app/api/mashups/route.ts` (modify)

**Steps:**

### Step 1: Add Cursor-Based Pagination to API

```typescript
// src/app/api/mashups/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor'); // last ID
  const limit = parseInt(searchParams.get('limit') || '25');
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  
  let query = db.select().from(mashups).limit(limit + 1);
  
  if (cursor) {
    query = query.where(lt(mashups.id, cursor));
  }
  if (search) {
    query = query.where(ilike(mashups.title, `%${search}%`));
  }
  
  const results = await query.orderBy(desc(mashups.createdAt));
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, -1) : results;
  
  return NextResponse.json({ 
    items, 
    nextCursor: hasMore ? items[items.length - 1].id : null 
  });
}
```

### Step 2: Add Search UI to Mashups Page

```typescript
// src/app/mashups/page.tsx
<SearchInput 
  placeholder="Search mashups..."
  onSearch={(q) => setSearchQuery(q)}
/>

// Add filters: status dropdown, sort dropdown
<Select value={statusFilter} onChange={setStatusFilter}>
  <SelectItem value="all">All</SelectItem>
  <SelectItem value="completed">Completed</SelectItem>
  <SelectItem value="in-progress">In Progress</SelectItem>
</Select>
```

### Step 3: Add Infinite Scroll or Pagination Controls

```typescript
// Infinite scroll trigger
<div ref={scrollRef} className="loader">
  {isLoading && <Spinner />}
</div>

// Or pagination buttons
{hasMore && <Button onClick={loadMore}>Load More</Button>}
```

**Verification:** 
- Mashups page shows search input
- Can search by mashup name
- Can filter by status
- Can load more than 25 items

---

#### Task 5: Build Experiment Detail/New Pages (/admin/experiments)

**Files affected:**
- `src/app/admin/experiments/[id]/page.tsx` (create)
- `src/app/admin/experiments/new/page.tsx` (create)
- `src/app/admin/experiments/[id]/edit/page.tsx` (create)

**Steps:**

### Step 1: Create Experiment Detail Page

```typescript
// src/app/admin/experiments/[id]/page.tsx
import { db } from '@/lib/db';
import { experimentDefinitions, experimentVariants } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export default async function ExperimentDetailPage({ params }: { params: { id: string } }) {
  const experiment = await db.select()
    .from(experimentDefinitions)
    .where(eq(experimentDefinitions.id, params.id))
    .then(r => r[0]);
    
  const variants = await db.select()
    .from(experimentVariants)
    .where(eq(experimentVariants.experimentId, params.id));
  
  // Get metrics for each variant...
  
  return <ExperimentDetail experiment={experiment} variants={variants} />;
}
```

### Step 2: Create New Experiment Page

```typescript
// src/app/admin/experiments/new/page.tsx
// Form with fields:
// - name, description, domain (dropdown)
// - hypothesis, start_date, end_date
// - traffic_allocation percentage
// - add variants with code_path and traffic_percentage
// - auto_rollback_enabled, rollback_thresholds

<Form method="post" action="/api/admin/experiments">
  <Input name="name" label="Experiment Name" required />
  <Select name="domain" label="Domain">
    <option value="analysis">Analysis</option>
    <option value="planner">Planner</option>
    <option value="transition">Transition</option>
    <option value="render">Render</option>
    <option value="ui">UI</option>
  </Select>
  {/* Variant configuration */}
  <Button type="submit">Create Experiment</Button>
</Form>
```

### Step 3: Wire Quick Start Templates

```typescript
// In new experiment page
const templateButtons = [
  { name: 'Analysis v2', domain: 'analysis', codePath: 'analysis-v2' },
  { name: 'Planner Algorithm', domain: 'planner', codePath: 'planner-new' },
  // ...
];

// On click, pre-fill form
onClick={() => form.setValues(template)}
```

**Verification:**
- /admin/experiments/new creates new experiments
- /admin/experiments/[id] shows experiment details with metrics
- Quick start templates pre-fill the form

---

### Phase 2: Secondary Features (Priority 6-10)

#### Task 6: Login Page Enhancements (/login)

**Files affected:**
- `src/app/login/page.tsx` (modify)

**Steps:**

### Step 1: Add Client-Side Validation with Zod

```typescript
// src/app/login/page.tsx
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required'),
});

function ClientLoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });
  
  return (
    <Form>
      <Input {...register('email')} error={errors.email?.message} />
      <Input type="password" {...register('password')} error={errors.password?.message} />
      <Button disabled={isSubmitting}>Login</Button>
    </Form>
  );
}
```

### Step 2: Add Rate Limiting / Remember Me

Check existing rate limiting or add:

```typescript
// Add "remember me" checkbox
<Checkbox name="rememberMe" label="Remember me" />

// Server side: extend session duration if rememberMe is true
const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
```

### Step 3: Add Redirect to Intended Page

```typescript
// src/app/login/page.tsx
const searchParams = useSearchParams();
const callbackUrl = searchParams.get('redirect') || '/create';

// After successful login
router.push(callbackUrl);
```

**Verification:** Login form validates email format, shows errors, redirects to intended page.

---

#### Task 7: Register Page Enhancements (/register)

**Files affected:**
- `src/app/register/page.tsx` (modify)

**Steps:**

### Step 1: Add Password Strength Meter

```typescript
// src/app/register/page.tsx
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  termsAccepted: z.boolean().refine(v => v === true, 'Must accept terms'),
});

function PasswordStrength({ password }: { password: string }) {
  const score = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  }, [password]);
  
  const colors = ['red', 'orange', 'yellow', 'green', 'green'];
  return <div style={{ width: score * 25 + '%', background: colors[score] }} className="strength-bar" />;
}
```

### Step 2: Add Username Availability Check

```typescript
// Add onBlur handler
const checkUsername = async (username: string) => {
  const res = await fetch(`/api/users/check-username?username=${username}`);
  const data = await res.json();
  return data.available;
};
```

### Step 3: Add Terms Acceptance Checkbox

```typescript
<Checkbox {...register('termsAccepted')}>
  I agree to <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>
</Checkbox>
```

### Step 4: Add Onboarding Wizard (Basic)

Create `/src/app/onboarding/page.tsx`:

```typescript
// Steps: 1) Select music preferences 2) Connect first project 3) Try an upload
// Guide user to first mashup
```

**Verification:** Register form shows password strength, checks username availability, requires terms acceptance.

---

#### Task 8: Landing Page Enhancements (/)

**Files affected:**
- `src/app/page.tsx` (modify)
- `src/app/api/admin/plans/route.ts` (create for dynamic pricing)

**Steps:**

### Step 1: Create Plans API for Dynamic Pricing

```typescript
// src/app/api/admin/plans/route.ts
import { db } from '@/lib/db';
import { plans } from '@/lib/db/schema';

export async function GET() {
  const allPlans = await db.select().from(plans).orderBy(asc(plans.price));
  return NextResponse.json(allPlans);
}
```

### Step 2: Fetch Pricing from Database

```typescript
// src/app/page.tsx
async function getPlans() {
  const res = await fetch('/api/admin/plans', { cache: 'no-store' });
  return res.json();
}

export default async function Page() {
  const plans = await getPlans();
  // Render pricing cards dynamically
}
```

### Step 3: Add Live Demo Audio Player

Create `DemoPlayer` component and wire to sample:

```typescript
const DEMO_MASHUP_ID = process.env.DEMO_MASHUP_ID;
<Button onclick={() => setShowDemoPlayer(true)}>Listen to Demos</Button>
<Modal isOpen={showDemoPlayer}>
  <DemoPlayer mashupId={DEMO_MASHUP_ID} />
</Modal>
```

### Step 4: Add Social Proof Section

```typescript
// Fetch from API
const stats = await fetch('/api/stats/public').then(r => r.json());
// { userCount, mashupsThisWeek, trendingMashups[] }

<div>
  <span>{stats.userCount.toLocaleString()} users</span>
  <span>{stats.mashupsThisWeek.toLocaleString()} mashups created this week</span>
</div>
```

### Step 5: Add Functional Footer Links

```typescript
// Create simple pages or link to existing
<Link href="/terms">Terms of Service</Link>
<Link href="/privacy">Privacy Policy</Link>
<Link href="/contact">Contact</Link>
```

### Step 6: Add Email Waitlist Capture

```typescript
<Modal name="waitlist">
  <Form action="/api/waitlist" method="post">
    <Input name="email" type="email" placeholder="Enter your email" required />
    <Button type="submit">Join Waitlist</Button>
  </Form>
</Modal>
```

**Verification:** Landing page shows real pricing, working demo player, social proof stats, functional footer links.

---

#### Task 9: Dashboard Page Enhancements (/dashboard)

**Files affected:**
- `src/app/dashboard/page.tsx` (modify)

**Steps:**

### Step 1: Add Quick Stats Cards

```typescript
// Get stats from DB
const stats = await db.select({
  totalMashups: count(mashups.id),
  totalPublic: count(mashups.id).where(eq(mashups.isPublic, true)),
  totalPlays: sum(mashups.playCount),
}).from(mashups).where(eq(mashups.userId, userId));

// Also get storage used, quota remaining
const userPlan = await db.select().from(userPlans).where(eq(userPlans.userId, userId));
```

### Step 2: Add "Continue Where You Left Off"

```typescript
const inProgressMashup = await db.select()
  .from(mashups)
  .where(and(
    eq(mashups.userId, userId),
    eq(mashups.status, 'in-progress')
  ))
  .orderBy(desc(mashups.updatedAt))
  .limit(1)
  .then(r => r[0]);

{inProgressMashup && (
  <Card>
    <h3>Continue: {inProgressMashup.title}</h3>
    <Button href={`/create?resume=${inProgressMashup.id}`}>Continue</Button>
  </Card>
)}
```

### Step 3: Add Activity Feed

```typescript
const recentActivity = await db.select({
    id: mashups.id,
    title: mashups.title,
    status: mashups.status,
    updatedAt: mashups.updatedAt,
  }).from(mashups)
  .where(eq(mashups.userId, userId))
  .orderBy(desc(mashups.updatedAt))
  .limit(10);
```

### Step 4: Add Notification Bell Icon

Add notification dropdown - requires notification table (see Task 17).

**Verification:** Dashboard shows real stats cards, in-progress mashup resume, activity feed.

---

#### Task 10: Mashups Page Enhancements (/mashups)

**Files affected:**
- `src/app/mashups/page.tsx` (modify) - Already partially covered in Task 4

**Steps:**

### Step 1: Add Waveform Preview Inline

```typescript
// Each mashup card shows mini waveform
<MashupCard>
  <MiniWaveform waveformUrl={mashup.waveformUrl} />
  <audio src={mashup.audioUrl} />
</MashupCard>
```

### Step 2: Add Playlist Creation

```typescript
// Create playlists table if not exists
// User can group mashups into playlists

<Button onClick={() => showCreatePlaylistModal()}>Create Playlist</Button>
```

### Step 3: Add Batch Operations

```typescript
<Checkbox onChange={setSelected} />
<Button onClick={() => bulkDownload(selected)}>Download ZIP</Button>
<Button onClick={() => bulkDelete(selected)}>Delete</Button>
```

### Step 4: Add Share to Social Media

```typescript
<ShareButtons mashupId={mashup.id} audioUrl={mashup.audioUrl} />
// Sharing to SoundCloud, Instagram, TikTok with audio snippet
```

**Verification:** Mashups page has waveform preview, playlists, batch ops, social share.

---

### Phase 3: Remaining Pages

#### Task 11: Projects Page Enhancements (/projects)

**Files affected:**
- `src/app/projects/page.tsx` (modify)

**Steps:**

### Step 1: Add Search and Sort

```typescript
<SearchInput onSearch={setSearch} />
<Select onChange={setSort}>
  <option value="updated">Last Modified</option>
  <option value="name">Name</option>
  <option value="created">Created</option>
</Select>
```

### Step 2: Add Bulk Status Change

```typescript
<Button onClick={() => bulkArchive(selected)}>Archive Selected</Button>
```

### Step 3: Add Pinned Projects

Add `isPinned` field to projects schema, add star button.

**Verification:** Projects page has search, sort, bulk ops, pinning.

---

#### Task 12: Project Detail Page (/projects/[id])

**Files affected:**
- `src/app/projects/[id]/page.tsx` (modify)

**Steps:**

### Step 1: Wire Upload and Create Mashup Buttons

```typescript
<Button href={`/create?projectId=${params.id}&action=upload`}>
  Upload Tracks
</Button>
<Button href={`/create?projectId=${params.id}&action=mashup`}>
  Create Mashup
</Button>
```

### Step 2: Implement Stems Tab

```typescript
// Fetch track stems
const stems = await db.select().from(trackStems).where(eq(trackStems.trackId, trackId));

// Display playable stems
{stems.map(stem => (
  <StemPlayer stem={stem} />
))}
```

### Step 3: Add Project Settings Modal

```typescript
<Button onClick={() => showSettings()}>Settings</Button>
// Modal with name, description, color, BPM lock, key lock
```

**Verification:** Project detail page has functional upload/mashup buttons, working stems tab.

---

#### Task 13: Create Page Enhancements (/create)

**Files affected:**
- `src/app/create/page.tsx` (modify)

**Steps:**

### Step 1: Re-enable Stem Mashup Mode

Find `stemMashupAvailable = false` and make configurable:

```typescript
const stemMashupEnabled = process.env.FEATURE_STEM_MASHUP === 'true';

return (
  <Tab value="stem" disabled={!stemMashupEnabled}>
    Stem Mashup
  </Tab>
);
```

### Step 2: Add Waveform Click-to-Seek

In TrackList component, add onClick to waveform:

```typescript
function Waveform({ audioUrl, onSeek }: { audioUrl: string; onSeek: (time: number) => void }) {
  return (
    <div onClick={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      onSeek(percent * duration);
    }}>
      <WaveformRenderer />
    </div>
  );
}
```

### Step 3: Add Drag-to-Reorder for Selected Tracks

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';

<DndContext onDragEnd={handleDragEnd}>
  <SortableContext items={selectedTracks}>
    {selectedTracks.map(track => <DraggableTrack key={track.id} track={track} />)}
  </SortableContext>
</DndContext>
```

**Verification:** Create page has enabled stem mode, clickable waveforms, draggable track reordering.

---

#### Task 14: Admin - Audio Observability (/admin/audio-observability)

**Files affected:**
- `src/app/admin/audio-observability/page.tsx` (modify)

**Steps:**

### Step 1: Add Alerting Thresholds

```typescript
// Server-side alerting (separate route or cron)
const alertConfig = {
  browserHintAcceptanceMin: 60, // %
  analysisFailureRateMax: 10, // %
};

// Check and send alerts if breached
if (currentRate < alertConfig.browserHintAcceptanceMin) {
  await sendAlert('Browser hint acceptance below threshold', currentRate);
}
```

### Step 2: Add Bulk Requeue with Filters

```typescript
// UI for bulk requeue
<Button onClick={() => bulkRequeue('draft')}>Requeue All Draft Quality</Button>
<Button onClick={() => bulkRequeue('failed')}>Requeue All Failed</Button>
```

**Verification:** Admin can set alerts and bulk requeue tracks.

---

#### Task 15: Admin - Render Observability (/admin/render-observability)

**Files affected:**
- `src/app/admin/render-observability/page.tsx` (modify)

**Steps:**

### Step 1: Add Render Quality Distribution Chart

```typescript
// Histogram of LUFS values
import { BarChart } from 'recharts';
<BarChart data={lufsDistribution} />
```

### Step 2: Add Failure Categorization

```typescript
// Group failures by reason
const failureCategories = {
  timeout: failures.filter(f => f.error.includes('timeout')),
  memory: failures.filter(f => f.error.includes('memory')),
  format: failures.filter(f => f.error.includes('format')),
};
```

**Verification:** Render observability shows LUFS histogram, failure categorization.

---

#### Task 16: Admin - Audio Preview QA (/admin/audio-preview-qa)

**Files affected:**
- `src/app/admin/audio-preview-qa/page.tsx` (modify)

**Steps:**

### Step 1: Aggregate Telemetry to Server

Instead of localStorage, send to server:

```typescript
// Client-side
useEffect(() => {
  navigator.sendBeacon('/api/telemetry/preview', JSON.stringify(telemetryData));
}, []);

// Server endpoint
// Store in database for admin viewing
```

### Step 2: Add Browser Compatibility Matrix

```typescript
// Aggregate by browser/version
const browserMatrix = {
  'Chrome 120': { success: 95, failures: 5 },
  'Firefox 121': { success: 88, failures: 12 },
  'Safari 17.2': { success: 60, failures: 40 },
};
```

**Verification:** Preview QA aggregates server-side, shows browser compatibility.

---

### Phase 4: Cross-Cutting Features

#### Task 17: Create Notifications System

**Files affected:**
- `src/lib/db/schema.ts` (add table)
- `src/app/api/notifications/route.ts` (create)
- `src/components/notifications/NotificationBell.tsx` (create)

**Steps:**

### Step 1: Add Notifications Table

```typescript
// src/lib/db/schema.ts
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(genRandomUUID()),
  userId: uuid('user_id').references(() => users.id),
  type: text('type').notNull(), // 'mashup_completed', 'collab_invite', etc.
  title: text('title').notNull(),
  message: text('message'),
  link: text('link'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Step 2: Create Notification API

```typescript
// POST /api/notifications - create notification
// GET /api/notifications?unreadOnly=true - list notifications
// PATCH /api/notifications/[id]/read - mark as read
// POST /api/notifications/read-all - mark all as read
```

### Step 3: Add Notification Bell Component

```typescript
// src/components/notifications/NotificationBell.tsx
<Dropdown>
  <NotificationItem v-for="n in notifications" :key="n.id" :notification="n" />
</Dropdown>
```

**Verification:** Users see notifications when mashups complete, collab invites received, etc.

---

#### Task 18: Add Global Search (Command Palette)

**Files affected:**
- `src/components/search/CommandPalette.tsx` (create)
- `src/app/api/search/route.ts` (create)

**Steps:**

### Step 1: Create Search API

```typescript
// src/app/api/search/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type'); // 'tracks', 'mashups', 'projects'
  
  // Search across multiple tables
  const tracks = await db.select().from(tracks).where(ilike(tracks.title, `%${query}%`));
  const mashups = await db.select().from(mashups).where(ilike(mashups.title, `%${query}%`));
  const projects = await db.select().from(projects).where(ilike(projects.name, `%${query}%`));
  
  return NextResponse.json({ tracks, mashups, projects });
}
```

### Step 2: Create Command Palette Component

```typescript
// src/components/search/CommandPalette.tsx
import { Command } from 'cmdk';

<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search tracks, mashups, projects..." />
  <CommandGroup heading="Tracks">
    {tracks.map(t => <CommandItem onSelect={() => goToTrack(t.id)}>{t.title}</CommandItem>)}
  </CommandGroup>
  <CommandGroup heading="Mashups">
    {mashups.map(m => <CommandItem onSelect={() => goToMashup(m.id)}>{m.title}</CommandItem>)}
  </CommandGroup>
</CommandDialog>

// Keyboard shortcut: Cmd+K
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen(true);
    }
  };
  document.addEventListener('keydown', down);
}, []);
```

**Verification:** Press Cmd+K opens search, can find tracks/mashups/projects.

---

#### Task 19: Add Keyboard Shortcuts System

**Files affected:**
- `src/hooks/useKeyboardShortcuts.ts` (modify or create)
- `src/app/player/page.tsx` (add player shortcuts)

**Steps:**

### Step 1: Enhance useKeyboardShortcuts Hook

```typescript
// src/hooks/useKeyboardShortcuts.ts
const shortcuts = {
  'space': { action: 'playPause', description: 'Play/Pause' },
  'ArrowLeft': { action: 'seekBack', description: 'Seek -10s' },
  'ArrowRight': { action: 'seekForward', description: 'Seek +10s' },
  'm': { action: 'mute', description: 'Mute/Unmute' },
  'f': { action: 'fullscreen', description: 'Fullscreen' },
  'n': { action: 'next', description: 'Next track' },
  'p': { action: 'prev', description: 'Previous track' },
};
```

### Step 2: Register Player Shortcuts

```typescript
// In player page
useKeyboardShortcuts({
  onPlayPause: () => audioRef.current?.togglePlay(),
  onSeekBack: () => audioRef.current!.currentTime -= 10,
  onSeekForward: () => audioRef.current!.currentTime += 10,
  onMute: () => audioRef.current!.muted = !audioRef.current!.muted,
});
```

**Verification:** Player responds to keyboard shortcuts for play/pause/seek.

---

#### Task 20: Add Mobile Responsive Layout (Critical for Create Page)

**Files affected:**
- `src/app/create/page.tsx` (modify)
- `src/components/ui/` (existing, ensure mobile-friendly)

**Steps:**

### Step 1: Simplify Create Page for Mobile

```typescript
// Detect mobile viewport
const isMobile = useMediaQuery('(max-width: 768px)');

{isMobile ? (
  <MobileCreateFlow>
    <Step1Upload />
    <Step2PickStyle />
    <Step3Generate />
  </MobileCreateFlow>
) : (
  <DesktopCreateStudio /> // existing full layout
)}
```

### Step 2: Create Mobile-First Upload Flow

```typescript
// Mobile: simplified 3-step wizard
// Step 1: Upload 1-2 tracks (file picker)
// Step 2: Pick transition style (dropdown)
// Step 3: Generate (button)
```

**Verification:** Create page works on mobile viewport with simplified flow.

---

#### Task 21: Add Onboarding Flow for New Users

**Files affected:**
- `src/app/onboarding/page.tsx` (create)
- `src/app/create/page.tsx` (modify to detect first-time)

**Steps:**

### Step 1: Create Onboarding Wizard

```typescript
// Steps:
// 1. Welcome + select music preferences (genre, mood)
// 2. First project setup (name tracks to add)
// 3. Try an upload (drag & drop demo)
// 4. Quick mashup tutorial
```

### Step 2: Detect First-Time User

```typescript
// Check if user has any tracks or mashups
const isFirstTime = await db.select().from(tracks).where(eq(tracks.userId, userId)).limit(1).then(r => r.length === 0);

if (isFirstTime) {
  // Show onboarding modal or redirect to /onboarding
  router.push('/onboarding');
}
```

**Verification:** New users see onboarding wizard before accessing create page.

---

#### Task 22: Admin Missing Pages

**Files affected:**
- `src/app/admin/users/page.tsx` (create)
- `src/app/admin/health/page.tsx` (create)
- `src/app/admin/moderation/page.tsx` (create)
- `src/app/admin/billing/page.tsx` (create)

**Steps:**

### Step 1: User Management Page

```typescript
// List users with search/sort
// View user details: tracks, mashups, storage, plan
// Actions: ban, reset password, impersonate
```

### Step 2: System Health Page

```typescript
// Real-time metrics:
// - DB connection pool status
// - Redis connection status
// - R2 storage usage
// - Queue depth
// - Worker service status
```

### Step 3: Content Moderation Page

```typescript
// Review flagged public mashups
// DMCA takedown workflow
// User reports queue
```

### Step 4: Billing Dashboard

```typescript
// Revenue metrics, MRR, churn
// Plan distribution
// Quota usage alerts
// Stripe webhook event log
```

**Verification:** All admin pages are accessible and show real data.

---

### Phase 5: Error Recovery & Analytics

#### Task 23: Add Error Recovery (Retry Buttons)

**Files affected:**
- `src/components/mashup/MashupStatusCard.tsx` (modify)
- `src/app/api/mashups/[id]/retry/route.ts` (create)

**Steps:**

### Step 1: Add Retry CTA to Failed States

```typescript
// When mashup status is 'failed'
{status === 'failed' && (
  <div className="failed-state">
    <p>Generation failed. Please try again.</p>
    <Button onClick={() => retryMashup(id)}>Retry</Button>
  </div>
)}
```

### Step 2: Create Retry API

```typescript
// src/app/api/mashups/[id]/retry/route.ts
// Re-queue the mashup generation job
// Reset status to 'pending'
```

**Verification:** Failed mashups show retry button that re-triggers generation.

---

#### Task 24: Add Analytics Integration

**Files affected:**
- `src/lib/analytics/client.ts` (create)
- `src/components/providers/AnalyticsProvider.tsx` (create)

**Steps:**

### Step 1: Set Up Analytics Provider

```typescript
// Use PostHog or Mixpanel
// Track events:
// - signup_complete
// - first_upload
// - first_mashup
// - first_share
// - funnel_metrics
```

### Step 2: Add Tracking to Key Actions

```typescript
// After successful signup
analytics.track('signup_complete', { userId, method: 'email' });

// After first upload
analytics.track('first_upload', { userId, trackCount: tracks.length });

// After first mashup generated
analytics.track('first_mashup', { userId, mashupId });
```

**Verification:** Analytics dashboard shows user funnel metrics.

---

## Execution Strategy

This plan should be executed with: **`/executing-plans`** (batch)

Reason: While some tasks are independent, many build on each other (Phase 1 must complete before Phase 2 can be properly tested). Batch execution with human review between phases ensures quality.

## How to Execute This Plan

Execute with: **`/executing-plans`** (recommended for sequential dependencies)

**Phase execution order:**
1. Execute Phase 1 tasks first (Task 1-5) - Critical wire-ups
2. Review and verify Phase 1
3. Execute Phase 2 tasks (Task 6-10) - Secondary features
4. Review and verify Phase 2
5. Execute Phase 3 tasks (Task 11-13) - Remaining pages
6. Execute Phase 4 tasks (Task 17-21) - Cross-cutting (can parallelize)
7. Execute Phase 5 tasks (Task 22-24) - Admin pages and analytics

When executing:
1. Follow each task's steps exactly
2. Run verification commands before moving to next task
3. If any verification fails, stop and investigate
4. Report progress between batches
5. Use `/verification-before-completion` before marking tasks done
6. After all tasks complete, use `/finishing-a-development-branch`

## Notes

- Some tasks create new API routes - ensure to add proper validation with Zod
- OAuth providers require GitHub/Google developer credentials
- Mobile responsive work is critical for shareability
- Analytics can use PostHog (open source) or Mixpanel