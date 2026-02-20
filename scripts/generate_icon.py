from PIL import Image, ImageDraw

def create_neuro_icon():
    # Create a 512x512 image with white background
    size = 512
    image = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)

    # Draw a rounded rectangle background (mimicking the SVG rx=128)
    # Pillow's rounded_rectangle is available in newer versions
    draw.rounded_rectangle([0, 0, size, size], radius=128, fill=(255, 255, 255, 255))

    # Draw the "N" character
    # Coordinates based on the SVG path: M160 352V160H208L304 304V160H352V352H304L208 208V352H160Z
    # Scaling to 512 if necessary (SVG was already 512)
    path_coords = [
        (160, 352), (160, 160), (208, 160), (304, 304),
        (304, 160), (352, 160), (352, 352), (304, 352),
        (208, 208), (208, 352), (160, 352)
    ]

    draw.polygon(path_coords, fill=(24, 24, 27, 255)) # Zinc-900 color

    # Save as ICO with multiple sizes
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256), (512, 512)]
    image.save('e:/chatit.cloud/2030/NeuroOS/build/icon.ico', sizes=icon_sizes)
    image.save('e:/chatit.cloud/2030/NeuroOS/build/icon.png')
    print("Icon generated successfully: icon.ico and icon.png")

if __name__ == "__main__":
    create_neuro_icon()
