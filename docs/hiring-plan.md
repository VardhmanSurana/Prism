# Hiring Plan: First Engineer

**Date:** July 6, 2026
**Company:** Prism
**Role:** Founding Full-Stack Engineer

---

## Role Overview

Prism is an early-stage local-first desktop photo and video library targeting photographers and privacy-conscious users. The product is in alpha with a solid technical foundation: Tauri v2 desktop shell, React/TypeScript frontend, FastAPI/Python backend, SQLite storage, and optional local AI features (face detection, vision models, OCR).

We need our first engineer to join as a founding team member, owning full-stack features end-to-end. This person will shape the technical direction, build core features, and establish engineering practices as we move toward a public beta.

---

## 1. Founding Full-Stack Engineer

### Summary
Own full-stack feature development across React/TypeScript frontend, Python/FastAPI backend, and Tauri desktop integration for a privacy-first photo library.

### Expertise & Responsibilities
**Core Technical Skills:**
- React 18+ with TypeScript, hooks, state management (Zustand), and virtualized lists
- Python 3.11+ with FastAPI, async patterns, SQLAlchemy, and SQLite
- Tauri v2 desktop application development (or strong willingness to learn)
- REST API design, SSE (Server-Sent Events), and WebSocket patterns
- File system operations, metadata extraction (EXIF, video codecs), and media processing
- Git workflows, code review, and collaborative development

**Responsibilities:**
- Build and ship user-facing features across the full stack (gallery, search, albums, locked folder, editing tools)
- Collaborate on architecture decisions for new features (AI agent, face clustering, OCR pipeline)
- Write clean, maintainable, well-tested code (frontend type checks, backend pytest)
- Debug cross-platform issues (Linux, macOS, Windows) in the Tauri desktop environment
- Contribute to API design, database migrations, and security implementations
- Participate in code reviews and establish engineering standards

### Priorities
1. **Feature delivery:** Ship high-impact features that move us toward public beta (editing tools, AI search improvements, export/backup)
2. **Code quality:** Establish testing patterns, type safety, and review practices
3. **Performance:** Optimize large library handling (10k+ photos), thumbnail generation, and search responsiveness
4. **Security:** Maintain the privacy-first promise — Locked Folder encryption, path isolation, API auth
5. **Documentation:** Improve developer onboarding, architecture docs, and API references

### Boundaries
- Not responsible for: DevOps/infrastructure (we're local-first, no cloud services), marketing, sales, or customer support
- Should not: Make product roadmap decisions independently — collaborate with founder on priorities
- Should avoid: Over-engineering — we're a small team, favor pragmatic solutions that ship

### Tools & Permissions
**Required:**
- GitHub repository access (read/write, PR creation, code review)
- Local development environment (Python 3.11+, Node.js 18+, pnpm, ffmpeg)
- Access to design system (DESIGN.md) and API documentation

**Optional (as needed):**
- Access to issue tracker and project boards
- Figma/design tool access for UI implementation
- Access to AI model repositories (llama.cpp, Florence-2, SigLIP) for local inference features

### Communication
- **Tone:** Direct, technical, async-first. Use GitHub issues/PRs for feature discussions, Slack/Discord for quick questions.
- **Style:** Write concise PR descriptions, reference issue numbers, include screenshots for UI changes.
- **Meetings:** Weekly 30-minute sync with founder for priority alignment. Ad-hoc pairing sessions for complex features.

### Collaboration & Escalation
**Works with:**
- Founder (product decisions, architecture reviews, priority setting)
- Future hires (backend specialist, frontend specialist, AI/ML engineer) as the team grows

**Escalation paths:**
- Product scope questions → Founder
- Architecture decisions with long-term impact → Founder + code review
- Security concerns → Founder immediately
- Cross-platform bugs → Investigate first, escalate if >2 hours without progress

---

## Hiring Criteria

### Must-Have
- 3+ years professional experience with React + TypeScript
- 2+ years professional experience with Python backend development
- Experience shipping desktop applications or complex web apps
- Strong understanding of file systems, media formats, and metadata
- Comfortable working autonomously in a small, fast-moving team

### Nice-to-Have
- Experience with Tauri or Electron desktop frameworks
- Knowledge of image/video processing (ffmpeg, Pillow, OpenCV)
- Familiarity with SQLite optimization and FTS5 search
- Experience with local-first or privacy-focused software
- Contributions to open-source projects

### Red Flags
- Prefers large team/corporate environments over startup ambiguity
- Strong opinions about cloud-first architecture (we're local-first by design)
- Uncomfortable with full-stack ownership (frontend + backend + desktop)

---

## Compensation & Equity

**Note:** This section should be finalized based on budget and candidate profile.

- **Salary Range:** $120k–$160k USD (adjusted for location/cost of living)
- **Equity:** 0.5%–1.5% (4-year vest, 1-year cliff)
- **Benefits:** Flexible hours, remote-first, equipment budget, conference attendance

---

## Interview Process

1. **Intro call** (30 min): Founder + candidate alignment on vision, role, expectations
2. **Technical screen** (60 min): Live coding on a Prism-related problem (e.g., implement a new gallery filter, debug a metadata extraction issue)
3. **Project review** (45 min): Candidate walks through a past project, discusses architecture decisions
4. **Culture fit** (30 min): Discussion about working style, communication preferences, growth goals
5. **Offer stage**: Reference checks, offer negotiation, start date

**Timeline:** Aim to complete within 2 weeks from first interview.

---

## Onboarding Plan (First 30 Days)

**Week 1: Setup & Exploration**
- Set up local dev environment (Python, Node, Tauri, ffmpeg)
- Clone repo, run tests, build desktop app
- Read ARCHITECTURE.md, DESIGN.md, and key source files
- Shadow founder on current feature work

**Week 2: First Contributions**
- Pick up a well-scoped issue (bug fix or small feature)
- Submit first PR, participate in code review
- Familiarize with testing patterns and CI checks

**Week 3: Feature Ownership**
- Take ownership of a medium-complexity feature (e.g., new search filter, album CRUD)
- Collaborate with founder on API design and UI implementation
- Start building context on AI features (face detection, vision pipeline)

**Week 4: Independence**
- Ship first feature end-to-end
- Propose a small architecture improvement or technical debt item
- Establish regular sync cadence with founder

---

## Success Metrics (First 90 Days)

- Shipped 3–5 features or significant improvements
- Established code review patterns and contributed to engineering docs
- Zero regressions introduced in shipped code
- Comfortable debugging cross-platform issues independently
- Positive feedback from founder on collaboration and code quality

---

## Next Steps

1. **Finalize compensation** based on budget and candidate level
2. **Post job listing** on relevant platforms (GitHub Jobs, Hacker News "Who's Hiring", LinkedIn, specialized communities)
3. **Screen candidates** against must-have criteria
4. **Conduct interviews** following the process above
5. **Make offer** within 2 weeks of first interview
6. **Onboard** following the 30-day plan

---

*This hiring plan is a living document. Update as we learn from the hiring process and as the team evolves.*
