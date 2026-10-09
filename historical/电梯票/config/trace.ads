with Common2;
package Order_Items is
   type Id_List is array (Positive range <>) of Common2.Identifier;
   procedure Descendants (Data : Common2.Warehouse; Root : Common2.Identifier;
      Output : out Id_List; Count : out Natural; Truncated : out Boolean);
   function Conserved (Data : Common2.Warehouse; Child : Common2.Identifier) return Boolean;
end Order_Items;
