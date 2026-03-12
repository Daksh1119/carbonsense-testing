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
# Google Drive path — set to None to skip Drive mounting (local Colab only).
# When set, best checkpoint and history are mirrored here so they survive
# runtime resets.  Example: Path("/content/drive/MyDrive/carbonsense_models")
DRIVE_DIR   = Path("/content/drive/MyDrive/carbonsense_models")
BATCH_SIZE      = 32
NUM_WORKERS     = 2   # 2 async prefetch workers; safe on Colab T4, ~30–40% faster
FINETUNE_EPOCHS = 12  # 12 × ~38 min ≈ 7.6 h, fits a single 9-hour free Colab session

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


# ─── Checkpoint helpers ───────────────────────────────────────────────────────

def _ckpt_path() -> Path:
    """Return the checkpoint path, preferring Drive if available."""
    if DRIVE_DIR is not None and DRIVE_DIR.exists():
        return DRIVE_DIR / "food101_best.pt"
    return MODEL_DIR / "food101_best.pt"


def _save_checkpoint(model, opt, sched, epoch: int, best_top1: float,
                     phase: str, history: list,
                     filename: str = "food101_resume.pt") -> None:
    """Save full training state so we can resume after a runtime reset.

    filename="food101_resume.pt"  → written every epoch (for resuming)
    filename="food101_best.pt"    → written only when val_top1 improves (for inference)
    Both are mirrored to Drive when available.
    """
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "epoch":            epoch,
        "phase":            phase,        # "warmup" | "finetune"
        "model_state_dict": model.state_dict(),
        "opt_state_dict":   opt.state_dict(),
        "sched_state_dict": sched.state_dict(),
        "val_top1":         best_top1,
        "num_classes":      101,
        "history":          history,
    }
    local = MODEL_DIR / filename
    torch.save(payload, local)
    if DRIVE_DIR is not None and DRIVE_DIR.exists():
        import shutil
        shutil.copy2(local, DRIVE_DIR / filename)
        print(f"    ✅  Checkpoint mirrored to Drive  (epoch {epoch+1}, val top1 {best_top1:.1f}%)")


def _try_mount_drive() -> bool:
    """Mount Google Drive if running in Colab. Returns True on success."""
    try:
        from google.colab import drive  # type: ignore
        if not Path("/content/drive/MyDrive").exists():
            print("📂  Mounting Google Drive for checkpoint persistence…")
            drive.mount("/content/drive")
        DRIVE_DIR.mkdir(parents=True, exist_ok=True)
        print(f"✅  Drive mounted — checkpoints will be saved to {DRIVE_DIR}")
        return True
    except ImportError:
        print("ℹ️   Not running in Colab — Drive mount skipped.")
        return False
    except Exception as e:
        print(f"⚠️   Drive mount failed ({e}) — saving locally only.")
        return False


