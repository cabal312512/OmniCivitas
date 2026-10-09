with Common2;
package Tickets is
   procedure Split (Data : in out Common2.Warehouse; Source, Child : Common2.Identifier;
      Quantity : Common2.Mass; Accepted : out Boolean);
   procedure Merge (Data : in out Common2.Warehouse; Left, Right, Target : Common2.Identifier;
      Accepted : out Boolean);
end Tickets;
