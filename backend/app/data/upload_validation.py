"""Upload validation: never trust client-supplied filename/extension/MIME type alone."""

from __future__ import annotations

import magic

ALLOWED_EXTENSIONS = {"csv", "tsv", "json", "xlsx", "xls"}

# Actual sniffed content type (via libmagic) must be one of these for the given extension.
# Excel files are zip containers, so .xlsx sniffs as application/zip — matched explicitly.
_ALLOWED_MIME_BY_EXTENSION: dict[str, set[str]] = {
    "csv": {"text/csv", "text/plain"},
    "tsv": {"text/csv", "text/plain", "text/tab-separated-values"},
    "json": {"application/json", "text/plain"},
    "xlsx": {
        "application/zip",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    "xls": {"application/vnd.ms-excel", "application/x-ole-storage"},
}


class UploadValidationError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def extract_extension(filename: str) -> str:
    if "." not in filename:
        raise UploadValidationError("File has no extension")
    return filename.rsplit(".", 1)[-1].lower()


def validate_upload(
    *, filename: str, data: bytes, max_size_bytes: int
) -> tuple[str, str]:
    """Returns (extension, sniffed_mime_type) or raises UploadValidationError."""
    if not data:
        raise UploadValidationError("File is empty")

    if len(data) > max_size_bytes:
        raise UploadValidationError(
            f"File exceeds maximum size of {max_size_bytes // (1024 * 1024)}MB"
        )

    extension = extract_extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise UploadValidationError(f"Unsupported file extension: .{extension}")

    sniffed_mime = magic.from_buffer(data, mime=True)
    allowed_mimes = _ALLOWED_MIME_BY_EXTENSION[extension]
    if sniffed_mime not in allowed_mimes:
        raise UploadValidationError(
            f"File content ({sniffed_mime}) does not match its .{extension} extension"
        )

    return extension, sniffed_mime
