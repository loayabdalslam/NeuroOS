#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate icon files (PNG, ICO) from SVG with minimalist N design
"""

from PIL import Image, ImageDraw
import io
import sys
import os

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def create_minimalist_n_icon(size):
    """Create a minimalist N icon at the specified size"""
    # Create image with dark background
    img = Image.new('RGBA', (size, size), color=(9, 9, 11, 255))
    draw = ImageDraw.Draw(img)

    # Calculate dimensions based on size
    padding = int(size * 0.15)
    stroke_width = int(size * 0.12)

    # Left vertical line
    left_x = padding
    right_x = size - padding
    top_y = padding
    bottom_y = size - padding

    # Draw left vertical stroke
    draw.rectangle(
        [left_x, top_y, left_x + stroke_width, bottom_y],
        fill=(255, 255, 255, 235),
        width=0
    )

    # Draw right vertical stroke
    draw.rectangle(
        [right_x - stroke_width, top_y, right_x, bottom_y],
        fill=(255, 255, 255, 235),
        width=0
    )

    # Draw diagonal connector (from bottom-left to top-right)
    # Using a rotated rectangle approach
    points = [
        (left_x + stroke_width, bottom_y),
        (right_x - stroke_width, top_y),
        (right_x, top_y + stroke_width),
        (left_x, bottom_y - stroke_width),
    ]
    draw.polygon(points, fill=(255, 255, 255, 230))

    return img

# Generate PNG at multiple sizes for different uses
sizes = [16, 32, 64, 128, 256, 512]

print("Generating PNG icons...")
for size in sizes:
    img = create_minimalist_n_icon(size)
    if size == 512:
        img.save('build/icon.png')
        print(f"Generated build/icon.png ({size}x{size})")
    else:
        img.save(f'build/icon-{size}x{size}.png')
        print(f"Generated build/icon-{size}x{size}.png")

# Generate ICO file (Windows icon with multiple resolutions)
print("\nGenerating ICO file...")
ico_images = []
for size in [16, 32, 48, 64, 128, 256]:
    img = create_minimalist_n_icon(size)
    ico_images.append(img)

# Save as ICO with multiple sizes
ico_images[0].save(
    'build/icon.ico',
    format='ICO',
    sizes=[(img.size[0], img.size[1]) for img in ico_images],
    append_images=ico_images[1:]
)
print(f"Generated build/icon.ico with {len(ico_images)} sizes")

print("\nAll icons generated successfully!")
