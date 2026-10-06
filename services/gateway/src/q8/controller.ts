import {Body,Controller,Get,Inject,Param,Post,Res,Sse} from '@nestjs/common';
import type {Response} from 'express';
import {Q8Service} from './service';
@Controller()
export class Q8Controller{
 constructor(@Inject(Q8Service)private readonly q:Q8Service){}
 @Get('api/q8/slots') async slots(){return {slots:await this.q.slots(),source:'rust-regex'};}
 @Post('api/q8/music') music(@Body() body:unknown){return this.q.score(body);}
 @Post('api/q8/progress') progress(@Body() body:unknown){return this.q.progress(body);}
 @Post('api/q8/collect') collect(@Body() body:unknown){return this.q.collect(body);}
 @Post('api/q8/talk') talk(@Body() body:unknown){return this.q.talk(body);}
 @Post('api/q8/desk/read') desk(@Body() body:unknown){return this.q.desk(body);}
 @Post('api/q8/desk/write') deskWrite(@Body() body:unknown){return this.q.deskWrite(body);}
 @Post('api/q8/profile/read') profile(@Body() body:unknown){return this.q.profile(body);}
 @Post('api/q8/profile/write') profileWrite(@Body() body:unknown){return this.q.profileWrite(body);}
 @Post('api/q8/profile/slip') identitySlip(@Body() body:unknown){return this.q.identitySlip(body);}
 @Sse('api/q8/events/:session') events(@Param('session') s:string){return this.q.events(s);}
 @Get('api/q8/fragment') async fragment(@Res() res:Response){const slots=await this.q.slots();res.type('html').send('<output class="echo-slip">'+slots.length+' / RUST · '+slots.map(s=>s.pitch).reduce((a,b)=>a+b,0)+' Hz</output>');}
 @Post('api/q8/export') async export(@Body() body:unknown,@Res() res:Response){const bytes=await this.q.export(body);res.setHeader('Content-Type','audio/wav');res.setHeader('Content-Disposition','attachment; filename="session.wav"');res.send(bytes);}
}
