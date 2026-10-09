with Common2; use Common2;
package body Delete is
   procedure Tombstone (Data : in out Warehouse; Id : Identifier) is
      I : constant Natural := Find (Data, Id);
   begin
      if I = 0 or else Data.Batches (I).Occupies /= 0 then return; end if;
      Data.Batches (I).State := Deleted;
      Data.Batches (I).Version := Data.Batches (I).Version + 1;
   end Tombstone;
   procedure Compact (Data : in out Warehouse; Before : Minute) is
      Write_At : Natural := 0;
      Referenced : Boolean;
   begin
      for I in 1 .. Data.Batch_Count loop
         Referenced := False;
         for E in 1 .. Data.Edge_Count loop
            Referenced := Referenced or Data.Order_Items (E).Before_Id = Data.Batches (I).Id or
               Data.Order_Items (E).After_Id = Data.Batches (I).Id;
         end loop;
         if Data.Batches (I).State /= Deleted or else Data.Batches (I).Expires >= Before or else Referenced then
            Write_At := Write_At + 1;
            Data.Batches (Write_At) := Data.Batches (I);
         end if;
      end loop;
      Data.Batch_Count := Write_At;
      Data.Generation := Data.Generation + 1;
   end Compact;
end Delete;
