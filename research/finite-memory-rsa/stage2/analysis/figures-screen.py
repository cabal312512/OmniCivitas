#!/usr/bin/env python3
"""PNG/SVG-only adapter requested during final export; frozen figures.py is read-only."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from matplotlib.ticker import MaxNLocator


def compact_figures(figures, groups, tests, output, registry):
    selected = [group for group in groups if group["experiment"] == "confirmation" and group["L"] == 64]
    if not selected:
        return
    palettes = {"a1-b0.001": "#1f77b4", "a1-b0.05": "#2ca02c", "a0.02-b1": "#d95f02", "a0.85-b0.5": "#9467bd"}
    fig, axes = figures.plt.subplots(1, 2, figsize=(8.2, 3.3), layout="constrained")
    for ax, k in zip(axes, (4, 8)):
        samples = [group for group in selected if group["k"] == k]
        nulls = [group for group in samples if group["temporalNull"] and not group["controller"].startswith("proposal-")]
        ax.scatter([figures.value(g, "abs_order") for g in nulls], [figures.value(g, "coverage") for g in nulls],
                   color="#333333", marker="D", s=15, label="21 fixed diagonal controls")
        for controller, color in palettes.items():
            candidate = next((g for g in samples if g["controller"] == controller), None)
            if candidate is None:
                continue
            x, y = figures.value(candidate, "abs_order"), figures.value(candidate, "coverage")
            ax.errorbar(x, y, xerr=[[x - figures.value(candidate, "abs_order", "ciLow")],
                                   [figures.value(candidate, "abs_order", "ciHigh") - x]],
                        yerr=[[y - figures.value(candidate, "coverage", "ciLow")],
                              [figures.value(candidate, "coverage", "ciHigh") - y]], color=color,
                        marker="o", markersize=4, capsize=2, label=f"({candidate['alpha']:g},{candidate['beta']:g})")
            baseline = next((g for g in samples if g["controller"] == f"proposal-k{k}-{controller}"), None)
            if baseline:
                bx, by = figures.value(baseline, "abs_order"), figures.value(baseline, "coverage")
                ax.scatter([bx], [by], color=color, marker="s", facecolors="none", s=25)
                ax.plot([x, bx], [y, by], color=color, lw=.7, ls=":", alpha=.6)
        ax.set(xlabel=r"Run-wise $\langle|S|\rangle$", ylabel=r"Terminal $\langle\theta\rangle$", title=f"Locked holdout: L=64, k={k}, n=1024 per arm")
        ax.legend(frameon=False, fontsize=6, loc="best")
    fig.suptitle("Fixed diagonal line and four feedback mechanisms; hollow squares = pilot proposal-matched controls", fontsize=8)
    figures.save(fig, output, "locked-tradeoff", registry,
                 "Held-out point estimates and processed pointwise 95% Student-t intervals. Lines link frozen proposal-matched arms, not a fitted Pareto bound or continuum dominance claim.")
    fig, axes = figures.plt.subplots(2, 2, figsize=(9, 7.4), layout="constrained")
    for column, k in enumerate((4, 8)):
        for row, metric in enumerate(("coverage", "abs_order")):
            ax = axes[row, column]
            results = [t for t in tests if t["experiment"] == "confirmation" and t["L"] == 64 and t["k"] == k
                       and t["metric"] == metric and (t["baseline"] in ("a0.5-b0.5", "a1-b1") or t["baseline"].startswith("proposal-"))]
            results.sort(key=lambda t: (list(palettes).index(t["controller"]), t["baseline"]))
            labels = []
            for i, result in enumerate(results):
                base = "fair" if result["baseline"] == "a0.5-b0.5" else "alternating" if result["baseline"] == "a1-b1" else "proposal-matched"
                labels.append(f"{result['controller']} - {base}")
                ax.plot([result["simultaneousCiLow"], result["simultaneousCiHigh"]], [i, i], color="#777777", lw=1)
                ax.scatter([result["mean"]], [i], marker="o" if result["rejectAtAlpha"] else "s", s=20,
                           color=palettes[result["controller"]], facecolors=palettes[result["controller"]] if result["rejectAtAlpha"] else "none")
            ax.axvline(0, color="#333333", lw=.6)
            if metric == "abs_order":
                ax.axvline(.01, color="#c44e52", lw=.7, ls="--")
            ax.set(yticks=list(range(len(results))), yticklabels=labels, xlabel="Paired coverage difference" if metric == "coverage" else r"Paired $|S|$ difference; NI margin=.01",
                   title=f"k={k}; {'coverage' if metric == 'coverage' else 'anisotropy noninferiority'}")
            ax.tick_params(axis="y", labelsize=6)
            ax.xaxis.set_major_locator(MaxNLocator(nbins=4))
            ax.invert_yaxis()
    fig.suptitle("Locked selected contrasts: Bonferroni simultaneous two-sided CIs; filled circles = Holm rejection", fontsize=8)
    figures.save(fig, output, "locked-selected-effects", registry,
                 "Subset of the unchanged 400-test family, not a new correction. Fair, strict alternation and each frozen proposal match stay visible. Holm and Bonferroni have different rejection thresholds.")


def main():
    source = Path(__file__).with_name("figures.py")
    spec = importlib.util.spec_from_file_location("stage2_frozen_figures", source)
    figures = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(figures)

    def save_screen(fig, output, name, registry, interpretation):
        artifacts = []
        for extension in ("png", "svg"):
            target = output / f"{name}.{extension}"
            fig.savefig(target, bbox_inches="tight")
            artifacts.append({"file": target.name, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
        figures.plt.close(fig)
        registry.append({"name": name, "artifacts": artifacts, "interpretation": interpretation})

    figures.save = save_screen
    supplement_only = "--supplement-only" in sys.argv
    if supplement_only:
        sys.argv.remove("--supplement-only")
    if not supplement_only:
        figures.main()
    output = Path(sys.argv[sys.argv.index("--output") + 1])
    input_directory = Path(sys.argv[sys.argv.index("--input") + 1])
    manifest_file = output / "manifest.json"
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    registry = [item for item in manifest["figures"] if item["name"] not in ("locked-tradeoff", "locked-selected-effects")]
    compact_figures(figures, json.loads((input_directory / "summary.json").read_text(encoding="utf-8"))["groups"],
                   json.loads((input_directory / "comparisons.json").read_text(encoding="utf-8"))["tests"], output, registry)
    manifest["figures"] = registry
    manifest.update({
        "exportFormats": ["png", "svg"],
        "pdfExportSkipped": True,
        "reason": "User asked to defer PDF generation during the original final export.",
        "frozenFigureSourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "screenAdapterSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "retainedEarlierPDFs": sorted(path.name for path in output.glob("*.pdf")),
        "retainedPDFInterpretation": "Earlier PDF files were preserved after interruption; this adapter neither writes nor verifies them.",
    })
    manifest_file.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
