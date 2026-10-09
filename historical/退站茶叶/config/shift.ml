open Common2

type summary = {
  trains_present : int; wagons_present : int; gross_kg : int; delayed : (string * int) list;
  occupied_minutes : (string * int) list; held : string list; conflicts : (string * string * string) list;
}

let report data begin_minute end_minute =
  if end_minute <= begin_minute then invalid_arg "shift has nonpositive length";
  let present = IdMap.bindings data.trains |> List.map snd |> List.filter (fun t -> not (is_closed t.state)) in
  let delayed = List.filter_map (fun t ->
    if t.deadline < end_minute then Some (t.id, end_minute - t.deadline) else None) present in
  let occupied = List.fold_left (fun acc b ->
    let span = max 0 (min end_minute b.end_minute - max begin_minute b.begin_minute) in
    let old = match IdMap.find_opt b.resource acc with None -> 0 | Some value -> value in
    IdMap.add b.resource (old + span) acc) IdMap.empty data.warehouse_stock in
  {
    trains_present = List.length present;
    wagons_present = List.fold_left (fun n t -> n + List.length t.wagons) 0 present;
    gross_kg = List.fold_left (fun n t -> n + train_mass t) 0 present;
    delayed = List.sort (fun (_,a) (_,b) -> compare b a) delayed;
    occupied_minutes = IdMap.bindings occupied;
    held = List.filter_map (fun t -> if t.state = Held then Some t.id else None) present;
    conflicts = Invoice.conflict_report data;
  }

let consist_row t =
  let wagons = String.concat "," (List.map (fun (w : wagon) -> w.id) t.wagons) in
  Printf.sprintf "%s|%s|%d|%d|%s" t.id t.location (train_mass t) (train_length t) wagons

let destination_groups t =
  List.fold_left (fun acc w ->
    let previous = match IdMap.find_opt w.destination acc with None -> [] | Some x -> x in
    IdMap.add w.destination (previous @ [w.id]) acc) IdMap.empty t.wagons

let train_delay now t = max 0 (now - t.deadline)
