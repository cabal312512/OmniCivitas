>>source format free
identification division.
program-id. FindCrate.
data division.
working-storage section.
01 i binary-long.
01 found-row binary-long.
01 compact-key pic x(24).
01 public-key pic x(24).
01 pos binary-long.
01 destination-pos binary-long.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move spaces to compact-key
    move 1 to destination-pos
    perform varying pos from 1 by 1 until pos > 24
       if target-key(pos:1) not = space and target-key(pos:1) not = '-'
          move function upper-case(target-key(pos:1))
             to compact-key(destination-pos:1)
          add 1 to destination-pos
       end-if
    end-perform
    move 0 to found-row
    perform varying i from 1 by 1 until i > row-count
       move function upper-case(receipt-key(i)) to public-key
       if public-key = compact-key
          if found-row not = 0
             move 1 to broken
             move 'ambiguous legacy identifier' to success-reason
             goback
          end-if
          move i to found-row
       end-if
    end-perform
    if found-row = 0
       move 1 to broken
       move 'identifier not present in legacy map' to success-reason
    else
       move found-row to line-number
       move receipt-key(found-row) to target-key
       move 0 to broken
       move 'legacy key resolved' to error-message
    end-if
    goback.
end program FindCrate.
