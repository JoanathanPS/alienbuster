from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import os

import open_clip
import torch
from PIL import Image

# Avoid HF hub symlink warnings on Windows
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

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


@dataclass(frozen=True)
class ClassificationResult:
    species: str
    confidence: float
    is_invasive: bool
    raw_label: str
    status: str  # e.g. "high_confidence", "uncertain", "not_invasive"


class BioClipClassifier:
    def __init__(
        self,
        invasive_species: Optional[List[str]] = None,
        *,
        device: Optional[str] = None,
        invasive_threshold: float = 0.50,
    ):
        self.invasive_species = invasive_species or DEFAULT_INVASIVE_SPECIES
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.invasive_threshold = invasive_threshold

        self.model = None
        self.preprocess = None
        self.tokenizer = None
        self.candidate_labels: List[str] = []
        self._text_features = None

    def load(self) -> None:
        if self.model is not None:
            return

        # Primary: BioCLIP
        try:
            model, _, preprocess = open_clip.create_model_and_transforms("hf-hub:imageomics/bioclip")
            tokenizer = open_clip.get_tokenizer("hf-hub:imageomics/bioclip")
        except Exception:
            # Fallback: general CLIP
            model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-16", pretrained="laion2b_s34b_b88k")
            tokenizer = open_clip.get_tokenizer("ViT-B-16")

        model.eval()
        model.to(self.device)

        self.model = model
        self.preprocess = preprocess
        self.tokenizer = tokenizer

        # Build label prompts - expanded with more specific invasive descriptions
        self.candidate_labels = (
            [f"a photo of invasive {s}" for s in self.invasive_species]
            + [f"photo of {s}" for s in self.invasive_species]
            + [
                f"animal: invasive {s}"
                for s in self.invasive_species
                if ("python" in s or "pig" in s or "toad" in s)
            ]
            + [
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
            ]
        )

        with torch.no_grad():
            text_tokens = self.tokenizer(self.candidate_labels).to(self.device)
            text_features = self.model.encode_text(text_tokens)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)

        self._text_features = text_features

    def classify(self, image: Image.Image) -> ClassificationResult:
        if self.model is None or self.preprocess is None or self._text_features is None:
            raise RuntimeError("BioClipClassifier.load() must be called before classify().")

        image_input = self.preprocess(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            image_features = self.model.encode_image(image_input)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            similarity = (100.0 * image_features @ self._text_features.T).softmax(dim=-1)[0]

        top_prob, top_idx = similarity.topk(1)
        confidence = float(top_prob.item())

        raw = self.candidate_labels[int(top_idx.item())]
        clean = raw.replace("a photo of ", "").replace("invasive ", "").strip()
        
        # Determine status and refine invasive flag
        is_invasive = False
        species = "Unknown"
        status = "uncertain"

        # Negative prompts check - STRICT: exclude pets, people, objects
        is_negative = any(
            x in raw.lower() 
            for x in ["blurry", "person", "man-made", "unknown", "native", "cat", "dog", "furniture", "building"]
        )
        
        # Exclude pets explicitly
        is_pet = "cat" in raw.lower() or "dog" in raw.lower()

        if is_negative or is_pet:
            species = clean.title() if "native" in raw else "Unknown / Non-target"
            is_invasive = False
            status = "not_invasive"
        elif any(
            inv.lower() == clean.lower() for inv in self.invasive_species
        ):
            # Exact match: strict invasive identification
            species = clean.title()
            if confidence >= self.invasive_threshold:
                is_invasive = True
                status = "high_confidence" if confidence > 0.75 else "potential_invasive"
            else:
                is_invasive = False
                status = "uncertain_invasive_match"
        elif any(
            inv.lower() in clean.lower() for inv in self.invasive_species
        ):
            # Partial match: only consider invasive if high confidence
            species = clean.title()
            if confidence >= 0.65:
                is_invasive = True
                status = "potential_invasive"
            else:
                is_invasive = False
                status = "uncertain_invasive_match"
        else:
            # Not in invasive list at all
            species = clean.title()
            is_invasive = False
            status = "likely_native"

        return ClassificationResult(
            species=species,
            confidence=confidence,
            is_invasive=is_invasive,
            raw_label=raw,
            status=status
        )
