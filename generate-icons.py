#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate icon files (PNG, ICO, BMP) from minimalist N design for NeuroOS
"""

from PIL import Image, ImageDraw
import io
import sys
import os

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def create_minimalist_n_icon(width, height=None, padding_ratio=0.25):
    """Create a premium minimalist N icon with rounded background and circle, matching the desired structure"""
    if height is None:
        height = width
    
    # Start with transparent background
    img = Image.new('RGBA', (width, height), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Light rounded square background (matching the user's screenshot context)
    bg_radius = width * 0.2
    draw.rounded_rectangle(
        [0, 0, width, height],
        radius=bg_radius,
        fill=(243, 244, 246, 255) # Light grey/white
    )

    # 2. Dark central circle
    circle_margin = width * 0.12
    draw.ellipse(
        [circle_margin, circle_margin, width - circle_margin, height - circle_margin],
        fill=(9, 9, 11, 255)
    )

    # 3. White N character
    scale = width / 512.0
    stroke = width * 0.1
    
    # Coordinates centered within the circle
    # Using a thick, modern N design
    p = [
        (170 * scale, 175 * scale), # Top Left
        (170 * scale, 337 * scale), # Bottom Left
        (342 * scale, 175 * scale), # Top Right
        (342 * scale, 337 * scale), # Bottom Right
    ]
    
    # Draw the N strokes
    draw.line([p[0], p[1]], fill=(255, 255, 255, 255), width=int(stroke), joint="curve")
    draw.line([p[1], p[2]], fill=(255, 255, 255, 255), width=int(stroke), joint="curve")
    draw.line([p[2], p[3]], fill=(255, 255, 255, 255), width=int(stroke), joint="curve")

    # Round the joints for a premium feel
    r = stroke / 2
    for point in p:
        draw.ellipse([point[0]-r, point[1]-r, point[0]+r, point[1]+r], fill=(255, 255, 255, 255))

    return img

def create_installer_sidebar():
    """Create the NSIS installer sidebar (164x314)"""
    width, height = 164, 314
    img = Image.new('RGB', (width, height), color=(9, 9, 11))
    draw = ImageDraw.Draw(img)
    
    # Add a large N logo in the center-top
    logo_size = 80
    logo = create_minimalist_n_icon(logo_size)
    img.paste(logo, (width // 2 - logo_size // 2, 40), logo)
    
    return img

def create_installer_header():
    """Create the NSIS installer header (150x57)"""
    width, height = 150, 57
    img = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Add a small N logo on the right
    logo_size = 40
    logo = create_minimalist_n_icon(logo_size)
    # For header, we might want a white background version or just the logo
    img.paste(logo, (width - logo_size - 10, (height - logo_size) // 2), logo)
    
    return img

# Ensure directories exist
os.makedirs('build', exist_ok=True)
os.makedirs('public', exist_ok=True)

# Generate PNG at multiple sizes
sizes = [16, 32, 48, 64, 128, 256, 512, 1024]

print("Generating PNG icons...")
for size in sizes:
    img = create_minimalist_n_icon(size)
    if size == 512:
        img.save('build/icon.png')
        print(f"Generated build/icon.png ({size}x{size})")
    img.save(f'build/icon-{size}x{size}.png')
    print(f"Generated build/icon-{size}x{size}.png")

# Generate ICO files
print("\nGenerating ICO files...")

# Main App ICO
ico_sizes = [16, 32, 48, 64, 128, 256]
ico_images = [create_minimalist_n_icon(size) for size in ico_sizes]
ico_images[0].save(
    'build/icon.ico',
    format='ICO',
    sizes=[(img.size[0], img.size[1]) for img in ico_images],
    append_images=ico_images[1:]
)
print("Generated build/icon.ico")

# Taskbar ICO (optimized for small sizes)
taskbar_ico_images = [create_minimalist_n_icon(size) for size in [16, 32, 48]]
taskbar_ico_images[0].save(
    'build/icon-taskbar.ico',
    format='ICO',
    sizes=[(img.size[0], img.size[1]) for img in taskbar_ico_images],
    append_images=taskbar_ico_images[1:]
)
print("Generated build/icon-taskbar.ico")

# Favicon (for web/dev server)
favicon_images = [create_minimalist_n_icon(size) for size in [16, 32, 48]]
favicon_images[0].save(
    'public/favicon.ico',
    format='ICO',
    sizes=[(img.size[0], img.size[1]) for img in favicon_images],
    append_images=favicon_images[1:]
)
print("Generated public/favicon.ico")

# Generate Installer Bitmaps
print("\nGenerating Installer Bitmaps...")
create_installer_sidebar().save('build/installerSidebar.bmp')
create_installer_header().save('build/installerHeader.bmp')
print("Generated installer bitmaps")

print("\nAll icons generated successfully!")

