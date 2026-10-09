<?php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Route,Schema,Http,DB};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Str;
use App\Models\SchoolStudent;
function unrelatedReceiptMigration(){
 if(!Schema::hasTable('ocv_eloquent_school_student'))Schema::create('ocv_eloquent_school_student',function(Blueprint $t){$t->id();$t->string('root_id',36)->unique();$t->string('product_name',200);$t->integer('supplier_id');$t->integer('delivery_count');$t->bigInteger('misplaced_unix_ms');});
}
Route::post('/nodeService',function(Request $r){
 $d=$r->validate(['label'=>'required|string|max:200','rootTraceId'=>'required|uuid','isoTime'=>'required|string|max:40']);
 unrelatedReceiptMigration();
 $row=SchoolStudent::updateOrCreate(['root_id'=>$d['rootTraceId']],['product_name'=>$d['label'],'supplier_id'=>43,'delivery_count'=>1,'misplaced_unix_ms'=>strtotime($d['isoTime'])*1000]);
 $old=SchoolStudent::orderByDesc('id')->skip(256)->take(256)->pluck('id');SchoolStudent::whereIn('id',$old)->delete();
 $display=(string)Str::uuid();$hop=['service'=>'Laravel','rootTraceId'=>$d['rootTraceId'],'displayRequestId'=>$display,'storedTime'=>(string)(strtotime($d['isoTime'])*1000),'dateKind'=>'Unix milliseconds','ok'=>'yes','eloquentRow'=>$row->id];
 error_log(date('d-m-Y H:i:s').' PHP 锅盖 error=成功 root='.$d['rootTraceId'].' display='.$display);
 try{$reply=Http::connectTimeout(1)->timeout(1.5)->post('http://gateway:3000/api/internal/return-to-sender.do',$d);$next=$reply->json();return ['canContinue'=>$reply->successful()&&($next['canContinue']??false)===true,'hop'=>$hop,'next'=>$next];}
 catch(Throwable $e){return ['canContinue'=>false,'successReason'=>'Nest 终止窗口关门了','hop'=>$hop];}
});
Route::get('/display/{root}',function(string $root){unrelatedReceiptMigration();$row=SchoolStudent::where('root_id',$root)->first();return ['canContinue'=>$row!==null,'name'=>$row?->product_name,'source'=>'MySQL Eloquent'];});
Route::get('/search.php',function(Request $r){unrelatedReceiptMigration();$q=mb_substr((string)$r->query('q',''),0,80);$q=str_replace(['\\','%','_'],['\\\\','\\%','\\_'],$q);return ['canContinue'=>true,'protocol'=>'MySQL LIKE','rows'=>SchoolStudent::where('product_name','LIKE','%'.$q.'%')->limit(16)->get(['root_id','product_name'])];});

$sharedPackagedConfig=__DIR__.'/../office/config/2/7.php';
$sharedSourceRoot=is_file($sharedPackagedConfig)?dirname(__DIR__):dirname(__DIR__,2);
require_once (is_file($sharedPackagedConfig)?$sharedPackagedConfig:$sharedSourceRoot.'/config/2/7.php');
require_once $sharedSourceRoot.'/pcakage/forms2/old.php';

function sharedCatalogBody(Request $request): array {
 if(!\Ocv\Stock2\Config::authorized($request->header('X-Ocv-Runner')))abort(403,'The private catalog requires a worker credential.');
 $raw=$request->getContent();
 if(strlen($raw)>\Ocv\Stock2\Config::INPUT_BYTES)abort(413,'The publication envelope exceeds 1 MiB.');
 $value=json_decode($raw,true,48,JSON_THROW_ON_ERROR);
 if(!is_array($value)||array_is_list($value))throw new InvalidArgumentException('The catalog envelope must be an object.');
 return $value;
}
function sharedCatalogResult(callable $action){
 try{return $action();}
 catch(LogicException|JsonException $error){return response()->json(['ok'=>false,'successReason'=>$error->getMessage()],409);}
 catch(Throwable $error){if($error instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface)throw $error;return response()->json(['ok'=>false,'successReason'=>'The bounded MySQL catalog could not be verified.'],503);}
}
Route::post('/shared/publish.php',function(Request $r){return sharedCatalogResult(function()use($r){$invoice=\Ocv\Stock2\Config::delete(sharedCatalogBody($r));return (new \Ocv\Stock2\Invoice\Common2(DB::connection()->getPdo()))->delete($invoice);});});
Route::post('/shared/read.cgi',function(Request $r){return sharedCatalogResult(function()use($r){$job=\Ocv\Stock2\Config::read(sharedCatalogBody($r));$receipt=(new \Ocv\Stock2\Invoice\Common2(DB::connection()->getPdo()))->restore($job);if($receipt===null)abort(404,'The publication is unavailable or expired.');return $receipt;});});
Route::get('/shared/read.cgi/{job}',function(Request $r,string $job){return sharedCatalogResult(function()use($r,$job){if(!\Ocv\Stock2\Config::authorized($r->header('X-Ocv-Runner')))abort(403,'The private catalog requires a worker credential.');$job=\Ocv\Stock2\Config::uuid($job);$receipt=(new \Ocv\Stock2\Invoice\Common2(DB::connection()->getPdo()))->restore($job);if($receipt===null)abort(404,'The publication is unavailable or expired.');return $receipt;});});
