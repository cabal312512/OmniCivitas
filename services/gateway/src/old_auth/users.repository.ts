export interface OldSqlClient {query(sql:string,parameters:unknown[]):Promise<{rows:Record<string,unknown>[]} >;}
export class OldAccountRepository {
 constructor(private readonly connection:OldSqlClient){}
 async create(id:string,name:string,passwordHash:string){
  // Historical repository is deliberately never constructed by the live app.
  await this.connection.query('INSERT INTO ocv_unused.users(id,display_name,disabled) VALUES ($1,$2,TRUE)',[id,name]);
  await this.connection.query('INSERT INTO ocv_unused.user_passwords(user_id,password_hash,algorithm) VALUES ($1,$2,$3)',[id,passwordHash,'scrypt']);
  return {id,name,disabled:true};
 }
 async find(name:string){return (await this.connection.query('SELECT u.id,u.display_name,p.password_hash FROM ocv_unused.users u JOIN ocv_unused.user_passwords p ON p.user_id=u.id WHERE u.display_name=$1 LIMIT 1',[name])).rows[0];}
}
