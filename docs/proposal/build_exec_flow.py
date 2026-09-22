#!/usr/bin/env python3
"""Build the executive flow page (artifact + PNG) for the Fameline management briefing.

Outputs
  diagrams/executive-flow.html         page fragment published as an artifact (no <html>/<head>)
  diagrams/executive-flow.local.html   the same page wrapped as a standalone file (open offline)
  screenshots/00b-executive-flow.png   full page, 2x
  screenshots/00c-executive-swimlane.png   the two swimlanes only, 2x

`who-does-what.html` / `build_flow_png.py` are left alone — the proposal .docx still uses them.

Usage: python3 build_exec_flow.py [--no-png]
"""
from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRAGMENT_OUT = HERE / "diagrams" / "executive-flow.html"
LOCAL_OUT = HERE / "diagrams" / "executive-flow.local.html"
PNG_FULL = HERE / "screenshots" / "00b-executive-flow.png"
PNG_LANES = HERE / "screenshots" / "00c-executive-swimlane.png"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

LABEL_W = 176
COL_W = 172
BOX_W = 146
BOX_H = 66
LANE_H = 112
TOP = 10
PAD_R = 24
STRIP_H = 64
DIAMOND_RX = 68
DIAMOND_RY = 42


@dataclass(frozen=True)
class Step:
    """One box. `no` is the badge text ('' = alternative path, drawn dashed with an "หรือ" tag)."""

    col: int
    lane: int
    no: str
    title: str
    sub: str
    line: bool = False
    system: bool = False


@dataclass(frozen=True)
class Figure:
    """One swimlane drawing."""

    lanes: list[str]
    system_lane: int
    steps: list[Step]
    n_cols: int
    status: list[tuple[int, int, str]]
    aria: str

    @property
    def width(self) -> int:
        """Drawing width in SVG units."""
        return LABEL_W + self.n_cols * COL_W + PAD_R

    @property
    def lanes_bottom(self) -> int:
        """Y of the rule under the last lane."""
        return TOP + LANE_H * len(self.lanes)

    @property
    def height(self) -> int:
        """Drawing height in SVG units."""
        return self.lanes_bottom + STRIP_H


def box_x(col: int) -> float:
    """Left edge of the box in a column."""
    return LABEL_W + col * COL_W + (COL_W - BOX_W) / 2


def box_y(lane: int) -> float:
    """Top edge of the box in a lane."""
    return TOP + lane * LANE_H + (LANE_H - BOX_H) / 2


def col_cx(col: int) -> float:
    """Horizontal centre of a column."""
    return LABEL_W + col * COL_W + COL_W / 2


def lane_cy(lane: int) -> float:
    """Vertical centre of a lane."""
    return TOP + lane * LANE_H + LANE_H / 2


def elbow(a: Step, b: Step, shift: float = 0) -> str:
    """Connector from the right edge of `a` to the left edge of `b`; `shift` nudges the vertical run."""
    x1, y1 = box_x(a.col) + BOX_W, lane_cy(a.lane)
    x2, y2 = box_x(b.col) - 2, lane_cy(b.lane)
    if a.lane == b.lane:
        return f"M{x1},{y1} H{x2}"
    mid = x1 + (box_x(a.col + 1) - x1) / 2 + shift
    return f"M{x1},{y1} H{mid} V{y2} H{x2}"


def svg_open(fig: Figure) -> list[str]:
    """SVG header, arrow markers, lanes and rules."""
    w, h = fig.width, fig.height
    out = [f'<svg viewBox="0 0 {w} {h}" role="img" aria-label="{escape(fig.aria)}">',
           '<defs>'
           '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk"/></marker>'
           '<marker id="ahd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk-muted"/></marker>'
           '<marker id="ahw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk-warn"/></marker>'
           '</defs>']
    for i, name in enumerate(fig.lanes):
        y = TOP + i * LANE_H
        out.append(f'<rect x="0" y="{y}" width="{w}" height="{LANE_H}" class="{"lane-a" if i % 2 == 0 else "lane-b"}"/>')
        out.append(f'<rect x="0" y="{y}" width="6" height="{LANE_H}" class="{"rail-sys" if i == fig.system_lane else "rail"}"/>')
        lines = name.split("\n")
        ty = y + LANE_H / 2 - (len(lines) - 1) * 11 + 6
        for j, line in enumerate(lines):
            out.append(f'<text x="22" y="{ty + j * 22}" class="{"lane" if j == 0 else "lane2"}">{escape(line)}</text>')
    out.append(f'<line x1="0" y1="{TOP}" x2="{w}" y2="{TOP}" class="rule"/>')
    out.append(f'<line x1="0" y1="{fig.lanes_bottom}" x2="{w}" y2="{fig.lanes_bottom}" class="rule"/>')
    out.append(f'<line x1="{LABEL_W - 12}" y1="{TOP}" x2="{LABEL_W - 12}" y2="{fig.lanes_bottom}" class="rule"/>')
    return out


