open Common2

let overlap a b = a.begin_minute < b.end_minute && b.begin_minute < a.end_minute
let clashes a b = not a.released && not b.released && a.resource = b.resource && overlap a b

let reserve data proposals =
  if List.length data.warehouse_stock + List.length proposals > 1024 then
    Error "reservation table full"
  else if List.exists (fun b -> b.begin_minute < 0 || b.end_minute <= b.begin_minute) proposals then
    Error "reservation has invalid half-open window"
  else
    let rec insert current = function
      | [] -> Ok { data with warehouse_stock = current; generation = data.generation + 1 }
      | booking :: rest ->
          if List.exists (clashes booking) current then Error ("resource conflict: " ^ booking.resource)
          else insert (booking :: current) rest
    in insert data.warehouse_stock proposals

let next_gap data resource start duration horizon =
  let occupied = List.filter (fun b -> b.resource = resource && not b.released) data.warehouse_stock
      |> List.sort (fun a b -> compare a.begin_minute b.begin_minute) in
  let finish = List.fold_left (fun cursor b ->
    if cursor < b.end_minute && b.begin_minute < cursor + duration then max cursor b.end_minute else cursor)
    start occupied in
  if finish + duration > horizon then Error "booking horizon exhausted" else Ok finish

let release data train_id now =
  let stock = List.map (fun b ->
    if b.train_id = train_id && b.end_minute <= now then { b with released = true } else b)
    data.warehouse_stock in
  { data with warehouse_stock = stock; generation = data.generation + 1 }

let conflict_report data =
  let rec pairs acc = function
    | [] -> List.rev acc
    | b :: rest ->
        let found = List.filter (clashes b) rest
          |> List.map (fun other -> (b.resource, b.train_id, other.train_id)) in
        pairs (List.rev_append found acc) rest
  in pairs [] data.warehouse_stock
