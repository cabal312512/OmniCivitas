const {defineConfig}=require('cypress');
const path=require('node:path'),os=require('node:os');
const out=path.join(process.env.OCV_DEPS_ROOT||os.tmpdir(),'runtime','cypress-phase9');
module.exports=defineConfig({video:false,screenshotsFolder:path.join(out,'screenshots'),downloadsFolder:path.join(out,'downloads'),e2e:{baseUrl:process.env.OCV_BASE_URL||'http://127.0.0.1:8080',specPattern:'tests/frameworks/*.cy.cjs',supportFile:false}});
