from pathlib import Path

from PIL import Image, ImageChops


diagram_dir = Path(__file__).resolve().parent / "diagrams"

for image_path in diagram_dir.glob("*.png"):
    image = Image.open(image_path).convert("RGB")
    background = Image.new("RGB", image.size, "white")
    diff = ImageChops.difference(image, background).convert("L")
    # Ignore tiny antialiasing noise near pure white.
    diff = diff.point(lambda value: 255 if value > 18 else 0)
    box = diff.getbbox()
    if box is None:
        continue
    margin = 42
    left = max(0, box[0] - margin)
    top = max(0, box[1] - margin)
    right = min(image.width, box[2] + margin)
    bottom = min(image.height, box[3] + margin)
    cropped = image.crop((left, top, right, bottom))
    cropped.save(image_path, dpi=(220, 220), optimize=True)
    print(f"{image_path.name}: {image.size} -> {cropped.size}")
