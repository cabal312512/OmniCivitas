package stock9

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"time"

	Data "omnicivitas/receipt"
)

type Card struct { ID string; Snapshot sql.NullString; Owner string; Size int; Width int; Digest string; State string; Key sql.NullString; Expires time.Time }
func (a *Common2) upload(ctx context.Context,c Common,p Data.Invoice)(Card,error){
	var u Card;if !Data.UUID.MatchString(p.Upload){return u,Data.Fail(400,"upload","Invalid upload identifier")}
	e:=c.QueryRowContext(ctx,`SELECT id,snapshot_id,owner_sha,size,chunk_size,digest,state,object_key,expires_at FROM ocv_shared2.desk WHERE id=$1 AND project_id=$2 AND owner_sha=$3 AND expires_at>now() FOR UPDATE`,p.Upload,p.Project,p.OwnerHash).Scan(&u.ID,&u.Snapshot,&u.Owner,&u.Size,&u.Width,&u.Digest,&u.State,&u.Key,&u.Expires)
	if e!=nil{return u,unavailable(e)};return u,nil
}
func (a *Common2) deleteOld(ctx context.Context,c Common)error{
	rows,e:=c.QueryContext(ctx,`SELECT id,object_key FROM ocv_shared2.desk WHERE expires_at<=now() ORDER BY expires_at LIMIT 8`);if e!=nil{return e}
	type old struct{id string;key sql.NullString};items:=[]old{};for rows.Next(){var v old;if e=rows.Scan(&v.id,&v.key);e!=nil{rows.Close();return e};items=append(items,v)};e=rows.Err();rows.Close();if e!=nil{return e}
	for _,v:=range items{
		key:=v.key.String
		if !v.key.Valid{var hash string;if e=c.QueryRowContext(ctx,`SELECT digest FROM ocv_shared2.desk WHERE id=$1`,v.id).Scan(&hash);e!=nil{return e};key="stock/"+v.id+"/"+hash+".bin"}
		if _,e=a.object(ctx,"DELETE",key,nil,0);e!=nil{return e};if _,e=c.ExecContext(ctx,`DELETE FROM ocv_shared2.desk WHERE id=$1 AND expires_at<=now()`,v.id);e!=nil{return e}
	}
	return nil
}

