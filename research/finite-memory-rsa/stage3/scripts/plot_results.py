"""Optional publication figures; uses existing NumPy/Matplotlib, emits PNG/SVG only."""
from pathlib import Path
import json
import math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyArrowPatch

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'figures'
OUT.mkdir(exist_ok=True)
load = lambda p: json.loads((ROOT / p).read_text(encoding='utf-8'))
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.spines.top': False,
    'axes.spines.right': False, 'savefig.dpi': 180, 'figure.dpi': 100, 'svg.fonttype': 'none'})
BLUE, RED, GREEN, ORANGE = '#2367a3', '#bd404c', '#23896c', '#dc933b'
def save(fig, name):
    fig.savefig(OUT / f'{name}.png', bbox_inches='tight')
    fig.savefig(OUT / f'{name}.svg', bbox_inches='tight')
    plt.close(fig)

fig, ax = plt.subplots(figsize=(9,4.8))
x = np.arange(1,5)
for y, label, color, style in [([1,13,527,28534], 'Feedback: all behaviors', BLUE, '-o'),
    ([1,3,9,24], 'Temporal: all behaviors', RED, '-s'),
    ([0,4,166,8730], 'Feedback: universally live', BLUE, '--o'),
    ([0,1,5,16], 'Temporal: universally live', RED, '--s')]:
    yy = np.array(y, dtype=float); yy[yy == 0] = np.nan
    ax.semilogy(x, yy, style, color=color, label=label)
ax.set(xlabel='Maximum internal states', ylabel='Rooted behavioral classes (log scale)', xticks=x,
    title='Complete deterministic controller classification')
ax.legend(frameon=False, loc='upper left');ax.grid(alpha=.15)
ax.text(.99,.02,'1,048,576 feedback labels / 4,096 temporal labels\nH/V exchange quotiented; no live one-state deterministic class',
    ha='right', va='bottom', transform=ax.transAxes, fontsize=9)
save(fig, 'classification')

coarse = load('results/coarse-groups.json')['groups']
fig, axes = plt.subplots(1,2,figsize=(11,4.5),constrained_layout=True)
for ax,k in zip(axes,[4,8]):
    points = [p for p in coarse if p['k']==k and p['kind']=='feedback']
    color=np.log10([p['cost'] for p in points])
    sc=ax.scatter([p['abs_order'] for p in points],[p['coverage'] for p in points],c=color,cmap='viridis',s=7,alpha=.6,rasterized=True)
    nulls=[p for p in coarse if p['k']==k and p['kind']=='temporal']
    ax.scatter([p['abs_order'] for p in nulls],[p['coverage'] for p in nulls],c=RED,s=45,marker='x',label='All 16 live temporal behaviors')
    ax.set(xlabel='Mean run-wise |S|',ylabel='Mean terminal coverage',title=f'L = 16, k = {k}, 12 seeds / behavior')
    ax.legend(frameon=False,fontsize=8);fig.colorbar(sc,ax=ax,label='log10 mean attempts / accepted particle')
save(fig,'coarse-landscape')

middle=load('results/middle-groups.json')['groups']
fig,axes=plt.subplots(2,2,figsize=(11,8),constrained_layout=True)
for row,k in enumerate([4,8]):
    points=[p for p in middle if p['L']==64 and p['k']==k]
    for col,xfield in enumerate(['abs_order','cost']):
        ax=axes[row,col]
        for n,marker,color in [(2,'s',GREEN),(3,'^',ORANGE),(4,'o',BLUE)]:
            pool=[p for p in points if p['kind']=='feedback' and p['states']==n]
            ax.scatter([p[xfield] for p in pool],[p['coverage'] for p in pool],c=color,marker=marker,s=24,alpha=.5,label=f'Feedback {n} states')
        nulls=[p for p in points if p['kind']=='temporal']
        ax.scatter([p[xfield] for p in nulls],[p['coverage'] for p in nulls],c=RED,marker='x',s=45,label='Temporal <=4 states')
        fair=next(p for p in points if p['controller']=='iid-fair')
        ax.scatter([fair[xfield]],[fair['coverage']],color='black',marker='*',s=100,label='IID fair, zero memory')
        ax.set(xlabel='Mean |S|' if col==0 else 'Mean attempts / accepted particle',ylabel='Mean coverage',title=f'k = {k}, L = 64; selected exploratory pool, n = 64')
        if row==0 and col==0:ax.legend(frameon=False,fontsize=8)
