open Common2

type message = { version : int; sequence : int; train : string; verb : string; track : string; tick : int }

let decimal text offset size maximum =
  if offset < 0 || size <= 0 || offset + size > String.length text then Error "fixed field outside record"
  else
    let rec consume i n =
      if i = offset + size then Ok n
      else match text.[i] with
      | '0' .. '9' as c ->
          let next = n * 10 + Char.code c - Char.code '0' in
          if next > maximum then Error "decimal field exceeds limit" else consume (i + 1) next
      | _ -> Error "non-decimal fixed field"
    in consume offset 0

let parse text =
  if String.length text <> 64 || String.sub text 0 3 <> "RY2" then Error "message version or size unsupported"
  else
    match decimal text 3 8 99_999_999, decimal text 43 9 9_999_999,
          decimal text 52 10 1_000_000_006 with
    | Ok sequence, Ok tick, Ok sum ->
        if checksum (String.sub text 0 52) <> sum then Error "fixed message checksum differs"
        else
          let train = trim (String.sub text 11 12) in
          let verb = trim (String.sub text 23 8) in
          let track = trim (String.sub text 31 12) in
          if not (List.mem verb ["arrive"; "move"; "depart"; "hold"]) then Error "message verb unsupported"
          else Ok { version = 2; sequence; train; verb; track; tick }
    | Error e, _, _ | _, Error e, _ | _, _, Error e -> Error e

let padded width text =
  if String.length text > width then invalid_arg "identifier exceeds fixed field"
  else text ^ String.make (width - String.length text) ' '

let encode m =
  let prefix = Printf.sprintf "RY2%08d%s%s%s%09d"
    m.sequence (padded 12 m.train) (padded 8 m.verb) (padded 12 m.track) m.tick in
  prefix ^ Printf.sprintf "%010d00" (checksum prefix)

let normalise old =
  { old with train = String.uppercase_ascii (trim old.train);
             track = String.uppercase_ascii (trim old.track) }
