with Common2;
package Invoice_Builder is
   type Exposure is record
      Minutes_Outside : Natural := 0;
      Degree_Minutes : Long_Float := 0.0;
      Missing_Minutes : Natural := 0;
      Out_Of_Order : Boolean := False;
   end record;
   function Integrate (Samples : Common2.Sample_List;
      Low, High : Common2.Temperature; Max_Gap : Natural) return Exposure;
   procedure Apply (B : in out Common2.Batch; E : Exposure);
end Invoice_Builder;