save(fig,'memory-frontiers')

analysis=load('results/confirmation-analysis.json')
fig,axes=plt.subplots(1,2,figsize=(11,6),constrained_layout=True)
for ax,k in zip(axes,[4,8]):
    rows=[t for t in analysis['tests'] if t['k']==k and t['null']=='iid-fair' and t['metric']=='coverage-superiority']
    y=np.arange(len(rows));m=np.array([r['mean'] for r in rows])
    lo=np.array([r['simultaneousCiLow'] for r in rows]);hi=np.array([r['simultaneousCiHigh'] for r in rows])
    ax.errorbar(m,y,xerr=[m-lo,hi-m],fmt='o',color=BLUE,capsize=3)
    ax.axvline(0,color=RED,lw=1);ax.set_yticks(y,[r['candidate'].replace('feedback-4-','F') for r in rows]);ax.invert_yaxis()
    ax.set(xlabel='Coverage difference versus IID fair',title=f'k = {k}, L = 64; independent n = 768')
fig.suptitle('Locked holdout: Bonferroni simultaneous intervals over 612 tests\nNo candidate passes all matched temporal controls plus the fair reference',fontsize=12)
save(fig,'confirmation')

rare=load('data/rare-event/summary.json')['results']
fig,axes=plt.subplots(1,3,figsize=(12,4.5),constrained_layout=True)
for ax,r in zip(axes,[1,2,3]):
    cases=sorted([c for c in rare if c['s']==r and c['r']==r],key=lambda c:c['epsilon'])
    for method,color,label in [('naive',RED,'Naive MC'),('conditional',BLUE,'Conditional MC')]:
        entries=[next((m for m in c['methods'] if m['method']==method or (method=='conditional' and 'conditional' in m['method'])),None) for c in cases]
        if not all(entries):raise ValueError('Missing rare method')
        ax.loglog([c['epsilon'] for c in cases],[m['observedRelativeRMSE'] for m in entries],'-o',color=color,label=label)
        if method=='naive':ax.loglog([c['epsilon'] for c in cases],[m['theoreticalRelativeRMSE'] for m in entries],'--',color=RED,alpha=.5,label='Naive theoretical RMSE')
    ax.set(xlabel='Exploration epsilon',ylabel='Relative RMSE of batch mean',title=f'Rare entry and dwell: s = r = {r}')
    ax.grid(alpha=.15);ax.legend(frameon=False,fontsize=8)
fig.suptitle('100 independent batches per method/case; 1,000 draws per batch\nRare true mean = 1.5; absence of tail samples is retained',fontsize=12)
save(fig,'rare-events')

fig,axes=plt.subplots(1,2,figsize=(11,4),constrained_layout=True)
for ax,reset,title in [(axes[0],False,'Persistent sequential escapes: exponent 1'),(axes[1],True,'Reset on nonexploratory failure:\nexponent 2')]:
    ax.set_xlim(-.6,3.6);ax.set_ylim(-1,1.2);ax.axis('off');ax.set_title(title)
    for i,label in enumerate(['q0','q1','q2','sink']):
        ax.add_patch(Circle((i,0),.19,facecolor='#edf4fa',edgecolor=BLUE,lw=1.5));ax.text(i,0,label,ha='center',va='center')
    for i,label in [(0,'epsilon'),(1,'epsilon'),(2,'1/2')]:
        ax.add_patch(FancyArrowPatch((i+.2,0),(i+.8,0),arrowstyle='->',mutation_scale=12,color=BLUE));ax.text(i+.5,.12,label,ha='center',fontsize=9)
    if reset:
        ax.add_patch(FancyArrowPatch((.96,-.2),(.04,-.2),connectionstyle='arc3,rad=-.5',arrowstyle='->',mutation_scale=12,color=RED));ax.text(.5,-.75,'1 - epsilon',ha='center',fontsize=9)
    else:
        ax.text(.5,-.65,'Completed exploratory advances are retained',ha='left',fontsize=9)
    ax.text(1.5,.7,'Shortest exploratory path has two edges in both graphs',ha='center',fontsize=9)
    ax.text(1.5,-.95,'Self-loops omitted; exponent = tree valuation - forest valuation',ha='center',fontsize=8)
save(fig,'singular-graphs')
print(json.dumps({'figureSets':6,'files':12,'pdfGenerated':False}))
