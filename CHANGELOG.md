# Changelog

All notable changes to Prism will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Full documentation suite (docs/)
- AGENTS.md for AI coding agents
- CONTRIBUTING.md for contributors
- CHANGELOG.md for tracking changes

## [0.1.0] - 2024-01-XX

### Added

#### Core Features
- Photo library management with automatic import
- EXIF metadata extraction and parsing
- WebP thumbnail generation
- Full-text search with FTS5
- Virtualized photo grid with timeline dial
- Album management (custom, smart, memories)
- People detection and face recognition
- Map view with Leaflet integration
- Locked Folder with Argon2id encryption
- Trash with auto-purge after 30 days

#### Image Editor (19 Tools)
- Light adjustments (exposure, brightness, contrast, etc.)
- Color grading (HSL, color wheels, temperature)
- Tone curves with bezier interpolation
- Presets (film looks, vintage, creative)
- Selective adjustments with AI segmentation
- Healing and inpainting (LaMa ONNX)
- Portrait retouching with face detection
- Annotations (text, shapes, doodles, emoji)
- Frames and effects (grain, light leaks, vignettes)
- LUT support (.cube files)
- Transform (crop, rotate, flip)
- Auto-enhance with AI
- History panel with undo/redo
- Palette extraction
- Color matching

#### Video Editor (NLE)
- Multi-track timeline (video, audio, text)
- Clip editing (split, trim, copy, paste)
- Keyframe animation with bezier curves
- Color grading per clip
- Text overlays
- Transitions with animated previews
- Multi-cam editing
- Audio mixer with volume and pan
- Speed ramping with keyframes
- Proxy video generation
- Export to MP4 with customizable settings

#### AI Features (Optional)
- SigLIP2 semantic embeddings for similarity search
- face-id for face detection and recognition
- BiSeNet for face parsing/portrait segmentation
- SegFormer for semantic segmentation
- LaMa for inpainting/object removal
- Agent chat for natural language photo search
- OCR text extraction (PaddleOCR-VL)
- Background removal
- Auto-tagging

#### Utilities
- Storage cleanup (duplicates, blurry, documents)
- Batch rename with pattern templates
- Backup and restore
- Diagnostics and monitoring
- Telemetry (opt-in)

#### CLI
- Thin REST client for backend
- Commands: status, stats, photos, search, people, albums
- Import/export functionality
- Config management
- JSON output mode

#### Backend
- Rust (Axum) high-performance backend
- SQLite with WAL mode and FTS5
- Background processing pipeline
- Rate limiting and CORS
- API key authentication
- Telemetry tracking
- LAN sync support
- Docker containerization

#### Frontend
- React 18 + TypeScript 5.8
- Vite 6 for fast development
- Tailwind CSS for styling
- Zustand for state management
- Tauri v2 for desktop shell
- Leaflet for map view
- Framer Motion for animations
- TanStack Virtual for virtualization

### Changed
- Migrated from Python backend to Rust
- Improved performance with in-process ML
- Enhanced security with local-first architecture

### Fixed
- Thumbnail generation issues
- Database migration errors
- Memory leaks in video processing
- CORS configuration issues

## [0.0.1] - 2023-12-XX

### Added
- Initial project setup
- Basic photo import and viewing
- Simple metadata extraction
- SQLite database
- Vite + React frontend

---

## Versioning

- **Major**: Breaking changes or significant feature additions
- **Minor**: New features without breaking changes
- **Patch**: Bug fixes and minor improvements

## Release Process

1. Update version in `package.json` and `Cargo.toml`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. Create GitHub release with release notes

## Support

- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/yourusername/prism/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/prism/discussions)
