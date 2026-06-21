from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Boolean, Float, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), index=True)
    path: Mapped[str] = mapped_column(String(512), index=True)
    url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    aspect_ratio: Mapped[float] = mapped_column(Float)
    hash: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)

    # Metadata
    caption: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # Granular location fields (replaces single location string)
    city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    state: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    country: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Legacy single-string location for backwards compatibility (auto-computed)
    location: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    date_taken: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    upload_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    # Flags - indexed for common filtering
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_trash: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Type (image/video)
    mime_type: Mapped[str] = mapped_column(String(50), default="image/jpeg")
    file_type: Mapped[str] = mapped_column(String(20), default="image")

    # Storage Device Tracking
    device_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_external: Mapped[bool] = mapped_column(Boolean, default=False)

    # AI Summary
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    auto_tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)

    # Sharpness / Blur estimation
    blur_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None, index=True)

    # Pre-cached file size (bytes)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=None)

    # Relationships
    people: Mapped[list["PhotoPerson"]] = relationship("PhotoPerson", back_populates="photo", cascade="all, delete-orphan")
    event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    event: Mapped[Optional["Event"]] = relationship("Event", back_populates="photos", foreign_keys=[event_id])


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    event_type: Mapped[str] = mapped_column(String(50), default="trip")  # e.g., trip, birthday, holiday, wedding
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cover_photo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("photos.id", ondelete="SET NULL", use_alter=True, name="fk_events_cover_photo"), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    photos: Mapped[list["Photo"]] = relationship("Photo", back_populates="event", foreign_keys="[Photo.event_id]")


class Album(Base):
    """Manual or auto-generated albums for Places, Memories."""
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(20))  # places | memories | people
    cover_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    photo_count: Mapped[int] = mapped_column(Integer, default=0)

    # JSON metadata: for places → {"city": ..., "state": ..., "country": ...}
    # for memories → {"year": ..., "month": ...}
    # for people → {"person_id": ...}
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


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


class Person(Base):
    """Represents a unique clustered individual."""
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    cover_face_thumbnail: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    face_embedding: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list of floats representing face embedding

    # Relationships
    photos: Mapped[list["PhotoPerson"]] = relationship("PhotoPerson", back_populates="person", cascade="all, delete-orphan")


class PhotoPerson(Base):
    """Many-to-Many association table with face detection details."""
    __tablename__ = "photo_people"
    
    __table_args__ = (
        Index("idx_photo_people_composite", "person_id", "photo_id"),
    )

    photo_id: Mapped[int] = mapped_column(
        ForeignKey("photos.id", ondelete="CASCADE"), 
        primary_key=True,
        index=True
    )
    person_id: Mapped[int] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"), 
        primary_key=True,
        index=True
    )
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    face_box_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Store x, y, w, h boundaries

    # Relationships
    photo: Mapped["Photo"] = relationship(back_populates="people")
    person: Mapped["Person"] = relationship(back_populates="photos")


class PendingFaceAssignment(Base):
    """Stores borderline face assignments awaiting user verification."""
    __tablename__ = "pending_face_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    photo_id: Mapped[int] = mapped_column(
        ForeignKey("photos.id", ondelete="CASCADE"),
        index=True
    )
    candidate_person_id: Mapped[int] = mapped_column(
        ForeignKey("people.id", ondelete="CASCADE"),
        index=True
    )
    best_score: Mapped[float] = mapped_column(Float)
    face_box_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumb_filename: Mapped[str] = mapped_column(String(255))
    face_embedding: Mapped[str] = mapped_column(Text)  # JSON representation of embedding feature array
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    photo: Mapped["Photo"] = relationship()
    candidate_person: Mapped["Person"] = relationship()


class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    photo_id: Mapped[int] = mapped_column(
        ForeignKey("photos.id", ondelete="CASCADE"),
        index=True
    )
    job_type: Mapped[str] = mapped_column(String(50), index=True)  # e.g., "vision_pipeline" or "face_scan"
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending | processing | completed | failed
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    photo: Mapped["Photo"] = relationship()





