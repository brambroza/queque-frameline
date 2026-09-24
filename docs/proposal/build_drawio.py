#!/usr/bin/env python3
"""Export the two executive swimlanes (same data as build_exec_flow.py) as an editable draw.io file.

Output: diagrams/executive-swimlane.drawio — open with app.diagrams.net / draw.io desktop, or
upload to Google Drive and open with the draw.io add-on. Coordinates match the SVG 1:1, so the
result looks like screenshots/00c-executive-swimlane.png.

Usage: python3 build_drawio.py
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

from build_exec_flow import (
    BOX_H, BOX_W, DIAMOND_RX, DIAMOND_RY, FIG1, FIG2, LABEL_W, LANE_H, OFFICE, PARTNER, SYS1, TOP,
    Figure, Step, box_x, box_y, col_cx, lane_cy,
)

HERE = Path(__file__).resolve().parent
OUT = HERE / "diagrams" / "executive-swimlane.drawio"

FONT = "IBM Plex Sans Thai"
C = {  # same palette as the HTML page (light theme)
    "surface": "#FFFFFF", "lane": "#EFF4F0", "ink": "#1B2A24", "muted": "#56675F", "rule": "#CBD5D0",
    "brand": "#0B7A4B", "brand_soft": "#E3F3EA", "badge": "#F2B01E", "badge_ink": "#3A2A00",
    "warn": "#B45309", "warn_soft": "#FDF1E1", "line": "#06A94A",
}
FIG_GAP = 150  # vertical space between the two figures (title + legend live in it)
TITLE_H = 70   # room above each figure for heading + subtitle


class Doc:
    """Collects mxCells; every id is unique across both figures."""

    def __init__(self) -> None:
        self.root = ET.Element("root")
        ET.SubElement(self.root, "mxCell", id="0")
        ET.SubElement(self.root, "mxCell", id="1", parent="0")
        self.n = 1

    def _id(self, prefix: str) -> str:
        self.n += 1
        return f"{prefix}{self.n}"

    def vertex(self, prefix: str, value: str, style: str, x: float, y: float, w: float, h: float) -> str:
        cid = self._id(prefix)
        c = ET.SubElement(self.root, "mxCell", id=cid, value=value, style=style, vertex="1", parent="1")
        ET.SubElement(c, "mxGeometry", x=f"{x:g}", y=f"{y:g}", width=f"{w:g}", height=f"{h:g}", **{"as": "geometry"})
        return cid

    def edge(self, src: str, dst: str, style: str, value: str = "") -> str:
        cid = self._id("e")
        c = ET.SubElement(self.root, "mxCell", id=cid, value=value, style=style, edge="1", parent="1", source=src, target=dst)
        ET.SubElement(c, "mxGeometry", relative="1", **{"as": "geometry"})
        return cid


def text_style(size: float, color: str, bold: bool = False, align: str = "left") -> str:
    return (f"text;html=1;strokeColor=none;fillColor=none;align={align};verticalAlign=middle;whiteSpace=wrap;"
            f"fontFamily={FONT};fontSize={size};fontColor={color};fontStyle={1 if bold else 0};spacing=0;spacingLeft=0;")


EDGE = (f"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;"
        f"strokeWidth=1.5;strokeColor={C['ink']};fontFamily={FONT};fontSize=12.5;fontColor={C['muted']};fontStyle=1;"
        f"labelBackgroundColor={C['surface']};")


def anchors(exit_x: float, exit_y: float, entry_x: float, entry_y: float) -> str:
    return f"exitX={exit_x};exitY={exit_y};exitDx=0;exitDy=0;entryX={entry_x};entryY={entry_y};entryDx=0;entryDy=0;"


def draw_figure(doc: Doc, fig: Figure, oy: float, title: str, subtitle: str) -> dict[Step, str]:
    """Lanes, labels, boxes, badges and status strip. Returns the box id of every step."""
    w = fig.width
    doc.vertex("t", title, text_style(24, C["ink"], bold=True), 0, oy - TITLE_H, w, 34)
    doc.vertex("t", subtitle, text_style(15, C["muted"]), 0, oy - TITLE_H + 34, w, 26)

    for i, name in enumerate(fig.lanes):
        y = oy + TOP + i * LANE_H
        fill = C["surface"] if i % 2 == 0 else C["lane"]
        doc.vertex("lane", "", f"rounded=0;whiteSpace=wrap;html=1;fillColor={fill};strokeColor=none;", 0, y, w, LANE_H)
        rail = C["brand"] if i == fig.system_lane else C["rule"]
        doc.vertex("rail", "", f"rounded=0;html=1;fillColor={rail};strokeColor=none;", 0, y, 6, LANE_H)
        main, *sub = name.split("\n")
        label = f"<b>{main}</b>" + (f"<br><font style=\"font-size:13.5px\" color=\"{C['muted']}\">{sub[0]}</font>" if sub else "")
        doc.vertex("ln", label, text_style(16, C["ink"]), 16, y, LABEL_W - 30, LANE_H)

    rule = f"endArrow=none;html=1;strokeColor={C['rule']};strokeWidth=1;"
    for y in (oy + TOP, oy + fig.lanes_bottom):
        c = ET.SubElement(doc.root, "mxCell", id=doc._id("r"), value="", style=rule, edge="1", parent="1")
        g = ET.SubElement(c, "mxGeometry", relative="1", **{"as": "geometry"})
        ET.SubElement(g, "mxPoint", x="0", y=f"{y:g}", **{"as": "sourcePoint"})
        ET.SubElement(g, "mxPoint", x=f"{w:g}", y=f"{y:g}", **{"as": "targetPoint"})
    c = ET.SubElement(doc.root, "mxCell", id=doc._id("r"), value="", style=rule, edge="1", parent="1")
    g = ET.SubElement(c, "mxGeometry", relative="1", **{"as": "geometry"})
    ET.SubElement(g, "mxPoint", x=f"{LABEL_W - 12:g}", y=f"{oy + TOP:g}", **{"as": "sourcePoint"})
    ET.SubElement(g, "mxPoint", x=f"{LABEL_W - 12:g}", y=f"{oy + fig.lanes_bottom:g}", **{"as": "targetPoint"})

    ids: dict[Step, str] = {}
    for s in fig.steps:
        x, y = box_x(s.col), oy + box_y(s.lane)
        if s.system:
            box = f"fillColor={C['brand_soft']};strokeColor={C['brand']};strokeWidth=1.6;"
        elif not s.no:
            box = f"fillColor={C['surface']};strokeColor={C['muted']};strokeWidth=1.4;dashed=1;dashPattern=5 4;"
        else:
            box = f"fillColor={C['surface']};strokeColor={C['ink']};strokeWidth=1.4;"
        label = f"<b>{s.title}</b><br><font style=\"font-size:12px\" color=\"{C['muted']}\">{s.sub}</font>"
        style = (f"rounded=1;arcSize=12;whiteSpace=nowrap;html=1;align=center;verticalAlign=middle;overflow=visible;"
                 f"fontFamily={FONT};fontSize=14;fontColor={C['ink']};{box}")
        ids[s] = doc.vertex("box", label, style, x, y, BOX_W, BOX_H)
        if s.no:
            doc.vertex("badge", s.no,
                       f"ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor={C['badge']};strokeColor=none;"
                       f"fontFamily={FONT};fontSize=12.5;fontStyle=1;fontColor={C['badge_ink']};",
                       x - 12, y - 12, 24, 24)
        else:
            doc.vertex("or", "หรือ",
                       f"rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor={C['surface']};strokeColor={C['muted']};"
                       f"fontFamily={FONT};fontSize=11.5;fontStyle=1;fontColor={C['muted']};",
                       x - 14, y - 11, 36, 22)
        if s.line:
            doc.vertex("line", "LINE",
                       f"rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor={C['line']};strokeColor=none;"
                       f"fontFamily={FONT};fontSize=10;fontStyle=1;fontColor=#FFFFFF;",
                       x + BOX_W - 42, y - 9, 36, 18)

    sy = oy + fig.lanes_bottom + 34
    doc.vertex("st", "<b>สถานะของคิว</b>", text_style(16, C["ink"]), 16, sy - 14, LABEL_W - 30, 28)
    for first, last, label in fig.status:
        x1, x2 = box_x(first), box_x(last) + BOX_W
        doc.vertex("pill", label,
                   f"rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor={C['lane']};strokeColor={C['rule']};"
                   f"fontFamily={FONT};fontSize=13;fontStyle=1;fontColor={C['brand']};",
                   x1, sy - 14, x2 - x1, 28)
    return ids


def build_fig1(doc: Doc, oy: float) -> None:
    ids = draw_figure(doc, FIG1, oy, "ก่อนวันนัด — จากเอกสารถึงใบ DO",
                      "ฝ่ายขายคีย์ SO ฝ่ายจัดซื้อคีย์ PO ทีละใบ · คิวจะได้รับเลขใบ DO เมื่อเจ้าหน้าที่คลังยืนยัน และ SO ผ่านการตรวจการชำระเงินแล้ว")
    s = {x.no: x for x in FIG1.steps}
    for a, b in [("1", "2"), ("2", "3"), ("3", "4"), ("5", "6"), ("6", "7"), ("7", "8")]:
        doc.edge(ids[s[a]], ids[s[b]], EDGE + anchors(1, 0.5, 0, 0.5))

    gate_cx, gate_cy = col_cx(4), oy + lane_cy(SYS1)
    gate = doc.vertex("gate", f"<b>ตรวจการชำระเงิน</b><br><font style=\"font-size:12.5px\" color=\"{C['muted']}\">SO ชำระแล้วหรือไม่</font>",
                      f"rhombus;whiteSpace=nowrap;html=1;overflow=visible;fillColor={C['warn_soft']};strokeColor={C['warn']};strokeWidth=1.6;"
                      f"fontFamily={FONT};fontSize=14;fontColor={C['ink']};",
                      gate_cx - DIAMOND_RX, gate_cy - DIAMOND_RY, DIAMOND_RX * 2, DIAMOND_RY * 2)
    doc.edge(ids[s["4"]], gate, EDGE + anchors(1, 0.5, 0, 0.5))
    warn = EDGE.replace(f"strokeColor={C['ink']}", f"strokeColor={C['warn']}").replace(f"fontColor={C['muted']}", f"fontColor={C['warn']}") + "dashed=1;dashPattern=5 4;"
    doc.edge(gate, ids[s["5"]], warn + anchors(0.5, 0, 0, 0.5), "SO ยังไม่ชำระเงิน")
    doc.edge(gate, ids[s["6"]], EDGE + anchors(1, 0.5, 0.5, 1), "ชำระแล้ว · ลูกค้าเครดิต · หรือเป็น PO")

    # legend under the strip
    ly = oy + FIG1.height + 22
    x = box_x(0)
    for style, text, w in [
        (f"rounded=1;arcSize=25;fillColor={C['surface']};strokeColor={C['ink']};strokeWidth=1.5;", "ขั้นตอนที่ผู้ใช้ดำเนินการ", 24),
        (f"rounded=1;arcSize=25;fillColor={C['brand_soft']};strokeColor={C['brand']};strokeWidth=1.5;", "ระบบดำเนินการอัตโนมัติ", 24),
        (f"rounded=1;arcSize=25;fillColor={C['surface']};strokeColor={C['muted']};strokeWidth=1.5;dashed=1;dashPattern=5 4;", "ทางเลือกเพิ่มเติม", 24),
        (f"rounded=1;arcSize=50;fillColor={C['line']};strokeColor=none;fontFamily={FONT};fontSize=10;fontStyle=1;fontColor=#FFFFFF;", "ขั้นที่มีการแจ้งเตือนทาง LINE", 34),
    ]:
        doc.vertex("lg", "LINE" if w == 34 else "", "html=1;" + style, x, ly, w, 16)
        doc.vertex("lg", text, text_style(15, C["muted"]), x + w + 6, ly - 6, 230, 28)
        x += w + 6 + (200 if w != 34 else 250)


def build_fig2(doc: Doc, oy: float) -> None:
    ids = draw_figure(doc, FIG2, oy, "วันนัด — จากรถมาถึงจนปิดงาน",
                      "เมื่อท่าว่าง ระบบเรียกคิวถัดไปโดยอัตโนมัติ เจ้าหน้าที่ไม่ต้องติดตามลำดับคิวเอง")
    open_do, arrive, gate_in, call, load, nxt = FIG2.steps
    dash = EDGE.replace(f"strokeColor={C['ink']}", f"strokeColor={C['muted']}") + "dashed=1;dashPattern=5 4;"
    doc.edge(ids[open_do], ids[gate_in], dash + anchors(1, 0.5, 0, 0.5))
    doc.edge(ids[gate_in], ids[call], dash + anchors(1, 0.5, 0, 0.5))
    for a, b in [(open_do, arrive), (arrive, call), (call, load), (load, nxt)]:
        doc.edge(ids[a], ids[b], EDGE + anchors(1, 0.5, 0, 0.5))
    doc.vertex("cap", "เส้นประ: กรณีทะเบียนรถไม่ตรงกับที่จอง แจ้งเจ้าหน้าที่แก้ไขทะเบียนและเช็คอินให้ได้ ระบบแจ้งทีมคลังทาง LINE",
               text_style(15, C["muted"]), 0, oy + FIG2.height + 12, FIG2.width, 26)


def main() -> None:
    """Write the .drawio file (plain, uncompressed XML)."""
    doc = Doc()
    oy1 = TITLE_H + 10
    build_fig1(doc, oy1)
    oy2 = oy1 + FIG1.height + FIG_GAP
    build_fig2(doc, oy2)

    page_w, page_h = FIG1.width + 40, oy2 + FIG2.height + 60
    model = ET.Element("mxGraphModel", dx="1400", dy="900", grid="1", gridSize="10", guides="1", tooltips="1", connect="1",
                       arrows="1", fold="1", page="1", pageScale="1", pageWidth=str(int(page_w)), pageHeight=str(int(page_h)),
                       math="0", shadow="0", background=C["surface"])
    model.append(doc.root)
    mxfile = ET.Element("mxfile", host="app.diagrams.net", type="device")
    diagram = ET.SubElement(mxfile, "diagram", name="เส้นทางคิว Fameline", id="fameline-exec-flow")
    diagram.append(model)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(mxfile, encoding="utf-8"))
    print(f"{OUT.relative_to(HERE)}  cells={len(doc.root)}  page={int(page_w)}x{int(page_h)}")


if __name__ == "__main__":
    main()
