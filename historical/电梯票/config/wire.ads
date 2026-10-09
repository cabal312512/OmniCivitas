with Common2;
package Parcel is
   type Word_List is array (Positive range <>) of Long_Integer;
   function Encode (B : Common2.Batch) return Word_List;
   function Decode (Words : Word_List) return Common2.Batch;
   function Checksum (Words : Word_List) return Long_Integer;
end Parcel;
