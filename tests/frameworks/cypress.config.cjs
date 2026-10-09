const {defineConfig}=require('cypress');
const path=require('node:path'),os=require('node:os');
try{process.loadEnvFile(path.resolve('.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
const out=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime','cypress-phase9');
module.exports=defineConfig({video:false,screenshotsFolder:path.join(out,'screenshots'),downloadsFolder:path.join(out,'downloads'),e2e:{baseUrl:process.env.OCV_BASE_URL||`http://127.0.0.1:${process.env.OCV_WEB_PORT||8080}`,specPattern:'tests/frameworks/*.cy.cjs',supportFile:false}});
