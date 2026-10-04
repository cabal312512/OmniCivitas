#!/usr/bin/env python3
"""Paper-size figures, regenerated solely from processed data.

Usage: python analysis/figures.py --input data/processed --output figures
Only NumPy and Matplotlib are required. No simulation runs or selection are done.
"""
import argparse
import json
import math
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from matplotlib.lines import Line2D
import numpy as np

matplotlib.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 8, "axes.titlesize": 9,
    "axes.labelsize": 8, "legend.fontsize": 6.7, "xtick.labelsize": 7,
    "ytick.labelsize": 7, "axes.linewidth": .65, "lines.linewidth": 1.2,
    "savefig.dpi": 300, "pdf.fonttype": 42, "ps.fonttype": 42,
    "axes.spines.top": False, "axes.spines.right": False,
})


def controller_id(name):
    match = re.fullmatch(r"(?:(?:c|controller|onebit)[-_]?)?(\d+)", str(name), re.I)
    return int(match.group(1)) if match and 0 <= int(match.group(1)) < 64 else None


def value(group, metric, field="mean"):
    return group["metrics"][metric][field]


def save(fig, output, name, registry, description):
    fig.savefig(output / f"{name}.pdf", bbox_inches="tight")
    fig.savefig(output / f"{name}.png", bbox_inches="tight")
    fig.savefig(output / f"{name}.svg", bbox_inches="tight")
    plt.close(fig)
    registry.append({"name": name, "formats": ["pdf", "png", "svg"], "description": description})