def svg_boxes(fig: Figure) -> list[str]:
    """Step boxes with number badge, LINE tag and "หรือ" tag."""
    out: list[str] = []
    for s in fig.steps:
        x, y = box_x(s.col), box_y(s.lane)
        kind = "sys" if s.system else "alt" if not s.no else "box"
        out.append(f'<rect x="{x}" y="{y}" width="{BOX_W}" height="{BOX_H}" rx="6" class="{kind}"/>')
        out.append(f'<text x="{x + BOX_W / 2}" y="{y + 29}" text-anchor="middle" class="t1">{escape(s.title)}</text>')
        out.append(f'<text x="{x + BOX_W / 2}" y="{y + 49}" text-anchor="middle" class="t2">{escape(s.sub)}</text>')
        if s.no:
            out.append(f'<circle cx="{x}" cy="{y}" r="12" class="badge"/>')
            out.append(f'<text x="{x}" y="{y + 4.5}" text-anchor="middle" class="no">{s.no}</text>')
        else:
            out.append(f'<rect x="{x - 14}" y="{y - 11}" width="36" height="22" rx="11" class="or-bg"/>')
            out.append(f'<text x="{x + 4}" y="{y + 4.5}" text-anchor="middle" class="or">หรือ</text>')
        if s.line:
            out.append(f'<rect x="{x + BOX_W - 42}" y="{y - 9}" width="36" height="18" rx="9" class="line-bg"/>')
            out.append(f'<text x="{x + BOX_W - 24}" y="{y + 4}" text-anchor="middle" class="line-tx">LINE</text>')
    return out


def svg_status(fig: Figure) -> list[str]:
    """Queue-status strip under the lanes."""
    sy = fig.lanes_bottom + 34
    out = [f'<text x="22" y="{sy + 5}" class="lane">สถานะของคิว</text>']
    for first, last, label in fig.status:
        x1, x2 = box_x(first), box_x(last) + BOX_W
        out.append(f'<rect x="{x1}" y="{sy - 14}" width="{x2 - x1}" height="28" rx="14" class="pill"/>')
        out.append(f'<text x="{(x1 + x2) / 2}" y="{sy + 5}" text-anchor="middle" class="st">{escape(label)}</text>')
    return out


# ---------------------------------------------------------------- figure 1: before the appointment day
OFFICE, PARTNER, SYS1 = range(3)
FIG1 = Figure(
    lanes=["ทีมคลัง (สำนักงาน)\nAdmin / เจ้าหน้าที่", "ลูกค้า / Supplier", "ระบบ\nอัตโนมัติ + LINE"],
    system_lane=SYS1,
    steps=[
        Step(0, OFFICE, "1", "นำเข้า SO / PO", "ไฟล์ CSV หรือกรอกเอง"),
        Step(1, OFFICE, "2", "ส่งลิงก์จอง / QR", "ทาง LINE หรือคัดลอก", line=True),
        Step(2, PARTNER, "3", "จองคิวจากมือถือ", "เลือกรถ วัน เวลาที่ว่าง"),
        Step(3, SYS1, "4", "จองท่า + ออกเลขคิว", "กันเวลาซ้อนท่าเดียวกัน", line=True, system=True),
        Step(5, OFFICE, "5", "บันทึกการชำระเงิน", "ชำระแล้ว หรือ เครดิต", line=True),
        Step(6, OFFICE, "6", "ยืนยันคิว", "ระบบออกเลข DO"),
        Step(7, SYS1, "7", "ส่ง DO ทาง LINE", "พร้อมลิงก์สำหรับคนขับ", line=True, system=True),
        Step(8, PARTNER, "8", "ส่งลิงก์ให้คนขับ", "แชร์ต่อใน LINE"),
    ],
    n_cols=9,
    status=[(0, 1, "เอกสารรอจอง"), (2, 5, "รอยืนยัน · SO ที่ยังไม่ชำระค้างอยู่ตรงนี้"), (6, 8, "ยืนยันแล้ว · มีเลข DO")],
    aria="ก่อนวันนัด: ทีมคลังนำเข้าเอกสารและส่งลิงก์ ลูกค้าจองคิว ระบบจองท่า ตรวจการชำระเงินของ SO แล้วทีมคลังยืนยันคิว ระบบออก DO และส่งลิงก์ให้คนขับ",
)


