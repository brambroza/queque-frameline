#!/usr/bin/env python3
"""Build the queue-journey swimlane as a PNG for the proposal.

Writes `diagrams/who-does-what.html` (an SVG page) and renders it with headless
Chrome to `screenshots/00-who-does-what.png` at 2x, so Thai text stays sharp
when the image is placed in the Word document.

Usage: python3 build_flow_png.py
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
HTML_OUT = HERE / "diagrams" / "who-does-what.html"
PNG_OUT = HERE / "screenshots" / "00-who-does-what.png"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

LANES = ["ผู้ดูแลระบบ\n(Admin)", "ลูกค้า / Supplier", "ระบบ\n(อัตโนมัติ + LINE)", "คนขับรถ", "เจ้าหน้าที่หน้างาน\n(Staff)"]
ADMIN, PARTNER, SYSTEM, DRIVER, STAFF = range(5)

LABEL_W = 210
COL_W = 166
BOX_W = 146
BOX_H = 66
LANE_H = 108
TOP = 72
PAD_R = 24


@dataclass(frozen=True)
class Step:
    """One box: `col` is the 0-based column, `no` the badge text ('' = alternative path)."""

    col: int
    lane: int
    no: str
    title: str
    sub: str
    alt: bool = False


STEPS = [
    Step(0, ADMIN, "1", "นำเข้า SO / PO", "CSV หรือกรอกเอง"),
    Step(1, ADMIN, "2", "ส่งลิงก์จอง / QR", "ทาง LINE หรือคัดลอก"),
    Step(2, PARTNER, "3", "จองคิวจากมือถือ", "เลือกรถ วัน เวลาที่ว่าง"),
    Step(3, SYSTEM, "4", "จองท่า + ออกเลขคิว", "แจ้งกลุ่ม LINE ทีมคลัง"),
    Step(4, ADMIN, "5", "ยืนยันคิว", "ระบบออกเลข DO"),
    Step(5, SYSTEM, "6", "ส่ง DO ทาง LINE", "พร้อมลิงก์สำหรับคนขับ"),
    Step(6, PARTNER, "7", "ส่งลิงก์ให้คนขับ", "แชร์ต่อใน LINE"),
    Step(7, DRIVER, "8", "เปิดลิงก์ ดู DO", "เห็นท่าและเวลานัด"),
    Step(8, DRIVER, "9", "กด “ฉันมาถึงแล้ว”", "ตรวจ GPS รัศมี 300 ม."),
    Step(9, SYSTEM, "10", "ท่าว่าง → เรียกคิว", "จอทีวี + LINE คนขับ"),
    Step(10, STAFF, "11", "ขึ้น / ลงของ", "เสร็จแล้วกดปิดงาน"),
    Step(11, SYSTEM, "12", "เรียกคันถัดไป", "อัตโนมัติเมื่อท่าว่าง"),
]

# (from index, to index, dashed)
LINKS = [(i, i + 1, False) for i in range(len(STEPS) - 1)]

# (first col, last col, label) — queue status after each step
STATUS = [(0, 1, "เอกสารรอจอง"), (2, 3, "รอยืนยัน"), (4, 7, "ยืนยันแล้ว · มีเลข DO"), (8, 8, "มาถึงแล้ว"),
          (9, 9, "เรียกเข้าท่า"), (10, 10, "ขึ้น/ลงของ → เสร็จ"), (11, 11, "คันถัดไป")]

N_COLS = max(s.col for s in STEPS) + 1
WIDTH = LABEL_W + N_COLS * COL_W + PAD_R
LANES_BOTTOM = TOP + LANE_H * len(LANES)
HEIGHT = LANES_BOTTOM + 128


def box_x(col: int) -> float:
    """Left edge of the box in a column."""
    return LABEL_W + col * COL_W + (COL_W - BOX_W) / 2


def box_y(lane: int) -> float:
    """Top edge of the box in a lane."""
    return TOP + lane * LANE_H + (LANE_H - BOX_H) / 2


def link_path(a: Step, b: Step, shift: float = 0) -> str:
    """Elbow connector from the right edge of `a` to the left edge of `b`; `shift` nudges the vertical run."""
    x1, y1 = box_x(a.col) + BOX_W, box_y(a.lane) + BOX_H / 2
    x2, y2 = box_x(b.col) - 2, box_y(b.lane) + BOX_H / 2
    if a.lane == b.lane:
        return f"M{x1},{y1} H{x2}"
    mid = x1 + (box_x(a.col + 1) - x1) / 2 + shift
    return f"M{x1},{y1} H{mid} V{y2} H{x2}"


def build_svg() -> str:
    """Return the full SVG markup."""
    out: list[str] = []
    out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" role="img" '
               'aria-label="เส้นทางของคิวหนึ่งคิว ตั้งแต่นำเข้าเอกสารจนปิดงาน แยกตามผู้เกี่ยวข้อง 5 ฝ่าย">')
    out.append('<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
               '<path d="M0,0 L10,5 L0,10 z" fill="#1F2937"/></marker>'
               '<marker id="ahd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
               '<path d="M0,0 L10,5 L0,10 z" fill="#6B7280"/></marker></defs>')
    out.append(f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#FFFFFF"/>')

    # Title
    out.append('<text x="24" y="44" class="h1">เส้นทางของคิวหนึ่งคิว ตั้งแต่เอกสารเข้าจนรถออกจากท่า</text>')

    # Lanes
    for i, name in enumerate(LANES):
        y = TOP + i * LANE_H
        out.append(f'<rect x="0" y="{y}" width="{WIDTH}" height="{LANE_H}" fill="{"#FFFFFF" if i % 2 == 0 else "#F3F6F4"}"/>')
        out.append(f'<rect x="0" y="{y}" width="6" height="{LANE_H}" fill="{"#0B7A4B" if i == SYSTEM else "#CBD5D0"}"/>')
        lines = name.split("\n")
        ty = y + LANE_H / 2 - (len(lines) - 1) * 11 + 6
        for j, line in enumerate(lines):
            out.append(f'<text x="24" y="{ty + j * 22}" class="{"lane" if j == 0 else "lane2"}">{escape(line)}</text>')
    out.append(f'<line x1="0" y1="{TOP}" x2="{WIDTH}" y2="{TOP}" class="rule"/>')
    out.append(f'<line x1="0" y1="{LANES_BOTTOM}" x2="{WIDTH}" y2="{LANES_BOTTOM}" class="rule"/>')
    out.append(f'<line x1="{LABEL_W - 14}" y1="{TOP}" x2="{LABEL_W - 14}" y2="{LANES_BOTTOM}" class="rule"/>')

    # Connectors (under the boxes)
    for a, b, dashed in LINKS:
        cls, marker = ("link dash", "ahd") if dashed else ("link", "ah")
        out.append(f'<path d="{link_path(STEPS[a], STEPS[b], -5 if dashed else 0)}" class="{cls}" marker-end="url(#{marker})"/>')

    # Boxes
    for s in STEPS:
        x, y = box_x(s.col), box_y(s.lane)
        kind = "sys" if s.lane == SYSTEM else "alt" if s.alt else "box"
        out.append(f'<rect x="{x}" y="{y}" width="{BOX_W}" height="{BOX_H}" rx="6" class="{kind}"/>')
        out.append(f'<text x="{x + BOX_W / 2}" y="{y + 29}" text-anchor="middle" class="t1">{escape(s.title)}</text>')
        out.append(f'<text x="{x + BOX_W / 2}" y="{y + 49}" text-anchor="middle" class="t2">{escape(s.sub)}</text>')
        if s.no:
            out.append(f'<circle cx="{x}" cy="{y}" r="12" fill="#F2B01E"/>')
            out.append(f'<text x="{x}" y="{y + 4.5}" text-anchor="middle" class="no">{s.no}</text>')
        else:
            out.append(f'<rect x="{x - 14}" y="{y - 11}" width="36" height="22" rx="11" fill="#FFFFFF" stroke="#6B7280" stroke-width="1"/>')
            out.append(f'<text x="{x + 4}" y="{y + 4.5}" text-anchor="middle" class="or">หรือ</text>')

    # Status strip
    sy = LANES_BOTTOM + 34
    out.append(f'<text x="24" y="{sy + 5}" class="lane">สถานะของคิว</text>')
    for first, last, label in STATUS:
        x1, x2 = box_x(first), box_x(last) + BOX_W
        out.append(f'<rect x="{x1}" y="{sy - 14}" width="{x2 - x1}" height="28" rx="14" class="pill"/>')
        out.append(f'<text x="{(x1 + x2) / 2}" y="{sy + 5}" text-anchor="middle" class="st">{escape(label)}</text>')

    # Legend
    ly = LANES_BOTTOM + 92
    lx = LABEL_W - 14
    out.append(f'<rect x="{lx}" y="{ly - 13}" width="26" height="18" rx="4" class="box"/><text x="{lx + 36}" y="{ly + 1}" class="lg">คนเป็นผู้ทำ</text>')
    out.append(f'<rect x="{lx + 150}" y="{ly - 13}" width="26" height="18" rx="4" class="sys"/><text x="{lx + 186}" y="{ly + 1}" class="lg">ระบบทำเองอัตโนมัติ</text>')
    out.append("</svg>")
    return "".join(out)


def build_html(svg: str) -> str:
    """Wrap the SVG in a page that uses the locally installed Thai font."""
    return f"""<!doctype html><html lang="th"><head><meta charset="utf-8"><title>เส้นทางของคิว</title><style>
