open Common2

type path = { edges : edge list; cost : int }

let shortest data ~origin ~target ~allow =
  let rec search frontier visited expansions =
    if expansions >= 512 then Error "bounded route search exhausted"
    else match List.sort (fun (_,a) (_,b) -> compare a.cost b.cost) frontier with
      | [] -> Error "destination is unreachable"
      | (id, route) :: rest ->
          if id = target then Ok route
          else if IdSet.mem id visited then search rest visited expansions
          else
            let next = Weather.neighbours data id
              |> List.filter (fun e -> allow e.to_id && not (IdSet.mem e.to_id visited))
              |> List.map (fun e -> (e.to_id, { edges = route.edges @ [e]; cost = route.cost + e.minutes })) in
            search (rest @ next) (IdSet.add id visited) (expansions + 1)
  in
  if not (IdMap.mem origin data.tracks && IdMap.mem target data.tracks) then Error "route endpoint absent"
  else search [origin, {edges = []; cost = 0}] IdSet.empty 0

let resources route =
  List.fold_left (fun acc e ->
    let ids = match e.switch with None -> [e.to_id] | Some s -> [e.to_id; "switch:" ^ s] in
    List.fold_left (fun set id -> IdSet.add id set) acc ids) IdSet.empty route.edges

let alternative data ~origin ~target ~forbidden =
  shortest data ~origin ~target ~allow:(fun id -> not (IdSet.mem id forbidden))

let check_continuity origin route =
  let rec loop previous = function
    | [] -> true
    | e :: rest -> e.from_id = previous && loop e.to_id rest
  in loop origin route.edges

let reverse_route data route =
  let rec collect acc = function
    | [] -> Ok { edges = acc; cost = route.cost }
    | e :: rest ->
        match List.find_opt (fun r -> r.from_id = e.to_id && r.to_id = e.from_id) data.order_items with
        | None -> Error "route is not reversible"
        | Some reversed -> collect (reversed :: acc) rest
  in collect [] route.edges
