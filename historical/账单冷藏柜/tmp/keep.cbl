>>source format free
identification division.
program-id. KeepNewest.
data division.
working-storage section.
01 i binary-long.
01 j binary-long.
01 retained binary-long.
01 protected-row pic 9.
01 obsolete-period pic 9(6).
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to retained discarded-count
    compute obsolete-period = period-number - 100
    perform varying i from 1 by 1 until i > row-count
       move 0 to protected-row
       if receipt-paid(i) not = receipt-total(i) and receipt-status(i) not = 'R'
          move 1 to protected-row
       end-if
       perform varying j from 1 by 1 until j > row-count
          if receipt-parent(j) = receipt-key(i) and
             receipt-period(j) >= obsolete-period
             move 1 to protected-row
          end-if
       end-perform
       if receipt-period(i) >= obsolete-period or protected-row = 1
          add 1 to retained
          if retained not = i
             move receipt-row(i) to receipt-row(retained)
          end-if
       else
          add 1 to discarded-count
       end-if
    end-perform
    perform varying i from retained by 1 until i >= row-count
       initialize receipt-row(i + 1)
    end-perform
    move retained to row-count
    add 1 to generation-number
    move 'settled unreferenced history compacted' to error-message
    goback.
end program KeepNewest.
