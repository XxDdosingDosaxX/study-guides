"""
Auto-update index.html with cards for all study guides in the repo.
Scans all *_Study_Guide.html files, extracts metadata, and rebuilds
the guides grid in index.html.

Usage: python update_index.py
"""

import os
import re
import glob
from html import escape

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(REPO_DIR, "index.html")

# Color palettes for categories
CATEGORY_COLORS = {
    "pulmonology": "#10b981",
    "infectious": "#3b82f6",
    "hematology": "#ef4444",
    "cardiology": "#ec4899",
    "neurology": "#8b5cf6",
    "neurosurgery": "#f59e0b",
    "gastroenterology": "#06b6d4",
    "nephrology": "#d97706",
    "endocrinology": "#f97316",
    "rheumatology": "#a855f7",
    "emergency": "#ef4444",
    "oncology": "#6366f1",
    "default": "#3b82f6",
}

GRADIENT_COLORS = [
    "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", "#10b981", "#06b6d4", "#ec4899"
]


def extract_metadata(filepath):
    """Extract title, sections, image count, video count, and keywords from a study guide HTML."""
    filename = os.path.basename(filepath)

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Extract title from <title> tag
    title_match = re.search(r"<title>(.*?)(?:\s*[—&].*)?</title>", content, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else filename.replace("_", " ").replace(".html", "")
    title = re.sub(r"\s*&mdash;.*", "", title)
    title = re.sub(r"\s*—.*", "", title)

    # Count images (base64 embedded)
    img_count = len(re.findall(r'data:image/', content))

    # Count video clips
    video_count = len(re.findall(r'<video\b', content))

    # Count sections
    section_count = len(re.findall(r'class="section-number"', content))

    # Count tabs
    tab_count = len(re.findall(r'class="tab-btn"', content))

    # Check for calculators
    has_calculator = bool(re.search(r'calculator|calc-option|gcs-option', content, re.IGNORECASE))

    # Check for SVG diagrams
    svg_count = len(re.findall(r'<svg\b', content))

    # Check for Osmosis
    has_osmosis = bool(re.search(r'osmosis\.org', content, re.IGNORECASE))

    # Extract section titles for description
    section_titles = re.findall(r'<h2>(.*?)</h2>', content)
    section_titles = [re.sub(r'<[^>]+>', '', t).strip() for t in section_titles]

    # Extract key facts for keywords
    fact_badges = re.findall(r'class="fact-badge"[^>]*>(.*?)</span>', content)
    fact_badges = [re.sub(r'<[^>]+>', '', b).strip() for b in fact_badges]

    # Guess category from content
    category = "Internal Medicine"
    category_color = CATEGORY_COLORS["default"]

    content_lower = content.lower()
    # Check more specific categories FIRST (before broad "pulmonary" which matches many guides)
    if any(w in content_lower for w in ["tbi", "brain hemorrhage", "neurosurg", "craniotomy", "herniation", "epidural hematoma", "subdural hematoma", "subarachnoid"]):
        category = "Neurosurgery / Emergency Medicine"
        category_color = CATEGORY_COLORS["neurosurgery"]
    elif any(w in content_lower for w in ["ttp", "hematol", "anemia", "platelet", "coagul", "thrombocyt", "schistocyte", "plasma exchange"]):
        category = "Hematology"
        category_color = CATEGORY_COLORS["hematology"]
    elif any(w in content_lower for w in ["pneumonia", "copd", "asthma", "pulmonary", "lung", "bronch"]):
        category = "Pulmonology"
        category_color = CATEGORY_COLORS["pulmonology"]
        if any(w in content_lower for w in ["pneumonia", "antibiotic", "bacterial", "viral"]):
            category = "Pulmonology / Infectious Disease"
            category_color = CATEGORY_COLORS["infectious"]
    elif any(w in content_lower for w in ["heart failure", "cardiomyopathy", "arrhythmia", "afib", "mi ", "stemi"]):
        category = "Cardiology"
        category_color = CATEGORY_COLORS["cardiology"]
    elif any(w in content_lower for w in ["crohn", "colitis", "gi bleed", "pancreatitis", "cirrhosis", "hepat"]):
        category = "Gastroenterology"
        category_color = CATEGORY_COLORS["gastroenterology"]
    elif any(w in content_lower for w in ["aki", "ckd", "nephr", "dialysis", "glomerul"]):
        category = "Nephrology"
        category_color = CATEGORY_COLORS["nephrology"]
    elif any(w in content_lower for w in ["diabetes", "thyroid", "adrenal", "dka", "insulin"]):
        category = "Endocrinology"
        category_color = CATEGORY_COLORS["endocrinology"]

    # Build description from section titles
    if section_titles:
        desc = ". ".join(section_titles[:5])
        if len(desc) > 200:
            desc = desc[:197] + "..."
    else:
        desc = f"Interactive study guide covering {title}."

    # Build keywords from title, sections, fact badges
    keywords = " ".join([
        title.lower(),
        " ".join(s.lower() for s in section_titles),
        " ".join(b.lower() for b in fact_badges[:10]),
        category.lower(),
    ])
    # Clean keywords
    keywords = re.sub(r'[<>"\']', '', keywords)
    keywords = re.sub(r'\s+', ' ', keywords).strip()

    # Build tags
    tags = []
    if has_calculator:
        tags.append("Calculator")
    if video_count > 0:
        tags.append(f"{video_count} Video Clips")
    if has_osmosis:
        tags.append("Osmosis")
    if svg_count > 0:
        tags.append("SVG Diagrams")
    if img_count > 10:
        tags.append(f"{img_count}+ Images")
    if tab_count > 10:
        tags.append("Tabbed Sections")

    # Pick gradient colors based on hash of filename
    h = hash(filename)
    c1 = GRADIENT_COLORS[h % len(GRADIENT_COLORS)]
    c2 = GRADIENT_COLORS[(h + 2) % len(GRADIENT_COLORS)]
    c3 = GRADIENT_COLORS[(h + 4) % len(GRADIENT_COLORS)]
    gradient = f"linear-gradient(90deg,{c1},{c2},{c3})"

    # Meta line
    meta_parts = []
    if img_count > 0:
        meta_parts.append(f"{img_count} images")
    if video_count > 0:
        meta_parts.append(f"{video_count} video clips")
    meta_left = " &bull; ".join(meta_parts) if meta_parts else f"{section_count} sections"

    # Get file modification date
    mtime = os.path.getmtime(filepath)
    import datetime
    date_str = datetime.datetime.fromtimestamp(mtime).strftime("%b %Y")

    return {
        "filename": filename,
        "title": title,
        "category": category,
        "category_color": category_color,
        "description": desc,
        "keywords": keywords,
        "tags": tags,
        "gradient": gradient,
        "meta_left": meta_left,
        "date": date_str,
        "img_count": img_count,
        "video_count": video_count,
        "section_count": section_count,
    }


def build_card_html(meta):
    """Generate HTML for a single guide card."""
    tags_html = "\n".join(
        f'          <span class="guide-tag">{escape(t)}</span>' for t in meta["tags"]
    )

    return f"""
    <a href="{escape(meta['filename'])}" class="guide-card" data-keywords="{escape(meta['keywords'])}">
      <div class="guide-color-bar" style="background:{meta['gradient']}"></div>
      <div class="guide-content">
        <div class="guide-category" style="color:{meta['category_color']}">{escape(meta['category'])}</div>
        <div class="guide-title">{escape(meta['title'])}</div>
        <div class="guide-description">{meta['description']}</div>
        <div class="guide-tags">
{tags_html}
        </div>
        <div class="guide-meta">
          <span>{meta['meta_left']}</span>
          <span>{meta['date']}</span>
        </div>
      </div>
    </a>"""


def update_index():
    """Scan all study guides and rebuild index.html grid."""
    # Find all study guide HTML files
    guides = sorted(glob.glob(os.path.join(REPO_DIR, "*_Study_Guide.html")))

    if not guides:
        print("No study guide files found!")
        return

    print(f"Found {len(guides)} study guides:")

    # Extract metadata from each
    cards_html = []
    for g in guides:
        meta = extract_metadata(g)
        print(f"  - {meta['title']} ({meta['img_count']} images, {meta['video_count']} videos)")
        cards_html.append(build_card_html(meta))

    all_cards = "\n".join(cards_html)

    # Read index.html
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        index_content = f.read()

    # Replace the guides grid content
    pattern = r'(<div class="guides-grid" id="guides-grid">)(.*?)(</div>\s*<div class="no-results")'
    replacement = f'\\1\n{all_cards}\n\n  \\3'

    new_content = re.sub(pattern, replacement, index_content, flags=re.DOTALL)

    # Update guide count
    new_content = re.sub(
        r'(<div class="stat-number" id="guide-count">)\d+(</div>)',
        f'\\g<1>{len(guides)}\\2',
        new_content
    )

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"\nindex.html updated with {len(guides)} guide cards.")


if __name__ == "__main__":
    update_index()
