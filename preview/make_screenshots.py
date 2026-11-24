#!/usr/bin/env python3
"""Renders a PNG of every console view of DataLabel at desktop 1440x900
into ../screenshots/. The drawings replicate the console's real design
system (web/styles.css): plum #4A154B header, rose #F472B6 accent,
#FDF2F8 page background — with the showcase team's seeded data
(LabelWorks Manchester, Northern Quarter) and its real seeded agreement
results from preview/shot-config.json."""
import json, os
from PIL import Image, ImageDraw, ImageFont
W, H = 1440, 900
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screenshots")
os.makedirs(OUT, exist_ok=True)
CFG = json.loads(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "shot-config.json")).read())
def hx(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
BRAND = hx(CFG["header"]); ACCENT = hx(CFG["accent"]); BG = hx(CFG["bg"])
WHITE = (255, 255, 255); INK = (51, 22, 47); MUTED = (124, 90, 114); LINE = (243, 207, 224)
BAD = (185, 28, 28); WARN = (180, 83, 9); GOOD = (4, 120, 87); ACCENT_INK = (74, 21, 75)
FD = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FM = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"; FMB = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
def F(s, b=False, mono=False):
    return ImageFont.truetype((FMB if b else FM) if mono else (FB if b else FD), int(s))
def wrap(d, t, f, mw):
    ws, lines, cur = str(t).split(), [], ""
    for w in ws:
        tt = (cur + " " + w).strip()
        if d.textlength(tt, font=f) <= mw: cur = tt
        elif cur: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines
NAV = ["Dashboard", "Schemas", "Annotators", "Queue", "Annotate", "Agreement", "Disagreements", "Exports", "Help"]
class Page:
    def __init__(self, title, active=""):
        self.img = Image.new("RGB", (W, H), BG); self.d = ImageDraw.Draw(self.img)
        d = self.d
        d.rectangle([0, 0, W, 64], fill=BRAND)
        d.text((28, 20), CFG["name"] + "_", font=F(20, True, mono=True), fill=WHITE)
        x = 268
        for n in NAV:
            col = ACCENT if n == active else (245, 215, 236)
            d.text((x, 25), n, font=F(12.5, n == active), fill=col); x += d.textlength(n, font=F(12.5)) + 18
        d.text((W - 250, 24), CFG["owner"] + " · " + CFG["business"], font=F(11.5), fill=WHITE)
        d.rectangle([0, 64, W, 96], fill=ACCENT)
        d.text((W // 2, 72), CFG["name"] + " — " + CFG["tagline"].lower() + " · Cohen's kappa · disagreement review · export summaries",
               font=F(12, True, mono=True), fill=ACCENT_INK, anchor="ma")
        self.y = 128
        d.text((40, self.y), title, font=F(27, True), fill=INK); self.y += 48
    def save(self, name): self.img.save(os.path.join(OUT, name)); print("wrote", name)
    def card(self, x, y, w, h, fill=WHITE):
        self.d.rounded_rectangle([x, y, x + w, y + h], 14, fill=fill, outline=LINE, width=1)
    def text(self, x, y, s, size=14, bold=False, color=INK, mono=False):
        self.d.text((x, y), str(s), font=F(size, bold, mono), fill=color)
    def para(self, x, y, s, size=13, color=MUTED, maxw=520, lh=19):
        for ln in wrap(self.d, s, F(size), maxw): self.d.text((x, y), ln, font=F(size), fill=color); y += lh
        return y
    def pill(self, x, y, label, kind=None):
        fill = {"good": (236, 253, 245), "bad": (254, 242, 242), "warn": (255, 251, 235)}.get(kind, (252, 231, 243))
        fg = {"good": GOOD, "bad": BAD, "warn": WARN}.get(kind, BRAND)
        w = self.d.textlength(label, font=F(11, True, mono=True)) + 20
        self.d.rounded_rectangle([x, y, x + w, y + 24], 12, fill=fill, outline=LINE)
        self.d.text((x + 10, y + 5), label, font=F(11, True, mono=True), fill=fg); return x + w + 8
    def btn(self, x, y, label, accent=False, w=None):
        w = w or (self.d.textlength(label, font=F(13.5, True)) + 34)
        self.d.rounded_rectangle([x, y, x + w, y + 38], 10, fill=ACCENT if accent else BRAND)
        self.d.text((x + w / 2, y + 10), label, font=F(13.5, True), fill=ACCENT_INK if accent else WHITE, anchor="ma")
        return x + w + 10
    def field(self, x, y, label, value, w=560):
        self.text(x, y, label.upper(), 11, True, MUTED)
        self.d.rounded_rectangle([x, y + 20, x + w, y + 58], 9, outline=LINE)
        self.text(x + 12, y + 30, value, 13)
        return y + 74
    def bar(self, x, y, pct, w=220):
        self.d.rounded_rectangle([x, y, x + w, y + 10], 5, fill=(252, 231, 243))
        self.d.rounded_rectangle([x, y, x + w * pct / 100.0, y + 10], 5, fill=ACCENT)
    def table(self, x, y, cols, rows, widths, mono_cols=()):
        d = self.d; cx = x
        for h, wd in zip(cols, widths): d.text((cx, y), h.upper(), font=F(11, True), fill=MUTED); cx += wd
        y += 24; d.line([x, y, x + sum(widths), y], fill=BRAND, width=2); y += 10
        for row in rows:
            cx = x; lines = 1
            for ci, (v, wd) in enumerate(zip(row, widths)):
                f = F(12.5, mono=ci in mono_cols)
                ls = wrap(d, str(v), f, wd - 12); lines = max(lines, len(ls))
                for j, ln in enumerate(ls): d.text((cx, y + j * 17), ln, font=f, fill=INK)
                cx += wd
            y += 17 * lines + 13; d.line([x, y - 6, x + sum(widths), y - 6], fill=LINE, width=1)
        return y

def dashboard():
    p = Page(CFG["business"], "Dashboard"); s = CFG["stats"]; h = CFG["headline"]
    p.card(40, p.y, 1360, 150, fill=BRAND)
    p.text(64, p.y + 16, CFG["business"], 23, True, WHITE)
    p.text(64, p.y + 52, "Labelling workspace · " + CFG["location"] + " — headline Cohen's kappa:", 13, False, (233, 200, 222))
    p.text(64, p.y + 82, h["kappa"], 34, True, ACCENT, mono=True)
    p.text(240, p.y + 96, h["schema"] + " · po " + h["po"] + " · pe " + h["pe"] + " · " + h["band"], 12.5, False, (233, 200, 222), mono=True)
    y = p.y + 174; x = 40
    for v, l in [(str(s["schemas"]), "Label schemas"), (str(s["items"]), "Items"), (str(s["annotations"]), "Annotations"),
                 (str(s["openDisagreements"]), "Open disagreements"), (str(s["adjudications"]), "Adjudications")]:
        p.card(x, y, 248, 104); p.text(x + 18, y + 14, v, 28, True, BRAND, mono=True); p.text(x + 18, y + 58, l, 13, False, MUTED); x += 266
    y += 128; p.text(40, y, "Agreement by schema", 19, True); y += 38
    p.card(40, y, 1360, 190)
    p.table(64, y + 18, ["Schema", "po", "pe", "Kappa", "Band", "Open disagreements"],
            [[h["schema"], h["po"], h["pe"], h["kappa"], h["band"], "2"],
             ["Ticket Intent — Dental Support", "0.75", "0.3125", "0.6364", "substantial", "1"]],
            [480, 120, 140, 140, 220, 200], mono_cols=(1, 2, 3))
    y += 216
    x = p.pill(40, y, "kappa formula: (po - pe) / (1 - pe)")
    p.pill(x, y, "pe from the annotators' own label marginals")
    return p
def schemas():
    p = Page("Label Schemas", "Schemas")
    p.para(40, p.y, "A schema fixes the label set for a labelling project. Annotators can only choose labels from the schema, so agreement is always measured over the same vocabulary.", 13, MUTED, 1200); p.y += 26
    p.card(40, p.y, 1360, 170)
    p.table(64, p.y + 18, ["Schema", "Labels", "Items", "Annotations"],
            [[r[0], r[1], r[2], r[3]] for r in CFG["schemas"]], [520, 430, 120, 150], mono_cols=(2, 3))
    y = p.y + 196; p.text(40, y, "New label schema", 19, True); y += 36
    p.card(40, y, 1360, 260)
    y2 = p.field(64, y + 16, "Name", "e.g. Dental Triage — Urgent vs Routine"); y2 = p.field(64, y2, "Labels (comma separated)", "urgent, routine")
    p.btn(64, y2 + 4, "Create schema", accent=True)
    return p
def schema_detail():
    p = Page("Dental Triage — Urgent vs Routine", "Schemas")
    p.para(40, p.y, "Triage Northgate Dental patient messages into urgent or routine. First 8 of 10 items shown with their final labels: agreed items carry the shared label; disagreements stay unresolved until an adjudicator settles them.", 13, MUTED, 1200); p.y += 8
    x = 40
    for lab in ["urgent", "routine"]: x = p.pill(x, p.y, lab)
    y = p.y + 42
    p.card(40, y, 1360, 430)
    p.table(64, y + 18, ["Ref", "Item text", "Final label", "Source"],
            [list(r) for r in CFG["triageItems"]], [120, 700, 160, 200], mono_cols=(0,))
    return p
def annotators():
    p = Page("Annotators", "Annotators")
    p.para(40, p.y, "Progress counts completed assignments against everything assigned, across all schemas in this workspace. Priya Shah adjudicates disagreements and holds no annotation assignments.", 13, MUTED, 1200); p.y += 26
    p.card(40, p.y, 1360, 220)
    p.table(64, p.y + 18, ["Annotator", "Role", "Done", "Total", "Progress"],
            [[r[0], r[1], r[2], r[3], r[4]] for r in CFG["annotators"]], [300, 200, 110, 110, 200], mono_cols=(2, 3, 4))
    y = p.y + 240
    p.text(64, y, "Zara Ahmed", 13, True); p.bar(300, y + 2, 88.8889)
    p.text(64, y + 30, "Callum Reid", 13, True); p.bar(300, y + 32, 77.7778)
    y += 90; p.text(40, y, "New annotator", 19, True); y += 36
    p.card(40, y, 1360, 190)
    y2 = p.field(64, y + 16, "Name", "e.g. Nadia Hussain")
    p.btn(64, y2 + 4, "Add annotator", accent=True)
    return p
def queue():
    p = Page("Annotation Queue", "Queue")
    p.para(40, p.y, "Every assignment in the workspace: who owes which item, and the label they gave when they finished it. Pending rows are the annotators' remaining work.", 13, MUTED, 1200); p.y += 26
    p.card(40, p.y, 1360, 430)
    p.table(64, p.y + 18, ["Item", "Text", "Annotator", "Status", "Label"],
            [list(r) for r in CFG["queue"]], [110, 560, 220, 160, 140], mono_cols=(0,))
    return p
def annotate():
    p = Page("Annotate", "Annotate")
    p.card(40, p.y, 1360, 330)
    p.para(64, p.y + 16, "Pick a pending assignment, choose the label from the item's schema, and submit. The annotation is stored against the assignment and the annotator's progress updates immediately.", 13, MUTED, 1250, 19)
    y2 = p.field(64, p.y + 70, "Pending assignment", "TI-05 — Invoice for the crown treatment has the wrong total (Callum Reid)", w=900)
    y2 = p.field(64, y2, "Label (from the Ticket Intent schema)", "billing", w=420)
    p.btn(64, y2 + 4, "Submit annotation", accent=True)
    y = p.y + 356; p.text(40, y, "How labelling feeds agreement", 19, True); y += 38
    p.para(40, y, "An item only enters the agreement calculation once BOTH annotators have labelled it. Single-labelled items still count in the export summary under their one label, marked as single-annotation so the dataset's provenance stays honest.", 12.5, MUTED, 1250, 18)
    return p
def agreement():
    p = Page("Agreement — Dental Triage", "Agreement"); h = CFG["headline"]
    p.text(40, p.y - 14, "Zara Ahmed vs Callum Reid · 10 doubly-labelled items · kappa = (po - pe) / (1 - pe)", 12.5, False, MUTED, mono=True)
    x = 40; top = p.y + 14
    for v, l in [("0.8", "Observed agreement po (8/10)"), ("0.5", "Expected by chance pe"), ("0.6", "Cohen's kappa"), ("moderate", "Interpretation band")]:
        p.card(x, top, 322, 104); p.text(x + 18, top + 14, v, 27, True, BRAND, mono=True); p.text(x + 18, top + 58, l, 12.5, False, MUTED); x += 340
    y = top + 128; p.text(40, y, "Per-label agreement — where pe comes from", 19, True); y += 36
    p.card(40, y, 1360, 190)
    p.table(64, y + 18, ["Label", "Count A", "Count B", "Marginal A", "Marginal B", "pe part", "Agreed on"],
            [list(r) for r in CFG["perLabel"]], [200, 130, 130, 170, 170, 150, 150], mono_cols=(1, 2, 3, 4, 5, 6))
    y += 216
    p.para(40, y, "pe = 0.5 x 0.5 + 0.5 x 0.5 = 0.25 + 0.25 = 0.5, so kappa = (0.8 - 0.5) / (1 - 0.5) = 0.6 exactly. On the Ticket Intent schema the same maths gives po 0.75, pe 0.3125 and kappa 0.6364 (substantial).", 12.5, MUTED, 1250, 18)
    return p
def disagreements():
    p = Page("Disagreement Review", "Disagreements")
    p.para(40, p.y, "Items where the two annotators chose different labels and no adjudicator has settled them yet. An adjudicator picks the final label; the item then leaves the queue and counts in the export under that label.", 13, MUTED, 1200); p.y += 26
    p.card(40, p.y, 1360, 230)
    p.table(64, p.y + 18, ["Item", "Text", "Annotator A", "Annotator B"],
            [list(r) for r in CFG["disagreements"]], [110, 640, 200, 200], mono_cols=(0,))
    y = p.y + 256; p.text(40, y, "Adjudicate an item", 19, True); y += 36
    p.card(40, y, 1360, 250)
    y2 = p.field(64, y + 16, "Item", "DL-05 — Mild sensitivity to cold drinks for the past week", w=900)
    y2 = p.field(64, y2, "Final label", "urgent", w=420)
    p.btn(64, y2 + 4, "Set final label", accent=True)
    return p
def exports():
    p = Page("Exports", "Exports")
    p.card(40, p.y, 1360, 150)
    x = p.pill(64, p.y + 16, "EXP · kappa 0.6", kind="warn")
    p.text(64, p.y + 50, "Export summary — Dental Triage (before adjudication)", 16.5, True)
    p.para(64, p.y + 80, CFG["exportSummary"], 13, MUTED, 1250, 19)
    y = p.y + 172; p.text(40, y, "Live summary — Dental Triage final labels", 19, True); y += 38
    p.card(40, y, 1360, 200)
    p.table(64, y + 18, ["Final label", "Items", "Share"],
            [list(r) for r in CFG["exportDist"]], [300, 160, 160], mono_cols=(1, 2))
    y += 226
    p.para(40, y, "Final labels resolve in a documented order: an adjudication first, then the agreed label when both annotators match, then a single annotation, and anything else stays unresolved rather than being quietly guessed.", 12.5, MUTED, 1250, 18)
    return p
def help_view():
    p = Page("Settings & Help", "Help")
    p.card(40, p.y, 1360, 190)
    p.text(64, p.y + 14, "Project", 15.5, True)
    y2 = p.field(64, p.y + 44, "Workspace name", "Northgate Dental — Patient Message Labelling", w=760)
    p.text(64, y2, "Team: " + CFG["business"] + " · Location: " + CFG["location"], 12.5, False, MUTED, mono=True)
    y = p.y + 214
    cards = [("How agreement works", "For two annotators over the items both have labelled: po is the share of items where they chose the same label. pe is the agreement expected by chance from their own label marginals — for each label, marginalA x marginalB, summed over labels. Cohen's kappa = (po - pe) / (1 - pe). Bands: 0.41-0.60 moderate, 0.61-0.80 substantial, 0.81-1.00 almost perfect."),
             ("Final labels & exports", "An item's final label is an adjudication when one exists, else the agreed label when the annotators match, else the single annotation when only one annotator has labelled it. Disagreements with no adjudication and unlabelled items stay unresolved and are reported as their own share of the export."),
             ("Production connections", "In a production engagement the same interfaces connect to the team's annotation platform and hosted model APIs — OpenAI, Anthropic, Google, Azure OpenAI — for pre-labelling assistance. Those integrations are the documented backlog; nothing here claims a live hosted-model connection.")]
    for t, b in cards:
        p.card(40, y, 1240, 118); p.text(62, y + 14, t, 15.5, True); p.para(62, y + 44, b, 12.5, MUTED, 1180, 18); y += 132
    return p

dashboard().save("01-dashboard.png")
schemas().save("02-schemas.png")
schema_detail().save("03-schema-detail.png")
annotators().save("04-annotators.png")
queue().save("05-queue.png")
annotate().save("06-annotate.png")
agreement().save("07-agreement.png")
disagreements().save("08-disagreements.png")
exports().save("09-exports.png")
help_view().save("10-settings-help.png")
print("10 screenshots written")
