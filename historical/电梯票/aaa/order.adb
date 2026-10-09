with Common2; use Common2;
package body Order_Items is
   procedure Descendants (Data : Warehouse; Root : Identifier;
      Output : out Id_List; Count : out Natural; Truncated : out Boolean) is
      Queue : Id_List (1 .. 256) := (others => 0);
      Head : Natural := 1;
      Tail : Natural := 1;
      Seen : Boolean;
   begin
      Count := 0; Truncated := False; Output := (others => 0); Queue (1) := Root;
      while Head <= Tail loop
         for E in 1 .. Data.Edge_Count loop
            if Data.Order_Items (E).Before_Id = Queue (Head) then
               Seen := False;
               for I in 1 .. Tail loop
                  Seen := Seen or Queue (I) = Data.Order_Items (E).After_Id;
               end loop;
               if not Seen then
                  if Tail = Queue'Last or else Count = Output'Length then
                     Truncated := True; return;
                  end if;
                  Tail := Tail + 1;
                  Queue (Tail) := Data.Order_Items (E).After_Id;
                  Count := Count + 1; Output (Output'First + Count - 1) := Queue (Tail);
               end if;
            end if;
         end loop;
         Head := Head + 1;
      end loop;
   end Descendants;
   function Conserved (Data : Warehouse; Child : Identifier) return Boolean is
      Total : Mass := 0;
      I : constant Natural := Find (Data, Child);
      Found : Boolean := False;
   begin
      if I = 0 then return False; end if;
      for E in 1 .. Data.Edge_Count loop
         if Data.Order_Items (E).After_Id = Child then
            Total := Total + Data.Order_Items (E).Weight; Found := True;
         end if;
      end loop;
      return not Found or else Total = Data.Batches (I).Price;
   end Conserved;
end Order_Items;
