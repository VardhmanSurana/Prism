"""
XMP sidecar export/import for Prism.

Generates and reads XMP sidecar files compatible with digiKam, Lightroom,
and other photo management tools. Sidecars sit alongside the original photo
with the same basename + .xmp extension.

Exports: ratings, keywords/tags, title/description, date, GPS, face regions.
Import: reads sidecars and updates Prism database fields.

XMP spec references:
- Dublin Core (dc): title, subject, date
- XMP Basic (xmp): Rating, CreateDate
- XMP Media Management (xmpMM): InstanceID
- IPTC4XMPExt: Face regions (mp:RegionInfo)
- Adobe Lightroom: hierarchicalSubject for keywords
"""

import json
import os
import logging
import uuid
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Photo, Person, PhotoPerson

logger = logging.getLogger(__name__)

# XMP namespace declarations
XMP_NS = {
    "x": "adobe:ns:meta/",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "dc": "http://purl.org/dc/elements/1.1/",
    "xmp": "http://ns.adobe.com/xap/1.0/",
    "xmpRights": "http://ns.adobe.com/xap/1.0/rights/",
    "photoshop": "http://ns.adobe.com/photoshop/1.0/",
    "crd": "http://ns.adobe.com/camera-raw-settings/1.0/",
    "aux": "http://ns.adobe.com/exif/1.0/aux/",
    "mp": "http://ns.microsoft.com/photo/1.2/",
    "MP": "http://schemas.microsoft.com/mediafoundation/2008/11/mpmetadata",
    "digiKam": "http://www.digikam.org/ns/1.0/",
    "lr": "http://ns.adobe.com/lightroom/1.0/",
    "MicrosoftPhoto": "http://ns.microsoft.com/photo/1.0/",
}

# Prefix map for pretty-printing
PREFIX_MAP = {
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "dc": "http://purl.org/dc/elements/1.1/",
    "xmp": "http://ns.adobe.com/xap/1.0/",
    "mp": "http://ns.microsoft.com/photo/1.2/",
    "lr": "http://ns.adobe.com/lightroom/1.0/",
    "digiKam": "http://www.digikam.org/ns/1.0/",
}


def _register_namespaces():
    """Register all XMP namespaces with ElementTree for clean output."""
    for prefix, uri in XMP_NS.items():
        ET.register_namespace(prefix, uri)


def _get_sidecar_path(photo_path: str) -> str:
    """Return the XMP sidecar path for a given photo path."""
    base, _ = os.path.splitext(photo_path)
    return base + ".xmp"


def _parse_face_box_json(face_box_json: str, photo_width: int, photo_height: int) -> dict | None:
    """Parse face box JSON and normalize to 0-1 range for XMP.

    Face boxes from Prism are in pixel coordinates: {"x": x1, "y": y1, "w": w, "h": h}.
    XMP face regions use normalized coordinates (0-1 range).
    """
    try:
        box = json.loads(face_box_json)
        x = float(box.get("x", 0))
        y = float(box.get("y", 0))
        w = float(box.get("w", 0))
        h = float(box.get("h", 0))

        if photo_width <= 0 or photo_height <= 0:
            return None

        return {
            "x": x / photo_width,
            "y": y / photo_height,
            "w": w / photo_width,
            "h": h / photo_height,
        }
    except (json.JSONDecodeError, ValueError, TypeError):
        return None


def _normalize_face_box_to_pixels(normalized: dict, photo_width: int, photo_height: int) -> dict:
    """Convert normalized face box (0-1) back to pixel coordinates."""
    return {
        "x": normalized["x"] * photo_width,
        "y": normalized["y"] * photo_height,
        "w": normalized["w"] * photo_width,
        "h": normalized["h"] * photo_height,
    }


def _format_xmp_date(dt: datetime | None) -> str:
    """Format datetime to XMP date format (ISO 8601 with timezone)."""
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _parse_xmp_date(date_str: str) -> datetime | None:
    """Parse XMP date string to datetime."""
    if not date_str:
        return None
    try:
        # Handle various ISO formats
        date_str = date_str.strip()
        if date_str.endswith("Z"):
            date_str = date_str[:-1] + "+00:00"
        return datetime.fromisoformat(date_str)
    except ValueError:
        return None


