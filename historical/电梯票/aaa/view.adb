with Common2; use Common2;
package body Common is
   function Aggregate (Data : Warehouse; Now : Minute) return Summary is
      R : Summary;
      Occupied : Mass;
   begin
      for I in 1 .. Data.Batch_Count loop
         if Data.Batches (I).Expires <= Now or else Data.Batches (I).State = Deleted then
            R.Gone := R.Gone + Data.Batches (I).Price;
         elsif Data.Batches (I).State = Held then
            R.Quarantined := R.Quarantined + Data.Batches (I).Price;
         else R.Usable := R.Usable + Data.Batches (I).Price;
         end if;
         if Data.Batches (I).Evidence_Gap then R.Missing_Evidence := R.Missing_Evidence + 1; end if;
         R.Peak_Dose := Long_Float'Max (R.Peak_Dose, Data.Batches (I).Dose);
      end loop;
      for S in 1 .. Data.Slot_Count loop
         Occupied := 0;
         for B in 1 .. Data.Batch_Count loop
            if Data.Batches (B).Occupies = Data.Slots (S).Id then Occupied := Occupied + Data.Batches (B).Price; end if;
         end loop;
         R.Occupancy_Valid := R.Occupancy_Valid and Occupied = Data.Slots (S).Used;
      end loop;
      return R;
   end Aggregate;
   function Row (B : Batch) return String is
   begin
      return Identifier'Image (B.Id) & "|" & Mass'Image (B.Price) & "|g|" &
         Condition'Image (B.State) & "|" & Natural'Image (B.Version) & "|" & Long_Float'Image (B.Dose);
   end Row;
end Common;