html,body{{margin:0;background:#fff}}
svg{{display:block;font-family:"Sarabun","IBM Plex Sans Thai","Tahoma",sans-serif}}
.h1{{font-size:26px;font-weight:700;fill:#1F2937}} .lede{{font-size:16px;fill:#6B7280}}
.lane{{font-size:16px;font-weight:700;fill:#1F2937}} .lane2{{font-size:14px;fill:#6B7280}}
.rule{{stroke:#CBD5D0;stroke-width:1}}
.box{{fill:#fff;stroke:#1F2937;stroke-width:1.4}} .sys{{fill:#E3F3EA;stroke:#0B7A4B;stroke-width:1.6}}
.alt{{fill:#fff;stroke:#6B7280;stroke-width:1.4;stroke-dasharray:5 4}}
.t1{{font-size:14.5px;font-weight:700;fill:#1F2937}} .t2{{font-size:12.5px;fill:#4B5563}}
.no{{font-size:12.5px;font-weight:700;fill:#3A2A00}} .or{{font-size:11.5px;font-weight:600;fill:#4B5563}}
.link{{fill:none;stroke:#1F2937;stroke-width:1.5}} .link.dash{{stroke:#6B7280;stroke-dasharray:5 4}}
.pill{{fill:#F3F6F4;stroke:#CBD5D0;stroke-width:1}} .st{{font-size:13px;font-weight:600;fill:#0B7A4B}}
.lg{{font-size:13.5px;fill:#4B5563}}
</style></head><body>{svg}</body></html>"""


def main() -> None:
    """Write the HTML and render the PNG."""
    HTML_OUT.parent.mkdir(parents=True, exist_ok=True)
    HTML_OUT.write_text(build_html(build_svg()), encoding="utf-8")
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
         f"--window-size={WIDTH},{HEIGHT}", "--virtual-time-budget=2000", f"--screenshot={PNG_OUT}", HTML_OUT.as_uri()],
        check=True, capture_output=True,
    )
    print(f"{PNG_OUT.relative_to(HERE)}  {WIDTH * 2}x{HEIGHT * 2}px")


if __name__ == "__main__":
    main()
