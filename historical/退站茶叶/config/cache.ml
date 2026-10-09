open Common2

let compact name =
  String.to_seq (String.uppercase_ascii (trim name))
  |> Seq.filter (fun c -> c <> '-' && c <> ' ' && c <> '_')
  |> String.of_seq

let register data alias canonical =
  let alias = compact alias in
  if not (IdMap.mem canonical data.trains || IdMap.mem canonical data.tracks) then Error "canonical id absent"
  else match IdMap.find_opt alias data.names with
    | Some existing when existing <> canonical -> Error "alias collides with another entity"
    | _ -> Ok { data with names = IdMap.add alias canonical data.names }

let resolve data name =
  if IdMap.mem name data.trains || IdMap.mem name data.tracks then Ok name
  else match IdMap.find_opt (compact name) data.names with
    | Some actual -> Ok actual | None -> Error "legacy name unresolved"

let parcel train =
  let total = train_mass train in
  [string_of_int train.generation; string_of_int total; train.location; train.id;
   string_of_int (train_length train); string_of_int train.arrival; string_of_int train.deadline]

let recover_summary words =
  match words with
  | [version; mass; location; id; length; arrival; deadline] ->
      (try
        let version = int_of_string version and mass = int_of_string mass in
        let length = int_of_string length and arrival = int_of_string arrival in
        let deadline = int_of_string deadline in
        if version < 0 || mass < 0 || length < 0 || arrival < 0 || deadline < arrival then
          Error "summary values violate domain range"
        else Ok (id, location, version, mass, length, arrival, deadline)
      with Failure _ -> Error "summary contains invalid number")
  | _ -> Error "position-array schema mismatch"

let aliases_for data canonical =
  IdMap.bindings data.names |> List.filter_map (fun (alias, actual) -> if actual = canonical then Some alias else None)
