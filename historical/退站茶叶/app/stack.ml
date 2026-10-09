open Common2

let rec split_at count input =
  if count = 0 then ([], input) else match input with
  | [] -> ([], [])
  | head :: tail -> let left, right = split_at (count - 1) tail in (head :: left, right)

let split data source child count expected =
  match IdMap.find_opt source data.trains with
  | None -> Error "source consist absent"
  | Some t ->
      if t.generation <> expected then Error "consist revision conflict"
      else if is_closed t.state || t.state = Shunting then Error "consist cannot be split in present state"
      else if IdMap.mem child data.trains || child = "" then Error "child id is occupied"
      else if count <= 0 || count >= List.length t.wagons then Error "split must retain both nonempty segments"
      else
        let left, right = split_at count t.wagons in
        let parent = { t with wagons = left; generation = t.generation + 1 } in
        let newborn = { t with id = child; wagons = right; generation = 1 } in
        let trains = data.trains |> IdMap.add source parent |> IdMap.add child newborn in
        Ok { data with trains; generation = data.generation + 1 }

let merge data left right target =
  match IdMap.find_opt left data.trains, IdMap.find_opt right data.trains with
  | Some a, Some b when left <> right ->
      if a.location <> b.location || is_closed a.state || is_closed b.state then Error "consists must share an open track"
      else if IdMap.mem target data.trains then Error "merged id already exists"
      else
        let combined = { a with id = target; wagons = a.wagons @ b.wagons; generation = 1;
          deadline = min a.deadline b.deadline; arrival = min a.arrival b.arrival } in
        (match Paper.inspect_train combined with
          | Error _ as e -> e
          | Ok () ->
              match IdMap.find_opt a.location data.tracks with
              | None -> Error "location track absent"
              | Some track when not (Paper.fits combined track) -> Error "merged consist exceeds siding capacity"
              | Some _ ->
                  let trains = data.trains
                    |> IdMap.add left { a with state = Tombstone; wagons = []; generation = a.generation + 1 }
                    |> IdMap.add right { b with state = Tombstone; wagons = []; generation = b.generation + 1 }
                    |> IdMap.add target combined in
                  Ok { data with trains; generation = data.generation + 1;
                    deleted = (left, data.generation) :: (right, data.generation) :: data.deleted })
  | _ -> Error "merge needs two distinct existing consists"

let sort_destination t =
  let indexed = List.mapi (fun i w -> (i,w)) t.wagons in
  let sorted = List.sort (fun (ia,a) (ib,b) ->
    let result = compare a.destination b.destination in if result = 0 then compare ia ib else result) indexed in
  { t with wagons = List.map snd sorted; generation = t.generation + 1 }