def _load_checkpoint(model, opt_warmup=None, opt_finetune=None,
                     sched_warmup=None, sched_finetune=None):
    """
    Load the best checkpoint if one exists (Drive preferred over local).
    Prefers food101_resume.pt (written every epoch) over food101_best.pt so
    that the most recent training state is always restored.
    Returns (start_phase, start_epoch, best_top1, history) where:
      start_phase  "warmup" | "finetune"
      start_epoch  0-based epoch index to resume from within that phase
    """
    # Prefer resume checkpoint (written every epoch) for training continuation;
    # fall back to best checkpoint (written only on accuracy improvement).
    ckpt = None
    for fname in ("food101_resume.pt", "food101_best.pt"):
        drive_path = (DRIVE_DIR / fname) if DRIVE_DIR is not None and DRIVE_DIR.exists() else None
        local_path = MODEL_DIR / fname
        if drive_path is not None and drive_path.exists():
            ckpt = drive_path
            break
        if local_path.exists():
            ckpt = local_path
            break
    if ckpt is None:
        print("  No checkpoint found — starting from scratch.")
        return "warmup", 0, 0.0, []

    print(f"  Loading checkpoint: {ckpt}")
    state = torch.load(ckpt, map_location=DEVICE)
    model.load_state_dict(state["model_state_dict"])

    phase      = state.get("phase", "finetune")
    epoch      = state.get("epoch", 0)
    best_top1  = state.get("val_top1", 0.0)
    history    = state.get("history", [])

    # Restore optimiser + scheduler only if we're resuming mid-phase
    if phase == "warmup" and opt_warmup is not None:
        opt_warmup.load_state_dict(state["opt_state_dict"])
        if sched_warmup is not None:
            sched_warmup.load_state_dict(state["sched_state_dict"])
    elif phase == "finetune" and opt_finetune is not None:
        opt_finetune.load_state_dict(state["opt_state_dict"])
        if sched_finetune is not None:
            sched_finetune.load_state_dict(state["sched_state_dict"])

    # epoch is the LAST COMPLETED epoch (0-based), so resume from epoch+1
    resume_from = epoch + 1
    print(f"  Resumed: phase={phase}, next epoch={resume_from + 1}, "
          f"best val top1={best_top1:.1f}%")
    return phase, resume_from, best_top1, history


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

    _try_mount_drive()
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # Load Food-101 (downloads ~5 GB on first run)
    train_ds = datasets.Food101(DATA_DIR, split="train", download=True,
                                transform=TRAIN_TRANSFORM)
    test_ds  = datasets.Food101(DATA_DIR, split="test",  download=False,
                                transform=VAL_TRANSFORM)

    val_size = int(0.1 * len(train_ds))
    train_ds, val_ds = random_split(train_ds, [len(train_ds) - val_size, val_size])

    print(f"Train: {len(train_ds)} | Val: {len(val_ds)} | Test: {len(test_ds)}")

    pin = DEVICE.type == "cuda"
    dl_kwargs = dict(num_workers=NUM_WORKERS, pin_memory=pin, persistent_workers=NUM_WORKERS > 0)

    warmup_train_ds = datasets.Food101(DATA_DIR, split="train", download=False,
                                       transform=WARMUP_TRAIN_TRANSFORM)
    warmup_val_ds   = datasets.Food101(DATA_DIR, split="test",  download=False,
                                       transform=WARMUP_VAL_TRANSFORM)
    warmup_train_loader = DataLoader(warmup_train_ds, BATCH_SIZE, shuffle=True,  **dl_kwargs)
    warmup_val_loader   = DataLoader(warmup_val_ds,   BATCH_SIZE, shuffle=False, **dl_kwargs)

    train_loader = DataLoader(train_ds, BATCH_SIZE, shuffle=True,  **dl_kwargs)
    val_loader   = DataLoader(val_ds,   BATCH_SIZE, shuffle=False, **dl_kwargs)
    test_loader  = DataLoader(test_ds,  BATCH_SIZE, shuffle=False, **dl_kwargs)

    model     = build_model(101)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler    = GradScaler(enabled=DEVICE.type == "cuda")

    # Build both optimisers/schedulers before loading checkpoint so their
    # state dicts can be restored in _load_checkpoint.
    freeze_backbone(model)
    opt_warmup = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=1e-3, weight_decay=1e-4,
    )
    sched_warmup = torch.optim.lr_scheduler.OneCycleLR(
        opt_warmup, max_lr=1e-3, epochs=3, steps_per_epoch=len(warmup_train_loader),
    )

    unfreeze_all(model)
    opt_finetune = torch.optim.AdamW([
        {"params": model.features.parameters(),   "lr": 5e-5},
        {"params": model.classifier.parameters(), "lr": 5e-4},
    ], weight_decay=1e-4)
    sched_finetune = torch.optim.lr_scheduler.CosineAnnealingLR(
        opt_finetune, T_max=FINETUNE_EPOCHS, eta_min=1e-6,
    )

    # ── Resume from checkpoint if one exists ─────────────────────────────────
    print("\n--- Checkpoint check ---")
    start_phase, start_epoch, best_top1, history = _load_checkpoint(
        model,
        opt_warmup=opt_warmup,   sched_warmup=sched_warmup,
        opt_finetune=opt_finetune, sched_finetune=sched_finetune,
    )

    # Phase A — warmup (classifier only, 3 epochs @ 224px)
    if start_phase == "warmup":
        print(f"\n--- Warmup: classifier only (3 epochs @ 224px) ---")
        if start_epoch > 0:
            print(f"    Resuming warmup from epoch {start_epoch + 1}/3")
        freeze_backbone(model)
        for epoch in range(start_epoch, 3):
            desc = f"WU {epoch+1}/3"
            tl, ta = train_epoch(model, warmup_train_loader, opt_warmup, criterion,
                                 scaler, desc=desc, sched=sched_warmup,
                                 sched_per_batch=True)
            vm = evaluate(model, warmup_val_loader, criterion, desc="val")
            print(f"  {desc} | train {ta:.1f}% | val {vm['top1']:.1f}%")
            if vm["top1"] > best_top1:
                best_top1 = vm["top1"]
            _save_checkpoint(model, opt_warmup, sched_warmup, epoch, best_top1,
                             "warmup", history)
        # Warmup complete — Phase B will start from epoch 0
        start_phase = "finetune"
        start_epoch = 0

    # Phase B — full fine-tune (FINETUNE_EPOCHS epochs)
    print(f"\n--- Full fine-tune ({FINETUNE_EPOCHS} epochs) ---")
    if start_epoch > 0:
        print(f"    Resuming fine-tune from epoch {start_epoch + 1}/{FINETUNE_EPOCHS}")
    unfreeze_all(model)

    for epoch in range(start_epoch, FINETUNE_EPOCHS):
        t0   = time.time()
        desc = f"Ep {epoch+1:02d}/{FINETUNE_EPOCHS}"
        tl, ta = train_epoch(model, train_loader, opt_finetune, criterion,
                             scaler, desc=desc)
        sched_finetune.step()
        vm      = evaluate(model, val_loader, criterion, desc="val")
        elapsed = time.time() - t0

        print(f"  Epoch {epoch+1:02d}/{FINETUNE_EPOCHS} | train {ta:.1f}% | "
              f"val top1 {vm['top1']:.1f}% top5 {vm['top5']:.1f}% | {elapsed:.0f}s")

        history.append({"epoch": epoch + 1, **vm, "train_acc": ta})

        # Always save resume checkpoint so a runtime reset loses no progress
        _save_checkpoint(model, opt_finetune, sched_finetune, epoch,
                         best_top1, "finetune", history,
                         filename="food101_resume.pt")

        # Separately track the best-accuracy model for inference
        if vm["top1"] > best_top1:
            best_top1 = vm["top1"]
            _save_checkpoint(model, opt_finetune, sched_finetune, epoch,
                             best_top1, "finetune", history,
                             filename="food101_best.pt")

    # Save class list
    classes = datasets.Food101(DATA_DIR, split="train").classes
    classes_path = MODEL_DIR / "food101_classes.json"
    with open(classes_path, "w") as f:
        json.dump(classes, f)
    if DRIVE_DIR is not None and DRIVE_DIR.exists():
        import shutil
        shutil.copy2(classes_path, DRIVE_DIR / "food101_classes.json")

    # Final test evaluation
    print("\n=== Final Test Evaluation ===")
    test_m = evaluate(model, test_loader, criterion, desc="test")
    print(f"Test Top-1: {test_m['top1']:.1f}%")
    print(f"Test Top-5: {test_m['top5']:.1f}%")
    print(f"\nTarget: Top-1 > 85%, Top-5 > 95%")

    history_path = MODEL_DIR / "food101_history.json"
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    if DRIVE_DIR is not None and DRIVE_DIR.exists():
        import shutil
        shutil.copy2(history_path, DRIVE_DIR / "food101_history.json")

    del train_loader, val_loader, test_loader
    del warmup_train_loader, warmup_val_loader
    if DEVICE.type == "cuda":
        torch.cuda.empty_cache()

    print("\nTraining complete.")
    print(f"  Checkpoint: {_ckpt_path()}")
    print(f"  Classes:    {MODEL_DIR / 'food101_classes.json'}")


if __name__ == "__main__":
    main()
