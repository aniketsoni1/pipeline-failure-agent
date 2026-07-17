#!/usr/bin/env python3
"""Generate the VS Code Marketplace publishing guide PDF.

Standalone helper — not part of the runtime. Produces a formatted, multi-page
guide tailored to this repo's extension (apps/vscode-extension).
"""
import sys
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    ListFlowable, ListItem, HRFlowable, Preformatted,
)

OUT = sys.argv[1] if len(sys.argv) > 1 else "VSCode-Extension-Publishing-Guide.pdf"

INK = colors.HexColor("#1b1f24")
ACCENT = colors.HexColor("#2b6cb0")
CODE_BG = colors.HexColor("#0d1117")
CODE_FG = colors.HexColor("#e6edf3")
PANEL = colors.HexColor("#f2f5f9")
BORDER = colors.HexColor("#d0d7de")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("H1x", parent=styles["Heading1"], textColor=ACCENT,
                          fontSize=17, spaceBefore=14, spaceAfter=8))
styles.add(ParagraphStyle("H2x", parent=styles["Heading2"], textColor=INK,
                          fontSize=13, spaceBefore=10, spaceAfter=5))
styles.add(ParagraphStyle("Body", parent=styles["BodyText"], textColor=INK,
                          fontSize=10.3, leading=15, spaceAfter=6))
styles.add(ParagraphStyle("BulletX", parent=styles["Body"], leftIndent=12, spaceAfter=3))
styles.add(ParagraphStyle("Note", parent=styles["Body"], backColor=PANEL,
                          borderColor=BORDER, borderWidth=0.6, borderPadding=7,
                          leftIndent=2, rightIndent=2, spaceBefore=4, spaceAfter=8))
styles.add(ParagraphStyle("TitleBig", parent=styles["Title"], textColor=INK, fontSize=26, leading=30))
styles.add(ParagraphStyle("Sub", parent=styles["Body"], textColor=colors.HexColor("#57606a"), fontSize=12))

CODE = ParagraphStyle("Code", fontName="Courier", fontSize=8.7, leading=12,
                      textColor=CODE_FG, leftIndent=0)

story = []

def h1(t): story.append(Paragraph(t, styles["H1x"]))
def h2(t): story.append(Paragraph(t, styles["H2x"]))
def p(t): story.append(Paragraph(t, styles["Body"]))
def note(t): story.append(Paragraph("<b>Note:</b> " + t, styles["Note"]))
def gap(h=6): story.append(Spacer(1, h))

def bullets(items, numbered=False):
    lf = ListFlowable(
        [ListItem(Paragraph(i, styles["BulletX"]), leftIndent=14) for i in items],
        bulletType="1" if numbered else "bullet",
        bulletColor=ACCENT, start="1" if numbered else None,
    )
    story.append(lf); gap(4)

def code(lines):
    block = Preformatted("\n".join(lines), CODE)
    tbl = Table([[block]], colWidths=[6.6 * inch])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    story.append(tbl); gap(8)

def table(rows, widths):
    t = Table(rows, colWidths=[w * inch for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PANEL]),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t); gap(8)

# ---------------------------------------------------------------- cover ------
story.append(Spacer(1, 1.4 * inch))
story.append(Paragraph("Publishing the Pipeline Failure Agent", styles["TitleBig"]))
story.append(Paragraph("to the Visual Studio Code Marketplace", styles["TitleBig"]))
gap(14)
story.append(Paragraph("A step-by-step guide: packaging with <b>@vscode/vsce</b>, creating a "
                       "publisher, obtaining an Azure DevOps token, publishing to the VS Code "
                       "Marketplace and Open VSX, and automating releases in CI.", styles["Sub"]))
gap(20)
story.append(HRFlowable(width="100%", color=BORDER))
gap(8)
story.append(Paragraph("Applies to the extension in <font name='Courier'>apps/vscode-extension/</font> "
                       "of the pipeline-failure-agent monorepo. Generated 2026-07-17.", styles["Body"]))
story.append(PageBreak())

# ---------------------------------------------------------------- 0 overview -
h1("0. What you'll do")
p("Publishing a VS Code extension has three one-time setup steps and a repeatable "
  "publish step:")
bullets([
    "<b>Set up identity</b> — an Azure DevOps organization and a Personal Access Token (PAT).",
    "<b>Create a publisher</b> — a Marketplace identity whose ID must match the "
    "<font name='Courier'>publisher</font> field in <font name='Courier'>package.json</font>.",
    "<b>Package</b> the extension into a <font name='Courier'>.vsix</font> and test it locally.",
    "<b>Publish</b> to the Marketplace (and optionally Open VSX), then automate it in CI.",
], numbered=True)
note("Everything below uses <b>@vscode/vsce</b> (the maintained CLI). The old "
     "<font name='Courier'>vsce</font> package is deprecated — do not install it.")

