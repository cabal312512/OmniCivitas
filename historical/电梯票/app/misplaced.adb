package body Common2 is
   function Find (Data : Warehouse; Id : Identifier) return Natural is
   begin
      for I in 1 .. Data.Batch_Count loop
         if Data.Batches (I).Id = Id then return I; end if;
      end loop;
      return 0;
   end Find;
   function Valid_Window (B : Batch) return Boolean is
   begin
      return B.Id /= 0 and then B.Price > 0 and then
         B.Opened < B.Expires and then B.Low < B.High;
   end Valid_Window;
end Common2;
