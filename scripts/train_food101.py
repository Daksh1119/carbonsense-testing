"""
train_food101.py
────────────────
Phase 1: Fine-tune EfficientNet-B4 on Food-101.
Run on Google Colab (free T4) or Kaggle Notebooks.

Expected output:
  models/food_recognition/food101_best.pt
  models/food_recognition/food101_classes.json
  models/food_recognition/food101_history.json

Target metrics:
  Top-1 accuracy > 85%
  Top-5 accuracy > 95%

Usage (Colab):
  !python scripts/train_food101.py
"""

import json
import time
import warnings
from pathlib import Path

import torch
import torch.nn as nn
from torch.cuda.amp import GradScaler, autocast
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, models, transforms
from torchvision.models import EfficientNet_B4_Weights
from tqdm.auto import tqdm

warnings.filterwarnings("ignore")

# ─── Config ──────────────────────────────────────────────────────────────────
DEVICE      = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DATA_DIR    = Path("data/raw/food")
MODEL_DIR   = Path("models/food_recognition")
BATCH_SIZE  = 32
# num_workers=0 avoids "can only test a child process" AssertionErrors that
# Python 3.12 raises in Colab's fork-based multiprocessing environment when
# DataLoader workers are torn down.  Single-process loading is only ~10% slower
# on T4 because the GPU is the bottleneck, not data loading.
NUM_WORKERS = 0

# Full-resolution transforms used for Phase B fine-tuning
TRAIN_TRANSFORM = transforms.Compose([
    transforms.RandomResizedCrop(380),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1),
    transforms.RandomRotation(15),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    transforms.RandomErasing(p=0.1),
])

VAL_TRANSFORM = transforms.Compose([
    transforms.Resize(430),
    transforms.CenterCrop(380),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# Smaller 224-crop transforms used for Phase A warmup — classifier head only,
# so resolution matters less and 224 is ~3× faster than 380.
WARMUP_TRAIN_TRANSFORM = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

WARMUP_VAL_TRANSFORM = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


# ─── Model ───────────────────────────────────────────────────────────────────

def build_model(num_classes: int, pretrained: bool = True) -> nn.Module:
    weights = EfficientNet_B4_Weights.IMAGENET1K_V1 if pretrained else None
    model   = models.efficientnet_b4(weights=weights)
    in_feat = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.4, inplace=True),
        nn.Linear(in_feat, num_classes),
    )
    return model.to(DEVICE)


def freeze_backbone(model: nn.Module):
    for name, p in model.named_parameters():
        p.requires_grad = "classifier" in name


def unfreeze_all(model: nn.Module):
    for p in model.parameters():
        p.requires_grad = True


# ─── Train / eval loops ──────────────────────────────────────────────────────

