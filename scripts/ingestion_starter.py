"""
J&K Water-Stress / Mandi-Price Early Warning — Ingestion Starter
==================================================================

This is a scaffold, not a finished pipeline. It gives you:
  1. A data schema for the two feeds (groundwater + mandi prices)
  2. A WORKING sample call to the Agmarknet/data.gov.in API (real, documented)
  3. An HONEST stub for India-WRIS (no stable public API — needs a
     reverse-engineered call, see notes below)
  4. A basic z-score "water stress index" function to get you started

------------------------------------------------------------------
DATA SCHEMA
------------------------------------------------------------------

Table: groundwater_readings
    station_id      TEXT      -- CGWB DWLR station code
    district        TEXT      -- e.g. "Anantnag", "Shopian", "Baramulla"
    state           TEXT      -- "Jammu and Kashmir"
    lat, lon        FLOAT
    timestamp       DATETIME  -- reading is transmitted ~every 6 hours
    water_level_m   FLOAT     -- depth to water level, metres below ground
    source          TEXT      -- "CGWB_DWLR"

Table: mandi_prices
    market          TEXT      -- APMC market name, e.g. "Sopore", "Pampore"
    district        TEXT
    state           TEXT
    commodity       TEXT      -- "Apple", "Saffron"
    variety         TEXT      -- optional, e.g. "Delicious", "Kesar"
    arrival_date    DATE
    arrivals_qtl    FLOAT     -- quantity arrived, in quintals
    min_price       FLOAT     -- Rs per quintal
    max_price       FLOAT
    modal_price     FLOAT
    source          TEXT      -- "AGMARKNET"

Table: water_stress_index (derived)
    district        TEXT
    period          DATE      -- weekly or monthly bucket
    water_level_z   FLOAT     -- z-score vs. 5-yr seasonal baseline
    rainfall_z      FLOAT     -- optional, from IMD, to separate
                                 drought-driven vs extraction-driven decline
    stress_label    TEXT      -- "normal" / "watch" / "stress" / "severe"
"""

import requests
from datetime import date
from statistics import mean, pstdev


# ------------------------------------------------------------------
# 1. AGMARKNET / data.gov.in — real, documented, works today
# ------------------------------------------------------------------
# Resource: "Variety-wise Daily Market Prices Data of Commodity"
# Register for a free API key at https://data.gov.in/user/register
# then look up the current resource_id for this dataset on data.gov.in —
# resource ids occasionally get reissued, so confirm it on the portal
# rather than trusting a hardcoded value long-term.

AGMARKNET_BASE_URL = "https://api.data.gov.in/resource/{resource_id}"

def fetch_mandi_prices(api_key: str, resource_id: str, state: str,
                        commodity: str, limit: int = 100) -> list[dict]:
    """
    Pull daily mandi price records filtered by state + commodity.
    Returns a list of raw record dicts as given by the API.
    """
    url = AGMARKNET_BASE_URL.format(resource_id=resource_id)
    params = {
        "api-key": api_key,
        "format": "json",
        "limit": limit,
        "filters[state]": state,
        "filters[commodity]": commodity,
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    payload = resp.json()
    return payload.get("records", [])


# Example usage (once you have a key + confirmed resource_id):
#
# records = fetch_mandi_prices(
#     api_key="YOUR_KEY",
#     resource_id="CONFIRM_ON_DATA_GOV_IN",
#     state="Jammu and Kashmir",
#     commodity="Apple",
# )
# for r in records:
#     print(r["market"], r["arrival_date"], r["modal_price"])


# ------------------------------------------------------------------
# 2. CGWB DWLR / India-WRIS — no stable public REST API
# ------------------------------------------------------------------
# India-WRIS (indiawris.gov.in) is a portal, not a documented open API.
# The DWLR data is technically reachable because the portal's own
# frontend calls internal endpoints to populate its dropdowns and
# charts — several open-source scrapers do exactly this (search
# GitHub for "WRIS extractor" / "DWLR scraper" for working examples
# of the request sequence: state -> district -> station -> data).
#
# For the hackathon, treat this as a two-step task:
#   (a) Open India-WRIS in a browser, use devtools Network tab while
#       selecting Jammu & Kashmir -> a district -> a DWLR station,
#       and capture the actual XHR/fetch calls it makes.
#   (b) Replicate those calls here with `requests`, respecting the
#       portal's terms of use and rate limits.
#
# Below is the SHAPE of what that function should look like once you've
# captured the real endpoint — don't ship this URL as-is, confirm it first.

def fetch_dwlr_readings_STUB(station_id: str, start: date, end: date) -> list[dict]:
    """
    Placeholder — replace `endpoint` and `params` with the real values
    captured from India-WRIS devtools before using this.
    """
    raise NotImplementedError(
        "Capture the real India-WRIS internal API call via browser devtools "
        "for a J&K DWLR station, then fill this in. Do not guess the URL."
    )


# ------------------------------------------------------------------
# 3. Water Stress Index — minimal starting point
# ------------------------------------------------------------------

def water_stress_zscore(current_level: float, historical_levels: list[float]) -> float:
    """
    Positive z-score = water table lower (worse) than seasonal average.
    `historical_levels` should be same-season readings from prior years
    for the same station/district, not a mixed-season pool.
    """
    if len(historical_levels) < 3:
        raise ValueError("Need at least 3 years of same-season history for a meaningful baseline")
    mu = mean(historical_levels)
    sigma = pstdev(historical_levels) or 1e-6
    return (current_level - mu) / sigma


def classify_stress(z: float) -> str:
    if z < 0.5:
        return "normal"
    elif z < 1.0:
        return "watch"
    elif z < 2.0:
        return "stress"
    else:
        return "severe"
