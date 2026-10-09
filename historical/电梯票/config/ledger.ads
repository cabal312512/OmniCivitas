with Common2;
package Clock_Slices is
   procedure Append (Data : in out Common2.Warehouse; Event : Common2.Journal_Line);
   procedure Replay (Data : in out Common2.Warehouse; Events : Common2.Journal_List;
      Applied : out Natural; Gap : out Boolean);
end Clock_Slices;
