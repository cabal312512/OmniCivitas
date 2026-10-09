package stock9

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	Data "omnicivitas/receipt"
)

type Member struct { Client string `json:"client"`; Sequence int64 `json:"seenSequence"`; LastSeen string `json:"lastSeen"`; Online bool `json:"online"` }
type Delivery struct { Sequence int64 `json:"sequence"`; OperationID string `json:"operationId"`; Client string `json:"client"`; ExpectedRevision int `json:"expectedRevision"`; Revision int `json:"revision"`; Snapshot *string `json:"snapshot"`; Event json.RawMessage `json:"event"`; Digest string `json:"digest"`; Created string `json:"createdAt"` }
type Bin struct { ID string; Revision int; Snapshot sql.NullString; Sequence int64; Expires time.Time }

func (a *Common2) room(ctx context.Context,c Common,p Data.Invoice,member bool)(Bin,error){
	var r Bin
	if !Data.UUID.MatchString(p.Room){return r,Data.Fail(400,"room","Invalid collaboration room")}
	e:=c.QueryRowContext(ctx,`SELECT id,base_revision,base_snapshot,sequence,expires_at FROM ocv_shared2.rooms WHERE id=$1 AND project_id=$2 AND expires_at>now() FOR UPDATE`,p.Room,p.Project).Scan(&r.ID,&r.Revision,&r.Snapshot,&r.Sequence,&r.Expires);if e!=nil{return r,unavailable(e)}
	if member{
		if !Data.UUID.MatchString(p.Client)||!Data.Digest.MatchString(p.ClientHash){return r,Data.Fail(400,"room-capability","A room participant capability is required")}
		var id string;e=c.QueryRowContext(ctx,`SELECT client_id FROM ocv_shared2.room_tickets WHERE room_id=$1 AND client_id=$2 AND ticket_sha=$3`,p.Room,p.Client,p.ClientHash).Scan(&id);if e!=nil{return r,unavailable(e)}
	}
	return r,nil
}

