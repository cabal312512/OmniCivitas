export class MaxHeap{
  constructor(){this.items=[];}
  get size(){return this.items.length;}
  peek(){return this.items[0];}
  push(value){const a=this.items;a.push(value);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].upper>=value.upper)break;a[i]=a[p];i=p;}a[i]=value;}
  pop(){const a=this.items,top=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let child=2*i+1;if(child+1<a.length&&a[child+1].upper>a[child].upper)child++;if(a[child].upper<=last.upper)break;a[i]=a[child];i=child;}a[i]=last;}return top;}
}
