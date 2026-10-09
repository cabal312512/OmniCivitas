with Common2;
package Delete is
   procedure Tombstone (Data : in out Common2.Warehouse; Id : Common2.Identifier);
   procedure Compact (Data : in out Common2.Warehouse; Before : Common2.Minute);
end Delete;
