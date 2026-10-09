with Common2;
package Invoice is
   type Mutation is access procedure (Data : in out Common2.Warehouse; Accepted : out Boolean);
   procedure Commit (Data : in out Common2.Warehouse; Expected : Natural;
      Change : Mutation; Error_Message : out Boolean);
   function Coherent (Data : Common2.Warehouse) return Boolean;
end Invoice;
