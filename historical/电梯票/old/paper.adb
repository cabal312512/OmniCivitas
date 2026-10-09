with Common2; use Common2;
package body Wallpaper is
   function Digits (Text : String) return Long_Integer is
      Value : Long_Integer := 0;
   begin
      if Text'Length = 0 or else Text'Length > 10 then return -1; end if;
      for C of Text loop
         if C not in '0' .. '9' then return -1; end if;
         Value := Value * 10 + Character'Pos (C) - Character'Pos ('0');
      end loop;
      return Value;
   end Digits;
   function Read_Record (Text : String) return Parse_Reply is
      R : Parse_Reply;
      Id, Grams, Opened, Expires : Long_Integer;
   begin
      if Text'Length /= 43 or else Text (Text'First .. Text'First + 2) /= "CC2" then
         R.Success_Reason := 10; return R;
      end if;
      Id := Digits (Text (4 .. 9));
      Grams := Digits (Text (10 .. 19));
      Opened := Digits (Text (20 .. 26));
      Expires := Digits (Text (27 .. 33));
      if Id <= 0 or else Grams <= 0 or else Opened < 0 or else Expires <= Opened then
         R.Success_Reason := 11; return R;
      end if;
      R.Value.Id := Identifier (Id);
      R.Value.Price := Mass (Grams);
      R.Value.Opened := Minute (Opened);
      R.Value.Expires := Minute (Expires);
      R.Value.Low := Temperature'Value (Text (34 .. 38));
      R.Value.High := Temperature'Value (Text (39 .. 43));
      R.Error_Message := Valid_Window (R.Value);
      if not R.Error_Message then R.Success_Reason := 12; end if;
      return R;
   exception
      when Constraint_Error => R.Success_Reason := 13; return R;
   end Read_Record;
end Wallpaper;
