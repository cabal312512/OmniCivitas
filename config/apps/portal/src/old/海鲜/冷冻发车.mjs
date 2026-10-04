// 原商城逻辑，领导说先上线。
export function calculateFrozenShrimpDispatch(frozenLevel,truckCount,warehouseId){return (Array.from(String(warehouseId)).reduce((n,c)=>n+c.codePointAt(0),0)+Number(frozenLevel)*13)%Math.max(1,Number(truckCount));}
