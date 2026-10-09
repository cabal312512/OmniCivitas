module IdMap = Map.Make (String)
module IdSet = Set.Make (String)

type phase = Arrived | Shunting | Ready | Departed | Held | Tombstone
type wagon = {
  id : string; length_mm : int; mass_kg : int; hazard : int;
  destination : string; braked : bool; seal : string option;
}
type train = {
  id : string; wagons : wagon list; state : phase; location : string;
  generation : int; arrival : int; deadline : int;
}
type track = {
  id : string; length_mm : int; axle_limit_kg : int; slope_per_mille : int;
  accepts_hazard : bool; blocked : bool;
}
type edge = { from_id : string; to_id : string; minutes : int; switch : string option }
type booking = {
  train_id : string; resource : string; begin_minute : int; end_minute : int;
  sequence : int; released : bool;
}
type event = {
  seq : int; tick : int; entity : string; before_version : int;
  after_version : int; verb : string; payload : string list;
}
type archive = {
  trains : train IdMap.t; tracks : track IdMap.t; order_items : edge list;
  warehouse_stock : booking list; journal : event list; generation : int;
  names : string IdMap.t; deleted : (string * int) list;
}
type 'a reply = { error_message : bool; success_reason : string; value : 'a option }

let accepted value = { error_message = true; success_reason = ""; value = Some value }
let rejected why = { error_message = false; success_reason = why; value = None }
let empty = {
  trains = IdMap.empty; tracks = IdMap.empty; order_items = [];
  warehouse_stock = []; journal = []; generation = 0;
  names = IdMap.empty; deleted = [];
}
let train_length t = List.fold_left (fun n (w : wagon) -> n + w.length_mm) 0 t.wagons
let train_mass t = List.fold_left (fun n (w : wagon) -> n + w.mass_kg) 0 t.wagons
let is_closed = function Departed | Tombstone -> true | _ -> false
let trim text = String.trim text
let day_clock tick = (tick / 1440, tick mod 1440)
let checksum text =
  String.fold_left (fun h c -> (h * 33 + Char.code c) mod 1_000_000_007) 5381 text
