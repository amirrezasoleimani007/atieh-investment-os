#!/usr/bin/env python3
"""Independent 77-row reconciliation for the governed Strategic Fit model 2.2."""

from __future__ import annotations

import argparse
import json
import math
import re
import statistics
import unicodedata
from pathlib import Path

from openpyxl import load_workbook


def clean(value: object) -> str:
    text = unicodedata.normalize("NFKC", "" if value is None else str(value))
    text = text.replace("ي", "ی").replace("ك", "ک").replace("\u200c", " ")
    return re.sub(r"\s+", " ", text).strip()


def number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def records(ws, header_row: int, first_row: int, last_row: int, max_col: int) -> dict[int, dict[str, object]]:
    headers = [clean(ws.cell(header_row, column).value) for column in range(1, max_col + 1)]
    result = {}
    for row in ws.iter_rows(min_row=first_row, max_row=last_row, max_col=max_col, values_only=True):
        record = {header: value for header, value in zip(headers, row, strict=True) if header}
        row_id = number(record.get("ردیف"))
        if row_id is not None:
            result[int(row_id)] = record
    return result


def display_y(raw: float) -> float:
    if raw <= 2.25:
        value = 0.5 + 3 * raw / 2.25
    elif raw <= 3.5:
        value = 3.5 + 3 * (raw - 2.25) / 1.25
    else:
        value = 6.5 + 3 * (min(raw, 8.4) - 3.5) / 4.9
    return min(max(value, 0.5), 9.5)


def midrank(values: list[float], current: float, low: float = 1, width: float = 8) -> float:
    if len(values) <= 1:
        return low + width / 2
    less = sum(value < current - 1e-12 for value in values)
    equal = sum(abs(value - current) < 1e-12 for value in values)
    return low + width * (less + 0.5 * (equal - 1)) / (len(values) - 1)


def ranks(values: list[float]) -> list[float]:
    return [sum(other < value - 1e-12 for other in values) + (sum(abs(other - value) < 1e-12 for other in values) + 1) / 2 for value in values]


