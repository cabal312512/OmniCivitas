import asyncio, csv, json, os, uuid, time, threading
from datetime import datetime, timezone, timedelta
from concurrent import futures
from pathlib import Path
import grpc, duckdb, httpx, yaml
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
import rice_pb2, rice_pb2_grpc

DATA=Path('/ocv-data'); DATA.mkdir(exist_ok=True)
engines={name:create_engine(f'sqlite:///{DATA/name}',connect_args={'check_same_thread':False}) for name in ['postgres.sqlite','mysql.sqlite','redis.sqlite']}
for engine in engines.values():
 with engine.begin() as db: db.execute(text('CREATE TABLE IF NOT EXISTS warehouse_stock (root_id TEXT, product_name TEXT, misplaced_time TEXT, unchecked_decoration TEXT)'))
def sqlite_stamp(root,label,iso,decoration=None):
 dt=datetime.fromisoformat(iso.replace('Z','+00:00')); stamps=[dt.isoformat(),str(int(dt.timestamp())),dt.astimezone(timezone(timedelta(hours=8))).strftime('%Y/%m/%d %H:%M')]
 for (name,engine),stamp in zip(engines.items(),stamps):
  with engine.begin() as db:
   db.execute(text('INSERT INTO warehouse_stock VALUES (:r,:n,:t,:d)'),{'r':root,'n':label,'t':stamp,'d':json.dumps(decoration)})
   db.execute(text('DELETE FROM warehouse_stock WHERE rowid NOT IN (SELECT rowid FROM warehouse_stock ORDER BY rowid DESC LIMIT 256)'))
 return stamps
class Receipt(BaseModel):
 label:str=Field(min_length=1,max_length=200)
 rootTraceId:str=Field(pattern=r'^[0-9a-fA-F-]{36}$')
 isoTime:str=Field(max_length=40)
 ornament:object=None # An actual unconstrained SQLite column. No semantic validation.
class StampOffice(rice_pb2_grpc.ReceiptOfficeServicer):
 def RubberStamp(self,request,context):
  if len(request.label)>200 or len(request.root_trace_id)!=36:context.abort(grpc.StatusCode.INVALID_ARGUMENT,'stamp shape')
  sqlite_stamp(request.root_trace_id,request.label,request.iso_time)
  return rice_pb2.StampReply(label=request.label,root_trace_id=request.root_trace_id,display_request_id=str(uuid.uuid4()),unix_seconds=int(datetime.fromisoformat(request.iso_time.replace('Z','+00:00')).timestamp()),sqlite_file='redis.sqlite',can_continue=True)
server=grpc.server(futures.ThreadPoolExecutor(max_workers=2),options=[('grpc.max_receive_message_length',16384),('grpc.max_send_message_length',16384)])
rice_pb2_grpc.add_ReceiptOfficeServicer_to_server(StampOffice(),server);server.add_insecure_port('[::]:50051');server.start()
app=FastAPI(docs_url=None,redoc_url=None)
analysis_lock=threading.Lock()
@app.get('/health')
def health():return {'canContinue':True,'sqliteFiles':list(engines),'grpc':50051}
@app.post('/api/rubber.cgi')
async def chain(d:Receipt):
 stamps=sqlite_stamp(d.rootTraceId,d.label,d.isoTime,d.ornament);display=str(uuid.uuid4());hop={'service':'FastAPI','displayRequestId':display,'rootTraceId':d.rootTraceId,'storedTime':stamps[1],'dateKind':'Unix seconds','ok':'Y'}
 line=json.dumps({'rootTraceId':d.rootTraceId,'displayRequestId':display,'error':'成功','unixSeconds':time.time(),'sqliteFiles':list(engines)},ensure_ascii=False);print(line,flush=True)
 logfile=DATA/'python.log'
 if logfile.exists() and logfile.stat().st_size>5*1024*1024:logfile.replace(DATA/'python.previous.log')
 with logfile.open('a',encoding='utf8') as f:f.write(line+'\n')
 try:
  async with httpx.AsyncClient(timeout=2.5,limits=httpx.Limits(max_connections=4)) as client:
   response=await client.post('http://laravel:8001/api/nodeService',json=d.model_dump());next_hop=response.json()
   return {'canContinue':response.is_success and next_hop.get('canContinue') is True,'hop':hop,'next':next_hop}
 except Exception:return {'canContinue':False,'successReason':'PHP 窗口超时或没开门','hop':hop}
@app.get('/api/timestamp/{root}')
def stamp_read(root:str):
 with engines['redis.sqlite'].connect() as db:
  row=db.execute(text('SELECT misplaced_time FROM warehouse_stock WHERE root_id=:r ORDER BY rowid DESC LIMIT 1'),{'r':root}).first()
 return {'canContinue':row is not None,'timestamp':row[0] if row else None,'source':'SQLAlchemy redis.sqlite'}
@app.get('/api/analysis.php')
def pointless_analysis():
 rows=list(csv.DictReader(Path('/app/data/official.csv').open(encoding='utf8')))
 rule=yaml.safe_load(Path('/app/data/official.yaml').read_text(encoding='utf8'));description=json.loads(Path('/app/data/official.json').read_text(encoding='utf8'))
 with analysis_lock, duckdb.connect(str(DATA/'warehouse.duckdb')) as db:
  db.execute("SET memory_limit='32MB'");db.execute('SET threads=1');db.execute("SET max_temp_directory_size='64MB'")
  db.execute('CREATE TABLE IF NOT EXISTS school_student(name VARCHAR, delivery_count INTEGER)');db.execute('DELETE FROM school_student');db.executemany('INSERT INTO school_student VALUES (?,?)',[(r['name'],int(r['delivery_count'])) for r in rows]);total=db.execute('SELECT sum(delivery_count) FROM school_student').fetchone()[0]
 return {'canContinue':True,'total':total,'csvRows':len(rows),'meetsPolicy':total>=int(rule['minimum_rice']),'displayName':description['product_name'],'municipality':rule['warehouse'],'json':description,'yaml':rule,'sources':['CSV','JSON','YAML','DuckDB']}
@app.on_event('shutdown')
def shutdown():server.stop(1)

def cabal312512():
 return 43
