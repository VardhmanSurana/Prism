## Variant: Data Dashboard

### Design stance
Metrics-first layout with a persistent sidebar showing aggregate stats, while the main content area presents sections as clean, scannable cards. Think: Spotify Wrapped meets Notion databases.

### Key choices
- **Layout:** Two-panel — sticky left sidebar (320px) with overview stats + scrollable right content
- **Typography:** Same font stack, but data is given more visual weight
- **Color:** Same OLED palette, accent used more liberally for stat highlights
- **Interaction:** Sidebar stays pinned while content scrolls; hover states on all cards
- **Data:** Seasonal bar chart in sidebar, big total number, mini stat rows

### Trade-offs
- **Strong at:** At-a-glance overview, data density, power-user feel
- **Weak at:** Less visual drama, sidebar takes space on smaller screens
- **Best for:** Users who want to understand their collection at a glance

### Differences from current
- Persistent sidebar shows total photo count (big serif number), quick stats, and seasonal bar chart
- Content sections use tighter, more compact card designs
- On This Day uses a responsive grid instead of horizontal scroll
- Timeline is minimal rows instead of vertical timeline with dots
- No editorial dividers — sections flow as a continuous data feed
