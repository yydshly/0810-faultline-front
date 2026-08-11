from __future__ import annotations

import argparse
import json
import struct
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class GlbStats:
    asset: str
    bytes: int
    nodes: int
    meshes: int
    primitives: int
    triangles: int
    materials: int
    images: int
    animations: int


def read_glb_json(path: Path) -> dict:
    with path.open("rb") as stream:
        magic, version, total_length = struct.unpack("<4sII", stream.read(12))
        if magic != b"glTF" or version != 2 or total_length != path.stat().st_size:
            raise ValueError(f"{path.name}: invalid GLB header")
        chunk_length, chunk_type = struct.unpack("<II", stream.read(8))
        if chunk_type != 0x4E4F534A:
            raise ValueError(f"{path.name}: first GLB chunk is not JSON")
        return json.loads(stream.read(chunk_length).decode("utf-8"))


def accessor_count(document: dict, index: int | None) -> int:
    accessors = document.get("accessors", [])
    if index is None or index < 0 or index >= len(accessors):
        return 0
    return int(accessors[index].get("count", 0))


def collect_stats(path: Path) -> GlbStats:
    document = read_glb_json(path)
    primitive_count = 0
    triangle_count = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitive_count += 1
            index_count = accessor_count(document, primitive.get("indices"))
            if index_count <= 0:
                position_accessor = primitive.get("attributes", {}).get("POSITION")
                index_count = accessor_count(document, position_accessor)
            mode = int(primitive.get("mode", 4))
            if mode == 4:
                triangle_count += index_count // 3
            elif mode in (5, 6):
                triangle_count += max(0, index_count - 2)
    return GlbStats(
        asset=path.stem,
        bytes=path.stat().st_size,
        nodes=len(document.get("nodes", [])),
        meshes=len(document.get("meshes", [])),
        primitives=primitive_count,
        triangles=triangle_count,
        materials=len(document.get("materials", [])),
        images=len(document.get("images", [])),
        animations=len(document.get("animations", [])),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Report deterministic GLB runtime budgets.")
    parser.add_argument("model_dir", nargs="?", default="public/assets/models")
    parser.add_argument("assets", nargs="*", help="Optional filename stems or asset ids to include.")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()

    model_dir = Path(args.model_dir).resolve()
    filters = {value.lower().removesuffix(".glb") for value in args.assets}
    paths = sorted(model_dir.glob("*.glb"))
    if filters:
        paths = [
            path for path in paths
            if path.stem.lower() in filters
            or path.stem.lower().removesuffix("_v1") in filters
        ]
    stats = [collect_stats(path) for path in paths]
    if args.as_json:
        print(json.dumps([asdict(item) for item in stats], ensure_ascii=False, indent=2))
        return 0

    print("asset\tbytes\tnodes\tmeshes\tprimitives\ttriangles\tmaterials\timages\tanimations")
    for item in stats:
        print(
            f"{item.asset}\t{item.bytes}\t{item.nodes}\t{item.meshes}\t"
            f"{item.primitives}\t{item.triangles}\t{item.materials}\t{item.images}\t{item.animations}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