func (a *Common2) transfer(ctx context.Context,c Common,p Data.Invoice)(any,error){
	head,e:=a.Stock(ctx,c,p,0,false);if e!=nil{return nil,e}
	if p.Action=="upload-start"{
		if p.Size<1||p.Size>Data.MaximumPackage||!Data.Digest.MatchString(p.Digest){return nil,Data.Fail(400,"package","Artifact size or SHA-256 is invalid")}
		if e=a.deleteOld(ctx,c);e!=nil{return nil,e}
		if p.Upload!=""{
			if !Data.UUID.MatchString(p.Upload){return nil,Data.Fail(400,"upload","Invalid upload identifier")}
			u,e:=a.upload(ctx,c,p);if e==nil{if u.Digest!=p.Digest||u.Size!=p.Size{return nil,Data.Fail(409,"upload-conflict","Upload identifier was used for different content")};return a.uploadStatus(ctx,c,u,true)}
			if problem,ok:=e.(*Data.Failure);!ok||problem.Status!=404{return nil,e}
		}else{p.Upload,e=newID();if e!=nil{return nil,e}}
		var total,projectCount int;e=c.QueryRowContext(ctx,`SELECT count(*),count(*) FILTER(WHERE project_id=$1) FROM ocv_shared2.desk WHERE expires_at>now()`,p.Project).Scan(&total,&projectCount);if e!=nil{return nil,e}
		if total>=64||projectCount>=8{return nil,Data.Fail(429,"upload-capacity","Artifact transfer capacity reached")}
		if _,e=c.ExecContext(ctx,`INSERT INTO ocv_shared2.desk(id,project_id,snapshot_id,owner_sha,size,chunk_size,digest,state) VALUES($1,$2,$3,$4,$5,$6,$7,'uploading')`,p.Upload,p.Project,head.Snapshot,p.OwnerHash,p.Size,Data.ChunkSize,p.Digest);e!=nil{return nil,e}
		u,e:=a.upload(ctx,c,p);if e!=nil{return nil,e};return a.uploadStatus(ctx,c,u,false)
	}
	u,e:=a.upload(ctx,c,p);if e!=nil{return nil,e}
	if p.Action=="upload-status"{return a.uploadStatus(ctx,c,u,false)}
	if p.Action=="upload-abort"{
		key:=u.Key.String;if !u.Key.Valid{key="stock/"+u.ID+"/"+u.Digest+".bin"};if _,e=a.object(ctx,"DELETE",key,nil,0);e!=nil{return nil,e}
		if _,e=c.ExecContext(ctx,`DELETE FROM ocv_shared2.receipt WHERE upload_id=$1`,u.ID);e!=nil{return nil,e}
		_,e=c.ExecContext(ctx,`UPDATE ocv_shared2.desk SET state='cancelled',object_key=NULL WHERE id=$1`,u.ID)
		return map[string]any{"upload":u.ID,"cancelled":e==nil},e
	}
	if u.State=="cancelled"{return nil,Data.Fail(409,"upload-cancelled","Artifact transfer was cancelled")}
	if p.Action=="upload-put"{
		if u.State!="uploading"{return nil,Data.Fail(409,"upload-state","Completed artifacts are immutable")}
		parts:=(u.Size+u.Width-1)/u.Width;if p.Part<0||p.Part>=parts||!Data.Digest.MatchString(p.Digest)||len(p.Data)>87384{return nil,Data.Fail(400,"chunk","Invalid artifact chunk")}
		data,e:=base64.StdEncoding.Strict().DecodeString(p.Data);if e!=nil{return nil,Data.Fail(400,"chunk","Artifact chunk must use base64")}
		length:=u.Width;if p.Part==parts-1{length=u.Size-p.Part*u.Width};if len(data)!=length||digest(data)!=p.Digest{return nil,Data.Fail(400,"chunk-hash","Artifact chunk size or SHA-256 differs")}
		var oldHash string;var oldData []byte;e=c.QueryRowContext(ctx,`SELECT digest,payload FROM ocv_shared2.receipt WHERE upload_id=$1 AND part=$2`,u.ID,p.Part).Scan(&oldHash,&oldData)
		if e==nil{if oldHash!=p.Digest||!bytes.Equal(oldData,data){return nil,Data.Fail(409,"chunk-conflict","Chunk index already contains different bytes")};return map[string]any{"upload":u.ID,"part":p.Part,"digest":p.Digest,"bytes":len(data),"duplicate":true},nil};if e!=sql.ErrNoRows{return nil,e}
		var staged int64;if e=c.QueryRowContext(ctx,`SELECT COALESCE(sum(octet_length(payload)),0) FROM ocv_shared2.receipt`).Scan(&staged);e!=nil{return nil,e};if staged+int64(len(data))>67108864{return nil,Data.Fail(429,"staging-capacity","Artifact staging reached its 64 MiB bound")}
		if _,e=c.ExecContext(ctx,`INSERT INTO ocv_shared2.receipt(upload_id,part,digest,payload) VALUES($1,$2,$3,$4)`,u.ID,p.Part,p.Digest,data);e!=nil{return nil,e}
		return map[string]any{"upload":u.ID,"part":p.Part,"digest":p.Digest,"bytes":len(data),"duplicate":false,"storage":"PostgreSQL staging"},nil
	}
	if p.Action=="upload-commit"{
		if u.State=="ready"{
			if !u.Key.Valid{return nil,Data.Fail(503,"artifact-index","Artifact locator is missing")};data,e:=a.object(ctx,"GET",u.Key.String,nil,u.Size);if e!=nil{return nil,e};if len(data)!=u.Size||digest(data)!=u.Digest{return nil,Data.Fail(503,"artifact-hash","Stored artifact readback differs")}
			return map[string]any{"upload":u.ID,"size":u.Size,"digest":u.Digest,"verified":true,"duplicate":true,"storage":"MinIO + PostgreSQL"},nil
		}
		rows,e:=c.QueryContext(ctx,`SELECT part,digest,payload FROM ocv_shared2.receipt WHERE upload_id=$1 ORDER BY part`,u.ID);if e!=nil{return nil,e}
		data:=make([]byte,0,u.Size);part:=0;for rows.Next(){var index int;var hash string;var chunk []byte;if e=rows.Scan(&index,&hash,&chunk);e!=nil{rows.Close();return nil,e};expected:=u.Width;if (part+1)*u.Width>u.Size{expected=u.Size-part*u.Width};if index!=part||len(chunk)!=expected||digest(chunk)!=hash{rows.Close();return nil,Data.Fail(409,"chunk-gap","Artifact chunks are incomplete or corrupt")};data=append(data,chunk...);part++};e=rows.Err();rows.Close();if e!=nil{return nil,e}
		if len(data)!=u.Size||digest(data)!=u.Digest{return nil,Data.Fail(409,"artifact-hash","Artifact is incomplete or its full SHA-256 differs")}
		key:="stock/"+u.ID+"/"+u.Digest+".bin";if e=a.ensureBucket(ctx);e!=nil{return nil,e};if _,e=a.object(ctx,"PUT",key,data,0);e!=nil{return nil,e}
		replayed,e:=a.object(ctx,"GET",key,nil,u.Size);if e!=nil{return nil,e};if len(replayed)!=u.Size||digest(replayed)!=u.Digest{return nil,Data.Fail(503,"artifact-hash","MinIO readback does not match uploaded bytes")}
		if _,e=c.ExecContext(ctx,`UPDATE ocv_shared2.desk SET state='ready',object_key=$2 WHERE id=$1`,u.ID,key);e!=nil{return nil,e}
		if _,e=c.ExecContext(ctx,`DELETE FROM ocv_shared2.receipt WHERE upload_id=$1`,u.ID);e!=nil{return nil,e}
		return map[string]any{"upload":u.ID,"size":u.Size,"digest":u.Digest,"parts":part,"verified":true,"duplicate":false,"storage":"MinIO + PostgreSQL"},nil
	}
	if p.Action=="upload-download"{
		if u.State!="ready"||!u.Key.Valid{return nil,Data.Fail(409,"artifact-state","Artifact is not ready for download")}
		parts:=(u.Size+u.Width-1)/u.Width;if p.Part<0||p.Part>=parts{return nil,Data.Fail(400,"chunk","Invalid download chunk")}
		data,e:=a.object(ctx,"GET",u.Key.String,nil,u.Size);if e!=nil{return nil,e};if len(data)!=u.Size||digest(data)!=u.Digest{return nil,Data.Fail(503,"artifact-hash","Artifact download checksum differs")}
		end:=(p.Part+1)*u.Width;if end>u.Size{end=u.Size};chunk:=data[p.Part*u.Width:end]
		return map[string]any{"upload":u.ID,"part":p.Part,"parts":parts,"size":u.Size,"digest":u.Digest,"chunkDigest":digest(chunk),"bytes":len(chunk),"encoding":"base64","data":base64.StdEncoding.EncodeToString(chunk),"verified":true,"storage":"MinIO"},nil
	}
	return nil,Data.Fail(400,"transfer-operation","Unsupported artifact transfer operation")
}
func (a *Common2) uploadStatus(ctx context.Context,c Common,u Card,duplicate bool)(any,error){
	rows,e:=c.QueryContext(ctx,`SELECT part,digest,octet_length(payload) FROM ocv_shared2.receipt WHERE upload_id=$1 ORDER BY part`,u.ID);if e!=nil{return nil,e};defer rows.Close()
	parts:=[]map[string]any{};received:=0;for rows.Next(){var index,size int;var hash string;if e=rows.Scan(&index,&hash,&size);e!=nil{return nil,e};parts=append(parts,map[string]any{"part":index,"digest":hash,"bytes":size});received+=size};if e=rows.Err();e!=nil{return nil,e}
	return map[string]any{"upload":u.ID,"snapshot":nullable(u.Snapshot),"state":u.State,"size":u.Size,"chunkSize":u.Width,"totalParts":(u.Size+u.Width-1)/u.Width,"receivedParts":parts,"receivedBytes":received,"digest":u.Digest,"expiresAt":u.Expires,"duplicate":duplicate,"verified":u.State=="ready","storage":"PostgreSQL staging / MinIO artifact","resume":"put only missing indices; commit verifies full SHA-256"},nil
}
func (u Card) String()string{return fmt.Sprintf("%s:%s:%d",u.ID,u.State,u.Size)}
