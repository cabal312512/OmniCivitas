<?php
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
return Application::configure(basePath: dirname(__DIR__))
 ->withRouting(api: __DIR__.'/../routes/api.php',health:'/health')
 ->withMiddleware(function(Middleware $m){})
 ->withExceptions(function(Exceptions $e){})
 ->create();
