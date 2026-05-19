from PIL import Image, ImageDraw
import json
import os
import glob
import shutil


def longpath(p):
    p = os.path.abspath(p)
    if not p.startswith("\\\\?\\"):
        p = "\\\\?\\" + p
    return p


def remove_bottom_right_code(im, width_ratio=0.14, height_ratio=0.07):
    w, h = im.size
    bw = max(40, int(w * width_ratio))
    bh = max(24, int(h * height_ratio))
    x0, y0 = w - bw, h - bh
    sample = im.crop((x0, max(0, y0 - bh), w, y0))
    pixels = list(sample.getdata())
    if not pixels:
        return im
    rs = [p[0] for p in pixels]
    gs = [p[1] for p in pixels]
    bs = [p[2] for p in pixels]
    fill = (sum(rs) // len(rs), sum(gs) // len(gs), sum(bs) // len(bs))
    out = im.copy()
    draw = ImageDraw.Draw(out)
    draw.rectangle([x0, y0, w, h], fill=fill)
    return out


root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
src_dir = r"C:\Users\supre\.cursor\projects\c-Users-supre-Documents-Supreme-Advertising-Website\assets"
dest_dir = os.path.join(root, "assets", "images", "interior-branding")
svc = os.path.join(root, "assets", "images", "services")
os.makedirs(dest_dir, exist_ok=True)

ids = [
    "506049231",
    "505726203",
    "506056375",
    "506986506",
    "513895976",
    "511622599",
    "505991713",
]
code_ids = {"506049231", "505726203"}
alts = [
    "Motivational interior wall graphics with dream big ideas theme",
    "Office breakroom wall mural with focus branding",
    "DSI branded interior retail shop wall graphics",
    "DSI Bike large interior showroom wall sign",
    "Amco batteries interior wall advertisement",
    "Mountain bike shop interior wall branding mural",
    "DSI Tyres interior staircase and wall branding",
]

files = []
for fid in ids:
    matches = glob.glob(os.path.join(src_dir, f"*{fid}*.png"))
    if matches:
        files.append(matches[0])
    else:
        print("MISSING", fid)

for i, src in enumerate(files, 1):
    im = Image.open(longpath(src)).convert("RGB")
    fid = next(x for x in ids if x in src)
    if fid in code_ids:
        im = remove_bottom_right_code(im)
    dst = os.path.join(dest_dir, f"ib-{i:02d}.png")
    im.save(longpath(dst), optimize=True)
    print("saved", i, im.size, "cleaned" if fid in code_ids else "ok")

shutil.copy2(
    longpath(os.path.join(dest_dir, "ib-01.png")),
    longpath(os.path.join(svc, "interior-branding.jpg")),
)
items = [
    {
        "src": f"assets/images/interior-branding/ib-{j:02d}.png",
        "alt": f"{alts[j - 1]} — Supreme Advertising",
    }
    for j in range(1, len(files) + 1)
]
json_path = os.path.join(root, "data", "interior-branding-gallery.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(items, f, indent=2)
    f.write("\n")
print("gallery entries:", len(items))
