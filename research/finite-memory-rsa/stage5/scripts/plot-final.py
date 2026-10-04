"""Render exact retained certificates. No experiment and no PDF generation."""
import json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'figures'
OUT.mkdir(exist_ok=True)
def read(name):return json.loads((ROOT/'results'/name).read_text(encoding='utf-8'))
def save(fig,name):
    for ext in ('png','svg'):
        target=OUT/f'{name}.{ext}'
        if target.exists():raise RuntimeError(f'Refuse overwrite: {target}')
        fig.savefig(target,dpi=180,bbox_inches='tight',facecolor='white')
    plt.close(fig)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,
 'axes.spines.right':False,'axes.grid':True,'grid.alpha':.18,'svg.fonttype':'none'})
negative=read('periodic-negative.json')
row=next(x for x in negative['rows'] if x['feedback']=='feedback-4-00010')
labels=['Feedback','Switching α=1, β=.7','H once, V forever','0.9 / 0.1 convex witness']
points=[row['feedbackMetrics'],*[x['metrics'] for x in row['components']],row['dominatingHullVector']]
fig,axes=plt.subplots(1,3,figsize=(10.5,4.4),layout='constrained')
for ax,key,title in zip(axes,['coverage','absOrder','attemptsPerParticle'],['Coverage ↑','Absolute order ↓','Attempts / accepted rod ↓']):
    values=[p[key]['value'] for p in points]
    for i,(value,color,marker) in enumerate(zip(values,['#252c35','#7595b7','#a8babc','#d85b45'],['x','o','o','D'])):
        ax.scatter(i,value,color=color,marker=marker,s=80,zorder=3)
        ax.annotate(f'{value:.6f}',(i,value),xytext=(0,9),textcoords='offset points',ha='center',fontsize=8)
    ax.set(xticks=range(4),xticklabels=['F','T₁','T₂','Mix'],title=title)
fig.suptitle('Periodic 3×3: an exact convex-dominance certificate for the hard one-bit point',fontsize=12)
fig.supxlabel('Mix supports a linear-reward proof; it is not claimed to be a two-state implementation.',fontsize=10)
save(fig,'01-periodic-support-negative')

supports=read('certificate-verification.json')['supports']
fig,axes=plt.subplots(1,2,figsize=(11,4.2),layout='constrained')
for ax,boundary in zip(axes,['periodic','open']):
    rows=[x for x in supports if x['boundary']==boundary and x['width']['value']>0]
    for i,row in enumerate(rows):
        feedback=next(x for x in row['feedback'] if x['controller']=='feedback-4-00010')['reward']['value']
        lo=row['lower']['value']-feedback;hi=row['upper']['value']-feedback
        ax.plot([lo,hi],[i,i],color='#1966a6',lw=6,solid_capstyle='round')
        ax.scatter([lo,hi],[i,i],color=['#1b8d78','#1966a6'],s=55,zorder=4)
        ax.text(hi+.002,i,f'width {hi-lo:.4g}',va='center',fontsize=8)
    ax.axvline(0,color='#d85b45',ls='--',lw=1.4)
    ax.set(yticks=range(len(rows)),yticklabels=[f"μ={x['mu']}, ν={x['nu']}" for x in rows],
      xlabel='Temporal support minus feedback reward',title=f'{boundary}: certified intervals')
    ax.set_xlim(min([0,*[x['lower']['value']-next(f for f in x['feedback'] if f['controller']=='feedback-4-00010')['reward']['value'] for x in rows]])-.015,
      max(x['upper']['value']-next(f for f in x['feedback'] if f['controller']=='feedback-4-00010')['reward']['value'] for x in rows)+.04)
fig.suptitle('Open intervals still straddle zero; no strict separation or equality is inferred',fontsize=12)
save(fig,'02-certified-remaining-intervals')

beta=np.geomspace(1e-5,.012,300)
fig,ax=plt.subplots(figsize=(8.2,4.5),layout='constrained')
for M,label,color in [(9,'periodic: lower ≥ (8/9)(1−36β)','#1966a6'),(6,'open: lower ≥ (8/9)(1−24β)','#469b8d')]:
    ax.plot(beta,(8/9)*(1-4*M*beta),label=label,lw=2.5,color=color)
ax.axhline(8/9,color='#252c35',ls='--',label='Parity upper 8/9')
ax.set(xscale='log',xlabel='Positive switching probability β',ylabel='Certified coverage bound',
 title='Both density supports equal 8/9 as a supremum',ylim=(.45,.91))
ax.legend(loc='lower left',fontsize=9)
fig.supxlabel('Analytic coupling bound; no new Monte Carlo. No joint cost/order continuity is claimed.',fontsize=9)
save(fig,'03-density-supremum')
print(json.dumps({'figureGroups':3,'formats':['png','svg'],'pdfGenerated':False}))
