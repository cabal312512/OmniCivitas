with Common2; use Common2;
with Order_Items;
package body Paper_Gate is
   procedure Inspect (Data : in out Warehouse; Id : Identifier;
      Now : Minute; Dose_Limit : Long_Float; Minute_Limit : Natural) is
      I : constant Natural := Find (Data, Id);
   begin
      if I = 0 then return; end if;
      if Now >= Data.Batches (I).Expires then
         Data.Batches (I).State := Expired;
      elsif Data.Batches (I).Evidence_Gap or else
         Data.Batches (I).Dose > Dose_Limit or else
         Data.Batches (I).Excursion_Minutes > Minute_Limit then
         Data.Batches (I).State := Held;
      else
         return;
      end if;
      Data.Batches (I).Version := Data.Batches (I).Version + 1;
   end Inspect;
   procedure Cascade (Data : in out Warehouse; Root : Identifier) is
      Ids : Order_Items.Id_List (1 .. 128);
      Count, Index : Natural;
      Truncated : Boolean;
   begin
      Order_Items.Descendants (Data, Root, Ids, Count, Truncated);
      if Truncated then Data.Blocked := True; return; end if;
      for K in 1 .. Count loop
         Index := Find (Data, Ids (K));
         if Index /= 0 and then Data.Batches (Index).State /= Deleted then
            Data.Batches (Index).State := Held;
            Data.Batches (Index).Version := Data.Batches (Index).Version + 1;
         end if;
      end loop;
   end Cascade;
end Paper_Gate;