def build_fig1() -> str:
    """Swimlane 1 — document in, booking, payment gate, confirmation, DO out."""
    f = FIG1
    s = {x.no: x for x in f.steps}
    out = svg_open(f)
    gate_cx, gate_cy = col_cx(4), lane_cy(SYS1)
    office_y = lane_cy(OFFICE)

    for a, b in [("1", "2"), ("2", "3"), ("3", "4"), ("5", "6"), ("6", "7"), ("7", "8")]:
        out.append(f'<path d="{elbow(s[a], s[b])}" class="link" marker-end="url(#ah)"/>')
    # 4 -> payment gate
    out.append(f'<path d="M{box_x(3) + BOX_W},{gate_cy} H{gate_cx - DIAMOND_RX - 2}" class="link" marker-end="url(#ah)"/>')
    # gate -> 5 (SO not yet paid)
    out.append(f'<path d="M{gate_cx},{gate_cy - DIAMOND_RY} V{office_y} H{box_x(5) - 2}" class="link warn" marker-end="url(#ahw)"/>')
    out.append(f'<text x="{gate_cx + 10}" y="{lane_cy(PARTNER) + 5}" class="edge warn-tx">SO ยังไม่ชำระ</text>')
    # gate -> 6 (cleared) enters the confirm box from below
    out.append(f'<path d="M{gate_cx + DIAMOND_RX},{gate_cy} H{col_cx(6)} V{box_y(OFFICE) + BOX_H + 2}" class="link" marker-end="url(#ah)"/>')
    out.append(f'<text x="{(gate_cx + DIAMOND_RX + col_cx(6)) / 2}" y="{gate_cy - 10}" text-anchor="middle" class="edge">ชำระแล้ว · เครดิต · หรือเป็น PO</text>')

    # the gate itself
    pts = f"{gate_cx - DIAMOND_RX},{gate_cy} {gate_cx},{gate_cy - DIAMOND_RY} {gate_cx + DIAMOND_RX},{gate_cy} {gate_cx},{gate_cy + DIAMOND_RY}"
    out.append(f'<polygon points="{pts}" class="gate"/>')
    out.append(f'<text x="{gate_cx}" y="{gate_cy - 2}" text-anchor="middle" class="t1">ด่านชำระเงิน</text>')
    out.append(f'<text x="{gate_cx}" y="{gate_cy + 16}" text-anchor="middle" class="t2">SO เคลียร์แล้ว?</text>')

    out += svg_boxes(f) + svg_status(f)
    out.append("</svg>")
    return "".join(out)


# ---------------------------------------------------------------- figure 2: the appointment day
SYS2, DRIVER, STAFF = range(3)
FIG2 = Figure(
    lanes=["ระบบ\nอัตโนมัติ + LINE", "คนขับรถ", "เจ้าหน้าที่หน้างาน\nประตู / ลานจอด"],
    system_lane=SYS2,
    steps=[
        Step(0, DRIVER, "9", "เปิดลิงก์ ดู DO", "เห็นท่าและเวลานัด"),
        Step(1, DRIVER, "10", "กด “ฉันมาถึงแล้ว”", "ตรวจ GPS รัศมี 300 ม.", line=True),
        Step(1, STAFF, "", "เช็คอินให้ที่ประตู", "ตรวจทะเบียนรถ", line=True),
        Step(2, SYS2, "11", "ท่าว่าง → เรียกคิว", "จอทีวีลาน + LINE คนขับ", line=True, system=True),
        Step(3, STAFF, "12", "ขึ้น / ลงของ", "เสร็จแล้วกดปิดงาน"),
        Step(4, SYS2, "13", "เรียกคันถัดไป", "อัตโนมัติเมื่อท่าว่าง", system=True),
    ],
    n_cols=5,
    status=[(0, 0, "ยืนยันแล้ว"), (1, 1, "มาถึงแล้ว"), (2, 2, "เรียกเข้าท่า"), (3, 3, "ขึ้น/ลงของ → เสร็จ"), (4, 4, "ท่าว่าง")],
    aria="วันนัด: คนขับเปิดลิงก์ดู DO กดเช็คอินเมื่อมาถึงหรือเจ้าหน้าที่เช็คอินให้ที่ประตู ระบบเรียกคิวเมื่อท่าว่าง เจ้าหน้าที่ขึ้นลงของแล้วปิดงาน ระบบเรียกคันถัดไป",
)


