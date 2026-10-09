>>source format free
identification division.
program-id. StoreTemperature.
data division.
working-storage section.
01 i binary-long.
01 r binary-long.
01 outstanding pic s9(12) comp-3.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to broken r
    if amount-cents <= 0
       move 1 to broken
       move 'payment must be positive cents' to success-reason
       goback
    end-if
    perform varying i from 1 by 1 until i > row-count
       if receipt-key(i) = target-key move i to r end-if
    end-perform
    if r = 0 or receipt-status(r) = 'R'
       move 1 to broken
       move 'payment target not payable' to success-reason
       goback
    end-if
    compute outstanding = receipt-total(r) - receipt-paid(r)
    if amount-cents > outstanding
       move 1 to broken
       move 'payment would exceed outstanding charge' to success-reason
       goback
    end-if
    add amount-cents to receipt-paid(r)
    if receipt-paid(r) = receipt-total(r)
       move 'P' to receipt-status(r)
    end-if
    add 1 to generation-number
    move generation-number to receipt-sequence(r)
    move 'payment applied' to error-message
    goback.
end program StoreTemperature.
