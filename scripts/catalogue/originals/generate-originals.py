"""Writes showcrafter-originals.csv: original ShowCrafter cakes and single fireworks.

Each product is a hand-picked combination of effect phrases, caliber, shot count, firing
pattern and timing, written in Finale VDL so it renders the same in ShowCrafter and in
Finale 3D. Run with python3; the output is checked in and imported by
scripts/catalogue/import-vdl.mjs.
"""

import csv
import random
from pathlib import Path

OUT = Path(__file__).with_name("showcrafter-originals.csv")
MANUFACTURER = "ShowCrafter Originals"
rng = random.Random(20261016)  # Fixed seed: regenerating gives the same catalogue.

# Effect phrases by family. Each is valid VDL for the importer's glossary.
SHELLS = [
    "Red Peony", "Green Peony", "Blue Peony", "Purple Peony", "Lemon Peony", "White Peony",
    "Orange Peony", "Aqua Peony", "Pink Peony", "Magenta Peony",
    "Gold Chrysanthemum", "Silver Chrysanthemum", "Silver Chrysanthemum w/ Red Pistil",
    "Gold Chrysanthemum w/ Blue Pistil", "Red Dahlia", "Green Dahlia", "Purple Dahlia",
    "Gold Brocade", "Gold Brocade Crown", "Brocade Willow w/ Red Strobing",
    "Gold Kamuro", "Crackling Kamuro", "Charcoal Willow", "Charcoal Willow w/ Purple",
    "Charcoal Willow w/ Blue", "Strobing Willow", "Gold Palm", "Green Strobing Palm",
    "Silver Palm w/ Red Pistil", "Coconut", "Horsetail", "Waterfall", "Gold Tiger Tail",
    "Silver Crossette", "Gold Crossette", "Red Crossette", "Purple Ring", "Green Ring",
    "Double Ring", "Heart", "Saturn", "Bowtie", "Spider", "Time Rain", "Falling Leaves",
    "Tight Crackling Dahlia", "Crackling Chrysanthemum", "Popcorn Crackling Peony",
    "White Strobing Peony", "Red Flashing Peony", "Twinkling Silver Peony",
    "Glittering Gold Chrysanthemum", "Ghost Peony", "Blue to Red Peony",
    "Green to Purple Peony", "Red & Green Peony", "Rainbow Peony", "Pastel Colours Peony",
    "Salute", "Bees", "Flying Fish",
]
COMET_TO = [
    "Gold Comet To Red Peony", "Silver Comet To Blue Peony", "Gold Comet To Gold Peony",
    "Rising Gold Tail To Green Dahlia", "Rising Silver Tail To Purple Peony",
    "Crackling Tail To Crackling Chrysanthemum", "Gold Tail To Charcoal Willow",
    "Brocade Tail To Gold Brocade Crown",
]
MINES = [
    "Red Flashing Mine", "Green Strobing Mine", "Gold Mine", "Silver Crackling Mine",
    "Purple Mine", "Charcoal Willow Mine", "Popcorn Crackling Mine",
]
GROUND = ["Rising Red Go Getter", "Rising Lemon Go Getter", "Whistle", "Gold Comet", "Silver Comet"]
ADJECTIVES = ["", "", "", "Big ", "Small ", "Dense ", "Sparse ", "Bright ", "Long ", "Slightly Big "]

CALIBERS = [("20mm", 0.5), ("25mm", 0.6), ("30mm", 0.7), ('1.2"', 0.8), ('1.5"', 0.9), ('1.75"', 1.0), ('2"', 1.1)]
PATTERNS = ["STR", "STL", "FNR", "FNL", "FNT", "ALR", "ARL", "CTO", "OTC", "STT", "VSS"]

PREFIXES = [
    "Aurora", "Nightfall", "Starlight", "Ember", "Solstice", "Thunder", "Velvet", "Comet",
    "Midnight", "Crimson", "Golden", "Silver", "Neon", "Cosmic", "Phoenix", "Glacier",
    "Volcano", "Monsoon", "Lantern", "Harbour", "Meteor", "Orchard", "Quartz", "Riverside",
    "Sapphire", "Tempest", "Summit", "Wildfire", "Zenith", "Horizon",
]
SUFFIXES = [
    "Crown", "Cascade", "Barrage", "Garden", "Parade", "Waltz", "Storm", "Chorus", "Fanfare",
    "Bloom", "Rush", "Spiral", "Lights", "Dance", "Finale", "Glow", "Veil", "Rhapsody",
    "Echo", "Fusion",
]


def phrase():
    """One lettered part: an adjective plus a shell, comet-to-shell, mine or ground effect."""
    roll = rng.random()
    if roll < 0.62:
        return rng.choice(ADJECTIVES) + rng.choice(SHELLS)
    if roll < 0.78:
        return rng.choice(COMET_TO)
    if roll < 0.92:
        return rng.choice(MINES)
    return rng.choice(GROUND)


