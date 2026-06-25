"""Load .env and optional local agent-engine path before importing tradingagents."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

_WORKSPACE_ROOT = Path(__file__).resolve().parents[1]

# Project-level secrets (preferred for FinAgent-Lab deployments).
load_dotenv(_WORKSPACE_ROOT / ".env", override=False)

# Optional local editable engine checkouts (gitignored): agent-engine/ or legacy folder name.
_ENGINE_DIR_NAMES = ("agent-engine", "TradingAgents")
for _name in _ENGINE_DIR_NAMES:
    _engine_root = _WORKSPACE_ROOT / _name
    _env_file = _engine_root / ".env"
    if _env_file.is_file():
        load_dotenv(_env_file, override=False)
    if _engine_root.is_dir() and (_engine_root / "tradingagents").is_dir():
        root = str(_engine_root)
        if root not in sys.path:
            sys.path.insert(0, root)
