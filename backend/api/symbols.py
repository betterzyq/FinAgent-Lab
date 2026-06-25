"""A-share symbol search API."""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/symbols", tags=["symbols"])

_CACHE: dict[str, Any] = {"rows": [], "loaded_at": 0.0}
_CACHE_TTL = 86400  # 24h


class SymbolItem(BaseModel):
    symbol: str
    display: str
    name: str
    market: str = "A股"


class SymbolSearchResponse(BaseModel):
    items: list[SymbolItem]


_MOCK_SYMBOLS: list[SymbolItem] = [
    SymbolItem(symbol="600519", display="600519.SS", name="贵州茅台", market="A股"),
    SymbolItem(symbol="000001", display="000001.SZ", name="平安银行", market="A股"),
    SymbolItem(symbol="000858", display="000858.SZ", name="五粮液", market="A股"),
    SymbolItem(symbol="601318", display="601318.SS", name="中国平安", market="A股"),
    SymbolItem(symbol="300750", display="300750.SZ", name="宁德时代", market="A股"),
]


def _load_symbol_table() -> list[SymbolItem]:
    now = time.time()
    if _CACHE["rows"] and now - _CACHE["loaded_at"] < _CACHE_TTL:
        return _CACHE["rows"]

    try:
        from tradingagents.dataflows.akshare_common import import_akshare

        ak = import_akshare()
        df = ak.stock_info_a_code_name()
        rows: list[SymbolItem] = []
        for _, row in df.iterrows():
            code = str(row.get("code", "")).zfill(6)
            name = str(row.get("name", "")).strip()
            if not code or not name:
                continue
            suffix = "SS" if code.startswith("6") else "SZ"
            rows.append(
                SymbolItem(
                    symbol=code,
                    display=f"{code}.{suffix}",
                    name=name,
                    market="A股",
                )
            )
        _CACHE["rows"] = rows
        _CACHE["loaded_at"] = now
        return rows
    except Exception as exc:  # noqa: BLE001
        logger.warning("AkShare symbol list unavailable, using mock data: %s", exc)
        return _MOCK_SYMBOLS


@router.get("/search", response_model=SymbolSearchResponse)
async def search_symbols(
    keyword: str = Query("", min_length=0, description="代码或名称关键词"),
    limit: int = Query(20, ge=1, le=50),
) -> SymbolSearchResponse:
    """Search A-share symbols by code prefix or name substring."""
    kw = keyword.strip()
    if not kw:
        return SymbolSearchResponse(items=_MOCK_SYMBOLS[:limit])

    table = _load_symbol_table()
    kw_lower = kw.lower()
    matches: list[SymbolItem] = []

    for item in table:
        if item.symbol.startswith(kw) or kw in item.name or kw_lower in item.name.lower():
            matches.append(item)
            if len(matches) >= limit:
                break

    if not matches:
        matches = _MOCK_SYMBOLS[:limit]
    return SymbolSearchResponse(items=matches)
