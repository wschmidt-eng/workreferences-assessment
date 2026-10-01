"""Build a branded WorkReferences Reference Preparation Report PDF.

Usage: python3 generate_report_pdf.py <report.json> <output.pdf>
"""
import json
import sys
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape as _xml_escape


def esc(value):
    """Escape user-supplied text before it is interpolated into ReportLab's
    Paragraph markup (a restricted HTML/XML dialect). Prevents malformed or
    malicious input from breaking or injecting into that user's own PDF."""
    if value is None:
        return ""
    return _xml_escape(str(value))

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.platypus.doctemplate import NextPageTemplate

IN_JSON = Path(sys.argv[1])
OUT_PDF = Path(sys.argv[2])

with open(IN_JSON) as f:
    R = json.load(f)

# NAME/TARGET/GENERATED are drawn with canvas drawString (no markup parsing) on
# the cover and header/footer, so they must stay raw. NAME_P/TARGET_P are the
# XML-escaped versions for use inside Paragraph() calls, which do parse markup.
NAME = R.get("clientName") or "Client"
TARGET = R.get("targetJobTitle") or "Target Role"
GENERATED = R.get("generatedDate") or ""
NAME_P = esc(NAME)
TARGET_P = esc(TARGET)

BRAND_GREEN = HexColor("#16A34A")
BRAND_GREEN_DARK = HexColor("#0F7A35")
INK = HexColor("#111827")
TEXT = HexColor("#1F2937")
MUTED = HexColor("#4B5563")
BORDER = HexColor("#E5E7EB")
SOFT_BG = HexColor("#F3FAF5")
SOFT_GRAY = HexColor("#F9FAFB")
RISK_LOW = HexColor("#16A34A")
RISK_MOD = HexColor("#D97706")
RISK_HIGH = HexColor("#DC2626")
WHITE = white

RISK_COLOR = {"Low": RISK_LOW, "Moderate": RISK_MOD, "High": RISK_HIGH}

FONT_DIR = Path("/tmp/fonts")
FONT_DIR.mkdir(exist_ok=True)
FONT_URLS = {
    "DMSans": "https://github.com/google/fonts/raw/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf",
    "Inter": "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
}


def download(url, dest):
    if not dest.exists():
        urllib.request.urlretrieve(url, dest)


inter_path = FONT_DIR / "Inter.ttf"
dmsans_path = FONT_DIR / "DMSans.ttf"
download(FONT_URLS["Inter"], inter_path)
download(FONT_URLS["DMSans"], dmsans_path)
pdfmetrics.registerFont(TTFont("Inter", str(inter_path)))
pdfmetrics.registerFont(TTFont("Inter-Bold", str(inter_path)))
pdfmetrics.registerFont(TTFont("DMSans", str(dmsans_path)))
pdfmetrics.registerFont(TTFont("DMSans-Bold", str(dmsans_path)))
registerFontFamily("Inter", normal="Inter", bold="Inter-Bold", italic="Inter", boldItalic="Inter-Bold")
registerFontFamily("DMSans", normal="DMSans", bold="DMSans-Bold", italic="DMSans", boldItalic="DMSans-Bold")

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Normal"], fontName="DMSans-Bold", fontSize=20, leading=25, textColor=INK, spaceAfter=6)
H2 = ParagraphStyle("H2", parent=styles["Normal"], fontName="DMSans-Bold", fontSize=14, leading=19, textColor=INK, spaceAfter=6, spaceBefore=14)
H3 = ParagraphStyle("H3", parent=styles["Normal"], fontName="DMSans-Bold", fontSize=11, leading=15, textColor=BRAND_GREEN_DARK, spaceAfter=4, spaceBefore=10)
BODY = ParagraphStyle("Body", parent=styles["Normal"], fontName="Inter", fontSize=10, leading=15, textColor=TEXT, spaceAfter=6, alignment=TA_LEFT)
BODY_J = ParagraphStyle("BodyJ", parent=BODY, alignment=TA_JUSTIFY)
BULLET = ParagraphStyle("Bullet", parent=BODY, leftIndent=14, bulletIndent=2, spaceAfter=3)
SMALL = ParagraphStyle("Small", parent=styles["Normal"], fontName="Inter", fontSize=8.5, leading=12, textColor=MUTED)
LABEL = ParagraphStyle("Label", parent=styles["Normal"], fontName="DMSans-Bold", fontSize=9, leading=12, textColor=BRAND_GREEN_DARK)
NOTE = ParagraphStyle("Note", parent=BODY, fontName="Inter", fontSize=10, leading=15, textColor=TEXT, leftIndent=10, rightIndent=4)
DISCLAIMER = ParagraphStyle("Disclaimer", parent=styles["Normal"], fontName="Inter", fontSize=8, leading=11, textColor=MUTED, alignment=TA_JUSTIFY)

