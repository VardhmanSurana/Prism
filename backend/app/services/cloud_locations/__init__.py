"""Cloud / external location providers for Prism.

Phase A: local_path (already-mounted NAS, SMB, etc.) is fully usable.
Phase B stubs: smb, s3, gdrive — configuration stored, connection deferred.
"""
from .registry import (
    PROVIDER_IDS,
    create_external_location,
    delete_external_location,
    list_external_locations,
    provider_status,
    update_external_location,
    validate_location_payload,
)

__all__ = [
    "PROVIDER_IDS",
    "create_external_location",
    "delete_external_location",
    "list_external_locations",
    "provider_status",
    "update_external_location",
    "validate_location_payload",
]