h1("1. Prerequisites")
bullets([
    "Node.js 18+ and npm installed.",
    "A <b>Microsoft / Azure DevOps</b> account (free) at dev.azure.com.",
    "This repo cloned locally, with root dependencies installed "
    "(<font name='Courier'>npm install</font> at the monorepo root).",
])
h2("Install the packaging CLI")
code(["npm install -g @vscode/vsce", "vsce --version"])
h2("Prepare the extension manifest")
p("Before publishing, update these fields in "
  "<font name='Courier'>apps/vscode-extension/package.json</font> — the shipped values are "
  "placeholders:")
table([
    ["Field", "Shipped value", "Change to"],
    ["publisher", "your-org", "Your real publisher ID (from step 3)"],
    ["repository", "(add)", "{ \"type\": \"git\", \"url\": \"https://github.com/<you>/pipeline-failure-agent\" }"],
    ["icon", "(activity-bar svg only)", "media/icon-128.png (128x128 PNG for the listing)"],
    ["version", "0.1.0", "Semantic version; bump on each publish"],
], [1.1, 1.9, 3.4])
note("The Marketplace <b>listing</b> icon must be a 128x128 PNG referenced by the "
     "<font name='Courier'>icon</font> field. The SVG in "
     "<font name='Courier'>media/icon.svg</font> is only the activity-bar icon.")

# ---------------------------------------------------------------- 2 PAT ------
story.append(PageBreak())
h1("2. Create an Azure DevOps Personal Access Token (PAT)")
p("The PAT authorizes vsce to publish on your behalf. It is separate from any GitHub token.")
bullets([
    "Sign in at <b>https://dev.azure.com</b> (create an organization if prompted).",
    "Open <b>User settings</b> (top-right avatar) → <b>Personal access tokens</b>.",
    "Click <b>New Token</b>.",
    "<b>Organization:</b> select <b>All accessible organizations</b> (required — a single-org "
    "token will fail to publish).",
    "<b>Expiration:</b> up to 1 year (you can rotate later).",
    "<b>Scopes:</b> choose <b>Custom defined</b>, then scroll to <b>Marketplace</b> and check "
    "<b>Manage</b> (Acquire + Publish + Manage).",
    "Click <b>Create</b> and <b>copy the token now</b> — it is shown only once.",
], numbered=True)
note("Store the PAT in a password manager. You will paste it into "
     "<font name='Courier'>vsce login</font> and into a GitHub secret "
     "(<font name='Courier'>VSCE_PAT</font>) for CI. Never commit it.")

# ---------------------------------------------------------------- 3 publisher
h1("3. Create your publisher")
bullets([
    "Go to <b>https://marketplace.visualstudio.com/manage</b> and sign in with the same account.",
    "Click <b>Create publisher</b>.",
    "Set a <b>publisher ID</b> (lowercase, unique, e.g. <font name='Courier'>acme-data</font>) and a "
    "display name. <b>The ID must equal the</b> <font name='Courier'>publisher</font> "
    "<b>field in package.json.</b>",
    "Save. You can add a logo and links to the publisher profile later.",
], numbered=True)
h2("Log vsce in to the publisher")
code(["vsce login <your-publisher-id>", "# paste the PAT when prompted"])
p("Alternatively, pass the token per-command with "
  "<font name='Courier'>-p &lt;PAT&gt;</font> (useful in CI).")

# ---------------------------------------------------------------- 4 package --
story.append(PageBreak())
h1("4. Build, package, and test locally")
p("This extension bundles the shared monorepo core with esbuild, so package with "
  "<font name='Courier'>--no-dependencies</font> (node_modules are already inlined).")
code([
    "# from the monorepo root",
    "npm install",
    "",
    "cd apps/vscode-extension",
    "npm install",
    "npm run build            # esbuild -> dist/extension.js",
    "",
    "# create the .vsix",
    "vsce package --no-dependencies",
    "#  -> pipeline-failure-agent-0.1.0.vsix",
])
h2("Inspect what will ship")
code(["vsce ls --no-dependencies   # list files included in the package"])
p("Confirm that <font name='Courier'>src/</font> and source maps are excluded (see "
  "<font name='Courier'>.vscodeignore</font>) and that "
  "<font name='Courier'>dist/extension.js</font>, the README, LICENSE, and icon are included.")
h2("Install the VSIX in your editor to smoke-test")
code([
    "code --install-extension pipeline-failure-agent-0.1.0.vsix",
    "# then open the 'Pipeline Failure Agent' activity-bar view and run an investigation",
])

# ---------------------------------------------------------------- 5 publish --
h1("5. Publish to the Marketplace")
p("With the publisher logged in:")
code(["vsce publish --no-dependencies"])
p("Or bump the version and publish in one step (updates package.json and, in a git repo, "
  "creates a tag):")
