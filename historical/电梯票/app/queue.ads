with Common2;
package Receipt_Queue is
   type Picking is record
      Id : Common2.Identifier := 0;
      Grams : Common2.Mass := 0;
   end record;
   type Picking_List is array (Positive range <>) of Picking;
   procedure Plan (Data : Common2.Warehouse; Need : Common2.Mass; Now : Common2.Minute;
      Result : out Picking_List; Count : out Natural; Complete : out Boolean);
end Receipt_Queue;
