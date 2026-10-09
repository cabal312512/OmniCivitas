open Common2

let delete data id tick =
  match IdMap.find_opt id data.trains with
  | None -> Error "train absent"
  | Some t ->
      if List.exists (fun b -> b.train_id = id && not b.released) data.warehouse_stock then
        Error "train still has live resource reservations"
      else if t.wagons <> [] && t.state <> Departed then Error "loaded present consist cannot be tombstoned"
      else
        let trains = IdMap.add id { t with state = Tombstone; generation = t.generation + 1 } data.trains in
        Ok { data with trains; deleted = (id, tick) :: data.deleted; generation = data.generation + 1 }

let compact data before =
  let referenced id =
    List.exists (fun b -> b.train_id = id && not b.released) data.warehouse_stock ||
    List.exists (fun e -> e.entity = id && e.tick >= before) data.journal in
  let candidates = List.filter (fun (id, tick) -> tick < before && not (referenced id)) data.deleted in
  let dead = List.fold_left (fun set (id, _) -> IdSet.add id set) IdSet.empty candidates in
  let trains = IdMap.filter (fun id _ -> not (IdSet.mem id dead)) data.trains in
  let names = IdMap.filter (fun _ actual -> not (IdSet.mem actual dead)) data.names in
  let bookings = List.filter (fun b -> not b.released || b.end_minute >= before) data.warehouse_stock in
  { data with trains; names; warehouse_stock = bookings;
      journal = List.filter (fun e -> e.tick >= before || not (IdSet.mem e.entity dead)) data.journal;
      deleted = List.filter (fun (id,_) -> not (IdSet.mem id dead)) data.deleted;
      generation = data.generation + 1 }

let restore data source new_id tick =
  match IdMap.find_opt source data.trains with
  | None -> Error "source tombstone absent"
  | Some t when t.state <> Tombstone -> Error "source is not retired"
  | Some t ->
      if IdMap.mem new_id data.trains then Error "restoration id occupied"
      else Ok { data with trains = IdMap.add new_id {t with id = new_id; state = Arrived;
        generation = 1; arrival = tick} data.trains; generation = data.generation + 1 }