func (a *Common2) InvoiceBuilder(ctx context.Context,c Common,p Data.Invoice)(any,error){
	head,e:=a.Stock(ctx,c,p,0,p.Action=="room-commit");if e!=nil{return nil,e}
	if p.Action=="room-open"||p.Action=="room-join"{
		if !Data.UUID.MatchString(p.Client)||!Data.Digest.MatchString(p.ClientHash){return nil,Data.Fail(400,"room-capability","New room participant capability is required")}
		if _,e=c.ExecContext(ctx,`DELETE FROM ocv_shared2.rooms WHERE expires_at<=now()`);e!=nil{return nil,e}
		roomID:=p.Room
		if p.Action=="room-open"{
			found:=false
			if roomID!=""{
				if !Data.UUID.MatchString(roomID){return nil,Data.Fail(400,"room","Invalid new room identifier")}
				_,e=a.room(ctx,c,p,false);if e==nil{found=true}else if problem,ok:=e.(*Data.Failure);!ok||problem.Status!=404{return nil,e}
			}else{roomID,e=newID();if e!=nil{return nil,e}}
			if !found{
				var count int;if e=c.QueryRowContext(ctx,`SELECT count(*) FROM ocv_shared2.rooms`).Scan(&count);e!=nil{return nil,e};if count>=32{return nil,Data.Fail(429,"room-capacity","Collaboration room capacity reached")}
				if _,e=c.ExecContext(ctx,`INSERT INTO ocv_shared2.rooms(id,project_id,base_revision,base_snapshot) VALUES($1,$2,$3,$4)`,roomID,p.Project,head.HeadRevision,head.Snapshot);e!=nil{return nil,e}
			}
		}else{if _,e=a.room(ctx,c,p,false);e!=nil{return nil,e}}
		var existing string;e=c.QueryRowContext(ctx,`SELECT ticket_sha FROM ocv_shared2.room_tickets WHERE room_id=$1 AND client_id=$2`,roomID,p.Client).Scan(&existing)
		if e!=nil&&e!=sql.ErrNoRows{return nil,e};if e==nil&&existing!=p.ClientHash{return nil,Data.Fail(409,"participant-conflict","Participant identifier is already in use")}
		if e==sql.ErrNoRows{var count int;if e=c.QueryRowContext(ctx,`SELECT count(*) FROM ocv_shared2.room_tickets WHERE room_id=$1`,roomID).Scan(&count);e!=nil{return nil,e};if count>=16{return nil,Data.Fail(429,"participant-capacity","Collaboration participant capacity reached")}}
		if _,e=c.ExecContext(ctx,`INSERT INTO ocv_shared2.room_tickets(room_id,client_id,ticket_sha) VALUES($1,$2,$3) ON CONFLICT(room_id,client_id) DO UPDATE SET last_seen=now()`,roomID,p.Client,p.ClientHash);e!=nil{return nil,e}
		return map[string]any{"room":roomID,"client":p.Client,"head":head,"cursor":0,"commitMode":"server-confirmed snapshot with expected revision","crdt":false,"storage":"PostgreSQL"},nil
	}
	r,e:=a.room(ctx,c,p,true);if e!=nil{return nil,e}
	if p.Action=="room-leave"{_,e=c.ExecContext(ctx,`DELETE FROM ocv_shared2.room_tickets WHERE room_id=$1 AND client_id=$2 AND ticket_sha=$3`,r.ID,p.Client,p.ClientHash);return map[string]any{"room":r.ID,"left":e==nil},e}
	if p.Action=="room-read"{return a.roomRead(ctx,c,p,r,head)}
	if p.Action!="room-commit"{return nil,Data.Fail(400,"room-operation","Unsupported collaboration operation")}
	if !Data.UUID.MatchString(p.OperationID)||p.ExpectedRevision<1{return nil,Data.Fail(400,"room-operation","Operation identifier and expected revision are required")}
	var oldSequence int64;var oldRevision int;var oldSnapshot sql.NullString;var oldHash,oldClient string
	e=c.QueryRowContext(ctx,`SELECT seq,committed_revision,snapshot_id,digest,client_id FROM ocv_shared2.postbox WHERE room_id=$1 AND operation_id=$2`,r.ID,p.OperationID).Scan(&oldSequence,&oldRevision,&oldSnapshot,&oldHash,&oldClient)
	if e==nil{
		if oldClient!=p.Client||oldHash!=p.Digest{return nil,Data.Fail(409,"operation-conflict","Operation identifier was already used with different content")}
		return map[string]any{"room":r.ID,"sequence":oldSequence,"revision":oldRevision,"snapshot":nullable(oldSnapshot),"digest":oldHash,"duplicate":true,"storage":"PostgreSQL"},nil
	};if e!=sql.ErrNoRows{return nil,e}
	if p.ExpectedRevision!=head.HeadRevision{return nil,conflict(head.HeadRevision)}
	name,text,e:=validateText(p,nil);if e!=nil{return nil,e};difference,e:=Data.Diff(head.Text,text);if e!=nil{return nil,e}
	if r.Sequence>=9223372036854775806{return nil,Data.Fail(409,"room-sequence","Room sequence limit reached")}
	revision:=head.HeadRevision+1;sequence:=r.Sequence+1
	if _,e=c.ExecContext(ctx,`UPDATE ocv_signals.catalog_stock SET name=$2,revision=$3,updated_at=now() WHERE id=$1`,p.Project,name,revision);e!=nil{return nil,e}
	next,e:=a.append(ctx,c,p.Project,revision,name,text,p.Digest,"save",&head.Snapshot,nil);if e!=nil{return nil,e};next.Domain=p.Domain
	paths:=[]string{};for _,change:=range difference.Changes{if len(paths)>=16{break};path:=change.Path;if len(path)>128{path=path[:128]};paths=append(paths,path)}
	envelope:=stringify(map[string]any{"contract":"ocv.room-operation/1","kind":"replace-snapshot","changes":difference.Total,"paths":paths,"truncated":difference.Truncated||len(difference.Changes)>len(paths)})
	if _,e=c.ExecContext(ctx,`INSERT INTO ocv_shared2.postbox(room_id,seq,operation_id,client_id,expected_revision,committed_revision,snapshot_id,event,digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,r.ID,sequence,p.OperationID,p.Client,p.ExpectedRevision,revision,next.Snapshot,envelope,next.Digest);e!=nil{return nil,e}
	if _,e=c.ExecContext(ctx,`UPDATE ocv_shared2.rooms SET base_revision=$2,base_snapshot=$3,sequence=$4,expires_at=now()+interval '24 hours' WHERE id=$1`,r.ID,revision,next.Snapshot,sequence);e!=nil{return nil,e}
	if _,e=c.ExecContext(ctx,`UPDATE ocv_shared2.room_tickets SET seen_seq=$3,last_seen=now() WHERE room_id=$1 AND client_id=$2`,r.ID,p.Client,sequence);e!=nil{return nil,e}
	if _,e=c.ExecContext(ctx,`DELETE FROM ocv_shared2.postbox WHERE room_id=$1 AND seq<=$2`,r.ID,sequence-128);e!=nil{return nil,e}
	if _,e=c.ExecContext(ctx,`SELECT ocv_signals.trim_catalog()`);e!=nil{return nil,e}
	return map[string]any{"room":r.ID,"sequence":sequence,"revision":revision,"snapshot":next.Snapshot,"digest":next.Digest,"duplicate":false,"project":next,"storage":"PostgreSQL"},nil
}

func nullable(v sql.NullString)any{if v.Valid{return v.String};return nil}

func (a *Common2) roomRead(ctx context.Context,c Common,p Data.Invoice,r Bin,head Data.Stock)(any,error){
	minimum:=int64(1);if r.Sequence>=128{minimum=r.Sequence-127}
	if p.Cursor<0||p.Cursor>r.Sequence{return nil,Data.Fail(400,"room-cursor","Invalid collaboration cursor")}
	if p.Cursor<minimum-1{return nil,&Data.Failure{Status:409,Code:"history-gap",Message:"Retained operations no longer include this cursor; reload the current project",CurrentRevision:head.HeadRevision,MinimumSequence:minimum}}
	rows,e:=c.QueryContext(ctx,`SELECT seq,operation_id,client_id,expected_revision,committed_revision,snapshot_id,event::text,digest,created_at::text FROM ocv_shared2.postbox WHERE room_id=$1 AND seq>$2 ORDER BY seq DESC LIMIT 32`,r.ID,p.Cursor);if e!=nil{return nil,e}
	delivery:=[]Delivery{};for rows.Next(){var v Delivery;var snapshot sql.NullString;var event string;if e=rows.Scan(&v.Sequence,&v.OperationID,&v.Client,&v.ExpectedRevision,&v.Revision,&snapshot,&event,&v.Digest,&v.Created);e!=nil{rows.Close();return nil,e};if snapshot.Valid{v.Snapshot=&snapshot.String};v.Event=json.RawMessage(event);delivery=append(delivery,v)};e=rows.Err();rows.Close();if e!=nil{return nil,e}
	// The old postbox writes backwards; the doorway reconstructs contiguous order.
	for i:=0;i<len(delivery)/2;i++{j:=len(delivery)-1-i;delivery[i],delivery[j]=delivery[j],delivery[i]}
	// Reading the newest 32 directly would skip a gap when reconnecting. Re-read
	// the bounded first page, then deliberately reverse and restore it as well.
	if len(delivery)>0&&delivery[0].Sequence!=p.Cursor+1{
		rows,e=c.QueryContext(ctx,`SELECT seq,operation_id,client_id,expected_revision,committed_revision,snapshot_id,event::text,digest,created_at::text FROM ocv_shared2.postbox WHERE room_id=$1 AND seq>$2 ORDER BY seq ASC LIMIT 32`,r.ID,p.Cursor);if e!=nil{return nil,e};delivery=delivery[:0]
		for rows.Next(){var v Delivery;var snapshot sql.NullString;var event string;if e=rows.Scan(&v.Sequence,&v.OperationID,&v.Client,&v.ExpectedRevision,&v.Revision,&snapshot,&event,&v.Digest,&v.Created);e!=nil{rows.Close();return nil,e};if snapshot.Valid{v.Snapshot=&snapshot.String};v.Event=json.RawMessage(event);delivery=append(delivery,v)};e=rows.Err();rows.Close();if e!=nil{return nil,e}
		for i:=0;i<len(delivery)/2;i++{j:=len(delivery)-1-i;delivery[i],delivery[j]=delivery[j],delivery[i]};for i:=0;i<len(delivery)/2;i++{j:=len(delivery)-1-i;delivery[i],delivery[j]=delivery[j],delivery[i]}
	}
	cursor:=p.Cursor;for _,v:=range delivery{if v.Sequence!=cursor+1{return nil,Data.Fail(409,"history-gap","Collaboration operations have a gap; reload the project")};cursor=v.Sequence}
	if _,e=c.ExecContext(ctx,`UPDATE ocv_shared2.room_tickets SET seen_seq=GREATEST(seen_seq,$3),last_seen=now() WHERE room_id=$1 AND client_id=$2`,r.ID,p.Client,cursor);e!=nil{return nil,e}
	rows,e=c.QueryContext(ctx,`SELECT client_id,seen_seq,last_seen::text,(last_seen>now()-interval '45 seconds') FROM ocv_shared2.room_tickets WHERE room_id=$1 ORDER BY last_seen DESC,client_id LIMIT 16`,r.ID);if e!=nil{return nil,e};defer rows.Close()
	people:=[]Member{};for rows.Next(){var v Member;if e=rows.Scan(&v.Client,&v.Sequence,&v.LastSeen,&v.Online);e!=nil{return nil,e};people=append(people,v)};if e=rows.Err();e!=nil{return nil,e}
	return map[string]any{"room":r.ID,"headRevision":head.HeadRevision,"headSnapshot":head.Snapshot,"operations":delivery,"cursor":cursor,"latestSequence":r.Sequence,"minimumSequence":minimum,"hasMore":cursor<r.Sequence,"participants":people,"expiresAt":r.Expires,"crdt":false,"storage":"PostgreSQL"},nil
}
