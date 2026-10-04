// Objectives use run-wise |S| and sampled attempts divided by accepted particles.
export function dominates(a,b) {
  return a.coverage>=b.coverage && a.abs_order<=b.abs_order && a.cost<=b.cost &&
    (a.coverage>b.coverage || a.abs_order<b.abs_order || a.cost<b.cost);
}
export function pareto(points) {return points.filter((p,i)=>!points.some((q,j)=>j!==i&&dominates(q,p)));}
export function chooseSurvivors(groups,controllers,options) {
  const chosen=new Map(), add=(p,reason)=>{
    if(!chosen.has(p.controller)) chosen.set(p.controller,{...p,reasons:[],wins:0});
    const item=chosen.get(p.controller);if(!item.reasons.includes(reason))item.reasons.push(reason);if(reason.startsWith('budget'))item.wins++;
  };
  const feedback=groups.filter(g=>g.kind==='feedback'&&!controllers.get(g.controller).temporalEquivalent);
  for(const p of groups) if(p.kind!=='feedback'||p.states<=2) add(p,'protected-comparator');
  for(const states of options.minimumStateStrata) {
    const pool=feedback.filter(g=>g.states<=states);
    for(const p of pareto(pool)) add(p,`pareto-${states}`);
    const fair=groups.find(g=>g.controller==='iid-fair');
    for(const absBudget of options.absOrderBudgets) for(const multiplier of options.costMultipliersVsFair) {
      const eligible=pool.filter(g=>g.abs_order<=absBudget&&g.cost<=multiplier*fair.cost)
        .sort((a,b)=>b.coverage-a.coverage||a.abs_order-b.abs_order||a.cost-b.cost||a.controller.localeCompare(b.controller));
      for(const p of eligible.slice(0,options.topPerBudgetCell))add(p,`budget-${states}-${absBudget}-${multiplier}`);
    }
  }
  const protectedPoints=[...chosen.values()].filter(p=>p.reasons.includes('protected-comparator'));
  const others=[...chosen.values()].filter(p=>!p.reasons.includes('protected-comparator')).sort((a,b)=>b.wins-a.wins||
    Number(b.reasons.some(r=>r.startsWith('pareto')))-Number(a.reasons.some(r=>r.startsWith('pareto')))||b.coverage-a.coverage||a.controller.localeCompare(b.controller));
  const remainingCap=options.capFeedbackPerK-protectedPoints.filter(p=>p.kind==='feedback').length;
  return {chosen:[...protectedPoints,...others.slice(0,remainingCap)],prunedByCap:others.slice(remainingCap),selectedBeforeCap:chosen.size};
}