def train_epoch(model, loader, opt, criterion, scaler, desc: str = "train",
                sched=None, sched_per_batch: bool = False) -> tuple[float, float]:
    """
    sched_per_batch=True  → step sched after every batch  (OneCycleLR)
    sched_per_batch=False → caller steps per epoch        (CosineAnnealingLR)
    """
    model.train()
    total_loss = correct = total = 0
    bar = tqdm(loader, desc=desc, leave=False, dynamic_ncols=True)
    for imgs, labels in bar:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        opt.zero_grad()
        with autocast(enabled=DEVICE.type == "cuda"):
            out  = model(imgs)
            loss = criterion(out, labels)
        scaler.scale(loss).backward()
        scaler.step(opt)
        scaler.update()
        if sched_per_batch and sched is not None:
            sched.step()
        total_loss += loss.item()
        correct    += out.argmax(1).eq(labels).sum().item()
        total      += labels.size(0)
        bar.set_postfix(loss=f"{loss.item():.3f}", acc=f"{100.*correct/total:.1f}%")
    return total_loss / len(loader), 100.0 * correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, desc: str = "val") -> dict:
    model.eval()
    total_loss = correct1 = correct5 = total = 0
    for imgs, labels in tqdm(loader, desc=desc, leave=False, dynamic_ncols=True):
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        with autocast(enabled=DEVICE.type == "cuda"):
            out  = model(imgs)
            loss = criterion(out, labels)
        total_loss += loss.item()
        total      += labels.size(0)
        _, pred5 = out.topk(5, dim=1)
        correct1 += pred5[:, 0].eq(labels).sum().item()
        correct5 += pred5.eq(labels.unsqueeze(1)).any(1).sum().item()
    return {
        "loss": total_loss / len(loader),
        "top1": 100.0 * correct1 / total,
        "top5": 100.0 * correct5 / total,
    }


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    print(f"Device: {DEVICE}")
    if DEVICE.type != "cuda":
        print(
            "\n[WARNING] No GPU detected — training on CPU will take ~20× longer.\n"
            "In Colab: Runtime → Change runtime type → T4 GPU, then rerun.\n"
        )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # Load Food-101 (downloads ~5 GB on first run)
    train_ds = datasets.Food101(DATA_DIR, split="train", download=True,
                                transform=TRAIN_TRANSFORM)
    test_ds  = datasets.Food101(DATA_DIR, split="test",  download=False,
                                transform=VAL_TRANSFORM)

    val_size = int(0.1 * len(train_ds))
    train_ds, val_ds = random_split(train_ds, [len(train_ds) - val_size, val_size])

    print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Test: {len(test_ds)}")

    pin = DEVICE.type == "cuda"  # pin_memory only beneficial with CUDA
    # persistent_workers=False (default) — workers shut down after each epoch.
    # persistent_workers=True would keep them alive after main() returns and
    # cause the Colab cell to never terminate.
    dl_kwargs = dict(num_workers=NUM_WORKERS, pin_memory=pin, persistent_workers=False)

    # Warmup loaders use the faster 224-crop transform (Phase A only)
    warmup_train_ds = datasets.Food101(DATA_DIR, split="train", download=False,
                                       transform=WARMUP_TRAIN_TRANSFORM)
    warmup_val_ds   = datasets.Food101(DATA_DIR, split="test",  download=False,
                                       transform=WARMUP_VAL_TRANSFORM)
    warmup_train_loader = DataLoader(warmup_train_ds, BATCH_SIZE, shuffle=True,  **dl_kwargs)
    warmup_val_loader   = DataLoader(warmup_val_ds,   BATCH_SIZE, shuffle=False, **dl_kwargs)

    # Full-resolution loaders for Phase B fine-tuning
    train_loader = DataLoader(train_ds, BATCH_SIZE, shuffle=True,  **dl_kwargs)
    val_loader   = DataLoader(val_ds,   BATCH_SIZE, shuffle=False, **dl_kwargs)
    test_loader  = DataLoader(test_ds,  BATCH_SIZE, shuffle=False, **dl_kwargs)

    model     = build_model(101)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler    = GradScaler(enabled=DEVICE.type == "cuda")
    history   = []
    best_top1 = 0.0

    # Phase A — warmup (classifier only, 3 epochs @ 224px — ~3× faster than 380px)
    print("\n--- Warmup: classifier only (3 epochs @ 224px) ---")
    freeze_backbone(model)
    opt = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=1e-3, weight_decay=1e-4,
    )
    sched = torch.optim.lr_scheduler.OneCycleLR(
        opt, max_lr=1e-3, epochs=3, steps_per_epoch=len(warmup_train_loader),
    )
    for epoch in range(3):
        desc = f"WU {epoch+1}/3"
        # OneCycleLR must step once per BATCH, not per epoch
        tl, ta = train_epoch(model, warmup_train_loader, opt, criterion, scaler,
                             desc=desc, sched=sched, sched_per_batch=True)
        vm = evaluate(model, warmup_val_loader, criterion, desc="val")
        print(f"  {desc} | train {ta:.1f}% | val {vm['top1']:.1f}%")

    # Phase B — full fine-tune (15 epochs)
    print("\n--- Full fine-tune (15 epochs) ---")
    unfreeze_all(model)
    opt = torch.optim.AdamW([
        {"params": model.features.parameters(),   "lr": 5e-5},
        {"params": model.classifier.parameters(), "lr": 5e-4},
    ], weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=15, eta_min=1e-6)

    for epoch in range(15):
        t0   = time.time()
        desc = f"Ep {epoch+1:02d}/15"
        tl, ta = train_epoch(model, train_loader, opt, criterion, scaler, desc=desc)
        sched.step()
        vm      = evaluate(model, val_loader, criterion, desc="val")
        elapsed = time.time() - t0

        print(f"  Epoch {epoch+1:02d}/15 | train {ta:.1f}% | "
              f"val top1 {vm['top1']:.1f}% top5 {vm['top5']:.1f}% | {elapsed:.0f}s")

        if vm["top1"] > best_top1:
            best_top1 = vm["top1"]
            torch.save({
                "epoch":            epoch,
                "model_state_dict": model.state_dict(),
                "val_top1":         best_top1,
                "num_classes":      101,
            }, MODEL_DIR / "food101_best.pt")
            print(f"    Saved checkpoint (val top1 = {best_top1:.1f}%)")

        history.append({"epoch": epoch + 1, **vm, "train_acc": ta})

    # Save class list
    classes = datasets.Food101(DATA_DIR, split="train").classes
    with open(MODEL_DIR / "food101_classes.json", "w") as f:
        json.dump(classes, f)

    # Final test evaluation
    print("\n=== Final Test Evaluation ===")
    test_m = evaluate(model, test_loader, criterion, desc="test")
    print(f"Test Top-1: {test_m['top1']:.1f}%")
    print(f"Test Top-5: {test_m['top5']:.1f}%")
    print(f"\nTarget: Top-1 > 85%, Top-5 > 95%")

    with open(MODEL_DIR / "food101_history.json", "w") as f:
        json.dump(history, f, indent=2)

    # Explicitly release DataLoader workers before exit — without this, worker
    # processes keep running and the Colab cell never terminates.
    del train_loader, val_loader, test_loader
    del warmup_train_loader, warmup_val_loader
    if DEVICE.type == "cuda":
        torch.cuda.empty_cache()

    print("\nTraining complete.")
    print(f"  Checkpoint: {MODEL_DIR / 'food101_best.pt'}")
    print(f"  Classes:    {MODEL_DIR / 'food101_classes.json'}")


if __name__ == "__main__":
    main()
