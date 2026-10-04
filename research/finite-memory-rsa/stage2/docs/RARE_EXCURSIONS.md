# Rare blocked-direction excursions

This is a frozen-geometry kinetic diagnostic with H blocked, V success hazard1/2, and initial V. Seven beta values each have100,000 independently seeded event draws: **700,000 observations**, seeds50,000,001 + betaIndex*200,000 onward. No lattice or packing policy was optimized. The frozen event sampler retains actual discrete waiting counts, rather than substituting analytical means.

| beta | observed mean | exact mean | excursions observed / expected | naive95% t interval contains exact mean | maximum attempts |
|---:|---:|---:|---:|:---:|---:|
| 0 | 1.994170 | 2 | 0 / 0.0000 | yes | 19 |
| 0.000001 | 2.004090 | 3 | 0 / 0.1000 | no | 15 |
| 0.0001 | 2.854910 | 3 | 10 / 9.9990 | yes | 20922 |
| 0.001 | 3.027760 | 3 | 110 / 99.9001 | yes | 4075 |
| 0.01 | 2.922800 | 3 | 934 / 990.0990 | yes | 728 |
| 0.1 | 3.027870 | 3 | 9140 / 9090.9091 | yes | 112 |
| 1 | 3.007880 | 3 | 50015 / 50000.0000 | yes | 35 |

At beta0, mean/variance are2. For every positive beta, exact mean=3 and variance=2/beta+6. A first blocked excursion has probability beta/(1+beta); once it occurs, its blocked-state residence has mean1/beta. Thus the distribution tends weakly to the beta-zero geometric law, but its means do not converge. This finite-state family is not uniformly integrable. It is not a thermodynamic phase transition.

There are 1 misses among the seven naive sample-variance Student-t intervals. Tiny-beta samples can omit rare excursions and underestimate both mean and variance; those misses must not automatically be described as implementation failures. The report also provides conservative Chebyshev intervals using the **known exact variance**, with Bonferroni family confidence at least99% under independent-run sampling. 0 such family intervals missed. These intentionally broad model-fidelity intervals are separate from primary packing inference.

All700,000 individual draws are saved as `data/raw/rare-excursions.csv`, with seeds and actual H/V failures, flips and accepted orientation. The completed manifest records runtime and source hashes. `data/processed/rare-excursions.json` contains sample SD/SE, both interval types, exact rational moments, quantiles and observed excursion counts. No confirmation seed block was reused:40-million ranges remain reserved for held-out packing.

Reproduction from the research root into a clean output checkout:

```sh
node stage2/scripts/rare-excursions.mjs
```

Existing raw evidence is never overwritten. For the analytic proof, exact survival oracle and necessary conditioning of the divergence claim, see `docs/THEORY.md`, Section5.
