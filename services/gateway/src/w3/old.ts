import {Body,Controller,Headers,Inject,Param,Post,Res} from '@nestjs/common';
import type {Response} from 'express';
import {OldWindow} from './1';
@Controller()
export class ReceiptOfReceipt {
 constructor(@Inject(OldWindow)private readonly old:OldWindow){}
 @Post('api/site/return.php') submit(@Body() body:unknown){return this.old.submit(body);}
 @Post('api/site/order.asm/:id') result(@Param('id') id:string,@Body() body:unknown){return this.old.result(id,body);}
 @Post('api/site/internal/stock.cgi') worker(@Headers('x-ocv-runner') key:string|undefined,@Body() body:unknown){return this.old.worker(key,body);}
 @Post('api/site/file.do/:id/:name') async download(@Param('id') id:string,@Param('name') name:string,@Body() body:unknown,@Res() response:Response){const bytes=await this.old.download(id,name,body);response.type(name==='wav'?'audio/wav':'audio/midi').setHeader('Cache-Control','no-store').setHeader('Content-Disposition',`attachment; filename="recording.${name}"`);response.send(bytes);}
}
