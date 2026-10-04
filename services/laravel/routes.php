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
