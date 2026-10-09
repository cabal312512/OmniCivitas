open Common2

let wagon id destination hazard mass_kg = {
  id; destination; hazard; mass_kg; length_mm = 14500; braked = true;
  seal = if hazard = 0 then None else Some "SYNTHETIC-SEAL";
}

let train id location wagons arrival deadline = {
  id; location; wagons; arrival; deadline; generation = 1; state = Arrived;
}

let archive () =
  let tracks = [
    {id = "A"; length_mm = 200000; axle_limit_kg = 25000; slope_per_mille = 0; accepts_hazard = true; blocked = false};
    {id = "B"; length_mm = 150000; axle_limit_kg = 25000; slope_per_mille = 2; accepts_hazard = true; blocked = false};
    {id = "C"; length_mm = 120000; axle_limit_kg = 22000; slope_per_mille = 1; accepts_hazard = false; blocked = false};
    {id = "D"; length_mm = 250000; axle_limit_kg = 25000; slope_per_mille = 0; accepts_hazard = true; blocked = false};
    {id = "X"; length_mm = 80000; axle_limit_kg = 18000; slope_per_mille = 4; accepts_hazard = false; blocked = true};
  ] in
  let edges = [
    {from_id = "A"; to_id = "B"; minutes = 4; switch = Some "P1"};
    {from_id = "B"; to_id = "D"; minutes = 6; switch = Some "P2"};
    {from_id = "A"; to_id = "C"; minutes = 5; switch = Some "P1"};
    {from_id = "C"; to_id = "D"; minutes = 4; switch = Some "P3"};
    {from_id = "D"; to_id = "B"; minutes = 6; switch = Some "P2"};
    {from_id = "B"; to_id = "A"; minutes = 4; switch = Some "P1"};
  ] in
  let trains = [
    train "SYN-T1" "A" [wagon "W001" "D" 0 42000; wagon "W002" "D" 0 56000] 100 240;
    train "SYN-T2" "B" [wagon "W003" "A" 3 52000] 90 180;
    train "SYN-T3" "C" [wagon "W004" "D" 0 34000; wagon "W005" "A" 0 39000] 110 300;
  ] in
  { empty with tracks = List.fold_left (fun m (t : track) -> IdMap.add t.id t m) IdMap.empty tracks;
      trains = List.fold_left (fun m (t : train) -> IdMap.add t.id t m) IdMap.empty trains;
      order_items = edges;
      warehouse_stock = [{train_id = "SYN-T2"; resource = "switch:P1"; begin_minute = 100;
        end_minute = 108; sequence = 1; released = false}] }

let conflicting_messages () =
  let base : Screen.message = {version = 2; sequence = 1; train = "SYN-T1"; verb = "move"; track = "D"; tick = 100} in
  [Screen.encode base; Screen.encode {base with sequence = 2; train = "SYN-T3"}]
