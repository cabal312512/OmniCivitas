"""Render retained scientific outputs; never run an experiment or create a PDF."""
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'figures'
OUT.mkdir(exist_ok=True)
def read(name):
    return json.loads((ROOT / 'results' / name).read_text(encoding='utf-8'))
def save(fig, name):
    for extension in ('png', 'svg'):
        target = OUT / f'{name}.{extension}'
        if target.exists():
            raise RuntimeError(f'Refuse figure overwrite: {target}')
        fig.savefig(target, dpi=180, bbox_inches='tight', facecolor='white')
    plt.close(fig)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,
 'axes.spines.top':False,'axes.spines.right':False,'axes.grid':True,
 'grid.alpha':.18,'axes.titleweight':'bold','svg.fonttype':'none'})

op = read('operational-survey.json')
fig, ax = plt.subplots(1, 2, figsize=(11, 4), layout='constrained')
x = np.arange(1, 5)
sets = [('All valid L', [r['classes'] for r in op['universalStateHistogram']], '#1966a6'),
        ('L=2 periodic', [r['classes'] for r in op['physical'][0]['minimalStateHistogram']], '#68bfa3'),
        ('L=3 periodic', [r['classes'] for r in op['physical'][2]['minimalStateHistogram']], '#eaaa55')]
for i, (name, counts, color) in enumerate(sets):
    bars = ax[0].bar(x + (i-1)*.23, counts, width=.23, label=name, color=color)
    ax[0].bar_label(bars, fontsize=8, padding=2)
ax[0].set(yscale='log', ylim=(.5, 65000), xticks=x,
 xlabel='Minimum deterministic operational states', ylabel='Number of physical classes',
 title='Complete frozen catalogue: 28,534 classes')
ax[0].legend(fontsize=8, loc='upper left')
ax[1].step([2, 3, 4.1], [2, 3, 3], where='post', color='#1966a6', lw=3)
ax[1].scatter([2, 3], [2, 3], s=80, color='#1966a6')
ax[1].set(xlim=(1.8, 4.2), ylim=(1.6, 3.6), xticks=[2,3,4], yticks=[2,3],
 xlabel='Periodic square size L (k=2)', ylabel='Minimum stationary feedback states',
 title='Exact activation: feedback-4-00124')
ax[1].text(2.04, 2.15, '2-state realization', fontsize=10)
ax[1].text(3.02, 3.15, '3-state realization\n2-state randomized lower bound excluded', fontsize=9)
ax[1].text(2.04, 1.73, 'Threshold L=3 certified; line beyond L=3 uses\nuniversal 3-state upper and embedded witness.', fontsize=8)
save(fig, '01-operational-memory')

cap = read('capability-search.json')
proper = read('proper-boundary-null.json')
fig, axes = plt.subplots(1, 2, figsize=(11, 4.4), layout='constrained')
for ax, outcome in zip(axes, cap['outcomes']):
    rows = outcome['feedback']
    points = ax.scatter([r['metrics']['absOrder']['value'] for r in rows],
        [r['metrics']['coverage']['value'] for r in rows],
        c=[r['metrics']['attemptsPerParticle']['value'] for r in rows],
        s=19, alpha=.55, cmap='viridis', label='192 selected feedback classes')
    null = outcome['temporal']
    ax.scatter([r['metrics']['absOrder']['value'] for r in null],
       [r['metrics']['coverage']['value'] for r in null], marker='^',
       s=65, facecolors='none', edgecolors='#dc4c38', label='Feasible temporal examples')
    target = next(r for r in rows if r['policy']=='feedback-4-00010')
    ax.scatter([target['metrics']['absOrder']['value']], [target['metrics']['coverage']['value']],
       marker='*', s=160, color='#191919', label='Archived one-bit tradeoff')
    if outcome['parameters']['boundary']=='periodic':
        ax.scatter([.5],[8/9],s=110,marker='D',color='#dc4c38',label='Proper H-once-V schedule')
    ax.axhline(8/9,color='#888888',lw=1,ls='--')
    ax.set(xlabel='Expected absolute order',ylabel='Expected coverage',
        title=f"3×3 domino RSA: {outcome['parameters']['boundary']}")
    ax.legend(fontsize=8,loc='lower left')
    fig.colorbar(points, ax=ax, shrink=.75, label='E[A/N] (feedback points)')
