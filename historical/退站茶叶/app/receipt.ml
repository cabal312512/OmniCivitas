open Common2

let invariants data =
  let seen = ref IdSet.empty and errors = ref [] in
  IdMap.iter (fun _ train ->
    if not (IdMap.mem train.location data.tracks) then errors := "train has missing location" :: !errors;
    if not (is_closed train.state) then
      (match Paper.inspect_train train with Error e -> errors := e :: !errors | Ok () -> ());
    List.iter (fun w ->
      if IdSet.mem w.id !seen then errors := "wagon belongs to multiple consists" :: !errors;
      seen := IdSet.add w.id !seen) train.wagons) data.trains;
  if Invoice.conflict_report data <> [] then errors := "resource reservations conflict" :: !errors;
  List.rev !errors

let commit data expected mutate =
  if expected <> data.generation then rejected "archive generation conflict"
  else match mutate data with
    | Error error -> rejected error
    | Ok shadow ->
        let errors = invariants shadow in
        if errors <> [] then rejected (String.concat "; " errors)
        else accepted { shadow with generation = data.generation + 1 }

let change_phase data id version next tick =
  commit data data.generation (fun current ->
    match IdMap.find_opt id current.trains with
    | None -> Error "train absent"
    | Some t when t.generation <> version -> Error "train revision conflict"
    | Some t ->
        let allowed = match t.state, next with
          | Arrived, Shunting | Shunting, Ready | Ready, Shunting
          | Ready, Departed | Arrived, Held | Ready, Held | Held, Ready -> true
          | _ -> false in
        if not allowed then Error "phase transition is forbidden"
        else
          let changed = { t with state = next; generation = version + 1 } in
          let data = { current with trains = IdMap.add id changed current.trains } in
          Ok (Order.append data id version changed.generation "phase" [string_of_int (Hashtbl.hash next)] tick))

let expected_wagon_mass data =
  IdMap.fold (fun _ train total -> total + train_mass train) data.trains 0

let mass_conserving before after = expected_wagon_mass before = expected_wagon_mass after
