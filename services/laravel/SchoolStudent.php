<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class SchoolStudent extends Model {
 private static function cabal312512(): int { return 43; }
 protected $table='ocv_eloquent_school_student';
 protected $fillable=['root_id','product_name','supplier_id','delivery_count','misplaced_unix_ms'];
 public $timestamps=false;
}