def cake(index, used_names):
    caliber, scale = rng.choice(CALIBERS)
    letters = "abcdef"[: rng.choice([1, 2, 2, 3, 3, 4, 5, 6])]
    parts = []
    while len(parts) < len(letters):
        candidate = phrase()
        if candidate not in parts:
            parts.append(candidate)
    rows = rng.choice([1, 2, 3, 4, 5, 6])
    per_row = rng.choice([4, 5, 6, 7, 8, 9, 10])
    if caliber in ('1.75"', '2"'):
        per_row = min(per_row, 6)
    specs = []
    shot_count = 0
    for row in range(1, rows + 1):
        pattern = rng.choice(PATTERNS)
        labels = "".join(letters[(row - 1 + i) % len(letters)] for i in range(per_row))
        delay = "" if row == 1 or rng.random() < 0.6 else f"{rng.choice([0.5, 1.0, 1.5, 2.0])}/"
        duration = "" if pattern.endswith("T") or rng.random() < 0.5 else f"/{round(per_row * rng.uniform(0.3, 0.8), 1)}"
        parallel = "*" if row > 1 and rng.random() < 0.12 else ""
        specs.append(f"Row {row} ({delay}{labels}/{pattern}{duration}{parallel})")
        shot_count += per_row
    # A closing volley on most cakes: one row of everything fired together.
    if rng.random() < 0.55:
        finale = "".join(letters[i % len(letters)] for i in range(per_row))
        specs.append(f"Row {rows + 1} (1.0/{finale}/FNT)")
        rows += 1
        shot_count += per_row
    body = " + ".join(f"({letter}) {text}" for letter, text in zip(letters, parts))
    vdl = f"{shot_count} Shot {body} Cake, {rows} Rows, " + ", ".join(specs)
    duration = round(shot_count * rng.uniform(0.35, 0.85) * scale, 2)
    while True:
        name = f"{rng.choice(PREFIXES)} {rng.choice(SUFFIXES)}"
        if name not in used_names:
            used_names.add(name)
            break
    return {
        "part_number": f"SCO-C{index:03d}",
        "name": f"{name} {shot_count} Shot",
        "kind": "cake",
        "caliber": caliber,
        "duration_seconds": duration,
        "vdl": vdl,
        "manufacturer": MANUFACTURER,
        "finale_product_id": "",
    }


SINGLES = [
    ("shell", '3"', "Ripple Gold Kamuro", "Big Gold Kamuro w/ Red Pistil w/ Gold Tail Shell"),
    ("shell", '3"', "Blue Hour Peony", "Dense Blue Peony w/ Silver Pistil w/ Silver Tail Shell"),
    ("shell", '3"', "Ember Willow", "Long Charcoal Willow w/ Sparse Red Strobing w/ Charcoal Tail Shell"),
    ("shell", '3"', "Crossfire Crossette", "Big Silver Crossette w/ Silver Tail Shell"),
    ("shell", '3"', "Halo Double Ring", "Double Ring w/ Gold Tail Shell"),
    ("shell", '3"', "Saturn Rising", "Saturn w/ Silver Tail Shell"),
    ("shell", '2.5"', "Heartline", "Red Heart w/ Gold Tail Shell"),
    ("shell", '2.5"', "Copper Palm", "Thick Trail Gold Palm w/ Gold Tail Shell"),
    ("shell", '2.5"', "Glitter Rain", "Long Glittering Gold Time Rain w/ Gold Tail Shell"),
    ("shell", '2.5"', "Neon Dahlia", "Bright Green Dahlia w/ Purple Pistil Shell"),
    ("shell", '2.5"', "Thunder Salute", "Big Salute w/ Silver Tail Shell"),
    ("shell", '2"', "Crackle Crown", "Tight Crackling Gold Brocade Crown w/ Crackling Tail Shell"),
    ("shell", '2"', "Strobe Garden", "White Strobing Peony w/ Green Strobing Pistil Shell"),
    ("shell", '2"', "Horsetail Drift", "Long Horsetail w/ Gold Tail Shell"),
    ("shell", '2"', "Spider Bloom", "Silver Spider w/ Silver Tail Shell"),
    ("shell", '2"', "Falling Gold Leaves", "Gold Falling Leaves w/ Gold Tail Shell"),
    ("mine", "30mm", "Red Shimmer Mine", "Red Flashing Mine"),
    ("mine", "30mm", "Silver Crackle Mine", "Silver Crackling Mine"),
    ("mine", "40mm", "Green Strobe Mine", "Green Strobing Mine"),
    ("comet", "30mm", "Golden Pillar Comet", "Gold Comet"),
    ("comet", "30mm", "Silver Arrow Comet", "Silver Comet"),
]


def main():
    used = set()
    rows = [cake(index, used) for index in range(1, 101)]
    for index, (kind, caliber, name, vdl) in enumerate(SINGLES, start=1):
        rows.append({
            "part_number": f"SCO-S{index:03d}",
            "name": name,
            "kind": kind,
            "caliber": caliber,
            "duration_seconds": "",
            "vdl": vdl,
            "manufacturer": MANUFACTURER,
            "finale_product_id": "",
        })
    with OUT.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} products written to {OUT.name}")


if __name__ == "__main__":
    main()
