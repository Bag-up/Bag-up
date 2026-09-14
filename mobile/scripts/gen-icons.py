"""Génère les icônes de l'app Bag'up à partir du logo.

Usage: python3 scripts/gen-icons.py
Sources: assets/logo.png (fond turquoise) et assets/logo-sansfond.png (transparent).
Sorties: assets/icon.png, assets/adaptive-icon.png, assets/splash-icon.png, assets/favicon.png
"""
from PIL import Image

BG = (3, 130, 136)  # #038288 turquoise de la marque


def main() -> None:
    # icon.png : carré 1024, fond turquoise, logo centré
    base = Image.open('assets/logo.png').convert('RGBA')  # 1536x1024 avec fond
    w, h = base.size
    side = max(w, h)
    canvas = Image.new('RGBA', (side, side), BG + (255,))
    canvas.paste(base, ((side - w) // 2, (side - h) // 2), base)
    canvas.convert('RGB').resize((1024, 1024), Image.LANCZOS).save('assets/icon.png')

    # favicon.png : 64x64
    canvas.convert('RGB').resize((64, 64), Image.LANCZOS).save('assets/favicon.png')

    # logo transparent pour adaptive + splash, recadré sur le contenu réel
    logo = Image.open('assets/logo-sansfond.png').convert('RGBA')
    bbox = logo.getbbox()
    if bbox:
        logo = logo.crop(bbox)
    lw, lh = logo.size

    def centered_transparent(target: int, logo_w: int) -> Image.Image:
        scale = logo_w / lw
        nw, nh = int(lw * scale), int(lh * scale)
        lg = logo.resize((nw, nh), Image.LANCZOS)
        c = Image.new('RGBA', (target, target), (0, 0, 0, 0))
        c.paste(lg, ((target - nw) // 2, (target - nh) // 2), lg)
        return c

    # adaptive-icon.png : logo dans la zone de sécurité Android (~66%)
    centered_transparent(1024, 680).save('assets/adaptive-icon.png')

    # splash-icon.png : logo plus grand
    centered_transparent(1024, 820).save('assets/splash-icon.png')

    print('OK - icons generated')


if __name__ == '__main__':
    main()
