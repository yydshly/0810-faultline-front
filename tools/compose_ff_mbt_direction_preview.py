from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SPRITE_DIR = PROJECT_ROOT / "assets" / "sprites" / "ff_mbt_01"
FRAME_SIZE = 192


def main() -> None:
    background = Image.new("RGBA", (FRAME_SIZE * 4, FRAME_SIZE * 2), (27, 33, 31, 255))
    shadow = Image.open(SPRITE_DIR / "shadow.png").convert("RGBA")
    for direction in range(8):
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        frame.alpha_composite(shadow)
        frame.alpha_composite(Image.open(SPRITE_DIR / f"body_{direction:02d}.png").convert("RGBA"))
        frame.alpha_composite(Image.open(SPRITE_DIR / f"turret_{direction * 2:02d}.png").convert("RGBA"))
        background.alpha_composite(frame, ((direction % 4) * FRAME_SIZE, (direction // 4) * FRAME_SIZE))
    output = SPRITE_DIR / "ff_mbt_01_directions_preview.png"
    background.convert("RGB").save(output, optimize=True)
    print(output)


if __name__ == "__main__":
    main()
