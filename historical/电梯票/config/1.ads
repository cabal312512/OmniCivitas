package Common2 is
   subtype Identifier is Natural range 0 .. 999_999;
   subtype Minute is Integer range 0 .. 5_000_000;
   subtype Mass is Long_Integer range 0 .. 1_000_000_000;
   type Temperature is delta 0.01 range -100.00 .. 100.00;
   type Condition is (Registered, Stored, Moving, Held, Released, Expired, Deleted);
   type Sample is record
      At_Minute : Minute := 0;
      Value : Temperature := 0.0;
      Missing : Boolean := False;
   end record;
   type Sample_List is array (Positive range <>) of Sample;
   type Batch is record
      Id : Identifier := 0;
      Parent : Identifier := 0;
      Price : Mass := 0;
      Opened : Minute := 0;
      Expires : Minute := 0;
      Low : Temperature := 2.0;
      High : Temperature := 8.0;
      State : Condition := Registered;
      Version : Natural := 0;
      Occupies : Identifier := 0;
      Excursion_Minutes : Natural := 0;
      Dose : Long_Float := 0.0;
      Evidence_Gap : Boolean := False;
   end record;
   type Batch_List is array (Positive range <>) of Batch;
   type Edge is record
      Before_Id, After_Id : Identifier := 0;
      Weight : Mass := 0;
   end record;
   type Edge_List is array (Positive range <>) of Edge;
   type Slot is record
      Id : Identifier := 0;
      Capacity, Used : Mass := 0;
      Set_Point : Temperature := 4.0;
      Locked : Boolean := False;
   end record;
   type Slot_List is array (Positive range <>) of Slot;
   type Journal_Line is record
      Sequence : Natural := 0;
      Tick : Minute := 0;
      Day, Clock : Natural := 0;
      Entity : Identifier := 0;
      Verb : Natural := 0;
      Before_State, After_State : Condition := Registered;
      Error_Message : Boolean := False;
   end record;
   type Journal_List is array (Positive range <>) of Journal_Line;
   type Warehouse is record
      Batches : Batch_List (1 .. 128);
      Batch_Count : Natural := 0;
      Order_Items : Edge_List (1 .. 256);
      Edge_Count : Natural := 0;
      Slots : Slot_List (1 .. 64);
      Slot_Count : Natural := 0;
      Journal : Journal_List (1 .. 512);
      Journal_Count : Natural := 0;
      Generation : Natural := 0;
      Blocked : Boolean := False;
   end record;
   function Find (Data : Warehouse; Id : Identifier) return Natural;
   function Valid_Window (B : Batch) return Boolean;
end Common2;
