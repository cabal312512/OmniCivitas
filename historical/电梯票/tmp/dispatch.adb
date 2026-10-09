with Common2; use Common2;
package body Routes is
   function Risk (B : Batch; Path : Leg_List; Start : Minute) return Long_Float is
      Now : Minute := Start;
      Dose : Long_Float := B.Dose;
      Excess : Long_Float;
      Previous : Identifier := 0;
   begin
      for L of Path loop
         if Previous /= 0 and then L.From_Id /= Previous then return Long_Float'Last; end if;
         if L.Duration = 0 then return Long_Float'Last; end if;
         Now := Now + Minute (L.Duration);
         if Now >= B.Expires then return Long_Float'Last; end if;
         Excess := 0.0;
         if L.Ambient > B.High then Excess := Long_Float (L.Ambient - B.High); end if;
         if L.Ambient < B.Low then Excess := Long_Float (B.Low - L.Ambient); end if;
         Dose := Dose + Excess * Long_Float (L.Duration);
         Previous := L.To_Id;
      end loop;
      return Dose;
   exception
      when Constraint_Error => return Long_Float'Last;
   end Risk;
end Routes;