def build_fig2() -> str:
    """Swimlane 2 — arrival, call, loading, next truck."""
    f = FIG2
    open_do, arrive, gate_in, call, load, nxt = f.steps
    out = svg_open(f)
    out.append(f'<path d="{elbow(open_do, gate_in, -6)}" class="link dash" marker-end="url(#ahd)"/>')
    out.append(f'<path d="{elbow(gate_in, call, -6)}" class="link dash" marker-end="url(#ahd)"/>')
    for a, b in [(open_do, arrive), (arrive, call), (call, load), (load, nxt)]:
        out.append(f'<path d="{elbow(a, b)}" class="link" marker-end="url(#ah)"/>')
    out += svg_boxes(f) + svg_status(f)
    out.append("</svg>")
    return "".join(out)


PAGE = r"""<title>เส้นทางคิว Fameline</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@500;600;700&family=Sarabun:wght@400;500;600;700&display=swap">
<style>
:root{
  --ground:#F8FAF8; --surface:#FFFFFF; --lane:#EFF4F0; --ink:#1B2A24; --muted:#56675F; --rule:#CBD5D0;
  --brand:#0B7A4B; --brand-soft:#E3F3EA; --badge:#F2B01E; --badge-ink:#3A2A00; --warn:#B45309; --warn-soft:#FDF1E1; --line:#06A94A;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --ground:#0E1512; --surface:#18231E; --lane:#131C18; --ink:#E6EEE9; --muted:#9DB0A7; --rule:#2F3E36;
    --brand:#4CC38A; --brand-soft:#15382A; --badge:#F2B01E; --badge-ink:#3A2A00; --warn:#F0A44B; --warn-soft:#3A2A14; --line:#06A94A;
  }
}
:root[data-theme="dark"]{
  --ground:#0E1512; --surface:#18231E; --lane:#131C18; --ink:#E6EEE9; --muted:#9DB0A7; --rule:#2F3E36;
  --brand:#4CC38A; --brand-soft:#15382A; --badge:#F2B01E; --badge-ink:#3A2A00; --warn:#F0A44B; --warn-soft:#3A2A14; --line:#06A94A;
}
body{background:var(--ground);color:var(--ink);font-family:"Sarabun","IBM Plex Sans Thai","Tahoma",sans-serif;font-size:17px;line-height:1.65}
.wrap{max-width:1480px;margin-inline:auto;padding-inline:clamp(16px,3.5vw,48px);padding-block:40px 56px;display:flex;flex-direction:column;gap:56px}
h1,h2,h3{font-family:"IBM Plex Sans Thai","Sarabun","Tahoma",sans-serif;text-wrap:balance;margin:0;line-height:1.3}
h1{font-size:clamp(28px,3.4vw,40px);font-weight:700}
h2{font-size:24px;font-weight:700}
h3{font-size:18px;font-weight:600}
p{margin:0}
.eyebrow{font-size:14px;font-weight:600;letter-spacing:.04em;color:var(--brand)}
header{display:flex;flex-direction:column;gap:12px}
.lede{max-width:64ch;font-size:19px;color:var(--muted)}
.lede strong{color:var(--ink);font-weight:600}
section{display:flex;flex-direction:column;gap:20px}
.sec-head{display:flex;flex-direction:column;gap:4px}
.sec-head p{color:var(--muted);max-width:70ch}
figure{margin:0;display:flex;flex-direction:column;gap:12px;min-width:0}
.scroll{overflow-x:auto;background:var(--surface);border:1px solid var(--rule);border-radius:4px}
.scroll svg{display:block;width:100%;height:auto;font-family:"Sarabun","IBM Plex Sans Thai","Tahoma",sans-serif}
#fig1 svg{min-width:1180px}
#fig2 svg{min-width:720px}
figcaption{font-size:15px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 22px;align-items:center}
.key{display:inline-flex;align-items:center;gap:8px}
.sw{display:inline-block;width:24px;height:16px;border-radius:4px;border:1.5px solid var(--ink);background:var(--surface)}
.sw.sys{border-color:var(--brand);background:var(--brand-soft)}
.sw.alt{border-style:dashed;border-color:var(--muted)}
.sw.line{border:0;background:var(--line);width:34px;border-radius:9px;color:#fff;font-size:10px;font-weight:700;text-align:center;line-height:16px}
.day{display:flex;gap:40px;align-items:flex-start}
.day figure{flex:0 1 60.6%}
.day aside{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:18px}
.exc{display:flex;flex-direction:column;gap:6px;padding-top:14px;border-top:1px solid var(--rule)}
.chain{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;font-size:15px}
.chip{padding:2px 12px;border-radius:14px;border:1px solid var(--rule);background:var(--surface);font-weight:600;white-space:nowrap}
.chip.bad{border-color:var(--warn);color:var(--warn);background:var(--warn-soft)}
.chip.ok{border-color:var(--brand);color:var(--brand);background:var(--brand-soft)}
.arr{color:var(--muted);white-space:nowrap}
.exc p{font-size:15.5px;color:var(--muted)}
.controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 48px}
.ctl{display:flex;flex-direction:column;gap:8px;padding-top:16px;border-top:2px solid var(--brand)}
.ctl dl{margin:0;display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;font-size:16px}
.ctl dt{color:var(--muted);font-weight:600}
.ctl dd{margin:0}
.note{color:var(--muted);max-width:75ch}
.tbl{overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:620px;font-size:16px}
th,td{text-align:left;padding:10px 14px 10px 0;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-size:14px;font-weight:600;color:var(--muted);letter-spacing:.03em}
td.n{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap;color:var(--brand)}
td.f{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:13px;color:var(--muted)}
footer{font-size:14px;color:var(--muted);border-top:1px solid var(--rule);padding-top:16px}
@media (max-width:1100px){.day{flex-direction:column}.day figure{flex:1 1 auto;width:100%}.controls{grid-template-columns:1fr}}
:root.only-lanes header,:root.only-lanes #controls,:root.only-lanes #demo,:root.only-lanes footer,:root.only-lanes .day aside{display:none}
:root.only-lanes .wrap{gap:32px;padding-block:24px}

/* swimlane marks */
.lane-a{fill:var(--surface)} .lane-b{fill:var(--lane)}
.rail{fill:var(--rule)} .rail-sys{fill:var(--brand)}
.rule{stroke:var(--rule);stroke-width:1}
.lane{font-size:16px;font-weight:700;fill:var(--ink)} .lane2{font-size:13.5px;fill:var(--muted)}
.box{fill:var(--surface);stroke:var(--ink);stroke-width:1.4}
.sys{fill:var(--brand-soft);stroke:var(--brand);stroke-width:1.6}
.alt{fill:var(--surface);stroke:var(--muted);stroke-width:1.4;stroke-dasharray:5 4}
.gate{fill:var(--warn-soft);stroke:var(--warn);stroke-width:1.6}
.t1{font-size:14.5px;font-weight:700;fill:var(--ink)} .t2{font-size:12.5px;fill:var(--muted)}
.badge{fill:var(--badge)} .no{font-size:12.5px;font-weight:700;fill:var(--badge-ink)}
.or-bg{fill:var(--surface);stroke:var(--muted);stroke-width:1} .or{font-size:11.5px;font-weight:600;fill:var(--muted)}
.line-bg{fill:var(--line)} .line-tx{font-size:10px;font-weight:700;fill:#fff;letter-spacing:.04em}
.link{fill:none;stroke:var(--ink);stroke-width:1.5}
.link.dash{stroke:var(--muted);stroke-dasharray:5 4}
.link.warn{stroke:var(--warn);stroke-dasharray:5 4}
.mk{fill:var(--ink)} .mk-muted{fill:var(--muted)} .mk-warn{fill:var(--warn)}
.edge{font-size:12.5px;font-weight:600;fill:var(--muted)} .warn-tx{fill:var(--warn)}
.pill{fill:var(--lane);stroke:var(--rule);stroke-width:1} .st{font-size:13px;font-weight:600;fill:var(--brand)}
</style>
<script>if(/[?&]only=swimlane/.test(location.search))document.documentElement.classList.add('only-lanes');</script>

<div class="wrap">
<header>
  <p class="eyebrow">Fameline Dock Queue · ระบบคิวรับ-ส่งสินค้าหน้าคลัง</p>
  <h1>เส้นทางของคิวหนึ่งคิว ตั้งแต่เอกสารเข้าจนรถออกจากท่า</h1>
  <p class="lede">คน 4 กลุ่มทำงานต่อกันผ่านระบบเดียว <strong>ลูกค้าและคนขับไม่ต้องติดตั้งแอปหรือสมัครสมาชิก</strong> ใช้ลิงก์ที่ได้รับทาง LINE เท่านั้น ส่วนงานที่ต้องเฝ้า เช่น จัดท่า เรียกคิว แจ้งเตือน ระบบทำให้เอง</p>
</header>

<section id="before">
  <div class="sec-head">
    <h2>ก่อนวันนัด — จากเอกสารถึงใบ DO</h2>
    <p>คิวได้เลข DO ก็ต่อเมื่อทีมคลังยืนยัน และ SO ใบนั้นผ่านด่านชำระเงินแล้วเท่านั้น</p>
  </div>
  <figure id="fig1">
    <div class="scroll">__FIG1__</div>
    <figcaption>
      <span class="key"><span class="sw"></span>คนเป็นผู้ทำ</span>
      <span class="key"><span class="sw sys"></span>ระบบทำเองอัตโนมัติ</span>
      <span class="key"><span class="sw alt"></span>ทางเลือก</span>
      <span class="key"><span class="sw line">LINE</span>ขั้นที่มีการแจ้งเตือนทาง LINE</span>
    </figcaption>
  </figure>
</section>

<section id="day">
  <div class="sec-head">
    <h2>วันนัด — จากรถมาถึงจนปิดงาน</h2>
    <p>ท่าว่างเมื่อไร ระบบเรียกคันถัดไปเอง ไม่ต้องมีคนคอยไล่ดูลำดับ</p>
  </div>
  <div class="day">
    <figure id="fig2">
      <div class="scroll">__FIG2__</div>
      <figcaption>เส้นประ = เจ้าหน้าที่เช็คอินแทนได้ กรณีคนขับไม่ได้กดเองหรือไม่มีสัญญาณ GPS</figcaption>
    </figure>
    <aside>
      <h3>ถ้าไม่เป็นไปตามแผน</h3>
      <div class="exc">
        <div class="chain"><span class="chip ok">ยืนยันแล้ว</span><span class="arr">เลยเวลานัด 30 นาที →</span><span class="chip bad">มาสาย</span><span class="arr">เลยอีก 30 นาที →</span><span class="chip bad">ไม่มา</span></div>
        <p>ระบบปรับสถานะเอง รถที่มาสายยังเช็คอินได้ ครบเวลาแล้วท่าถูกปล่อยให้คันอื่น แจ้ง LINE ลูกค้าและทีมคลัง เวลาผ่อนผันตั้งค่าได้</p>
      </div>
      <div class="exc">
        <div class="chain"><span class="chip ok">เรียกเข้าท่า</span><span class="arr">15 นาทีไม่เข้าท่า →</span><span class="chip bad">ไม่มา</span><span class="arr">→</span><span class="chip">เรียกคันถัดไป</span></div>
        <p>ก่อนครบเวลา เจ้าหน้าที่กดเรียกซ้ำ หรือยกเลิกการเรียกเพื่อคืนคิวกลับไปรอได้</p>
      </div>
      <div class="exc">
        <div class="chain"><span class="chip">รอยืนยัน / ยืนยันแล้ว</span><span class="arr">→</span><span class="chip bad">ยกเลิก</span></div>
        <p>ลูกค้ายกเลิกเองได้จากลิงก์จนก่อนรถเช็คอิน ฝั่งคลังยกเลิกต้องระบุเหตุผล และลูกค้าเห็นเหตุผลนั้น แจ้ง LINE ทั้งสองฝ่าย</p>
      </div>
    </aside>
  </div>
</section>

<section id="controls">
  <div class="sec-head">
    <h2>จุดควบคุม 4 จุดที่ระบบบังคับให้</h2>
    <p>เป็นกติกาที่ระบบไม่ยอมให้ข้าม ไม่ได้อาศัยความจำหรือความระวังของคน</p>
  </div>
  <div class="controls">
    <div class="ctl">
      <h3>ด่านชำระเงิน — ขั้น 5</h3>
      <dl>
        <dt>กันอะไร</dt><dd>รถเข้ามาขึ้นของทั้งที่ SO ยังไม่เคลียร์เงิน</dd>
        <dt>ระบบทำ</dt><dd>SO ที่ยังไม่ชำระจองคิวได้ แต่ค้างที่ “รอยืนยัน” ออก DO ไม่ได้ จนเจ้าหน้าที่บันทึกว่าชำระแล้วหรือเป็นลูกค้าเครดิต PO ขารับของไม่ถูกตรวจ</dd>
        <dt>ผลที่ได้</dt><dd>ไม่มีใบ DO หลุดออกไปก่อนเงินเคลียร์ ไม่ว่าใครเป็นคนกดยืนยัน</dd>
      </dl>
    </div>
    <div class="ctl">
      <h3>กันคิวซ้อนท่า — ขั้น 4 และ 6</h3>
      <dl>
        <dt>กันอะไร</dt><dd>รถสองคันได้ท่าเดียวกันในเวลาเดียวกัน</dd>
        <dt>ระบบทำ</dt><dd>ตรวจเวลาที่ท่า รวมเวลาเผื่อสลับรถ ทั้งตอนจองและตอนยืนยัน คนละท่าเวลาซ้อนกันได้ตามปกติ</dd>
        <dt>ผลที่ได้</dt><dd>หน้างานไม่ต้องแก้ปัญหารถชนคิวกันหน้าท่า</dd>
      </dl>
    </div>
    <div class="ctl">
      <h3>เช็คอินด้วยตำแหน่งจริง — ขั้น 10</h3>
      <dl>
        <dt>กันอะไร</dt><dd>คนขับกดว่ามาถึงทั้งที่ยังอยู่ระหว่างทาง แล้วแซงคิวคันที่มาถึงจริง</dd>
        <dt>ระบบทำ</dt><dd>กดได้เฉพาะวันนัด และต้องอยู่ในรัศมี 300 เมตรจากคลัง (ตั้งค่าได้ต่อสาขา) เจ้าหน้าที่ประตูยังตรวจทะเบียนซ้ำได้</dd>
        <dt>ผลที่ได้</dt><dd>ลำดับเรียกคิวอิงรถที่อยู่หน้าคลังจริง</dd>
      </dl>
    </div>
    <div class="ctl">
      <h3>ลิงก์เฉพาะเอกสาร — ขั้น 2 และ 7</h3>
      <dl>
        <dt>กันอะไร</dt><dd>คนนอกเข้ามาจองหรือเห็นข้อมูลของลูกค้ารายอื่น</dd>
        <dt>ระบบทำ</dt><dd>หนึ่งลิงก์ผูกกับ SO/PO ใบเดียว มีวันหมดอายุ ออกลิงก์ใหม่แล้วลิงก์เก่าใช้ไม่ได้ทันที คนขับเห็นเฉพาะงานของตัวเอง จอทีวีลานไม่แสดงชื่อหรือเบอร์โทร</dd>
        <dt>ผลที่ได้</dt><dd>ใช้งานง่ายแบบไม่ต้อง login โดยไม่เปิดข้อมูลเกินจำเป็น</dd>
      </dl>
    </div>
  </div>
  <p class="note">ทุกการกดในระบบถูกบันทึกว่าใครทำ เมื่อไร เปลี่ยนจากอะไรเป็นอะไร ตรวจย้อนหลังได้ทุกคิว</p>
</section>

<section id="demo">
  <div class="sec-head">
    <h2>แต่ละขั้นดูได้จากหน้าจอไหนในระบบต้นแบบ</h2>
    <p>ลำดับเดินสาธิต เลขขั้นตรงกับแผนภาพด้านบน</p>
  </div>
  <div class="tbl">
  <table>
    <thead><tr><th>ขั้น</th><th>หน้าจอ</th><th>ผู้ใช้</th><th>ภาพประกอบ</th></tr></thead>
    <tbody>
      <tr><td class="n">1–2</td><td>เอกสาร SO/PO › นำเข้า, ลิงก์จอง + QR</td><td>ทีมคลัง</td><td class="f">02a-documents · 02b-documents-link-qr</td></tr>
      <tr><td class="n">3</td><td>หน้าจองของลูกค้า 5 ขั้น: รถ › วัน › เวลา › รายละเอียด › ยืนยัน</td><td>ลูกค้า / Supplier</td><td class="f">03a … 05c-book-submitted</td></tr>
      <tr><td class="n">4</td><td>สถานะคิวฝั่งลูกค้า, รายการคิวรอยืนยันฝั่งคลัง</td><td>ลูกค้า · ทีมคลัง</td><td class="f">05d-book-status · 06h-bookings-pending</td></tr>
      <tr><td class="n">5</td><td>เอกสาร SO/PO › บันทึกการชำระเงิน</td><td>ทีมคลัง</td><td>สาธิตสดจากระบบ</td></tr>
      <tr><td class="n">6–7</td><td>รายละเอียดคิว › อนุมัติคิว + ออก DO, ใบ DO</td><td>ทีมคลัง</td><td class="f">06b-booking-drawer · 06e-do-sheet</td></tr>
      <tr><td class="n">8–10</td><td>หน้าคนขับ: DO ท่า เวลานัด ปุ่ม “ฉันมาถึงแล้ว”</td><td>คนขับ</td><td class="f">08b-driver-full</td></tr>
      <tr><td class="n">11</td><td>บอร์ดคิววันนี้, จอทีวีลาน, หน้าคนขับตอนถูกเรียก</td><td>เจ้าหน้าที่ · คนขับ</td><td class="f">07-queue-board · 09-display-tv · 08a-driver-called</td></tr>
      <tr><td class="n">12–13</td><td>บอร์ดคิววันนี้ › เริ่มขึ้น/ลงของ › ปิดงาน</td><td>เจ้าหน้าที่หน้างาน</td><td class="f">07-queue-board</td></tr>
      <tr><td class="n">หลังจบ</td><td>ประวัติของคิว, แดชบอร์ด, รายงาน</td><td>ผู้บริหาร · ทีมคลัง</td><td class="f">06c-timeline · 10-dashboard · 11-reports</td></tr>
    </tbody>
  </table>
  </div>
</section>

<footer>จัดทำโดย GoAlong · อ้างอิงระบบต้นแบบ ณ วันที่ 21 กันยายน 2569 · ค่าเวลาผ่อนผัน 30 นาที เวลารอเข้าท่า 15 นาที และรัศมี 300 เมตร เป็นค่าเริ่มต้นที่ปรับได้</footer>
</div>
"""


