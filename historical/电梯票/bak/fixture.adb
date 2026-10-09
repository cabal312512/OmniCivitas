with Common2; use Common2;
package body Samples is
   function Warehouse_Fixture return Warehouse is
      D : Warehouse;
   begin
      D.Slot_Count := 3;
      D.Slots (1) := (101, 100_000, 0, 4.0, False);
      D.Slots (2) := (102, 80_000, 0, -18.0, False);
      D.Slots (3) := (103, 60_000, 0, 5.0, True);
      D.Batch_Count := 3;
      D.Batches (1) := (Id => 1, Parent => 0, Price => 32_000,
         Opened => 100, Expires => 2000, Low => 2.0, High => 8.0, others => <>);
      D.Batches (2) := (Id => 2, Parent => 0, Price => 16_000,
         Opened => 200, Expires => 1400, Low => 2.0, High => 8.0, others => <>);
      D.Batches (3) := (Id => 3, Parent => 0, Price => 24_000,
         Opened => 100, Expires => 5000, Low => -24.0, High => -16.0, others => <>);
      return D;
   end Warehouse_Fixture;
   function Crossing return Sample_List is
   begin
      return ((100, 4.0, False), (110, 7.0, False), (120, 10.0, False),
         (130, 9.0, False), (140, 4.0, False));
   end Crossing;
   function Gap return Sample_List is
   begin
      return ((100, 4.0, False), (110, 0.0, True), (200, 5.0, False));
   end Gap;
end Samples;
