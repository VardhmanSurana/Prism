"""LAN Sync service — mDNS discovery, peer management, and photo transfer."""

import asyncio
import hashlib
import logging
import os
import platform
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import httpx
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import async_session
from app.models import Photo, SyncPeer

logger = logging.getLogger(__name__)

SERVICE_TYPE = "_prism-sync._tcp.local."
SERVICE_NAME_PREFIX = "Prism"
LOCAL_PEER_ID = uuid.uuid4().hex[:16]


class SyncState:
    """Tracks in-flight sync operation state."""

    def __init__(self) -> None:
        self.active: bool = False
        self.peer_id: Optional[str] = None
        self.direction: str = ""  # "import" or "export"
        self.total: int = 0
        self.completed: int = 0
        self.current_photo: str = ""
        self.error: Optional[str] = None
        self.started_at: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "active": self.active,
            "peer_id": self.peer_id,
            "direction": self.direction,
            "total": self.total,
            "completed": self.completed,
            "current_photo": self.current_photo,
            "error": self.error,
            "started_at": self.started_at.isoformat() if self.started_at else None,
        }


class LanSyncService:
    """Core LAN sync service: mDNS advertisement, discovery, pairing, photo transfer."""

    def __init__(self) -> None:
        self._zeroconf = None
        self._browser = None
        self._service_info = None
        self._peers: dict[str, dict[str, Any]] = {}  # peer_id -> info
        self._sync_state = SyncState()
        self._server_task: Optional[asyncio.Task] = None
        self._browse_task: Optional[asyncio.Task] = None
        self._http_client: Optional[httpx.AsyncClient] = None

    @property
    def sync_state(self) -> SyncState:
        return self._sync_state

    @property
    def peers(self) -> dict[str, dict[str, Any]]:
        return self._peers

    async def start(self) -> None:
        """Start mDNS advertisement and browsing."""
        if not settings.ENABLE_LAN_SYNC:
            logger.info("LAN sync is disabled (ENABLE_LAN_SYNC=False)")
            return

        try:
            from zeroconf import Zeroconf, ServiceInfo
        except ImportError:
            logger.warning("zeroconf not installed — LAN sync unavailable")
            return

        try:
            hostname = platform.node() or "prism-device"
            port = settings.LAN_SYNC_PORT

            self._zeroconf = Zeroconf()

            self._service_info = ServiceInfo(
                SERVICE_TYPE,
                f"{SERVICE_NAME_PREFIX} {hostname} ({LOCAL_PEER_ID[:8]}).{SERVICE_TYPE}",
                addresses=[],
                port=port,
                properties={
                    "peer_id": LOCAL_PEER_ID,
                    "hostname": hostname,
                    "version": "1",
                    "device_type": "desktop" if not _is_mobile() else "mobile",
                },
            )

            # Resolve local IP
            import socket
            local_ip = _get_local_ip()
            if local_ip:
                import ipaddress
                self._service_info.addresses = [ipaddress.ip_address(local_ip).packed]

            self._zeroconf.register_service(self._service_info)
            logger.info(f"mDNS advertising as {self._service_info.name} on port {port}")

            self._browse_task = asyncio.create_task(self._browse_peers())

        except Exception as e:
            logger.error(f"Failed to start LAN sync: {e}")

    async def stop(self) -> None:
        """Stop mDNS and clean up."""
        if self._browse_task:
            self._browse_task.cancel()
            try:
                await self._browse_task
            except asyncio.CancelledError:
                pass

        if self._zeroconf and self._service_info:
            try:
                self._zeroconf.unregister_service(self._service_info)
                self._zeroconf.close()
            except Exception:
                pass

        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

        logger.info("LAN sync stopped")

    def get_http_client(self) -> httpx.AsyncClient:
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=300.0))
        return self._http_client

    async def _browse_peers(self) -> None:
        """Continuously browse for Prism peers on the network."""
        from zeroconf import ServiceBrowser

        if not self._zeroconf:
            return

        loop = asyncio.get_event_loop()

        def on_service_state_change(zeroconf: Any, service_type: str, name: str, state_change: Any) -> None:
            asyncio.run_coroutine_threadsafe(
                self._handle_service_change(service_type, name, state_change), loop
            )

        self._browser = ServiceBrowser(
            self._zeroconf, SERVICE_TYPE, handlers=[on_service_state_change]
        )

        try:
            while True:
                await asyncio.sleep(60)
                await self._cleanup_stale_peers()
        except asyncio.CancelledError:
            pass

    async def _handle_service_change(self, service_type: str, name: str, state_change: Any) -> None:
        """Handle mDNS service discovery events."""
        from zeroconf import ServiceStateChange

        if state_change == ServiceStateChange.Added:
            await self._add_peer(service_type, name)
        elif state_change == ServiceStateChange.Removed:
            await self._remove_peer(name)
        elif state_change == ServiceStateChange.Updated:
            await self._update_peer(service_type, name)

    async def _add_peer(self, service_type: str, name: str) -> None:
        """Add a discovered peer."""
        if not self._zeroconf:
            return

        try:
            info = self._zeroconf.get_service_info(service_type, name)
            if not info:
                return

            peer_id = info.properties.get(b"peer_id", b"").decode() if isinstance(info.properties.get(b"peer_id"), bytes) else ""
            if not peer_id or peer_id == LOCAL_PEER_ID:
                return

            hostname = info.properties.get(b"hostname", b"unknown").decode() if isinstance(info.properties.get(b"hostname"), bytes) else "unknown"
            device_type = info.properties.get(b"device_type", b"desktop").decode() if isinstance(info.properties.get(b"device_type"), bytes) else "desktop"

            import ipaddress
            ip_address = "unknown"
            if info.parsed_addresses():
                ip_address = info.parsed_addresses()[0]

            peer_info = {
                "peer_id": peer_id,
                "hostname": hostname,
                "ip_address": ip_address,
                "port": info.port,
                "device_type": device_type,
                "last_seen": datetime.now(timezone.utc),
                "paired": False,
            }

            self._peers[peer_id] = peer_info
            await self._persist_peer(peer_info)
            logger.info(f"Discovered peer: {hostname} ({peer_id}) at {ip_address}:{info.port}")

        except Exception as e:
            logger.error(f"Error adding peer {name}: {e}")

    async def _remove_peer(self, name: str) -> None:
        """Remove a lost peer by service name (extract peer_id from name)."""
        for peer_id, info in list(self._peers.items()):
            if info.get("_service_name") == name:
                del self._peers[peer_id]
                logger.info(f"Peer lost: {info['hostname']} ({peer_id})")
                break

    async def _update_peer(self, service_type: str, name: str) -> None:
        """Update an existing peer's info."""
        await self._add_peer(service_type, name)

    async def _cleanup_stale_peers(self) -> None:
        """Remove peers not seen in 5 minutes."""
        cutoff = datetime.now(timezone.utc)
        stale = []
        for peer_id, info in self._peers.items():
            last_seen = info.get("last_seen", cutoff)
            if isinstance(last_seen, datetime):
                diff = (cutoff - last_seen).total_seconds()
                if diff > 300:
                    stale.append(peer_id)
        for peer_id in stale:
            del self._peers[peer_id]
            logger.info(f"Cleaned up stale peer: {peer_id}")

    async def _persist_peer(self, peer_info: dict[str, Any]) -> None:
        """Persist peer to database."""
        try:
            async with async_session() as db:
                stmt = select(SyncPeer).where(SyncPeer.peer_id == peer_info["peer_id"])
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.hostname = peer_info["hostname"]
                    existing.ip_address = peer_info["ip_address"]
                    existing.port = peer_info["port"]
                    existing.last_seen = datetime.now(timezone.utc)
                    existing.device_type = peer_info["device_type"]
                else:
                    db.add(SyncPeer(
                        peer_id=peer_info["peer_id"],
                        hostname=peer_info["hostname"],
                        ip_address=peer_info["ip_address"],
                        port=peer_info["port"],
                        device_type=peer_info["device_type"],
                        paired=False,
                    ))
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to persist peer: {e}")

    async def discover_peers(self) -> list[dict[str, Any]]:
        """Return all discovered peers."""
        peers = []
        for peer_id, info in self._peers.items():
            peers.append({
                "peer_id": peer_id,
                "hostname": info["hostname"],
                "ip_address": info["ip_address"],
                "port": info["port"],
                "device_type": info["device_type"],
                "paired": info.get("paired", False),
            })
        return peers

    async def pair_with_peer(self, peer_id: str, pin: Optional[str] = None) -> dict[str, Any]:
        """Pair with a discovered peer. Sends pairing request, waits for confirmation."""
        peer = self._peers.get(peer_id)
        if not peer:
            return {"success": False, "error": "Peer not found"}

        client = self.get_http_client()
        url = f"http://{peer['ip_address']}:{peer['port']}/api/v1/lan/pair/request"

        try:
            resp = await client.post(url, json={
                "peer_id": LOCAL_PEER_ID,
                "hostname": platform.node() or "prism-device",
                "pin": pin or "",
                "device_type": "desktop" if not _is_mobile() else "mobile",
            })
            resp.raise_for_status()
            data = resp.json()

            if data.get("accepted"):
                peer["paired"] = True
                peer["paired_at"] = datetime.now(timezone.utc)
                await self._update_peer_paired_status(peer_id, True)
                return {"success": True, "message": "Paired successfully"}
            else:
                return {"success": False, "error": "Pairing rejected by peer"}
        except Exception as e:
            logger.error(f"Pairing failed with {peer_id}: {e}")
            return {"success": False, "error": str(e)}

    async def _update_peer_paired_status(self, peer_id: str, paired: bool) -> None:
        """Update paired status in database."""
        try:
            async with async_session() as db:
                stmt = select(SyncPeer).where(SyncPeer.peer_id == peer_id)
                result = await db.execute(stmt)
                peer = result.scalar_one_or_none()
                if peer:
                    peer.paired = paired
                    if paired:
                        peer.paired_at = datetime.now(timezone.utc)
                    await db.commit()
        except Exception as e:
            logger.error(f"Failed to update peer paired status: {e}")

    async def handle_pair_request(self, peer_id: str, hostname: str, pin: str, device_type: str) -> bool:
        """Handle incoming pairing request. Auto-accept for now (PIN check if configured)."""
        # TODO: implement PIN-based verification
        peer_info = {
            "peer_id": peer_id,
            "hostname": hostname,
            "ip_address": "unknown",
            "port": settings.LAN_SYNC_PORT,
            "device_type": device_type,
            "last_seen": datetime.now(timezone.utc),
            "paired": True,
        }
        self._peers[peer_id] = peer_info
        await self._persist_peer(peer_info)
        await self._update_peer_paired_status(peer_id, True)
        logger.info(f"Paired with peer: {hostname} ({peer_id})")
        return True

    async def initiate_sync(self, peer_id: str) -> dict[str, Any]:
        """Initiate a full metadata sync with a paired peer."""
        peer = self._peers.get(peer_id)
        if not peer:
            return {"success": False, "error": "Peer not found"}
        if not peer.get("paired"):
            return {"success": False, "error": "Peer not paired"}

        if self._sync_state.active:
            return {"success": False, "error": "Sync already in progress"}

        self._sync_state.active = True
        self._sync_state.peer_id = peer_id
        self._sync_state.direction = "export"
        self._sync_state.total = 0
        self._sync_state.completed = 0
        self._sync_state.error = None
        self._sync_state.started_at = datetime.now(timezone.utc)

        asyncio.create_task(self._run_sync(peer_id))
        return {"success": True, "message": "Sync initiated"}

    async def _run_sync(self, peer_id: str) -> None:
        """Run the sync process in background."""
        try:
            peer = self._peers.get(peer_id)
            if not peer:
                raise Exception("Peer not found")

            client = self.get_http_client()
            base_url = f"http://{peer['ip_address']}:{peer['port']}"

            # Step 1: Get peer's photo manifests
            resp = await client.get(f"{base_url}/api/v1/lan/manifest")
            resp.raise_for_status()
            peer_manifest = resp.json()

            # Step 2: Get local manifest
            local_manifest = await self._get_local_manifest()

            # Step 3: Find photos to import (in peer but not locally)
            local_hashes = {p["hash"] for p in local_manifest if p.get("hash")}
            to_import = [p for p in peer_manifest if p.get("hash") and p["hash"] not in local_hashes]

            self._sync_state.total = len(to_import)

            # Step 4: Import photos
            for photo_info in to_import:
                self._sync_state.current_photo = photo_info.get("filename", "unknown")
                try:
                    await self._import_photo_from_peer(base_url, photo_info)
                    self._sync_state.completed += 1
                except Exception as e:
                    logger.error(f"Failed to import {photo_info.get('filename')}: {e}")

            # Step 5: Handle conflicts (last-write-wins)
            await self._resolve_conflicts(base_url, local_manifest, peer_manifest)

            self._sync_state.active = False
            self._sync_state.current_photo = ""
            logger.info(f"Sync complete with {peer_id}: {self._sync_state.completed}/{self._sync_state.total} imported")

        except Exception as e:
            self._sync_state.active = False
            self._sync_state.error = str(e)
            logger.error(f"Sync failed with {peer_id}: {e}")

    async def _get_local_manifest(self) -> list[dict[str, Any]]:
        """Get lightweight manifest of local photos (id, hash, filename, updated_at)."""
        async with async_session() as db:
            stmt = select(Photo.id, Photo.hash, Photo.filename, Photo.upload_date).where(
                and_(Photo.is_trash == False, Photo.is_locked == False)
            )
            result = await db.execute(stmt)
            return [
                {"id": row[0], "hash": row[1], "filename": row[2], "updated_at": row[3].isoformat() if row[3] else ""}
                for row in result.all()
            ]

    async def _import_photo_from_peer(self, base_url: str, photo_info: dict[str, Any]) -> None:
        """Download and import a single photo from a peer."""
        client = self.get_http_client()
        photo_id = photo_info["id"]

        # Download photo file
        resp = await client.get(f"{base_url}/api/v1/lan/photos/{photo_id}/file")
        resp.raise_for_status()

        filename = photo_info.get("filename", f"lan_{photo_id}.jpg")
        save_path = settings.UPLOAD_DIR / filename

        # Write file in chunks
        with open(save_path, "wb") as f:
            async for chunk in resp.aiter_bytes(chunk_size=settings.LAN_SYNC_CHUNK_SIZE):
                f.write(chunk)

        # Get metadata
        meta_resp = await client.get(f"{base_url}/api/v1/lan/photos/{photo_id}/metadata")
        meta_resp.raise_for_status()
        metadata = meta_resp.json()

        # Import into local database
        async with async_session() as db:
            new_photo = Photo(
                filename=filename,
                path=str(save_path),
                url=f"/uploads/{filename}",
                width=metadata.get("width", 0),
                height=metadata.get("height", 0),
                aspect_ratio=metadata.get("aspect_ratio", 1.0),
                hash=photo_info.get("hash"),
                caption=metadata.get("caption"),
                city=metadata.get("city"),
                state=metadata.get("state"),
                country=metadata.get("country"),
                latitude=metadata.get("latitude"),
                longitude=metadata.get("longitude"),
                mime_type=metadata.get("mime_type", "image/jpeg"),
                file_type=metadata.get("file_type", "image"),
                content_type=metadata.get("content_type", "photo"),
                device_id=f"lan_{photo_info.get('peer_id', 'unknown')}",
                is_external=True,
                file_size=os.path.getsize(save_path),
            )
            db.add(new_photo)
            await db.commit()

    async def _resolve_conflicts(
        self, base_url: str, local_manifest: list[dict], peer_manifest: list[dict]
    ) -> None:
        """Resolve conflicts between local and peer manifests using last-write-wins."""
        local_by_hash: dict[str, dict] = {p["hash"]: p for p in local_manifest if p.get("hash")}
        peer_by_hash: dict[str, dict] = {p["hash"]: p for p in peer_manifest if p.get("hash")}

        for h, peer_p in peer_by_hash.items():
            local_p = local_by_hash.get(h)
            if not local_p:
                continue

            local_dt = local_p.get("updated_at", "")
            peer_dt = peer_p.get("updated_at", "")

            if peer_dt > local_dt:
                # Peer is newer — update local metadata
                await self._update_local_metadata_from_peer(base_url, peer_p["id"], local_p["id"])

    async def _update_local_metadata_from_peer(
        self, base_url: str, remote_photo_id: int, local_photo_id: int
    ) -> None:
        """Update local photo metadata from peer."""
        client = self.get_http_client()
        try:
            resp = await client.get(f"{base_url}/api/v1/lan/photos/{remote_photo_id}/metadata")
            resp.raise_for_status()
            metadata = resp.json()

            async with async_session() as db:
                photo = await db.get(Photo, local_photo_id)
                if photo:
                    for field in ("caption", "city", "state", "country", "latitude", "longitude"):
                        if field in metadata and metadata[field] is not None:
                            setattr(photo, field, metadata[field])
                    await db.commit()
        except Exception as e:
            logger.error(f"Failed to update metadata from peer: {e}")

    async def import_from_peer(self, peer_id: str, photo_ids: Optional[list[int]] = None) -> dict[str, Any]:
        """Import specific photos from a peer."""
        peer = self._peers.get(peer_id)
        if not peer:
            return {"success": False, "error": "Peer not found"}
        if not peer.get("paired"):
            return {"success": False, "error": "Peer not paired"}

        if self._sync_state.active:
            return {"success": False, "error": "Sync already in progress"}

        self._sync_state.active = True
        self._sync_state.peer_id = peer_id
        self._sync_state.direction = "import"
        self._sync_state.total = len(photo_ids) if photo_ids else 0
        self._sync_state.completed = 0
        self._sync_state.error = None
        self._sync_state.started_at = datetime.now(timezone.utc)

        asyncio.create_task(self._run_import(peer_id, photo_ids))
        return {"success": True, "message": "Import initiated"}

    async def _run_import(self, peer_id: str, photo_ids: Optional[list[int]] = None) -> None:
        """Run selective photo import."""
        try:
            peer = self._peers.get(peer_id)
            if not peer:
                raise Exception("Peer not found")

            client = self.get_http_client()
            base_url = f"http://{peer['ip_address']}:{peer['port']}"

            # Get peer manifest
            resp = await client.get(f"{base_url}/api/v1/lan/manifest")
            resp.raise_for_status()
            peer_manifest = resp.json()

            # Filter to requested photos
            if photo_ids:
                to_import = [p for p in peer_manifest if p["id"] in photo_ids]
            else:
                local_manifest = await self._get_local_manifest()
                local_hashes = {p["hash"] for p in local_manifest if p.get("hash")}
                to_import = [p for p in peer_manifest if p.get("hash") and p["hash"] not in local_hashes]

            self._sync_state.total = len(to_import)

            for photo_info in to_import:
                self._sync_state.current_photo = photo_info.get("filename", "unknown")
                try:
                    await self._import_photo_from_peer(base_url, photo_info)
                    self._sync_state.completed += 1
                except Exception as e:
                    logger.error(f"Failed to import {photo_info.get('filename')}: {e}")

            self._sync_state.active = False
        except Exception as e:
            self._sync_state.active = False
            self._sync_state.error = str(e)
            logger.error(f"Import failed: {e}")

    # ── Server-side endpoints (serving data to peers) ──

    async def get_manifest(self) -> list[dict[str, Any]]:
        """Return a lightweight manifest of photos available for sync."""
        async with async_session() as db:
            stmt = select(
                Photo.id, Photo.filename, Photo.hash, Photo.width, Photo.height,
                Photo.upload_date, Photo.caption, Photo.file_size, Photo.mime_type,
                Photo.file_type, Photo.content_type
            ).where(
                and_(Photo.is_trash == False, Photo.is_locked == False)
            )
            result = await db.execute(stmt)
            return [
                {
                    "id": row[0], "filename": row[1], "hash": row[2],
                    "width": row[3], "height": row[4],
                    "updated_at": row[5].isoformat() if row[5] else "",
                    "caption": row[6], "file_size": row[7],
                    "mime_type": row[8], "file_type": row[9],
                    "content_type": row[10],
                }
                for row in result.all()
            ]

    async def get_photo_metadata(self, photo_id: int) -> Optional[dict[str, Any]]:
        """Return full metadata for a photo."""
        async with async_session() as db:
            photo = await db.get(Photo, photo_id)
            if not photo or photo.is_locked:
                return None
            return {
                "id": photo.id,
                "filename": photo.filename,
                "width": photo.width,
                "height": photo.height,
                "aspect_ratio": photo.aspect_ratio,
                "caption": photo.caption,
                "city": photo.city,
                "state": photo.state,
                "country": photo.country,
                "latitude": photo.latitude,
                "longitude": photo.longitude,
                "mime_type": photo.mime_type,
                "file_type": photo.file_type,
                "content_type": photo.content_type,
                "date_taken": photo.date_taken.isoformat() if photo.date_taken else None,
                "is_favorite": photo.is_favorite,
                "hash": photo.hash,
            }

    async def get_photo_file_path(self, photo_id: int) -> Optional[Path]:
        """Return the file path for a photo, or None if not accessible."""
        async with async_session() as db:
            photo = await db.get(Photo, photo_id)
            if not photo or photo.is_locked:
                return None
            p = Path(photo.path)
            return p if p.exists() else None


def _get_local_ip() -> Optional[str]:
    """Get the local LAN IP address."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def _is_mobile() -> bool:
    """Check if running on a mobile platform."""
    return platform.system() in ("Android",) or "android" in platform.platform().lower()


lan_sync_service = LanSyncService()