def build_fragment() -> str:
    """The page fragment (artifact skeleton adds <html>/<head>/<body>)."""
    return PAGE.replace("__FIG1__", build_fig1()).replace("__FIG2__", build_fig2())


def render(url: str, png: Path, width: int, height: int) -> None:
    """Screenshot `url` with headless Chrome at 2x."""
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
         f"--window-size={width},{height}", "--virtual-time-budget=4000", f"--screenshot={png}", url],
        check=True, capture_output=True,
    )
    print(f"{png.relative_to(HERE)}  {width * 2}x{height * 2}px")


def main() -> None:
    """Write both HTML files, then render the PNGs unless --no-png."""
    fragment = build_fragment()
    FRAGMENT_OUT.parent.mkdir(parents=True, exist_ok=True)
    FRAGMENT_OUT.write_text(fragment, encoding="utf-8")
    LOCAL_OUT.write_text(
        '<!doctype html><html lang="th" data-theme="light"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>'
        + fragment + "</body></html>",
        encoding="utf-8",
    )
    print(f"{FRAGMENT_OUT.relative_to(HERE)}\n{LOCAL_OUT.relative_to(HERE)}")
    if "--no-png" in sys.argv:
        return
    render(LOCAL_OUT.as_uri(), PNG_FULL, 1600, 2560)
    render(LOCAL_OUT.as_uri() + "?only=swimlane", PNG_LANES, 1600, 1070)


if __name__ == "__main__":
    main()
