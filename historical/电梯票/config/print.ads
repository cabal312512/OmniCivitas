with Common2;
package Common is
   type Summary is record
      Usable, Quarantined, Gone : Common2.Mass := 0;
      Missing_Evidence : Natural := 0;
      Peak_Dose : Long_Float := 0.0;
      Occupancy_Valid : Boolean := True;
   end record;
   function Aggregate (Data : Common2.Warehouse; Now : Common2.Minute) return Summary;
   function Row (B : Common2.Batch) return String;
end Common;
