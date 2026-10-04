#!/usr/bin/env python3
"""Stage II figures from processed results only; no simulation or winner selection."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

matplotlib.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 8, "axes.titlesize": 9,
    "axes.labelsize": 8, "legend.fontsize": 6, "xtick.labelsize": 7,
    "ytick.labelsize": 7, "axes.linewidth": .65, "lines.linewidth": 1.2,
    "savefig.dpi": 240, "pdf.fonttype": 42, "ps.fonttype": 42,
    "axes.spines.top": False, "axes.spines.right": False,
})

STRATUM = ("experiment", "L", "k", "boundary", "initial_mode", "engine", "kinetic_kind")
COLORS = ("#1f77b4", "#e377c2", "#2ca02c", "#9467bd", "#ff7f0e", "#17becf")


def value(group, metric, field="mean"):
    return group["metrics"][metric][field]


def grouped(groups, fields):
    result = {}
    for group in groups:
        key = tuple(group[field] for field in fields)
        result.setdefault(key, []).append(group)
    return sorted(result.items(), key=lambda item: str(item[0]))


def filename(text):
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in str(text))


def save(fig, output, name, registry, interpretation):
    artifacts = []
    for extension in ("pdf", "png", "svg"):
        target = output / f"{name}.{extension}"
        fig.savefig(target, bbox_inches="tight")
        artifacts.append({"file": target.name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
    plt.close(fig)
    registry.append({"name": name, "artifacts": artifacts, "interpretation": interpretation})


def landscape(groups, output, registry):
    for stratum, samples in grouped(groups, STRATUM):
        alphas = sorted({g["alpha"] for g in samples})
        betas = sorted({g["beta"] for g in samples})
        if len(alphas) < 4 or len(betas) < 4:
            continue
        experiment, L, k, boundary, _, _, kinetic = stratum
        measures = [("coverage", r"$\langle\theta\rangle$", "viridis"),
                    ("abs_order", r"$\langle|S|\rangle$", "cividis"),
                    ("deadlock", "Deadlock probability", "magma"),
                    ("expected_attempts_per_particle" if kinetic == "conditional-expectation" else "actual_attempts_per_particle",
                     "Conditional expected attempts / rod" if kinetic == "conditional-expectation" else "Sampled attempts / rod", "plasma")]
        fig, axes = plt.subplots(1, 4, figsize=(10.8, 2.7), layout="constrained")
        for ax, (metric, label, cmap) in zip(axes, measures):
            measured = [(g, g["deadlock"]["rate"] if metric == "deadlock" else value(g, metric)) for g in samples]
            measured = [(g, v) for g, v in measured if v is not None and math.isfinite(v)]
            if not measured:
                ax.text(.5, .5, "Not measured", transform=ax.transAxes, ha="center")
            else:
                # Individual points: irregular refinements are never interpolated into a full grid.
                vals = np.array([v for _, v in measured])
                logkinetic = "attempts_per_particle" in metric
                shown = np.log10(np.maximum(vals, 1e-12)) if logkinetic else vals
                scatter = ax.scatter([g["alpha"] for g, _ in measured], [g["beta"] for g, _ in measured],
                                     c=shown, s=12 if len(samples) > 200 else 26, marker="s", cmap=cmap,
                                     vmin=0 if metric in ("abs_order", "deadlock") else None,
                                     vmax=1 if metric in ("abs_order", "deadlock") else None,
                                     linewidths=0, rasterized=True)
                fig.colorbar(scatter, ax=ax, label="log10 " + label if logkinetic else label, shrink=.85, pad=.025)
            ax.plot([0, 1], [0, 1], color="black", lw=.6, alpha=.6)
            ax.set(xlabel=r"$\alpha$ (flip after success)", ylabel=r"$\beta$ (flip after failure)",
                   xlim=(-.03, 1.03), ylim=(-.03, 1.03), title=label)
        fig.suptitle(f"{experiment}: L={L}, k={k}, {boundary}; fair initial H/V")
        save(fig, output, f"landscape-{filename(experiment)}-L{L}-k{k}-{boundary}", registry,
             "All measured points, no interpolation; diagonal is the outcome-independent null. Kinetic cost respects actual/conditional-expectation labels.")


def frontier(groups, records, output, registry):
    for stratum, samples in grouped(groups, STRATUM):
        if sum(g["temporalNull"] for g in samples) < 3:
            continue
        experiment, L, k, boundary, _, _, _ = stratum
        lookup = {g["controller"]: g for g in samples}
        selected = [r for r in records if all(str(r[f]) == str(samples[0][f]) for f in STRATUM)]
        fig, ax = plt.subplots(figsize=(4.5, 3.2), layout="constrained")
        feedback = [g for g in samples if not g["temporalNull"]]
        if feedback:
            scatter = ax.scatter([value(g, "abs_order") for g in feedback], [value(g, "coverage") for g in feedback],
                                 c=[g["alpha"] for g in feedback], s=12, cmap="viridis", alpha=.6, linewidths=0)
            fig.colorbar(scatter, ax=ax, label=r"Feedback $\alpha$", shrink=.8)
        nulls = [g for g in samples if g["temporalNull"]]
        ax.scatter([value(g, "abs_order") for g in nulls], [value(g, "coverage") for g in nulls],
                   marker="D", s=22, color="#222222", label="All tested temporal nulls")
        for field, color, label in (("on_sample_frontier", "#d95f02", "Sample feedback + null frontier"),
                                    ("on_null_sample_frontier", "#222222", "Sample null frontier")):
            members = sorted((lookup[r["controller"]] for r in selected if r.get(field) == "1"), key=lambda g: value(g, "abs_order"))
            if members:
                ax.plot([value(g, "abs_order") for g in members], [value(g, "coverage") for g in members],
                        color=color, lw=1.25, label=label)
        ax.set(xlabel=r"Run-wise anisotropy $\langle|S|\rangle$", ylabel=r"Terminal $\langle\theta\rangle$",
               title=f"{experiment}: L={L}, k={k}, {boundary}")
        ax.legend(loc="best", frameon=False)
        save(fig, output, f"frontier-{filename(experiment)}-L{L}-k{k}-{boundary}", registry,
             "All points retained. Frontiers connect exploratory noisy means only, with no claim about the parameter continuum.")


def finite_size(groups, output, registry):
    large = [g for g in groups if g["L"] >= 128 and "confirm" not in g["experiment"].lower()]
    for stratum, samples in grouped(large, ("experiment", "k", "boundary", "initial_mode", "engine", "kinetic_kind")):
        if len({g["L"] for g in samples}) < 2:
            continue
        experiment, k, boundary, _, _, _ = stratum
        arms = grouped(samples, ("controller", "alpha", "beta"))
        fig, axes = plt.subplots(1, 4, figsize=(10.0, 2.7), layout="constrained")
        for (controller, alpha, beta), arm in arms:
            arm.sort(key=lambda g: g["L"])
            for ax, metric, label in zip(axes, ("coverage", "abs_order", "order2", "order4"),
                                         (r"$\langle\theta\rangle$", r"$\langle|S|\rangle$", r"$\langle S^2\rangle$", r"$\langle S^4\rangle$")):
                means = np.array([value(g, metric) for g in arm])
                lows = [value(g, metric, "ciLow") for g in arm]
                highs = [value(g, metric, "ciHigh") for g in arm]
                errors = np.array([[mean - low if low is not None else 0 for mean, low in zip(means, lows)],
                                   [high - mean if high is not None else 0 for mean, high in zip(means, highs)]])
                ax.errorbar([g["L"] for g in arm], means, yerr=errors, marker="o", markersize=3,
                            capsize=2, label=f"{controller} ({alpha:g},{beta:g})")
                ax.set(xscale="log", xlabel="L", ylabel=label)
        axes[0].legend(frameon=False)
        fig.suptitle(f"{experiment}: k={k}, {boundary}; pointwise 95% t CIs; lines guide the eye")
        save(fig, output, f"finite-size-{filename(experiment)}-k{k}-{boundary}", registry,
             "Actual finite sizes and replicate counts only. No extrapolation or forced limit fit; CIs use independent lattice runs.")
        policy41 = [g for g in samples if abs(g["alpha"]) < 1e-12 and abs(g["beta"] - 1) < 1e-12]
        if policy41:
            policy41.sort(key=lambda g: g["L"])
            fig, axes = plt.subplots(1, len(policy41), figsize=(2.0 * len(policy41), 2.4), squeeze=False, layout="constrained")
            for ax, group in zip(axes[0], policy41):
                bins = group["signedDistribution"]["bins"]
                ax.bar([b["center"] for b in bins], [b["count"] / group["n"] for b in bins], width=.045, color="#2782a4")
                ax.axvline(0, color="#444444", lw=.6)
                ax.set(title=f"L={group['L']}, n={group['n']}", xlabel="Signed S", xlim=(-1.03, 1.03))
                ax.set_ylabel("Run fraction")
            fig.suptitle(f"Policy41 signed distributions: k={k}, {boundary}; fixed bins, no smoothing")
            save(fig, output, f"signed-S-{filename(experiment)}-k{k}-{boundary}", registry,
                 "Equal H/V ensemble means do not establish isotropy. Histogram is descriptive, not a formal bimodality test.")
            fig, ax = plt.subplots(figsize=(4.4, 3), layout="constrained")
            for group in policy41:
                x = np.array(group["signedDistribution"]["sorted"])
                y = np.arange(1, group["n"] + 1) / group["n"]
                epsilon = group["signedDistribution"]["dkwEpsilon"]
                line, = ax.step(x, y, where="post", label=f"L={group['L']}, n={group['n']}")
                ax.fill_between(x, np.maximum(0, y - epsilon), np.minimum(1, y + epsilon),
                                step="post", color=line.get_color(), alpha=.09)
            ax.set(xlabel="Signed S", ylabel="Empirical CDF", ylim=(0, 1), title=f"Policy41: k={k}; within-group 95% DKW bands")
            ax.legend(frameon=False)
            save(fig, output, f"signed-S-ecdf-{filename(experiment)}-k{k}-{boundary}", registry,
                 "Distribution bands are uniform within one policy/size group, not simultaneous over all plotted sizes.")


def confirmation(tests, output, registry):
    if not tests:
        return
    for metric in ("coverage", "abs_order"):
        selected = [t for t in tests if t["metric"] == metric]
        if not selected:
            continue
        fig, ax = plt.subplots(figsize=(7.2, max(2.4, .26 * len(selected) + 1.1)), layout="constrained")
        labels = []
        for i, result in enumerate(selected):
            labels.append(f"{result['controller']} - {result['baseline']}; L{result['L']}, k{result['k']}, n{result['n']}")
            mean, low, high = result["mean"], result["simultaneousCiLow"], result["simultaneousCiHigh"]
            if mean is None:
                continue
            if low is not None:
                ax.plot([low, high], [i, i], color="#777777", lw=1.1)
            ax.scatter([mean], [i], marker="o" if result["rejectAtAlpha"] else "s",
                       color="#1f77b4" if result["rejectAtAlpha"] else "#777777", s=22)
            if metric == "abs_order":
                ax.plot([result["nullDifference"]], [i], marker="|", color="#c44e52", markersize=9)
        ax.axvline(0, color="#333333", lw=.7)
        ax.set(yticks=np.arange(len(selected)), yticklabels=labels, xlabel="Paired mean difference",
               title=f"Locked {metric} contrasts; Bonferroni simultaneous CIs; circle = Holm rejection")
        ax.invert_yaxis()
        save(fig, output, f"locked-{metric}-effects", registry,
             "Fixed holdout family only. Noninferiority needs the one-sided margin test; positive coverage needs a positive effect and adjusted rejection.")


def finite_effects(effects, output, registry):
    for (experiment, k, boundary), samples in grouped(effects, ("experiment", "k", "boundary")):
        fig, axes = plt.subplots(1, 2, figsize=(6.5, 2.8), layout="constrained")
        for ax, metric, label in zip(axes, ("coverage", "abs_order"), (r"$\Delta\theta$", r"$\Delta\langle|S|\rangle$")):
            for p in (.5, 1):
                selected = sorted([e for e in samples if e["metric"] == metric and e["baseline_p"] == p], key=lambda e: e["L"])
                if not selected:
                    continue
                means = [e["mean"] for e in selected]
                errors = [[e["mean"] - e["ciLow"] if e["ciLow"] is not None else 0 for e in selected],
                          [e["ciHigh"] - e["mean"] if e["ciHigh"] is not None else 0 for e in selected]]
                ax.errorbar([e["L"] for e in selected], means, yerr=errors, marker="o", markersize=3,
                            capsize=2, label=f"Policy41 - temporal null p={p:g}")
            ax.axhline(0, color="#444444", lw=.7)
            ax.set(xscale="log", xlabel="L", ylabel=label, title=f"k={k}, {boundary}")
            ax.legend(frameon=False)
        save(fig, output, f"finite-effects-{filename(experiment)}-k{k}-{boundary}", registry,
             "Same-seed run-wise differences at each actual L; pointwise CIs. These descriptive comparisons are not an unregistered confirmatory family.")


def run_lengths(records, output, registry):
    for (experiment, L, k, boundary), samples in grouped(records, ("experiment", "L", "k", "boundary")):
        if experiment != "landscape" and not ("size" in experiment and L >= 2048):
            continue
        selected = [g for g in samples if (g["alpha"], g["beta"]) in ((0, 1), (1, .05), (1, 0), (.5, .5), (1, 1))]
        if not selected:
            continue
        fig, ax = plt.subplots(figsize=(4.4, 3), layout="constrained")
        for group in selected:
            hist = group["accepted"]["histogram"]
            count = sum(hist.values())
            if not count:
                continue
            x = sorted(map(int, hist))
            ax.plot(x, [hist[str(length)] / count for length in x], marker=".", markersize=2,
                    label=f"({group['alpha']:g},{group['beta']:g}), n={group['accepted']['runsMeasured']}")
        ax.set(xscale="log", yscale="log", xlabel="Consecutive accepted rods of one orientation",
               ylabel="Pooled sequence-run fraction", title=f"{experiment}: L={L}, k={k}, {boundary}")
        ax.legend(frameon=False)
        save(fig, output, f"accepted-run-lengths-{filename(experiment)}-L{L}-k{k}-{boundary}", registry,
             "Actual accepted sequence runs; pooled counts are descriptive, not independent lattice observations. Event-engine proposal run histograms remain unavailable.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    groups = json.loads((args.input / "summary.json").read_text(encoding="utf-8"))["groups"]
    comparisons = json.loads((args.input / "comparisons.json").read_text(encoding="utf-8"))["tests"]
    with (args.input / "frontiers.csv").open(encoding="utf-8", newline="") as source:
        records = list(csv.DictReader(source))
    args.output.mkdir(parents=True, exist_ok=True)
    registry = []
    landscape(groups, args.output, registry)
    frontier(groups, records, args.output, registry)
    combined_file = args.input / "exploration-summary.json"
    combined_frontier = args.input / "exploration-frontiers.csv"
    if combined_file.exists() and combined_frontier.exists():
        combined = json.loads(combined_file.read_text(encoding="utf-8"))["groups"]
        with combined_frontier.open(encoding="utf-8", newline="") as source:
            combined_records = list(csv.DictReader(source))
        landscape(combined, args.output, registry)
        frontier(combined, combined_records, args.output, registry)
    finite_size(groups, args.output, registry)
    confirmation(comparisons, args.output, registry)
    effects_file = args.input / "finite-size-effects.json"
    if effects_file.exists():
        finite_effects(json.loads(effects_file.read_text(encoding="utf-8"))["effects"], args.output, registry)
    lengths_file = args.input / "run-lengths.json"
    if lengths_file.exists():
        run_lengths(json.loads(lengths_file.read_text(encoding="utf-8"))["groups"], args.output, registry)
    (args.output / "manifest.json").write_text(json.dumps({"schemaVersion": 2, "figures": registry,
        "inputs": [{"file": name, "sha256": hashlib.sha256((args.input / name).read_bytes()).hexdigest()}
                   for name in ("summary.json", "comparisons.json", "frontiers.csv")],
        "limitations": "Finite-grid exploratory landscape; no continuum optimality, forced limit fit or phase-transition claim."}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"figures": len(registry), "output": str(args.output)}))


if __name__ == "__main__":
    main()
