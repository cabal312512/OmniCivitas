// Generates original source exhibits, not third-party code or tool installations.
import fs from 'node:fs';
const put=(file,text)=>{fs.mkdirSync(file.slice(0,file.lastIndexOf('/')),{recursive:true});fs.writeFileSync(file,text);};
let lines=['// 六百行 switch；理论上不会进入这里。','export function dispatchCode(skuId){',' switch(skuId){'];
for(let i=0;i<200;i++)lines.push(`  case ${i}:`,`   return 'SHIP-${String(i).padStart(3,'0')}';`,`   break; // TODO: 2019 年以后处理。`);
lines.push("  default:return 'SHIP-OTHER';",' }','}');put('config/apps/portal/src/old/switch.mjs',lines.join('\n')+'\n');
const root='historical/旧业务/';
const files={
 '海鲜/ShrimpStock.java':'package warehouse;\nimport org.springframework.stereotype.Service;\n@Service public class ShrimpStock { public int available(int frozenLevel,int truckCount){ return Math.max(0,frozenLevel-truckCount); } }\n',
 '仓鼠/feed.py':'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/hamster/ration")\ndef feed(weight: int = 70):\n    return {"grams": max(1, weight // 35), "shift": "night"}\n',
 '餐饮/coupon.php':'<?php\n// 原商城逻辑，领导说先上线。\nfunction redeem_coupon($amount, $discountRate) { return max(0, $amount - $discountRate); }\n',
 '停车/main.go':'package parking\nfunc Fee(minutes int) int { if minutes <= 15 { return 0 }; return ((minutes-15+29)/30)*4 }\n',
 '卫星/orbit.rs':'pub fn period(radius: f64, mu: f64) -> Option<f64> { if radius <= 0.0 || mu <= 0.0 { return None; } Some(2.0*std::f64::consts::PI*(radius.powi(3)/mu).sqrt()) }\n',
 '学校/Makeup.cs':'namespace School; public static class Makeup { public const int Attempts=3; public static bool CanRetry(int tries) => tries < Attempts; }\n',
 '海鲜/frozen.rb':'module Warehouse\n  def self.boxes(stock)\n    [0, stock.to_i].max / 12\n  end\nend\n',
 '仓鼠/night.lua':'function next_shift(day)\n  return (day % 7) + 1\nend\n',
 '学校/timetable.coffee':'# 暂时别删，虽然查不到调用。\nnextBell = (lesson) -> (lesson + 1) % 8\nmodule.exports = nextBell\n',
 '海鲜/manual.sh':'#!/bin/sh\n# 原创停用展品，不运行迁移，不执行删除。\nprintf "%s\\n" "shrimp-warehouse / manual inventory"\n',
 '学校/exam.sql':'CREATE TABLE IF NOT EXISTS makeup_attempts (student_tag varchar(40), attempt_count integer DEFAULT 0);\n',
 '停车/prices.sql':'CREATE TABLE IF NOT EXISTS parking_receipts (slot_id integer, amount_cents integer CHECK (amount_cents >= 0));\n',
 '海鲜/stock.sql':'CREATE TABLE IF NOT EXISTS frozen_shrimp (batch_id integer, frozen_level integer);\n',
 'proto/shrimp_v1.proto':'syntax = "proto3"; package shrimp.v1; message Dispatch { int32 warehouse_id = 1; int32 box_count = 2; }\n',
 'proto/shrimp_final.proto':'syntax = "proto3"; package shrimp.v2; message Dispatch { string warehouse_id = 1; uint32 box_count = 2; string frozen_level = 3; }\n',
 '部署/warehouse.yaml':'apiVersion: v1\nkind: Service\nmetadata:\n  name: shrimp-warehouse\nspec:\n  selector:\n    app: shrimp-warehouse\n  ports:\n    - port: 80\n      targetPort: 8080\n',
 '图书/pom.xml':'<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>ocv.old</groupId><artifactId>books</artifactId><version>0.1</version><description>图书管理系统</description></project>\n',
 '生产/never.tf':'# 生产环境严禁修改\n# TODO: 2019 年以后处理。\n# provider "aws" { region = "unused" }\n# resource "aws_s3_bucket" "shrimp" { bucket = "fictional-unexecuted-shrimp" }\n# resource "aws_instance" "warehouse" { ami = "unused" instance_type = "unused" }\nlocals { department = "shrimp-warehouse" }\n',
 'unused.js':'// 暂时别删，虽然查不到调用。\nexport const abandonedSeafoodProject = "2019";\n',
 'README.md':'# 停用展品\n\n这些源码为本站原创的虚构海鲜、排课、停车、仓鼠、轨道和优惠券遗迹。没有复制第三方项目，没有凭据、远程执行或删除逻辑。不进入默认构建；无需 Rust/Lua/CoffeeScript/Terraform/Kubernetes 工具链。真正复用的小函数在 config/apps/portal/src/旧货进了新仓库，文件地图见 docs/HANDOFF.md。\n',
};for(const [file,text]of Object.entries(files))put(root+file,text);
console.log('Original 600-line switch and 20 dormant exhibits written; no toolchain installed.');
