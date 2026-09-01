# User Guide

Step-by-step guide for operators (event organizers) and attendees using Surket.

---

## For Operators

### Getting Started

1. **Launch Surket** — open the dashboard at your deployment URL (or `http://localhost:5173` locally)
2. The sidebar provides navigation: **Dashboard**, **Templates**, **Join a survey**, **Settings**

### Creating an Event

1. Click **"+ New event"** on the Dashboard
2. Fill in: title, organizer, location, start date, description
3. Choose a **theme** (Aurora, Ember, Forest, Violet, Rose) — this sets the accent colors
4. Click **Create** — you'll land in the **Event Workspace**

Or use a **Template**: go to Templates → pick an event blueprint (AI Meetup, Conference, Workshop) → click **Use this template**.

### Building the Itinerary

In the Event Workspace, the **Itinerary** tab shows the day's timeline:

1. Click **"+ Add segment"** to create entries:
   - **Keynote** — main stage presentation
   - **Session** — breakout talk
   - **Workshop** — hands-on activity
   - **Panel** — group discussion
   - **Break** — coffee/lunch
   - **Networking** — social time
   - **Survey** — links a survey for live feedback
2. Each segment has: title, speaker, location, start/end time, description
3. **Drag to reorder** — segments are ordered by position
4. **Link a survey** — set the `surveyId` on a segment to connect it to a survey

### Creating Surveys

From the Event Workspace **Surveys** tab or the Dashboard:

1. Click **"+ New survey"**
2. Set: title, audience, mode (standard or live)
3. Add questions using the **Survey Builder**:

#### Question Types

| Type | What Attendees See | Analytics |
|------|-------------------|-----------|
| **Single choice** | Radio buttons — pick one | Bar chart of option counts |
| **Multiple choice** | Checkboxes — pick many | Bar chart of option counts |
| **Star rating** | 1-5 stars | Average rating + distribution |
| **NPS (0-10)** | Scale 0-10 | NPS score (-100 to 100) |
| **Scale** | Custom numeric range | Average + distribution |
| **Number** | Free numeric input | Average + distribution |
| **Date** | Date picker | Date frequency |
| **Open text** | Free text area | Keywords + sentiment |

4. **Reorder questions** by dragging
5. Mark questions as **required** or optional

### Going Live

1. In the survey settings, toggle **"Go live"** — the survey becomes accessible via its join code
2. Share the **join code** (or QR code) with attendees
3. Attendees visit the join URL, enter the code, and start answering

### Live Presentation

1. From the survey detail, click **"Present live"** — opens the big-screen view
2. This full-screen page shows:
   - Current question with live-updating bar charts
   - Response count and percentage labels
   - QR code (configurable in Settings)
   - Join code for the audience
3. Results update in **real-time** via WebSocket (or 3-second polling)
4. Navigate between questions to present each one

### Settings

Access via the topbar or sidebar:

#### Appearance
- **Color mode**: Dark / Light / System (follows OS preference)
- **Accent theme**: Aurora, Ember, Forest, Violet, Rose
- **Density**: Comfortable or Compact
- **Reduce motion**: Disables animations for accessibility

#### Admin Access
- Enter your **admin token** (if the deployment is protected)
- Stored in `localStorage` — never sent to third parties

#### Event Defaults
- Default template, organizer, location, timezone
- Auto-detected timezone from your browser

#### Live Presentation Display
- Show/hide QR code
- Show/hide percentages
- Question text font scale (85% - 140%)

#### Data Export
- Export all events as CSV or JSON

---

## For Attendees

### Joining a Survey

1. **Scan the QR code** shown on the presenter screen, OR
2. **Visit the join URL** (e.g., `https://your-surket.app/join`) and enter the join code

### Answering Questions

- Follow the question flow — each type has an intuitive input
- Required questions are marked with a red asterisk
- Submit when complete — you'll see a thank-you screen

### Viewing a Public Itinerary

If the organizer shares the event URL (e.g., `https://your-surket.app/e/my-event`):

1. See the full event timeline
2. "Happening now" and "Up next" cards highlight the current/next segment
3. One-tap **"Rate this"** buttons link to associated surveys

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Navigate between interactive elements |
| `Enter` | Activate buttons / submit forms |
| `Escape` | Close modals |

---

## Tips

- **Theme toggle**: the sun/moon button in the topbar instantly switches dark/light mode
- **Compact mode**: in Settings → Density → Compact for more data-dense views
- **Templates save time**: start from a blueprint, then customize
- **Duplicate surveys**: in the Survey Builder, use "Duplicate" to clone a survey for a new session
- **Export regularly**: download CSV/JSON backups from Settings before major changes
