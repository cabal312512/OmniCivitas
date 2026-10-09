open Common2

let validate_wagon (w : wagon) =
  if w.id = "" || w.length_mm < 1000 || w.length_mm > 40000 then Error "wagon geometry invalid"
  else if w.mass_kg < 1000 || w.mass_kg > 160000 then Error "wagon gross mass invalid"
  else if w.hazard < 0 || w.hazard > 9 then Error "unknown dangerous-goods class"
  else if w.destination = "" then Error "wagon destination missing"
  else Ok ()

let incompatible left right =
  (left.hazard = 1 && right.hazard <> 0 && right.hazard <> 1) ||
  (right.hazard = 1 && left.hazard <> 0 && left.hazard <> 1) ||
  (left.hazard = 3 && right.hazard = 5) || (left.hazard = 5 && right.hazard = 3)

let inspect_train t =
  let rec inspect seen previous = function
    | [] -> Ok ()
    | w :: rest ->
        match validate_wagon w with
        | Error _ as e -> e
        | Ok () ->
            if IdSet.mem w.id seen then Error "wagon appears twice in consist"
            else if List.exists (incompatible w) previous then Error "incompatible dangerous-goods mix"
            else inspect (IdSet.add w.id seen) (w :: previous) rest
  in
  if t.wagons = [] then Error "empty consist" else inspect IdSet.empty [] t.wagons

let fits t track =
  not track.blocked && train_length t + 4000 <= track.length_mm &&
  List.for_all (fun (w : wagon) -> w.mass_kg / 4 <= track.axle_limit_kg) t.wagons &&
  (track.accepts_hazard || List.for_all (fun w -> w.hazard = 0) t.wagons)

let brake_fraction t =
  let total = train_mass t in
  if total = 0 then 0.0 else
    float_of_int (List.fold_left (fun sum w -> if w.braked then sum + w.mass_kg else sum) 0 t.wagons)
    /. float_of_int total

let departure_allowed t =
  match inspect_train t with
  | Error _ as e -> e
  | Ok () -> if brake_fraction t < 0.7 then Error "insufficient braked mass"
      else if List.exists (fun w -> w.hazard <> 0 && w.seal = None) t.wagons then Error "dangerous-goods seal absent"
      else Ok ()
