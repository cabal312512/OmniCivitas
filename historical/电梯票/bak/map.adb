with Common2; use Common2;
package body Parking is
   function Select_Slot (Data : Warehouse; B : Batch) return Natural is
      Best : Natural := 0;
      Waste : Mass := Mass'Last;
   begin
      for I in 1 .. Data.Slot_Count loop
         if not Data.Slots (I).Locked and then
            Data.Slots (I).Capacity - Data.Slots (I).Used >= B.Price and then
            Data.Slots (I).Set_Point in B.Low .. B.High then
            if Data.Slots (I).Capacity - Data.Slots (I).Used - B.Price < Waste then
               Best := I;
               Waste := Data.Slots (I).Capacity - Data.Slots (I).Used - B.Price;
            end if;
         end if;
      end loop;
      return Best;
   end Select_Slot;
   procedure Place (Data : in out Warehouse; Batch_Id, Slot_Id : Identifier;
      Accepted : out Boolean) is
      B : constant Natural := Find (Data, Batch_Id);
   begin
      Accepted := False;
      if B = 0 or else Data.Batches (B).Occupies /= 0 then return; end if;
      for S in 1 .. Data.Slot_Count loop
         if Data.Slots (S).Id = Slot_Id and then not Data.Slots (S).Locked and then
            Data.Slots (S).Capacity - Data.Slots (S).Used >= Data.Batches (B).Price and then
            Data.Slots (S).Set_Point in Data.Batches (B).Low .. Data.Batches (B).High then
            Data.Slots (S).Used := Data.Slots (S).Used + Data.Batches (B).Price;
            Data.Batches (B).Occupies := Slot_Id;
            Data.Batches (B).State := Stored;
            Data.Batches (B).Version := Data.Batches (B).Version + 1;
            Accepted := True; return;
         end if;
      end loop;
   end Place;
   procedure Vacate (Data : in out Warehouse; Batch_Id : Identifier) is
      B : constant Natural := Find (Data, Batch_Id);
   begin
      if B = 0 then return; end if;
      for S in 1 .. Data.Slot_Count loop
         if Data.Slots (S).Id = Data.Batches (B).Occupies then
            Data.Slots (S).Used := Data.Slots (S).Used - Data.Batches (B).Price;
            Data.Batches (B).Occupies := 0;
            Data.Batches (B).State := Moving;
            Data.Batches (B).Version := Data.Batches (B).Version + 1;
            return;
         end if;
      end loop;
   end Vacate;
end Parking;
