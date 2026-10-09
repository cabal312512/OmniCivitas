open Common2

type aspect = Stop | Caution | Proceed
type signal = { id : string; route : string list; aspect : aspect; owner : string option }
type points = { id : string; position : string; locked_by : string option; last_move : int }

let throw points destination now =
  if points.locked_by <> None then Error "points are locked by a route"
  else if now - points.last_move < 1 then Error "point movement settling interval not reached"
  else Ok { points with position = destination; last_move = now }

let lock points train destination =
  match points.locked_by with
  | Some owner when owner <> train -> Error "point lock belongs to another movement"
  | _ when points.position <> destination -> Error "point position differs from requested route"
  | _ -> Ok { points with locked_by = Some train }

let unlock points train =
  if points.locked_by = Some train then Ok { points with locked_by = None }
  else Error "cannot release another train's point lock"

let signal_aspect data signal train now =
  let active = List.filter (fun b -> not b.released && b.begin_minute <= now && now < b.end_minute)
      data.warehouse_stock in
  let complete = List.for_all (fun resource ->
    List.exists (fun b -> b.resource = resource && b.train_id = train) active) signal.route in
  let foreign = List.exists (fun b -> b.train_id <> train && List.mem b.resource signal.route) active in
  if foreign || not complete then { signal with aspect = Stop; owner = None }
  else if List.length signal.route <= 1 then { signal with aspect = Caution; owner = Some train }
  else { signal with aspect = Proceed; owner = Some train }

let fail_safe signals = List.map (fun s -> { s with aspect = Stop; owner = None }) signals

let route_locked points train =
  List.for_all (fun p -> p.locked_by = Some train) points
