"""Integration tests against a real MinIO instance (docker compose up minio)."""

import uuid

import pytest
from botocore.exceptions import ClientError

from app.services.storage import StorageService


@pytest.fixture(scope="module")
def storage() -> StorageService:
    svc = StorageService()
    svc.ensure_buckets()
    return svc


def test_build_object_key_prevents_path_traversal(storage: StorageService) -> None:
    key = storage.build_object_key(uuid.uuid4(), "../../etc/passwd")
    assert ".." not in key.split("/", 1)[1]
    assert "/" not in key.split("/", 1)[1]


def test_upload_download_roundtrip(storage: StorageService) -> None:
    key = storage.build_object_key(uuid.uuid4(), "clean.csv")
    payload = b"a,b\n1,2\n"
    storage.upload_bytes(storage.bucket_raw, key, payload, "text/csv")
    try:
        assert storage.download_bytes(storage.bucket_raw, key) == payload
    finally:
        storage.delete_object(storage.bucket_raw, key)


def test_delete_removes_object(storage: StorageService) -> None:
    key = storage.build_object_key(uuid.uuid4(), "clean.csv")
    storage.upload_bytes(storage.bucket_raw, key, b"x", "text/csv")
    storage.delete_object(storage.bucket_raw, key)
    with pytest.raises(ClientError):
        storage.download_bytes(storage.bucket_raw, key)


def test_presigned_urls_are_generated(storage: StorageService) -> None:
    key = storage.build_object_key(uuid.uuid4(), "clean.csv")
    put_url = storage.presigned_put_url(storage.bucket_raw, key, "text/csv")
    get_url = storage.presigned_get_url(storage.bucket_raw, key)
    assert put_url.startswith("http")
    assert get_url.startswith("http")
