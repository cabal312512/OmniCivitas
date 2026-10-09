with Common2;
package Restore is
   type Approval is record
      Reviewer : Natural := 0;
      Reviewed_Version : Natural := 0;
      Evidence_Complete : Boolean := False;
      Accept_Dose : Long_Float := 0.0;
   end record;
   procedure Release_Batch (Data : in out Common2.Warehouse; Id : Common2.Identifier;
      Stamp : Approval; Now : Common2.Minute; Error_Message : out Boolean);
end Restore;
