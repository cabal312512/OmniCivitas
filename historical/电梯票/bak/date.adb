with Common2; use Common2;
package body Receipt_Queue is
   procedure Plan (Data : Warehouse; Need : Mass; Now : Minute;
      Result : out Picking_List; Count : out Natural; Complete : out Boolean) is
      Chosen : array (1 .. 128) of Boolean := (others => False);
      Remaining : Mass := Need;
      Best : Natural;
      Slice : Mass;
   begin
      Count := 0; Complete := False; Result := (others => (0, 0));
      while Remaining > 0 and Count < Result'Length loop
         Best := 0;
         for I in 1 .. Data.Batch_Count loop
            if not Chosen (I) and then Data.Batches (I).Expires > Now and then
               Data.Batches (I).State in Stored | Released and then not Data.Batches (I).Evidence_Gap then
               if Best = 0 or else Data.Batches (I).Expires < Data.Batches (Best).Expires then Best := I; end if;
            end if;
         end loop;
         exit when Best = 0;
         Chosen (Best) := True;
         Slice := Mass'Min (Remaining, Data.Batches (Best).Price);
         Count := Count + 1;
         Result (Result'First + Count - 1) := (Data.Batches (Best).Id, Slice);
         Remaining := Remaining - Slice;
      end loop;
      Complete := Remaining = 0;
   end Plan;
end Receipt_Queue;
