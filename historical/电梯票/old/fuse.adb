with Common2; use Common2;
package body Tickets is
   procedure Split (Data : in out Warehouse; Source, Child : Identifier;
      Quantity : Mass; Accepted : out Boolean) is
      S : constant Natural := Find (Data, Source);
      N : Natural;
   begin
      Accepted := False;
      if S = 0 or else Child = 0 or else Find (Data, Child) /= 0 or else
         Quantity = 0 or else Quantity >= Data.Batches (S).Price or else
         Data.Batch_Count = 128 or else Data.Edge_Count = 256 or else
         Data.Batches (S).Occupies /= 0 then return; end if;
      N := Data.Batch_Count + 1;
      Data.Batches (N) := Data.Batches (S);
      Data.Batches (N).Id := Child;
      Data.Batches (N).Parent := Source;
      Data.Batches (N).Price := Quantity;
      Data.Batches (N).Version := 1;
      Data.Batches (S).Price := Data.Batches (S).Price - Quantity;
      Data.Batches (S).Version := Data.Batches (S).Version + 1;
      Data.Edge_Count := Data.Edge_Count + 1;
      Data.Order_Items (Data.Edge_Count) := (Source, Child, Quantity);
      Data.Batch_Count := N;
      Accepted := True;
   end Split;
   procedure Merge (Data : in out Warehouse; Left, Right, Target : Identifier;
      Accepted : out Boolean) is
      L : constant Natural := Find (Data, Left);
      R : constant Natural := Find (Data, Right);
      N : Natural;
   begin
      Accepted := False;
      if L = 0 or else R = 0 or else L = R or else Find (Data, Target) /= 0 or else
         Data.Batch_Count = 128 or else Data.Edge_Count > 254 then return; end if;
      if Data.Batches (L).Low /= Data.Batches (R).Low or else
         Data.Batches (L).High /= Data.Batches (R).High or else
         Data.Batches (L).Occupies /= 0 or else Data.Batches (R).Occupies /= 0 then return; end if;
      N := Data.Batch_Count + 1;
      Data.Batches (N) := Data.Batches (L);
      Data.Batches (N).Id := Target;
      Data.Batches (N).Parent := 0;
      Data.Batches (N).Price := Data.Batches (L).Price + Data.Batches (R).Price;
      Data.Batches (N).Expires := Minute'Min (Data.Batches (L).Expires, Data.Batches (R).Expires);
      Data.Batches (N).Dose := Long_Float'Max (Data.Batches (L).Dose, Data.Batches (R).Dose);
      Data.Batches (N).Evidence_Gap := Data.Batches (L).Evidence_Gap or Data.Batches (R).Evidence_Gap;
      Data.Order_Items (Data.Edge_Count + 1) := (Left, Target, Data.Batches (L).Price);
      Data.Order_Items (Data.Edge_Count + 2) := (Right, Target, Data.Batches (R).Price);
      Data.Edge_Count := Data.Edge_Count + 2;
      Data.Batches (L).State := Deleted; Data.Batches (R).State := Deleted;
      Data.Batches (L).Price := 0; Data.Batches (R).Price := 0;
      Data.Batch_Count := N;
      Accepted := True;
   end Merge;
end Tickets;
