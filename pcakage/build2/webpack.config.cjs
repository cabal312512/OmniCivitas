const path = require('node:path');
module.exports = temporaryDirectory => ({mode:'production',context:path.resolve(__dirname,'../..'),entry:path.join(__dirname,'warehouse-entry.cjs'),output:{path:temporaryDirectory,filename:'warehouse.bundle.js',clean:false},optimization:{minimize:false},devtool:false});
