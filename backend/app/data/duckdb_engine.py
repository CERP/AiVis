"""Query layer over Parquet via DuckDB — never load a full dataset into Python/React memory
just to preview or aggregate it."""

from __future__ import annotations

import io

import duckdb
import pyarrow.parquet as pq


def query_parquet_bytes(parquet_bytes: bytes, sql: str, *, view_name: str = "t") -> list[dict]:
    """Runs `sql` against `parquet_bytes` registered as `view_name`. `sql` must reference
    `view_name`, e.g. `SELECT * FROM t LIMIT 10`. Caller-controlled SQL — only ever call this
    with server-constructed queries, never raw user input."""
    table = pq.read_table(io.BytesIO(parquet_bytes))
    con = duckdb.connect(":memory:")
    try:
        con.register(view_name, table)
        cursor = con.execute(sql)
        columns = [c[0] for c in cursor.description]
        return [dict(zip(columns, row, strict=True)) for row in cursor.fetchall()]
    finally:
        con.close()


def row_count(parquet_bytes: bytes) -> int:
    table = pq.read_table(io.BytesIO(parquet_bytes))
    return table.num_rows
