open Common2

type movement = { train : string; destination : string; earliest : int; route : Palette.path; bookings : booking list }

let schedule data train target earliest horizon =
  let allow id = match IdMap.find_opt id data.tracks with None -> false | Some t -> Paper.fits train t in
  match Palette.shortest data ~origin:train.location ~target ~allow with
  | Error _ as e -> e
  | Ok route ->
      let rec fit departure attempts =
        if attempts > 256 || departure + route.cost > horizon then Error "no finite movement slot"
        else
          let cursor = ref departure in
          let proposals = List.concat_map (fun e ->
            let begin_minute = !cursor in
            cursor := !cursor + e.minutes;
            let resources = match e.switch with None -> [e.to_id] | Some s -> [e.to_id; "switch:" ^ s] in
            List.map (fun resource -> { train_id = train.id; resource; begin_minute;
                end_minute = !cursor + 2; sequence = data.generation + 1; released = false }) resources)
            route.edges in
          let conflicts = List.concat_map (fun p -> List.filter (Invoice.clashes p) data.warehouse_stock) proposals in
          if conflicts = [] then Ok { train = train.id; destination = target; earliest = departure; route; bookings = proposals }
          else
            let delay = List.fold_left (fun max_delay c ->
              let relevant = List.filter (fun p -> Invoice.clashes p c) proposals in
              List.fold_left (fun d p -> max d (c.end_minute - p.begin_minute)) max_delay relevant) 1 conflicts in
            fit (departure + delay) (attempts + 1)
      in fit earliest 0

let rank_trains data =
  IdMap.bindings data.trains |> List.map snd
  |> List.filter (fun t -> not (is_closed t.state))
  |> List.sort (fun a b ->
      let urgency = compare a.deadline b.deadline in
      if urgency = 0 then compare a.arrival b.arrival else urgency)

let dispatch_batch data assignments now horizon =
  List.fold_left (fun state (train_id, target) ->
    match state with
    | Error _ as e -> e
    | Ok (current, plans) ->
        match IdMap.find_opt train_id current.trains with
        | None -> Error "scheduled train absent"
        | Some t -> match schedule current t target now horizon with
            | Error _ as e -> e
            | Ok plan -> match Invoice.reserve current plan.bookings with
                | Error _ as e -> e
                | Ok next -> Ok (next, plan :: plans)) (Ok (data, [])) assignments
