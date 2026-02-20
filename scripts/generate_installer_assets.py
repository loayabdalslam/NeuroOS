from PIL import Image, ImageDraw, ImageFont

def create_installer_assets():
    # 1. Installer Sidebar (164 x 314 px)
    sidebar_w, sidebar_h = 164, 314
    sidebar = Image.new('RGB', (sidebar_w, sidebar_h), (255, 255, 255))
    draw = ImageDraw.Draw(sidebar)

    # Draw simple bottom border
    draw.rectangle([0, sidebar_h-5, sidebar_w, sidebar_h], fill=(24, 24, 27))

    # Simple Logo placeholder (N)
    path_coords = [(60, 150), (60, 100), (80, 100), (104, 130), (104, 100), (114, 100), (114, 150), (104, 150), (80, 120), (80, 150)]
    draw.polygon(path_coords, fill=(24, 24, 27))

    sidebar.save('e:/chatit.cloud/2030/NeuroOS/build/installerSidebar.bmp')

    # 2. Installer Header (150 x 57 px)
    header_w, header_h = 150, 57
    header = Image.new('RGB', (header_w, header_h), (255, 255, 255))
    draw = ImageDraw.Draw(header)

    # Small N logo to the right
    n_small = [(120, 40), (120, 15), (125, 15), (135, 30), (135, 15), (140, 15), (140, 40), (135, 40), (125, 25), (125, 40)]
    draw.polygon(n_small, fill=(24, 24, 27))

    header.save('e:/chatit.cloud/2030/NeuroOS/build/installerHeader.bmp')
    print("Installer assets generated: installerSidebar.bmp and installerHeader.bmp")

if __name__ == "__main__":
    create_installer_assets()
