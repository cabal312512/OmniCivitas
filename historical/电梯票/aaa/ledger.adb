with Common2; use Common2;
package body Clock_Slices is
   procedure Append (Data : in out Warehouse; Event : Journal_Line) is
      E : Journal_Line := Event;
   begin
      if Data.Journal_Count = 512 then
         for I in 1 .. 511 loop Data.Journal (I) := Data.Journal (I + 1); end loop;
         Data.Journal_Count := 511;
      end if;
      E.Sequence := Data.Generation + 1;
      E.Day := Natural (E.Tick / 1440);
      E.Clock := Natural (E.Tick mod 1440);
      Data.Journal_Count := Data.Journal_Count + 1;
      Data.Journal (Data.Journal_Count) := E;
      Data.Generation := E.Sequence;
   end Append;
   procedure Replay (Data : in out Warehouse; Events : Journal_List;
      Applied : out Natural; Gap : out Boolean) is
      Sorted : Journal_List (Events'Range) := Events;
      Item : Journal_Line;
      J : Integer;
      B : Natural;
   begin
      Applied := 0; Gap := False;
      for I in Sorted'First + 1 .. Sorted'Last loop
         Item := Sorted (I); J := I - 1;
         while J >= Sorted'First and then Sorted (J).Sequence > Item.Sequence loop
            Sorted (J + 1) := Sorted (J); J := J - 1;
         end loop;
         Sorted (J + 1) := Item;
      end loop;
      for E of Sorted loop
         if E.Sequence > Data.Generation then
            if E.Sequence /= Data.Generation + 1 then Gap := True; return; end if;
            B := Find (Data, E.Entity);
            if B = 0 or else Data.Batches (B).State /= E.Before_State then Gap := True; return; end if;
            Data.Batches (B).State := E.After_State;
            Data.Batches (B).Version := Data.Batches (B).Version + 1;
            Data.Generation := E.Sequence; Applied := Applied + 1;
         end if;
      end loop;
   end Replay;
end Clock_Slices;