def export_xmp_sidecar(photo, face_regions: list[dict] | None = None) -> str:
    """Generate XMP sidecar XML string for a photo.

    Args:
        photo: Photo model instance (with people relationship loaded if desired).
        face_regions: Optional list of face region dicts with keys:
            - name: Person name
            - x, y, w, h: Normalized coordinates (0-1)
            - confidence: Detection confidence (optional)

    Returns:
        XMP XML string.
    """
    _register_namespaces()

    # Build the RDF Description
    rdf_desc = ET.Element("rdf:Description")

    # Core properties
    rdf_desc.set("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about", "")

    # Title (from caption)
    if photo.caption:
        dc_title = ET.SubElement(rdf_desc, "dc:title")
        dc_title.set("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}parseType", "Literal")
        title_alt = ET.SubElement(dc_title, "rdf:Alt")
        title_li = ET.SubElement(title_alt, "rdf:li")
        title_li.set("xml:lang", "x-default")
        title_li.text = photo.caption

    # Description (from ai_summary)
    if photo.ai_summary:
        dc_desc = ET.SubElement(rdf_desc, "dc:description")
        dc_desc.set("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}parseType", "Literal")
        desc_alt = ET.SubElement(dc_desc, "rdf:Alt")
        desc_li = ET.SubElement(desc_alt, "rdf:li")
        desc_li.set("xml:lang", "x-default")
        desc_li.text = photo.ai_summary[:1000]  # Truncate for XMP

    # Rating (is_favorite → 5 stars)
    xmp_rating = ET.SubElement(rdf_desc, "xmp:Rating")
    xmp_rating.text = "5" if photo.is_favorite else "0"

    # Date
    if photo.date_taken:
        xmp_date = ET.SubElement(rdf_desc, "xmp:DateCreated")
        xmp_date.text = _format_xmp_date(photo.date_taken)

    # Keywords / Tags
    tags = _parse_auto_tags(photo.auto_tags)
    if tags:
        dc_subject = ET.SubElement(rdf_desc, "dc:subject")
        subject_bag = ET.SubElement(dc_subject, "rdf:Bag")
        for tag in tags:
            li = ET.SubElement(subject_bag, "rdf:li")
            li.text = tag

        # Lightroom-compatible hierarchicalSubject
        lr_hier = ET.SubElement(rdf_desc, "lr:hierarchicalSubject")
        lr_bag = ET.SubElement(lr_hier, "rdf:Bag")
        for tag in tags:
            li = ET.SubElement(lr_bag, "rdf:li")
            li.text = tag

    # GPS coordinates
    if photo.latitude is not None and photo.longitude is not None:
        gps_lat = ET.SubElement(rdf_desc, "exif:GPSLatitude")
        gps_lat.text = str(photo.latitude)
        gps_lat_ref = ET.SubElement(rdf_desc, "exif:GPSLatitudeRef")
        gps_lat_ref.text = "N" if photo.latitude >= 0 else "S"

        gps_lon = ET.SubElement(rdf_desc, "exif:GPSLongitude")
        gps_lon.text = str(photo.longitude)
        gps_lon_ref = ET.SubElement(rdf_desc, "exif:GPSLongitudeRef")
        gps_lon_ref.text = "E" if photo.longitude >= 0 else "W"

    # Location
    location_parts = [p for p in [photo.city, photo.state, photo.country] if p]
    if location_parts:
        location_str = ", ".join(location_parts)
        photoshop_location = ET.SubElement(rdf_desc, "photoshop:City")
        photoshop_location.text = photo.city or ""
        if photo.state:
            photoshop_state = ET.SubElement(rdf_desc, "photoshop:State")
            photoshop_state.text = photo.state
        if photo.country:
            photoshop_country = ET.SubElement(rdf_desc, "photoshop:Country")
            photoshop_country.text = photo.country

    # Face regions (Microsoft Photo metadata format — digiKam & Lightroom compatible)
    if face_regions:
        region_info = ET.SubElement(rdf_desc, "MP:RegionInfo")
        region_list = ET.SubElement(region_info, "MP:RegionList")
        region_list.set("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}parseType", "Resource")

        for region in face_regions:
            region_entry = ET.SubElement(region_list, "MP:Region")
            region_entry.set("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}parseType", "Resource")

            # Person name
            if region.get("name"):
                region_name = ET.SubElement(region_entry, "MP:Name")
                region_name.text = region["name"]

            # Region type (Face/Person)
            region_type = ET.SubElement(region_entry, "MP:Type")
            region_type.text = "Face"

            # Rectangle (normalized 0-1 coordinates)
            rect = ET.SubElement(region_entry, "MP:Rectangle")
            x = region.get("x", 0)
            y = region.get("y", 0)
            w = region.get("w", 0)
            h = region.get("h", 0)
            rect.text = f"{x}, {y}, {w}, {h}"

    # Build the full XMP document
    xpacket = ET.Element("x:xmpmeta")
    xpacket.set("xmlns:x", "adobe:ns:meta/")
    rdf_rdf = ET.SubElement(xpacket, "rdf:RDF")
    rdf_rdf.append(rdf_desc)

    # Add processing instruction and header
    lines = [
        '<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>',
        '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    ]

    # Pretty-print the RDF
    ET.indent(xpacket, space="  ")
    rdf_str = ET.tostring(rdf_rdf, encoding="unicode", xml_declaration=False)
    lines.append(rdf_str)

    lines.append('</x:xmpmeta>')
    lines.append('<?xpacket end="w"?>')

    return "\n".join(lines)


def export_xmp_to_file(photo, face_regions: list[dict] | None = None, sidecar_path: str | None = None) -> str:
    """Export XMP sidecar to a file alongside the photo.

    Args:
        photo: Photo model instance.
        face_regions: Optional face region data.
        sidecar_path: Override path. If None, uses photo_path.xmp.

    Returns:
        Path to the written XMP file.
    """
    if sidecar_path is None:
        sidecar_path = _get_sidecar_path(photo.path)

    xmp_content = export_xmp_sidecar(photo, face_regions)

    os.makedirs(os.path.dirname(sidecar_path), exist_ok=True)
    with open(sidecar_path, "w", encoding="utf-8") as f:
        f.write(xmp_content)

    logger.info(f"Exported XMP sidecar: {sidecar_path}")
    return sidecar_path


def import_xmp_sidecar(sidecar_path: str) -> dict:
    """Parse an XMP sidecar file and return extracted metadata.

    Args:
        sidecar_path: Path to the .xmp file.

    Returns:
        Dict with keys matching Photo model fields:
        - caption, is_favorite, date_taken, auto_tags, latitude, longitude,
        - city, state, country, face_regions (list of dicts)
    """
    if not os.path.exists(sidecar_path):
        return {}

    try:
        tree = ET.parse(sidecar_path)
        root = tree.getroot()
    except ET.ParseError as e:
        logger.warning(f"Failed to parse XMP sidecar {sidecar_path}: {e}")
        return {}

    result = {
        "caption": None,
        "is_favorite": None,
        "date_taken": None,
        "auto_tags": None,
        "latitude": None,
        "longitude": None,
        "city": None,
        "state": None,
        "country": None,
        "face_regions": [],
    }

    # Find rdf:Description
    rdf_desc = root.find(".//rdf:Description", XMP_NS)
    if rdf_desc is None:
        return result

    # Title → caption
    title_el = rdf_desc.find("dc:title/rdf:Alt/rdf:li", XMP_NS)
    if title_el is not None and title_el.text:
        result["caption"] = title_el.text

    # Rating → is_favorite
    rating_el = rdf_desc.find("xmp:Rating", XMP_NS)
    if rating_el is not None and rating_el.text:
        try:
            result["is_favorite"] = int(rating_el.text) >= 3
        except ValueError:
            pass

    # Date
    date_el = rdf_desc.find("xmp:DateCreated", XMP_NS)
    if date_el is not None and date_el.text:
        result["date_taken"] = _parse_xmp_date(date_el.text)

    # Keywords
    subject_bag = rdf_desc.find("dc:subject/rdf:Bag", XMP_NS)
    if subject_bag is not None:
        tags = []
        for li in subject_bag.findall("rdf:li", XMP_NS):
            if li.text:
                tags.append(li.text)
        if tags:
            result["auto_tags"] = json.dumps(tags)

    # GPS
    lat_el = rdf_desc.find("exif:GPSLatitude", XMP_NS)
    lat_ref = rdf_desc.find("exif:GPSLatitudeRef", XMP_NS)
    lon_el = rdf_desc.find("exif:GPSLongitude", XMP_NS)
    lon_ref = rdf_desc.find("exif:GPSLongitudeRef", XMP_NS)

    if lat_el is not None and lat_el.text:
        try:
            lat = float(lat_el.text)
            if lat_ref is not None and lat_ref.text == "S":
                lat = -lat
            result["latitude"] = lat
        except ValueError:
            pass

    if lon_el is not None and lon_el.text:
        try:
            lon = float(lon_el.text)
            if lon_ref is not None and lon_ref.text == "W":
                lon = -lon
            result["longitude"] = lon
        except ValueError:
            pass

    # Location
    city_el = rdf_desc.find("photoshop:City", XMP_NS)
    if city_el is not None and city_el.text:
        result["city"] = city_el.text

    state_el = rdf_desc.find("photoshop:State", XMP_NS)
    if state_el is not None and state_el.text:
        result["state"] = state_el.text

    country_el = rdf_desc.find("photoshop:Country", XMP_NS)
    if country_el is not None and country_el.text:
        result["country"] = country_el.text

    # Face regions
    region_list = rdf_desc.find(".//MP:RegionList", XMP_NS)
    if region_list is not None:
        for region_entry in region_list.findall("MP:Region", XMP_NS):
            name_el = region_entry.find("MP:Name", XMP_NS)
            rect_el = region_entry.find("MP:Rectangle", XMP_NS)

            if rect_el is not None and rect_el.text:
                try:
                    parts = [float(x.strip()) for x in rect_el.text.split(",")]
                    if len(parts) == 4:
                        region = {
                            "x": parts[0],
                            "y": parts[1],
                            "w": parts[2],
                            "h": parts[3],
                        }
                        if name_el is not None and name_el.text:
                            region["name"] = name_el.text
                        result["face_regions"].append(region)
                except (ValueError, IndexError):
                    pass

    return result


def _parse_auto_tags(auto_tags: str | None) -> list[str]:
    """Parse auto_tags field. Can be JSON array or comma-separated string."""
    if not auto_tags:
        return []
    try:
        parsed = json.loads(auto_tags)
        if isinstance(parsed, list):
            return [str(t) for t in parsed if t]
    except (json.JSONDecodeError, TypeError):
        pass
    # Fallback: comma-separated
    return [t.strip() for t in auto_tags.split(",") if t.strip()]


async def export_photo_xmp(photo_id: int, db: AsyncSession) -> str | None:
    """Export XMP sidecar for a single photo, including face regions.

    Args:
        photo_id: Photo ID.
        db: Database session.

    Returns:
        Path to the written XMP file, or None on error.
    """
    stmt = (
        select(Photo)
        .options(selectinload(Photo.people).selectinload(PhotoPerson.person))
        .where(Photo.id == photo_id)
    )
    result = await db.execute(stmt)
    photo = result.scalar_one_or_none()
    if not photo:
        return None

    # Build face regions from PhotoPerson
    face_regions = []
    if photo.people:
        for pp in photo.people:
            if pp.face_box_json and pp.person:
                normalized = _parse_face_box_json(pp.face_box_json, photo.width, photo.height)
                if normalized:
                    face_regions.append({
                        "name": pp.person.name,
                        "x": normalized["x"],
                        "y": normalized["y"],
                        "w": normalized["w"],
                        "h": normalized["h"],
                        "confidence": pp.confidence,
                    })

    return export_xmp_to_file(photo, face_regions if face_regions else None)


async def import_photo_xmp(photo_id: int, db: AsyncSession, sidecar_path: str | None = None) -> dict:
    """Import XMP sidecar data into a photo's database record.

    Args:
        photo_id: Photo ID.
        db: Database session.
        sidecar_path: Override path. If None, derives from photo.path.

    Returns:
        Dict with imported fields and counts.
    """
    stmt = (
        select(Photo)
        .options(selectinload(Photo.people).selectinload(PhotoPerson.person))
        .where(Photo.id == photo_id)
    )
    result = await db.execute(stmt)
    photo = result.scalar_one_or_none()
    if not photo:
        return {"error": "Photo not found"}

    if sidecar_path is None:
        sidecar_path = _get_sidecar_path(photo.path)

    xmp_data = import_xmp_sidecar(sidecar_path)
    if not xmp_data:
        return {"error": "No XMP data found or parse error"}

    updated_fields = []

    # Update caption (only if XMP has one and photo doesn't, or user explicitly imports)
    if xmp_data.get("caption") and not photo.caption:
        photo.caption = xmp_data["caption"]
        updated_fields.append("caption")

    # Update rating
    if xmp_data.get("is_favorite") is not None:
        photo.is_favorite = xmp_data["is_favorite"]
        updated_fields.append("is_favorite")

    # Update date
    if xmp_data.get("date_taken"):
        photo.date_taken = xmp_data["date_taken"]
        updated_fields.append("date_taken")

    # Update tags (merge with existing)
    if xmp_data.get("auto_tags"):
        existing_tags = _parse_auto_tags(photo.auto_tags)
        new_tags = _parse_auto_tags(xmp_data["auto_tags"])
        if new_tags:
            merged = list(dict.fromkeys(existing_tags + new_tags))  # Dedupe preserving order
            photo.auto_tags = json.dumps(merged)
            updated_fields.append("auto_tags")

    # Update GPS
    if xmp_data.get("latitude") is not None:
        photo.latitude = xmp_data["latitude"]
        updated_fields.append("latitude")
    if xmp_data.get("longitude") is not None:
        photo.longitude = xmp_data["longitude"]
        updated_fields.append("longitude")

    # Update location
    if xmp_data.get("city"):
        photo.city = xmp_data["city"]
        updated_fields.append("city")
    if xmp_data.get("state"):
        photo.state = xmp_data["state"]
        updated_fields.append("state")
    if xmp_data.get("country"):
        photo.country = xmp_data["country"]
        updated_fields.append("country")

    if updated_fields:
        await db.commit()

    return {
        "updated_fields": updated_fields,
        "face_regions_found": len(xmp_data.get("face_regions", [])),
        "photo_id": photo_id,
    }


async def export_all_xmp(db: AsyncSession, output_dir: str | None = None) -> dict:
    """Export XMP sidecars for all photos in the database.

    Args:
        db: Database session.
        output_dir: Optional override directory. If None, sidecars are written
                     next to each photo file.

    Returns:
        Summary dict with counts.
    """
    stmt = (
        select(Photo)
        .options(selectinload(Photo.people).selectinload(PhotoPerson.person))
        .where(Photo.is_trash == False)
    )
    result = await db.execute(stmt)
    photos = result.scalars().unique().all()

    exported = 0
    skipped = 0
    errors = 0

    for photo in photos:
        try:
            # Build face regions
            face_regions = []
            if photo.people:
                for pp in photo.people:
                    if pp.face_box_json and pp.person:
                        normalized = _parse_face_box_json(pp.face_box_json, photo.width, photo.height)
                        if normalized:
                            face_regions.append({
                                "name": pp.person.name,
                                "x": normalized["x"],
                                "y": normalized["y"],
                                "w": normalized["w"],
                                "h": normalized["h"],
                                "confidence": pp.confidence,
                            })

            if output_dir:
                # Write to output directory preserving relative path structure
                base_name = os.path.splitext(os.path.basename(photo.path))[0]
                sidecar_path = os.path.join(output_dir, base_name + ".xmp")
            else:
                sidecar_path = _get_sidecar_path(photo.path)

            export_xmp_to_file(photo, face_regions if face_regions else None, sidecar_path)
            exported += 1
        except Exception as e:
            logger.error(f"Failed to export XMP for photo {photo.id}: {e}")
            errors += 1

    return {
        "total": len(photos),
        "exported": exported,
        "skipped": skipped,
        "errors": errors,
    }


async def import_xmp_from_directory(directory: str, db: AsyncSession) -> dict:
    """Scan a directory for .xmp files and import their metadata into matching photos.

    Matches XMP files to photos by:
    1. Same basename (e.g., IMG_001.jpg → IMG_001.xmp)
    2. Same directory

    Args:
        directory: Root directory to scan recursively.
        db: Database session.

    Returns:
        Summary dict.
    """
    imported = 0
    matched = 0
    not_found = 0
    errors = 0

    for root, dirs, files in os.walk(directory):
        for fname in files:
            if not fname.lower().endswith(".xmp"):
                continue

            xmp_path = os.path.join(root, fname)
            base_name = os.path.splitext(fname)[0]

            # Try to find matching photo by filename
            stmt = select(Photo).where(
                Photo.filename == base_name,
                Photo.is_trash == False,
            )
            result = await db.execute(stmt)
            photo = result.scalar_one_or_none()

            if not photo:
                # Try matching by path prefix
                stmt2 = select(Photo).where(
                    Photo.path.like(f"{root}%"),
                    Photo.is_trash == False,
                )
                result2 = await db.execute(stmt2)
                for candidate in result2.scalars().all():
                    candidate_base = os.path.splitext(os.path.basename(candidate.path))[0]
                    if candidate_base == base_name:
                        photo = candidate
                        break

            if not photo:
                not_found += 1
                continue

            matched += 1
            try:
                import_result = await import_photo_xmp(photo.id, db, xmp_path)
                if "error" not in import_result:
                    imported += 1
                else:
                    errors += 1
            except Exception as e:
                logger.error(f"Failed to import XMP {xmp_path}: {e}")
                errors += 1

    return {
        "xmp_files_found": matched + not_found,
        "matched": matched,
        "imported": imported,
        "not_found": not_found,
        "errors": errors,
    }
