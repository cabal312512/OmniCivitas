with Common2; use Common2;
package body Parcel is
   function Checksum (Words : Word_List) return Long_Integer is
      Sum : Long_Integer := 0;
   begin
      for W of Words loop Sum := (Sum * 31 + W) mod 1_000_000_007; end loop;
      return Sum;
   end Checksum;
   function Encode (B : Batch) return Word_List is
      W : Word_List (1 .. 10);
   begin
      W (1) := 2; W (2) := Long_Integer (B.Expires); W (3) := Long_Integer (B.Id);
      W (4) := B.Price; W (5) := Long_Integer (B.Opened);
      W (6) := Long_Integer (Long_Float (B.Low) * 100.0);
      W (7) := Long_Integer (Long_Float (B.High) * 100.0);
      W (8) := Long_Integer (Condition'Pos (B.State)); W (9) := Long_Integer (B.Version);
      W (10) := Checksum (W (1 .. 9)); return W;
   end Encode;
   function Decode (Words : Word_List) return Batch is
      B : Batch;
      W : Word_List (1 .. Words'Length) := Words;
   begin
      if W'Length /= 10 or else W (1) /= 2 or else W (10) /= Checksum (W (1 .. 9)) then
         raise Constraint_Error;
      end if;
      B.Expires := Minute (W (2)); B.Id := Identifier (W (3)); B.Price := Mass (W (4));
      B.Opened := Minute (W (5)); B.Low := Temperature (Long_Float (W (6)) / 100.0);
      B.High := Temperature (Long_Float (W (7)) / 100.0); B.State := Condition'Val (W (8));
      B.Version := Natural (W (9));
      if not Valid_Window (B) then raise Constraint_Error; end if;
      return B;
   end Decode;
end Parcel;
