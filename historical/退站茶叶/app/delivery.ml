open Common2

let with_message text continuation = match Screen.parse text with
  | Error why -> rejected why | Ok message -> continuation (Screen.normalise message)

let with_name data name continuation = match Cache.resolve data name with
  | Error why -> rejected why | Ok id -> continuation id

let with_train data id continuation = match IdMap.find_opt id data.trains with
  | None -> rejected "message train absent" | Some train -> continuation train

let with_destination data name continuation =
  with_name data name (fun id -> match IdMap.find_opt id data.tracks with
    | None -> rejected "message destination absent" | Some track -> continuation track)

let with_plan data train track now continuation =
  match Clock.schedule data train track.id now (now + 720) with
  | Error why -> rejected why | Ok plan -> continuation plan

let with_reservation data plan continuation = match Invoice.reserve data plan.Clock.bookings with
  | Error why -> rejected why | Ok reserved -> continuation reserved

let receive data text =
  with_message text (fun message ->
    with_name data message.Screen.train (fun id ->
      with_train data id (fun train ->
        with_destination data message.track (fun track ->
          with_plan data train track message.tick (fun plan ->
            with_reservation data plan (fun reserved ->
              let updated = { train with state = Shunting; generation = train.generation + 1 } in
              let reserved = { reserved with trains = IdMap.add train.id updated reserved.trains } in
              let recorded = Order.append reserved train.id train.generation updated.generation
                  "movement-planned" [track.id; string_of_int plan.earliest] message.tick in
              let issues = Receipt.invariants recorded in
              if issues <> [] then rejected (String.concat "; " issues)
              else accepted (recorded, plan)))))))

let depart data id tick =
  match IdMap.find_opt id data.trains with
  | None -> rejected "departure train absent"
  | Some train -> match Paper.departure_allowed train with
    | Error why -> rejected why
    | Ok () -> Receipt.change_phase data id train.generation Departed tick