fig.suptitle('Feasible objective projections, not a complete stochastic envelope', fontsize=12)
save(fig, '02-feasible-capabilities')

base, informed = read('temporal-envelope.json'), read('temporal-envelope-informed.json')
fig, axes = plt.subplots(1, 2, figsize=(11, 4), layout='constrained')
colors = ['#1966a6','#69a99f','#dfad4d','#8868b1','#d35448']
for ax, cert, old in zip(axes, informed['certificates'], base['certificates']):
    groups = {}
    for r in cert['bounds']:
        key=(r['imbalanceMultiplier']['value'],r['costMultiplier']['value'])
        groups.setdefault(key,[]).append(r)
    for color, (key, rows) in zip(colors, groups.items()):
        ax.plot([r['horizon'] for r in rows], [r['supportUpper']['value'] for r in rows],
            '-o', color=color, label=f'μ={key[0]:g}, ν={key[1]:g}')
        previous=[r for r in old['bounds'] if (r['imbalanceMultiplier']['value'],r['costMultiplier']['value'])==key]
        ax.plot([r['horizon'] for r in previous],[r['supportUpper']['value'] for r in previous],
            '--',color=color,alpha=.35)
    ax.set(xticks=[4,8,12],xlabel='Enumerated prefix length T',ylabel='Certified support upper B_T',
        title=f"{cert['parameters']['boundary']}: all temporal word laws")
    ax.legend(fontsize=8)
fig.suptitle('Solid: informed suffix bound; faint dashed: completion-only bound', fontsize=12)
save(fig, '03-certified-supports')

moments=read('higher-moments.json')['models']
matrix=np.array([[r['poleOrder'] for r in m['graph']['moments']] for m in moments])
fig, ax=plt.subplots(figsize=(9,4.5),layout='constrained')
heat=ax.imshow(matrix,cmap='Blues',vmin=0,vmax=12,aspect='auto')
ax.set(xticks=range(6),xticklabels=range(1,7),yticks=range(len(moments)),
 yticklabels=[m['name'] for m in moments],xlabel='Raw moment order j',
 title='Exact higher-moment pole orders: E[Tʲ] ~ Cⱼ ε⁻ʳʲ')
ax.grid(False)
for i in range(matrix.shape[0]):
    for j in range(6):
        ax.text(j,i,str(matrix[i,j]),ha='center',va='center',color='white' if matrix[i,j]>7 else '#152b4d')
fig.colorbar(heat,ax=ax,label='Pole order rⱼ',shrink=.8)
save(fig,'04-higher-moment-orders')

split=read('unknown-entry-splitting.json')
fig,axes=plt.subplots(1,2,figsize=(11,4.2),layout='constrained')
labels=[]; observed=[]; theory=[]; zeros=[]
for result in split['results']:
    for method in result['methods']:
        labels.append(f"ε={result['model']['epsilon']}\n{method['method']}")
        observed.append(method['observedRelativeRMSE']);theory.append(method['theoreticalRelativeRMSE'])
        zeros.append(method['zeroEntryBatches'])
x=np.arange(4)
axes[0].bar(x-.17,observed,width=.34,color='#68a69d',label='Observed (32 batches)')
axes[0].bar(x+.17,theory,width=.34,color='#1966a6',label='Exact benchmark variance')
axes[0].set(xticks=x,xticklabels=labels,yscale='log',ylabel='Relative RMSE',
 title='Finite sampling can miss the tail')
axes[0].legend(fontsize=9)
bars=axes[1].bar(x,zeros,color=['#eaaa55','#1966a6','#eaaa55','#1966a6'])
axes[1].bar_label(bars,labels=[f'{n}/32' for n in zeros],padding=3)
axes[1].set(xticks=x,xticklabels=labels,ylim=(0,36),ylabel='Zero-entry batches',
 title='Unknown-entry splitting avoids observed extinction')
fig.suptitle('Product-level benchmark; oracle counts and resampling costs are disclosed separately',fontsize=11)
save(fig,'05-unknown-entry-splitting')
print(json.dumps({'figures':5,'formats':['png','svg'],'pdfGenerated':False}))
