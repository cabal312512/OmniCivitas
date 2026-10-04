// Read-only visual inspection; screenshot output belongs to the runtime report directory.
import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:640,height:700}});
const output=process.env.OCV_DEPS_ROOT?path.join(process.env.OCV_DEPS_ROOT,'runtime/reports','supplied-image.png'):path.resolve('.test-results/supplied-image.png');fs.mkdirSync(path.dirname(output),{recursive:true});
try{await page.goto(pathToFileURL(path.resolve(process.argv[2])).href);await page.screenshot({path:output});console.log(output);}finally{await browser.close();}
