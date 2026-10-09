open Common2

let append data entity before after verb payload tick =
  let seq = match data.journal with [] -> 1 | e :: _ -> e.seq + 1 in
  let event = { seq; tick; entity; before_version = before; after_version = after; verb; payload } in
  let rec take n = function [] -> [] | _ when n = 0 -> [] | h :: t -> h :: take (n - 1) t in
  { data with journal = take 512 (event :: data.journal) }

let replay data events =
  let ordered = List.sort (fun a b -> compare a.seq b.seq) events in
  let rec loop current last applied = function
    | [] -> Ok (current, applied)
    | e :: tail when e.seq <= last -> loop current last applied tail
    | e :: _ when last > 0 && e.seq <> last + 1 -> Error "journal sequence gap"
    | e :: tail ->
        match IdMap.find_opt e.entity current.trains with
        | None -> Error "journal entity absent"
        | Some t when t.generation = e.after_version -> loop current e.seq applied tail
        | Some t when t.generation <> e.before_version -> Error "journal revision gap"
        | Some t ->
            let changed = match e.verb, e.payload with
              | "move", [location] -> Ok { t with location; state = Ready }
              | "hold", _ -> Ok { t with state = Held }
              | "depart", _ -> Ok { t with state = Departed }
              | "delete", _ -> Ok { t with state = Tombstone }
              | _ -> Error "unsupported journal mutation" in
            match changed with
            | Error _ as failure -> failure
            | Ok updated ->
                let trains = IdMap.add t.id { updated with generation = e.after_version } current.trains in
                loop { current with trains } e.seq (applied + 1) tail
  in loop data 0 0 ordered

let since data sequence =
  List.filter (fun e -> e.seq > sequence) data.journal
  |> List.sort (fun a b -> compare a.seq b.seq)

let journal_row e =
  let day, minute = day_clock e.tick in
  Printf.sprintf "%d|%d:%04d|%s|%s|%d>%d" e.seq day minute e.entity e.verb e.before_version e.after_version
