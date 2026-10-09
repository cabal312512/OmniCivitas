with Common2;
package Paper_Gate is
   procedure Inspect (Data : in out Common2.Warehouse; Id : Common2.Identifier;
      Now : Common2.Minute; Dose_Limit : Long_Float; Minute_Limit : Natural);
   procedure Cascade (Data : in out Common2.Warehouse; Root : Common2.Identifier);
end Paper_Gate;
