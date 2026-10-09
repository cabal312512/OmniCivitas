with Common2;
package Routes is
   type Leg is record
      From_Id, To_Id : Common2.Identifier := 0;
      Duration : Natural := 0;
      Ambient : Common2.Temperature := 0.0;
   end record;
   type Leg_List is array (Positive range <>) of Leg;
   function Risk (B : Common2.Batch; Path : Leg_List; Start : Common2.Minute) return Long_Float;
end Routes;
