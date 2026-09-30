"""Merakit deck pengembangan dari slides.html + gaya dasar deck promosi.

    python promosi/deck-pengembangan/bangun.py

Keluaran: deck.html (fragmen, untuk Artifact) dan index.html (halaman mandiri).
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
dasar = open(os.path.join(HERE, "..", "deck", "deck.html"), encoding="utf-8").read()
gaya = re.search(r"<style>.*?</style>", dasar, re.S).group(0)
skrip = re.search(r"<script>.*?</script>", dasar, re.S).group(0)
slides = open(os.path.join(HERE, "slides.html"), encoding="utf-8").read()
n = slides.count('<section class="s"')

tambahan = """<style>
/* komponen khusus deck pengembangan */
.eb.sains{color:#0E6FA8} .eb.sains::before{background:#0E6FA8}
.tag{display:inline-block;padding:7px 16px;border-radius:99px;font-size:16px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.tag.sains{background:#DDEBFF;color:#1646D6} .tag.bisnis{background:#DDF6EC;color:#0E8A57}
.teks{font-size:21px;line-height:1.55;color:var(--ink2);margin-top:12px}
.sumber{margin-top:14px;font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--g)}
.rumus{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:24px;line-height:1.6;padding:22px 28px;border-radius:22px;box-shadow:var(--in);color:var(--ink)}
.rumus.kecil{font-size:18px;padding:16px 20px;margin-top:16px}
.baris{display:flex;gap:22px;align-items:baseline;padding:18px 26px;border-radius:22px;box-shadow:var(--neo-sm);font-size:23px;line-height:1.45}
.baris > b:first-child{flex:none;min-width:64px;font:500 20px var(--mono);color:var(--g)}
.baris.muted2{opacity:.6}
.tabel{width:100%;border-collapse:collapse;font-size:22px}
.tabel td,.tabel th{padding:16px 10px;text-align:left;vertical-align:top}
.tabel tr + tr td{border-top:1px solid var(--line)}
.tabel td:last-child{text-align:right;font-family:var(--mono);font-size:20px;color:var(--g)}
.tabel.lebar td:last-child{text-align:left;font-family:var(--sans);font-size:20px;color:var(--ink2)}
.tabel th{font-size:16px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)}
.matriks td,.matriks th{text-align:center!important}
.matriks td:first-child,.matriks th:first-child{text-align:left!important;font-weight:700;color:var(--ink)}
.matriks .kita{color:#0E8A57;font-weight:800;background:rgba(63,214,157,.10)}
.alur-h{display:flex;align-items:stretch;gap:0}
.alur-h .kartu{flex:1;padding:26px 24px;display:flex;flex-direction:column;gap:8px}
.alur-h em{font:500 17px var(--mono);font-style:normal;color:var(--g)}
.alur-h b{font-size:26px}
.alur-h span{font-size:18px;line-height:1.45;color:var(--ink2)}
.alur-h > i{flex:none;width:44px;align-self:center;height:4px;border-radius:4px;background:linear-gradient(90deg,#3FD69D,#0B9A62);margin:0 6px}
.garis-waktu{display:grid;grid-template-columns:repeat(4,1fr);gap:28px;position:relative}
.garis-waktu::before{content:"";position:absolute;left:30px;right:30px;top:-34px;height:6px;border-radius:6px;box-shadow:var(--in)}
.garis-waktu .kartu{padding:30px 28px;display:flex;flex-direction:column;gap:10px;position:relative}
.garis-waktu .kartu::before{content:"";position:absolute;left:28px;top:-44px;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#3FD69D,#0B9A62);box-shadow:var(--neo-sm)}
.garis-waktu em{font:500 16px var(--mono);font-style:normal;color:var(--g)}
.garis-waktu b{font-size:28px}
.garis-waktu span{font-size:19px;line-height:1.5;color:var(--ink2)}
.trl{display:flex;gap:12px;align-items:center}
.trl span{font:800 16px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-right:10px}
.trl i{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font:800 20px var(--sans);font-style:normal;color:var(--muted);box-shadow:var(--in)}
.trl i.on{color:#0E8A57;box-shadow:var(--neo-sm)}
.trl i.kini{background:linear-gradient(135deg,#3FD69D,#0B9A62);color:#fff}
.peringatan{padding:20px 26px;border-radius:20px;background:#FFF1D9;color:#8A5D00;font-size:19px;line-height:1.5}
</style>"""

kepala = ('<title>Deck Pengembangan TeleCare</title>\n'
          '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
          '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
          '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800'
          '&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">\n')
nav = ('<div class="nav" aria-label="Navigasi slide">\n'
       '  <button type="button" id="prev" aria-label="Slide sebelumnya">←</button>\n'
       '  <output id="pos">1 / %d</output>\n'
       '  <button type="button" id="next" aria-label="Slide berikutnya">→</button>\n</div>\n' % n)
badan = '<div class="deck" id="deck">\n' + slides + '\n</div>\n\n' + nav + '\n' + skrip + '\n'
frag = kepala + gaya + "\n" + tambahan + "\n\n" + badan
open(os.path.join(HERE, "deck.html"), "w", encoding="utf-8").write(frag)
doc = ('<!DOCTYPE html>\n<html lang="id">\n<head>\n<meta charset="UTF-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
       + kepala + gaya + "\n" + tambahan + '\n</head>\n<body>\n' + badan + '</body>\n</html>\n')
open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(doc)
print("slide:", n)