def correlation(left: list[float], right: list[float]) -> float:
    left_mean, right_mean = statistics.mean(left), statistics.mean(right)
    numerator = sum((x - left_mean) * (y - right_mean) for x, y in zip(left, right, strict=True))
    denominator = math.sqrt(sum((x - left_mean) ** 2 for x in left) * sum((y - right_mean) ** 2 for y in right))
    return numerator / denominator


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--io-workbook", type=Path, required=True)
    parser.add_argument("--site-root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    fit_values = load_workbook(args.workbook, data_only=True)
    fit_formulas = load_workbook(args.workbook, data_only=False)
    io_values = load_workbook(args.io_workbook, data_only=True)
    io_formulas = load_workbook(args.io_workbook, data_only=False)
    opportunities = json.loads((args.site_root / "public/data/opportunities.json").read_text(encoding="utf-8"))
    relatedness = json.loads((args.site_root / "public/data/opportunity-relatedness.json").read_text(encoding="utf-8"))

    fit_rows = records(fit_values["محاسبات Fit"], 3, 6, 82, 21)
    extra_rows = records(fit_values["تحلیل تکمیلی"], 4, 5, 81, 16)
    io_rows = records(io_values["خروجی IO"], 3, 4, 80, 16)
    network_rows = records(io_values["شبکه Transform 77"], 3, 4, 80, 81)
    issues: list[dict[str, object]] = []
    maximum_error: dict[str, float] = {}

    def compare_numeric(field: str, row_id: int, expected: object, actual: object, tolerance: float = 1e-10) -> None:
        expected_number, actual_number = number(expected), number(actual)
        error = math.inf if expected_number is None or actual_number is None else abs(expected_number - actual_number)
        maximum_error[field] = max(maximum_error.get(field, 0), error)
        if error > tolerance:
            issues.append({"row": row_id, "field": field, "expected": expected, "actual": actual, "absoluteError": error})

    def compare_text(field: str, row_id: int, expected: object, actual: object) -> None:
        if clean(expected) != clean(actual):
            issues.append({"row": row_id, "field": field, "expected": expected, "actual": actual})

    if len(opportunities) != 77 or set(fit_rows) != set(range(1, 78)) or set(io_rows) != set(range(1, 78)):
        issues.append({"row": 0, "field": "row-count", "expected": 77, "actual": len(opportunities)})

    field_map = {
        "opportunityRaw": "TOPSIS خام",
        "xPlotBaseline": "X نمودار – مقیاس کشیده",
        "coreFit": "Fit هسته بازرگانی فولاد",
        "adjacentFit": "Adjacent Fit",
        "transformFit": "Transform Fit – Network Density",
        "yRawBaseline": "Y خام مبنا",
        "yPlotBaseline": "Y نمودار مبنا – مقیاس کشیده",
    }
    adjacent_map = {
        "downstream": "Eff پایین دستی",
        "financeDirect": "Eff مالی مستقیم",
        "mineral": "Eff معدنی",
        "steelSupport": "Eff جانبی",
        "paint": "Eff رنگ",
    }
    io_map = {
        "financeEnablement": "توانمندسازی مالی",
        "verticalTrade": "Vertical تجارت",
        "verticalSteel": "Vertical فولاد",
        "verticalAdjacent": "Vertical مجاور",
        "leontiefTotal": "Leontief کل زنجیره",
    }
    extra_numeric = {
        "closeness": "Closeness 1", "secondCloseness": "Closeness 2", "gap": "Gap",
        "synergy": "Synergy Potential Index", "optionalityRaw": "Optionality Raw", "optionality": "Optionality Index",
    }

    for row in opportunities:
        row_id = row["id"]
        fit, extra, io = fit_rows[row_id], extra_rows[row_id], io_rows[row_id]
        compare_text("name", row_id, fit["بخش"], row["name"])
        for field, header in field_map.items():
            compare_numeric(field, row_id, fit[header], row[field])
        for field, header in adjacent_map.items():
            compare_numeric(f"adjacentEffective.{field}", row_id, fit[header], row["adjacentEffective"][field])
        for field, header in io_map.items():
            compare_numeric(field, row_id, io[header], row[field])
        compare_numeric("ioCode", row_id, io["کد IO"], row["ioCode"])
        compare_text("adjacentDriver", row_id, io["مسیر مجاور غالب"], row["adjacentDriver"])
        for field, header in extra_numeric.items():
            compare_numeric(field, row_id, extra[header], row[field], 2e-10)
        for field, header in (("closest", "نزدیک ترین بخش پرتفوی"), ("secondClosest", "دومین بخش نزدیک"), ("synergyPair", "Synergy Pair")):
            compare_text(field, row_id, extra[header], row[field])
        expected_paths = [clean(extra[f"مسیر بعدی {index}"]) for index in (1, 2, 3)]
        if expected_paths != [clean(value) for value in row["nextPaths"]]:
            issues.append({"row": row_id, "field": "nextPaths", "expected": expected_paths, "actual": row["nextPaths"]})

    # Anchor mapping must come from the governed mapping sheet.
    anchor_ws = io_values["نگاشت ماهیت به IO"]
    anchors = [(clean(anchor_ws.cell(row, 1).value), int(anchor_ws.cell(row, 3).value), number(anchor_ws.cell(row, 5).value)) for row in range(4, 11)]
    expected_anchors = [
        ("خدمات بازرگانی", 41, 0.9), ("خدمات بازرگانی", 49, 0.9), ("پایین دستی فولاد", 24, 0.8),
        ("خدمات مالی", 56, 0.8), ("کانی غیرفلزی", 8, 1.0), ("صنایع جانبی زنجیره فولاد", 25, 1.0), ("رنگ صنعتی", 20, 0.6),
    ]
    if anchors != expected_anchors:
        issues.append({"row": 0, "field": "anchor-mapping", "expected": expected_anchors, "actual": anchors})

    # Reconcile the full 77x77 matrix against both source workbooks.
    fit_network = fit_values["تحلیل تکمیلی"]
    destination_names = [clean(io_values["شبکه Transform 77"].cell(3, column).value) for column in range(5, 82)]
    for source_id in range(1, 78):
        frontier = number(network_rows[source_id]["وزن مرز عملیاتی"])
        compare_numeric("frontierWeight", source_id, max(
            opportunities[source_id - 1]["adjacentEffective"][key] for key in ("downstream", "mineral", "steelSupport", "paint")
        ) / 10, frontier)
        relation_row = relatedness["matrix"][source_id - 1]
        for destination_id, destination_name in enumerate(destination_names, start=1):
            actual = relation_row[destination_id - 1]
            compare_numeric("relatedness.io", source_id, network_rows[source_id][destination_name], actual)
            compare_numeric("relatedness.fit", source_id, fit_network.cell(source_id + 4, destination_id + 29).value, actual)
        denominator = sum(relation_row)
        density = 10 * sum(relation * number(network_rows[destination_id]["وزن مرز عملیاتی"]) for destination_id, relation in enumerate(relation_row, start=1)) / denominator
        compare_numeric("transformDensity", source_id, density, opportunities[source_id - 1]["transformFit"])

    # Independent baseline TOPSIS display, Y, capability ranking, synergy, Optionality and routes.
    topsis = [row["opportunityRaw"] for row in opportunities]
    x_values = [row["xPlotBaseline"] for row in opportunities]
    for row in opportunities:
        rank = 1 + sum(value > row["opportunityRaw"] for value in topsis)
        compare_numeric("x-recalculation", row["id"], 0.5 + 9 * (77 - rank) / 76, row["xPlotBaseline"])
        adjacent = max(row["adjacentEffective"].values())
        compare_numeric("adjacent-recalculation", row["id"], adjacent, row["adjacentFit"])
        raw = 0.6 * row["coreFit"] + 0.3 * row["adjacentFit"] + 0.1 * row["transformFit"]
        compare_numeric("baseline-y-raw", row["id"], raw, row["yRawBaseline"])
        compare_numeric("baseline-y-plot", row["id"], display_y(raw), row["yPlotBaseline"])
        capability_values = [row["coreFit"], *row["adjacentEffective"].values()]
        ordered = sorted(enumerate(capability_values), key=lambda item: (-item[1], item[0]))
        compare_numeric("synergy-recalculation", row["id"], math.sqrt(ordered[0][1] * ordered[1][1]), row["synergy"])

    optionality_raw = []
    route_paths = []
    for source_index, row in enumerate(opportunities):
        relation_row = relatedness["matrix"][source_index]
        raw = sum(relation * x / 90 for relation, x in zip(relation_row, x_values, strict=True))
        optionality_raw.append(raw)
        routes = sorted(
            ((relation * x / 90 + destination_id / 1_000_000_000, destination_id) for destination_id, (relation, x) in enumerate(zip(relation_row, x_values, strict=True), start=1)),
            reverse=True,
        )
        route_paths.append([opportunities[destination_id - 1]["name"] for _, destination_id in routes[:3]])
        compare_numeric("optionality-raw-recalculation", row["id"], raw, row["optionalityRaw"], 2e-10)
        if [clean(value) for value in route_paths[-1]] != [clean(value) for value in row["nextPaths"]]:
            issues.append({"row": row["id"], "field": "route-recalculation", "expected": route_paths[-1], "actual": row["nextPaths"]})
    for row, raw in zip(opportunities, optionality_raw, strict=True):
        compare_numeric("optionality-index-recalculation", row["id"], midrank(optionality_raw, raw), row["optionality"])

    scenarios = {
        "80/10/10": ((0.8, 0.1, 0.1), 0.9622730798049243, 0.31746182188945365, 15),
        "30/60/10": ((0.3, 0.6, 0.1), 0.9764699696344301, 0.47619273283418034, 21),
        "20/20/60": ((0.2, 0.2, 0.6), 0.9565943238731218, 0.5879716820130825, 40),
        "10/10/80": ((0.1, 0.1, 0.8), 0.894469785600673, 0.782269571298004, 51),
    }
    baseline_raw = [row["yRawBaseline"] for row in opportunities]
    baseline_ranks = ranks(baseline_raw)
    scenario_results = {}
    for name, (weights, expected_rho, expected_mean, expected_moved) in scenarios.items():
        raw = [sum(weight * score for weight, score in zip(weights, (row["coreFit"], row["adjacentFit"], row["transformFit"]), strict=True)) for row in opportunities]
        movement = [abs(value - baseline) for value, baseline in zip(raw, baseline_raw, strict=True)]
        rho, mean_movement = correlation(baseline_ranks, ranks(raw)), statistics.mean(movement)
        moved = sum(value >= 0.5 - 1e-12 for value in movement)
        scenario_results[name] = {"spearman": rho, "meanAbsoluteRawMovement": mean_movement, "movedAtLeast0.5": moved, "rawRange": [min(raw), max(raw)]}
        if abs(rho - expected_rho) > 1e-10 or abs(mean_movement - expected_mean) > 1e-10 or moved != expected_moved:
            issues.append({"row": 0, "field": f"scenario-{name}", "expected": [expected_rho, expected_mean, expected_moved], "actual": [rho, mean_movement, moved]})

    formula_errors = []
    for formula_book, value_book in ((fit_formulas, fit_values), (io_formulas, io_values)):
        for sheet_name in formula_book.sheetnames:
            for row in formula_book[sheet_name].iter_rows():
                for cell in row:
                    if isinstance(cell.value, str) and cell.value.startswith("="):
                        cached = value_book[sheet_name][cell.coordinate].value
                        if isinstance(cached, str) and cached.startswith("#"):
                            formula_errors.append(f"{sheet_name}!{cell.coordinate}:{cached}")

    y_raw = sorted(row["yRawBaseline"] for row in opportunities)
    y_plot = sorted(row["yPlotBaseline"] for row in opportunities)
    x_sorted = sorted(x_values)
    acceptance = {
        "xRangeMedian": [x_sorted[0], x_sorted[38], x_sorted[-1]],
        "yRawRangeMedian": [y_raw[0], y_raw[38], y_raw[-1]],
        "yPlotRangeMedian": [y_plot[0], y_plot[38], y_plot[-1]],
        "xDistribution": {
            "low": sum(value < 3.5 for value in x_values), "medium": sum(3.5 <= value < 6.5 for value in x_values), "high": sum(value >= 6.5 for value in x_values),
        },
        "yRawDistribution": {
            "low": sum(value < 2.25 for value in baseline_raw), "medium": sum(2.25 <= value < 3.5 for value in baseline_raw), "high": sum(value >= 3.5 for value in baseline_raw),
        },
        "highHigh": sum(x >= 6.5 and y >= 3.5 for x, y in zip(x_values, baseline_raw, strict=True)),
        "scenarios": scenario_results,
    }
    if acceptance["xDistribution"] != {"low": 26, "medium": 25, "high": 26} or acceptance["yRawDistribution"] != {"low": 38, "medium": 25, "high": 14} or acceptance["highHigh"] != 7:
        issues.append({"row": 0, "field": "acceptance-distribution", "actual": acceptance})

    summary = {
        "model": "2.2",
        "workbook": str(args.workbook),
        "ioWorkbook": str(args.io_workbook),
        "rowsReconciled": len(opportunities),
        "relatednessCellsReconciledPerSource": 77 * 77,
        "formulaErrorCells": len(formula_errors),
        "formulaErrorExamples": formula_errors[:10],
        "maximumAbsoluteError": maximum_error,
        "acceptance": acceptance,
        "reconciliationIssues": len(issues),
        "issueExamples": issues[:20],
        "status": "PASS" if not issues and not formula_errors and all(math.isfinite(value) for value in maximum_error.values()) else "FAIL",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
