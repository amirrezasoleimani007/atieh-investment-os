"""Extract only the governed analytical fields from master data(2).xlsx."""
from pathlib import Path
import json
import openpyxl

SOURCE = Path(__file__).resolve().parents[2] / "upload" / "master data(2).xlsx"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "data" / "movement-master-data.json"
# Central source adapter: names verified against sheet 02_unido_subsector_master_with_.
FIELD_MAP = {
    "economicSize": "value_added_usd_latest",
    "valueCreation": "va_output_ratio",
    "investment": "gfcf_va_ratio",
    "productivity": "va_per_employee_usd",
    "employmentGrowth": "employees_cagr",
    "firmGrowth": "establishments_cagr",
}
SHEET = "02_unido_subsector_master_with_"

book = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
sheet = book[SHEET]
rows = sheet.iter_rows(values_only=True)
headers = next(rows)
indices = {name: index for index, name in enumerate(headers)}
required = ["activity_code", "activity", "isic_level", "primary_sector_id", "primary_sector_name", "persian_examples_v15", "include_in_aggregation", "mapping_confidence", "data_quality", "core_analysis_readiness", "core_indicators_available_count", "first_year_available", "last_year_available", "latest_common_year", *FIELD_MAP.values()]
missing = [name for name in required if name not in indices]
if missing:
    raise SystemExit(f"Required source columns missing: {missing}")
records = []
for row in rows:
    if row[indices["activity_code"]] is None:
        continue
    def get(name):
        value = row[indices[name]]
        return value.item() if hasattr(value, "item") else value
    records.append({
        "code": str(get("activity_code")),
        "name": get("activity"),
        "isicLevel": get("isic_level"),
        "parentId": int(get("primary_sector_id")) if get("primary_sector_id") is not None else None,
        "parentName": get("primary_sector_name"),
        "persianExamples": [part.strip() for part in (get("persian_examples_v15") or "").split("|") if part.strip()],
        "include": bool(get("include_in_aggregation")),
        "mappingConfidence": get("mapping_confidence"),
        "quality": get("data_quality"),
        "readiness": get("core_analysis_readiness"),
        "availableIndicators": int(get("core_indicators_available_count") or 0),
        "dataPeriod": {
            "start": int(get("first_year_available")) if get("first_year_available") is not None else None,
            "end": int(get("last_year_available")) if get("last_year_available") is not None else None,
            "latestCommonYear": int(get("latest_common_year")) if get("latest_common_year") is not None else None,
        },
        "indicators": {key: get(column) for key, column in FIELD_MAP.items()},
    })
OUTPUT.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {len(records)} records to {OUTPUT}")
