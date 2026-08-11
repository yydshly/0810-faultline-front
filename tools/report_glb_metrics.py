#!/usr/bin/env python3
"""Report stable, dependency-free metrics for one or more binary glTF assets."""

from __future__ import annotations

import argparse
import json
import struct
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


GLB_MAGIC = 0x46546C67
JSON_CHUNK = 0x4E4F534A
TRIANGLES_MODE = 4
TRIANGLE_STRIP_MODE = 5
TRIANGLE_FAN_MODE = 6


@dataclass(frozen=True)
class GlbMetrics:
    asset: str
    bytes: int
    triangles: int
    primitives: int
    meshes: int
    nodes: int
    materials: int
    textures: int
    images: int
    skins: int
    animations: int


def read_glb_document(path: Path) -> dict[str, Any]:
    with path.open("rb") as stream:
        header = stream.read(12)
        if len(header) != 12:
            raise ValueError("file is shorter than a GLB header")
        magic, version, declared_length = struct.unpack("<III", header)
        if magic != GLB_MAGIC:
            raise ValueError("not a binary glTF file")
        if version != 2:
            raise ValueError(f"unsupported GLB version {version}")
        if declared_length != path.stat().st_size:
            raise ValueError(
                f"declared length {declared_length} differs from file length {path.stat().st_size}"
            )
        chunk_header = stream.read(8)
        if len(chunk_header) != 8:
            raise ValueError("missing JSON chunk")
        chunk_length, chunk_type = struct.unpack("<II", chunk_header)
        if chunk_type != JSON_CHUNK:
            raise ValueError("first GLB chunk is not JSON")
        payload = stream.read(chunk_length)
        if len(payload) != chunk_length:
            raise ValueError("truncated JSON chunk")
    document = json.loads(payload.rstrip(b" \t\r\n\x00").decode("utf-8"))
    if not isinstance(document, dict):
        raise ValueError("glTF JSON root must be an object")
    return document


def accessor_count(document: dict[str, Any], accessor_index: Any) -> int:
    if not isinstance(accessor_index, int):
        return 0
    accessors = document.get("accessors", [])
    if not isinstance(accessors, list) or accessor_index < 0 or accessor_index >= len(accessors):
        return 0
    accessor = accessors[accessor_index]
    if not isinstance(accessor, dict):
        return 0
    count = accessor.get("count", 0)
    return count if isinstance(count, int) and count >= 0 else 0


def primitive_triangle_count(document: dict[str, Any], primitive: dict[str, Any]) -> int:
    count = accessor_count(document, primitive.get("indices"))
    if count == 0:
        attributes = primitive.get("attributes", {})
        if isinstance(attributes, dict):
            count = accessor_count(document, attributes.get("POSITION"))
    mode = primitive.get("mode", TRIANGLES_MODE)
    if mode == TRIANGLES_MODE:
        return count // 3
    if mode in (TRIANGLE_STRIP_MODE, TRIANGLE_FAN_MODE):
        return max(0, count - 2)
    return 0


def metrics_for(path: Path) -> GlbMetrics:
    document = read_glb_document(path)
    meshes = document.get("meshes", [])
    mesh_list = meshes if isinstance(meshes, list) else []
    primitive_list = [
        primitive
        for mesh in mesh_list
        if isinstance(mesh, dict)
        for primitive in mesh.get("primitives", [])
        if isinstance(primitive, dict)
    ]
    return GlbMetrics(
        asset=path.stem,
        bytes=path.stat().st_size,
        triangles=sum(primitive_triangle_count(document, primitive) for primitive in primitive_list),
        primitives=len(primitive_list),
        meshes=len(mesh_list),
        nodes=len(document.get("nodes", [])) if isinstance(document.get("nodes", []), list) else 0,
        materials=len(document.get("materials", [])) if isinstance(document.get("materials", []), list) else 0,
        textures=len(document.get("textures", [])) if isinstance(document.get("textures", []), list) else 0,
        images=len(document.get("images", [])) if isinstance(document.get("images", []), list) else 0,
        skins=len(document.get("skins", [])) if isinstance(document.get("skins", []), list) else 0,
        animations=len(document.get("animations", [])) if isinstance(document.get("animations", []), list) else 0,
    )


def iter_paths(inputs: Iterable[str]) -> list[Path]:
    paths: list[Path] = []
    for raw in inputs:
        path = Path(raw)
        if path.is_dir():
            paths.extend(sorted(path.glob("*.glb")))
        else:
            paths.append(path)
    unique: dict[str, Path] = {}
    for path in paths:
        unique[str(path.resolve()).casefold()] = path
    return list(unique.values())


def format_markdown(metrics: list[GlbMetrics]) -> str:
    rows = [
        "| asset | bytes | triangles | primitives | materials | textures | images | nodes | skins | animations |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    rows.extend(
        f"| {item.asset} | {item.bytes:,} | {item.triangles:,} | {item.primitives} | "
        f"{item.materials} | {item.textures} | {item.images} | {item.nodes} | {item.skins} | {item.animations} |"
        for item in metrics
    )
    return "\n".join(rows)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", help="GLB files or directories containing GLB files")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a Markdown table")
    args = parser.parse_args(argv)

    paths = iter_paths(args.paths)
    if not paths:
        parser.error("no GLB files found")
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        print("Missing GLB files: " + ", ".join(missing), file=sys.stderr)
        return 2

    try:
        metrics = [metrics_for(path) for path in paths]
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Unable to inspect GLB: {error}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps([asdict(item) for item in metrics], indent=2, ensure_ascii=False))
    else:
        print(format_markdown(metrics))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
