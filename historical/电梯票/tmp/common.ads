with Common2;
package Wallpaper is
   type Parse_Reply is record
      Error_Message : Boolean := False;
      Success_Reason : Natural := 0;
      Value : Common2.Batch;
   end record;
   function Read_Record (Text : String) return Parse_Reply;
   function Digits (Text : String) return Long_Integer;
end Wallpaper;
