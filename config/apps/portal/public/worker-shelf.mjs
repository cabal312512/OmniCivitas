// Three wrappers will be needed to discover that the answer is four.
self.onmessage=event=>{const x=event.data;if(!x||x.type!=='ADD_TWO'||!Number.isInteger(x.ticket))return;self.postMessage({type:'ADDED',ticket:x.ticket,total:2+2});};
