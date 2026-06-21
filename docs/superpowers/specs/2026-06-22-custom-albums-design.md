# Custom Albums Design Specification

This document details the database schema, API endpoints, and frontend components to support manual/custom albums in Prism.

## 1. Goal Description

Prism should support custom/manual user-created albums. Users should be able to:
- Select photos in the library and add them to existing custom albums or a new custom album.
- Directly create new albums from the Albums tab.
- View and manage photos inside custom albums.
- Remove photos from custom albums (both from the bulk action bar and from the lightbox view).
- Manually assign a photo in the album to serve as the album's cover image.
- Automatically fallback to the latest remaining photo as the cover when photos are added or removed.

## 2. Architecture & Database Schema

We introduce a many-to-many relationship table in SQLite linking `photos` and `albums`.

### New Model: `PhotoAlbum`
```python
class PhotoAlbum(Base):
    """Many-to-Many association table linking Photos to custom Albums."""
    __tablename__ = "photo_albums"
    
    photo_id: Mapped[int] = mapped_column(
        ForeignKey("photos.id", ondelete="CASCADE"), 
        primary_key=True,
        index=True
    )
    album_id: Mapped[int] = mapped_column(
        ForeignKey("albums.id", ondelete="CASCADE"), 
        primary_key=True,
        index=True
    )
```

For custom albums, the `Album` model's `type` field will store `"custom"`.

---

## 3. Backend Endpoints

In `backend/app/api/albums/__init__.py`:

### `GET /api/v1/albums/`
Returns all custom albums.
- **SQL**: `SELECT * FROM albums WHERE type = 'custom'`

### `POST /api/v1/albums/`
Creates a new custom album.
- **Request**: `{"name": "Trip to Paris"}`
- **Response**: The created Album object.

### `DELETE /api/v1/albums/{album_id}`
Deletes a custom album. (Cascades to remove all associations in `photo_albums`, but does not delete the actual photos).

### `POST /api/v1/albums/{album_id}/rename`
Renames an existing album.
- **Request**: `{"name": "New Name"}`

### `GET /api/v1/albums/{album_id}/photos`
Returns all photos inside the album, sorted by date taken descending.

### `POST /api/v1/albums/{album_id}/add-photos`
Links a list of photos to the album.
- **Request**: `{"photo_ids": [12, 15, 18]}`
- **Behavior**: 
  - Inserts links into `photo_albums` (handling duplicate links gracefully).
  - Recalculates and updates the album's `photo_count`.
  - Automatically updates the album's `cover_url` to the thumbnail/URL of the most recently added photo (if not manually overridden).

### `POST /api/v1/albums/{album_id}/remove-photos`
Unlinks a list of photos from the album.
- **Request**: `{"photo_ids": [12]}`
- **Behavior**:
  - Deletes the corresponding rows in `photo_albums`.
  - Updates the `photo_count`.
  - If the removed photo was the current album cover, sets the cover to the most recently added remaining photo. If the album is now empty, sets the cover to `None`.

### `POST /api/v1/albums/{album_id}/set-cover`
Manually sets a photo as the cover photo for the album.
- **Request**: `{"photo_id": 15}`
- **Behavior**:
  - Updates the album's `cover_url` to the selected photo's thumbnail/url.

---

## 4. Frontend Component Flow

### Add To Album Dialog (`AddToAlbumDialog.tsx`)
A new modal component opened when a user clicks "Add to Album" on selected photos:
- Shows a search/scrollable list of all custom albums.
- Has a "Create New Album" section at the top of the dialog.
- Clicking an album triggers the `/add-photos` endpoint and closes the dialog.

### Albums Grid (`AlbumsList.tsx` & `AlbumsView.tsx`)
- Adds a dashed "Create Album" placeholder card at the start of the list.
- Double-clicking or clicking the gear/dot menu on an album card triggers rename/delete prompts.

### Album Detail View (`AlbumDetail.tsx`)
- Displays photos belonging to the selected album.
- Supports selection. When items are selected inside this view, the BulkActionsBar shows a "Remove from Album" button.

### Lightbox View (`Lightbox.tsx`)
- When the lightbox is opened from an album, it receives the `album` context.
- If an album context is active, the Toolbar shows:
  - An icon/button to "Remove from Album" (calls `/remove-photos`).
  - An icon/button to "Set as Album Cover" (calls `/set-cover`).
