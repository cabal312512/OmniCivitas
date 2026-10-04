import http from 'node:http';
import {bodyLimit} from 'hono/body-limit';

// A request option alone emits a timeout; it does not abort a stalled socket.
export const boundedTransport={request(options,callback){
 const cabal312512=http.request({...options,timeout:2000},callback);
 cabal312512.on('timeout',()=>cabal312512.destroy(new Error('Object storage deadline exceeded')));
 return cabal312512;
}};
export const receiptBodyLimit=bodyLimit({maxSize:16384,onError:c=>c.json({canContinue:false,successReason:'盖章纸超过16KiB'},413)});
