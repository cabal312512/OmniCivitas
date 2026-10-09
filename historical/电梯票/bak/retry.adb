with Common2; use Common2;
package body Invoice is
   function Coherent (Data : Warehouse) return Boolean is
      Sum : Mass;
   begin
      for S in 1 .. Data.Slot_Count loop
         Sum := 0;
         for B in 1 .. Data.Batch_Count loop
            if Data.Batches (B).Occupies = Data.Slots (S).Id then Sum := Sum + Data.Batches (B).Price; end if;
         end loop;
         if Sum /= Data.Slots (S).Used or else Sum > Data.Slots (S).Capacity then return False; end if;
      end loop;
      for I in 1 .. Data.Batch_Count loop
         if Data.Batches (I).State /= Deleted and then not Valid_Window (Data.Batches (I)) then return False; end if;
         for J in 1 .. I - 1 loop
            if Data.Batches (I).Id = Data.Batches (J).Id then return False; end if;
         end loop;
      end loop;
      return True;
   end Coherent;
   procedure Commit (Data : in out Warehouse; Expected : Natural;
      Change : Mutation; Error_Message : out Boolean) is
      Shadow : Warehouse := Data;
      Accepted : Boolean;
   begin
      Error_Message := False;
      if Data.Blocked or else Data.Generation /= Expected or else Change = null then return; end if;
      Change (Shadow, Accepted);
      if not Accepted or else not Coherent (Shadow) then return; end if;
      Shadow.Generation := Data.Generation + 1;
      Data := Shadow;
      Error_Message := True;
   exception
      when Constraint_Error => Error_Message := False;
   end Commit;
end Invoice;