PAGE_W, PAGE_H = letter
LEFT_M = RIGHT_M = 0.75 * inch
TOP_M = 0.9 * inch
BOTTOM_M = 0.9 * inch


def draw_header_footer(c, doc):
    c.saveState()
    c.setFillColor(BRAND_GREEN)
    c.rect(0, PAGE_H - 0.25 * inch, PAGE_W, 0.25 * inch, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("DMSans-Bold", 10)
    c.drawRightString(PAGE_W - LEFT_M, PAGE_H - 0.17 * inch, "WorkReferences  \u00b7  References That Work!")
    c.setFont("DMSans-Bold", 10)
    c.drawString(LEFT_M, PAGE_H - 0.17 * inch, "Reference Preparation Report")
    c.setFillColor(BORDER)
    c.rect(LEFT_M, 0.55 * inch, PAGE_W - LEFT_M - RIGHT_M, 0.5, stroke=0, fill=1)
    c.setFillColor(MUTED)
    c.setFont("Inter", 8.5)
    c.drawString(LEFT_M, 0.38 * inch, f"Confidential \u2014 Prepared for {NAME}")
    c.drawCentredString(PAGE_W / 2.0, 0.38 * inch, "workreferences.com")
    c.drawRightString(PAGE_W - RIGHT_M, 0.38 * inch, f"Page {doc.page}")
    c.restoreState()


def draw_cover(c, doc):
    c.saveState()
    c.setFillColor(BRAND_GREEN)
    c.rect(0, PAGE_H - 4.4 * inch, PAGE_W, 4.4 * inch, stroke=0, fill=1)
    c.setFillColor(BRAND_GREEN_DARK)
    c.rect(0, PAGE_H - 4.4 * inch, PAGE_W, 0.18 * inch, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("DMSans-Bold", 22)
    c.drawString(LEFT_M, PAGE_H - 1.1 * inch, "WorkReferences")
    c.setFont("Inter", 11)
    c.drawString(LEFT_M, PAGE_H - 1.35 * inch, "References That Work!")
    c.setFont("DMSans-Bold", 27)
    c.drawString(LEFT_M, PAGE_H - 2.3 * inch, "Reference Preparation")
    c.drawString(LEFT_M, PAGE_H - 2.7 * inch, "& Risk Assessment Report")
    c.setFont("DMSans-Bold", 10)
    c.drawString(LEFT_M, PAGE_H - 3.15 * inch, "PREPARED EXCLUSIVELY FOR")
    c.setFont("DMSans-Bold", 16)
    c.drawString(LEFT_M, PAGE_H - 3.45 * inch, NAME)
    c.setFont("Inter", 10)
    c.drawString(LEFT_M, PAGE_H - 3.75 * inch, f"Target role: {TARGET}")

    score = R.get("overall", {}).get("score", 0)
    band = R.get("overall", {}).get("band", "Low")
    c.setFillColor(WHITE)
    c.roundRect(PAGE_W - RIGHT_M - 1.7 * inch, PAGE_H - 4.15 * inch, 1.7 * inch, 1.35 * inch, 8, stroke=0, fill=1)
    c.setFillColor(RISK_COLOR.get(band, RISK_MOD))
    c.setFont("DMSans-Bold", 30)
    c.drawCentredString(PAGE_W - RIGHT_M - 0.85 * inch, PAGE_H - 3.62 * inch, str(score))
    c.setFont("DMSans-Bold", 9)
    c.drawCentredString(PAGE_W - RIGHT_M - 0.85 * inch, PAGE_H - 3.82 * inch, f"{band.upper()} RISK")
    c.setFillColor(INK)
    c.setFont("Inter", 7.5)
    c.drawCentredString(PAGE_W - RIGHT_M - 0.85 * inch, PAGE_H - 3.98 * inch, "Reference Risk Score / 100")

    c.setFillColor(MUTED)
    c.setFont("Inter", 8.5)
    c.drawString(LEFT_M, 0.62 * inch, f"workreferences.com  \u00b7  Confidential  \u00b7  Generated {GENERATED}")
    c.drawString(LEFT_M, 0.44 * inch, "Prepared by William Schmidt, Founder & CEO")
    c.restoreState()


def section_header(title):
    return Paragraph(title, H2)


def styled_table(header, rows, col_widths):
    data = [[Paragraph(f"<b>{esc(h)}</b>", ParagraphStyle('H', parent=BODY, textColor=WHITE, fontName='DMSans-Bold', fontSize=10)) for h in header]]
    for r in rows:
        data.append([Paragraph(esc(cell), BODY) for cell in r])
    t = Table(data, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, SOFT_GRAY]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, BORDER),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    return t


def bullet_list(items):
    return [Paragraph(f"<font color='#16A34A'><b>\u2713</b></font>&nbsp;&nbsp;{esc(it)}", BULLET) for it in items]


def callout(title, body_html, accent=None):
    accent = accent or BRAND_GREEN
    inner = [
        Paragraph(f"<b>{esc(title)}</b>", ParagraphStyle('CalloutTitle', parent=BODY, fontName='DMSans-Bold', fontSize=11, textColor=BRAND_GREEN_DARK, spaceAfter=4)),
        Paragraph(body_html, NOTE),
    ]
    t = Table([[inner]], colWidths=[6.5 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT_BG),
        ("BOX", (0, 0), (-1, -1), 0, WHITE),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    return t


def risk_badge_row(label, score, mx):
    pct = 0 if mx == 0 else min(1.0, score / mx)
    bar_w = 3.2 * inch
    filled = bar_w * pct
    d = Table(
        [[Paragraph(f"<b>{esc(label)}</b>", BODY),
          Paragraph(f"{esc(score)} / {esc(mx)}", ParagraphStyle('sc', parent=BODY, alignment=2))]],
        colWidths=[4.3 * inch, 1.2 * inch],
    )
    d.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return d


story = []
story.append(Spacer(1, 8.7 * inch))
story.append(PageBreak())

# Executive summary
story.append(section_header("Executive Summary"))
overall = R.get("overall", {})
story.append(Paragraph(
    f"This report reflects a structured Reference Readiness Assessment completed for <b>{NAME_P}</b> "
    f"targeting the <b>{TARGET_P}</b> role. Based on employment history, reference availability and quality, "
    f"resume/LinkedIn consistency, and simulated reference-check performance, the overall "
    f"<b>Reference Risk Score is {overall.get('score', 0)}/100 ({overall.get('band','Low')} Risk)</b>.",
    BODY_J,
))
story.append(Spacer(1, 6))
for comp in overall.get("breakdown", []):
    story.append(risk_badge_row(comp.get("label"), comp.get("score"), comp.get("max")))
story.append(Spacer(1, 8))
if overall.get("summaryNote"):
    story.append(callout("What this means", esc(overall["summaryNote"])))

# Positions likely to be verified
story.append(PageBreak())
story.append(section_header("Positions Most Likely to Require Verification"))
positions = R.get("positions", [])
if positions:
    rows = [[p.get("employer"), p.get("jobTitle"), p.get("dates"), p.get("riskLevel")] for p in positions]
    story.append(styled_table(["Employer", "Title", "Dates", "Risk"], rows, col_widths=[1.9 * inch, 1.7 * inch, 1.5 * inch, 1.4 * inch]))
    for p in positions:
        if p.get("riskFactors"):
            story.append(Spacer(1, 6))
            story.append(Paragraph(f"{esc(p.get('employer'))} \u2014 {esc(p.get('jobTitle'))}", H3))
            story.extend(bullet_list(p["riskFactors"]))
            if p.get("mitigation"):
                story.append(callout("Preparation strategy", "<br/>".join(esc(m) for m in p["mitigation"])))
else:
    story.append(Paragraph("No employment history was recorded.", BODY))

# Reference strategy
story.append(PageBreak())
story.append(section_header("Reference Strategy"))
ref_strategy = R.get("referenceStrategy", {})
primary = ref_strategy.get("primary", [])
backup = ref_strategy.get("backup", [])
if primary:
    story.append(Paragraph("Primary References (contact in this order)", H3))
    rows = [[str(i + 1), esc(r.get("name")), esc(r.get("relationship")), esc(r.get("notes", ""))] for i, r in enumerate(primary)]
    story.append(styled_table(["#", "Name", "Relationship", "Notes"], rows, col_widths=[0.35 * inch, 1.4 * inch, 1.75 * inch, 3.0 * inch]))
if backup:
    story.append(Spacer(1, 8))
    story.append(Paragraph("Backup References", H3))
    rows = [[esc(r.get("name")), esc(r.get("relationship")), esc(r.get("notes", ""))] for r in backup]
    story.append(styled_table(["Name", "Relationship", "Notes"], rows, col_widths=[1.6 * inch, 1.9 * inch, 3.0 * inch]))
if not primary and not backup:
    story.append(Paragraph("No references have been entered yet.", BODY))

# Discrepancies
story.append(PageBreak())
story.append(section_header("Verification & Consistency Audit"))
discs = R.get("discrepancies", [])
if discs:
    rows = [[esc(d.get("field")), esc(d.get("resume", "")), esc(d.get("linkedin", "")), esc(d.get("riskLevel")), esc(d.get("recommendation", ""))] for d in discs]
    story.append(styled_table(["Field", "R\u00e9sum\u00e9", "LinkedIn", "Risk", "Recommendation"], rows,
                               col_widths=[1.1 * inch, 1.15 * inch, 1.15 * inch, 0.7 * inch, 2.4 * inch]))
else:
    story.append(Paragraph("No discrepancies were identified between the r\u00e9sum\u00e9 and LinkedIn entries provided.", BODY))

# Talking points
story.append(PageBreak())
story.append(section_header("Reference Question Talking Points"))
for tp in R.get("talkingPoints", []):
    story.append(Paragraph(esc(tp.get("position", "")), H3))
    for item in tp.get("items", []):
        story.append(Paragraph(f"<b>{esc(item.get('category'))}:</b> {esc(item.get('answer'))}", BODY_J))

# Checklist
story.append(PageBreak())
story.append(section_header("Pre-Reference-Check Checklist"))
checklist = R.get("checklist", [])
if checklist:
    story.extend(bullet_list(checklist))
else:
    story.append(Paragraph("No outstanding action items.", BODY))

story.append(Spacer(1, 0.3 * inch))
story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
story.append(Spacer(1, 0.1 * inch))
story.append(Paragraph(
    "<i>This report is a preparation and coaching tool. WorkReferences provides structured, professional "
    "reference representation and HR verification support. We do not provide falsified documents, fake "
    "diplomas, or illegal identities. All services are confidential and designed to withstand strict "
    "corporate HR and third-party background-check scrutiny.</i>",
    DISCLAIMER,
))

doc = BaseDocTemplate(
    str(OUT_PDF), pagesize=letter,
    leftMargin=LEFT_M, rightMargin=RIGHT_M, topMargin=TOP_M, bottomMargin=BOTTOM_M,
    title=f"WorkReferences Reference Preparation Report \u2014 {NAME}", author="WorkReferences",
)
frame_cover = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="cover")
frame_body = Frame(LEFT_M, BOTTOM_M, PAGE_W - LEFT_M - RIGHT_M, PAGE_H - TOP_M - BOTTOM_M,
                    leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id="body")
doc.addPageTemplates([
    PageTemplate(id="Cover", frames=[frame_cover], onPage=draw_cover),
    PageTemplate(id="Body", frames=[frame_body], onPage=draw_header_footer),
])
doc.build([NextPageTemplate("Body")] + story)
print(f"Built: {OUT_PDF}")
