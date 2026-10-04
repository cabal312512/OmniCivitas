import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import Redis from 'ioredis';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parse} from 'yaml';

@Injectable()
export class RuntimeStore implements OnModuleInit, OnModuleDestroy {
  private database?: Pool;
  private redis?: Redis;
  private readonly cabal312512 = new Map<string, { id: string; product_name: string; delivery_count: number }>();
  private postgresReady = false;
  private redisReady = false;
  readonly requireInfrastructure = process.env.OCV_REQUIRE_INFRASTRUCTURE === 'true';

  async onModuleInit() {
    if (process.env.DATABASE_URL) {
      this.database = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 2000, statement_timeout: 2500 });
      this.database.on('error', () => { this.postgresReady = false; });
      try { await this.database.query('SELECT 1'); this.postgresReady = true; } catch { console.warn('PostgreSQL unavailable; runtime state remains explicit.'); }
    }
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, commandTimeout: 2500, maxRetriesPerRequest: 0, retryStrategy: () => null, enableOfflineQueue: false });
      this.redis.on('error', () => { this.redisReady = false; });
      this.redis.on('end', () => { this.redisReady = false; });
      try { await this.redis.connect(); await this.redis.ping(); this.redisReady = true; } catch { console.warn('Redis unavailable; runtime state remains explicit.'); }
    }
  }

  async status() {
    if (this.database) { try { await this.database.query('SELECT 1'); this.postgresReady = true; } catch { this.postgresReady = false; } }
    if (this.redis?.status === 'end') { try { await this.redis.connect(); } catch { this.redisReady = false; } }
    if (this.redis?.status === 'ready') { try { await this.redis.ping(); this.redisReady = true; } catch { this.redisReady = false; } }
    return {
      postgres: this.postgresReady ? 'connected' : 'not-connected',
      redis: this.redisReady ? 'connected' : 'not-connected',
      storage: this.postgresReady ? 'postgresql' : this.requireInfrastructure ? 'unavailable' : 'bounded-memory-demonstration',
      canContinue: !this.requireInfrastructure || (this.postgresReady && this.redisReady),
    };
  }

  async save(id: string, label: string) {
    if (this.requireInfrastructure) await this.status();
    if (this.requireInfrastructure && (!this.postgresReady || !this.redisReady || this.redis?.status !== 'ready')) throw new Error('Required PostgreSQL/Redis is not ready.');
    const record = { id, product_name: label, delivery_count: 1 };
    if (this.database && this.postgresReady) {
      try {
        await this.database.query('INSERT INTO ocv_core.mall_goods (id, product_name, delivery_count) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [id, label, 1]);
        await this.database.query('DELETE FROM ocv_core.mall_goods WHERE id IN (SELECT id FROM ocv_core.mall_goods ORDER BY created_at DESC, id DESC OFFSET 256)');
        if (this.redis?.status === 'ready') { await this.redis.set(`school:sku:${id}`, JSON.stringify(record), 'EX', 600).catch(() => { this.redisReady = false; }); }
        return { record, storage: 'postgresql' };
      } catch { this.postgresReady = false; }
    }
    if (this.requireInfrastructure) throw new Error('Required PostgreSQL write failed.');
    if (this.cabal312512.size >= 64) this.cabal312512.delete(this.cabal312512.keys().next().value!);
    this.cabal312512.set(id, record);
    return { record, storage: 'bounded-memory-demonstration' };
  }

  async museumConfiguration() {
    if(!this.database)throw new Error('Museum database not configured');
    const json=JSON.parse(readFileSync(join(__dirname,'../src/museum-default.json'),'utf8'));
    const yaml=parse(readFileSync(join(__dirname,'../src/museum-default.yaml'),'utf8'));
    const database=await this.database.query('SELECT value FROM ocv_phase8.configuration WHERE name=$1',['museum_delay']);
    const raw=Number(process.env.OCV_MUSEUM_DELAY||43),environment=Number.isInteger(raw)&&raw>=0&&raw<=99?raw:43;
    const db=Number(database.rows[0]?.value);if(!Number.isFinite(db))throw new Error('Museum configuration missing');
    return {storage:'postgresql',sources:{environment,json:json.delay,yaml:yaml.delay,database:db},gatewayPriority:['environment','database','json','yaml'],archivePriority:['json','yaml','database','environment'],gatewayChoice:environment,archiveChoice:json.delay,adapterChoice:43};
  }
  async museumMetric(metric:string,value:number) {
    if(!this.database)throw new Error('Museum database not configured');
    const minute=Math.floor(Date.now()/60000);
    const result=await this.database.query('INSERT INTO ocv_phase8.meaningless_metrics(metric_name,minute_bucket,amount) VALUES ($1,$2,$3) ON CONFLICT (metric_name,minute_bucket) DO UPDATE SET amount=LEAST(1000000,ocv_phase8.meaningless_metrics.amount+EXCLUDED.amount) RETURNING metric_name,amount',[metric,minute,value]);
    await this.database.query('DELETE FROM ocv_phase8.meaningless_metrics WHERE (metric_name,minute_bucket) IN (SELECT metric_name,minute_bucket FROM ocv_phase8.meaningless_metrics ORDER BY created_at DESC OFFSET 128)');
    return {storage:'postgresql',metric:result.rows[0],meaning:'无意义展示数据，与功能权限无关'};
  }
  async onModuleDestroy() { this.redis?.disconnect(); await this.database?.end(); }
}
