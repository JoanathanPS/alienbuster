from typing import List

# Invasive species list (Source of Truth)
DEFAULT_INVASIVE_SPECIES: List[str] = [
    "kudzu",
    "lantana camara",
    "water hyacinth",
    "purple loosestrife",
    "japanese knotweed",
    "english ivy",
    "garlic mustard",
    "cheatgrass",
    "tamarisk",
    "common buckthorn",
    "burmese python",
    "cane toad",
    "zebra mussel",
    "emerald ash borer",
    "asian carp",
    "feral pig",
    "lionfish",
    "european starling",
    "brown tree snake",
    "nutria",
    "red imported fire ant",
    "argentine ant",
    "fallow deer",
]

def build_candidate_labels(invasive_species: List[str] = None) -> List[str]:
    species = invasive_species or DEFAULT_INVASIVE_SPECIES
    
    # Positive prompts
    prompts = [f"a photo of invasive {s}" for s in species]
    prompts += [f"photo of {s}" for s in species]
    
    # Specific animal prompts
    prompts += [
        f"animal: invasive {s}"
        for s in species
        if ("python" in s or "pig" in s or "toad" in s or "snake" in s or "carp" in s)
    ]

    # Negative/Native/Generic prompts
    prompts += [
        "a photo of a native plant",
        "a photo of a native animal",
        "a domestic pet cat",
        "a domestic pet dog",
        "a wild animal not on invasive species list",
        "unknown organism",
        "a blurry photo",
        "a photo of a person",
        "a photo of a man-made object",
        "a photo of furniture",
        "a photo of a building",
        "a photo of a vehicle",
    ]
    
    return prompts