def atlas_figures(groups, output, registry):
    atlas = [g for g in groups if re.search(r"atlas|pilot", g["experiment"], re.I) and controller_id(g["controller"]) is not None]
    if not atlas:
        return
    ks = sorted({g["k"] for g in atlas})
    strata = sorted({(g["L"], g["boundary"]) for g in atlas})
    # No aggregation over differently sized systems or boundary conditions.
    for metric, name, label, cmap, limits in [
        ("coverage", "atlas-coverage", r"Terminal coverage $\langle\theta\rangle$", "viridis", None),
        ("deadlock", "atlas-deadlock", "Controller-deadlock probability", "magma", (0, 1)),
        ("abs_order", "atlas-absolute-order", r"$\langle|S|\rangle$", "cividis", (0, 1)),
    ]:
        samples = [g["deadlock"]["rate"] if metric == "deadlock" else value(g, metric) for g in atlas]
        lo, hi = limits or (math.floor(min(samples) * 20) / 20, math.ceil(max(samples) * 20) / 20)
        if hi <= lo:
            hi = lo + .05
        fig, axes = plt.subplots(len(strata), len(ks), figsize=(2.1 * len(ks), 2.0 * len(strata)), squeeze=False, layout="constrained")
        image = None
        for row, (L, boundary) in enumerate(strata):
            for col, k in enumerate(ks):
                matrix = np.full((8, 8), np.nan)
                selected = [g for g in atlas if g["L"] == L and g["boundary"] == boundary and g["k"] == k]
                for group in selected:
                    number = controller_id(group["controller"])
                    matrix[number // 8, number % 8] = group["deadlock"]["rate"] if metric == "deadlock" else value(group, metric)
                ax = axes[row, col]
                image = ax.imshow(matrix, norm=Normalize(lo, hi), cmap=cmap, interpolation="none", origin="upper")
                ax.set_title(f"L={L}, k={k}, {boundary}")
                ax.set_xticks(range(8), range(8))
                ax.set_yticks(range(8), [8 * i for i in range(8)])
                ax.set_xlabel("Controller offset")
                if col == 0:
                    ax.set_ylabel("Controller block")
                for spine in ax.spines.values():
                    spine.set_visible(False)
                if len(selected) != 64:
                    ax.text(.5, -.25, f"{len(selected)}/64 present", transform=ax.transAxes, ha="center", color="#b32624", fontsize=7)
        fig.colorbar(image, ax=axes.ravel().tolist(), label=label, shrink=.85, pad=.02)
        save(fig, output, name, registry, "All 64 numerical controller IDs. Missing cells remain blank. Exploratory point estimates; see summary.csv for uncertainty.")


def pareto_figure(groups, output, registry):
    atlas = [g for g in groups if re.search(r"atlas|pilot", g["experiment"], re.I)]
    if not atlas:
        return
    ks = sorted({g["k"] for g in atlas})
    fig, axes = plt.subplots(1, len(ks), figsize=(2.25 * len(ks), 2.65), squeeze=False, layout="constrained")
    levels = sorted({g["L"] for g in atlas})
    colors = plt.get_cmap("viridis")(np.linspace(.15, .85, len(levels)))
    for ax, k in zip(axes[0], ks):
        for L, color in zip(levels, colors):
            for group in [g for g in atlas if g["k"] == k and g["L"] == L]:
                x, y = value(group, "abs_order"), value(group, "coverage")
                marker = "o" if controller_id(group["controller"]) is not None else "D"
                ax.scatter(x, y, s=15, marker=marker, color=color, alpha=.7, edgecolor="white", linewidth=.25)
        ax.axvline(.1, color="#a24738", ls=":", lw=.8)
        ax.set(xlabel=r"$\langle|S|\rangle$", ylabel=r"$\langle\theta\rangle$", title=f"k={k}", xlim=(-.03, 1.03))
        ax.grid(alpha=.15)
    handles = [Line2D([], [], color=c, marker="o", linestyle="", markersize=4, label=f"L={L}") for L, c in zip(levels, colors)]
    handles.append(Line2D([], [], color="#555", marker="D", linestyle="", markersize=4, label="Memoryless baseline"))
    axes[0, -1].legend(handles=handles, frameon=False, loc="best")
    save(fig, output, "coverage-order-tradeoff", registry, "Exploratory terminal coverage versus mean absolute order. Dotted line is the prespecified isotropy threshold, not a significance decision.")


def cancellation_figure(groups, output, registry):
    selected = [g for g in groups if re.search(r"atlas|pilot|confirmation", g["experiment"], re.I)]
    if not selected:
        return
    fig, ax = plt.subplots(figsize=(3.5, 3), layout="constrained")
    xs = [value(g, "order") for g in selected]
    ys = [value(g, "abs_order") for g in selected]
    colors = [value(g, "coverage") for g in selected]
    plot = ax.scatter(xs, ys, c=colors, cmap="viridis", s=16, alpha=.6, linewidth=0)
    ax.plot([-1, 0, 1], [1, 0, 1], lw=.8, color="#999", ls="--")
    ax.axhline(.1, color="#a24738", ls=":", lw=.8)
    ax.set(xlabel=r"$\langle S\rangle$", ylabel=r"$\langle|S|\rangle$", xlim=(-1.05, 1.05), ylim=(-.025, 1.05))
    ax.grid(alpha=.15)
    fig.colorbar(plot, ax=ax, label=r"$\langle\theta\rangle$", shrink=.85)
    save(fig, output, "signed-order-cancellation", registry, "Points near signed order zero but absolute order large are not isotropic. No averaging over controller IDs is performed.")


def finite_size_figure(groups, output, registry):
    selected = [g for g in groups if re.search(r"finite[_-]?size", g["experiment"], re.I)]
    if not selected:
        return
    strata = sorted({(g["k"], g["boundary"]) for g in selected})
    fig, axes = plt.subplots(2, len(strata), figsize=(3 * len(strata), 5), squeeze=False, layout="constrained")
    controllers = sorted({str(g["controller"]) for g in selected})
    palette = {"0": "#387fa3", "35": "#259b87", "38": "#be7444", "41": "#89549e", "random-0.5": "#242e38"}
    colors = [palette.get(controller, plt.get_cmap("tab10")(i % 10)) for i, controller in enumerate(controllers)]
    for column, (k, boundary) in enumerate(strata):
        for controller, color in zip(controllers, colors):
            points = sorted([g for g in selected if str(g["controller"]) == controller and g["k"] == k and g["boundary"] == boundary], key=lambda g: g["L"])
            if not points:
                continue
            x = np.asarray([1 / g["L"] for g in points])
            for row, metric in enumerate(["coverage", "abs_order"]):
                y = np.asarray([value(g, metric) for g in points])
                low = np.asarray([value(g, metric, "ciLow") if value(g, metric, "ciLow") is not None else np.nan for g in points])
                high = np.asarray([value(g, metric, "ciHigh") if value(g, metric, "ciHigh") is not None else np.nan for g in points])
                axes[row, column].errorbar(x, y, yerr=np.vstack([np.maximum(0, y - low), np.maximum(0, high - y)]), color=color, marker="o", markersize=3, capsize=2, label=controller)
        for row in range(2):
            ax = axes[row, column]
            ax.set_xlabel("1/L")
            ax.set_ylabel(r"$\langle\theta\rangle$" if row == 0 else r"$\langle|S|\rangle$")
            ax.grid(alpha=.15)
        axes[0, column].set_title(f"k={k}, {boundary}")
        axes[0, column].legend(frameon=False, ncol=2)
    save(fig, output, "finite-size", registry, "Actual sizes with pointwise Student-t 95% intervals. Connecting lines guide the eye; no thermodynamic-limit scaling law or fit is imposed.")


def holdout_tradeoff_figure(groups, output, registry):
    selected = [g for g in groups if g["experiment"] == "confirmation"]
    if not selected:
        return
    strata = sorted({(g["L"], g["k"], g["boundary"]) for g in selected})
    fig, axes = plt.subplots(1, len(strata), figsize=(2.35 * len(strata), 3.2), squeeze=False, layout="constrained")
    special = {
        "0": ("#536578", "s"), "33": ("#347e9a", "o"),
        "35": ("#259b87", "D"), "38": ("#be7444", "X"),
        "41": ("#89549e", "P"), "43": ("#b45979", "v"),
    }
    for ax, (L, k, boundary) in zip(axes[0], strata):
        for group in [g for g in selected if g["L"] == L and g["k"] == k and g["boundary"] == boundary]:
            controller = str(group["controller"])
            is_memoryless = controller.startswith("random-")
            color, marker = special.get(controller, ("#343b44", "s") if is_memoryless else ("#bdc3c8", "o"))
            x, y = value(group, "abs_order"), value(group, "coverage")
            xlo, xhi = value(group, "abs_order", "ciLow"), value(group, "abs_order", "ciHigh")
            ylo, yhi = value(group, "coverage", "ciLow"), value(group, "coverage", "ciHigh")
            if xlo is not None and ylo is not None:
                ax.errorbar(x, y, xerr=[[max(0, x - xlo)], [max(0, xhi - x)]], yerr=[[max(0, y - ylo)], [max(0, yhi - y)]],
                            color=color, elinewidth=.55, capsize=1.2, alpha=.6, zorder=1)
            ax.scatter(x, y, s=24 if controller in special else 14, color=color, marker=marker,
                       edgecolor="white", linewidth=.25, zorder=3 if controller in special else 2)
        ax.axvline(.1, color="#a24738", lw=.8, ls=":")
        ax.set(xlabel=r"$\langle|S|\rangle$", ylabel=r"$\langle\theta\rangle$", title=f"L={L}, k={k}, {boundary}", xlim=(-.035, 1.035))
        ax.grid(alpha=.15)
    handles = [Line2D([], [], color=color, marker=marker, linestyle="", markersize=4, label=controller)
               for controller, (color, marker) in special.items()]
    handles.extend([Line2D([], [], color="#343b44", marker="s", linestyle="", markersize=4, label="IID bias grid"),
                    Line2D([], [], color="#bdc3c8", marker="o", linestyle="", markersize=4, label="Other deterministic classes")])
    fig.legend(handles=handles, loc="outside lower center", frameon=False, ncol=4)
    save(fig, output, "holdout-coverage-order", registry, "All executed holdout classes and nine fixed IID biases, not a selected winner. Bars are pointwise t 95% CIs; low signed order is not used as isotropy. Confirmatory claims use comparisons.json, not this sample Pareto view.")


def confirmation_figure(tests, output, registry):
    coverage = [t for t in tests if t["kind"] == "paired-effect" and t["metric"] == "coverage"]
    if not coverage:
        return
    # Split by comparator and boundary: hundreds of locked comparisons need not fit one unreadable plot.
    strata = sorted({(t["baseline"], t["boundary"]) for t in coverage})
    for baseline, boundary in strata:
        subset = sorted([t for t in coverage if t["baseline"] == baseline and t["boundary"] == boundary], key=lambda t: (t["k"], str(t["controller"]), t["L"]))
        fig, ax = plt.subplots(figsize=(5.2, max(2.5, .17 * len(subset))), layout="constrained")
        for i, test in enumerate(subset):
            if test["mean"] is None:
                continue
            low, high = test["simultaneousCiLow"], test["simultaneousCiHigh"]
            color = "#176b7c" if test["complete"] else "#a9a9a9"
            if low is not None:
                ax.plot([low, high], [i, i], color=color, lw=.9)
            ax.scatter(test["mean"], i, color=color, s=14, marker="o" if test["rejectAtAlpha"] else "s", zorder=3)
        ax.axvline(0, color="#777", lw=.8, ls=":")
        ax.set_yticks(range(len(subset)), [f"{t['controller']}, k={t['k']}, L={t['L']}" for t in subset])
        ax.set_xlabel(r"Paired terminal-coverage difference $\Delta\theta$")
        ax.set_title(f"Versus {baseline}, {boundary}")
        ax.grid(axis="x", alpha=.15)
        name = "holdout-effects-" + re.sub(r"[^A-Za-z0-9_.-]+", "-", f"{baseline}-{boundary}")
        save(fig, output, name, registry, "Fixed holdout family. Bars are Bonferroni simultaneous t intervals; circles denote Holm rejection, squares nonrejection, gray incomplete. Rejection alone does not establish isotropy or positive benefit.")


def snapshot_figures(snapshot_directory, output, registry):
    if snapshot_directory is None:
        return
    if snapshot_directory.is_file():
        data = json.loads(snapshot_directory.read_text(encoding="utf-8"))
        records = data if isinstance(data, list) else data.get("records", [])
        # The simulator's occupancy field explicitly encodes empty/H/V as 0/1/2.
        selected = [record for record in records if record.get("k") == 4]
        if not selected:
            selected = records[:4]
        if not selected:
            return
        from matplotlib.colors import ListedColormap
        fig, axes = plt.subplots(1, len(selected), figsize=(2.1 * len(selected), 2.3), squeeze=False, layout="constrained")
        for ax, snapshot in zip(axes[0], selected):
            L = int(snapshot["L"])
            lattice = np.asarray(snapshot["lattice"]["occupancy"])
            if lattice.size != L * L or not np.isin(lattice, [0, 1, 2]).all():
                raise ValueError("Invalid simulator orientation occupancy")
            theta = np.count_nonzero(lattice) / (L * L)
            if abs(theta - snapshot["coverage"]) > 1e-12:
                raise ValueError("Snapshot image and reported coverage disagree")
            ax.imshow(lattice.reshape(L, L), cmap=ListedColormap(["#f5f4ed", "#347e9a", "#dba756"]), vmin=0, vmax=2, interpolation="none")
            ax.set(xticks=[], yticks=[], title=f"{snapshot['controller']}\n" + rf"$\theta={theta:.4f}$")
        fig.legend(handles=[Line2D([], [], marker="s", linestyle="", color=color, label=label, markersize=5)
                            for color, label in [("#f5f4ed", "Empty"), ("#347e9a", "H"), ("#dba756", "V")]],
                   loc="outside lower center", ncol=3, frameon=False)
        save(fig, output, "snapshots-k4", registry, f"Fixed-seed direct-engine examples, k={selected[0]['k']}, L={selected[0]['L']}, seed={selected[0]['seed']}. 0/1/2 occupancy checked against coverage. Individual examples are illustrative, not statistical evidence.")
        return
    for filename in sorted(snapshot_directory.glob("*.json")):
        snapshot = json.loads(filename.read_text(encoding="utf-8"))
        if "lattice" not in snapshot or "L" not in snapshot:
            continue
        lattice = np.asarray(snapshot["lattice"])
        L = int(snapshot["L"])
        if lattice.size != L * L:
            raise ValueError(f"Wrong lattice size in {filename}")
        # Explicit encoding required; arbitrary particle IDs must never be called orientations.
        if snapshot.get("encoding") != {"empty": 0, "horizontal": 1, "vertical": 2}:
            continue
        image = lattice.reshape(L, L)
        if not np.isin(image, [0, 1, 2]).all():
            raise ValueError(f"Invalid orientation lattice in {filename}")
        from matplotlib.colors import ListedColormap
        fig, ax = plt.subplots(figsize=(3.2, 3.2), layout="constrained")
        ax.imshow(image, cmap=ListedColormap(["#f7f7f3", "#347e9a", "#dba756"]), vmin=0, vmax=2, interpolation="none")
        ax.set(xticks=[], yticks=[], title=f"{snapshot.get('controller', '?')}, L={L}, k={snapshot.get('k', '?')}, seed={snapshot.get('seed', '?')}")
        save(fig, output, f"snapshot-{filename.stem}", registry, "A labeled individual lattice, not statistical evidence. Only explicit empty/H/V encoding is accepted.")


def extension_figures(input_directory, groups, output, registry):
    dynamics_file = input_directory / "dynamics-summary.json"
    if dynamics_file.exists():
        data = json.loads(dynamics_file.read_text(encoding="utf-8"))["groups"]
        controllers = ["35", "38", "41", "random-0.5"]
        ks = sorted({group["k"] for group in data})
        fig, axes = plt.subplots(2, len(ks), figsize=(2.8 * len(ks), 4.8), squeeze=False, layout="constrained")
        for column, k in enumerate(ks):
            points = [next(group for group in data if group["controller"] == controller and group["k"] == k) for controller in controllers]
            x = np.arange(len(controllers))
            for metric, offset, color, label in [("switchAfterFailure", -.15, "#347e9a", "After failure"), ("switchAfterSuccess", .15, "#dba756", "After success")]:
                y = np.asarray([value(group, metric) for group in points])
                errors = np.asarray([[max(0, y[i] - value(group, metric, "ciLow")), max(0, value(group, metric, "ciHigh") - y[i])] for i, group in enumerate(points)]).T
                axes[0, column].bar(x + offset, y, width=.29, color=color, label=label, yerr=errors, capsize=2, error_kw={"elinewidth": .75})
            metric = "conditionalMI"
            y = np.asarray([value(group, metric) for group in points])
            errors = np.asarray([[max(0, y[i] - value(group, metric, "ciLow")), max(0, value(group, metric, "ciHigh") - y[i])] for i, group in enumerate(points)]).T
            axes[1, column].bar(x, y, width=.55, color="#89549e", yerr=errors, capsize=2, error_kw={"elinewidth": .75})
            axes[0, column].set(title=f"L={points[0]['L']}, k={k}", ylabel="P(switch | outcome)", ylim=(-.025, 1.075))
            axes[1, column].set_ylabel(r"Plug-in $\hat I(Y_{t-1}; \mathrm{switch}\mid O_{t-1})$ (bits)")
            for row in range(2):
                axes[row, column].set_xticks(x, ["35", "38", "41", "IID .5"])
                axes[row, column].grid(axis="y", alpha=.15)
            if column == 0:
                axes[0, column].legend(frameon=False, loc="best")
        save(fig, output, "outcome-conditioned-switching", registry, "Actual direct trajectories, 16 independent runs per cell, pointwise t CIs. Constant switching35 has zero conditional information; 38 and41 react oppositely to outcomes. IID plug-in information has positive finite-sample bias; not entropy rate or causal information.")
    rescue_file = input_directory / "rescue-summary.json"
    if rescue_file.exists():
        data = sorted(json.loads(rescue_file.read_text(encoding="utf-8"))["groups"], key=lambda group: group["k"])
        fig, axes = plt.subplots(1, 2, figsize=(6.7, 2.65), layout="constrained")
        x = np.arange(len(data))
        y = np.asarray([value(group, "coverage_gain") for group in data])
        errors = np.asarray([[max(0, y[i] - value(group, "coverage_gain", "ciLow")), max(0, value(group, "coverage_gain", "ciHigh") - y[i])] for i, group in enumerate(data)]).T
        axes[0].bar(x, y, color="#259b87", width=.5, yerr=errors, capsize=2, error_kw={"elinewidth": .8})
        axes[0].set(xlabel="k", ylabel=r"Paired coverage gain $\Delta\theta$")
        for metric, color, label in [("before_coverage", "#be7444", "Controller38 terminal"), ("after_coverage", "#347e9a", "After external fair rescue")]:
            y = np.asarray([value(group, metric) for group in data])
            errors = np.asarray([[max(0, y[i] - value(group, metric, "ciLow")), max(0, value(group, metric, "ciHigh") - y[i])] for i, group in enumerate(data)]).T
            axes[1].errorbar(x, y, yerr=errors, color=color, marker="o", markersize=4, capsize=2, label=label)
        axes[1].set(xlabel="k", ylabel=r"Coverage $\langle\theta\rangle$")
        axes[1].legend(frameon=False)
        for ax in axes:
            ax.set_xticks(x, [group["k"] for group in data])
            ax.grid(axis="y", alpha=.15)
        save(fig, output, "external-rescue", registry, "Post-primary exploratory observer intervention, n256 each. Paired gain uses all runs, including geometric jams with zero gain. The observer sees terminal status and restarts with fair coin; this is not an admissible finite-memory controller or a primary-family benefit.")
    rrsa = [group for group in groups if group["experiment"] == "rrsa"]
    if rrsa:
        reference = [group for group in groups if group["experiment"] == "confirmation" and str(group["controller"]) in ["35", "41", "random-0.5"]]
        selected = rrsa + reference
        fig, axes = plt.subplots(1, 3, figsize=(8.5, 2.85), layout="constrained")
        palette = {"35": "#259b87", "41": "#89549e", "random-0.5": "#242e38", "rrsa-0.5": "#be7444"}
        for controller, color in palette.items():
            points = sorted([group for group in selected if str(group["controller"]) == controller], key=lambda group: group["k"])
            if not points:
                continue
            ks = [group["k"] for group in points]
            for column, metric in enumerate(["coverage", "abs_order", "deadlock"]):
                stats = [group["deadlock"] if metric == "deadlock" else group["metrics"][metric] for group in points]
                y = np.asarray([stat["rate" if metric == "deadlock" else "mean"] for stat in stats])
                errors = np.asarray([[max(0, y[i] - stat["ciLow"]), max(0, stat["ciHigh"] - y[i])] for i, stat in enumerate(stats)]).T
                axes[column].errorbar(ks, y, yerr=errors, color=color, marker="o", markersize=3.5, capsize=2, label=controller)
        for ax, label in zip(axes, [r"$\langle\theta\rangle$", r"$\langle|S|\rangle$", "Deadlock probability"]):
            ax.set(xlabel="k", ylabel=label, xticks=[2, 3, 4, 8])
            ax.grid(alpha=.15)
        axes[-1].legend(frameon=False, loc="best")
        save(fig, output, "rrsa-reference", registry, "Exploratory nearest stochastic RRSA extension with independent seeds, not added to the sealed36 hypothesis family. Mean t CIs and deadlock Wilson CIs. Retaining a failed orientation can deadlock with legal opposite placements in this precise model.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--snapshots", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    summary = json.loads((args.input / "summary.json").read_text(encoding="utf-8"))
    tests = json.loads((args.input / "comparisons.json").read_text(encoding="utf-8"))["tests"]
    audit = json.loads((args.input / "audit.json").read_text(encoding="utf-8"))
    registry = []
    atlas_figures(summary["groups"], args.output, registry)
    pareto_figure(summary["groups"], args.output, registry)
    cancellation_figure(summary["groups"], args.output, registry)
    finite_size_figure(summary["groups"], args.output, registry)
    holdout_tradeoff_figure(summary["groups"], args.output, registry)
    confirmation_figure(tests, args.output, registry)
    extension_figures(args.input, summary["groups"], args.output, registry)
    snapshot_figures(args.snapshots, args.output, registry)
    manifest = {"source": "processed summaries only; no simulation or controller selection", "inputAuditStatus": audit["confirmation"]["status"], "inputAuditErrors": audit["errors"], "figures": registry}
    (args.output / "figure-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"figures": len(registry), "output": str(args.output), "auditErrors": len(audit["errors"])}))


if __name__ == "__main__":
    main()
