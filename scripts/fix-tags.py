import pathlib
root = pathlib.Path(__file__).resolve().parents[1]
for rel in ["admin/js/print.js", "admin/js/admin.js"]:
    p = root / rel
    t = p.read_text(encoding="utf-8")
    t = t.replace("<motion>", "<div>").replace("</motion>", "</div>").replace("<motion ", "<div ")
    p.write_text(t, encoding="utf-8")
    print("fixed", rel)
