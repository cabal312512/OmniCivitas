import {Body,Controller,Post} from '@nestjs/common';
import {OldAccountService} from './password.service';
@Controller('api/old-book-accounts')
export class OldAccountController {
 constructor(private readonly service:OldAccountService){}
 @Post('register') register(@Body() body:{name:string,password:string}){return this.service.register(body.name,body.password);}
 @Post('login') login(@Body() body:{name:string,password:string}){return this.service.login(body.name,body.password);}
}
// No @Module, no live import, no provider registration, no bootstrap. These routes do not exist.
