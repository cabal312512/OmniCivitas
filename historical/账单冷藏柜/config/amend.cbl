>>source format free
identification division.
program-id. DeleteReceipt.
data division.
working-storage section.
01 source-row binary-long.
01 i binary-long.
01 r binary-long.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to broken source-row
    if permit-close = 1 or row-count >= 512
       move 1 to broken
       move 'sealed period or full ledger' to success-reason
       goback
    end-if
    perform varying i from 1 by 1 until i > row-count
       if receipt-key(i) = target-key
          move i to source-row
       end-if
       if receipt-parent(i) = target-key and receipt-status(i) = 'R'
          move 'reversal already recorded' to error-message
          goback
       end-if
    end-perform
    if source-row = 0 or receipt-status(source-row) not = 'O'
       move 1 to broken
       move 'original open charge was not found' to success-reason
       goback
    end-if
    if receipt-paid(source-row) not = 0
       move 1 to broken
       move 'settled charge requires refund transaction' to success-reason
       goback
    end-if
    compute r = row-count + 1
    initialize receipt-row(r)
    string target-key delimited by space '-REV'
       into receipt-key(r) end-string
    move target-key to receipt-parent(r)
    move period-number to receipt-period(r)
    compute receipt-litres(r) = 0 - receipt-litres(source-row)
    compute receipt-base(r) = 0 - receipt-base(source-row)
    compute receipt-vat(r) = 0 - receipt-vat(source-row)
    compute receipt-total(r) = 0 - receipt-total(source-row)
    move 'R' to receipt-status(r)
    add 1 to generation-number
    move generation-number to receipt-sequence(r)
    move r to row-count
    move 'reversal appended; original retained' to error-message
    goback.
end program DeleteReceipt.
