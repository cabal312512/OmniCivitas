with Common2;
package Parking is
   function Select_Slot (Data : Common2.Warehouse; B : Common2.Batch) return Natural;
   procedure Place (Data : in out Common2.Warehouse; Batch_Id : Common2.Identifier;
      Slot_Id : Common2.Identifier; Accepted : out Boolean);
   procedure Vacate (Data : in out Common2.Warehouse; Batch_Id : Common2.Identifier);
end Parking;
