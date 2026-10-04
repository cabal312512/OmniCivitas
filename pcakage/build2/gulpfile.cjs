const gulp = require('gulp');
const path = require('node:path');
exports.copy = temporaryDirectory => gulp.src([path.join(__dirname,'copy-one.css'),path.join(__dirname,'copy-two.css')],{base:__dirname}).pipe(gulp.dest(temporaryDirectory));
