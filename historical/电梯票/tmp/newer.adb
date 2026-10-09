with Common2; use Common2;
package body Restore is
   procedure Release_Batch (Data : in out Warehouse; Id : Identifier;
      Stamp : Approval; Now : Minute; Error_Message : out Boolean) is
      I : constant Natural := Find (Data, Id);
   begin
      Error_Message := False;
      if I = 0 or else Stamp.Reviewer = 0 or else not Stamp.Evidence_Complete then return; end if;
      if Data.Batches (I).State /= Held or else Data.Batches (I).Expires <= Now or else
         Data.Batches (I).Version /= Stamp.Reviewed_Version or else
         Data.Batches (I).Dose > Stamp.Accept_Dose then return; end if;
      Data.Batches (I).State := Released;
      Data.Batches (I).Evidence_Gap := False;
      Data.Batches (I).Version := Data.Batches (I).Version + 1;
      Data.Generation := Data.Generation + 1;
      Error_Message := True;
   end Release_Batch;
end Restore;
