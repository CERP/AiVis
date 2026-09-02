"""S3-compatible object storage client (MinIO locally, any S3-compatible service in prod)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta

import boto3
from botocore.client import Config as BotoConfig

from app.core.config import get_settings


@dataclass(frozen=True)
class StoredObject:
    bucket: str
    key: str


class StorageService:
    """Thin wrapper around boto3 S3 client. Never expose bucket credentials to clients —
    callers get signed URLs, never raw access keys."""

    def __init__(self) -> None:
        settings = get_settings()
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region,
            config=BotoConfig(signature_version="s3v4"),
        )
        self.bucket_raw = settings.s3_bucket_raw
        self.bucket_processed = settings.s3_bucket_processed
        self.bucket_exports = settings.s3_bucket_exports

    def ensure_buckets(self) -> None:
        for bucket in (self.bucket_raw, self.bucket_processed, self.bucket_exports):
            existing = {b["Name"] for b in self._client.list_buckets().get("Buckets", [])}
            if bucket not in existing:
                self._client.create_bucket(Bucket=bucket)

    def build_object_key(self, dataset_id: uuid.UUID, filename: str) -> str:
        """Deterministic, path-traversal-safe key. Never trust the client-supplied filename
        as a path component — only its sanitized basename is kept for readability."""
        basename = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        safe_name = "".join(c for c in basename if c.isalnum() or c in "_-.")
        safe_name = safe_name.lstrip(".") or "file"
        return f"{dataset_id}/{uuid.uuid4().hex}-{safe_name}"

    def upload_bytes(self, bucket: str, key: str, data: bytes, content_type: str) -> StoredObject:
        self._client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
        return StoredObject(bucket=bucket, key=key)

    def presigned_put_url(
        self,
        bucket: str,
        key: str,
        content_type: str,
        expires_in: timedelta = timedelta(minutes=15),
    ) -> str:
        return self._client.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=int(expires_in.total_seconds()),
        )

    def presigned_get_url(
        self, bucket: str, key: str, expires_in: timedelta = timedelta(minutes=15)
    ) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=int(expires_in.total_seconds()),
        )

    def download_bytes(self, bucket: str, key: str) -> bytes:
        response = self._client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()

    def delete_object(self, bucket: str, key: str) -> None:
        self._client.delete_object(Bucket=bucket, Key=key)


_storage_service: StorageService | None = None


def get_storage_service() -> StorageService:
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
