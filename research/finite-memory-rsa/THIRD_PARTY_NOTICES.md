# Scientific-code provenance

The lattice simulator, controller enumeration, exact solver, tests and analysis
were developed for this project. Equations and research papers are cited in the
literature notes and paper; their numerical results are not presented as ours.

The RNG step implements xoshiro128**1.1 by David Blackman and Sebastiano Vigna
(2018), following their public-domain reference:
https://prng.di.unimi.it/xoshiro128starstar.c . The source grants unrestricted
use/copy/modification/distribution and disclaims warranties. No jump library or
reference source file is bundled. The small integer seed-expansion routine is
separately documented in rng.mjs; generated seeds and runtime version are saved.

NumPy2.2.6 and Matplotlib3.10.3 are optional analysis dependencies installed by
normal package tooling; their binary packages, transitive dependencies and
licenses remain in the local Python environment, not in this research source
directory. Python3.12.10 was downloaded from the official release directory;
the local environment/provenance record retains its SHA256 verification. No
copied paper artwork, external dataset, game imagery or sound is used here.

ReportLab4.4.2 and pypdf5.6.1 are optional document dependencies for generating
and checking the report PDF. They are not required for simulations or statistical
analysis; installed packages and their license files remain in the separate
Python environment. PDF fonts are loaded from the installed Matplotlib package,
not copied into the research repository.

The standalone paper embeds DejaVu font subsets. Their actual Bitstream/Arev
copyright and permission text is preserved in paper/FONT_LICENSE.txt and attached
inside paper.pdf. The optional installed font binaries themselves remain outside
the source repository.

The archived RRSA implementation's compact comment “Like their protocol”
indicates the shared orientation-retention rule only. The precise held-direction
stop used here has not been verified to match every stopping detail in Lebovka
et al. The model, literature notes and final manuscript explicitly distinguish
this RRSA-like reference; the original tested source is retained unchanged so
its recorded hashes continue to identify the actual data-generating code.