code([
    "vsce publish patch --no-dependencies   # 0.1.0 -> 0.1.1",
    "vsce publish minor --no-dependencies   # 0.1.0 -> 0.2.0",
    "vsce publish 1.0.0 --no-dependencies   # explicit version",
])
p("Using a token directly (no prior login):")
code(["vsce publish -p <PAT> --no-dependencies"])
note("The extension appears at "
     "<font name='Courier'>https://marketplace.visualstudio.com/items?itemName=&lt;publisher&gt;.pipeline-failure-agent-vscode</font> "
     "within a few minutes. First-time verification can take longer.")

# ---------------------------------------------------------------- 6 openvsx --
story.append(PageBreak())
h1("6. (Optional) Publish to Open VSX")
p("Open VSX serves editors that can't use the Microsoft Marketplace (VSCodium, Cursor, "
  "Gitpod, Eclipse Theia). It uses a separate account and token.")
bullets([
    "Create an account at <b>https://open-vsx.org</b> (sign in with GitHub/Eclipse) and accept "
    "the publisher agreement.",
    "Generate an <b>access token</b> from your Open VSX user settings.",
    "Create your namespace (once), then publish the built VSIX:",
], numbered=True)
code([
    "npx ovsx create-namespace <your-publisher-id> -p <OVSX_PAT>",
    "npx ovsx publish pipeline-failure-agent-0.1.0.vsix -p <OVSX_PAT>",
])

# ---------------------------------------------------------------- 7 CI -------
h1("7. Automate with GitHub Actions")
p("This repo already ships <font name='Courier'>.github/workflows/extension.yml</font>, which "
  "builds a VSIX on every PR and publishes on a version tag. Add these repository secrets "
  "(Settings → Secrets and variables → Actions):")
table([
    ["Secret", "Purpose"],
    ["VSCE_PAT", "Azure DevOps PAT with Marketplace → Manage scope"],
    ["OVSX_PAT", "Open VSX access token (only if publishing there)"],
], [1.4, 5.0])
p("Then cut a release by pushing a tag that matches the manifest version:")
code([
    "git tag v0.1.0",
    "git push origin v0.1.0    # triggers build + Marketplace + Open VSX publish",
])
note("Keep <font name='Courier'>version</font> in package.json in sync with the tag, or let "
     "<font name='Courier'>vsce publish &lt;increment&gt;</font> manage both.")

# ---------------------------------------------------------------- 8 checklist
story.append(PageBreak())
h1("8. Pre-publish checklist")
bullets([
    "<font name='Courier'>publisher</font> set to your real publisher ID (not <i>your-org</i>).",
    "<font name='Courier'>name</font> + <font name='Courier'>publisher</font> are unique on the Marketplace.",
    "<font name='Courier'>version</font> bumped since the last publish.",
    "128x128 PNG <font name='Courier'>icon</font>; README renders; LICENSE present; "
    "<font name='Courier'>repository</font> URL set.",
    "<font name='Courier'>.vscodeignore</font> excludes <font name='Courier'>src/</font> and maps; "
    "<font name='Courier'>dist/extension.js</font> is bundled.",
    "<font name='Courier'>vsce package</font> runs with no errors; "
    "<font name='Courier'>vsce ls</font> shows the expected files.",
    "Installed the VSIX locally and verified the activity-bar view + an investigation.",
])

h1("9. Troubleshooting")
table([
    ["Symptom", "Cause / fix"],
    ["ERROR Missing publisher name", "Add \"publisher\" to package.json; it must match your Marketplace publisher ID."],
    ["401 / Unauthorized on publish", "PAT expired, wrong scope, or not 'all accessible organizations'. Recreate with Marketplace → Manage."],
    ["Make sure to edit the README", "Replace the default README content before packaging."],
    ["Relative image links in README", "Use absolute https URLs (or a raw.githubusercontent.com link) for images."],
    ["Package too large / ships src", "Check .vscodeignore; bundle with esbuild and use --no-dependencies."],
    ["'vsce' command not found", "Install @vscode/vsce globally, or run via 'npx @vscode/vsce'."],
], [2.3, 4.3])

story.append(HRFlowable(width="100%", color=BORDER))
gap(6)
story.append(Paragraph(
    "Official reference: code.visualstudio.com/api/working-with-extensions/publishing-extension "
    "· Marketplace management: marketplace.visualstudio.com/manage · Open VSX: open-vsx.org",
    styles["Sub"]))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#8b949e"))
    canvas.drawString(0.9 * inch, 0.55 * inch,
                      "Pipeline Failure Agent — VS Code Marketplace Publishing Guide")
    canvas.drawRightString(7.6 * inch, 0.55 * inch, "Page %d" % doc.page)
    canvas.restoreState()

doc = SimpleDocTemplate(OUT, pagesize=LETTER,
                        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
                        topMargin=0.85 * inch, bottomMargin=0.85 * inch,
                        title="Pipeline Failure Agent — VS Code Publishing Guide",
                        author="pipeline-failure-agent")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote", OUT)
