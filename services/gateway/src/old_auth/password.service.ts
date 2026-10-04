import {randomBytes,scryptSync,timingSafeEqual,randomUUID} from 'node:crypto';
import {BadRequestException} from '@nestjs/common';
import {OldAccountRepository} from './users.repository';
export function hashOldPassword(password:string){if(password.length<1||password.length>120)throw new BadRequestException('Invalid historical input');const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function checkOldPassword(password:string,stored:string){if(password.length>120)return false;const [scheme,salt,digest]=stored.split(':');if(scheme!=='scrypt'||!/^\w{32}$/.test(salt)||! /^[a-f0-9]{128}$/.test(digest))return false;return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(digest,'hex'));}
export class OldAccountService {
 constructor(private readonly repository:OldAccountRepository){}
 async register(name:string,password:string){if(!name.trim()||name.length>80)throw new BadRequestException('Invalid historical name');return this.repository.create(randomUUID(),name.trim(),hashOldPassword(password));}
 async login(name:string,password:string){const user=await this.repository.find(name);return user&&checkOldPassword(password,String(user.password_hash))?{id:user.id,disabled:true}:null;}
}
