with Common2; use Common2;
package body Invoice_Builder is
   function Integrate (Samples : Sample_List; Low, High : Temperature;
      Max_Gap : Natural) return Exposure is
      R : Exposure;
      Dt : Integer;
      A, B : Long_Float;
      function Excess (T : Temperature) return Long_Float is
      begin
         if T < Low then return Long_Float (Low - T); end if;
         if T > High then return Long_Float (T - High); end if;
         return 0.0;
      end Excess;
   begin
      if Samples'Length < 2 then return R; end if;
      for I in Samples'First + 1 .. Samples'Last loop
         Dt := Samples (I).At_Minute - Samples (I - 1).At_Minute;
         if Dt < 0 then R.Out_Of_Order := True;
         elsif Samples (I).Missing or else Samples (I - 1).Missing or else Dt > Max_Gap then
            R.Missing_Minutes := R.Missing_Minutes + Natural (Dt);
         else
            A := Excess (Samples (I - 1).Value);
            B := Excess (Samples (I).Value);
            R.Degree_Minutes := R.Degree_Minutes + (A + B) * Long_Float (Dt) / 2.0;
            if A > 0.0 or else B > 0.0 then
               R.Minutes_Outside := R.Minutes_Outside + Natural (Dt);
            end if;
         end if;
      end loop;
      return R;
   end Integrate;
   procedure Apply (B : in out Batch; E : Exposure) is
   begin
      B.Excursion_Minutes := B.Excursion_Minutes + E.Minutes_Outside;
      B.Dose := B.Dose + E.Degree_Minutes;
      B.Evidence_Gap := B.Evidence_Gap or E.Missing_Minutes > 0 or E.Out_Of_Order;
      B.Version := B.Version + 1;
   end Apply;
end Invoice_Builder;
