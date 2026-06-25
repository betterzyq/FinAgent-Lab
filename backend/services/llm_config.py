"""Resolve LLM provider and models from environment for the visualization backend."""

from __future__ import annotations

import os
from typing import Any

from backend import bootstrap  # noqa: F401 — dotenv + sys.path before tradingagents
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# When provider is switched away from OpenAI, replace leftover GPT defaults.
_OPENAI_MODEL_PREFIXES = ("gpt-", "o1", "o3", "o4")

# Stable priority when multiple provider keys are present.
_PROVIDER_DETECT_ORDER = (
    "deepseek",
    "openai",
    "google",
    "anthropic",
    "xai",
    "qwen",
    "qwen-cn",
    "glm",
    "glm-cn",
    "minimax",
    "minimax-cn",
    "openrouter",
    "groq",
    "mistral",
    "kimi",
    "nvidia",
)


def _ta():
    """Lazy import TradingAgents after bootstrap."""
    from tradingagents.default_config import DEFAULT_CONFIG, _ENV_OVERRIDES, _coerce
    from tradingagents.llm_clients.api_key_env import PROVIDER_API_KEY_ENV
    from tradingagents.llm_clients.model_catalog import MODEL_OPTIONS

    return DEFAULT_CONFIG, _ENV_OVERRIDES, _coerce, PROVIDER_API_KEY_ENV, MODEL_OPTIONS


def _apply_env_overrides(config: dict[str, Any]) -> dict[str, Any]:
    """Re-apply TRADINGAGENTS_* env vars at runtime."""
    DEFAULT_CONFIG, _ENV_OVERRIDES, _coerce, _, _ = _ta()
    for env_var, key in _ENV_OVERRIDES.items():
        raw = os.environ.get(env_var)
        if raw is None or raw == "":
            continue
        config[key] = _coerce(raw, DEFAULT_CONFIG.get(key))
    return config


def _normalize_key(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().strip("'\"")


def _has_api_key(provider: str) -> bool:
    _, _, _, PROVIDER_API_KEY_ENV, _ = _ta()
    env_var = PROVIDER_API_KEY_ENV.get(provider.lower())
    if not env_var:
        return False
    return bool(_normalize_key(os.environ.get(env_var)))


def _detect_provider_from_env() -> str | None:
    for provider in _PROVIDER_DETECT_ORDER:
        if _has_api_key(provider):
            return provider
    return None


def _looks_like_openai_model(model: str) -> bool:
    lower = model.lower()
    return any(lower.startswith(prefix) for prefix in _OPENAI_MODEL_PREFIXES)


def _default_models_for_provider(provider: str) -> tuple[str, str]:
    _, _, _, _, MODEL_OPTIONS = _ta()
    modes = MODEL_OPTIONS.get(provider.lower(), {})
    quick_opts = modes.get("quick") or [("Custom model ID", "custom")]
    deep_opts = modes.get("deep") or [("Custom model ID", "custom")]
    quick = quick_opts[0][1]
    deep = deep_opts[0][1]
    if quick == "custom":
        quick = deep
    return quick, deep


def resolve_llm_config(
    *,
    llm_provider: str | None = None,
    quick_model: str | None = None,
    deep_model: str | None = None,
) -> dict[str, Any]:
    """Build TradingAgents config with env overrides and provider auto-detection."""
    DEFAULT_CONFIG, _, _, _, _ = _ta()
    config = DEFAULT_CONFIG.copy()
    _apply_env_overrides(config)

    if llm_provider:
        config["llm_provider"] = llm_provider.lower()
    if quick_model:
        config["quick_think_llm"] = quick_model
    if deep_model:
        config["deep_think_llm"] = deep_model

    provider = str(config.get("llm_provider", "openai")).lower()

    # Current provider has no key → pick any provider that does (e.g. DeepSeek-only .env).
    if not _has_api_key(provider):
        detected = _detect_provider_from_env()
        if detected:
            logger.info(
                "LLM provider switched to '%s' (no API key for '%s')",
                detected,
                provider,
            )
            config["llm_provider"] = detected
            provider = detected
        else:
            _, _, _, PROVIDER_API_KEY_ENV, _ = _ta()
            env_name = PROVIDER_API_KEY_ENV.get(provider, "API key")
            logger.error("No API key for provider '%s' (%s)", provider, env_name)

    if provider != "openai" and not quick_model and not deep_model:
        quick, deep = config["quick_think_llm"], config["deep_think_llm"]
        if _looks_like_openai_model(quick) or _looks_like_openai_model(deep):
            new_quick, new_deep = _default_models_for_provider(provider)
            if _looks_like_openai_model(quick):
                config["quick_think_llm"] = new_quick
            if _looks_like_openai_model(deep):
                config["deep_think_llm"] = new_deep
            logger.info(
                "Using %s models: quick=%s, deep=%s",
                provider,
                config["quick_think_llm"],
                config["deep_think_llm"],
            )

    return config


def get_resolved_llm_summary() -> dict[str, str]:
    """Return resolved provider/models for health checks."""
    cfg = resolve_llm_config()
    return {
        "llm_provider": str(cfg.get("llm_provider", "")),
        "quick_think_llm": str(cfg.get("quick_think_llm", "")),
        "deep_think_llm": str(cfg.get("deep_think_llm", "")),
        "deepseek_key_set": str(_has_api_key("deepseek")),
        "openai_key_set": str(_has_api_key("openai")),
    }
