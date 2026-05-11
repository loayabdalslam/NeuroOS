#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate minimalist N icon files for NeuroOS
Modern, clean "N" logo design
"""

from PIL import Image, ImageDraw
import math

def create_minimalist_n_icon(size):
    """Create a minimalist N icon at the specified size"""
    # Create image with dark background
    img = Image.new('RGBA', (size, size), color=(9, 9, 11, 255))
    draw = ImageDraw.Draw(img)

    # Calculate dimensions
    padding = int(size * 0.18)
    stroke_width = int(size * 0.13)

    left_x = padding
    right_x = size - padding
    top_y = padding
    bottom_y = size - padding

    # Draw left vertical bar with rounded caps
    draw.rounded_rectangle(
        [left_x, top_y, left_x + stroke_width, bottom_y],
        radius=stroke_width // 2,
        fill=(255, 255, 255, 245)
    )

    # Draw right vertical bar with rounded caps
    draw.rounded_rectangle(
        [right_x - stroke_width, top_y, right_x, bottom_y],
        radius=stroke_width // 2,
        fill=(255, 255, 255, 245)
    )

    # Draw diagonal connector - clean modern style
    # Calculate diagonal points for sharp modern N
    inner_left = left_x + stroke_width
    inner_right = right_x - stroke_width

    # Create diagonal bar
    diag_points = [
        (inner_left, bottom_y),
        (inner_right, top_y),
        (right_x, top_y + stroke_width),
        (left_x + stroke_width, bottom_y - stroke_width),
    ]
    draw.polygon(diag_points, fill=(255, 255, 255, 240))

    return img


def create_neuro_icon():
    """Generate all icon files"""
    # Ensure build directory exists
    import os
    os.makedirs('build', exist_ok=True)

    # Generate PNG at multiple sizes
    sizes = [16, 32, 64, 128, 256, 512]

    print("Generating PNG icons...")
    for size in sizes:
        img = create_minimalist_n_icon(size)
        if size == 512:
            img.save('build/icon.png')
            print(f"  Generated build/icon.png ({size}x{size})")
        else:
            img.save(f'build/icon-{size}x{size}.png')
            print(f"  Generated build/icon-{size}x{size}.png")

    # Generate ICO file with multiple resolutions
    print("\nGenerating ICO file...")
    ico_sizes = [16, 32, 48, 64, 128, 256]
    ico_images = [create_minimalist_n_icon(s) for s in ico_sizes]

    # Save as ICO
    ico_images[0].save(
        'build/icon.ico',
        format='ICO',
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:]
    )
    print(f"  Generated build/icon.ico with {len(ico_sizes)} sizes")

    print("\nAll icons generated successfully!")


def create_taskbar_icon():
    """Create a taskbar-optimized icon with better small-size visibility"""
    import os
    os.makedirs('build', exist_ok=True)

    sizes = [16, 32, 48]
    print("Generating taskbar icons...")

    for size in sizes:
        img = Image.new('RGBA', (size, size), color=(9, 9, 11, 255))
        draw = ImageDraw.Draw(img)

        # Thicker strokes for small sizes
        padding = int(size * 0.15)
        stroke_width = int(size * 0.18)

        left_x = padding
        right_x = size - padding
        top_y = padding
        bottom_y = size - padding

        # Left vertical bar
        draw.rectangle(
            [left_x, top_y, left_x + stroke_width, bottom_y],
            fill=(255, 255, 255, 255)
        )

        # Right vertical bar
        draw.rectangle(
            [right_x - stroke_width, top_y, right_x, bottom_y],
            fill=(255, 255, 255, 255)
        )

        # Diagonal connector - solid fill
        inner_left = left_x + stroke_width
        inner_right = right_x - stroke_width

        points = [
            (inner_left, bottom_y),
            (inner_right, top_y),
            (right_x, top_y + stroke_width),
            (left_x + stroke_width, bottom_y - stroke_width),
        ]
        draw.polygon(points, fill=(255, 255, 255, 255))

        img.save(f'build/icon-taskbar-{size}x{size}.png')
        print(f"  Generated build/icon-taskbar-{size}x{size}.png")

    # Create single ICO for taskbar
    ico_images = [Image.new('RGBA', (s, s), (0, 0, 0, 0)) for s in [16, 32, 48]]
    for i, size in enumerate([16, 32, 48]):
        img = Image.new('RGBA', (size, size), color=(9, 9, 11, 255))
        draw = ImageDraw.Draw(img)

        padding = int(size * 0.15)
        stroke_width = int(size * 0.18)

        left_x = padding
        right_x = size - padding
        top_y = padding
        bottom_y = size - padding

        draw.rectangle([left_x, top_y, left_x + stroke_width, bottom_y], fill=(255, 255, 255, 255))
        draw.rectangle([right_x - stroke_width, top_y, right_x, bottom_y], fill=(255, 255, 255, 255))

        inner_left = left_x + stroke_width
        inner_right = right_x - stroke_width
        points = [
            (inner_left, bottom_y),
            (inner_right, top_y),
            (right_x, top_y + stroke_width),
            (left_x + stroke_width, bottom_y - stroke_width),
        ]
        draw.polygon(points, fill=(255, 255, 255, 255))
        ico_images[i] = img

    ico_images[0].save(
        'build/icon-taskbar.ico',
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=ico_images[1:]
    )
    print(f"  Generated build/icon-taskbar.ico")
    print("Taskbar icons generated successfully!")


if __name__ == "__main__":
    create_neuro_icon()
    create_taskbar_icon()
