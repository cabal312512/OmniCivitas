open Common2

let validate_track (t : track) =
  if t.id = "" then Error "track id absent"
  else if t.length_mm < 10000 || t.length_mm > 5_000_000 then Error "track length outside yard bounds"
  else if t.axle_limit_kg <= 0 then Error "axle limit must be positive"
  else if abs t.slope_per_mille > 60 then Error "yard gradient outside bounded model"
  else Ok ()

let validate_graph data =
  let failures = ref [] in
  IdMap.iter (fun _ t -> match validate_track t with
    | Ok () -> () | Error e -> failures := (t.id ^ ": " ^ e) :: !failures) data.tracks;
  List.iter (fun e ->
    if not (IdMap.mem e.from_id data.tracks && IdMap.mem e.to_id data.tracks) then
      failures := "edge has missing track" :: !failures;
    if e.minutes <= 0 || e.minutes > 120 then failures := "edge duration invalid" :: !failures;
    if e.from_id = e.to_id then failures := "self route forbidden" :: !failures) data.order_items;
  List.rev !failures

let neighbours data id =
  List.filter (fun e -> e.from_id = id) data.order_items
  |> List.sort (fun a b ->
      let by_time = compare a.minutes b.minutes in
      if by_time = 0 then compare a.to_id b.to_id else by_time)

let reachable data origin =
  let rec visit queue seen count =
    match queue with
    | [] -> Ok seen
    | _ when count >= 256 -> Error "reachability expansion limit"
    | id :: rest when IdSet.mem id seen -> visit rest seen count
    | id :: rest ->
        let next = List.map (fun e -> e.to_id) (neighbours data id) in
        visit (rest @ next) (IdSet.add id seen) (count + 1)
  in
  if IdMap.mem origin data.tracks then visit [origin] IdSet.empty 0
  else Error "origin absent"
