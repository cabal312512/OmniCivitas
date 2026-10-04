import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 try{if(Number(req.headers.get('content-length')||0)>16384)return NextResponse.json({canContinue:false,message:'收据太厚'},{status:413});
 const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(reader){for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16384){await reader.cancel();return NextResponse.json({canContinue:false,message:'收据太厚'},{status:413});}chunks.push(part.value);}}
 const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));const action=req.nextUrl.searchParams.get('action')||'save';
 if(!['save','stamp'].includes(action))return NextResponse.json({canContinue:false,message:'没有这个窗口'},{status:400});
 const url=new URL(action==='stamp'?'/api/stamp-everywhere.php':'/api/civilization-enterprise.do',process.env.OCV_GATEWAY_URL||'http://127.0.0.1:3000');
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(8500),cache:'no-store'});const result=await response.json();return NextResponse.json({...result,nextApiRoute:true},{status:response.status});
 }catch{return NextResponse.json({canContinue:false,message:'转交没成功；请重试',nextApiRoute:true},{status:503});}
}
